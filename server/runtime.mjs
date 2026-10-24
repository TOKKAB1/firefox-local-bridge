import os from "node:os";
import path from "node:path";
export const EXTENSION_ID = "firefox-local-bridge@local.invalid";
export const HOST_NAME = "org.firefox_local_bridge";
export function runtimeDirectory() {
  return process.env.FLB_RUNTIME_DIR || path.join(
    process.platform === "win32" ? (process.env.LOCALAPPDATA || os.homedir()) : path.join(os.homedir(), ".local", "state"),
    ...(process.platform === "win32" ? ["OpenAI", "FirefoxLocalBridge", "runtime"] : ["FirefoxLocalBridge", "runtime"])
  );
}
