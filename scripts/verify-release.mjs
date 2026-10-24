import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const sums = await readFile("dist/SHA256SUMS.txt", "utf8");
for (const line of sums.trim().split("\n")) {
  const [expected, name] = line.split(/\s+/);
  const bytes = await readFile("dist/" + name);
  if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error("Checksum mismatch: " + name);
}
for (const kind of ["github-source", "windows"]) {
  const archive = unzipSync(await readFile(`dist/firefox-local-bridge-v${pkg.version}-${kind}.zip`));
  const names = Object.keys(archive);
  if (names.some(name => /(^|\/)(\.installed|\.runtime|node_modules|\.git)(\/|$)|\.reg$|\.log$|(^|\/)\.env/.test(name))) throw new Error("Private/generated data in release");
  for (const name of ["START-HERE.html", "Setup-Windows.cmd", "scripts/setup.mjs", "extension/manifest.json", "README.ro.md", "LICENSE"]) {
    if (!archive["firefox-local-bridge/" + name]) throw new Error("Missing " + name + " in " + kind);
  }
  const manifest = JSON.parse(new TextDecoder().decode(archive['firefox-local-bridge/extension/manifest.json']));
  if (manifest.version !== pkg.version) throw new Error("Version mismatch");
  if (kind === "windows" && !archive['firefox-local-bridge/app/server.mjs']) throw new Error("Prebuilt server missing");
  if (kind === "github-source" && !archive['firefox-local-bridge/pnpm-lock.yaml']) throw new Error("Dependency lock missing");
  for (const [name, data] of Object.entries(archive)) {
    const text = new TextDecoder().decode(data);
    if (/C:\\Users\\garda|C:\/Users\/garda|OneDrive\\Рабочий стол\\firefoxmcp/.test(text)) throw new Error("Personal path in " + name);
  }
  console.log(kind + ": structure, version, privacy exclusions and checksums passed (" + names.length + " files).");
}
