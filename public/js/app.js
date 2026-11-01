(function () {
  const ROLES = ["super", "contador", "cliente", "empleado", "supervisor"];

  const NOMBRE_ROL = {
    super: "Super usuario",
    contador: "Contador",
    cliente: "Cliente",
    empleado: "Empleado",
    supervisor: "Supervisor",
  };

  const CLAVE_AUTORIZACION_REGISTRO = "ff18-zas2-210a-09op";

  const CLAVES = {
    usuarios: "rioclaro.usuarios",
    sesion: "rioclaro.sesion",
    instanciaServidor: "rioclaro.instanciaServidor",
    historialChat: "rioclaro.historialChat",
    facturas: "rioclaro.facturas",
    pedidos: "rioclaro.pedidos",
    ventas: "rioclaro.ventas",
    quejas: "rioclaro.quejas",
    estadisticas: "rioclaro.estadisticas",
    sesionUsoId: "rioclaro.sesionUsoId",
  };

  const MAX_CONVERSACIONES_USUARIO = 40;
  const MAX_MENSAJES_CONVERSACION = 200;
  const MAX_SESIONES_USO = 300;
  const LATIDO_ESTADISTICAS_MS = 15000;
  const SESION_ACTIVA_MS = 120000;
  const COLORES_PASTEL = ["#0f6e66", "#c4a35a", "#3d7ea6", "#8d5b8a", "#1d6b45", "#b45a3c", "#5d6e6b", "#2f5d50"];

  const estado = {
    peticionesPendientes: Object.create(null),
    toastLoginTimer: null,
    toastAppTimer: null,
    registroAutorizado: false,
    vigilanciaServidorTimer: null,
    conversacionActivaId: "",
    vistaLogin: "entrar",
    transicionLogin: false,
    transicionLoginTimer: null,
    cancelarMuroEsmeraldas: null,
    entradaPrincipalTimer: null,
    sesionUsoId: "",
    estadisticasLatidoTimer: null,
    estadisticasFiltro: { preset: "7", desde: "", hasta: "" },
  };

  function leerLista(clave) {
    try {
      const datos = JSON.parse(localStorage.getItem(clave) || "[]");
      return Array.isArray(datos) ? datos : [];
    } catch {
      return [];
    }
  }

  function leerUsuarios() {
    return leerLista(CLAVES.usuarios).filter(function (usuario) {
      return usuario && typeof usuario.nombre === "string" && ROLES.indexOf(usuario.rol) !== -1;
    });
  }

  function guardarUsuarios(usuarios) {
    localStorage.setItem(CLAVES.usuarios, JSON.stringify(usuarios));
  }

  function buscarUsuario(nombre) {
    const normalizado = normalizarNombre(nombre).toLowerCase();
    return leerUsuarios().find(function (usuario) {
      return usuario.nombre.toLowerCase() === normalizado;
    }) || null;
  }

  function leerSesion() {
    try {
      const sesion = JSON.parse(localStorage.getItem(CLAVES.sesion) || "null");
      if (!sesion || typeof sesion.nombre !== "string") return null;
      const usuario = buscarUsuario(sesion.nombre);
      if (!usuario) return null;
      return { nombre: usuario.nombre, rol: usuario.rol, inicio: sesion.inicio || "" };
    } catch {
      return null;
    }
  }

  function guardarSesion(usuario) {
    localStorage.setItem(CLAVES.sesion, JSON.stringify({
      nombre: usuario.nombre,
      rol: usuario.rol,
      inicio: new Date().toISOString(),
    }));
  }

  function borrarSesion() {
    localStorage.removeItem(CLAVES.sesion);
  }

  function leerInstanciaServidor() {
    return sessionStorage.getItem(CLAVES.instanciaServidor) || "";
  }

  function guardarInstanciaServidor(instancia) {
    sessionStorage.setItem(CLAVES.instanciaServidor, instancia);
  }

  function borrarInstanciaServidor() {
    sessionStorage.removeItem(CLAVES.instanciaServidor);
  }

  async function obtenerInstanciaServidor() {
    try {
      const respuesta = await fetch("/api/estado", { cache: "no-store" });
      if (!respuesta.ok) return null;
      const data = await respuesta.json().catch(function () { return null; });
      if (!data || data.ok !== true || typeof data.instancia !== "string") return null;
      return data.instancia;
    } catch {
      return null;
    }
  }

  async function vincularSesionAlServidor() {
    const instancia = await obtenerInstanciaServidor();
    if (!instancia) return false;
    guardarInstanciaServidor(instancia);
    return true;
  }

  async function validarSesionConServidor() {
    const sesion = leerSesion();
    if (!sesion) return null;

    const instanciaActual = await obtenerInstanciaServidor();
    if (!instanciaActual) {
      forzarAccesoLogin("No hay conexión con el servidor. Inicia sesión cuando vuelva a estar disponible.");
      return null;
    }

    const vinculo = leerInstanciaServidor();
    if (vinculo && vinculo !== instanciaActual) {
      forzarAccesoLogin("El servidor se reinició. Inicia sesión de nuevo.");
      return null;
    }

    if (!vinculo) guardarInstanciaServidor(instanciaActual);
    return sesion;
  }

  function detenerVigilanciaServidor() {
    if (estado.vigilanciaServidorTimer) {
      clearInterval(estado.vigilanciaServidorTimer);
      estado.vigilanciaServidorTimer = null;
    }
  }

  function iniciarVigilanciaServidor() {
    detenerVigilanciaServidor();
    estado.vigilanciaServidorTimer = setInterval(async function () {
      if (document.getElementById("pantalla-principal").hidden) return;
      const sesion = leerSesion();
      if (!sesion) {
        forzarAccesoLogin("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const instanciaActual = await obtenerInstanciaServidor();
      const vinculo = leerInstanciaServidor();
      if (!instanciaActual || !vinculo || vinculo !== instanciaActual) {
        forzarAccesoLogin(
          instanciaActual
            ? "El servidor se reinició. Inicia sesión de nuevo."
            : "Se perdió la conexión con el servidor. Inicia sesión cuando vuelva a estar disponible."
        );
      }
    }, 8000);
  }

  function normalizarNombre(nombre) {
    return String(nombre || "").replace(/\s+/g, " ").trim();
  }

  function autorizacionRegistroValida(valor) {
    return valor === CLAVE_AUTORIZACION_REGISTRO;
  }

  function nombreValido(nombre) {
    return /^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,39}$/u.test(nombre);
  }

  async function hashClave(clave) {
    const datos = new TextEncoder().encode(clave);
    const buffer = await crypto.subtle.digest("SHA-256", datos);
    return Array.from(new Uint8Array(buffer)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  async function registrarUsuario({ nombre, clave, rol }) {
    const limpio = normalizarNombre(nombre);
    if (!nombreValido(limpio)) {
      return { ok: false, motivo: "El usuario debe tener de 2 a 40 caracteres (letras, números o espacios)." };
    }
    if (typeof clave !== "string" || clave.length < 4 || clave.length > 80) {
      return { ok: false, motivo: "La contraseña debe tener entre 4 y 80 caracteres." };
    }
    if (ROLES.indexOf(rol) === -1) {
      return { ok: false, motivo: "Elige un rol válido." };
    }
    if (buscarUsuario(limpio)) {
      return { ok: false, motivo: "Ese usuario ya existe." };
    }
    const usuarios = leerUsuarios();
    const usuario = {
      nombre: limpio,
      claveHash: await hashClave(clave),
      rol: rol,
      creado: new Date().toISOString(),
    };
    usuarios.push(usuario);
    usuarios.sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es");
    });
    guardarUsuarios(usuarios);
    return { ok: true, usuario: { nombre: usuario.nombre, rol: usuario.rol } };
  }

  async function restablecerClave(nombre, clave) {
    const limpio = normalizarNombre(nombre);
    if (!nombreValido(limpio)) {
      return { ok: false, motivo: "Indica un usuario válido (2 a 40 caracteres)." };
    }
    if (typeof clave !== "string" || clave.length < 4 || clave.length > 80) {
      return { ok: false, motivo: "La nueva contraseña debe tener entre 4 y 80 caracteres." };
    }
    const usuarios = leerUsuarios();
    const indice = usuarios.findIndex(function (usuario) {
      return usuario.nombre.toLowerCase() === limpio.toLowerCase();
    });
    if (indice === -1) {
      return { ok: false, motivo: "No hay ningún usuario con ese nombre." };
    }
    usuarios[indice].claveHash = await hashClave(clave);
    guardarUsuarios(usuarios);
    return { ok: true, nombre: usuarios[indice].nombre };
  }

  async function entrar(nombre, clave) {
    const usuario = buscarUsuario(nombre);
    if (!usuario || typeof clave !== "string" || clave.length < 4) {
      return { ok: false, motivo: "Usuario o contraseña incorrectos." };
    }
    const hash = await hashClave(clave);
    if (hash !== usuario.claveHash) {
      return { ok: false, motivo: "Usuario o contraseña incorrectos." };
    }
    guardarSesion(usuario);
    return { ok: true, sesion: leerSesion() };
  }

  function claveUsuarioHistorial(nombre) {
    return normalizarNombre(nombre).toLowerCase();
  }

  function nuevoIdConversacion() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function leerAlmacenHistorial() {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAVES.historialChat) || "{}");
      if (!raw || typeof raw !== "object") return { usuarios: {} };
      if (!raw.usuarios || typeof raw.usuarios !== "object") return { usuarios: {} };
      return raw;
    } catch {
      return { usuarios: {} };
    }
  }

  function guardarAlmacenHistorial(almacen) {
    localStorage.setItem(CLAVES.historialChat, JSON.stringify(almacen));
  }

  function datosHistorialUsuario(nombre) {
    const almacen = leerAlmacenHistorial();
    const clave = claveUsuarioHistorial(nombre);
    if (!almacen.usuarios[clave]) {
      almacen.usuarios[clave] = { conversaciones: [], activaId: "" };
    }
    const datos = almacen.usuarios[clave];
    if (!Array.isArray(datos.conversaciones)) datos.conversaciones = [];
    if (typeof datos.activaId !== "string") datos.activaId = "";
    if (typeof datos.panelOculto !== "boolean") datos.panelOculto = false;
    datos.conversaciones.forEach(function (conversacion) {
      if (conversacion && typeof conversacion.fijada !== "boolean") {
        conversacion.fijada = false;
      }
    });
    const cantidadAntes = datos.conversaciones.length;
    const activaAntes = datos.activaId;
    datos.conversaciones = datos.conversaciones.filter(function (conversacion) {
      return conversacionTieneMensajeUsuario(conversacion);
    });
    if (datos.activaId && !buscarConversacion(datos, datos.activaId)) {
      datos.activaId = "";
    }
    if (datos.conversaciones.length !== cantidadAntes || datos.activaId !== activaAntes) {
      persistirDatosUsuario(almacen, clave, datos);
    }
    return { almacen: almacen, clave: clave, datos: datos };
  }

  function persistirDatosUsuario(almacen, clave, datos) {
    almacen.usuarios[clave] = datos;
    guardarAlmacenHistorial(almacen);
  }

  function mensajePersistible(autor) {
    return autor === "usuario" || autor === "ia";
  }

  function tituloDesdeConversacion(conversacion) {
    if (!conversacion || !Array.isArray(conversacion.mensajes)) {
      return "Conversación";
    }
    const primeroUsuario = conversacion.mensajes.find(function (m) {
      return m && m.autor === "usuario" && typeof m.texto === "string" && m.texto.trim();
    });
    if (primeroUsuario) {
      const texto = primeroUsuario.texto.trim();
      return texto.length > 56 ? texto.slice(0, 53) + "…" : texto;
    }
    const fecha = conversacion.creado ? new Date(conversacion.creado) : new Date();
    if (Number.isNaN(fecha.getTime())) return "Conversación";
    return "Conversación del " + fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }

  function conversacionFijada(conversacion) {
    return Boolean(conversacion && conversacion.fijada === true);
  }

  function ordenarConversaciones(conversaciones) {
    return conversaciones.slice().sort(function (a, b) {
      const fa = conversacionFijada(a) ? 1 : 0;
      const fb = conversacionFijada(b) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const ta = Date.parse(a.actualizado || a.creado || 0);
      const tb = Date.parse(b.actualizado || b.creado || 0);
      return tb - ta;
    });
  }

  function recortarConversaciones(conversaciones) {
    while (conversaciones.length > MAX_CONVERSACIONES_USUARIO) {
      let indiceEliminar = -1;
      let fechaMasAntigua = Infinity;
      for (let i = 0; i < conversaciones.length; i += 1) {
        if (conversacionFijada(conversaciones[i])) continue;
        const t = Date.parse(conversaciones[i].actualizado || conversaciones[i].creado || 0);
        if (!Number.isFinite(t)) {
          indiceEliminar = i;
          break;
        }
        if (t <= fechaMasAntigua) {
          fechaMasAntigua = t;
          indiceEliminar = i;
        }
      }
      if (indiceEliminar === -1) break;
      conversaciones.splice(indiceEliminar, 1);
    }
  }

  function crearConversacionVacia() {
    const ahora = new Date().toISOString();
    return {
      id: nuevoIdConversacion(),
      titulo: "Conversación",
      creado: ahora,
      actualizado: ahora,
      fijada: false,
      mensajes: [],
    };
  }

  function iniciarBorradorEnMemoria() {
    const conversacion = crearConversacionVacia();
    estado.conversacionActivaId = conversacion.id;
    return conversacion;
  }

  function chatEnPantallaVacio() {
    const lista = document.getElementById("lista-mensajes");
    return !lista || lista.childElementCount === 0;
  }

  function buscarConversacion(datos, id) {
    return datos.conversaciones.find(function (c) {
      return c && c.id === id;
    }) || null;
  }

  function asegurarConversacionActiva(sesion) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    let conversacion = estado.conversacionActivaId
      ? buscarConversacion(bloque.datos, estado.conversacionActivaId)
      : null;
    if (!conversacion && bloque.datos.activaId) {
      conversacion = buscarConversacion(bloque.datos, bloque.datos.activaId);
    }
    if (conversacion && conversacionTieneMensajeUsuario(conversacion)) {
      estado.conversacionActivaId = conversacion.id;
      bloque.datos.activaId = conversacion.id;
      persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
      return conversacion;
    }
    if (bloque.datos.activaId) {
      bloque.datos.activaId = "";
      persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    }
    return iniciarBorradorEnMemoria();
  }

  function prepararConversacionTrasLogin(sesion) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    if (bloque.datos.activaId) {
      bloque.datos.activaId = "";
      persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    }
    return iniciarBorradorEnMemoria();
  }

  function guardarMensajeEnConversacion(sesion, conversacionId, mensaje) {
    if (!sesion || !mensajePersistible(mensaje.autor) || !conversacionId) return;
    const bloque = datosHistorialUsuario(sesion.nombre);
    let conversacion = buscarConversacion(bloque.datos, conversacionId);
    if (!conversacion) {
      if (mensaje.autor !== "usuario") return;
      conversacion = crearConversacionVacia();
      conversacion.id = conversacionId;
      bloque.datos.conversaciones.unshift(conversacion);
    }
    const entrada = {
      autor: mensaje.autor,
      texto: mensaje.texto,
    };
    if (mensaje.fuente) entrada.fuente = mensaje.fuente;
    conversacion.mensajes.push(entrada);
    if (conversacion.mensajes.length > MAX_MENSAJES_CONVERSACION) {
      conversacion.mensajes = conversacion.mensajes.slice(-MAX_MENSAJES_CONVERSACION);
    }
    conversacion.actualizado = new Date().toISOString();
    conversacion.titulo = tituloDesdeConversacion(conversacion);
    if (estado.conversacionActivaId === conversacion.id) {
      bloque.datos.activaId = conversacion.id;
    }
    recortarConversaciones(bloque.datos.conversaciones);
    persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    renderHistorial(sesion);
  }

  function formatearFechaHistorial(iso) {
    const fecha = new Date(iso || "");
    if (Number.isNaN(fecha.getTime())) return "";
    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function contarMensajesVisibles(conversacion) {
    if (!conversacion || !Array.isArray(conversacion.mensajes)) return 0;
    return conversacion.mensajes.filter(function (m) {
      return m && mensajePersistible(m.autor);
    }).length;
  }

  function actualizarControlesPanelHistorial(oculto) {
    const layout = document.getElementById("layout-principal");
    const panel = document.getElementById("panel-historial");
    const btnMostrar = document.getElementById("btn-mostrar-historial");
    const btnOcultar = document.getElementById("btn-ocultar-historial");
    if (layout) layout.classList.toggle("historial-oculto", oculto);
    if (panel) {
      if (oculto) panel.setAttribute("inert", "");
      else panel.removeAttribute("inert");
    }
    if (btnOcultar) btnOcultar.hidden = oculto;
    if (btnMostrar) {
      btnMostrar.hidden = !oculto;
      btnMostrar.setAttribute("aria-expanded", oculto ? "false" : "true");
    }
  }

  function aplicarVisibilidadHistorial(sesion) {
    if (!sesion) return;
    const bloque = datosHistorialUsuario(sesion.nombre);
    actualizarControlesPanelHistorial(bloque.datos.panelOculto === true);
  }

  function alternarPanelHistorial() {
    const sesion = leerSesion();
    if (!sesion) return;
    const bloque = datosHistorialUsuario(sesion.nombre);
    bloque.datos.panelOculto = !(bloque.datos.panelOculto === true);
    persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    actualizarControlesPanelHistorial(bloque.datos.panelOculto);
  }

  function alternarFijarConversacion(sesion, id) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    const conversacion = buscarConversacion(bloque.datos, id);
    if (!conversacion) return;
    conversacion.fijada = !conversacionFijada(conversacion);
    persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    renderHistorial(sesion);
  }

  function eliminarConversacion(sesion, id) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    const conversacion = buscarConversacion(bloque.datos, id);
    if (!conversacion) return;

    const indice = bloque.datos.conversaciones.findIndex(function (c) {
      return c && c.id === id;
    });
    if (indice === -1) return;

    const eraActiva = estado.conversacionActivaId === id;
    delete estado.peticionesPendientes[id];
    bloque.datos.conversaciones.splice(indice, 1);

    if (eraActiva) {
      if (bloque.datos.conversaciones.length) {
        const siguiente = ordenarConversaciones(bloque.datos.conversaciones)[0];
        estado.conversacionActivaId = siguiente.id;
        bloque.datos.activaId = siguiente.id;
        pintarHiloEnPantalla(siguiente);
      } else {
        bloque.datos.activaId = "";
        const nueva = iniciarBorradorEnMemoria();
        pintarHiloEnPantalla(nueva);
      }
      document.getElementById("chat-texto").focus();
    } else if (bloque.datos.activaId === id) {
      bloque.datos.activaId = estado.conversacionActivaId || "";
    }

    persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    renderHistorial(sesion);
    mostrarToastApp("El chat ha sido eliminado exitosamente");
  }

  function renderHistorial(sesion) {
    const lista = document.getElementById("lista-historial");
    const vacio = document.getElementById("historial-vacio");
    if (!lista || !vacio || !sesion) return;

    const bloque = datosHistorialUsuario(sesion.nombre);
    const conversaciones = ordenarConversaciones(bloque.datos.conversaciones);

    lista.replaceChildren();
    conversaciones.forEach(function (conversacion) {
      const fijada = conversacionFijada(conversacion);
      const activa = conversacion.id === estado.conversacionActivaId;
      const item = document.createElement("li");
      item.className = "item-historial" + (fijada ? " fijada" : "") + (activa ? " activa" : "");

      const botonFijar = document.createElement("button");
      botonFijar.type = "button";
      botonFijar.className = "btn-fijar-conversacion" + (fijada ? " fijada" : "");
      botonFijar.setAttribute(
        "aria-label",
        fijada ? "Quitar conversación de fijadas" : "Fijar conversación arriba del historial"
      );
      botonFijar.title = fijada ? "Quitar fijado" : "Fijar";
      const iconoFijar = document.createElement("i");
      iconoFijar.className = fijada ? "fa-solid fa-star" : "fa-regular fa-star";
      iconoFijar.setAttribute("aria-hidden", "true");
      botonFijar.appendChild(iconoFijar);
      botonFijar.addEventListener("click", function (event) {
        event.stopPropagation();
        alternarFijarConversacion(sesion, conversacion.id);
      });

      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn-historial-item";
      boton.dataset.conversacionId = conversacion.id;

      const cabecera = document.createElement("div");
      cabecera.className = "historial-item-cabecera";

      const titulo = document.createElement("span");
      titulo.className = "historial-item-titulo";
      const textoTitulo = conversacion.titulo || tituloDesdeConversacion(conversacion);
      titulo.textContent = textoTitulo;
      titulo.title = textoTitulo;

      cabecera.appendChild(titulo);
      if (fijada) {
        const etiqueta = document.createElement("span");
        etiqueta.className = "historial-item-etiqueta-fijada";
        etiqueta.textContent = "Fijada";
        cabecera.appendChild(etiqueta);
      }

      const meta = document.createElement("span");
      meta.className = "historial-item-meta";
      meta.textContent =
        formatearFechaHistorial(conversacion.actualizado || conversacion.creado) +
        " · " +
        contarMensajesVisibles(conversacion) +
        " mensajes";

      boton.appendChild(cabecera);
      boton.appendChild(meta);
      boton.addEventListener("click", function () {
        activarConversacion(sesion, conversacion.id);
      });

      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.className = "btn-eliminar-conversacion";
      botonEliminar.setAttribute("aria-label", "Eliminar conversación del historial");
      botonEliminar.title = "Eliminar";
      const iconoEliminar = document.createElement("i");
      iconoEliminar.className = "fa-solid fa-trash-can";
      iconoEliminar.setAttribute("aria-hidden", "true");
      botonEliminar.appendChild(iconoEliminar);
      botonEliminar.addEventListener("click", function (event) {
        event.stopPropagation();
        eliminarConversacion(sesion, conversacion.id);
      });

      item.appendChild(botonFijar);
      item.appendChild(boton);
      item.appendChild(botonEliminar);
      lista.appendChild(item);
    });

    vacio.hidden = conversaciones.length > 0;
  }

  function pintarMensajesDesdeHistorial(mensajes) {
    const lista = document.getElementById("lista-mensajes");
    lista.replaceChildren();
    (mensajes || []).forEach(function (m) {
      if (!m || typeof m.texto !== "string") return;
      agregarMensaje({ autor: m.autor, texto: m.texto, fuente: m.fuente }, { persistir: false });
    });
    lista.scrollTop = lista.scrollHeight;
  }

  function conversacionVisible(id) {
    return Boolean(id) && id === estado.conversacionActivaId;
  }

  function pintarIndicadorEscribiendo() {
    return agregarMensaje(
      { autor: "nota", texto: "El asistente está escribiendo…" },
      { persistir: false, pendiente: true }
    );
  }

  function quitarIndicadorEscribiendo() {
    const lista = document.getElementById("lista-mensajes");
    if (!lista) return;
    lista.querySelectorAll("[data-pendiente-asistente]").forEach(function (nodo) {
      nodo.remove();
    });
  }

  function pintarHiloEnPantalla(conversacion) {
    pintarMensajesDesdeHistorial(conversacion && conversacion.mensajes);
    if (conversacion && estado.peticionesPendientes[conversacion.id]) {
      pintarIndicadorEscribiendo();
    }
  }

  function activarConversacion(sesion, id) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    const conversacion = buscarConversacion(bloque.datos, id);
    if (!conversacion) return;
    estado.conversacionActivaId = id;
    bloque.datos.activaId = id;
    persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    pintarHiloEnPantalla(conversacion);
    renderHistorial(sesion);
    document.getElementById("chat-texto").focus();
  }

  function conversacionTieneMensajeUsuario(conversacion) {
    if (!conversacion || !Array.isArray(conversacion.mensajes)) return false;
    return conversacion.mensajes.some(function (m) {
      return m && m.autor === "usuario" && typeof m.texto === "string" && m.texto.trim();
    });
  }

  function enfocarNuevaConversacion() {
    document.getElementById("chat-error").textContent = "";
    document.getElementById("chat-texto").focus();
  }

  function nuevaConversacion(sesion) {
    const bloque = datosHistorialUsuario(sesion.nombre);
    const activaGuardada = buscarConversacion(bloque.datos, estado.conversacionActivaId);
    if (!activaGuardada && chatEnPantallaVacio()) {
      renderHistorial(sesion);
      enfocarNuevaConversacion();
      return;
    }
    if (bloque.datos.activaId) {
      bloque.datos.activaId = "";
      persistirDatosUsuario(bloque.almacen, bloque.clave, bloque.datos);
    }
    const conversacion = iniciarBorradorEnMemoria();
    pintarHiloEnPantalla(conversacion);
    renderHistorial(sesion);
    enfocarNuevaConversacion();
  }

  function conteosFuentes() {
    return {
      [CLAVES.facturas]: leerLista(CLAVES.facturas).length,
      [CLAVES.pedidos]: leerLista(CLAVES.pedidos).length,
      [CLAVES.ventas]: leerLista(CLAVES.ventas).length,
      [CLAVES.quejas]: leerLista(CLAVES.quejas).length,
      [CLAVES.usuarios]: leerUsuarios().length,
    };
  }

  function contieneDatosSensibles(texto) {
    if (/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i.test(texto)) return true;
    if (/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i.test(texto)) return true;
    const digitos = texto.replace(/\D/g, "");
    if (/(?:\d[ -]?){13,19}/.test(texto) && digitos.length >= 13 && digitos.length <= 19) return true;
    if (/(?:contraseña|password|clave)\s*(?:es|:)\s*\S{4,}/i.test(texto)) return true;
    return false;
  }

  function quitarEntradaLoginRefresh() {
    document.getElementById("pantalla-login").classList.remove("login-entrada-refresh");
  }

  function configurarFinEntradaLoginRefresh() {
    const pantalla = document.getElementById("pantalla-login");
    const contenedor = pantalla.querySelector(".login-contenedor");
    if (!contenedor) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      quitarEntradaLoginRefresh();
      return;
    }

    contenedor.addEventListener(
      "animationend",
      function (evento) {
        if (evento.animationName !== "login-contenedor-entrada") return;
        quitarEntradaLoginRefresh();
      },
      { once: true }
    );

    setTimeout(function () {
      if (pantalla.classList.contains("login-entrada-refresh")) quitarEntradaLoginRefresh();
    }, 800);
  }

  function mostrarPantalla(nombre) {
    document.getElementById("pantalla-login").hidden = nombre !== "login";
    document.getElementById("pantalla-principal").hidden = nombre !== "principal";
    document.title = nombre === "principal" ? "Esmeralda — asistente" : "Esmeralda — acceso";
  }

  function llenarRoles(select) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige un rol";
    select.replaceChildren(placeholder);
    ROLES.forEach(function (rol) {
      const opcion = document.createElement("option");
      opcion.value = rol;
      opcion.textContent = NOMBRE_ROL[rol];
      select.appendChild(opcion);
    });
  }

  const TITULOS_LOGIN = {
    entrar: "Acceso al asistente",
    registrar: "Registrar usuario",
    restablecer: "Restablecer contraseña",
  };

  function ocultarToastLogin() {
    const toast = document.getElementById("login-toast");
    if (estado.toastLoginTimer) {
      clearTimeout(estado.toastLoginTimer);
      estado.toastLoginTimer = null;
    }
    toast.hidden = true;
    toast.textContent = "";
  }

  function mostrarToastLogin(mensaje) {
    const toast = document.getElementById("login-toast");
    toast.textContent = mensaje;
    toast.hidden = false;
    if (estado.toastLoginTimer) clearTimeout(estado.toastLoginTimer);
    estado.toastLoginTimer = setTimeout(ocultarToastLogin, 6000);
  }

  function ocultarToastApp() {
    const toast = document.getElementById("app-toast");
    if (!toast) return;
    if (estado.toastAppTimer) {
      clearTimeout(estado.toastAppTimer);
      estado.toastAppTimer = null;
    }
    toast.hidden = true;
    toast.textContent = "";
  }

  function mostrarToastApp(mensaje) {
    const toast = document.getElementById("app-toast");
    if (!toast) return;
    toast.textContent = mensaje;
    toast.hidden = false;
    if (estado.toastAppTimer) clearTimeout(estado.toastAppTimer);
    estado.toastAppTimer = setTimeout(ocultarToastApp, 6000);
  }

  function cerrarModalAutorizacionRegistro() {
    const modal = document.getElementById("modal-autorizacion-registro");
    modal.hidden = true;
    document.getElementById("modal-autorizacion-clave").value = "";
    document.getElementById("modal-autorizacion-error").textContent = "";
  }

  function abrirModalAutorizacionRegistro() {
    cerrarModalAutorizacionRegistro();
    document.getElementById("modal-autorizacion-registro").hidden = false;
    document.getElementById("modal-autorizacion-clave").focus();
  }

  function mostrarVistaLogin(vista) {
    if (vista !== "entrar") ocultarToastLogin();
    if (vista !== "registrar") estado.registroAutorizado = false;
    if (vista === "registrar" && !estado.registroAutorizado) {
      vista = "entrar";
    }
    const esEntrar = vista === "entrar";
    document.getElementById("form-entrar").hidden = !esEntrar;
    document.getElementById("login-enlaces-entrar").hidden = !esEntrar;
    document.getElementById("form-registrar").hidden = vista !== "registrar";
    document.getElementById("form-restablecer").hidden = vista !== "restablecer";
    document.getElementById("login-enlace-volver").hidden = esEntrar;
    document.getElementById("login-titulo").textContent = TITULOS_LOGIN[vista] || TITULOS_LOGIN.entrar;
    document.getElementById("entrar-error").textContent = "";
    document.getElementById("registrar-error").textContent = "";
    document.getElementById("restablecer-error").textContent = "";
    estado.vistaLogin = vista;
  }

  function prefiereMenosMovimiento() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clasesAnimacionLogin() {
    return [
      "login-vistas-salir-adelante",
      "login-vistas-entrar-adelante",
      "login-vistas-salir-atras",
      "login-vistas-entrar-atras",
    ];
  }

  function quitarAnimacionLogin(vistas) {
    if (!vistas) return;
    clasesAnimacionLogin().forEach(function (clase) {
      vistas.classList.remove(clase);
    });
  }

  function transicionarVistaLogin(vista, despues) {
    const vistas = document.getElementById("login-vistas");
    const actual = estado.vistaLogin || "entrar";
    if (vista === "registrar" && !estado.registroAutorizado) {
      vista = "entrar";
    }
    if (actual === vista) {
      mostrarVistaLogin(vista);
      if (despues) despues();
      return;
    }
    if (!vistas || prefiereMenosMovimiento()) {
      mostrarVistaLogin(vista);
      if (despues) despues();
      return;
    }
    if (estado.transicionLogin) return;

    estado.transicionLogin = true;
    let fase = "salir";
    const adelante = vista !== "entrar";
    const claseSalir = adelante ? "login-vistas-salir-adelante" : "login-vistas-salir-atras";
    const claseEntrar = adelante ? "login-vistas-entrar-adelante" : "login-vistas-entrar-atras";

    function terminarEntrada() {
      if (fase !== "entrar") return;
      fase = "listo";
      if (estado.transicionLoginTimer) {
        clearTimeout(estado.transicionLoginTimer);
        estado.transicionLoginTimer = null;
      }
      vistas.removeEventListener("animationend", alEntrar);
      quitarAnimacionLogin(vistas);
      estado.transicionLogin = false;
      if (despues) despues();
    }

    function alEntrar(event) {
      if (event.target !== vistas) return;
      terminarEntrada();
    }

    function iniciarEntrada() {
      if (fase !== "salir") return;
      fase = "entrar";
      if (estado.transicionLoginTimer) {
        clearTimeout(estado.transicionLoginTimer);
        estado.transicionLoginTimer = null;
      }
      vistas.removeEventListener("animationend", alSalir);
      mostrarVistaLogin(vista);
      quitarAnimacionLogin(vistas);
      void vistas.offsetWidth;
      vistas.classList.add(claseEntrar);
      vistas.addEventListener("animationend", alEntrar);
      estado.transicionLoginTimer = setTimeout(terminarEntrada, 420);
    }

    function alSalir(event) {
      if (event.target !== vistas) return;
      iniciarEntrada();
    }

    quitarAnimacionLogin(vistas);
    void vistas.offsetWidth;
    vistas.classList.add(claseSalir);
    vistas.addEventListener("animationend", alSalir);
    estado.transicionLoginTimer = setTimeout(iniciarEntrada, 300);
  }

  function limpiarClaves() {
    document.getElementById("entrar-clave").value = "";
    document.getElementById("registrar-clave").value = "";
    document.getElementById("restablecer-clave").value = "";
  }

  function leerEstadisticas() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVES.estadisticas) || "{}");
      const sesiones = Array.isArray(datos.sesiones) ? datos.sesiones.filter(sesionUsoValida) : [];
      return { sesiones: sesiones };
    } catch {
      return { sesiones: [] };
    }
  }

  function sesionUsoValida(sesion) {
    return !!(
      sesion &&
      typeof sesion.id === "string" &&
      typeof sesion.nombre === "string" &&
      ROLES.indexOf(sesion.rol) !== -1 &&
      typeof sesion.inicio === "string"
    );
  }

  function guardarEstadisticas(datos) {
    const sesiones = (datos.sesiones || []).slice(-MAX_SESIONES_USO);
    localStorage.setItem(CLAVES.estadisticas, JSON.stringify({ sesiones: sesiones }));
  }

  function buscarSesionUso(datos, id) {
    return datos.sesiones.find(function (sesion) {
      return sesion.id === id;
    }) || null;
  }

  function fechaLocalISO(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function inicioDiaLocalMs(yyyyMmDd) {
    const partes = String(yyyyMmDd || "").split("-").map(Number);
    if (partes.length !== 3 || partes.some(function (n) { return !Number.isFinite(n); })) return NaN;
    return new Date(partes[0], partes[1] - 1, partes[2], 0, 0, 0, 0).getTime();
  }

  function finDiaLocalMs(yyyyMmDd) {
    const partes = String(yyyyMmDd || "").split("-").map(Number);
    if (partes.length !== 3 || partes.some(function (n) { return !Number.isFinite(n); })) return NaN;
    return new Date(partes[0], partes[1] - 1, partes[2], 23, 59, 59, 999).getTime();
  }

  function rangoPorPresetEstadisticas(preset, referencia) {
    const base = referencia || new Date();
    const hoy = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    if (preset === "hoy") {
      const iso = fechaLocalISO(hoy);
      return { desde: iso, hasta: iso };
    }
    if (preset === "7" || preset === "28") {
      const dias = preset === "7" ? 6 : 27;
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - dias);
      return { desde: fechaLocalISO(desde), hasta: fechaLocalISO(hoy) };
    }
    return null;
  }

  function asegurarFiltroEstadisticas() {
    const filtro = estado.estadisticasFiltro || { preset: "7", desde: "", hasta: "" };
    if (!filtro.desde || !filtro.hasta) {
      const rango = rangoPorPresetEstadisticas(filtro.preset === "personalizado" ? "7" : filtro.preset) || rangoPorPresetEstadisticas("7");
      filtro.preset = filtro.preset === "personalizado" ? "7" : (filtro.preset || "7");
      filtro.desde = rango.desde;
      filtro.hasta = rango.hasta;
    }
    estado.estadisticasFiltro = filtro;
    return filtro;
  }

  function limitesFiltroEstadisticas() {
    const filtro = asegurarFiltroEstadisticas();
    let desde = filtro.desde;
    let hasta = filtro.hasta;
    if (desde && hasta && desde > hasta) {
      const tmp = desde;
      desde = hasta;
      hasta = tmp;
    }
    const inicioMs = inicioDiaLocalMs(desde);
    const finMs = finDiaLocalMs(hasta);
    if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)) return null;
    return { preset: filtro.preset, desde: desde, hasta: hasta, inicioMs: inicioMs, finMs: finMs };
  }

  function aplicarPresetEstadisticas(preset, opciones) {
    const opts = opciones || {};
    const filtro = asegurarFiltroEstadisticas();
    if (preset !== "personalizado") {
      const rango = rangoPorPresetEstadisticas(preset);
      if (!rango) return;
      filtro.preset = preset;
      filtro.desde = rango.desde;
      filtro.hasta = rango.hasta;
    } else {
      filtro.preset = "personalizado";
    }
    estado.estadisticasFiltro = filtro;
    sincronizarUiFiltroEstadisticas();
    if (!opts.silencioso) renderEstadisticas();
  }

  function aplicarRangoPersonalizadoEstadisticas() {
    if (estado.estadisticasFiltroSilencio) return;
    const desdeInput = document.getElementById("estadisticas-desde");
    const hastaInput = document.getElementById("estadisticas-hasta");
    if (!desdeInput || !hastaInput) return;
    let desde = desdeInput.value;
    let hasta = hastaInput.value;
    if (!desde || !hasta) return;
    if (desde > hasta) {
      const tmp = desde;
      desde = hasta;
      hasta = tmp;
      desdeInput.value = desde;
      hastaInput.value = hasta;
    }
    estado.estadisticasFiltro = { preset: "personalizado", desde: desde, hasta: hasta };
    sincronizarUiFiltroEstadisticas();
    renderEstadisticas();
  }

  function sincronizarUiFiltroEstadisticas() {
    const filtro = asegurarFiltroEstadisticas();
    const desdeInput = document.getElementById("estadisticas-desde");
    const hastaInput = document.getElementById("estadisticas-hasta");
    const hoyIso = fechaLocalISO(new Date());
    estado.estadisticasFiltroSilencio = true;
    if (desdeInput) {
      desdeInput.value = filtro.desde;
      desdeInput.max = hoyIso;
    }
    if (hastaInput) {
      hastaInput.value = filtro.hasta;
      hastaInput.max = hoyIso;
    }
    estado.estadisticasFiltroSilencio = false;
    document.querySelectorAll(".estadisticas-filtro-presets [data-preset]").forEach(function (boton) {
      const activo = boton.getAttribute("data-preset") === filtro.preset;
      boton.classList.toggle("filtro-preset-activo", activo);
      boton.setAttribute("aria-pressed", activo ? "true" : "false");
    });
  }

  function configurarFiltroEstadisticas() {
    const presets = document.querySelector(".estadisticas-filtro-presets");
    if (presets) {
      presets.addEventListener("click", function (evento) {
        const boton = evento.target.closest("[data-preset]");
        if (!boton) return;
        aplicarPresetEstadisticas(boton.getAttribute("data-preset"));
      });
    }
    ["estadisticas-desde", "estadisticas-hasta"].forEach(function (id) {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("change", aplicarRangoPersonalizadoEstadisticas);
      input.addEventListener("input", aplicarRangoPersonalizadoEstadisticas);
    });
  }

  function intervaloSesionUso(sesion, ahora) {
    const inicio = Date.parse(sesion.inicio);
    if (!Number.isFinite(inicio)) return null;
    const finIso = sesion.fin || sesion.ultimoLatido;
    const finParse = finIso ? Date.parse(finIso) : ahora;
    const fin = Number.isFinite(finParse) ? finParse : ahora;
    return { inicio: inicio, fin: Math.max(inicio, fin) };
  }

  function sesionEnRangoEstadisticas(sesion, rango, ahora) {
    const intervalo = intervaloSesionUso(sesion, ahora);
    if (!intervalo || !rango) return false;
    return intervalo.inicio <= rango.finMs && intervalo.fin >= rango.inicioMs;
  }

  function duracionSesionUsoMs(sesion, ahora, rango) {
    const intervalo = intervaloSesionUso(sesion, ahora);
    if (!intervalo) return 0;
    if (!rango) return Math.max(0, intervalo.fin - intervalo.inicio);
    const a = Math.max(intervalo.inicio, rango.inicioMs);
    const b = Math.min(intervalo.fin, rango.finMs);
    return Math.max(0, b - a);
  }

  function sesionUsoActiva(sesion, ahora) {
    if (sesion.fin) return false;
    const latido = Date.parse(sesion.ultimoLatido || sesion.inicio);
    if (!Number.isFinite(latido)) return false;
    return ahora - latido <= SESION_ACTIVA_MS;
  }

  function iniciarSesionUso(sesion) {
    if (!sesion) return;
    detenerLatidoEstadisticas();
    const datos = leerEstadisticas();
    const ahora = Date.now();
    const existenteId = sessionStorage.getItem(CLAVES.sesionUsoId) || estado.sesionUsoId;
    let actual = existenteId ? buscarSesionUso(datos, existenteId) : null;
    if (!(actual && actual.nombre === sesion.nombre && !actual.fin)) {
      actual = datos.sesiones.find(function (item) {
        return item.nombre === sesion.nombre && !item.fin && sesionUsoActiva(item, ahora);
      }) || null;
    }
    if (actual) {
      actual.ultimoLatido = new Date(ahora).toISOString();
      actual.rol = sesion.rol;
    } else {
      datos.sesiones.forEach(function (item) {
        if (item.nombre === sesion.nombre && !item.fin) {
          item.fin = item.ultimoLatido || new Date(ahora).toISOString();
        }
      });
      actual = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(ahora) + "-" + Math.random().toString(16).slice(2),
        nombre: sesion.nombre,
        rol: sesion.rol,
        inicio: sesion.inicio || new Date(ahora).toISOString(),
        fin: "",
        ultimoLatido: new Date(ahora).toISOString(),
        prompts: 0,
        tiemposRespuestaMs: [],
      };
      datos.sesiones.push(actual);
    }
    estado.sesionUsoId = actual.id;
    sessionStorage.setItem(CLAVES.sesionUsoId, actual.id);
    guardarEstadisticas(datos);
    iniciarLatidoEstadisticas();
  }

  function actualizarSesionUso(mutador) {
    const id = estado.sesionUsoId || sessionStorage.getItem(CLAVES.sesionUsoId) || "";
    if (!id) return;
    const datos = leerEstadisticas();
    const actual = buscarSesionUso(datos, id);
    if (!actual || actual.fin) return;
    mutador(actual);
    actual.ultimoLatido = new Date().toISOString();
    guardarEstadisticas(datos);
  }

  function registrarPromptUso() {
    actualizarSesionUso(function (sesion) {
      sesion.prompts = (Number(sesion.prompts) || 0) + 1;
    });
  }

  function registrarTiempoRespuestaUso(duracionMs) {
    const ms = Number(duracionMs);
    if (!Number.isFinite(ms) || ms < 0 || ms > 600000) return;
    actualizarSesionUso(function (sesion) {
      if (!Array.isArray(sesion.tiemposRespuestaMs)) sesion.tiemposRespuestaMs = [];
      sesion.tiemposRespuestaMs.push(Math.round(ms));
      if (sesion.tiemposRespuestaMs.length > 400) {
        sesion.tiemposRespuestaMs = sesion.tiemposRespuestaMs.slice(-400);
      }
    });
  }

  function cerrarSesionUso() {
    detenerLatidoEstadisticas();
    const id = estado.sesionUsoId || sessionStorage.getItem(CLAVES.sesionUsoId) || "";
    if (id) {
      const datos = leerEstadisticas();
      const actual = buscarSesionUso(datos, id);
      if (actual && !actual.fin) {
        actual.fin = new Date().toISOString();
        actual.ultimoLatido = actual.fin;
        guardarEstadisticas(datos);
      }
    }
    estado.sesionUsoId = "";
    sessionStorage.removeItem(CLAVES.sesionUsoId);
  }

  function iniciarLatidoEstadisticas() {
    detenerLatidoEstadisticas();
    estado.estadisticasLatidoTimer = setInterval(function () {
      if (document.getElementById("pantalla-principal").hidden) return;
      actualizarSesionUso(function () {});
    }, LATIDO_ESTADISTICAS_MS);
  }

  function detenerLatidoEstadisticas() {
    if (estado.estadisticasLatidoTimer) {
      clearInterval(estado.estadisticasLatidoTimer);
      estado.estadisticasLatidoTimer = null;
    }
  }

  function promedio(numeros) {
    if (!numeros.length) return 0;
    return numeros.reduce(function (suma, n) { return suma + n; }, 0) / numeros.length;
  }

  function formatearFechaCorta(iso) {
    const fecha = Date.parse(iso);
    if (!Number.isFinite(fecha)) return "—";
    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatearDuracion(ms) {
    const total = Math.max(0, Math.round(Number(ms) || 0));
    const segundos = Math.floor(total / 1000);
    if (segundos < 60) return segundos + " s";
    const minutos = Math.floor(segundos / 60);
    const restoS = segundos % 60;
    if (minutos < 60) return restoS ? minutos + " min " + restoS + " s" : minutos + " min";
    const horas = Math.floor(minutos / 60);
    const restoM = minutos % 60;
    return restoM ? horas + " h " + restoM + " min" : horas + " h";
  }

  function formatearMs(ms) {
    const valor = Math.max(0, Number(ms) || 0);
    if (valor < 1000) return Math.round(valor) + " ms";
    return (valor / 1000).toFixed(1).replace(/\.0$/, "") + " s";
  }

  function agregarNodo(padre, etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    padre.appendChild(nodo);
    return nodo;
  }

  function resumenEstadisticas(sesiones, rango) {
    const ahora = Date.now();
    const tiempos = [];
    const porUsuario = Object.create(null);

    sesiones.forEach(function (sesion) {
      const clave = sesion.nombre.toLowerCase();
      if (!porUsuario[clave]) {
        porUsuario[clave] = {
          nombre: sesion.nombre,
          rol: sesion.rol,
          duraciones: [],
          prompts: 0,
          tiempos: [],
          sesiones: 0,
        };
      }
      const grupo = porUsuario[clave];
      grupo.rol = sesion.rol;
      grupo.sesiones += 1;
      grupo.duraciones.push(duracionSesionUsoMs(sesion, ahora, rango));
      grupo.prompts += Number(sesion.prompts) || 0;
      (sesion.tiemposRespuestaMs || []).forEach(function (ms) {
        const n = Number(ms);
        if (Number.isFinite(n) && n >= 0) {
          grupo.tiempos.push(n);
          tiempos.push(n);
        }
      });
    });

    const grupos = Object.keys(porUsuario).map(function (clave) {
      return porUsuario[clave];
    });
    const duraciones = grupos.reduce(function (lista, grupo) {
      return lista.concat(grupo.duraciones);
    }, []);
    const prompts = grupos.map(function (grupo) { return grupo.prompts; });

    return {
      ahora: ahora,
      grupos: grupos.sort(function (a, b) {
        return a.nombre.localeCompare(b.nombre, "es");
      }),
      conectadas: sesiones.filter(function (sesion) {
        return sesionUsoActiva(sesion, ahora);
      }),
      tiempoPromedioMs: promedio(duraciones),
      promptsPromedio: promedio(prompts),
      tiempos: tiempos,
      tiempoRespuestaMin: tiempos.length ? Math.min.apply(null, tiempos) : 0,
      tiempoRespuestaMax: tiempos.length ? Math.max.apply(null, tiempos) : 0,
      tiempoRespuestaPromedio: promedio(tiempos),
    };
  }

  function pintarKpi(fila, etiqueta, valor) {
    const tarjeta = agregarNodo(fila, "article", "estadisticas-kpi");
    agregarNodo(tarjeta, "p", "kpi-etiqueta", etiqueta);
    agregarNodo(tarjeta, "p", "kpi-valor", valor);
  }

  function pintarBarras(contenedor, items, claseBarra) {
    const grafica = agregarNodo(contenedor, "div", "grafica-barras");
    const maximo = Math.max.apply(null, items.map(function (item) { return item.valor; }).concat([0]));
    items.forEach(function (item) {
      const fila = agregarNodo(grafica, "div", "grafica-barra-fila");
      agregarNodo(fila, "span", "grafica-barra-nombre", item.etiqueta).title = item.etiqueta;
      const pista = agregarNodo(fila, "div", "grafica-barra-pista");
      const lleno = agregarNodo(pista, "div", "grafica-barra-lleno" + (claseBarra ? " " + claseBarra : ""));
      const pct = maximo > 0 ? Math.max(4, Math.round((item.valor / maximo) * 100)) : 0;
      lleno.style.width = item.valor > 0 ? pct + "%" : "0";
      agregarNodo(fila, "span", "grafica-barra-valor", item.texto);
    });
    return grafica;
  }

  function pintarPastel(contenedor, items) {
    const bloque = agregarNodo(contenedor, "div", "grafica-pastel-bloque");
    const pastel = agregarNodo(bloque, "div", "grafica-pastel");
    const leyenda = agregarNodo(bloque, "ul", "grafica-pastel-leyenda");
    const total = items.reduce(function (suma, item) { return suma + item.valor; }, 0);
    if (total <= 0) {
      pastel.style.background = "#e8eeec";
      agregarNodo(leyenda, "li", "", "Aún no hay prompts para graficar.");
      return;
    }
    let acumulado = 0;
    const tramos = [];
    items.forEach(function (item, indice) {
      const color = COLORES_PASTEL[indice % COLORES_PASTEL.length];
      const inicio = (acumulado / total) * 100;
      acumulado += item.valor;
      const fin = (acumulado / total) * 100;
      tramos.push(color + " " + inicio + "% " + fin + "%");
      const li = agregarNodo(leyenda, "li");
      const punto = agregarNodo(li, "span", "grafica-pastel-punto");
      punto.style.background = color;
      const pct = Math.round((item.valor / total) * 100);
      agregarNodo(li, "span", "", item.etiqueta + " — " + item.texto + " (" + pct + "%)");
    });
    pastel.style.background = "conic-gradient(" + tramos.join(", ") + ")";
  }

  function pintarTablaSesiones(contenedor, sesiones, ahora, rango) {
    const wrap = agregarNodo(contenedor, "div", "estadisticas-tabla-wrap");
    const tabla = agregarNodo(wrap, "table", "estadisticas-tabla");
    const thead = agregarNodo(tabla, "thead");
    const filaHead = agregarNodo(thead, "tr");
    ["Usuario", "Rol", "Conectado", "Tiempo", "Prompts", "Estado"].forEach(function (titulo) {
      agregarNodo(filaHead, "th", "", titulo);
    });
    const tbody = agregarNodo(tabla, "tbody");
    const ordenadas = sesiones.slice().sort(function (a, b) {
      return Date.parse(b.inicio || "") - Date.parse(a.inicio || "");
    });
    if (!ordenadas.length) {
      const fila = agregarNodo(tbody, "tr");
      const celda = agregarNodo(fila, "td", "", "No hay sesiones en el periodo seleccionado.");
      celda.colSpan = 6;
      return;
    }
    ordenadas.forEach(function (sesion) {
      const activa = sesionUsoActiva(sesion, ahora);
      const fila = agregarNodo(tbody, "tr");
      agregarNodo(fila, "td", "", sesion.nombre);
      agregarNodo(fila, "td", "", NOMBRE_ROL[sesion.rol] || sesion.rol);
      agregarNodo(fila, "td", "", formatearFechaCorta(sesion.inicio));
      agregarNodo(fila, "td", "", formatearDuracion(duracionSesionUsoMs(sesion, ahora, rango)));
      agregarNodo(fila, "td", "", String(Number(sesion.prompts) || 0));
      const estadoCelda = agregarNodo(fila, "td");
      const badge = agregarNodo(
        estadoCelda,
        "span",
        "estadisticas-estado " + (activa ? "estadisticas-estado--activo" : "estadisticas-estado--cerrado"),
        activa ? "Conectado" : "Cerrado"
      );
      badge.title = activa ? "Latido reciente" : (sesion.fin ? "Salió a las " + formatearFechaCorta(sesion.fin) : "Sin latido reciente");
    });
  }

  function renderEstadisticas() {
    const cuerpo = document.getElementById("estadisticas-cuerpo");
    if (!cuerpo) return;
    sincronizarUiFiltroEstadisticas();
    cuerpo.replaceChildren();
    const rango = limitesFiltroEstadisticas();
    const ahora = Date.now();
    const sesiones = leerEstadisticas().sesiones.filter(function (sesion) {
      return !rango || sesionEnRangoEstadisticas(sesion, rango, ahora);
    });
    const resumen = resumenEstadisticas(sesiones, rango);

    const kpis = agregarNodo(cuerpo, "div", "estadisticas-resumen");
    pintarKpi(kpis, "Conectados ahora", String(resumen.conectadas.length));
    pintarKpi(kpis, "Tiempo promedio de uso", resumen.grupos.length ? formatearDuracion(resumen.tiempoPromedioMs) : "—");
    pintarKpi(kpis, "Promedio de prompts", resumen.grupos.length ? resumen.promptsPromedio.toFixed(1).replace(/\.0$/, "") : "—");
    pintarKpi(
      kpis,
      "Respuesta promedio del agente",
      resumen.tiempos.length ? formatearMs(resumen.tiempoRespuestaPromedio) : "—"
    );

    const bloqueUsuarios = agregarNodo(cuerpo, "section", "estadisticas-bloque");
    agregarNodo(bloqueUsuarios, "h3", "", "1. Usuarios conectados y sesiones");
    pintarTablaSesiones(bloqueUsuarios, sesiones, resumen.ahora, rango);

    const bloqueTiempo = agregarNodo(cuerpo, "section", "estadisticas-bloque");
    agregarNodo(bloqueTiempo, "h3", "", "2. Tiempo promedio usando el programa");
    if (!resumen.grupos.length) {
      agregarNodo(bloqueTiempo, "p", "estadisticas-vacio", "No hay uso en este periodo. Prueba otro rango o un atajo (Hoy, 7 o 28 días).");
    } else {
      pintarBarras(bloqueTiempo, resumen.grupos.map(function (grupo) {
        const valor = promedio(grupo.duraciones);
        return { etiqueta: grupo.nombre, valor: valor, texto: formatearDuracion(valor) };
      }));
    }

    const bloquePrompts = agregarNodo(cuerpo, "section", "estadisticas-bloque");
    agregarNodo(bloquePrompts, "h3", "", "3. Promedio y reparto de prompts");
    if (!resumen.grupos.length) {
      agregarNodo(bloquePrompts, "p", "estadisticas-vacio", "No hay prompts en el periodo seleccionado.");
    } else {
      agregarNodo(bloquePrompts, "p", "estadisticas-vacio", "Promedio de prompts por usuario: " + resumen.promptsPromedio.toFixed(1).replace(/\.0$/, "") + ".");
      pintarPastel(bloquePrompts, resumen.grupos.map(function (grupo) {
        return { etiqueta: grupo.nombre, valor: grupo.prompts, texto: String(grupo.prompts) };
      }));
    }

    const bloqueRespuesta = agregarNodo(cuerpo, "section", "estadisticas-bloque");
    agregarNodo(bloqueRespuesta, "h3", "", "4. Tiempos de respuesta del agente");
    if (!resumen.tiempos.length) {
      agregarNodo(bloqueRespuesta, "p", "estadisticas-vacio", "No hay tiempos de respuesta del agente en este periodo.");
      return;
    }
    const kpisResp = agregarNodo(bloqueRespuesta, "div", "estadisticas-resumen");
    pintarKpi(kpisResp, "Más corto", formatearMs(resumen.tiempoRespuestaMin));
    pintarKpi(kpisResp, "Más largo", formatearMs(resumen.tiempoRespuestaMax));
    pintarKpi(kpisResp, "Promedio general", formatearMs(resumen.tiempoRespuestaPromedio));
    pintarBarras(
      bloqueRespuesta,
      resumen.grupos
        .filter(function (grupo) { return grupo.tiempos.length; })
        .map(function (grupo) {
          const valor = promedio(grupo.tiempos);
          return { etiqueta: grupo.nombre, valor: valor, texto: formatearMs(valor) };
        }),
      "grafica-barra-lleno--arena"
    );
  }

  function esSuperUsuario(sesion) {
    return !!(sesion && sesion.rol === "super");
  }

  function actualizarBotonEstadisticas(sesion) {
    const boton = document.getElementById("btn-estadisticas");
    if (!boton) return;
    if (!esSuperUsuario(sesion) || document.getElementById("pantalla-principal").hidden) {
      boton.hidden = true;
      return;
    }
    boton.hidden = false;
  }

  function cerrarPanelEstadisticas() {
    const panel = document.getElementById("panel-estadisticas");
    if (panel) panel.hidden = true;
  }

  function abrirPanelEstadisticas() {
    const sesion = leerSesion();
    if (!esSuperUsuario(sesion) || !leerInstanciaServidor()) {
      actualizarBotonEstadisticas(null);
      cerrarPanelEstadisticas();
      return;
    }
    asegurarFiltroEstadisticas();
    sincronizarUiFiltroEstadisticas();
    renderEstadisticas();
    document.getElementById("panel-estadisticas").hidden = false;
    const cerrar = document.getElementById("btn-cerrar-estadisticas");
    if (cerrar) cerrar.focus();
  }

  function abrirPrincipal(sesion, opciones) {
    if (!sesion || !leerSesion()) {
      mostrarPantalla("login");
      return;
    }
    const opts = opciones || {};
    document.getElementById("sesion-nombre").textContent = sesion.nombre;
    document.getElementById("sesion-rol").textContent = NOMBRE_ROL[sesion.rol] || sesion.rol;
    estado.conversacionActivaId = "";
    const conversacion = opts.trasLogin
      ? prepararConversacionTrasLogin(sesion)
      : asegurarConversacionActiva(sesion);
    pintarHiloEnPantalla(conversacion);
    renderHistorial(sesion);
    aplicarVisibilidadHistorial(sesion);
    quitarEntradaLoginRefresh();
    mostrarPantalla("principal");
    if (opts.prepararEntrada) prepararEntradaTrasMuro();
    else limpiarEntradaPrincipal();
    if (!opts.omitirFoco) document.getElementById("chat-texto").focus();
    iniciarVigilanciaServidor();
    iniciarSesionUso(sesion);
    actualizarBotonEstadisticas(sesion);
  }

  function clasesEntradaPrincipal() {
    return ["entrada-tras-muro-espera", "entrada-tras-muro", "entrada-sin-historial"];
  }

  function limpiarEntradaPrincipal() {
    if (estado.entradaPrincipalTimer) {
      clearTimeout(estado.entradaPrincipalTimer);
      estado.entradaPrincipalTimer = null;
    }
    const principal = document.getElementById("pantalla-principal");
    if (!principal) return;
    clasesEntradaPrincipal().forEach(function (clase) {
      principal.classList.remove(clase);
    });
  }

  function historialPrincipalOculto() {
    const layout = document.getElementById("layout-principal");
    return !!(layout && layout.classList.contains("historial-oculto"));
  }

  function prepararEntradaTrasMuro() {
    limpiarEntradaPrincipal();
    const principal = document.getElementById("pantalla-principal");
    if (!principal) return;
    principal.classList.add("entrada-tras-muro-espera");
    if (historialPrincipalOculto()) principal.classList.add("entrada-sin-historial");
  }

  function iniciarEntradaTrasMuro() {
    const principal = document.getElementById("pantalla-principal");
    const chat = principal && principal.querySelector(".chat");
    const campo = document.getElementById("chat-texto");

    function terminar() {
      limpiarEntradaPrincipal();
      if (campo && principal && !principal.hidden) campo.focus();
    }

    if (!principal || principal.hidden || prefiereMenosMovimiento()) {
      terminar();
      return;
    }

    if (historialPrincipalOculto()) principal.classList.add("entrada-sin-historial");
    principal.classList.add("entrada-tras-muro");
    principal.classList.remove("entrada-tras-muro-espera");

    if (!chat) {
      terminar();
      return;
    }

    function alTerminarChat(evento) {
      if (evento.animationName !== "entrada-chat") return;
      chat.removeEventListener("animationend", alTerminarChat);
      terminar();
    }
    chat.addEventListener("animationend", alTerminarChat);
    estado.entradaPrincipalTimer = setTimeout(terminar, 2200);
  }

  function detenerMuroEsmeraldas() {
    if (typeof estado.cancelarMuroEsmeraldas === "function") {
      estado.cancelarMuroEsmeraldas();
    }
    estado.cancelarMuroEsmeraldas = null;
  }

  function transicionTrasLogin(sesion) {
    if (!sesion) {
      mostrarPantalla("login");
      return;
    }
    if (prefiereMenosMovimiento() || typeof window.reproducirMuroEsmeraldas !== "function") {
      abrirPrincipal(sesion, { trasLogin: true });
      return;
    }
    detenerMuroEsmeraldas();
    estado.cancelarMuroEsmeraldas = window.reproducirMuroEsmeraldas({
      alCubrir: function () {
        abrirPrincipal(sesion, { trasLogin: true, omitirFoco: true, prepararEntrada: true });
      },
      alTerminar: function () {
        estado.cancelarMuroEsmeraldas = null;
        iniciarEntradaTrasMuro();
      },
    });
  }

  function forzarAccesoLogin(mensaje) {
    salir({ mensaje: mensaje });
  }

  function salir(opciones) {
    const opts = opciones || {};
    detenerMuroEsmeraldas();
    limpiarEntradaPrincipal();
    detenerDictadoVoz(true);
    cerrarPanelEstadisticas();
    actualizarBotonEstadisticas(null);
    cerrarSesionUso();
    borrarSesion();
    borrarInstanciaServidor();
    detenerVigilanciaServidor();
    estado.peticionesPendientes = Object.create(null);
    estado.conversacionActivaId = "";
    document.getElementById("lista-mensajes").replaceChildren();
    document.getElementById("chat-error").textContent = "";
    document.getElementById("chat-texto").value = "";
    limpiarClaves();
    cerrarModalAutorizacionRegistro();
    ocultarToastApp();
    ocultarToastLogin();
    mostrarVistaLogin("entrar");
    mostrarPantalla("login");
    if (opts.mensaje) mostrarToastLogin(opts.mensaje);
    document.getElementById("entrar-nombre").focus();
  }

  function anexarFuenteMensaje(articulo, fuente) {
    if (!fuente || !articulo) return;
    const cita = document.createElement("p");
    cita.className = "mensaje-fuente";
    cita.textContent = "Fuente: " + fuente;
    articulo.appendChild(cita);
  }

  function transformarFueraDeComillas(texto, transformar) {
    const re = /("[^"]*"|«[^»]*»|“[^”]*”)/g;
    let salida = "";
    let ultimo = 0;
    let m;
    while ((m = re.exec(texto))) {
      if (m.index > ultimo) salida += transformar(texto.slice(ultimo, m.index));
      salida += m[0];
      ultimo = m.index + m[0].length;
    }
    if (ultimo < texto.length) salida += transformar(texto.slice(ultimo));
    return salida;
  }

  function insertarSaltosDeLista(texto) {
    const yaEstructurado = /(?:^|\n)\s{0,3}(?:[-*•+]|\d+\.)\s+\S/.test(texto) && texto.indexOf("\n") !== -1;
    if (yaEstructurado) return texto;
    return transformarFueraDeComillas(texto, function (trozo) {
      return trozo
        .replace(/:\s+([-*•])\s+/g, ":\n$1 ")
        .replace(/:\s+(\d+\.)\s+/g, ":\n$1 ")
        .replace(/^\s+([-*•])\s+/g, "\n$1 ")
        .replace(/^\s+(\d+\.)\s+/g, "\n$1 ")
        .replace(/([.!?…)"»”])\s+([-*•])\s+/g, "$1\n$2 ")
        .replace(/([.!?…)"»”])\s+(\d+\.)\s+/g, "$1\n$2 ");
    });
  }

  function separarSeccionesYCierre(texto) {
    let t = texto.replace(
      /(^|\n)(- [^\n]*?[.!"»”])\s+([A-ZÁÉÍÓÚÑ¿¡][^\n]{0,80}:)\s*(?=\n(?:[-*•+]|\d+\.) )/gm,
      "$1$2\n\n$3"
    );
    t = t.replace(/([.!"»”])\s+(¿)/g, "$1\n\n$2");
    return t;
  }

  function anidarListasPorTitulo(texto) {
    const lineas = texto.split("\n");
    const salida = [];
    let enPadre = false;
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      const item = /^([-*•+]) (.+)$/.exec(linea);
      if (!item) {
        enPadre = false;
        salida.push(linea);
        continue;
      }
      const cuerpo = item[2];
      const esPadre =
        /:\s*$/.test(cuerpo) &&
        cuerpo.length <= 80 &&
        !/^["«“¿]/.test(cuerpo);
      if (esPadre) {
        salida.push("- **" + cuerpo.replace(/:\s*$/, "") + "**");
        enPadre = true;
      } else if (enPadre) {
        salida.push("  - " + cuerpo);
      } else {
        salida.push(linea);
      }
    }
    return salida.join("\n");
  }

  function estructurarTextoAsistente(texto) {
    let t = String(texto || "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
    if (!t) return "";
    t = insertarSaltosDeLista(t);
    t = separarSeccionesYCierre(t);
    t = anidarListasPorTitulo(t);
    return t.replace(/\n{3,}/g, "\n\n").trim();
  }

  function insertarMarcasEnLinea(texto, destino) {
    const re = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
    let ultimo = 0;
    let m;
    while ((m = re.exec(texto))) {
      if (m.index > ultimo) destino.appendChild(document.createTextNode(texto.slice(ultimo, m.index)));
      if (m[1] != null) {
        const fuerte = document.createElement("strong");
        fuerte.textContent = m[1];
        destino.appendChild(fuerte);
      } else if (m[2] != null) {
        const codigo = document.createElement("code");
        codigo.textContent = m[2];
        destino.appendChild(codigo);
      } else {
        const enfasis = document.createElement("em");
        enfasis.textContent = m[3];
        destino.appendChild(enfasis);
      }
      ultimo = m.index + m[0].length;
    }
    if (ultimo < texto.length) destino.appendChild(document.createTextNode(texto.slice(ultimo)));
  }

  function aplicarMarcasEnLinea(texto, destino) {
    const partes = String(texto || "").split("\n");
    for (let i = 0; i < partes.length; i++) {
      if (i > 0) destino.appendChild(document.createElement("br"));
      insertarMarcasEnLinea(partes[i], destino);
    }
  }

  function coincidenciaLista(linea) {
    return /^( *)(?:[-*•+]|\d+\.)\s+(.*)$/.exec(linea);
  }

  function construirListasMarkdown(lineas) {
    const frag = document.createDocumentFragment();
    const pila = [];

    function asegurarLista(indent, ordenada) {
      while (pila.length && pila[pila.length - 1].indent > indent) pila.pop();
      const cima = pila[pila.length - 1];
      if (cima && cima.indent === indent) {
        if (cima.ordenada !== ordenada) {
          pila.pop();
          return asegurarLista(indent, ordenada);
        }
        return cima.lista;
      }
      const lista = document.createElement(ordenada ? "ol" : "ul");
      if (!pila.length) {
        frag.appendChild(lista);
      } else {
        const padreLi = pila[pila.length - 1].lista.lastElementChild;
        if (padreLi) padreLi.appendChild(lista);
        else pila[pila.length - 1].lista.appendChild(lista);
      }
      pila.push({ indent: indent, ordenada: ordenada, lista: lista });
      return lista;
    }

    for (let i = 0; i < lineas.length; i++) {
      const m = coincidenciaLista(lineas[i]);
      if (!m) continue;
      const indent = m[1].replace(/\t/g, "    ").length;
      const ordenada = /^\s*\d+\.\s/.test(lineas[i]);
      const lista = asegurarLista(indent, ordenada);
      const item = document.createElement("li");
      aplicarMarcasEnLinea(m[2], item);
      lista.appendChild(item);
    }
    return frag;
  }

  function pintarCuerpoMensajeIa(nodo, texto) {
    nodo.replaceChildren();
    const md = estructurarTextoAsistente(texto);
    if (!md) return;
    const lineas = md.split("\n");
    let i = 0;
    while (i < lineas.length) {
      if (lineas[i].trim() === "") {
        i += 1;
        continue;
      }
      const titulo = /^(#{1,3})\s+(.+)$/.exec(lineas[i]);
      if (titulo) {
        const nivel = Math.min(3, titulo[1].length) + 1;
        const encabezado = document.createElement("h" + nivel);
        aplicarMarcasEnLinea(titulo[2], encabezado);
        nodo.appendChild(encabezado);
        i += 1;
        continue;
      }
      if (coincidenciaLista(lineas[i])) {
        const bloque = [];
        while (i < lineas.length && coincidenciaLista(lineas[i])) {
          bloque.push(lineas[i]);
          i += 1;
        }
        nodo.appendChild(construirListasMarkdown(bloque));
        continue;
      }
      const parrafoLineas = [lineas[i]];
      i += 1;
      while (
        i < lineas.length &&
        lineas[i].trim() !== "" &&
        !coincidenciaLista(lineas[i]) &&
        !/^#{1,3}\s+/.test(lineas[i])
      ) {
        parrafoLineas.push(lineas[i]);
        i += 1;
      }
      const parrafo = document.createElement("p");
      aplicarMarcasEnLinea(parrafoLineas.join("\n"), parrafo);
      nodo.appendChild(parrafo);
    }
  }

  function duracionAnimacionTextoMs(longitud) {
    if (longitud <= 24) return 700 + longitud * 18;
    if (longitud <= 180) return 1400 + (longitud / 180) * 600;
    return Math.min(3000, 2000 + 900 * (1 - Math.exp(-(longitud - 180) / 900)));
  }

  function trozosAnimacionTexto(texto) {
    const caracteres = Array.from(texto || "");
    const n = caracteres.length;
    if (n === 0) return [""];
    if (n <= 160) {
      return caracteres;
    }
    if (n <= 480) {
      const porPaso = Math.min(8, Math.max(2, Math.ceil(n / 140)));
      const trozos = [];
      for (let i = 0; i < n; i += porPaso) {
        trozos.push(caracteres.slice(i, i + porPaso).join(""));
      }
      return trozos;
    }
    const tokens = texto.match(/\S+\s*|\s+/g) || [texto];
    const objetivoPasos = Math.min(110, Math.max(70, Math.round(n / 18)));
    const porPaso = Math.max(1, Math.ceil(tokens.length / objetivoPasos));
    const trozos = [];
    for (let i = 0; i < tokens.length; i += porPaso) {
      trozos.push(tokens.slice(i, i + porPaso).join(""));
    }
    return trozos;
  }

  function animarTextoMensaje(nodo, texto, alTerminar, pintarCuerpo) {
    const trozos = trozosAnimacionTexto(texto);
    const duracion = duracionAnimacionTextoMs(texto.length);
    const intervalo = Math.max(12, duracion / Math.max(1, trozos.length));
    const token = { activa: true };
    nodo._animacionTexto = token;
    let indice = 0;
    let acumulado = "";
    let marca = performance.now();

    function pintar(acumuladoActual) {
      if (typeof pintarCuerpo === "function") pintarCuerpo(nodo, acumuladoActual);
      else nodo.textContent = acumuladoActual;
    }

    function paso(ahora) {
      if (!token.activa || nodo._animacionTexto !== token || !nodo.isConnected) return;
      if (ahora - marca < intervalo) {
        requestAnimationFrame(paso);
        return;
      }
      const saltos = Math.max(1, Math.floor((ahora - marca) / intervalo));
      marca += saltos * intervalo;
      for (let s = 0; s < saltos && indice < trozos.length; s += 1) {
        acumulado += trozos[indice];
        indice += 1;
      }
      pintar(acumulado);
      const lista = document.getElementById("lista-mensajes");
      if (lista) lista.scrollTop = lista.scrollHeight;
      if (indice < trozos.length) {
        requestAnimationFrame(paso);
        return;
      }
      if (typeof alTerminar === "function") alTerminar();
    }

    requestAnimationFrame(paso);
  }

  function agregarMensaje({ autor, texto, fuente }, opciones) {
    const opts = opciones || {};
    const conversacionId = opts.conversacionId || estado.conversacionActivaId;
    const pintar = opts.pintar !== false && conversacionVisible(conversacionId);
    const lista = pintar ? document.getElementById("lista-mensajes") : null;
    let articulo = null;
    if (lista) {
      articulo = document.createElement("article");
      articulo.className = "mensaje mensaje-" + autor;
      if (opts.pendiente) articulo.setAttribute("data-pendiente-asistente", "true");
      if (autor !== "nota") {
        const quien = document.createElement("p");
        quien.className = "mensaje-autor";
        quien.textContent = autor === "usuario" ? "Tú" : "Asistente (IA)";
        articulo.appendChild(quien);
      }
      const cuerpo = document.createElement("div");
      cuerpo.className = "mensaje-texto";
      const esIa = autor === "ia";
      const animar = opts.animar === true && esIa && typeof texto === "string" && texto && !prefiereMenosMovimiento();
      if (esIa) {
        if (!animar) pintarCuerpoMensajeIa(cuerpo, texto);
      } else {
        cuerpo.textContent = animar ? "" : texto;
      }
      articulo.appendChild(cuerpo);
      if (fuente && !animar) anexarFuenteMensaje(articulo, fuente);
      lista.appendChild(articulo);
      lista.scrollTop = lista.scrollHeight;
      if (animar) {
        cuerpo.classList.add("mensaje-texto-escribiendo");
        articulo.setAttribute("aria-busy", "true");
        animarTextoMensaje(
          cuerpo,
          texto,
          function () {
            cuerpo.classList.remove("mensaje-texto-escribiendo");
            articulo.removeAttribute("aria-busy");
            anexarFuenteMensaje(articulo, fuente);
            lista.scrollTop = lista.scrollHeight;
          },
          pintarCuerpoMensajeIa
        );
      }
    }
    if (opts.persistir !== false && mensajePersistible(autor)) {
      const sesion = leerSesion();
      if (sesion) {
        guardarMensajeEnConversacion(sesion, conversacionId, { autor: autor, texto: texto, fuente: fuente });
      }
    }
    return articulo;
  }

  const dictadoVoz = {
    activo: false,
    reconocimiento: null,
    textoBase: "",
    textoConfirmado: "",
    reiniciando: false,
  };

  function reconocimientoVozDisponible() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function crearReconocimientoVoz() {
    const Clase = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Clase) return null;
    const reconocimiento = new Clase();
    reconocimiento.lang = "es-MX";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
    reconocimiento.maxAlternatives = 1;
    return reconocimiento;
  }

  function textoDictadoCombinado(interino) {
    let salida = dictadoVoz.textoBase;
    const confirmado = dictadoVoz.textoConfirmado.trim();
    const provisional = (interino || "").trim();
    if (confirmado) {
      if (salida && !/\s$/.test(salida)) salida += " ";
      salida += confirmado;
    }
    if (provisional) {
      if (salida && !/\s$/.test(salida)) salida += " ";
      salida += provisional;
    }
    return salida.slice(0, 2000);
  }

  function actualizarUiDictado(escuchando) {
    const boton = document.getElementById("btn-dictado");
    const campo = document.querySelector(".chat-form-campo");
    if (!boton || !campo) return;
    boton.classList.toggle("btn-dictado--escuchando", escuchando);
    boton.setAttribute("aria-pressed", escuchando ? "true" : "false");
    boton.setAttribute(
      "aria-label",
      escuchando ? "Dejar de dictar mensaje" : "Dictar mensaje con voz"
    );
    boton.title = escuchando ? "Detener dictado" : "Dictar con voz";
    campo.classList.toggle("chat-form-campo--escuchando", escuchando);
  }

  function detenerDictadoVoz(silencioso) {
    dictadoVoz.activo = false;
    dictadoVoz.reiniciando = false;
    actualizarUiDictado(false);
    const reconocimiento = dictadoVoz.reconocimiento;
    if (reconocimiento) {
      try {
        reconocimiento.onend = null;
        reconocimiento.onresult = null;
        reconocimiento.onerror = null;
        reconocimiento.stop();
      } catch {
        /* ignorar */
      }
    }
    dictadoVoz.reconocimiento = null;
    if (!silencioso) {
      const input = document.getElementById("chat-texto");
      if (input) input.value = textoDictadoCombinado("");
    }
  }

  function manejarErrorDictado(evento) {
    const codigo = evento && evento.error;
    if (codigo === "aborted" || codigo === "no-speech") return;
    detenerDictadoVoz(true);
    const error = document.getElementById("chat-error");
    if (!error) return;
    if (codigo === "not-allowed" || codigo === "service-not-allowed") {
      error.textContent =
        "No pude usar el micrófono. Permite el acceso en el navegador o revisa la configuración del sistema.";
      return;
    }
    if (codigo === "audio-capture") {
      error.textContent = "No encontré un micrófono disponible en este equipo.";
      return;
    }
    if (codigo === "network") {
      error.textContent = "El dictado por voz necesita conexión a internet en este navegador.";
      return;
    }
    error.textContent = "No pude continuar con el dictado por voz. Intenta de nuevo.";
  }

  function enlazarReconocimientoVoz(reconocimiento) {
    const input = document.getElementById("chat-texto");

    reconocimiento.onresult = function (evento) {
      let interino = "";
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        const trozo = (resultado[0] && resultado[0].transcript) || "";
        if (resultado.isFinal) {
          const limpio = trozo.trim();
          if (!limpio) continue;
          if (dictadoVoz.textoConfirmado && !/\s$/.test(dictadoVoz.textoConfirmado)) {
            dictadoVoz.textoConfirmado += " ";
          }
          dictadoVoz.textoConfirmado += limpio;
        } else {
          interino += trozo;
        }
      }
      if (input) input.value = textoDictadoCombinado(interino);
    };

    reconocimiento.onend = function () {
      if (!dictadoVoz.activo) return;
      if (dictadoVoz.reiniciando) return;
      dictadoVoz.reiniciando = true;
      window.setTimeout(function () {
        dictadoVoz.reiniciando = false;
        if (!dictadoVoz.activo || dictadoVoz.reconocimiento !== reconocimiento) return;
        try {
          reconocimiento.start();
        } catch {
          detenerDictadoVoz(true);
        }
      }, 120);
    };

    reconocimiento.onerror = manejarErrorDictado;
  }

  function iniciarDictadoVoz() {
    const error = document.getElementById("chat-error");
    const input = document.getElementById("chat-texto");
    if (!input) return;
    if (error) error.textContent = "";
    if (!reconocimientoVozDisponible()) {
      if (error) {
        error.textContent =
          "Tu navegador no admite dictado por voz aquí. Prueba con Chrome o Edge en escritorio.";
      }
      return;
    }
    if (dictadoVoz.activo) {
      detenerDictadoVoz(true);
      if (input) input.value = textoDictadoCombinado("");
      return;
    }
    const reconocimiento = crearReconocimientoVoz();
    if (!reconocimiento) return;
    dictadoVoz.textoBase = input.value.trimEnd();
    dictadoVoz.textoConfirmado = "";
    dictadoVoz.reconocimiento = reconocimiento;
    dictadoVoz.activo = true;
    enlazarReconocimientoVoz(reconocimiento);
    actualizarUiDictado(true);
    try {
      reconocimiento.start();
    } catch {
      detenerDictadoVoz(true);
      if (error) error.textContent = "No pude iniciar el dictado. Intenta de nuevo.";
    }
  }

  function configurarDictadoVoz() {
    const boton = document.getElementById("btn-dictado");
    if (!boton) return;
    boton.addEventListener("click", iniciarDictadoVoz);
    if (!reconocimientoVozDisponible()) {
      boton.disabled = true;
      boton.title = "Dictado no disponible en este navegador";
    }
  }

  async function enviarMensaje(event) {
    event.preventDefault();
    detenerDictadoVoz(true);
    const input = document.getElementById("chat-texto");
    const error = document.getElementById("chat-error");
    const mensaje = input.value.trim();
    error.textContent = "";
    if (!mensaje) {
      error.textContent = "Escribe un mensaje.";
      return;
    }
    if (contieneDatosSensibles(mensaje)) {
      input.value = "";
      error.textContent = "No envié el mensaje: parece tener datos sensibles (RFC, CURP, tarjeta o clave). No se guardó.";
      return;
    }
    const sesion = leerSesion();
    if (!sesion || !leerInstanciaServidor()) {
      forzarAccesoLogin("Inicia sesión para usar el asistente.");
      return;
    }
    if (!estado.conversacionActivaId) iniciarBorradorEnMemoria();
    const conversacionId = estado.conversacionActivaId;
    if (!conversacionId || estado.peticionesPendientes[conversacionId]) return;
    estado.peticionesPendientes[conversacionId] = true;
    registrarPromptUso();
    const inicioRespuesta = Date.now();
    agregarMensaje({ autor: "usuario", texto: mensaje }, { conversacionId: conversacionId });
    input.value = "";
    pintarIndicadorEscribiendo();
    try {
      const respuesta = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: mensaje,
          rol: sesion.rol,
          nombre: sesion.nombre,
          conversacionId: conversacionId,
          conteos: conteosFuentes(),
        }),
      });
      const data = await respuesta.json().catch(function () { return null; });
      if (conversacionVisible(conversacionId)) quitarIndicadorEscribiendo();
      if (!respuesta.ok || !data || data.ok === false || data.esIA !== true) {
        agregarMensaje({
          autor: "nota",
          texto: (data && data.motivo) || "No pude obtener una respuesta del asistente.",
        }, { conversacionId: conversacionId, persistir: false });
        return;
      }
      const duracionServidor = Number(data.duracionMs);
      registrarTiempoRespuestaUso(
        Number.isFinite(duracionServidor) && duracionServidor >= 0
          ? duracionServidor
          : Date.now() - inicioRespuesta
      );
      agregarMensaje(
        { autor: "ia", texto: data.texto, fuente: data.fuente },
        { conversacionId: conversacionId, animar: true }
      );
    } catch {
      if (conversacionVisible(conversacionId)) quitarIndicadorEscribiendo();
      const instanciaActual = await obtenerInstanciaServidor();
      const vinculo = leerInstanciaServidor();
      if (!instanciaActual || !vinculo || vinculo !== instanciaActual) {
        forzarAccesoLogin(
          instanciaActual
            ? "El servidor se reinició. Inicia sesión de nuevo."
            : "Se perdió la conexión con el servidor. Inicia sesión cuando vuelva a estar disponible."
        );
        return;
      }
      agregarMensaje({
        autor: "nota",
        texto: "No pude contactar al asistente. Revisa que el servidor siga encendido.",
      }, { conversacionId: conversacionId, persistir: false });
    } finally {
      delete estado.peticionesPendientes[conversacionId];
    }
  }

  function iniciar() {
    llenarRoles(document.getElementById("registrar-rol"));
    document.getElementById("link-registrar").addEventListener("click", abrirModalAutorizacionRegistro);
    document.getElementById("modal-autorizacion-cancelar").addEventListener("click", cerrarModalAutorizacionRegistro);
    document.getElementById("modal-autorizacion-fondo").addEventListener("click", cerrarModalAutorizacionRegistro);
    document.getElementById("form-autorizacion-registro").addEventListener("submit", function (event) {
      event.preventDefault();
      const error = document.getElementById("modal-autorizacion-error");
      const clave = document.getElementById("modal-autorizacion-clave").value;
      error.textContent = "";
      if (!autorizacionRegistroValida(clave)) {
        error.textContent = "La contraseña para registrar no es correcta.";
        return;
      }
      estado.registroAutorizado = true;
      cerrarModalAutorizacionRegistro();
      transicionarVistaLogin("registrar", function () {
        document.getElementById("registrar-nombre").focus();
      });
    });
    document.getElementById("link-olvidar").addEventListener("click", function () {
      const nombre = document.getElementById("entrar-nombre").value.trim();
      if (nombre) document.getElementById("restablecer-nombre").value = nombre;
      transicionarVistaLogin("restablecer", function () {
        document.getElementById("restablecer-nombre").focus();
      });
    });
    document.getElementById("link-volver").addEventListener("click", function () {
      transicionarVistaLogin("entrar", function () {
        document.getElementById("entrar-nombre").focus();
      });
    });
    document.getElementById("form-entrar").addEventListener("submit", async function (event) {
      event.preventDefault();
      const error = document.getElementById("entrar-error");
      const boton = event.currentTarget.querySelector("button");
      error.textContent = "";
      boton.disabled = true;
      const resultado = await entrar(
        document.getElementById("entrar-nombre").value,
        document.getElementById("entrar-clave").value
      );
      boton.disabled = false;
      if (!resultado.ok) {
        error.textContent = resultado.motivo;
        return;
      }
      if (!(await vincularSesionAlServidor())) {
        borrarSesion();
        error.textContent = "No hay conexión con el servidor. Intenta de nuevo.";
        return;
      }
      limpiarClaves();
      transicionTrasLogin(resultado.sesion);
    });
    document.getElementById("form-restablecer").addEventListener("submit", async function (event) {
      event.preventDefault();
      const error = document.getElementById("restablecer-error");
      const boton = event.currentTarget.querySelector("button[type='submit']");
      error.textContent = "";
      boton.disabled = true;
      const resultado = await restablecerClave(
        document.getElementById("restablecer-nombre").value,
        document.getElementById("restablecer-clave").value
      );
      boton.disabled = false;
      if (!resultado.ok) {
        error.textContent = resultado.motivo;
        return;
      }
      document.getElementById("entrar-nombre").value = resultado.nombre;
      document.getElementById("restablecer-nombre").value = "";
      limpiarClaves();
      transicionarVistaLogin("entrar", function () {
        mostrarToastLogin("Contraseña actualizada correctamente");
        document.getElementById("entrar-clave").focus();
      });
    });
    document.getElementById("form-registrar").addEventListener("submit", async function (event) {
      event.preventDefault();
      const error = document.getElementById("registrar-error");
      const boton = event.currentTarget.querySelector("button");
      error.textContent = "";
      if (!estado.registroAutorizado) {
        abrirModalAutorizacionRegistro();
        return;
      }
      boton.disabled = true;
      const resultado = await registrarUsuario({
        nombre: document.getElementById("registrar-nombre").value,
        clave: document.getElementById("registrar-clave").value,
        rol: document.getElementById("registrar-rol").value,
      });
      boton.disabled = false;
      if (!resultado.ok) {
        error.textContent = resultado.motivo;
        return;
      }
      guardarSesion(resultado.usuario);
      if (!(await vincularSesionAlServidor())) {
        borrarSesion();
        error.textContent = "No hay conexión con el servidor. Intenta de nuevo.";
        return;
      }
      document.getElementById("registrar-nombre").value = "";
      document.getElementById("registrar-rol").value = "";
      limpiarClaves();
      transicionTrasLogin(leerSesion());
    });
    document.getElementById("btn-salir").addEventListener("click", salir);
    document.getElementById("btn-nueva-conversacion").addEventListener("click", function () {
      const sesion = leerSesion();
      if (!sesion) {
        forzarAccesoLogin("Inicia sesión para usar el asistente.");
        return;
      }
      nuevaConversacion(sesion);
    });
    document.getElementById("btn-ocultar-historial").addEventListener("click", alternarPanelHistorial);
    document.getElementById("btn-mostrar-historial").addEventListener("click", alternarPanelHistorial);
    document.getElementById("form-chat").addEventListener("submit", enviarMensaje);
    document.getElementById("btn-estadisticas").addEventListener("click", abrirPanelEstadisticas);
    document.getElementById("btn-cerrar-estadisticas").addEventListener("click", cerrarPanelEstadisticas);
    configurarFiltroEstadisticas();
    document.getElementById("panel-estadisticas-fondo").addEventListener("click", cerrarPanelEstadisticas);
    document.addEventListener("keydown", function (evento) {
      if (evento.key !== "Escape") return;
      const panel = document.getElementById("panel-estadisticas");
      if (panel && !panel.hidden) cerrarPanelEstadisticas();
    });
    window.addEventListener("pagehide", function () {
      actualizarSesionUso(function () {});
    });
    configurarDictadoVoz();

    mostrarVistaLogin("entrar");
    mostrarPantalla("login");
    configurarFinEntradaLoginRefresh();
    validarSesionConServidor().then(function (sesion) {
      if (sesion) abrirPrincipal(sesion);
      else document.getElementById("entrar-nombre").focus();
    });
  }

  iniciar();
})();
