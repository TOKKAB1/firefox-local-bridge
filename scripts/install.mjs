import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { HOST_NAME, EXTENSION_ID, runtimeDirectory } from "../server/runtime.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const installed = path.join(root, ".installed");
const manifestPath = path.join(installed, HOST_NAME + ".json");
const registryKey = "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\" + HOST_NAME;
const dryRun = process.argv.includes("--dry-run");
const remove = process.argv.includes("--uninstall");
if (process.platform !== "win32" && !dryRun) throw new Error("This installer currently supports Windows only. See docs/ARCHITECTURE.md for porting.");
if (/[%!\r\n"]/.test(root + process.execPath)) throw new Error("Move the project and Node.js to paths without percent, exclamation, quote, or newline characters.");
if (dryRun) {
  console.log(JSON.stringify({ root, node: process.execPath, manifestPath, registryKey, action: remove ? "uninstall" : "install", globalAssistantConfigChanged: false }, null, 2));
  process.exit(0);
}
// reg.exe prints in the console code page, which corrupts non-ASCII paths
// when decoded as UTF-8. Query via an explicitly UTF-8 JSON channel instead.
const registryQuery = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $flbItem = Get-Item -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software\\Mozilla\\NativeMessagingHosts\\" + HOST_NAME + "' -ErrorAction SilentlyContinue; if ($null -eq $flbItem) { 'null' } else { ConvertTo-Json -Compress -InputObject $flbItem.GetValue('') }";
const queryOutput = execFileSync(path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", registryQuery], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const existing = JSON.parse(queryOutput.trim()) || "";
if (existing && existing.toLowerCase() !== manifestPath.toLowerCase()) {
  throw new Error("A different installation owns this native host. Uninstall it first; it will not be overwritten.");
}
if (remove) {
  if (existing) execFileSync("reg.exe", ["DELETE", registryKey, "/f"], { windowsHide: true });
  for (const file of [HOST_NAME + ".json", "native-host.cmd", "codex-mcp.toml", "mcp-client.json", "Register-Firefox.reg", "Connection.html"]) {
    await unlink(path.join(installed, file)).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
  console.log("Native host unregistered. Remove the MCP entry in your assistant and remove the Firefox add-on separately. Project files were kept.");
  process.exit(0);
}
await mkdir(installed, { recursive: true });
await mkdir(runtimeDirectory(), { recursive: true, mode: 0o700 });
// Apply an ACL only to our new runtime directory, never to parent/user directories.
const who = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
const sid = who.match(/S-1-5-\d+(?:-\d+)+/)?.[0];
if (!sid) throw new Error("Unable to determine the current Windows user SID.");
execFileSync("icacls.exe", [runtimeDirectory(), "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`, "*S-1-5-18:(OI)(CI)F"], { windowsHide: true, stdio: "pipe" });
const wrapper = path.join(installed, "native-host.cmd");
await writeFile(wrapper, `@echo off\r\nchcp 65001 >nul\r\n"${process.execPath}" "${path.join(root, "server", "native-host.mjs")}" %*\r\n`);
await writeFile(manifestPath, JSON.stringify({
  name: HOST_NAME, description: "Firefox Local Bridge native messaging host",
  path: wrapper, type: "stdio", allowed_extensions: [EXTENSION_ID]
}, null, 2));
const bundle = path.join(root, "app", "server.mjs");
const entry = { command: process.execPath, args: [existsSync(bundle) ? bundle : path.join(root, "server", "index.mjs")] };
await writeFile(path.join(installed, "codex-mcp.toml"), `[mcp_servers.firefox_local_bridge]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\ntool_timeout_sec = 120\n`);
await writeFile(path.join(installed, "mcp-client.json"), JSON.stringify({ mcpServers: { firefox_local_bridge: entry } }, null, 2));
// MSIX can isolate registry writes from its child processes. Import this file
// manually from Explorer when Firefox cannot see a registration made in-app.
const regFile = 'Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\Mozilla\\NativeMessagingHosts\\' + HOST_NAME + ']\r\n@=' + JSON.stringify(manifestPath) + '\r\n';
await writeFile(path.join(installed, "Register-Firefox.reg"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regFile, "utf16le")]));
execFileSync("reg.exe", ["ADD", registryKey, "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"], { windowsHide: true, stdio: "pipe" });
console.log("Installed for the current Windows user. No administrator account needed.");
console.log("Next: load extension/manifest.json in Firefox about:debugging, then add the MCP server in your assistant.");
console.log("Generated connection settings: " + path.join(installed, "codex-mcp.toml"));
console.log("Existing assistant settings have NOT been edited.");
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
await writeFile(path.join(installed, "Connection.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Firefox Local Bridge — connection</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:50px auto;padding:24px;background:#15212e;color:#edf2f8}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;background:#213244;border-radius:12px}a{color:#85dbc2}</style><h1>Your connection settings / Setările conexiunii</h1><p>Firefox: choose Load Temporary Add-on and select this file:</p><pre>' + escapeHtml(path.join(root, 'extension', 'manifest.json')) + '</pre><p>Codex is configured by Setup-Windows.cmd. For another MCP client, use STDIO with these values:</p><pre>Command: ' + escapeHtml(entry.command) + '\nArgument: ' + escapeHtml(entry.args[0]) + '\nTool timeout: 120 seconds</pre><p>If Firefox reports No such native application, import <a href="Register-Firefox.reg">Register-Firefox.reg</a> yourself from Windows Explorer, then restart your assistant.</p><p><a href="../START-HERE.html">Back to the guide / Înapoi la ghid</a></p></html>');
console.log("If Firefox reports No such native application after in-app setup, import .installed/Register-Firefox.reg yourself from Windows Explorer, then restart the MCP server.");
