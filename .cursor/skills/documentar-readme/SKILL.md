---
name: documentar-readme
description: Actualiza README.md cuando cambia código, UI, API, Excel, roles o el agente Foundry. Explica qué hace el cambio, cómo funciona, registra la fila de cambios y añade imágenes de UI. Usar en cada prompt que implemente, corrija o elimine funcionalidad; también al documentar Río Claro, localStorage o Foundry.
---

# Documentar README.md

Obligatorio en el **mismo turno** que el cambio de código. No pedir permiso; no dejarlo para un commit posterior.

Copia canónica de la skill del harness: el detalle operativo vive también en `.github/skills/documentar-readme/SKILL.md`.

## Cuándo

Cualquier creación, modificación o borrado de rutas Express, frontend, `localStorage`, Excel, login/roles, facturas, pedidos, reportes, quejas, agente Foundry o despliegue.

No aplica si el usuario solo pregunta y no se toca código.

## Cómo

1. Lee `README.md`.
2. Actualiza solo las secciones afectadas: **qué hace** y **cómo funciona**.
3. Inserta una fila al inicio de **Registro de cambios**:

   `| YYYY-MM-DD | módulo | resumen de 1 línea | archivos clave |`

4. Si cambió la UI, guarda captura en `docs/imagenes/` y enlázala.
5. Cita rutas `/api/...`, claves `rioclaro.*` y archivos Excel reales.

## Plantilla de módulo

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
