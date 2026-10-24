import { readFile, writeFile, mkdir, access, copyFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { configureCodex } from "./codex-config.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const bundle = path.join(root, "app", "server.mjs");
if (process.argv.includes("--check-only")) {
  console.log(JSON.stringify({ platform: process.platform, node: process.versions.node, bundledServer: await exists(bundle), installsForCurrentUserOnly: true, automaticCodexConfig: !process.argv.includes("--manual-mcp") }));
  process.exit(0);
}
if (process.platform !== "win32") throw new Error("Use the Windows release on Windows. Other platforms need manual native-host setup.");
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Install Node.js 24 LTS from https://nodejs.org/ and run setup again.");
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Setup stopped. Review the message above; existing browser data was not removed.");
}
if (process.argv.includes("--uninstall")) {
  run([path.join(root, "scripts", "install.mjs"), "--uninstall"]);
  console.log("Also remove firefox_local_bridge from your assistant's MCP settings and remove the Firefox add-on. Project files were kept.");
  process.exit(0);
}
if (!await exists(bundle)) {
  const npm = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const pnpm = path.resolve(path.dirname(process.execPath), "..", "node_modules", "pnpm", "bin", "pnpm.cjs");
  if (await exists(npm)) run([npm, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"]);
  else if (await exists(pnpm)) run([pnpm, "install", "--prod", "--frozen-lockfile", "--ignore-scripts", "--config.enable-global-virtual-store=false"]);
  else throw new Error("Use the Windows release ZIP, or install Node.js with npm from https://nodejs.org/.");
}
run([path.join(root, "scripts", "install.mjs")]);
if (!process.argv.includes("--manual-mcp")) {
  const entry = { command: process.execPath, args: [await exists(bundle) ? bundle : path.join(root, "server", "index.mjs")] };
  const dir = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const config = path.join(dir, "config.toml");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let before = "";
  if (await exists(config)) before = await readFile(config, "utf8");
  const after = configureCodex(before, entry);
  if (after !== before) {
    if (await exists(config)) await copyFile(config, config + ".before-firefox-local-bridge.bak");
    if (await exists(config) && await readFile(config, "utf8") !== before) throw new Error("Settings changed during setup. Run setup again.");
    await writeFile(config, after, { mode: 0o600 });
  }
  console.log("Codex MCP entry configured; other settings preserved and backed up.");
}
console.log("\nSETUP COMPLETE / INSTALARE FINALIZATĂ / УСТАНОВКА ЗАВЕРШЕНА");
console.log("Open START-HERE.html in this folder. It shows the remaining Firefox steps.");
console.log("Restart your assistant, load the add-on in Firefox, then enable access for the duration you choose.");
