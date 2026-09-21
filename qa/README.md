# QA harness

Type-checks, builds and drives the **real** sources — `../frontend/src/App.tsx`
and `../apps-script/Code.gs`. Nothing here is a reimplementation.

## Install
```bash
cd qa && npm install
```

## Backend (`Code.gs`)
```bash
node backend.test.mjs
```
Loads the real `Code.gs` into a stubbed Apps Script runtime where
**`getDataRange()` throws**, so any hot path that still reads the whole sheet
fails the suite. Asserts both output and **cost** (which ranges were read):
`?check` bounded to the ID column of the last 1000 rows, `?fileCount` opening no
spreadsheet, `?since` reading only new rows, gen/cursor re-seed behaviour,
snapshot chunking under the 100KB CacheService cap, and legacy back-compat.

## Frontend
```bash
npm run typecheck   # tsc --noEmit on the real App.tsx
npm run build       # vite production build
node frontend.test.mjs
```
`frontend.test.mjs` extracts real functions (types stripped with esbuild, not
regex) and checks unique-slot adherence — including mixed `"8:00 AM"` and
ISO/date-serial `HourSlot` values — plus cache hygiene and the delta wire
format, and asserts the removals (60s poll, `fetchSheet`, remount keys, error
banner) stayed removed.

## End-to-end (headless browser, backend mocked)
```bash
npm run build
npm run preview &
# if the environment has no bundled browser:
#   export PW_CHROME=/path/to/chrome-or-headless_shell
node drive.mjs
```
Covers: tab switch fires **zero** network calls and shows no spinner with state
preserved; reload serves from IndexedDB without re-downloading; a stale cache
syncs via `?since` rather than re-seeding; a dead network leaves cached data on
screen with **no error banner**; pull-to-refresh/force-re-sync is Admin-only
while an L1 still sees their scoped data.
