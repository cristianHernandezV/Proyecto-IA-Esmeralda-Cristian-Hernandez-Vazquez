const { cargarEnv } = require("./lib/cargar-env");
const foundry = require("./lib/foundry-asistente");
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const cors = require("cors");

const INSTANCIA_SERVIDOR = crypto.randomUUID();

cargarEnv();

const app = express();
const PORT = process.env.PORT || 3000;

const ROLES = {
  super: "Super usuario",
  contador: "Contador",
  cliente: "Cliente",
  empleado: "Empleado",
  supervisor: "Supervisor",
};

const MODULOS_POR_ROL = {
  super: "Usuarios, facturas, pedidos, quejas y reportes de ventas",
  contador: "Facturas",
  cliente: "Pedidos y quejas",
  empleado: "Pedidos",
  supervisor: "Reportes de ventas y quejas",
};

const CLAVES = {
  facturas: "rioclaro.facturas",
  pedidos: "rioclaro.pedidos",
  ventas: "rioclaro.ventas",
  quejas: "rioclaro.quejas",
  usuarios: "rioclaro.usuarios",
};

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/api/estado", (req, res) => {
  res.json({ ok: true, instancia: INSTANCIA_SERVIDOR });
});

app.post("/api/asistente", async (req, res) => {
  const mensaje = textoPlano(req.body && req.body.mensaje, 2000);
  if (!mensaje) {
    return res.status(400).json({ ok: false, motivo: "Escribe un mensaje." });
  }

  const sensible = contieneDatosSensibles(mensaje);
  if (sensible) {
    return res.status(400).json({
      ok: false,
      motivo:
        "El mensaje parece incluir datos sensibles (" +
        sensible +
        "). No lo guardé ni lo reenvié.",
    });
  }

  const rol = ROLES[req.body && req.body.rol] ? req.body.rol : "";
  const nombre = textoPlano(req.body && req.body.nombre, 40);
  const conteos = conteosLimpios(req.body && req.body.conteos);
  const cfgFoundry = foundry.configuracion();

  if (foundry.rolUsaFoundry(rol, cfgFoundry)) {
    const inicioMs = Date.now();
    try {
      const resultado = await foundry.consultarFoundry({
        mensaje: mensaje,
        rol: rol,
        nombre: nombre,
        conversacionId: textoPlano(req.body && req.body.conversacionId, 80),
        conteos: conteos,
      });
      return res.json({
        ok: true,
        esIA: true,
        texto: resultado.texto,
        fuente: resultado.fuente,
        duracionMs: Date.now() - inicioMs,
      });
    } catch (err) {
      console.error("Foundry asistente:", err && err.message ? err.message : err);
      return res.status(502).json({
        ok: false,
        motivo:
          "No pude obtener respuesta del asistente empresarial en Foundry. Revisa .env (FOUNDRY_PROJECT_ENDPOINT, FOUNDRY_AGENT_NAME), que el agente exista en Foundry y que hayas iniciado sesión en Azure con az login.",
      });
    }
  }

  const inicioMs = Date.now();
  const respuesta = armarRespuesta({
    mensaje,
    rol,
    nombre,
    conteos,
    foundryActivo: cfgFoundry.habilitado,
    rolesFoundry: cfgFoundry.roles,
  });
  respuesta.duracionMs = Date.now() - inicioMs;
  return res.json(respuesta);
});

app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, motivo: "Ruta no encontrada." });
});

app.use(express.static(path.join(__dirname, "public")));

app.use((err, req, res, next) => {
  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
    return res.status(400).json({ ok: false, motivo: "El cuerpo no es JSON válido." });
  }
  return res.status(500).json({ ok: false, motivo: "Error interno del servidor." });
});

app.listen(PORT, () => {
  const cfg = foundry.configuracion();
  console.log("Río Claro en http://localhost:" + PORT);
  if (cfg.habilitado) {
    console.log(
      "Asistente Foundry: activo — agente \"" +
        cfg.agentName +
        "\", roles: " +
        cfg.roles.join(", "),
    );
  } else {
    console.log(
      "Asistente Foundry: desactivado — define FOUNDRY_PROJECT_ENDPOINT y FOUNDRY_AGENT_NAME en .env",
    );
  }
});

function textoPlano(valor, max) {
  return String(valor || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function contieneDatosSensibles(texto) {
  if (/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i.test(texto)) return "RFC";
  if (/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i.test(texto)) return "CURP";
  const digitos = texto.replace(/\D/g, "");
  if (/(?:\d[ -]?){13,19}/.test(texto) && digitos.length >= 13 && digitos.length <= 19) {
    return "número de tarjeta";
  }
  if (/(?:contraseña|password|clave)\s*(?:es|:)\s*\S{4,}/i.test(texto)) return "clave";
  return "";
}

function conteosLimpios(entrada) {
  const salida = {};
  if (!entrada || typeof entrada !== "object") return salida;
  for (const clave of Object.values(CLAVES)) {
    const valor = entrada[clave];
    const numero = Number(valor);
    if (Number.isInteger(numero) && numero >= 0 && numero <= 100000) {
      salida[clave] = numero;
    }
  }
  return salida;
}

function detectarTema(mensaje) {
  const texto = mensaje.toLowerCase();
  if (/factura|proveedor|total|duplicad/.test(texto)) return "facturas";
  if (/pedido|entrega|llega|cliente/.test(texto)) return "pedidos";
  if (/venta|reporte|producto/.test(texto)) return "ventas";
  if (/queja|reclamo/.test(texto)) return "quejas";
  if (/usuario|rol|registrar/.test(texto)) return "usuarios";
  return "";
}

function fraseConteo(clave, conteos) {
  if (!Object.prototype.hasOwnProperty.call(conteos, clave)) {
    return {
      frase: "El navegador no informó cuántos registros hay en " + clave + ", así que no doy una cifra.",
      fuente: clave + " (conteo no informado)",
    };
  }
  const n = conteos[clave];
  const registros = n === 1 ? "1 registro" : n + " registros";
  return {
    frase: "En este navegador hay " + registros + " en " + clave + ".",
    fuente: clave + " (" + registros + " informados por el navegador)",
  };
}

function armarRespuesta({ mensaje, rol, nombre, conteos, foundryActivo, rolesFoundry }) {
  const identidad =
    "Soy Esmeralda, la inteligencia artificial del asistente para Distribuidora Río Claro.";
  const rolesTexto =
    Array.isArray(rolesFoundry) && rolesFoundry.length
      ? rolesFoundry.join(", ")
      : "ninguno configurado";
  const stub = foundryActivo
    ? "Tu rol no está en FOUNDRY_ROLES (" +
      rolesTexto +
      "), así que esta respuesta la arma el servidor local y no consulta el índice del agente."
    : "Microsoft Foundry todavía no está conectado: esta respuesta la arma el servidor local y no inventa saldos, fechas ni totales.";
  const saludo = nombre ? "Hola, " + nombre + ". " : "";
  const rolTexto = rol
    ? "Tu rol es " + ROLES[rol] + " y tu módulo es: " + MODULOS_POR_ROL[rol] + "."
    : "No reconocí el rol de la sesión.";
  const tema = detectarTema(mensaje);

  if (!tema) {
    return {
      ok: true,
      esIA: true,
      texto: identidad + " " + saludo + stub + " " + rolTexto + " Pregunta por facturas, pedidos, ventas, quejas o usuarios y te diré la clave correspondiente.",
      fuente:
        "Ninguna tabla. No consulté rioclaro.facturas, rioclaro.pedidos, rioclaro.ventas, rioclaro.quejas ni rioclaro.usuarios.",
    };
  }

  const clave = CLAVES[tema];
  const conteo = fraseConteo(clave, conteos);
  const detalle =
    tema === "usuarios"
      ? "No listo nombres ni claves desde el servidor: las cuentas viven solo en el navegador."
      : "No tengo filas para citar, así que no digo proveedores, estados, fechas ni importes.";

  return {
    ok: true,
    esIA: true,
    texto: identidad + " " + saludo + stub + " " + conteo.frase + " " + detalle,
    fuente: conteo.fuente + ". Stub local, sin Microsoft Foundry.",
  };
}
