import vm from "node:vm";
import { readFile } from "node:fs/promises";
export async function harness({ nativeFactory } = {}) {
  let clockOffset = 0;
  class Clock extends Date { static now() { return Date.now() + clockOffset; } }
  const timerDelays = [];
  const listeners = {};
  const results = [];
  let nativeListener, disconnectListener;
  let privatePermission = false;
  const tabs = [
    { id: 1, url: "https://example.org/demo", title: "Demo", incognito: false, active: true },
    { id: 2, url: "https://other.example/", title: "Other", incognito: false },
    { id: 3, url: "https://private.example/", title: "Private", incognito: true },
    { id: 4, url: "about:config", title: "Settings", incognito: false }
  ];
  const actions = [];
  const events = name => ({ addListener(fn) { listeners[name] = fn; } });
  const port = {
    onMessage: { addListener(fn) { nativeListener = fn; } },
    onDisconnect: { addListener(fn) { disconnectListener = fn; } },
    postMessage(message) { results.push(message); },
    disconnect() { disconnectListener?.(); }
  };
  const popupUrl = "moz-extension://test/popup.html";
  const browser = {
    browserAction: { async setBadgeText() {}, async setBadgeBackgroundColor() {}, async setTitle() {} },
    runtime: { getURL(file) { return "moz-extension://test/" + file; },
      onMessage: events("popup"), connectNative() { return nativeFactory ? nativeFactory() : port; } },
    extension: { async isAllowedIncognitoAccess() { return privatePermission; } },
    permissions: { async contains() { return true; }, onRemoved: events("permissionRemoved") },
    tabs: {
      async query(query) { return query.active ? [tabs[0]] : tabs; },
      async get(id) { const tab = tabs.find(t => t.id === id); if (!tab) throw new Error("Unknown tab"); return tab; },
      async executeScript() {},
      async sendMessage(id, message) {
        if (message.method === "read") return { snapshot: "snapshot-1", text: "Demo text", elements: [{ ref: "e1", label: "Continue" }] };
        if (message.method === "preview") return { label: "Continue" };
        actions.push({ id, method: message.method }); return { done: true };
      },
      async update(id, data) { actions.push({ id, method: "navigate", url: data.url }); },
      onRemoved: events("tabRemoved"), onUpdated: events("tabUpdated")
    }
  };
  const context = vm.createContext({ browser, URL, setTimeout(fn, delay) { timerDelays.push(delay); return setTimeout(fn, delay); }, clearTimeout, Date: Clock, console });
  for (const file of ["policy.js", "background.js"]) vm.runInContext(await readFile(new URL("../../extension/" + file, import.meta.url), "utf8"), context);
  const popup = message => listeners.popup(message, { url: popupUrl });
  return { popup, results, actions, tabs, listeners, timerDelays,
    advanceTime(milliseconds) { clockOffset += milliseconds; },
    ready() { nativeListener?.({ type: "ready" }); },
    command(message) { nativeListener({ type: "command", params: {}, deadline: Date.now() + 5000, ...message }); },
    cancel(id) { nativeListener({ type: "cancel", id }); },
    allowPrivate() { privatePermission = true; },
    async close() { await popup({ type: "stop" }); }
  };
}
export async function waitFor(fn, timeout = 2500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Test condition timed out");
}
