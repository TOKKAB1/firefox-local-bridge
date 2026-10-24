import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { harness, waitFor } from "./helpers/background-harness.mjs";
const context = { URL };
vm.runInNewContext(await readFile(new URL("../extension/policy.js", import.meta.url), "utf8"), context);
const policy = context.FLBPolicy;
test("finite and manual durations are explicit; invalid or missing expiry fails closed", () => {
  assert.equal(policy.expiry(60, 1000), 3601000);
  assert.equal(policy.expiry(0, 1000), null);
  assert.equal(policy.expired({ expiresAt: null }, 1e15), false);
  assert.equal(policy.expired({ expiresAt: 1000 }, 1000), true);
  assert.equal(policy.expired({}), true);
  for (const value of [-1, NaN, Infinity, 1.5, 525601, "60", null]) assert.throws(() => policy.expiry(value));
});
test("user chooses any bounded duration and can switch an active session to manual stop", async t => {
  const h = await harness(); t.after(() => h.close());
  assert.equal((await h.popup({ type: "start", mode: "browser", minutes: 180 })).ok, true); h.ready();
  const initial = (await h.popup({ type: "state" })).session.expiresAt;
  assert.ok(initial > Date.now() + 179 * 60000);
  assert.equal((await h.popup({ type: "duration", minutes: 0 })).expiresAt, null);
  h.advanceTime(400 * 86400000);
  assert.equal((await h.popup({ type: "state" })).session.expiresAt, null);
  await h.popup({ type: "stop" });
  assert.equal((await h.popup({ type: "state" })).session, null);
  assert.match((await h.popup({ type: "duration", minutes: 60 })).error, /Enable access/);
});
test("a finite grant expires and long grants avoid the platform timer overflow", async t => {
  const h = await harness(); t.after(() => h.close());
  await h.popup({ type: "start", mode: "browser", minutes: 525600 }); h.ready();
  assert.ok(h.timerDelays.every(delay => delay <= 2147483647));
  h.advanceTime(366 * 86400000);
  assert.equal((await h.popup({ type: "state" })).session, null);
});
test("assistant duration requests wait for user approval; denial and cancellation cannot extend access", async t => {
  const h = await harness(); t.after(() => h.close());
  await h.popup({ type: "start", mode: "browser", minutes: 15 }); h.ready();
  const initial = (await h.popup({ type: "state" })).session.expiresAt;
  for (const [id, decision] of [["deny", false], ["cancel", null], ["allow", true]]) {
    h.command({ id, method: "requestDuration", params: { minutes: 0, reason: "Complete the task requested by the user" } });
    const pending = await waitFor(async () => (await h.popup({ type: "state" })).approvals[0]);
    assert.equal(pending.action, "duration");
    assert.equal((await h.popup({ type: "state" })).session.expiresAt, initial);
    if (decision === null) h.cancel(id); else await h.popup({ type: "approval", id, approve: decision });
    const reply = await waitFor(() => h.results.find(r => r.id === id));
    if (decision === true) { assert.equal(reply.result.approved, true); assert.equal(reply.result.expiresAt, null); }
    else { assert.ok(reply.error); assert.equal((await h.popup({ type: "state" })).session.expiresAt, initial); }
  }
});
