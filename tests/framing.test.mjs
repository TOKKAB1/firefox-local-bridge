import test from "node:test";
import assert from "node:assert/strict";
import { encodeFrame, frameReader, MAX_FRAME } from "../server/framing.mjs";
test("native frames survive fragmented UTF-8 messages and concatenation", () => {
  const output = [], errors = [];
  const reader = frameReader(item => output.push(item), error => errors.push(error));
  const bytes = Buffer.concat([encodeFrame({ text: "Привет / Bună" }), encodeFrame({ done: true })]);
  for (const byte of bytes) reader(Buffer.from([byte]));
  assert.deepEqual(output, [{ text: "Привет / Bună" }, { done: true }]);
  assert.equal(errors.length, 0);
});
test("oversized, invalid JSON and non-object frames are rejected before execution", () => {
  for (const bytes of [Buffer.from([0, 0, 0, 0]), Buffer.from([255, 255, 255, 127]), Buffer.from([1, 0, 0, 0, 33]), Buffer.from([2, 0, 0, 0, 91, 93])]) {
    let errors = 0, calls = 0;
    const reader = frameReader(() => calls++, () => errors++);
    reader(bytes); reader(encodeFrame({ later: true }));
    assert.equal(errors, 1); assert.equal(calls, 0);
  }
  assert.throws(() => encodeFrame({ text: "x".repeat(MAX_FRAME) }));
});
