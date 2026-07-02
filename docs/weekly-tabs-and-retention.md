# Data retention model: rolling live tab + immutable weekly tabs

## How the sheet is organized

| Tab | Holds | Written by | Read by app |
|---|---|---|---|
| **Current** | Last **10 days** only (`CURRENT_DAYS`) | New submissions (`finalize`), daily roll trims it | ✅ Yes — the app reads only this tab |
| **`YYYY-Www`** (e.g. `2026-W27`) | All rows older than 10 days, partitioned by ISO week | Daily roll (append-only) + one-time migration | ❌ No |
| `Undated` | Rows with no parseable date (rare) | Migration only | ❌ No |
| `Failed Uploads`, `Purge Log` | Diagnostics | Script | ❌ No |

**Weekly tabs are append-only and immutable.** Once a row is filed into a
`YYYY-Www` tab, this script never rewrites, reorders, or deletes it. Only the
`Current` tab is ever rewritten (and `clearContents()` preserves its header
formatting + frozen row).

## The daily roll — `rollCurrentToWeeklyTabs()`

Runs once a day from `purgeOldFiles()`. Under a script lock it:
1. Reads `Current`, splits rows into **keep** (≤10 days) and **aged** (>10 days).
2. Groups aged rows by ISO week and **appends** each group to its `YYYY-Www` tab
   (creating the tab with headers if new).
3. Rewrites `Current` with the header + kept rows.

Because aged rows are removed from `Current` as they're filed, they're never
re-processed — no duplicates under normal operation.

## One-time migration — `migrateSheet1ToWeeklyTabs()`

Splits your existing legacy history into weekly tabs.

- **Source:** the `Sheet1` tab (or `Archive`, or the first legacy tab if named
  differently). Weekly/utility tabs are ignored.
- **Idempotent:** rows whose `ID` already exists in the target week tab are
  skipped, so it's safe to run more than once, and safe to **re-run to resume**
  if it stops early on a very large sheet (it self-limits to ~5 minutes).
- **Non-destructive:** the source tab is left completely intact. Verify the
  weekly tabs, then delete the source manually if you want.

## Run-once checklist (in the Apps Script editor)

1. Paste the updated `Code.gs`, Save.
2. Run **`migrateSheet1ToWeeklyTabs`** → check the Execution log for the counts
   (`appended N … skipped M … Done.`). If it says "STOPPED EARLY", run it again.
3. Run **`seedCurrentFromHistory`** once so `Current` holds the last 10 days
   immediately (optional if `Current` is already populated).
4. Confirm a daily **time-based trigger** exists for **`purgeOldFiles`**
   (⏰ Triggers). This one trigger drives BOTH the 10-day file purge AND the
   daily roll into weekly tabs. Without it, neither happens.
5. Deploy → Manage deployments → edit existing Web App → **New version**.

## Notes

- The app needs no change for this: it already reads the `Current` tab via the
  web app, which is now the rolling 10-day live tab.
- `CURRENT_DAYS` (roll boundary) and the Drive file `RETENTION_DAYS` are both
  10 days, so the sheet's live window and the retained-files window line up.
