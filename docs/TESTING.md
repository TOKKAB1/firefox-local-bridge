# Verification

## Automated

Run `npm run check`, `npm run lint:addon` and `npm test`. Tests use the actual MCP SDK client and server, an actual child native-host process, VM-isolated extension background logic and JSDOM content/popup fixtures. Privileged Firefox APIs are simulated. No personal browser profile is accessed, and no registry entries are installed by tests. After `npm run package`, run `node scripts/verify-release.mjs` and test the bundled entry with `FLB_TEST_ENTRY` pointing at `dist/build/server.mjs`.

Coverage includes fragmented UTF-8 frames, malformed/oversized messages, invalid authentication, duplicate MCP ownership, request expiry/cancellation, read redaction, stale elements, session scopes, incognito opt-in, popup-only consent, navigation races, old-session queued requests and strict MCP argument validation.

`node scripts/install.mjs --dry-run` prints the installer plan without registering anything. The real installer and actual Firefox host launch still require the manual checks below.

## Manual release checklist (pending)

- [ ] On a clean Windows account with Node.js 24, install dependencies and run the tests.
- [ ] Run `Install-Windows.cmd` without administrator privileges; confirm only the named HKCU key and project-owned files are created.
- [ ] Verify the runtime directory is readable only by the current user and SYSTEM (administrators can take ownership).
- [ ] Temporarily load the add-on in normal Firefox. Confirm no broad site permissions are required for single-tab mode.
- [ ] Register the generated local STDIO MCP configuration in the intended Codex/ChatGPT desktop version. Use a 120-second tool timeout. Confirm seven tools are listed in a new chat.
- [ ] Enable access and verify `firefox_connection` reports true after Firefox launches the native host itself.
- [ ] Use a synthetic page: read it, fill a normal input, click a harmless button, scroll, then read the result. Verify popup approval for fill and click.
- [ ] Reject an action, let another expire, disable access during an approval and close the MCP client. Verify no pending action runs afterward.
- [ ] With an action pending, change the page. Approve it and confirm the old action is rejected.
- [ ] Test all-browser mode with two windows and new tabs. Confirm host permission denial does not enable access.
- [ ] Keep Firefox incognito permission off: enabling private scope must fail. Allow it manually, enable private scope and verify a private synthetic tab is included. Disable access, turn private scope off and verify exclusion.
- [ ] Verify restricted `about:`/extension/file pages and protected Firefox domains are inaccessible.
- [ ] Navigate/reload a single-tab grant: access must switch off. In browser mode, navigation must require approval and a fresh read.
- [ ] Restart Firefox and the assistant. Session access must start off. Only one MCP client may own the bridge.
- [ ] Uninstall and confirm another installation's registry entry is never removed.
- [ ] Review current Mozilla signing, review and data-collection requirements before preparing a signed release.

Never substitute automated simulations for these checks in a public release announcement.

## Additional 0.2 acceptance checks (pending live validation)

- [ ] Fresh Windows release: double-click Setup-Windows.cmd from Explorer; dependencies should already be bundled, unrelated MCP settings should remain unchanged, and START-HERE.html should describe the remaining steps.
- [ ] Switch the popup among English, Romanian and Russian. Reopen it and confirm language/scope/duration preferences remain while a browser restart never restores access or private scope.
- [ ] Enable custom minutes, hours and days; shorten/lengthen an active session from the popup. Verify the actual expiry and stop behavior.
- [ ] Choose manual stop and confirm there is no timer, but Stop/disconnect/restart still revoke access.
- [ ] Ask the assistant for a finite duration and manual-stop duration; reject one, cancel one and approve one. Only approval should change the expiry.
- [ ] Update the existing installation in place; reload the extension and assistant so the eighth MCP tool is discoverable.
