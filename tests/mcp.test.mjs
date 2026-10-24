import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { encodeFrame, frameReader } from "../server/framing.mjs";
import { EXTENSION_ID } from "../server/runtime.mjs";
import { harness, waitFor } from "./helpers/background-harness.mjs";
const entry = process.env.FLB_TEST_ENTRY || fileURLToPath(new URL("../server/index.mjs", import.meta.url));
const native = fileURLToPath(new URL("../server/native-host.mjs", import.meta.url));
test("MCP client → real server → real native process → extension logic → response and approval", { timeout: 15000 }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "flb-mcp-"));
  const env = { ...process.env, FLB_RUNTIME_DIR: directory };
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: "pipe" });
  const client = new Client({ name: "integration-test", version: "1.0.0" });
  let nativeChild;
  t.after(async () => {
    nativeChild?.kill();
    await client.close();
    await rm(directory, { recursive: true, force: true });
  });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  const disconnected = await client.callTool({ name: "firefox_connection", arguments: {} });
  assert.equal(JSON.parse(disconnected.content[0].text).connected, false);
  const invalid = await client.callTool({ name: "firefox_fill", arguments: { tabId: 1, snapshot: "s", ref: "e1", text: "x".repeat(4001) } });
  assert.equal(invalid.isError, true);
  const h = await harness({ nativeFactory() {
    nativeChild = spawn(process.execPath, [native, "test-manifest.json", EXTENSION_ID], { env, stdio: ["pipe", "pipe", "pipe"] });
    const listeners = [];
    nativeChild.stdout.on("data", frameReader(message => listeners.forEach(fn => fn(message)), error => { throw error; }));
    return {
      onMessage: { addListener(fn) { listeners.push(fn); } },
      onDisconnect: { addListener() {} },
      postMessage(message) { nativeChild.stdin.write(encodeFrame(message)); },
      disconnect() { nativeChild.stdin.end(); }
    };
  } });
  t.after(() => h.close());
  await h.popup({ type: "start", mode: "browser" });
  await waitFor(async () => (await h.popup({ type: "state" })).connected);
  const listed = await client.callTool({ name: "firefox_tabs", arguments: {} });
  assert.equal(JSON.parse(listed.content[0].text).tabs.length, 2);
  const read = await client.callTool({ name: "firefox_read", arguments: { tabId: 1 } });
  assert.equal(JSON.parse(read.content[0].text).text, "Demo text");
  const action = client.callTool({ name: "firefox_click", arguments: { tabId: 1, snapshot: "snapshot-1", ref: "e1" } });
  const pending = await waitFor(async () => (await h.popup({ type: "state" })).approvals[0]);
  assert.equal(h.actions.length, 0);
  await h.popup({ type: "approval", id: pending.id, approve: true });
  assert.equal((await action).isError, undefined);
  assert.equal(h.actions[0].method, "click");
  for (const [minutes, approve] of [[60, false], [0, true]]) {
    const proposal = client.callTool({ name: "firefox_request_duration", arguments: { minutes, reason: "Finish the user-requested browser task" } });
    const pendingDuration = await waitFor(async () => (await h.popup({ type: "state" })).approvals[0]);
    assert.equal(pendingDuration.action, "duration");
    await h.popup({ type: "approval", id: pendingDuration.id, approve });
    const outcome = await proposal;
    if (approve) assert.equal(JSON.parse(outcome.content[0].text).expiresAt, null);
    else assert.equal(outcome.isError, true);
  }
});
