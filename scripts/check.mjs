import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
for (const dir of ["server", "scripts", "extension", "tests", "tests/helpers"]) {
  for (const item of await readdir(dir)) {
    const file = path.join(dir, item);
    if (/\.(mjs|js)$/.test(item)) {
      const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
    }
  }
}
const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const plugin = JSON.parse(await readFile(".codex-plugin/plugin.json", "utf8"));
if (pkg.version !== manifest.version || pkg.version !== plugin.version) throw new Error("Package, extension and plugin versions must match");
if (manifest.permissions.some(item => item.includes("://") || item === "tabs" || item === "<all_urls>")) throw new Error("Broad site permissions must remain optional");
if (!manifest.browser_specific_settings.gecko.id) throw new Error("Native messaging needs a stable extension ID");
console.log("Syntax and manifest policy checks passed.");
