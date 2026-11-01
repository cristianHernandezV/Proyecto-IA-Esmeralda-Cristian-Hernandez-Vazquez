const { execSync } = require("child_process");

function git(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const status = git("status --porcelain");
if (!status) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const lines = status.split(/\r?\n/).filter(Boolean);
const ignore = [
  /^node_modules\//,
  /^\.git\//,
  /^package-lock\.json$/,
];

function normalize(path) {
  return path.replace(/\\/g, "/").replace(/^["']|["']$/g, "");
}

const changed = [];
for (const line of lines) {
  const path = normalize(line.slice(3).split(" -> ").pop() || "");
  if (!path || ignore.some((re) => re.test(path))) continue;
  changed.push(path);
}

const codeChanged = changed.some((p) =>
  /\.(js|cjs|mjs|html|css|json)$/i.test(p) &&
  !p.startsWith(".github/") &&
  !p.startsWith(".cursor/") &&
  p !== "package.json"
);

const readmeChanged = changed.some(
  (p) => p === "README.md" || p.startsWith("docs/")
);

if (codeChanged && !readmeChanged) {
  process.stdout.write(
    JSON.stringify({
      followup_message:
        "Hay cambios de código sin actualizar README.md ni docs/. Actualiza el README ahora: qué hace el cambio, cómo funciona, y una fila en Registro de cambios. Usa la skill documentar-readme.",
    })
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({}));
