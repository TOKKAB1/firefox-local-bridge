/* Shared with unit tests; no browser privileges in this file. */
globalThis.FLBPolicy = Object.freeze({
  expiry(minutes = 15, now = Date.now()) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 525600) throw new Error("Choose 1–525600 minutes, or 0 for access until stopped.");
    return minutes === 0 ? null : now + minutes * 60000;
  },
  expired(session, now = Date.now()) {
    return !session || (session.expiresAt !== null && (!Number.isFinite(session.expiresAt) || now >= session.expiresAt));
  },
  eligible(tab, allowPrivate = false) {
    if (!tab || (tab.incognito && !allowPrivate) || !Number.isInteger(tab.id)) return false;
    try {
      const url = new URL(tab.url);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  },
  authorize(session, tab, now = Date.now()) {
    if (this.expired(session, now)) throw new Error("Session expired. Enable access in the Firefox popup.");
    if (!this.eligible(tab, session.allowPrivate)) throw new Error("This page or private window is outside the enabled scope.");
    if (session.mode !== "browser" && (session.tabId !== tab.id || session.url !== tab.url)) {
      throw new Error("This page is outside the approved tab session. Enable access again.");
    }
    return true;
  },
  redactUrl(value) {
    try { const u = new URL(value); return u.origin + u.pathname; } catch { return "Unavailable page"; }
  }
});
