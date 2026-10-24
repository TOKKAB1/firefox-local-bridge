# Verification record — 2026-10-24

## Version 0.2.0

- 29 automated tests passed, including custom/manual durations, expired and cancelled proposals, long-timer handling, localized popup behavior and preservation of existing client settings.
- The prebuilt server passed the MCP-client/native-process integration test with simulated Firefox APIs.
- Mozilla web-ext validation: 0 errors, 0 notices, 0 warnings.
- Live acceptance of the new duration UI/tool, a fresh-user Windows setup and real-browser mutations remains pending. The successful baseline live session below does not establish those features.

## Version 0.1.0 baseline

Version tested: 0.1.0. Environment: Windows, Node.js v24.22.1.

| Check | Result |
| --- | --- |
| JavaScript syntax and manifest access policy | Passed |
| Node automated tests | 19 passed, 0 failed |
| Actual MCP SDK client/server and native-process round trip | Passed with simulated Firefox APIs |
| Mozilla web-ext 10.8.0 lint | 0 errors, 0 notices, 0 warnings |
| Installer dry-run | Passed; no registry/configuration changes applied |
| Dependency lock consistency | Passed |
| Production dependency advisory audit | No known vulnerabilities reported |
| Real Firefox native-host registration and launch | Passed after importing the generated registration from Windows Explorer |
| Real Firefox private/multi-window behavior | Pending manual verification |
| Real ChatGPT/Codex desktop MCP connection | Passed: connection, browser-scope tab listing and active-page read |
| Real browser mutating actions and approval flow | Pending manual verification |
| Mozilla signing or public directory submission | Not performed |
| GitHub publication | Not performed |

The desktop-control tool refused Firefox access because browser URL-policy enforcement is unsupported for this Windows browser. The user manually loaded the add-on, imported its native registration outside the packaged app and enabled a session. The independently configured MCP integration then successfully listed ordinary web tabs and read the active page. No native desktop-control bypass was used. The remaining manual checks in `TESTING.md` are still pending.
