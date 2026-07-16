# Multi-country support

Adds UAE (existing) + KSA, Egypt, Bahrain, Qatar, Kuwait. Fully backward
compatible: anything untagged defaults to **UAE**, so existing data, folders,
and logins keep working unchanged.

## What changed

**Upload**
- A **Country** selector gates the store list — pick a country, then only that
  country's stores appear.
- Hour-slot and the 8 AM–10 PM shift window are computed in the **country's local
  time** (UAE +4, KSA/Bahrain/Qatar/Kuwait +3, Egypt +2; none observe DST).
- Country is stamped on the record and every upload request.

**Dashboard / access**
- Accounts gain a `countries` scope. A user sees stores that match **both** their
  role scope (CM/Supervisor/TL) **and** their countries.
- A **country admin** = `scopeType: all` with a specific `countries` list (all
  stores in those countries).
- A hard country gate on rows means a user never sees a country they aren't
  entitled to — even if a store name exists in two countries.
- Adherence is **per country**: expected slots are summed using each store's own
  timezone, so a KSA store isn't judged against UAE's clock.

**Storage**
- Sheet gains a **Country** column (column 17, appended — legacy 16-column rows
  stay aligned and read as UAE).
- Drive layout is now **Country / Store / Date / Hour**. Legacy UAE files at
  `Store/Date/Hour` are left in place; the purge understands both layouts.

## Google Sheet setup (before deploy)

1. **Store-list sheet** — add a **Country** column (any of: `Country`, `Market`).
   Fill each store's country. Blank = UAE. Same store name in two countries is
   fine now (they're kept distinct).
2. **Users tab** — in the *store-list spreadsheet*, add a tab named **`Users`**
   with these column headers (order-independent):

   | Username | Password | Role | Name | ScopeType | ScopeValue | Countries |
   |---|---|---|---|---|---|---|
   | hamza | … | Admin | Hamza Khan | all | | ALL |
   | ksa.sup1 | … | L1 | KSA Supervisor | supervisor | Ashraf | KSA |
   | gulf.cm | … | L1 | Gulf CM | cityManager | Sara | UAE,KSA,Bahrain |

   - `ScopeType` ∈ `all | cityManager | supervisor | teamLeader`.
   - `Countries` = comma-separated (`UAE,KSA`) or `ALL`.
   - Login validates against this tab server-side and returns **only** that
     account's scope — never passwords, never other users. If the tab is absent,
     the app falls back to the built-in accounts (so UAE keeps working).

## Deploy steps

1. Paste `apps-script/Code.gs`, Save. Run `clearStoreCache` once (so the new
   `stores[]` payload is served immediately).
2. Deploy → Manage deployments → edit existing → **New version** (same `/exec`
   URL, so the frontend needs no URL change).
3. Update `frontend/src/App.tsx` in CodeSandbox; let Netlify rebuild.

## Security note (by design)

This remains internal "casual access control." Login is now **server-side**
(better than the old in-bundle credentials): a public request can't dump the
user list. The only residual exposure is that a login request carries the
password in the query string, so it can appear in the script's execution logs.
For a stronger posture we'd hash passwords in the sheet and compare hashes — a
scoped follow-up if you want it.

## QA test matrix (verify after deploy)

| # | Scenario | Expected |
|---|---|---|
| 1 | Upload: pick country → store list | Only that country's stores listed |
| 2 | Change country | Store selection resets; slot re-stamps to new country's local hour |
| 3 | Submit in KSA at 18:00 KST | Row has Country=KSA; file under `KSA/Store/Date/Hour` |
| 4 | Same store name in UAE and KSA | Never merged; each files/reports under its own country |
| 5 | Login `Countries=KSA` supervisor | Dashboard shows only KSA stores under that supervisor |
| 6 | Login `Countries=UAE` user | No KSA/Egypt/etc. rows visible at all |
| 7 | Country admin (`all` + `[Egypt]`) | Sees every Egypt store, nothing else |
| 8 | Legacy UAE row (no Country) | Renders under UAE; UAE users still see it |
| 9 | Adherence for an Egypt store | Denominator uses Egypt local elapsed slots |
| 10 | Old backend / offline login | Built-in UAE accounts still log in |

## Known limitation

POC (CM/Supervisor/TL) name matching is still by name within the country gate.
If the *same person name* manages stores in two countries a user is entitled to,
they'll correctly see both. Cross-country visibility is always bounded by the
country gate, so no country ever leaks.
