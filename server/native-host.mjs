import net from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { encodeFrame, frameReader } from "./framing.mjs";
import { runtimeDirectory, EXTENSION_ID } from "./runtime.mjs";

// Firefox supplies its manifest path and extension ID. Tests exercise this real entry point.
if (process.argv[3] !== EXTENSION_ID) {
  console.error("Native host must be launched by the registered Firefox extension.");
  process.exit(1);
}
let socket;
let ending = false;
function stop(message) {
  if (ending) return;
  ending = true;
  if (message) {
    console.error(message);
    process.stdout.write(encodeFrame({ type: "hostError", error: message }));
  }
  socket?.destroy();
  process.stdin.destroy();
}
try {
  const endpoint = JSON.parse(await readFile(path.join(runtimeDirectory(), "endpoint.json"), "utf8"));
  if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535 || !/^[a-f0-9]{64}$/.test(endpoint.token)) {
    throw new Error("Invalid runtime endpoint");
  }
  socket = net.createConnection({ host: "127.0.0.1", port: endpoint.port });
  socket.setTimeout(5000);
  socket.on("timeout", () => stop("MCP bridge connection timed out."));
  socket.on("connect", () => socket.write(encodeFrame({ type: "auth", token: endpoint.token })));
  let ready = false;
  socket.on("data", frameReader(message => {
    if (message.type === "ready") { ready = true; socket.setTimeout(0); }
    if (ready) process.stdout.write(encodeFrame(message));
  }, () => stop("Invalid message from MCP bridge.")));
  socket.on("error", () => stop("Cannot connect to the MCP session. Start Firefox Local Bridge in your assistant first."));
  socket.on("close", () => stop());
  process.stdin.on("data", frameReader(message => {
    if (!ready || message.type !== "result") return;
    socket.write(encodeFrame(message));
  }, () => stop("Invalid native message.")));
  process.stdin.on("end", () => stop());
  process.stdout.on("error", () => stop());
} catch {
  stop("MCP session is unavailable. Start Firefox Local Bridge in your assistant, then enable access again.");
}
