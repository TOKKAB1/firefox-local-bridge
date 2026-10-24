# Security and privacy

## Scope and consent

Access starts off. A session is explicitly enabled from the popup for a user-selected duration (1 minute to 365 days), or until stopped/disconnected/browser-extension restart. The default is 15 minutes. Single-tab grants bind to the exact URL and are revoked when loading/navigating. Browser mode needs optional HTTP(S) host and tab permissions and can read all eligible tabs during the enabled session. Private windows additionally require Firefox's own incognito permission and the session's private-window switch. Firefox's optional permissions persist independently of the bridge session until manually revoked.

Users may apply a new duration directly from their own popup. The assistant's `firefox_request_duration` only proposes a duration and reason: it waits for explicit popup approval, cannot enable an inactive session, and cannot extend access after rejection, cancellation, expiration or disconnection. Duration 0 means no timer, not an automatic grant after restart. Extension storage remembers only language, preferred scope and duration; access grants and private-window opt-in remain in memory.

Every click, fill, navigation and assistant duration proposal requires an exact-action popup approval. Scroll and reads do not. The assistant cannot approve its own actions; popup messages must originate from the extension's popup URL with no sender tab. Cancelled/expired approvals cannot later execute. Already dispatched actions cannot be undone by stopping access. A disconnect or timeout can leave the action outcome unknown; observe the page before retrying.

## Local transport

The MCP process opens an ephemeral **127.0.0.1 TCP** listener, never 0.0.0.0. A new 256-bit secret is generated each run. A native host authenticates before commands can be sent; an additional host cannot replace the connected peer. The endpoint secret lives under the user's local application data directory, not in the repository. The Windows installer restricts its own runtime directory to the current user and SYSTEM. Other local processes running as that user, administrators, a compromised assistant, or malware are outside the threat model. This is not a sandbox against same-user code.

Native messaging registration authorizes only `firefox-local-bridge@local.invalid`. The native process also verifies Firefox's extension-ID argument. That argument alone is not an authentication boundary against local same-user programs. No HTTP endpoint is exposed to websites. Frames are capped at 1 MiB, unauthenticated sockets time out, pending commands are bounded and expire.

The optional `FLB_RUNTIME_DIR` environment variable is for isolated development/test instances. Keep it private and use the same value for the MCP and native processes; normal installations use the default protected directory.

## Page data

No cookies, stored credentials, clipboard or history APIs are requested. Reads omit input, textarea, select and contenteditable values, hidden nodes and scripts. Query strings and fragments are omitted from page URLs returned by tab/read tools, but may still appear in page text or titles. Visible text may include personal information or logged-in content. Read results are passed to the assistant's provider as conversation context. This project does not operate a remote relay, but it does not make an online AI model local.

Sensitive-field detection is a best-effort conservative filter, not a complete data-loss prevention system. Text fields can transmit on input events, without a form submission. The exact text is shown in the approval preview. Do not approve secrets or data for an unauthorized destination.

Page text, titles, labels, URLs and tool outputs are untrusted data. They must not become instructions or authorization for the assistant. No general-purpose evaluate/script/selector tool is exposed. Element references are tied to a fresh snapshot and invalidated by observed DOM changes, input events, navigation or a completed action. These checks reduce stale actions; they cannot prevent every page-side race or malicious website behavior. A page can change its own content in response to an approved click.

## Limitations and release gate

This is an unaudited prototype. Real-profile installation, native host launch through Firefox, multi-window/private-window behavior, and the target AI desktop client's MCP flow require manual validation. The automated integration test uses real MCP/native processes with simulated Firefox APIs. It does not establish native browser compatibility.

Before a public add-on release, complete the manual checklist, Mozilla's signing/review requirements and current data-collection declarations. Do not disable signature enforcement, bypass restricted domains or masquerade as an official extension. No security/privacy browser settings are changed by the installer. Public OpenAI plugin-directory distribution has separate eligibility and review requirements.

## Reporting

Do not post page content, endpoint tokens, personal paths or private browser data in public issues. Until a repository maintainer publishes a private reporting channel, reproduce issues using synthetic pages and share only a sanitized description. Rotate a suspected endpoint token by closing the MCP session and opening a new one.
