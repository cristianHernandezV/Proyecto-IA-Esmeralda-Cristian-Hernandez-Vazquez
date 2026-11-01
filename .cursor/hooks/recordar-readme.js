const fs = require("fs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const raw = readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

const prompt = String(
  payload.prompt || payload.text || payload.user_prompt || ""
).toLowerCase();

const looksLikeCodeChange =
  /(implement|implementa|agrega|añade|añad|crea |crear|modifica|cambia|arregla|fix|refactor|endpoint|ruta|login|factura|excel|localstorage|foundry|ui |frontend|backend|codigo|código)/i.test(
    prompt
  );

const reminder = looksLikeCodeChange
  ? "Este prompt parece un cambio de producto. Si editas código, actualiza README.md en el mismo turno (qué hace, cómo funciona, fila en Registro de cambios, imagen en docs/imagenes/ si hay UI). Skill: documentar-readme."
  : "Si al final no hubo cambios de código, no toques el README. Si sí los hubo, actualiza README.md según la skill documentar-readme.";

const output = {
  additional_context: reminder,
  agent_message: reminder,
};

process.stdout.write(JSON.stringify(output));
