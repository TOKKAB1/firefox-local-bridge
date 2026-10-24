import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import path from "node:path";
import { createHash } from "node:crypto";
await import("./build.mjs");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("dist", { recursive: true });
const excluded = new Set(["node_modules", ".git", "dist", ".installed", ".runtime"]);
async function collect(directory, base = "") {
  const result = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.name === "package-lock.json" || item.name.endsWith(".log") || item.name.startsWith(".env")) continue;
    const key = base + item.name;
    if (item.isDirectory()) Object.assign(result, await collect(path.join(directory, item.name), key + "/"));
    else result[key] = new Uint8Array(await readFile(path.join(directory, item.name)));
  }
  return result;
}
const extension = await collect("extension");
extension["BUILD-NOTE.txt"] = strToU8("Unsigned development build. Load temporarily via about:debugging. Do not disable Firefox signature enforcement.\n");
const xpi = zipSync(extension, { level: 9 });
const xpiName = `firefox-local-bridge-${pkg.version}-unsigned.xpi`;
await writeFile(path.join("dist", xpiName), xpi);
// Explicit source allowlist: future local settings/secrets must not leak into a release.
const source = {};
for (const directory of ["server", "extension", "scripts", "tests", "docs", ".github", ".codex-plugin"]) {
  Object.assign(source, await collect(directory, directory + "/"));
}
for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".gitignore", ".gitattributes", ".mcp.json", "Install-Windows.cmd", "Setup-Windows.cmd", "Uninstall-Windows.cmd", "START-HERE.html", "LICENSE", "README.md", "README.ru.md", "README.ro.md", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md"]) {
  source[file] = new Uint8Array(await readFile(file));
}
const zipName = `firefox-local-bridge-v${pkg.version}-github-source.zip`;
const prefix = "firefox-local-bridge/";
const rooted = files => Object.fromEntries(Object.entries(files).map(([name, data]) => [prefix + name, data]));
const zip = zipSync(rooted(source), { level: 9 });
await writeFile(path.join("dist", zipName), zip);
const windows = {};
for (const [name, data] of Object.entries(source)) {
  if (name.startsWith('extension/') || name.startsWith('docs/') || ['server/native-host.mjs', 'server/framing.mjs', 'server/runtime.mjs', 'scripts/install.mjs', 'scripts/setup.mjs', 'scripts/codex-config.mjs', 'Setup-Windows.cmd', 'Install-Windows.cmd', 'Uninstall-Windows.cmd', 'START-HERE.html', 'README.md', 'README.ro.md', 'README.ru.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'package.json'].includes(name)) windows[name] = data;
}
windows['app/server.mjs'] = new Uint8Array(await readFile('dist/build/server.mjs'));
windows['app/server.mjs.LEGAL.txt'] = new Uint8Array(await readFile('dist/build/server.mjs.LEGAL.txt'));
windows['app/THIRD-PARTY-NOTICES.txt'] = new Uint8Array(await readFile('dist/build/THIRD-PARTY-NOTICES.txt'));
const windowsName = `firefox-local-bridge-v${pkg.version}-windows.zip`;
const windowsZip = zipSync(rooted(windows), { level: 9 });
await writeFile(path.join('dist', windowsName), windowsZip);
const hashes = [[xpiName, xpi], [zipName, zip], [windowsName, windowsZip]].map(([name, data]) => createHash("sha256").update(data).digest("hex") + "  " + name).join("\n") + "\n";
await writeFile("dist/SHA256SUMS.txt", hashes);
console.log(`Created ${xpiName}, ${zipName} and ${windowsName}; private runtime files excluded.`);
