import net from "node:net";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { encodeFrame, frameReader } from "./framing.mjs";
import { runtimeDirectory } from "./runtime.mjs";

export async function startBridge({ directory = runtimeDirectory(), timeoutMs = 90000 } = {}) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const endpointPath = path.join(directory, "endpoint.json");
  const lockPath = path.join(directory, "server.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    // Fail closed on uncertain ownership; only reclaim a demonstrably dead process.
    const old = JSON.parse(await readFile(lockPath, "utf8"));
    if (!Number.isInteger(old.pid) || old.pid <= 0) throw new Error("Invalid bridge lock; inspect the runtime directory.");
    try { process.kill(old.pid, 0); throw new Error("Another Firefox Local Bridge MCP session is running. Close it first."); }
    catch (e) { if (e.code !== "ESRCH") throw e; }
    await unlink(lockPath);
    lock = await open(lockPath, "wx", 0o600);
  }
  const instance = randomUUID();
  await lock.writeFile(JSON.stringify({ pid: process.pid, instance }));
  await lock.close();
  const token = randomBytes(32).toString("hex");
  const peers = new Set();
  const pending = new Map();
  let peer = null;
  function failPending(reason) {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(reason)); }
    pending.clear();
  }
  const listener = net.createServer(socket => {
    peers.add(socket);
    let authenticated = false;
    const timer = setTimeout(() => socket.destroy(), 3000);
    socket.on("error", () => {});
    socket.on("close", () => {
      peers.delete(socket); clearTimeout(timer);
      if (peer === socket) { peer = null; failPending("Firefox disconnected; the outcome of an in-flight action may be unknown. Read the page before retrying."); }
    });
    socket.on("data", frameReader(message => {
      if (!authenticated) {
        const supplied = typeof message.token === "string" ? Buffer.from(message.token) : Buffer.alloc(0);
        const expected = Buffer.from(token);
        if (message.type !== "auth" || supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || peer) {
          socket.destroy(); return;
        }
        authenticated = true; clearTimeout(timer); peer = socket;
        socket.write(encodeFrame({ type: "ready", instance }));
        return;
      }
      if (message.type !== "result" || typeof message.id !== "string") return;
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(String(message.error).slice(0, 1000)));
      else item.resolve(message.result);
    }, () => socket.destroy()));
  });
  try {
    await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
    const endpoint = await open(endpointPath, "w", 0o600);
    await endpoint.writeFile(JSON.stringify({ port: listener.address().port, token, pid: process.pid, instance }));
    await endpoint.close();
  } catch (error) { listener.close(); await unlink(lockPath).catch(() => {}); throw error; }
  return {
    connected: () => !!peer,
    request(method, params = {}) {
      if (!peer) return Promise.reject(new Error("Firefox is not connected. Open the extension and enable a session."));
      if (pending.size >= 8) return Promise.reject(new Error("Too many pending browser requests."));
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          peer?.write(encodeFrame({ type: "cancel", id }));
          reject(new Error("Browser request expired. Check Firefox before retrying; an action outcome may be unknown."));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try { peer.write(encodeFrame({ type: "command", id, method, params, deadline: Date.now() + timeoutMs - 500 })); }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    },
    async close() {
      failPending("Bridge closed");
      for (const socket of peers) socket.destroy();
      await new Promise(resolve => listener.close(resolve));
      try {
        const saved = JSON.parse(await readFile(endpointPath, "utf8"));
        if (saved.instance === instance) await unlink(endpointPath);
        const savedLock = JSON.parse(await readFile(lockPath, "utf8"));
        if (savedLock.instance === instance) await unlink(lockPath);
      } catch { /* Already removed, or belongs to a subsequent instance. */ }
    }
  };
}
