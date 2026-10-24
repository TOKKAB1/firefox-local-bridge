export const MAX_FRAME = 1024 * 1024;

export function encodeFrame(message) {
  const body = Buffer.from(JSON.stringify(message));
  if (!body.length || body.length > MAX_FRAME) throw new Error("Message exceeds frame limit");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}

export function frameReader(onMessage, onError) {
  let buffered = Buffer.alloc(0);
  let failed = false;
  return chunk => {
    if (failed) return;
    try {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 4) {
        const length = buffered.readUInt32LE(0);
        if (length === 0 || length > MAX_FRAME) throw new Error("Invalid frame length");
        if (buffered.length < length + 4) break;
        const value = JSON.parse(buffered.subarray(4, length + 4).toString("utf8"));
        buffered = buffered.subarray(length + 4);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object frame");
        onMessage(value);
      }
      if (buffered.length > MAX_FRAME + 4) throw new Error("Oversized partial frame");
    } catch (error) { failed = true; onError(error); }
  };
}
