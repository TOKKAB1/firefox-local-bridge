# Firefox Local Bridge

**An opt-in Firefox connector for local MCP assistants. Your browser, your access duration, your approval.**

Version **0.2.0 · development preview · Windows setup included**. Independent project, not affiliated with Mozilla or OpenAI.

[Start guide](START-HERE.html) · [Română](README.ro.md) · [Русский](README.ru.md) · [Privacy](SECURITY.md) · [Verification](docs/VERIFICATION.md)

## For users

Choose **`firefox-local-bridge-v0.2.0-windows.zip`**. It contains the prebuilt MCP server, so you do not install libraries or type package-manager commands. Requirements: **Windows, Firefox 140+ and Node.js 24 LTS**. Setup also detects the existing bundled Codex Node runtime when available.

1. Extract the Windows ZIP to a permanent folder. Open **`START-HERE.html`** for illustrated step cards in English, Romanian or Russian.
2. Double-click **`Setup-Windows.cmd` from Windows Explorer**. It registers the native host for your Windows account and configures the `firefox_local_bridge` local Codex MCP entry with a settings backup. No administrator is needed. To keep MCP configuration manual, run the launcher with `--manual-mcp`.
3. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on** and select **`extension/manifest.json`** from the extracted folder.
4. Fully restart ChatGPT/Codex. Open a normal webpage, select the extension icon, choose scope and duration, then enable **Assistant access**.

Try: **“Check Firefox Local Bridge, list available tabs and read the active tab.”**

**Temporary add-ons disappear when Firefox restarts.** Reload the manifest after each browser restart. Permanent installation needs a Mozilla-signed release, which this project does not yet provide. Do not disable signature enforcement.

If Node is missing, install **24 LTS** from [nodejs.org](https://nodejs.org/) and rerun setup. If Firefox reports **No such native application**, import the generated **`.installed/Register-Firefox.reg` yourself from Windows Explorer**, then restart the assistant. Setup run inside an MSIX-packaged app can create a registration hidden from Firefox; see [Windows notes](docs/WINDOWS-SETUP-NOTES.md).

For another local MCP client, use STDIO and the exact paths shown by **`.installed/Connection.html`**, generated during setup. Set its tool timeout to **120 seconds**. The integration provides separate MCP tools; it does not add Firefox to the built-in Chrome/Edge list. Managed workspaces may restrict local MCP servers.

## Choose how long access lasts

| Choice | Behavior |
| --- | --- |
| 15 minutes, 1 hour, 4 hours, 1 day | A preset session duration |
| Custom duration | Whole minutes, hours or days, from 1 minute up to 365 days |
| Until I turn it off | No timer; ends on Stop, disconnect, or browser/extension restart |
| Apply duration from now | Change an active session without reconnecting |
| Assistant requests time | `firefox_request_duration` shows its reason and requested duration; only your popup approval applies it |

Access **always starts off after restart**. Language, preferred scope and duration are remembered; grants and private-window opt-in are not. An assistant cannot silently extend access, restart an expired session or approve its own request.

## What it can do

- Work in the whole browser or one selected tab. Single-tab access is revoked on navigation/reload.
- Include private windows only after both Firefox's own permission and the session switch are enabled.
- List authorized tabs, read visible page text, click a fresh element reference, fill ordinary text fields, scroll and navigate an existing tab.
- Ask for popup approval before **every click, fill, navigation or assistant-proposed duration change**. The `?` badge means approval is waiting; open the popup within about 90 seconds. Reads and scrolling use the enabled grant.

Internal Firefox pages, restricted Firefox domains, file URLs, cross-origin frames, shadow DOM and complex editors are outside the current prototype. No general JavaScript-evaluation, cookie, history, clipboard or password-manager tool is exposed. Field values are omitted from reads; sensitive-field filtering is conservative, not a complete guarantee.

**Page content becomes context for your assistant and may be processed by its AI provider.** The project has no cloud relay or telemetry. Stopping access cancels pending requests, but cannot undo completed actions. Read [SECURITY.md](SECURITY.md).

## Update and uninstall

If updated in the same installation folder: reload the extension from `about:debugging`, fully restart the assistant and enable a new session. If you move the folder, unregister the old installation before running setup in the new location. Do not run multiple MCP owners against the same bridge.

To uninstall: stop access, run **`Uninstall-Windows.cmd` from Explorer**, then remove the add-on and the `firefox_local_bridge` MCP entry from your assistant. Source files are kept. Setup never overwrites a different native-host installation. Other Codex settings remain intact and are backed up before edits.

## For GitHub and contributors

Suggested repository name: **`firefox-local-bridge`**. Upload the contents of **`firefox-local-bridge-v0.2.0-github-source.zip`**, not generated personal settings. Its top-level folder contains the complete repository sources, MIT license, tests, documentation and CI. No user paths, endpoint secrets, generated registry files, dependencies or Git history are packaged.

With Node.js 24 and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm lint:addon
pnpm test
pnpm package
```

Outputs in `dist/`: GitHub source ZIP, Windows user ZIP, unsigned development XPI and SHA-256 checksums. The Windows ZIP includes a bundled server and third-party license notices; Node.js itself is not redistributed. If installing from sources, `Setup-Windows.cmd` can install production dependencies automatically using Node's npm or the detected bundled pnpm.

Automated tests cover MCP/native transport, page filtering, stale actions, popup consent, expiry/manual sessions, assistant duration proposals, localized UI and configuration preservation. Baseline live Firefox connection/list/read passed in 0.1; **0.2 duration features and clean-user setup still need live manual acceptance**. See [test checklist](docs/TESTING.md) and [contributing](CONTRIBUTING.md). Linux/macOS setup and public signing are future work, not advertised as supported.

## References

[Mozilla native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging) · [Mozilla permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request) · [OpenAI MCP setup](https://learn.chatgpt.com/docs/extend/mcp) · [MCP SDK](https://ts.sdk.modelcontextprotocol.io/v2/)
