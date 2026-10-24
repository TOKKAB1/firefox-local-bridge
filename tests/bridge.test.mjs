import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startBridge } from "../server/bridge.mjs";
import { encodeFrame, frameReader } from "../server/framing.mjs";
import { EXTENSION_ID } from "../server/runtime.mjs";
const native = fileURLToPath(new URL("../server/native-host.mjs", import.meta.url));
async function fixture(t, timeoutMs = 1000) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "flb-bridge-"));
  const bridge = await startBridge({ directory, timeoutMs });
  t.after(async () => { await bridge.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, bridge, endpoint: JSON.parse(await readFile(path.join(directory, "endpoint.json"), "utf8")) };
}
test("unknown peers cannot authenticate or replace the live native host", async t => {
  const { bridge, endpoint } = await fixture(t);
  const attacker = net.createConnection({ host: "127.0.0.1", port: endpoint.port });
  const closed = once(attacker, "close");
  attacker.on("error", () => {});
  attacker.on("connect", () => attacker.write(encodeFrame({ type: "auth", token: "a".repeat(64) })));
  await closed;
  assert.equal(bridge.connected(), false);
  await assert.rejects(bridge.request("tabs"), /not connected/);
});
test("real native process transports commands and correlated responses", async t => {
  const { directory, bridge } = await fixture(t);
  const child = spawn(process.execPath, [native, "test-manifest.json", EXTENSION_ID], { env: { ...process.env, FLB_RUNTIME_DIR: directory }, stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill());
  const ready = new Promise((resolve, reject) => {
    child.stdout.on("data", frameReader(message => {
      if (message.type === "ready") resolve();
      if (message.type === "command") child.stdin.write(encodeFrame({ type: "result", id: message.id, result: { method: message.method, transported: true } }));
    }, reject));
    child.once("error", reject);
  });
  await ready;
  assert.equal(bridge.connected(), true);
  assert.deepEqual(await bridge.request("read", { tabId: 1 }), { method: "read", transported: true });
  const exit = once(child, "exit"); child.stdin.end(); await exit;
});
test("requests time out, signal cancellation and never accept late results", async t => {
  const { bridge, endpoint } = await fixture(t, 80);
  const socket = net.createConnection({ host: "127.0.0.1", port: endpoint.port });
  t.after(() => socket.destroy());
  let cancelled = false;
  const ready = new Promise((resolve, reject) => socket.on("data", frameReader(message => {
    if (message.type === "ready") resolve();
    if (message.type === "cancel") cancelled = true;
  }, reject)));
  socket.on("connect", () => socket.write(encodeFrame({ type: "auth", token: endpoint.token })));
  await ready;
  await assert.rejects(bridge.request("click"), /expired/);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(cancelled, true);
});
test("a second MCP instance cannot take over an existing session", async t => {
  const { directory } = await fixture(t);
  await assert.rejects(startBridge({ directory }), /Another Firefox/);
});
