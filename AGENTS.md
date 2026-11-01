# Agentes — Río Claro

Harness para construir el prototipo (Node.js, Express, localStorage, agente Microsoft Foundry).

## Agentes del harness (GitHub Copilot)

| Agente | Archivo | Uso |
|--------|---------|-----|
| Arquitecto | `.github/agents/arquitecto.agent.md` | Plan de módulos, datos, API y Foundry. No escribe código de producto. |
| Constructor | `.github/agents/constructor.agent.md` | Implementa el plan y **actualiza README.md**. |
| Desplegador | `.github/agents/desplegador.agent.md` | Local/Azure/Foundry, variables y prueba de humo. |

En Copilot Chat / Copilot CLI, selecciona el agente antes de pedir el trabajo. Flujo típico: Arquitecto → Constructor → Desplegador.

## Instrucciones

- Globales: `.github/copilot-instructions.md`
- Backend: `.github/instructions/backend.instructions.md`
- Frontend: `.github/instructions/frontend.instructions.md`
- Documentación: `.github/instructions/documentacion.instructions.md`

## Documentar siempre que cambie el código

Hay tres capas a propósito (la skill sola se olvida; la instrucción sola no enseña el formato):

1. **Instrucción / regla always-on** — Copilot y Cursor inyectan el recordatorio en cada prompt.
2. **Skill `documentar-readme`** — el procedimiento (tabla de cambios, imágenes, plantilla de módulo).
3. **Hook de Cursor** — refuerza el recordatorio al enviar el prompt y al terminar un turno con código sucio.

Detalles: `.github/skills/documentar-readme/SKILL.md` y `.cursor/skills/documentar-readme/SKILL.md`.
