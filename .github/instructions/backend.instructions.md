---
name: Backend Express Río Claro
description: Convenciones del servidor Node.js + Express y de la integración con Foundry.
applyTo: "**/*.{js,cjs,mjs,json}"
---

# Backend

- Entrada: `index.js` (o `src/server.js` si el arquitecto lo define; no crear un segundo servidor).
- Express 5, CommonJS (`require` / `module.exports`).
- Servir el frontend estático desde `public/`.
- API REST en `/api/...` con JSON. Prefijos:
  - `/api/auth` login y usuarios
  - `/api/facturas` carga y validación
  - `/api/pedidos` estado de pedidos
  - `/api/reportes` ventas por producto
  - `/api/quejas` registro de quejas
  - `/api/asistente` proxy hacia el agente de Foundry
- La persistencia de negocio es **`localStorage` en el navegador**. El backend no usa SQL ni archivos de sesión de usuario. Puede:
  - Validar payloads
  - Extraer datos de facturas (texto/PDF/imagen)
  - Reenviar mensajes al agente Foundry
  - Devolver plantillas o CSV/Excel generados **en memoria** para que el cliente los guarde
- Excel de trabajo (columnas fijas):
  - Proveedores/facturas: `nombre_proveedor`, `fecha`, `total`
  - Pedidos: `nombre_cliente`, `estado_pedido` (y `fecha_estimada` si existe)
  - Ventas: `producto`, `cantidad`, `importe`, `periodo`
- Rechazar facturas ilegibles, duplicadas (mismo proveedor + fecha + total) o con datos sensibles (RFC/CURP/NIF completos, tarjetas, contraseñas). Responder `400` con `{ "ok": false, "motivo": "..." }`.
- Secretos de Azure solo en variables de entorno (`.env` no se commitea). Nunca hardcodear claves.
- El agente Foundry solo lee las tablas/Excel autorizados; cada respuesta debe incluir la fuente consultada.
