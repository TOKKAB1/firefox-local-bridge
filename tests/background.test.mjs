import test from "node:test";
import assert from "node:assert/strict";
import { harness, waitFor } from "./helpers/background-harness.mjs";
async function fixture(t, mode = "browser") {
  const h = await harness(); t.after(() => h.close());
  assert.equal((await h.popup({ type: "start", mode })).ok, true); h.ready(); return h;
}
test("browser-wide access lists ordinary tabs while private and internal pages remain excluded", async t => {
  const h = await fixture(t);
  h.command({ id: "tabs", method: "tabs" });
  const reply = await waitFor(() => h.results.find(r => r.id === "tabs"));
  assert.deepEqual(Array.from(reply.result.tabs, tab => tab.tabId), [1, 2]);
});
test("private-window access requires both Firefox permission and explicit session opt-in", async t => {
  const h = await harness(); t.after(() => h.close());
  assert.match((await h.popup({ type: "start", mode: "browser", allowPrivate: true })).error, /allow this extension/);
  h.allowPrivate();
  assert.equal((await h.popup({ type: "start", mode: "browser", allowPrivate: true })).ok, true); h.ready();
  h.command({ id: "tabs", method: "tabs" });
  const reply = await waitFor(() => h.results.find(r => r.id === "tabs"));
  assert.deepEqual(Array.from(reply.result.tabs, tab => tab.tabId), [1, 2, 3]);
});
test("click waits for user approval; page messages cannot approve it", async t => {
  const h = await fixture(t);
  h.command({ id: "click", method: "click", params: { tabId: 1, snapshot: "snapshot-1", ref: "e1" } });
  await waitFor(async () => (await h.popup({ type: "state" })).approvals.length);
  assert.equal(h.actions.length, 0);
  await h.listeners.popup({ type: "approval", id: "click", approve: true }, { url: "https://example.org/", tab: { id: 1 } });
  assert.equal(h.actions.length, 0);
  await h.popup({ type: "approval", id: "click", approve: true });
  await waitFor(() => h.results.find(r => r.id === "click"));
  assert.equal(h.actions[0].method, "click");
});
test("stopping, cancelling or rejecting a pending request prevents its execution", async t => {
  const h = await fixture(t);
  for (const decision of ["reject", "cancel", "stop"]) {
    const id = decision;
    h.command({ id, method: "fill", params: { tabId: 1, snapshot: "snapshot-1", ref: "e1", text: "Ada" } });
    await waitFor(async () => (await h.popup({ type: "state" })).approvals.length);
    if (decision === "reject") await h.popup({ type: "approval", id, approve: false });
    if (decision === "cancel") h.cancel(id);
    if (decision === "stop") await h.popup({ type: "stop" });
    if (decision !== "stop") await waitFor(() => h.results.find(r => r.id === id));
    assert.equal(h.actions.length, 0);
  }
  assert.equal((await h.popup({ type: "state" })).session, null);
});
test("changed URL invalidates an approved action before it can execute", async t => {
  const h = await fixture(t);
  h.command({ id: "click", method: "click", params: { tabId: 1, snapshot: "snapshot-1", ref: "e1" } });
  await waitFor(async () => (await h.popup({ type: "state" })).approvals.length);
  h.tabs[0].url = "https://other.example/new";
  await h.popup({ type: "approval", id: "click", approve: true });
  const reply = await waitFor(() => h.results.find(r => r.id === "click"));
  assert.match(reply.error, /Page changed/); assert.equal(h.actions.length, 0);
});
test("tab navigation revokes the tab grant; stale queued commands cannot enter a new session", async t => {
  const h = await fixture(t, "tab");
  h.command({ id: "pending", method: "click", params: { tabId: 1, snapshot: "snapshot-1", ref: "e1" } });
  h.command({ id: "queued", method: "scroll", params: { tabId: 1, pixels: 20 } });
  await waitFor(async () => (await h.popup({ type: "state" })).approvals.length);
  h.listeners.tabUpdated(1, { status: "loading" });
  await h.popup({ type: "start", mode: "browser" }); h.ready();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.actions.length, 0);
});
