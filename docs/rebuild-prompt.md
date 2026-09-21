# BUILD PROMPT — noon Minutes Dark‑Store Compliance App: Reliability + Device‑Cache + Delta‑Sync Overhaul

## ROLE
You are a principal full‑stack engineer + reliability architect. You are inheriting a **live, production** internal tool used every hour by staff across ~166 UAE dark stores. Your job is to fix specific reliability defects and add device‑side caching / incremental sync **without breaking anything that already works** and **without adding any paid infrastructure** (budget is strictly $0).

You will be given two files that are the single source of truth:
- `App.tsx` — the entire React/TypeScript frontend (one file, deployed via CodeSandbox → Netlify).
- `Code.gs` — the entire Google Apps Script backend (one file, deployed as a Web App `/exec`).

## HOW TO OPERATE (do this in order — do not skip)
1. **Diagnose before you code.** For every defect below, state the concrete root cause you find in the actual code (quote the lines/functions). Do not guess‑patch.
2. **Preserve behavior.** Every existing feature listed in §2 must still work identically unless a change is explicitly required. Assume any deletion is a regression until proven otherwise.
3. **Stay in the two files.** No new files, no new npm/library dependencies, no build‑step changes. `App.tsx` must remain a single self‑contained file; `Code.gs` must remain a single script.
4. **Backward‑compatible data.** The Google Sheet schema and column order are fixed (see §2). New behavior must read existing rows correctly and must not require anyone to reformat the sheet.
5. **Respect Apps Script quotas.** Assume ~30 simultaneous executions per account, 6‑minute max runtime, and Drive/UrlFetch daily quotas. Any design that scales work with total data size on a hot path is wrong.
6. **Deliver complete files + a changelog + a test result.** Output the *full* updated `App.tsx` and `Code.gs` (not diffs), a bullet changelog mapping each change to the defect it fixes, and the results of running the §8 acceptance checks (static/logic verification is fine where a live endpoint isn’t reachable).

---

## 1. PRODUCT CONTEXT
- **What it is:** an hourly photo‑compliance tool. Location Assistants open the app during their shift and upload store photos (Inside / Outside / Parking, up to 5 each = 15 max) for the current hour slot. Managers view a login‑gated dashboard of adherence (submitted vs expected slots) per store / supervisor / AM / city‑manager, plus a heatmap and a photo gallery.
- **Scale:** ~166 stores, 8 AM–10 PM = 15 hourly slots/day, 3 city managers, ~16 supervisors, ~30 team leaders. Tens of thousands of rows accumulate.
- **Users are on phones, on flaky mobile data,** and all submit around the top of each hour (a synchronized “stampede”).
- **Cost ceiling:** $0. Only Google Apps Script + Google Sheets + Google Drive (backend) and Netlify static hosting (frontend) may be used.

## 2. CURRENT ARCHITECTURE (as‑is — preserve unless a change is required)
**Frontend (`App.tsx`)**
- Two tabs in one app: **Upload** (open, no login) and **Dashboard** (login‑gated). A fixed bottom nav switches between them.
- **Live store list:** on load, `loadLiveStoreMapping()` fetches `?stores=1` and overwrites `STORE_MAPPING`/`STORE_NAMES`; falls back to last‑successful fetch cached in `localStorage` (`ds_store_mapping_v1`), then to a hard‑coded map. Name matching is normalized via `norm()` (trim + lowercase).
- **Roles:** `USERS[]` with Admin / L1 (city managers + supervisors) / L2 (team leaders); `getScopedStores()` scopes visible stores.
- **Upload protocol (chunked, idempotent):** images compressed (`compressImage`, ~150KB), videos capped at 25MB; files split into ≤900KB units (`buildUnits`), uploaded with bounded concurrency (`runPool`, CONCURRENCY=3) via `addFile`/`addChunk`; videos reassembled via `assembleFile`; presence re‑checked via `?fileCount` (returns count + present indices) and only missing indices resent; `finalize` writes the Sheet row; `?check` verifies. A durable **IndexedDB queue** (`ds_db`/`queue`) holds failed/offline submissions; a **jittered** background sync drains it.
- **Dashboard:** fetches all rows via `fetchSheet()` (GET `/exec`), filters client‑side to Today / 7 / 10 days, computes adherence, renders Overview / Supervisor / AM / Stores / Flagged / Heatmap / Photos. Auto‑refresh currently every 60s; pull‑to‑refresh supported.
- **Known anti‑pattern to fix:** `App()` remounts `UploadView`/`DashboardView` via `key={`u${storesVersion}`}` / `key={`d${storesVersion}`}`, and `DashboardView` calls `fetchSheet()` on every mount — so **switching tabs re‑fetches and re‑renders from scratch** (loading spinner, lost state).

**Backend (`Code.gs`)**
- `doPost` handles `logFailed`, `addFile`, `addChunk`, `assembleFile`, `finalize`, plus a legacy single‑payload path. Folder creation uses double‑checked locking (`getOrCreateFolder`) — lock only on create.
- `doGet` handles `?stores` (cached 10 min in CacheService), `?fileCount`, `?check`, and a **full data fetch** currently bounded to the last ~11 days.
- **Data model / tabs:** the app reads+writes the **`Current`** tab (kept small). A daily job (`rollCurrentToWeeklyTabs`, called from `purgeOldFiles`) moves rows older than `CURRENT_DAYS` into **immutable per‑ISO‑week tabs** named `YYYY-Www`. One‑time `migrateSheet1ToWeeklyTabs` / `seedCurrentFromHistory` exist for setup. `purgeOldFiles` deletes Drive files older than 10 days (descends Store→Date→HourSlot→files, cleans `_tmp`, self‑reschedules).
- **Sheet columns (fixed order):** `ID, Timestamp, Date, HourSlot, Store, TL, Supervisor, AM, CityManager, Inside_Count, Outside_Count, Parking_Count, TotalFiles, DriveLink, FileLinks, Week`.
- **Live infra (do not change IDs):** Data Sheet `1sqj5OIJP1whQ20YVWXZqONtOKexaGI6yOxKthSC4ymk`; Drive root `1q8BB_ZCUbTcoHCaK-O36_N50AH3jsPfE`; Store‑list Sheet `192-ZhllfZyNJHMUqjbjseKxGcM0Eb14hKvuSO7dfunk` (Sheet1: `Stores | TL | Supervisor | AM | City Manager`).

## 3. HARD CONSTRAINTS & INVARIANTS
- $0 budget; only the platforms in §1. No new dependencies, no new files, no localStorage/sessionStorage in published‑artifact contexts if it would break Netlify (localStorage in the app is fine).
- Apps Script `/exec` **must keep the same deployment URL** (changes ship as “New version” of the existing deployment).
- **Do not break:** live store list + fallbacks, role scoping + normalized matching, chunked idempotent upload + IndexedDB retry queue + jittered sync, Current/weekly‑tab data model, purge + self‑reschedule, CSV/Excel export, heatmap (hour‑number matching, elapsed‑aware 3 states), photo gallery (dedupe + all 15 thumbnails), 15‑slot timing (8 AM–10 PM, last slot open till 11 PM), current‑hour‑only uploads with duplicate‑slot warning.
- Any GET response the dashboard consumes must stay small and fast regardless of total history size.

---

## 4. DEFECTS TO FIX (state the real root cause for each, then fix)
**P1 — Frequent downtime / “Too many scripts running simultaneously.”** The backend intermittently returns Google’s HTML quota page instead of JSON; dashboards then error and uploads fail. Identify every hot path that (a) reads the whole sheet, (b) holds the global `LockService` lock, or (c) is triggered per‑request by the top‑of‑hour stampede, and eliminate the execution pile‑up. The read path must not scale with total rows.

**P2 — 4,000–5,000 upload failures recorded per day.** The `Failed Uploads` tab logs thousands of failures daily. Find why (candidates: quota rejection under P1, top‑of‑hour concurrency stampede across devices, `finalize` cost, chunk reassembly on large videos, verification races producing false “failed” that re‑queue and amplify). Drive the *genuine* failure rate to near zero and ensure the retry loop cannot itself become a load amplifier (no full re‑uploads when one unit lags; no synchronized retries across devices; bounded, capped backoff).

**P3 — Tab switch reloads everything.** Toggling Upload ↔ Dashboard causes a full re‑fetch + spinner + lost scroll/filter state (caused by the `key={…storesVersion}` remount + `fetchSheet()` on mount). Switching tabs must be **instant** and must **not** trigger a network fetch or a loading state; the dashboard must show already‑loaded data immediately.

**P4 — No self‑refresh cadence.** The app must **auto‑refresh on its own every hour** (aligned to the top of the hour) and refresh when the app returns to foreground if data is stale. **Remove the 60s polling entirely** (it contributes to P1). **Pull‑to‑refresh must be REMOVED for all non‑Admin users** (city managers, supervisors, team leaders rely solely on auto‑sync + cache) and **kept only in the Admin view**, where it additionally offers a **“force full re‑sync”** that bypasses the delta/snapshot and re‑seeds the window. Manual refresh by regular users is a primary driver of the top‑of‑hour request storm, so its removal is a required reliability fix, not just UX.

**P4a — Silent failure, cached until next hour.** When any background/auto sync fails (throttle, timeout, offline), the app must **keep showing the last good cached data with NO error message, NO spinner, and NO immediate retry.** It simply waits for the next scheduled top‑of‑hour sync. This is a hard requirement: the current code surfaces a “server busy / unreachable” banner and retries immediately, which hammers an already‑throttled backend and produces the back‑to‑back failures. Remove that behavior. Keep only a quiet, non‑alarming “updated HH:MM” freshness timestamp in the header (no color, no icon) so freshness is visible without nagging.

**P5 — Adherence counts retries.** Adherence must be computed from **unique submitted slots** — i.e. unique `(store, date, hourSlot)` combinations — versus expected elapsed slots. Multiple submissions/retries for the same store+slot count **once**. Apply consistently across Overview, Supervisor, AM, Stores, trend, drill‑down, Flagged, Heatmap, and Photos. (A `norm()`‑based dedup exists in places — make it correct and uniform everywhere, and verify it holds for both clean “8:00 AM” labels and any ISO/date‑serial `HourSlot` values in historical rows.)

**P6 — No device cache; data re‑downloaded every time.** The dashboard re‑downloads data on each load/refresh/tab‑switch. Required behavior: **on first refresh, load the recent window once; thereafter fetch only new data (a delta), keep older data cached on the device, and never re‑download the full window again.** The device cache is the display source of truth; network sync only appends what’s new.

---

## 5. CAPABILITIES TO BUILD (requirements + acceptance criteria)
**C1 — Persistent device cache of sheet data (IndexedDB).**
- Store all known rows keyed by `ID` in IndexedDB (separate store from the upload queue).
- On dashboard open, **hydrate instantly from IndexedDB with no spinner**, then sync in the background.
- Cache survives app close, tab switches, and offline.
- Acceptance: with the network blocked, opening the dashboard still shows the last cached data immediately; no error blocks the view.

**C2 — Incremental delta sync (cursor‑based).**
- Backend exposes a delta read (e.g. `?since=<cursor>`), returning **only rows after the cursor** plus the new cursor. Cursor may be a monotonic row count / last row index for the `Current` tab, or a `Timestamp`/`ID` high‑water mark — choose the cheapest correct option that does **not** require scanning all rows on each call.
- Frontend keeps the high‑water cursor, requests only the delta, and **merges by `ID`** into the IndexedDB cache (dedupe/replace on conflict).
- First‑ever load performs one bounded window fetch (e.g. the `Current` window) to seed the cache; every subsequent sync is delta‑only.
- Acceptance: after first load, a refresh transfers only new rows (verify payload size shrinks to ~the number of new submissions, not the whole window); older data is served from cache and never re‑fetched.

**C3 — Instant, state‑preserving tab switching.**
- Lift dashboard data + cursor + filter/tab UI state to a level that **persists across Upload↔Dashboard switches** (top‑level state/store/context, or keep components mounted). Remove the `storesVersion` remount that wipes state; find another way to reflect a live store‑list update (e.g. update state in place) without unmounting.
- Switching tabs must cause **zero** network calls and **zero** loading spinners.
- Acceptance: load dashboard → switch to Upload → back to Dashboard shows the same data instantly, same tab, same filters, no fetch, no spinner.

**C4 — Hourly auto‑refresh.**
- A single top‑level scheduler triggers a delta sync **aligned to the top of each hour** (e.g. fire at HH:00:30 to catch the just‑closed slot), plus a foreground/`visibilitychange` refresh when data is older than a threshold. Add small jitter so devices don’t all hit the backend at the same instant.
- Acceptance: leaving the dashboard open across an hour boundary updates it automatically via a delta (not a full reload); the update is visibly incremental and does not blank the screen.

**C5 — Unique‑slot adherence** — as specified in P5, with acceptance: submitted ≤ expected always; duplicate submissions for a slot never increase the count; a store that submitted every elapsed slot once shows 100% even if some slots were retried.

**C6 — Upload reliability hardening** — as specified in P2, with acceptance: under a simulated top‑of‑hour burst (many concurrent submissions), genuine failures approach zero, retries resend only missing units, retry cadence is jittered + backed‑off, and no request path reads or rewrites the whole sheet.

---

## 6. RECOMMENDED TECHNICAL DESIGN (opinionated; override only with justification)
**Backend**
- **Serve reads from a periodically‑refreshed snapshot** to absorb spikes: maintain a compact JSON snapshot of the `Current` window in `CacheService` (and/or a `_snapshot` tab / `PropertiesService` chunk), rebuilt on a short time trigger and/or lazily when stale. `doGet` returns the snapshot (or a delta slice of it) without a live `getDataRange` on the hot path. Keep a bounded fallback to a live read.
- **Delta endpoint:** `?since=<n>` returns rows with row‑index > n from `Current`, plus `cursor` (new last index) and `count`. Because `Current` is append‑mostly and bounded, this is cheap. Handle the daily roll (which rewrites `Current`) by versioning the cursor (e.g. include a `gen` that changes when `Current` is rebuilt, so the client knows to re‑seed).
- **Keep every write hot path O(recent):** `finalize` idempotency already scans only the last ~1000 IDs — keep it that way; never reintroduce full‑sheet reads/rewrites on submission. The Current→weekly roll stays off the submission path (daily trigger only).
- Never cache empty/error results as if valid.

**Frontend**
- **IndexedDB `rows` store** keyed by `ID`; `mergeRows()` upserts; an in‑memory index powers the dashboard. Hydrate from IDB synchronously‑ish before first paint.
- **A single app‑level data controller** (top‑level state or a tiny module store) owns: cached rows, cursor/gen, last‑sync time, loading flags. Both tabs read from it; unmounting a view must not clear it.
- **Sync function** = hydrate → delta fetch (`?since`) → merge → persist → update `lastSync`. On `gen` change, re‑seed the window. All refresh triggers (hourly scheduler, pull‑to‑refresh, foreground) call the same sync; tab switches call **nothing**.
- **Auto‑refresh scheduler** computes ms to next hour boundary + jitter; reschedules itself; also listens to `online`/`visibilitychange`.
- **Uploads:** keep the chunked/idempotent/queue design; ensure jittered first‑run + jittered interval (already present) and capped exponential backoff; ensure a lagging unit never triggers a full resend (presence‑indices path already supports this — verify and enforce).

---

## 7. DELIVERABLES
1. Full updated **`App.tsx`** (complete file).
2. Full updated **`Code.gs`** (complete file).
3. **Changelog:** each change → the defect/capability (P1–P6, C1–C6) it addresses, with the root cause you found.
4. **Rollout steps:** exact deploy order (script New‑version first, any one‑time setup functions to run, then app), plus any new time‑trigger to create (e.g. snapshot rebuild) and its recommended interval.
5. **Verification results:** the §8 checks run (logic/static where live isn’t reachable), each marked pass/fail.

## 8. ACCEPTANCE TEST PLAN (must pass)
- **Compile/validity:** `Code.gs` parses (`node -c`); `App.tsx` is brace/paren/bracket‑balanced and type‑checks clean (ignoring only missing `@types/react` stubs).
- **P3/C3:** dashboard → Upload → dashboard = instant, no fetch, no spinner, same tab+filters (assert no network call fires on tab switch).
- **P4/C4:** across an hour boundary, an open dashboard auto‑syncs via delta without blanking; there is **no 60s polling**; **pull‑to‑refresh exists only for Admin** (absent for L1/L2); Admin has a working “force full re‑sync”.
- **P4a:** when a sync fails (simulate throttle/offline), the dashboard keeps showing cached data with **no error banner, no spinner, and no immediate retry** — it recovers on the next scheduled hourly sync; only the quiet “updated HH:MM” timestamp reflects staleness.
- **P5/C5:** given rows with duplicate `(store,date,slot)`, unique count is used; submitted ≤ expected; a fully‑covered store = 100% despite retries. Include a data case mixing clean “8:00 AM” labels and ISO/date‑serial `HourSlot`.
- **P6/C1/C2:** first load seeds cache from bounded window; second refresh transfers only new rows (payload ≈ new submissions, not full window); with network blocked, cached data still renders instantly.
- **P1/P2/C6:** simulate a top‑of‑hour burst of concurrent submissions; show no hot path reads/rewrites the whole sheet, retries resend only missing units, retry timing is jittered+capped, and the read path is served from snapshot/delta. State the expected effect on the daily failure count.
- **No‑regression sweep:** live store list + fallback, role scoping, chunked upload + queue, weekly‑tab roll + purge self‑reschedule, CSV/Excel export, heatmap 3‑state, gallery all‑15 + dedupe, 15‑slot timing + duplicate‑slot warning — all still present and working.

## 9. ANTI‑GOALS (do not do these)
- Do not add paid services, servers, databases, or npm/library dependencies.
- Do not change the Sheet schema/column order or the `/exec` deployment URL or the infra IDs.
- Do not reintroduce full‑sheet reads/rewrites on any per‑request path.
- Do not rewrite unrelated features or restyle the UI.
- Do not use a remount (`key` bump) as the mechanism for reflecting data updates.
- Do not report a fix as done without the §8 evidence.

---

### Output format
Respond with: (1) **Root‑cause findings** (P1–P6, quoting real code), (2) **Design summary** (what you’re building for C1–C6), (3) the **full `Code.gs`**, (4) the **full `App.tsx`**, (5) **Changelog**, (6) **Rollout steps**, (7) **Acceptance results**. Keep prose tight; let the code and the checklist carry the weight.
