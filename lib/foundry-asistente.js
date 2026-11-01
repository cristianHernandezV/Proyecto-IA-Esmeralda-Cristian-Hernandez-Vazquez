"use strict";

const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

const conversaciones = new Map();
const MAX_CONVERSACIONES = 150;

const ROLES_APP_FOUNDRY =
  "super,contador,cliente,empleado,supervisor";

let clienteProyecto = null;
let endpointCache = "";

function rolEnContextoFoundry(rolApp) {
  if (rolApp === "super") return "superusuario";
  return rolApp;
}

function superAutorizacionContable() {
  const raw = String(process.env.FOUNDRY_SUPER_AUTORIZACION_CONTABLE || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "si" || raw === "sí" || raw === "yes";
}

/** Alcance documental que la app autoriza (debe coincidir con las instrucciones del agente en Foundry). */
function alcanceDocumentosPorRol(rol) {
  switch (rol) {
    case "contador":
      return "facturas-proveedores,entregas,inventario";
    case "cliente":
      return "entregas-propias";
    case "empleado":
    case "supervisor":
      return "entregas,inventario";
    case "super":
      return superAutorizacionContable()
        ? "facturas-proveedores,entregas,inventario"
        : "entregas,inventario";
    default:
      return "ninguno";
  }
}

function configuracion() {
  const endpoint = String(process.env.FOUNDRY_PROJECT_ENDPOINT || "").trim();
  const agentName = String(process.env.FOUNDRY_AGENT_NAME || "").trim();
  const agentVersion = String(process.env.FOUNDRY_AGENT_VERSION || "").trim();
  const rolesRaw = String(process.env.FOUNDRY_ROLES || ROLES_APP_FOUNDRY).trim();
  const roles = rolesRaw
    .split(",")
    .map(function (rol) {
      return rol.trim();
    })
    .filter(Boolean);
  return {
    endpoint: endpoint,
    agentName: agentName,
    agentVersion: agentVersion,
    roles: roles,
    habilitado: Boolean(endpoint && agentName),
  };
}

function rolUsaFoundry(rol, cfg) {
  return cfg.habilitado && rol && cfg.roles.indexOf(rol) !== -1;
}

function armarMensajeConContexto({ mensaje, rol, nombre, conteos }) {
  const partesConteo = Object.keys(conteos || {})
    .map(function (clave) {
      return clave + "=" + conteos[clave];
    })
    .join("; ");
  const rolAgente = rolEnContextoFoundry(rol);
  let ctx =
    "[CONTEXTO SESIÓN] rol=" +
    rolAgente +
    "; nombre=" +
    (nombre || "sin-nombre") +
    "; canal=app-rioclaro" +
    "; documentos-permitidos=" +
    alcanceDocumentosPorRol(rol);
  if (rol === "super") {
    ctx += "; autorizacion-contable=" + (superAutorizacionContable() ? "si" : "no");
  }
  if (partesConteo) ctx += "; conteos=" + partesConteo;
  return ctx + "\n\n" + mensaje;
}

function obtenerCliente(endpoint) {
  if (!clienteProyecto || endpointCache !== endpoint) {
    endpointCache = endpoint;
    clienteProyecto = new AIProjectClient(endpoint, new DefaultAzureCredential());
  }
  return clienteProyecto;
}

function registrarConversacion(clave, id) {
  if (conversaciones.size >= MAX_CONVERSACIONES) {
    const primera = conversaciones.keys().next().value;
    conversaciones.delete(primera);
  }
  conversaciones.set(clave, id);
}

async function idConversacion(openAIClient, clave) {
  if (conversaciones.has(clave)) return conversaciones.get(clave);
  const conversation = await openAIClient.conversations.create({ items: [] });
  registrarConversacion(clave, conversation.id);
  return conversation.id;
}

function extraerTexto(response) {
  if (response && typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  if (!response || !Array.isArray(response.output)) return "";
  const partes = [];
  for (const item of response.output) {
    if (item && item.type === "message" && Array.isArray(item.content)) {
      for (const bloque of item.content) {
        if (bloque && bloque.type === "output_text" && bloque.text) {
          partes.push(String(bloque.text));
        }
      }
    }
  }
  return partes.join("\n").trim();
}

function idHiloCliente(valor) {
  const id = String(valor || "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return "";
  return id;
}

async function consultarFoundry({ mensaje, rol, nombre, conversacionId, conteos }) {
  const cfg = configuracion();
  if (!cfg.habilitado) {
    throw new Error("Foundry no está configurado.");
  }

  const project = obtenerCliente(cfg.endpoint);
  const openAIClient = project.getOpenAIClient();
  const hilo = idHiloCliente(conversacionId);
  const claveSesion =
    rol +
    ":" +
    String(nombre || "").toLowerCase() +
    (hilo ? ":" + hilo : "");
  const conversationId = await idConversacion(openAIClient, claveSesion);
  const textoUsuario = armarMensajeConContexto({ mensaje: mensaje, rol: rol, nombre: nombre, conteos: conteos });

  await openAIClient.conversations.items.create(conversationId, {
    items: [{ type: "message", role: "user", content: textoUsuario }],
  });

  const agentRef = { name: cfg.agentName, type: "agent_reference" };
  if (cfg.agentVersion) agentRef.version = cfg.agentVersion;

  const response = await openAIClient.responses.create(
    { conversation: conversationId },
    { body: { agent_reference: agentRef } },
  );

  const texto = extraerTexto(response);
  if (!texto) {
    throw new Error("El agente no devolvió texto.");
  }

  return {
    texto: texto,
    fuente:
      "Agente Microsoft Foundry (" +
      cfg.agentName +
      (cfg.agentVersion ? ", versión " + cfg.agentVersion : "") +
      "). Índice y CSV según instrucciones del agente.",
  };
}

module.exports = {
  configuracion: configuracion,
  rolUsaFoundry: rolUsaFoundry,
  consultarFoundry: consultarFoundry,
};
