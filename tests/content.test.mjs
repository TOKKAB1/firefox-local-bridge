import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const code = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
function setup() {
  const dom = new JSDOM(`<!doctype html><title>Demo</title><body><h1>Demo page</h1><p>Visible text</p><div hidden>HIDDEN_SECRET</div><div style="display:none"><p>CSS_SECRET</p></div><script>INJECTED_SECRET</script><label for="name">Name</label><input id="name" value="FIELD_SECRET"><label for="password">Password</label><input id="password" type="password" value="PASSWORD_SECRET"><label for="otp">One-time code</label><input id="otp"><textarea>TEXTAREA_SECRET</textarea><div contenteditable="true">EDITOR_SECRET</div><button id="go">Continue</button></body>`, { url: "https://example.org/demo?token=SECRET", runScripts: "outside-only", pretendToBeVisual: true });
  let listener;
  Object.defineProperty(dom.window.HTMLElement.prototype, "getClientRects", { value() { return [{}]; } });
  dom.window.browser = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  dom.window.eval(code);
  const call = message => listener({ kind: "flb-content", expectedUrl: dom.window.location.href, deadline: Date.now() + 10000, ...message });
  return { dom, call };
}
test("page reads omit form values, hidden text, scripts and sensitive controls", async () => {
  const { dom, call } = setup();
  try {
    const result = await call({ method: "read" });
    const text = JSON.stringify(result);
    assert.match(text, /Visible text/);
    for (const secret of ["HIDDEN_SECRET", "CSS_SECRET", "INJECTED_SECRET", "FIELD_SECRET", "PASSWORD_SECRET", "TEXTAREA_SECRET", "EDITOR_SECRET", "?token="]) assert.ok(!text.includes(secret), secret);
    assert.ok(!result.elements.some(e => /Password|One-time/.test(e.label)));
  } finally { dom.window.close(); }
});
test("approved snapshot references work once and reject changed DOMs", async () => {
  const { dom, call } = setup();
  try {
    const first = await call({ method: "read" });
    const field = first.elements.find(e => e.label === "Name");
    assert.ok(field);
    let events = 0;
    dom.window.document.getElementById("name").addEventListener("input", () => events++);
    const filled = await call({ method: "fill", snapshot: first.snapshot, ref: field.ref, text: "Ada" });
    assert.equal(filled.filled, true); assert.equal(events, 1);
    assert.equal(dom.window.document.getElementById("name").value, "Ada");
    assert.match((await call({ method: "click", snapshot: first.snapshot, ref: field.ref })).error, /stale/);
    const second = await call({ method: "read" });
    dom.window.document.getElementById("go").textContent = "Different action";
    assert.match((await call({ method: "click", snapshot: second.snapshot, ref: second.elements.find(e => e.label === "Continue").ref })).error, /stale/);
  } finally { dom.window.close(); }
});
test("deadline and exact URL checks prevent stale delivery", async () => {
  const { dom, call } = setup();
  try {
    assert.match((await call({ method: "read", deadline: Date.now() - 1 })).error, /expired/);
    assert.match((await call({ method: "read", expectedUrl: "https://other.example/" })).error, /changed/);
  } finally { dom.window.close(); }
});
