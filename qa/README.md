# QA harness

Type-checks, builds, and drives the **real** app source
(`../frontend/src/App.tsx`) — nothing here is a copy.

## Install
```bash
cd qa && npm install
```

## Type-check (catches type errors in App.tsx)
```bash
npm run typecheck
```

## Production build
```bash
npm run build
```

## End-to-end UI tests (headless browser, backend mocked)
`drive.mjs` serves the built app and drives it in Chromium with the **new**
Apps Script contract mocked via network interception, covering:
1. Country selector gates the store list (UAE/KSA/Egypt; selecting a country filters stores)
2. Admin dashboard fans out one fetch per country (UAE+KSA+Egypt)
3. A KSA-scoped supervisor only fetches/sees KSA
4. Backward compat: a legacy `?stores` payload (no `stores[]`) still works (UAE only)
…and asserts zero runtime page errors throughout.

```bash
npm run build
npm run preview &        # serves on :4173
# If your Chromium needs an explicit binary (e.g. sandboxes without a bundled one):
#   export PW_CHROME=/path/to/chrome-or-headless_shell
npm run e2e
```

Mock data + scenarios live in `drive.mjs` — extend as the app grows.
