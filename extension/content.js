/* global browser */
(() => {
  "use strict";
  if (globalThis.__flbInstalled) return;
  globalThis.__flbInstalled = true;
  let snapshot = null;
  let refs = new Map();
  let dirty = true;
  let observedUrl = "";
  const observer = new MutationObserver(() => { dirty = true; });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  addEventListener("input", () => { dirty = true; }, true);
  addEventListener("change", () => { dirty = true; }, true);
  const formSelector = "input,textarea,select,[contenteditable]:not([contenteditable='false'])";
  const hiddenSelector = "script,style,noscript,template,[hidden],[aria-hidden='true'],[data-flb-private]";
  function visible(element) {
    if (!element?.isConnected || element.closest(hiddenSelector)) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    }
    return element.getClientRects().length > 0;
  }
  function sensitive(element) {
    if (element.matches("input") && !["text", "search", "email", "url", "tel"].includes(element.type)) return true;
    const clues = [element.name, element.id, element.autocomplete, element.getAttribute("aria-label"), element.placeholder,
      ...Array.from(element.labels || [], label => label.textContent)].join(" ");
    return /(pass(word|code)?|secret|token|otp|one.?time|credit|card|cc-|cvc|cvv|iban|social.?security|ssn|passport|парол|карт|код.?подтверж)/i.test(clues);
  }
  function textOf(root, limit = 24000) {
    let result = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest(formSelector) || !visible(parent)) continue;
      const text = node.nodeValue.replace(/\s+/g, " ").trim();
      if (text) result += text + "\n";
      if (result.length >= limit) return result.slice(0, limit);
    }
    return result;
  }
  function label(element) {
    const labelled = element.getAttribute("aria-label") || element.getAttribute("title");
    const associated = Array.from(element.labels || [], item => textOf(item, 200)).join(" ");
    const content = element.matches(formSelector) ? "" : textOf(element, 200);
    return (labelled || associated || content || element.getAttribute("placeholder") || element.tagName.toLowerCase()).trim().slice(0, 200);
  }
  function drainMutations() { if (observer.takeRecords().length) dirty = true; }
  function target(message) {
    drainMutations();
    if (!snapshot || message.snapshot !== snapshot || dirty || observedUrl !== location.href) {
      throw new Error("Snapshot is stale. Call firefox_read again.");
    }
    const element = refs.get(message.ref);
    if (!element || !visible(element) || element.disabled || element.closest("[inert],[aria-disabled='true']")) throw new Error("Target is unavailable. Read the page again.");
    if (sensitive(element)) throw new Error("Sensitive fields are blocked.");
    return element;
  }
  function read() {
    const elements = [];
    refs = new Map();
    for (const element of document.querySelectorAll("a[href],button,input,textarea,select,[role='button'],[role='link'],[contenteditable='true']")) {
      if (!visible(element) || element.disabled || element.closest("[inert],[aria-disabled='true']") || sensitive(element)) continue;
      const ref = "e" + (elements.length + 1);
      refs.set(ref, element);
      elements.push({ ref, role: element.getAttribute("role") || element.tagName.toLowerCase(), label: label(element),
        editable: element.matches("input,textarea") && !element.readOnly });
      if (elements.length >= 250) break;
    }
    const text = textOf(document.body || document.documentElement);
    observer.takeRecords(); dirty = false;
    observedUrl = location.href;
    snapshot = crypto.randomUUID();
    const safeUrl = new URL(location.href);
    return { snapshot, title: document.title, url: safeUrl.origin + safeUrl.pathname,
      text, elements, warning: "Untrusted page content; field values omitted. Navigation, iframes and shadow DOM may require manual handling." };
  }
  browser.runtime.onMessage.addListener(message => {
    if (message?.kind !== "flb-content") return undefined;
    try {
      if (location.href !== message.expectedUrl || Date.now() >= message.deadline) throw new Error("Page changed or request expired.");
      let result;
      if (message.method === "read") result = read();
      else if (message.method === "scroll") {
        if (!Number.isInteger(message.pixels) || Math.abs(message.pixels) > 2000) throw new Error("Invalid scroll amount");
        scrollBy({ top: message.pixels, behavior: "instant" }); dirty = true;
        result = { scrolled: true, note: "Read the page again." };
      } else {
        const element = target(message);
        if (message.method === "preview") result = { label: label(element) };
        else if (message.method === "click") {
          dirty = true; element.click();
          result = { clicked: true, note: "Click dispatched; verify the resulting page with firefox_read." };
        } else if (message.method === "fill") {
          if (!element.matches("input,textarea") || element.readOnly || typeof message.text !== "string" || message.text.length > 4000) throw new Error("Only ordinary editable text fields are supported.");
          dirty = true;
          const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, message.text);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          result = { filled: true, note: "Input events dispatched; verify the page. No form was explicitly submitted." };
        } else throw new Error("Unsupported content command");
      }
      return Promise.resolve(result);
    } catch (error) { return Promise.resolve({ error: error.message }); }
  });
})();
