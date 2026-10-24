import { build } from "esbuild";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
await mkdir("dist/build", { recursive: true });
const result = await build({ entryPoints: ["server/index.mjs"], outfile: "dist/build/server.mjs", bundle: true, platform: "node", format: "esm", target: "node22", metafile: true, legalComments: "linked", banner: { js: "import { createRequire as flbCreateRequire } from 'node:module'; const require = flbCreateRequire(import.meta.url);" } });
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  let directory = path.dirname(path.resolve(input));
  while (directory !== path.dirname(directory)) {
    try {
      const meta = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      if (meta.name && meta.version) { packages.set(meta.name + "@" + meta.version, directory); break; }
    } catch { /* Ascend to the package root. */ }
    directory = path.dirname(directory);
  }
}
let notices = "Third-party packages included in the prebuilt MCP server.\n\n";
for (const [name, directory] of packages) {
  notices += "\n===== " + name + " =====\n";
  const licenses = (await readdir(directory)).filter(file => /^(license|copying|notice)(\.|$)/i.test(file));
  if (!licenses.length) {
    const meta = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    notices += "License declared by package: " + JSON.stringify(meta.license) + "\n";
  }
  for (const file of licenses) notices += await readFile(path.join(directory, file), "utf8") + "\n";
}
await writeFile("dist/build/THIRD-PARTY-NOTICES.txt", notices);
console.log("Bundled the MCP server and third-party notices; no dependency installation is needed in the Windows release.");
