import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const sandbox = { URL };
vm.runInNewContext(await readFile(new URL("../extension/policy.js", import.meta.url), "utf8"), sandbox);
const policy = sandbox.FLBPolicy;
const page = { id: 7, url: "https://example.org/page", incognito: false };
const session = { mode: "tab", tabId: 7, url: page.url, expiresAt: 2000 };
test("tab grants fail closed after expiry, navigation, or switching tabs", () => {
  assert.equal(policy.authorize(session, page, 1000), true);
  assert.throws(() => policy.authorize(null, page, 1000));
  assert.throws(() => policy.authorize(session, page, 2000));
  assert.throws(() => policy.authorize(session, { ...page, id: 8 }, 1000));
  assert.throws(() => policy.authorize(session, { ...page, url: "https://example.org/other" }, 1000));
});
test("browser scope is opt-in; private scope requires its own session switch", () => {
  const browser = { mode: "browser", expiresAt: 2000, allowPrivate: false };
  assert.equal(policy.authorize(browser, { ...page, id: 8 }, 1000), true);
  assert.throws(() => policy.authorize(browser, { ...page, incognito: true }, 1000));
  assert.equal(policy.authorize({ ...browser, allowPrivate: true }, { ...page, incognito: true }, 1000), true);
});
test("internal, local files, JavaScript, extension and credential-bearing URLs are rejected", () => {
  for (const url of ["about:config", "file:///C:/secret", "javascript:alert(1)", "moz-extension://abc/x", "https://user:pass@example.org/"]) {
    assert.equal(policy.eligible({ ...page, url }, true), false, url);
  }
  assert.equal(policy.redactUrl("https://example.org/page?token=secret#code"), page.url);
});
