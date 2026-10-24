/* global browser, FLBPolicy */
"use strict";
const HOST = "org.firefox_local_bridge";
let session = null;
let port = null;
let connected = false;
let lastError = "";
let expiryTimer = null;
const approvals = new Map();
const running = new Set();
let commandQueue = Promise.resolve();

function badge(text, color = "#d77925") {
  browser.browserAction.setBadgeText({ text }).catch(() => {});
  browser.browserAction.setBadgeBackgroundColor({ color }).catch(() => {});
}
function sessionValid() {
  if (session && FLBPolicy.expired(session)) stop("Session expired.");
  return session;
}
function setDuration(minutes) {
  const expiresAt = FLBPolicy.expiry(minutes);
  if (!sessionValid()) throw new Error("Enable access before changing its duration.");
  clearTimeout(expiryTimer);
  session.expiresAt = expiresAt;
  function arm() {
    if (!session || session.expiresAt === null) return;
    const delay = session.expiresAt - Date.now();
    if (delay <= 0) { stop("Session expired."); return; }
    expiryTimer = setTimeout(arm, Math.min(delay, 2147483647));
  }
  arm();
  return { expiresAt, minutes };
}
function stop(reason = "Access stopped.") {
  session = null; connected = false; lastError = reason;
  running.clear();
  clearTimeout(expiryTimer);
  for (const item of approvals.values()) { clearTimeout(item.timer); item.reject(new Error(reason)); }
  approvals.clear();
  if (port) { const old = port; port = null; old.disconnect(); }
  badge("");
}
function validCommand(command) {
  if (!sessionValid() || command.sessionRef !== session || !connected || Date.now() >= command.deadline) throw new Error("Request or browser session expired.");
  if (!running.has(command.id)) throw new Error("Request cancelled.");
}
async function approvedTab(id) {
  const tab = await browser.tabs.get(id);
  FLBPolicy.authorize(sessionValid(), tab);
  return tab;
}
async function content(tab, command) {
  validCommand(command);
  await browser.tabs.executeScript(tab.id, { file: "content.js", frameId: 0 });
  validCommand(command);
  return browser.tabs.sendMessage(tab.id, {
    kind: "flb-content", method: command.method, ...command.params,
    expectedUrl: tab.url, deadline: command.deadline
  }, { frameId: 0 });
}
function askApproval(command, preview) {
  validCommand(command);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      approvals.delete(command.id); badge(session ? "ON" : "");
      reject(new Error("Approval expired. Nothing was approved."));
    }, Math.max(1, command.deadline - Date.now()));
    approvals.set(command.id, { resolve, reject, timer, preview });
    badge("?");
    browser.browserAction.setTitle({ title: "Firefox Local Bridge — approval needed; open this popup" }).catch(() => {});
  });
}
async function execute(command) {
  validCommand(command);
  if (command.method === "requestDuration") {
    FLBPolicy.expiry(command.params.minutes);
    if (typeof command.params.reason !== "string" || !command.params.reason.trim() || command.params.reason.length > 500) throw new Error("A short reason is required.");
    await askApproval(command, { action: "duration", minutes: command.params.minutes, reason: command.params.reason });
    validCommand(command);
    return { approved: true, ...setDuration(command.params.minutes) };
  }
  if (command.method === "tabs") {
    const tabs = await browser.tabs.query({});
    return {
      mode: session.mode, expiresAt: session.expiresAt,
      tabs: tabs.filter(tab => { try { return FLBPolicy.authorize(session, tab); } catch { return false; } })
        .map(tab => ({ tabId: tab.id, title: tab.title || "", url: FLBPolicy.redactUrl(tab.url), active: tab.active }))
    };
  }
  const tab = await approvedTab(command.params.tabId);
  const approvedUrl = tab.url;
  validCommand(command);
  if (["read", "scroll"].includes(command.method)) {
    const response = await content(tab, command);
    if (response?.error) throw new Error(response.error);
    return response;
  }
  if (!["click", "fill", "navigate"].includes(command.method)) throw new Error("Unknown command");
  let preview;
  if (command.method === "navigate") {
    if (session.mode !== "browser") throw new Error("Navigation requires browser mode. In tab mode navigate manually and grant access again.");
    if (!FLBPolicy.eligible({ id: tab.id, url: command.params.url, incognito: false })) throw new Error("Only HTTP(S) URLs without embedded credentials are allowed.");
    preview = { action: "navigate", page: FLBPolicy.redactUrl(tab.url), destination: command.params.url };
  } else {
    const response = await content(tab, { ...command, method: "preview" });
    if (response?.error) throw new Error(response.error);
    preview = { action: command.method, page: FLBPolicy.redactUrl(tab.url), target: response.label, text: command.method === "fill" ? command.params.text : undefined };
  }
  await askApproval(command, preview);
  validCommand(command);
  const fresh = await approvedTab(tab.id);
  if (fresh.url !== approvedUrl) throw new Error("Page changed while awaiting approval. Read again.");
  if (command.method === "navigate") {
    await browser.tabs.update(tab.id, { url: command.params.url });
    return { navigated: true, note: "Read the page after loading. This does not verify the destination's result." };
  }
  const result = await content(fresh, command);
  if (result?.error) throw new Error(result.error);
  return result;
}
async function begin(mode, tab, allowPrivate, minutes = 15) {
  stop("");
  const expiresAt = FLBPolicy.expiry(minutes);
  if (mode !== "tab" && mode !== "browser") throw new Error("Invalid access mode");
  if (allowPrivate && !await browser.extension.isAllowedIncognitoAccess()) throw new Error("First allow this extension in private windows in Firefox Add-ons settings, or turn off the private-windows switch.");
  if (!FLBPolicy.eligible(tab, allowPrivate)) throw new Error("Open an ordinary HTTP(S) page within the selected scope first.");
  if (mode === "browser" && !await browser.permissions.contains({ permissions: ["tabs"], origins: ["http://*/*", "https://*/*"] })) {
    throw new Error("Browser-wide permission was not granted.");
  }
  // Ensure the chosen page is injectable before granting a tab session.
  await browser.tabs.executeScript(tab.id, { file: "content.js", frameId: 0 });
  session = { mode, allowPrivate: allowPrivate === true, tabId: tab.id, url: tab.url, expiresAt };
  setDuration(minutes);
  const current = browser.runtime.connectNative(HOST);
  port = current;
  current.onDisconnect.addListener(() => {
    if (port !== current) return;
    stop(current.error?.message || "Disconnected. Enable access again after starting the MCP session.");
  });
  current.onMessage.addListener(message => {
    if (port !== current) return;
    if (message.type === "ready") { connected = true; lastError = ""; badge("ON", "#217c65"); return; }
    if (message.type === "hostError") { stop(message.error); return; }
    if (message.type === "cancel") {
      running.delete(message.id);
      const item = approvals.get(message.id);
      if (item) { clearTimeout(item.timer); approvals.delete(message.id); item.reject(new Error("Request cancelled")); }
      badge(approvals.size ? "?" : "ON");
      return;
    }
    if (message.type !== "command" || typeof message.id !== "string") return;
    if (running.size >= 8) { current.postMessage({ type: "result", id: message.id, error: "Request queue full" }); return; }
    message.sessionRef = session;
    running.add(message.id);
    const run = async () => {
      try {
        const result = await execute(message);
        if (port === current) current.postMessage({ type: "result", id: message.id, result });
      } catch (error) {
        if (port === current) current.postMessage({ type: "result", id: message.id, error: error.message });
      } finally { running.delete(message.id); }
    };
    commandQueue = commandQueue.then(run, run);
  });
}
browser.runtime.onMessage.addListener(async (message, sender) => {
  // Only the extension's own popup may grant access or approve actions.
  if (sender.tab || sender.url !== browser.runtime.getURL("popup.html")) return undefined;
  if (message?.type === "state") {
    sessionValid();
    return { connected, session: session ? { mode: session.mode, allowPrivate: session.allowPrivate, expiresAt: session.expiresAt } : null,
      error: lastError, approvals: [...approvals.entries()].map(([id, item]) => ({ id, ...item.preview })) };
  }
  if (message?.type === "start") {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      await begin(message.mode, tab, message.allowPrivate === true, message.minutes === undefined ? 15 : message.minutes); return { ok: true };
    } catch (error) { stop(error.message); return { error: error.message }; }
  }
  if (message?.type === "stop") { stop(); return { ok: true }; }
  if (message?.type === "duration") {
    try { return { ok: true, ...setDuration(message.minutes) }; }
    catch (error) { return { error: error.message }; }
  }
  if (message?.type === "approval") {
    const item = approvals.get(message.id);
    if (!item) return { error: "Approval is no longer pending" };
    clearTimeout(item.timer); approvals.delete(message.id);
    if (message.approve === true) item.resolve(); else item.reject(new Error("User rejected the action"));
    badge(approvals.size ? "?" : "ON");
    return { ok: true };
  }
  return undefined;
});
browser.tabs.onRemoved.addListener(id => { if (session?.mode === "tab" && session.tabId === id) stop("Approved tab was closed."); });
browser.tabs.onUpdated.addListener((id, change) => {
  if (session?.mode === "tab" && session.tabId === id && (change.status === "loading" || (change.url && change.url !== session.url))) {
    stop("Tab navigated. Enable access to the new page explicitly.");
  }
});
browser.permissions.onRemoved.addListener(() => stop("Permissions changed. Enable access again."));
