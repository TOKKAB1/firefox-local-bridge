# Windows packaged-app setup

## Firefox reports “No such native application” after in-app installation

Some MSIX-packaged assistant apps virtualize HKCU registry writes made by their child processes. A registration can therefore be visible to the installer but invisible to Firefox. A successful `reg.exe ADD` from inside the packaged app is not sufficient evidence that Firefox can discover the host.

The installer now generates `.installed/Register-Firefox.reg` in UTF-16LE. From Windows Explorer, the user can review and import this file outside the packaged app. It contains only the per-user `org.firefox_local_bridge` native-host registration and the local manifest path. Import it only for the installation the user intends to enable. No administrator-wide HKLM registration, browser policy changes, or signature changes are needed. Run uninstallation from an ordinary Windows session as well so it sees and removes the same real registration.

The Windows runtime directory is now `%LOCALAPPDATA%\OpenAI\FirefoxLocalBridge\runtime`, within the shared application-data tree declared by the tested Codex desktop package. This avoids a second discovery failure when Firefox's external native host tries to read the endpoint created by the packaged MCP server. Other packaged clients must verify their own shared locations; `FLB_RUNTIME_DIR` can override the location for both processes. The installer protects the runtime directory with a user/SYSTEM ACL.

After changing the runtime location, restart the assistant's MCP server before enabling Firefox access. Never start a second owner just to work around the single-session lock.

## Non-ASCII install paths

Registry values are queried using an explicit UTF-8 JSON channel. `reg.exe QUERY` output uses the console's code page and must not be decoded blindly as UTF-8. The generated native wrapper selects UTF-8 before reading its non-ASCII source paths. Reinstallation and a native-wrapper round trip were tested from a Cyrillic Desktop path; Firefox discovery itself remains a separate manual check.

References: [Microsoft MSIX virtualization](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization), [Mozilla native-host registration](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests).
