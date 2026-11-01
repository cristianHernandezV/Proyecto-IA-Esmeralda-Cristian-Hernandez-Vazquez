---
name: documentar-readme
description: Actualiza README.md cuando cambia código, UI, API, Excel, roles o el agente Foundry. Explica qué hace el cambio, cómo funciona, registra la fila de cambios y añade imágenes de UI. Usar en cada prompt que implemente, corrija o elimine funcionalidad; también al documentar Río Claro, localStorage o Foundry.
---

# Documentar README.md

Obligatorio en el **mismo turno** que el cambio de código. No pedir permiso; no dejarlo para un commit posterior.

## Cuándo

Cualquier creación, modificación o borrado de:

- Rutas Express, frontend, `localStorage`, Excel/CSV
- Login, roles, usuarios
- Facturas, pedidos, reportes, quejas
- Agente Foundry o mensajes al usuario
- Despliegue o variables de entorno

No aplica si el usuario solo pregunta y no se toca código.

## Cómo

1. Lee `README.md` actual.
2. Actualiza las secciones afectadas (qué hace / cómo funciona). No reescribas el documento entero.
3. Añade una fila al inicio de **Registro de cambios** (más reciente arriba):

   `| YYYY-MM-DD | módulo | resumen de 1 línea | archivos clave |`

4. Si cambió la UI, guarda captura en `docs/imagenes/` (`modulo-accion.png`) y enlázala con texto alternativo.
5. Nombra fuentes reales: rutas `/api/...`, claves `rioclaro.*`, archivos Excel.

## Plantilla de sección de módulo

```markdown
### [Nombre del módulo]

**Qué hace:** una o dos frases de negocio.

**Cómo funciona:**
1. Paso de usuario
2. Dónde se guarda (`localStorage` / Excel)
3. Qué hace el servidor o el agente Foundry

**Quién lo usa:** roles.

**Fuente que debe citar la IA:** nombre de tabla o archivo.
```

## No hacer

- README vacío de “archivos tocados” sin explicar el flujo
- Inventar capturas
- Documentar secretos
