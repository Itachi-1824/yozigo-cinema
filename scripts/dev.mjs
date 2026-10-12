import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const children = [
  spawn(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      require.resolve("tsx/cli"),
      "watch",
      "server/index.ts",
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/astro/bin/astro.mjs", import.meta.url),
      ),
      "dev",
      "--host",
      "127.0.0.1",
    ],
    { stdio: "inherit" },
  ),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    close(1);
  });
  child.on("exit", (code) => close(code ?? 1));
}
process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());
