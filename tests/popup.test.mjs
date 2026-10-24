import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { waitFor } from "./helpers/background-harness.mjs";
async function popup(t, preferences = {}) {
  const html = await readFile(new URL("../extension/popup.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: "https://extension.invalid/popup.html", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const state = { connected: false, session: null, error: "", approvals: [] };
  const calls = [];
  const stored = { preferences };
  dom.window.browser = {
    i18n: { getUILanguage: () => "en-US" },
    storage: { local: { async get() { return stored; }, async set(value) { Object.assign(stored, value); } } },
    permissions: { async request() { return true; } },
    runtime: { async sendMessage(message) {
      calls.push(message);
      if (message.type === "start") { state.session = { mode: message.mode, allowPrivate: message.allowPrivate, expiresAt: message.minutes === 0 ? null : Date.now() + message.minutes * 60000 }; state.connected = true; return { ok: true }; }
      if (message.type === "duration") { state.session.expiresAt = message.minutes === 0 ? null : Date.now() + message.minutes * 60000; return { ok: true }; }
      if (message.type === "stop") { state.session = null; state.connected = false; return { ok: true }; }
      return state;
    } }
  };
  for (const file of ["strings.js", "popup.js"]) dom.window.eval(await readFile(new URL("../extension/" + file, import.meta.url), "utf8"));
  await waitFor(() => calls.some(call => call.type === "state"));
  const $ = id => dom.window.document.getElementById(id);
  const change = id => $(id).dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  return { dom, $, change, calls, stored, state };
}
test("popup restores language and duration but never restores access or private scope", async t => {
  const h = await popup(t, { language: "ro", minutes: 0, mode: "browser", allowPrivate: true });
  assert.equal(h.dom.window.document.documentElement.lang, "ro");
  assert.equal(h.$("duration").value, "0");
  assert.equal(h.$("access").checked, false);
  assert.equal(h.$("private").checked, false);
  h.$("access").checked = true; h.change("access");
  await waitFor(() => h.calls.find(call => call.type === "start"));
  await waitFor(() => h.$("details").textContent.includes("Fără cronometru"));
  assert.equal(h.state.session.expiresAt, null);
});
test("custom hour/day selections are sent as exact minutes and applied during a session", async t => {
  const h = await popup(t);
  h.$("duration").value = "custom"; h.change("duration");
  assert.equal(h.$("custom-duration").hidden, false);
  h.$("amount").value = "2"; h.$("unit").value = "60";
  h.$("access").checked = true; h.change("access");
  const start = await waitFor(() => h.calls.find(call => call.type === "start"));
  assert.equal(start.minutes, 120);
  await waitFor(() => !h.$("apply-duration").hidden);
  h.$("amount").value = "3"; h.$("unit").value = "1440";
  h.$("apply-duration").click();
  const changed = await waitFor(() => h.calls.find(call => call.type === "duration"));
  assert.equal(changed.minutes, 4320);
});
test("approval reasons remain text and all popup languages cover the same keys", async t => {
  const h = await popup(t);
  h.state.approvals = [{ id: "request", action: "duration", minutes: 60, reason: "<img src=x onerror=alert(1)>" }];
  await waitFor(() => h.$("approvals").textContent.includes("<img"));
  assert.equal(h.$("approvals").querySelector("img"), null);
  const strings = h.dom.window.FLBStrings;
  for (const lang of ["ro", "ru"]) assert.deepEqual(Object.keys(strings[lang]).sort(), Object.keys(strings.en).sort());
});
