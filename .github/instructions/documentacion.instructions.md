---
name: Documentar cada cambio
description: Obligatorio actualizar README.md cuando el prompt cambia código, UI o comportamiento del agente.
applyTo: "**"
---

# Documentación en cada cambio de código

Si este turno crea, modifica o elimina código, configuración de la app, rutas, Excel, roles o el agente Foundry:

1. Actualizar `README.md` en el mismo turno (no dejarlo “para después”).
2. Explicar **qué hace** el cambio y **cómo funciona** (flujo, archivos, claves de `localStorage`, rutas).
3. Añadir una fila en la tabla de cambios del README (fecha, módulo, resumen).
4. Si hay UI nueva o cambiada, añadir imagen en `docs/imagenes/` y enlazarla.
5. Seguir `.github/skills/documentar-readme/SKILL.md`.

No documentar solo el harness: documentar el producto. No borrar secciones ajenas al cambio.
