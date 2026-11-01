---
name: Frontend Río Claro
description: Convenciones de la UI estática, login por roles y localStorage.
applyTo: "public/**/*.{html,css,js}"
---

# Frontend

- UI en `public/`: HTML + CSS + JS vanilla (sin framework salvo que el arquitecto lo apruebe).
- Toda la persistencia va en `localStorage`. Claves con prefijo `rioclaro.`:
  - `rioclaro.usuarios`
  - `rioclaro.sesion`
  - `rioclaro.facturas`
  - `rioclaro.pedidos`
  - `rioclaro.ventas`
  - `rioclaro.quejas`
- Dos pantallas: **login** y **principal**. Sin sesión no hay chat ni módulos.
- En login: entrar, o registrar usuario (nombre, clave y **rol**). Guardar en `rioclaro.usuarios`; la sesión activa en `rioclaro.sesion`.
- Roles: `super`, `contador`, `cliente`, `empleado`, `supervisor`.
- Pantalla principal: el **chat ocupa el centro**. Al lado (o debajo en móvil) solo el módulo del rol. Comprobar el rol en JS; no basta con ocultar con CSS.
- Módulo por rol: `super` = usuarios (registrar y asignar rol) y acceso al resto; `contador` = facturas; `cliente` = pedido y quejas; `empleado` = pedidos; `supervisor` = reportes y quejas.
- El chat debe mostrar que responde una IA y la fuente (archivo o clave `localStorage`) de cada dato.
- Formularios con validación visible. No pedir datos sensibles innecesarios.
- Interfaz simple: hay una sola persona de soporte interno; priorizar claridad sobre ornamentación.
- Si cambia la UI, guardar captura en `docs/imagenes/` y referenciarla en `README.md`.
