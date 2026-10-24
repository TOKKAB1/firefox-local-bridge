# Contributing

Use Node.js 24 and pnpm. Install with `pnpm install --frozen-lockfile --ignore-scripts`. Run `pnpm check`, `pnpm lint:addon`, `pnpm test` and `pnpm package` before opening a PR. Update the canonical pnpm lock when dependencies change.

Keep the bridge opt-in. New commands must enforce session scope in the extension, validate their inputs, handle cancellation and include meaningful tests. Mutating actions must show the actual target and payload in the trusted popup. Do not add arbitrary evaluation, cookie/password extraction, broad required host permissions or ways around Firefox security restrictions.

Use synthetic pages and a dedicated Firefox development profile. Do not include real account pages, user profiles, endpoint secrets, generated `.installed/` files, local paths, dependencies or screenshots containing private data in a commit.

For bugs, include the OS, Node version, Firefox version, MCP client/version, a sanitized reproduction and whether access was in tab/browser/private mode. Consult `SECURITY.md` before reporting a security issue.

Before a release, complete `docs/TESTING.md`, update the version consistently and arrange Mozilla signing. Public plugin-directory publication is a separate process. MIT contributions are welcome; this repository does not imply affiliation with product vendors.
