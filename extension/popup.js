/* global browser, FLBStrings */
"use strict";
const $ = id => document.getElementById(id);
let busy = false, localError = "", approvalSignature = "", language = "en";
const tr = key => FLBStrings[language][key] || FLBStrings.en[key] || key;
function translate() {
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = tr(node.dataset.i18n);
  approvalSignature = "";
}
function durationMinutes() {
  if ($("duration").value === "custom" && !Number.isInteger(Number($("amount").value))) throw new Error(tr("invalid"));
  const value = $("duration").value === "custom" ? Number($("amount").value) * Number($("unit").value) : Number($("duration").value);
  if (!Number.isInteger(value) || value < 0 || value > 525600 || ($("duration").value === "custom" && value < 1)) throw new Error(tr("invalid"));
  return value;
}
function chooseDuration(minutes) {
  if ([0, 15, 60, 240, 1440].includes(minutes)) $("duration").value = String(minutes);
  else { $("duration").value = "custom"; $("amount").value = minutes; $("unit").value = "1"; }
  $("custom-duration").hidden = $("duration").value !== "custom";
}
async function savePreferences() {
  await browser.storage.local.set({ preferences: { language, minutes: durationMinutes(), mode: $("mode").value } });
}
const describeDuration = minutes => minutes === 0 ? tr("manual") : minutes + " " + tr("minutes").toLowerCase();
async function refresh() {
  if (busy) return;
  try {
    const state = await browser.runtime.sendMessage({ type: "state" });
    $("access").checked = !!state.session;
    $("mode").disabled = !!state.session; $("private").disabled = !!state.session;
    $("apply-duration").hidden = !state.session;
    if (state.session) { $("mode").value = state.session.mode; $("private").checked = state.session.allowPrivate; }
    $("dot").classList.toggle("on", state.connected);
    $("status").textContent = tr(state.connected ? "on" : state.session ? "connecting" : "off");
    $("details").textContent = !state.session ? tr("inactive") : state.session.expiresAt === null ? tr("indefinite") : tr("expires") + new Date(state.session.expiresAt).toLocaleString(language);
    $("error").textContent = state.error || localError;
    const signature = language + JSON.stringify(state.approvals);
    if (signature !== approvalSignature) {
      approvalSignature = signature; $("approvals").replaceChildren();
      for (const item of state.approvals) {
        const card = document.createElement("article"); card.className = "approval";
        const heading = document.createElement("h2"); heading.textContent = tr(item.action === "duration" ? "durationApproval" : "approval");
        const preview = document.createElement("pre");
        preview.textContent = item.action === "duration" ? tr("requested") + describeDuration(item.minutes) + "\n" + tr("reason") + item.reason : [tr(item.action), item.page, item.target, item.destination, item.text !== undefined ? tr("text") + item.text : null].filter(v => v != null).join("\n");
        const yes = document.createElement("button"); yes.textContent = tr("allow");
        const no = document.createElement("button"); no.className = "reject"; no.textContent = tr("reject");
        const answer = async approve => {
          yes.disabled = no.disabled = true;
          try { await browser.runtime.sendMessage({ type: "approval", id: item.id, approve }); await refresh(); }
          catch (error) { localError = error.message; }
        };
        yes.addEventListener("click", () => answer(true)); no.addEventListener("click", () => answer(false));
        card.append(heading, preview, yes, no); $("approvals").append(card);
      }
    }
  } catch (error) { $("error").textContent = error.message; }
}
$("duration").addEventListener("change", () => { $("custom-duration").hidden = $("duration").value !== "custom"; });
$("language").addEventListener("change", async () => {
  language = $("language").value; translate();
  try { await savePreferences(); } catch (error) { localError = error.message; }
  await refresh();
});
$("apply-duration").addEventListener("click", async () => {
  try {
    localError = "";
    const response = await browser.runtime.sendMessage({ type: "duration", minutes: durationMinutes() });
    if (response?.error) throw new Error(response.error);
    await savePreferences();
  } catch (error) { localError = error.message; }
  await refresh();
});
$("access").addEventListener("change", async () => {
  if (busy) return;
  busy = true; localError = ""; $("access").disabled = true;
  try {
    if (!$("access").checked) await browser.runtime.sendMessage({ type: "stop" });
    else {
      if ($("mode").value === "browser") {
        const allowed = await browser.permissions.request({ permissions: ["tabs"], origins: ["http://*/*", "https://*/*"] });
        if (!allowed) throw new Error(tr("denied"));
      }
      const response = await browser.runtime.sendMessage({ type: "start", mode: $("mode").value, allowPrivate: $("private").checked, minutes: durationMinutes() });
      if (response?.error) throw new Error(response.error);
      await savePreferences();
    }
  } catch (error) { localError = error.message; $("error").textContent = localError; $("access").checked = false; }
  finally { busy = false; $("access").disabled = false; }
  await refresh();
});
async function initialize() {
  try {
    const saved = (await browser.storage.local.get("preferences")).preferences;
    const detected = browser.i18n.getUILanguage().split("-")[0];
    language = saved?.language in FLBStrings ? saved.language : detected in FLBStrings ? detected : "en";
    $("language").value = language; translate();
    chooseDuration(Number.isInteger(saved?.minutes) && saved.minutes >= 0 && saved.minutes <= 525600 ? saved.minutes : 15);
    if (["browser", "tab"].includes(saved?.mode)) $("mode").value = saved.mode;
  } catch { translate(); }
  await refresh(); setInterval(refresh, 800);
}
void initialize();
