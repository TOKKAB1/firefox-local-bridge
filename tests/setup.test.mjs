import test from "node:test";
import assert from "node:assert/strict";
import { configureCodex } from "../scripts/codex-config.mjs";
const entry = { command: "C:/Program Files/nodejs/node.exe", args: ["C:/Example/Рабочий стол/bridge/app/server.mjs"] };
test("setup preserves other settings and remains idempotent", () => {
  const before = '# personal settings\nmodel = "example"\n[mcp_servers.other]\ncommand = "other"\n';
  const after = configureCodex(before, entry);
  assert.ok(after.startsWith(before));
  assert.equal(configureCodex(after, entry), after);
  assert.equal((after.match(/\[mcp_servers.firefox_local_bridge\]/g) || []).length, 1);
});
test("updating our section keeps neighboring server and tool settings", () => {
  const before = '[mcp_servers.firefox_local_bridge]\ncommand = "old"\nargs = ["old"]\ntool_timeout_sec = 60\n[mcp_servers.firefox_local_bridge.tools.firefox_read]\napproval_mode = "prompt"\n[mcp_servers.other]\ncommand = "keep"\n';
  const after = configureCodex(before, entry);
  assert.ok(after.includes('tool_timeout_sec = 120'));
  assert.ok(after.includes('[mcp_servers.other]\ncommand = "keep"'));
  assert.ok(after.includes('[mcp_servers.firefox_local_bridge.tools.firefox_read]\napproval_mode = "prompt"'));
});
test("setup refuses ambiguous configs instead of damaging them", () => {
  for (const text of ['[mcp_servers.firefox_local_bridge]\nurl = "https://example.org"\n', '[mcp_servers.firefox_local_bridge]\nargs = [\n"a",\n"b"\n]\n', '[mcp_servers."firefox_local_bridge"]\ncommand = "x"\n']) assert.throws(() => configureCodex(text, entry));
});
