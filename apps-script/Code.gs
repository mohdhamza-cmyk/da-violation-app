const SHEET_ID = "1sqj5OIJP1whQ20YVWXZqONtOKexaGI6yOxKthSC4ymk";

const ROOT_FOLDER_ID = "1q8BB_ZCUbTcoHCaK-O36_N50AH3jsPfE";

// Live store list + POC mapping source (separate spreadsheet, Sheet1).
// Columns: Store | TL | Supervisor | AM | City Manager
const STORE_LIST_SHEET_ID = "192-ZhllfZyNJHMUqjbjseKxGcM0Eb14hKvuSO7dfunk";

// Get-or-create a child folder. FAST PATH is lock-free (folder already exists),
// which is the case for all but the very first request of each hour. We only
// acquire the global lock when the folder is genuinely missing and must be
// created — and we re-check inside the lock to avoid duplicate folders.
// This is critical: the chunked uploader fires ~12 requests per submission, so
// locking on every request (the old behavior) serialized everything globally
// and caused mass timeouts/failures at scale.
function getOrCreateFolder(parent, name) {
  let it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();           // lock-free fast path
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try {
    it = parent.getFoldersByName(name);         // re-check after acquiring lock
    if (it.hasNext()) return it.next();
    return parent.createFolder(name);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getHourFolder(store, date, hourSlot) {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const storeFolder = getOrCreateFolder(root, store);
  const dateFolder = getOrCreateFolder(storeFolder, date);
  const hourLabel = String(hourSlot).replace(":", "-");
  return getOrCreateFolder(dateFolder, hourLabel);
}

function getTmpFolder(hourFolder) {
  return getOrCreateFolder(hourFolder, "_tmp");
}

// ── WEEK-NUMBER TAGGING ───────────────────────────────────────────────────
// Returns an ISO-8601 week label like "2026-W24" for a given date. Sortable,
// unambiguous across year boundaries, and easy to pivot/filter on in Sheets.
function isoWeek(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;          // Mon=0 … Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);  // move to the Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return target.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

// Make sure the "Week" header exists in column 16, once. Safe to call often.
function ensureWeekHeader(sheet) {
  const cell = sheet.getRange(1, 16);
  if (String(cell.getValue()).trim() !== "Week") cell.setValue("Week");
}

// ── ROLLING CURRENT + IMMUTABLE WEEKLY TABS ───────────────────────────────
// The app reads and writes only the "Current" tab, which is kept small (the
// last CURRENT_DAYS). A daily job MOVES rows older than CURRENT_DAYS out of
// Current and appends them into immutable per-ISO-week tabs named "2026-W27".
// Weekly tabs are APPEND-ONLY: once a row lands there it is never rewritten,
// reordered, or deleted by this script — a permanent, week-partitioned history.
// This keeps the live tab fast while preserving everything.
const CURRENT_DAYS = 10;
const SHEET_HEADERS = [
  "ID","Timestamp","Date","HourSlot","Store","TL","Supervisor","AM","CityManager",
  "Inside_Count","Outside_Count","Parking_Count","TotalFiles","DriveLink","FileLinks","Week"
];

// True for a weekly-archive tab name like "2026-W07".
function isWeekTabName(name) {
  return /^\d{4}-W\d{2}$/.test(String(name).trim());
}

// ── READ WINDOW, GENERATION & SNAPSHOT ────────────────────────────────────
// WINDOW_DAYS bounds every bulk read. The dashboard only renders Today / 7 /
// 10 days, so nothing older is ever shipped to a device.
const WINDOW_DAYS = 11;

// How far back ?check looks for a just-written row. A duplicate/verification is
// always a retry of a very recent submission, so a bounded tail is sufficient —
// and keeps the cost independent of total sheet size. Matches the window
// `finalize` already uses for its idempotency scan.
const CHECK_TAIL_ROWS = 1000;

// GENERATION ("gen") changes whenever `Current` is REWRITTEN rather than
// appended to — i.e. the daily roll, or a manual re-seed. Clients hold a ROW
// CURSOR into Current, and a rewrite invalidates every such cursor. Without
// this signal a client would silently skip or duplicate rows after the nightly
// roll; with it, the client simply re-seeds.
function currentGen_() {
  const props = PropertiesService.getScriptProperties();
  let g = props.getProperty("current_gen");
  if (!g) { g = String(Date.now()); props.setProperty("current_gen", g); }
  return g;
}
function bumpGen_() {
  PropertiesService.getScriptProperties().setProperty("current_gen", String(Date.now()));
}

// Date cells come back as Date objects; normalize to ISO so the wire format is
// stable no matter how a column happens to be formatted in the sheet.
function serializeRow_(row) {
  const out = new Array(row.length);
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    out[i] = (v instanceof Date) ? v.toISOString() : v;
  }
  return out;
}

// A real data row inside the read window (undated rows are kept, as before).
function rowInWindow_(row, dateIdx, tsIdx, cutoff) {
  if (!row[0] || String(row[0]) === "TEST") return false;
  let d = new Date(row[dateIdx]);
  if (isNaN(d.getTime()) && tsIdx >= 0) d = new Date(row[tsIdx]);
  return isNaN(d.getTime()) ? true : d >= cutoff;
}

// ── SNAPSHOT ──────────────────────────────────────────────────────────────
// A cached copy of the Current window so the SEED read — the only expensive
// read left in the system — is served from CacheService instead of hitting the
// Spreadsheet service on a user's request. Rebuilt by a time trigger, or
// lazily when stale. CacheService caps one value at 100KB, so we chunk it.
const SNAP_PREFIX = "snap_v1_";
const SNAP_TTL_SEC = 21600;              // 6h; the trigger refreshes long before this
const SNAP_MAX_AGE_MS = 10 * 60 * 1000;  // treat as stale after 10 min
const SNAP_CHUNK_CHARS = 90000;          // under the 100KB-per-value cap
const SNAP_MAX_CHUNKS = 24;              // ~2.1MB ceiling; larger ⇒ serve live, don't cache

function snapPut_(payload) {
  const json = JSON.stringify(payload);
  const n = Math.ceil(json.length / SNAP_CHUNK_CHARS);
  if (n > SNAP_MAX_CHUNKS) return false; // too big to cache — caller serves live
  const map = {};
  for (let i = 0; i < n; i++) {
    map[SNAP_PREFIX + i] = json.substring(i * SNAP_CHUNK_CHARS, (i + 1) * SNAP_CHUNK_CHARS);
  }
  map[SNAP_PREFIX + "meta"] = JSON.stringify({ n: n, builtAt: payload.builtAt, gen: payload.gen });
  CacheService.getScriptCache().putAll(map, SNAP_TTL_SEC);
  return true;
}

function snapGet_() {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get(SNAP_PREFIX + "meta");
  if (!metaRaw) return null;
  let meta;
  try { meta = JSON.parse(metaRaw); } catch (e) { return null; }
  const keys = [];
  for (let i = 0; i < meta.n; i++) keys.push(SNAP_PREFIX + i);
  const got = cache.getAll(keys);
  let json = "";
  for (let i = 0; i < meta.n; i++) {
    const part = got[SNAP_PREFIX + i];
    if (part == null) return null; // a chunk expired — treat the whole snapshot as missing
    json += part;
  }
  try { return JSON.parse(json); } catch (e) { return null; }
}

function snapClear_() {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get(SNAP_PREFIX + "meta");
  const keys = [SNAP_PREFIX + "meta"];
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      for (let i = 0; i < meta.n; i++) keys.push(SNAP_PREFIX + i);
    } catch (e) {}
  }
  cache.removeAll(keys);
}

// Reads the Current window ONCE and caches it. This is the only full-tab read
// left, and it runs on a trigger — never on a user's request path.
function buildSnapshot_() {
  const sheet = getCurrentSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), SHEET_HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const dateIdx = headers.indexOf("Date");
  const tsIdx = headers.indexOf("Timestamp");
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

  const rows = [];
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let i = 0; i < values.length; i++) {
      if (rowInWindow_(values[i], dateIdx, tsIdx, cutoff)) rows.push(serializeRow_(values[i]));
    }
  }
  const payload = {
    gen: currentGen_(),
    cursor: lastRow,   // the client resumes deltas from this row index
    headers: headers,
    rows: rows,
    count: rows.length,
    builtAt: Date.now()
  };
  snapPut_(payload);
  return payload;
}

// Serve a snapshot, rebuilding only when stale. Under concurrent load exactly
// ONE request rebuilds; everyone else serves the slightly-stale copy instead of
// piling onto the Spreadsheet service — which is precisely what produced the
// "Too many scripts running simultaneously" HTML page.
function getSnapshot_() {
  const snap = snapGet_();
  const gen = currentGen_();
  const fresh = snap && snap.gen === gen && (Date.now() - (snap.builtAt || 0) < SNAP_MAX_AGE_MS);
  if (fresh) return snap;

  const lock = LockService.getScriptLock();
  const got = lock.tryLock(500);
  if (!got && snap) return snap; // another execution is rebuilding — stale is fine
  try {
    const again = snapGet_();
    if (again && again.gen === gen && (Date.now() - (again.builtAt || 0) < SNAP_MAX_AGE_MS)) {
      return again;
    }
    return buildSnapshot_();
  } finally {
    if (got) { try { lock.releaseLock(); } catch (e) {} }
  }
}

// Time-trigger entry point (installed by ensureMaintenanceTriggers).
function rebuildSnapshot() {
  buildSnapshot_();
}

// The tab the app reads from and new rows are written to. Created on demand.
function getCurrentSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let cur = ss.getSheetByName("Current");
  if (!cur) {
    cur = ss.insertSheet("Current", 0); // first tab
    cur.appendRow(SHEET_HEADERS);
    cur.setFrozenRows(1);
  }
  return cur;
}

// Get-or-create the immutable weekly tab for a label like "2026-W27" (or the
// "Undated" catch-all). New tabs get the header row + a frozen header. This
// NEVER clears or rewrites existing data — weekly tabs are append-only.
function getWeekSheet(label) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(label);
  if (sh) return sh;
  sh = ss.insertSheet(label);
  sh.appendRow(SHEET_HEADERS);
  sh.setFrozenRows(1);
  return sh;
}

// Parse a row's date (from the Date column, fallback Timestamp) to a Date.
function rowDate_(row, dateIdx, tsIdx) {
  let d = new Date(row[dateIdx]);
  if (isNaN(d.getTime()) && tsIdx >= 0) d = new Date(row[tsIdx]);
  return isNaN(d.getTime()) ? null : d;
}

// Move rows older than CURRENT_DAYS from Current into their ISO-week tabs.
// Runs daily from purgeOldFiles. Locked so it never overlaps a submission write.
//
// BATCHED + RESUMABLE: files at most ROLL_WEEKS_PER_RUN weeks per run under a
// time budget, so the FIRST roll against a huge Current (e.g. tens of thousands
// of backlogged rows) can't overrun the Spreadsheet service the way an all-at-
// once run would ("Service Spreadsheets timed out"). Returns true when aged rows
// still remain — purgeOldFiles then schedules a ~2-min catch-up run, which
// chews through the backlog automatically until it's clear.
//
// APPEND-ONLY to weekly tabs (never rewritten); only Current is rewritten, and
// in original row order minus exactly the rows moved this run. Idempotent: rows
// whose ID already exists in the target week tab are not re-appended, so a
// partial run that failed before rewriting Current can't create duplicates.
function rollCurrentToWeeklyTabs() {
  const ROLL_WEEKS_PER_RUN = 8;
  const MAX_MS = 3 * 60 * 1000; // leave headroom for the file purge in the same execution
  const startTime = Date.now();

  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return false; } // busy — try next cycle
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const cur = ss.getSheetByName("Current") || getCurrentSheet();
    if (cur.getLastRow() < 2) return false;
    const values = cur.getDataRange().getValues();
    const headers = values[0];
    const rows = values.slice(1);
    const dateIdx = headers.indexOf("Date");
    const tsIdx = headers.indexOf("Timestamp");
    const idIdx = headers.indexOf("ID");
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - CURRENT_DAYS);

    // Classify aged rows, keeping their original index so we can preserve order.
    const agedByWeek = {}; // weekLabel -> [{idx, row}]
    for (let i = 0; i < rows.length; i++) {
      const d = rowDate_(rows[i], dateIdx, tsIdx);
      if (d && d < cutoff) {
        const wk = isoWeek(rows[i][dateIdx] || (tsIdx >= 0 ? rows[i][tsIdx] : "")) || "Undated";
        (agedByWeek[wk] = agedByWeek[wk] || []).push({ idx: i, row: rows[i] });
      }
    }
    const weeks = Object.keys(agedByWeek).sort(); // oldest weeks first
    if (weeks.length === 0) return false; // nothing to roll

    function withRetry(fn) {
      for (let a = 0; a < 3; a++) {
        try { return fn(); }
        catch (e) { if (a === 2) throw e; Utilities.sleep(1200 * (a + 1)); }
      }
    }
    function weekSheet(label) {
      let sh = ss.getSheetByName(label);
      if (sh) return sh;
      sh = ss.insertSheet(label);
      sh.appendRow(SHEET_HEADERS);
      sh.setFrozenRows(1);
      return sh;
    }

    const moved = {};          // original row idx -> true (remove from Current)
    let processedWeeks = 0, moreRemaining = false;

    for (let w = 0; w < weeks.length; w++) {
      const wk = weeks[w];
      const entries = agedByWeek[wk];
      if (processedWeeks >= ROLL_WEEKS_PER_RUN || Date.now() - startTime > MAX_MS) {
        moreRemaining = true; // defer this week's rows to a later run (stay in Current)
        continue;
      }
      const sh = withRetry(function () { return weekSheet(wk); });
      const existing = {};
      if (idIdx >= 0 && sh.getLastRow() >= 2) {
        const ids = withRetry(function () {
          return sh.getRange(2, idIdx + 1, sh.getLastRow() - 1, 1).getValues();
        });
        for (let k = 0; k < ids.length; k++) existing[String(ids[k][0])] = true;
      }
      const toAppend = [];
      entries.forEach(function (e) {
        moved[e.idx] = true; // this week is processed → row leaves Current either way
        const id = idIdx >= 0 ? String(e.row[idIdx]) : "";
        if (id && existing[id]) return; // already filed by a prior partial run
        toAppend.push(e.row);
      });
      if (toAppend.length > 0) {
        withRetry(function () {
          sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
        });
      }
      SpreadsheetApp.flush();
      processedWeeks++;
    }

    // Rewrite Current = header + every row not moved this run, in original order
    // (recent rows + any aged rows we deferred). clearContents keeps formatting.
    const keep = [];
    for (let i = 0; i < rows.length; i++) if (!moved[i]) keep.push(rows[i]);
    cur.clearContents();
    cur.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (keep.length > 0) cur.getRange(2, 1, keep.length, keep[0].length).setValues(keep);
    cur.setFrozenRows(1);
    // Current was REWRITTEN, so every client's row cursor is now meaningless.
    // Bump the generation and drop the snapshot: clients see the gen change on
    // their next delta and re-seed instead of skipping or duplicating rows.
    bumpGen_();
    snapClear_();
    return moreRemaining;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ── ONE-TIME MIGRATION ────────────────────────────────────────────────────
// Run REPEATEDLY from the editor until the log says "No remaining weeks — DONE".
// Splits your existing legacy history ("Sheet1", or the first legacy tab if
// named differently) into immutable per-ISO-week tabs.
//
// Designed for a LARGE source (tens of thousands of rows): it does only a few
// weeks of work per run so it never overruns the Spreadsheet service (the
// "Service Spreadsheets timed out" error you hit when it tried to do it all at
// once). Just keep pressing Run — each pass files WEEKS_PER_RUN more weeks.
//
// IDEMPOTENT & RESUMABLE: a week whose tab already holds all its rows is skipped
// instantly; a partially-filled week is completed by ID (no duplicates).
// NON-DESTRUCTIVE: the source tab is never touched — verify the weekly tabs,
// then delete the source yourself if you want.
function migrateSheet1ToWeeklyTabs() {
  const WEEKS_PER_RUN = 6;              // small batches → avoids service timeouts
  const MAX_MS = 4 * 60 * 1000;         // hard stop well under the 6-min limit
  const startTime = Date.now();

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const reserved = ["Current","Failed Uploads","Purge Log","Sheet2","Analysis"];
  let src = ss.getSheetByName("Sheet1") || ss.getSheetByName("Archive");
  if (!src) src = ss.getSheets().find(function (s) {
    return reserved.indexOf(s.getName()) === -1 && !isWeekTabName(s.getName());
  });
  if (!src) { Logger.log("No source (Sheet1/legacy) tab found."); return; }

  const values = src.getDataRange().getValues();
  if (values.length < 2) { Logger.log("Source tab '" + src.getName() + "' is empty."); return; }
  const headers = values[0];
  const dateIdx = headers.indexOf("Date");
  const tsIdx = headers.indexOf("Timestamp");
  const idIdx = headers.indexOf("ID");

  // Group source rows by ISO week (skip blank/TEST rows).
  const byWeek = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] || String(row[0]) === "TEST") continue;
    const wk = isoWeek(row[dateIdx] || (tsIdx >= 0 ? row[tsIdx] : "")) || "Undated";
    (byWeek[wk] = byWeek[wk] || []).push(row);
  }

  // Retry wrapper for transient "Service Spreadsheets timed out" errors.
  function withRetry(fn) {
    for (let a = 0; a < 3; a++) {
      try { return fn(); }
      catch (e) { if (a === 2) throw e; Utilities.sleep(1500 * (a + 1)); }
    }
  }
  function weekSheet(label) {
    let sh = ss.getSheetByName(label);
    if (sh) return sh;
    sh = ss.insertSheet(label);
    sh.appendRow(SHEET_HEADERS);
    sh.setFrozenRows(1);
    return sh;
  }

  const weeks = Object.keys(byWeek).sort();
  let processed = 0, moved = 0, skipped = 0, doneAlready = 0, remaining = 0;

  for (let w = 0; w < weeks.length; w++) {
    const wk = weeks[w];
    const srcRows = byWeek[wk];

    // Fast skip: if the week tab already holds >= all its source rows, it's done.
    const existingSheet = ss.getSheetByName(wk);
    if (existingSheet && existingSheet.getLastRow() - 1 >= srcRows.length) {
      doneAlready++;
      continue;
    }

    // Budget guard — leave the rest for the next run.
    if (processed >= WEEKS_PER_RUN || Date.now() - startTime > MAX_MS) {
      remaining++;
      continue;
    }

    const sh = withRetry(function () { return weekSheet(wk); });
    // Existing IDs in this week tab → complete a partial week without duplicates.
    const existing = {};
    if (idIdx >= 0 && sh.getLastRow() >= 2) {
      const ids = withRetry(function () {
        return sh.getRange(2, idIdx + 1, sh.getLastRow() - 1, 1).getValues();
      });
      for (let k = 0; k < ids.length; k++) existing[String(ids[k][0])] = true;
    }
    const toAppend = [];
    srcRows.forEach(function (row) {
      const id = idIdx >= 0 ? String(row[idIdx]) : "";
      if (id && existing[id]) { skipped++; return; }
      toAppend.push(row);
    });
    if (toAppend.length > 0) {
      withRetry(function () {
        sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
      });
      moved += toAppend.length;
    }
    SpreadsheetApp.flush(); // commit each week before moving on
    processed++;
  }

  Logger.log("Migration from '" + src.getName() + "': this run filed " + processed
    + " week tab(s) (" + moved + " rows, " + skipped + " already present); "
    + doneAlready + " week(s) already complete."
    + (remaining > 0
        ? " " + remaining + " week(s) REMAINING — press Run again to continue."
        : " No remaining weeks — DONE. Source tab left intact."));
}

// ── ONE-TIME SETUP ────────────────────────────────────────────────────────
// Run this ONCE from the editor after deploying. It copies the last CURRENT_DAYS
// of rows from your existing history tab into "Current" so the dashboard has
// recent data immediately. Safe to re-run (it rebuilds Current from scratch).
// Ignores weekly tabs when locating the source history.
function seedCurrentFromHistory() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const reserved = ["Current","Failed Uploads","Purge Log","Sheet2","Analysis"];
  let history = ss.getSheetByName("Sheet1") || ss.getSheetByName("Archive");
  if (!history) history = ss.getSheets().find(function (s) {
    return reserved.indexOf(s.getName()) === -1 && !isWeekTabName(s.getName());
  });
  if (!history) { Logger.log("No history tab found."); return; }

  const values = history.getDataRange().getValues();
  if (values.length < 2) { Logger.log("History tab is empty."); return; }
  const headers = values[0];
  const dateIdx = headers.indexOf("Date");
  const tsIdx = headers.indexOf("Timestamp");

  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - CURRENT_DAYS);

  const recent = [];
  for (let i = 1; i < values.length; i++) {
    const d = rowDate_(values[i], dateIdx, tsIdx);
    if (d && d >= cutoff) recent.push(values[i]);
  }

  let cur = ss.getSheetByName("Current");
  if (cur) ss.deleteSheet(cur);
  cur = ss.insertSheet("Current", 0);
  cur.appendRow(headers);
  cur.setFrozenRows(1);
  if (recent.length > 0) cur.getRange(2, 1, recent.length, recent[0].length).setValues(recent);
  // Current was rebuilt from scratch — invalidate client cursors (see bumpGen_).
  bumpGen_();
  snapClear_();
  Logger.log("Seeded Current with " + recent.length + " rows from the last " + CURRENT_DAYS + " days.");
}

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else {
      throw new Error("No data received");
    }

    // ── ACTION: logFailed ────────────────────────────────────────────────
    if (data.action === "logFailed") {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      let failSheet = ss.getSheetByName("Failed Uploads");
      if (!failSheet) {
        failSheet = ss.insertSheet("Failed Uploads");
        failSheet.appendRow([
          "ID","Timestamp","Date","HourSlot","Store","TL",
          "Supervisor","AM","CityManager","TotalFiles","Reason","DeviceInfo"
        ]);
        failSheet.getRange(1,1,1,12).setBackground("#E31E24").setFontColor("#FFFFFF").setFontWeight("bold");
        failSheet.setFrozenRows(1);
      }
      failSheet.appendRow([
        data.id, data.timestamp, data.date, data.hourSlot,
        data.store, data.tl, data.supervisor, data.am,
        data.cityManager, data.totalFiles, data.reason, data.deviceInfo
      ]);
      failSheet.getRange(failSheet.getLastRow(), 1, 1, 12).setBackground("#FFE0E0");
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "logFailed" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ACTION: addFile ──────────────────────────────────────────────────
    // Saves ONE file to the hour folder. Idempotent: if a file with the same
    // recordId+index prefix already exists, it is skipped. This makes retries
    // safe and means no single request is ever large enough to time out.
    if (data.action === "addFile") {
      const hourFolder = getHourFolder(data.store, data.date, data.hourSlot);
      const prefix = data.recordId + "__" + data.index + "__";
      const safeName = prefix + (data.fileName || "file");
      // Idempotent retry: skip if this exact file already exists. Look it up by
      // NAME (O(1)) instead of scanning every file in the hour folder, which
      // got progressively slower — and burned Drive quota — as the folder
      // filled during a busy hour.
      if (hourFolder.getFilesByName(safeName).hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, skipped: true })).setMimeType(ContentService.MimeType.JSON);
      }
      const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType, safeName);
      const file = hourFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ACTION: addChunk ─────────────────────────────────────────────────
    // Stores one ~900KB piece of a large file (video) in a _tmp subfolder.
    // Idempotent: a chunk that already exists is skipped. Keeps every request
    // tiny so uploads never fail on large files.
    if (data.action === "addChunk") {
      const hourFolder = getHourFolder(data.store, data.date, data.hourSlot);
      const tmp = getTmpFolder(hourFolder);
      const chunkName = data.recordId + "__f" + data.fileIndex + "__c" + data.chunkIndex;
      const existing = tmp.getFilesByName(chunkName);
      if (existing.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, skipped: true })).setMimeType(ContentService.MimeType.JSON);
      }
      tmp.createFile(chunkName, data.data, "text/plain");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ACTION: assembleFile ─────────────────────────────────────────────
    // Reassembles all chunks of a file into the real Drive file, then deletes
    // the temp chunks. Idempotent: if the real file already exists, it returns
    // success. If a chunk is missing, returns success:false so the app resends.
    if (data.action === "assembleFile") {
      const hourFolder = getHourFolder(data.store, data.date, data.hourSlot);
      const realPrefix = data.recordId + "__" + data.fileIndex + "__";
      // Already assembled?
      const check = hourFolder.getFiles();
      while (check.hasNext()) {
        if (check.next().getName().indexOf(realPrefix) === 0) {
          return ContentService.createTextOutput(JSON.stringify({ success: true, alreadyExists: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      let tf = hourFolder.getFoldersByName("_tmp");
      if (!tf.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, reason: "no tmp" })).setMimeType(ContentService.MimeType.JSON);
      }
      const tmp = tf.next();
      let b64 = "";
      for (let c = 0; c < data.totalChunks; c++) {
        const cn = data.recordId + "__f" + data.fileIndex + "__c" + c;
        const it = tmp.getFilesByName(cn);
        if (!it.hasNext()) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, missingChunk: c })).setMimeType(ContentService.MimeType.JSON);
        }
        b64 += it.next().getBlob().getDataAsString();
      }
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), data.mimeType, realPrefix + (data.fileName || "file"));
      const real = hourFolder.createFile(blob);
      real.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      // Cleanup temp chunks for this file
      for (let c = 0; c < data.totalChunks; c++) {
        const cn = data.recordId + "__f" + data.fileIndex + "__c" + c;
        const it = tmp.getFilesByName(cn);
        while (it.hasNext()) it.next().setTrashed(true);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ACTION: finalize ─────────────────────────────────────────────────
    // Writes the Sheet row AFTER all files are uploaded. Idempotent: if a row
    // with this ID already exists, it is not duplicated. Gathers this record's
    // file links from the folder.
    if (data.action === "finalize") {
      const sheet = getCurrentSheet();
      ensureWeekHeader(sheet);
      // NOTE: filing old rows into weekly tabs is NOT done here — doing it on
      // every submission acquired a global lock + rewrote the whole sheet, which
      // caused "too many scripts running" at busy hours. It now runs once a day
      // from the daily maintenance trigger (rollCurrentToWeeklyTabs in purge).
      // Idempotency: skip if this row already exists. Only scan the LAST ~1000
      // rows' ID column — a duplicate finalize is always a retry of a very
      // recent submission, so this avoids reading the entire (large) sheet on
      // every write, which was exhausting the execution quota and stopping
      // writes entirely at scale.
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const from = Math.max(2, lastRow - 1000);
        const ids = sheet.getRange(from, 1, lastRow - from + 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(data.id)) {
            return ContentService.createTextOutput(JSON.stringify({ success: true, alreadyExists: true })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      const hourFolder = getHourFolder(data.store, data.date, data.hourSlot);
      // Collect this record's file links
      const links = [];
      const recPrefix = data.id + "__";
      const fit = hourFolder.getFiles();
      while (fit.hasNext()) {
        const f = fit.next();
        if (f.getName().indexOf(recPrefix) === 0) links.push(f.getUrl());
      }
      const sections = typeof data.sections === "string" ? JSON.parse(data.sections) : (data.sections || {});
      ensureWeekHeader(sheet);
      sheet.appendRow([
        data.id, data.timestamp, data.date, data.hourSlot, data.store,
        data.tl, data.supervisor, data.am, data.cityManager,
        (sections.inside  || []).length,
        (sections.outside || []).length,
        (sections.parking || []).length,
        data.totalFiles,
        hourFolder.getUrl(),
        links.join(", "),
        isoWeek(data.date || data.timestamp)
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── LEGACY: single-payload submission (kept as fallback) ─────────────
    const sheet = getCurrentSheet();
    const hourFolder = getHourFolder(data.store, data.date, data.hourSlot);
    const driveLinks = [];
    const files = typeof data.files === "string" ? JSON.parse(data.files) : (data.files || []);
    files.forEach(f => {
      try {
        const blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType, f.name);
        const driveFile = hourFolder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        driveLinks.push(driveFile.getUrl());
      } catch(fileErr) { console.warn("File save error:", fileErr.message); }
    });
    const sections = typeof data.sections === "string" ? JSON.parse(data.sections) : (data.sections || {});
    ensureWeekHeader(sheet);
    sheet.appendRow([
      data.id, data.timestamp, data.date, data.hourSlot, data.store,
      data.tl, data.supervisor, data.am, data.cityManager,
      (sections.inside || []).length, (sections.outside || []).length, (sections.parking || []).length,
      data.totalFiles, hourFolder.getUrl(), driveLinks.join(", "),
      isoWeek(data.date || data.timestamp)
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    console.error("doPost error:", err.message);
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Build the store -> {tl, supervisor, am, cityManager} mapping from the live
// store-list sheet. Cached 10 min in CacheService to keep responses fast.
function getStoreMappingJSON() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("store_mapping_v1");
  if (cached) return cached;

  const ss = SpreadsheetApp.openById(STORE_LIST_SHEET_ID);
  // Use Sheet1 explicitly; fall back to the first sheet if not found
  const sheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return JSON.stringify({ mapping: {}, order: [] });

  // Locate columns by header so the layout can shift without breaking
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const col = (names) => {
    for (const n of names) { const i = headers.indexOf(n); if (i !== -1) return i; }
    return -1;
  };
  const cStore = col(["store", "stores", "store name", "dark store", "darkstore", "location", "site"]);
  const cTL    = col(["tl", "tls", "team leader", "teamleader", "team lead"]);
  const cSup   = col(["supervisor", "supervisors", "sup"]);
  const cAM    = col(["am", "ams", "assistant manager", "asst manager", "asst. manager", "area manager"]);
  const cCM    = col(["city manager", "citymanager", "city managers", "manager", "cm"]);

  const mapping = {};
  const order = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const store = cStore === -1 ? "" : String(row[cStore]).trim();
    if (!store) continue; // skip blank rows
    mapping[store] = {
      tl:          cTL  === -1 ? "" : String(row[cTL]).trim(),
      supervisor:  cSup === -1 ? "" : String(row[cSup]).trim(),
      am:          cAM  === -1 ? "" : String(row[cAM]).trim(),
      cityManager: cCM  === -1 ? "" : String(row[cCM]).trim(),
    };
    order.push(store);
  }

  const json = JSON.stringify({ mapping: mapping, order: order, count: order.length });
  // Only cache a GOOD result — never poison the cache with an empty/failed read
  if (order.length > 0) cache.put("store_mapping_v1", json, 600);
  return json;
}

// Run from the editor to clear the 10-min store cache immediately (e.g. right
// after you add stores to the sheet and want them live now instead of waiting).
function clearStoreCache() {
  CacheService.getScriptCache().remove("store_mapping_v1");
}

function doGet(e) {
  const P = (e && e.parameter) ? e.parameter : {};
  const json = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };

  // ── LIVE STORE LIST: ?stores ─────────────────────────────────────────
  // Reads the store-list spreadsheet (Store | TL | Supervisor | AM | City
  // Manager) and returns the mapping as JSON. Cached 10 min so the dashboard
  // and upload screen stay fast. Changing that sheet updates the app
  // automatically (within the cache window) — no redeploy needed.
  if (P.stores !== undefined) {
    return ContentService.createTextOutput(getStoreMappingJSON())
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── FILE COUNT: ?fileCount=ID&store=X&date=Y&slot=Z ──────────────────
  // How many of this record's files are in its folder, plus WHICH indices are
  // present, so the app resends only what's missing.
  // NOTE: this no longer opens the spreadsheet. `getCurrentSheet()` used to run
  // ABOVE this branch, so every file-count ping opened the whole Spreadsheet —
  // ~3 per submission across 166 stores at the top of each hour — to read data
  // this endpoint never looks at.
  if (P.fileCount) {
    const recId = String(P.fileCount);
    try {
      const hourFolder = getHourFolder(P.store, P.date, P.slot);
      const prefix = recId + "__";
      const indexSet = {};
      const fit = hourFolder.getFiles();
      while (fit.hasNext()) {
        const name = fit.next().getName();
        if (name.indexOf(prefix) !== 0) continue;
        const rest = name.substring(prefix.length);
        const idx = parseInt(rest.split("__")[0], 10);
        if (!isNaN(idx)) indexSet[idx] = true;
      }
      const indices = Object.keys(indexSet).map(function (n) { return parseInt(n, 10); });
      return json({ count: indices.length, indices: indices });
    } catch (err) {
      return json({ count: 0, indices: [] });
    }
  }

  // ── FAST VERIFICATION: ?check=RECORD_ID ──────────────────────────────
  // Reads ONLY the ID column of the last ~1000 rows — never the whole tab.
  // The old code ran `sheet.getDataRange().getValues()`, pulling every row ×
  // every column on EVERY verification (up to 3 per submission, ~166 stores
  // firing at once). That one line was the main generator of the "Too many
  // scripts running simultaneously" page — which then made this very endpoint
  // fail, marking landed submissions as failed and re-queueing them.
  //
  // Deliberately NOT served from the snapshot: finalize→check happens within
  // seconds, and a stale snapshot would report a row that DID land as missing,
  // recreating the exact false-failure loop this is meant to kill.
  if (P.check) {
    const targetId = String(P.check);
    const sheet = getCurrentSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return json({ found: false });
    // +1 so the span is exactly CHECK_TAIL_ROWS rows, not one more.
    const from = Math.max(2, lastRow - CHECK_TAIL_ROWS + 1);
    const ids = sheet.getRange(from, 1, lastRow - from + 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === targetId) return json({ found: true });
    }
    return json({ found: false });
  }

  // ── SEED: ?seed=1 ────────────────────────────────────────────────────
  // The single bounded window fetch that primes a device's local cache. Served
  // from the cached snapshot, so N devices seeding costs ~0 Spreadsheet reads.
  // Compact [[...]] + headers (no repeated JSON keys), plus the cursor and gen
  // the client resumes delta syncing from.
  if (P.seed !== undefined) {
    const snap = getSnapshot_();
    return json({
      gen: snap.gen,
      cursor: snap.cursor,
      headers: snap.headers,
      rows: snap.rows,
      count: snap.count,
      builtAt: snap.builtAt
    });
  }

  // ── DELTA: ?since=<cursor>&gen=<gen> ─────────────────────────────────
  // ONLY the rows appended after the client's cursor. Cost is O(new rows) and
  // is independent of how large Current or the history grows — this is the hot
  // path every device hits once an hour.
  //
  // `Current` is append-only between rolls, so a row index is a valid cursor.
  // The nightly roll REWRITES Current, which is why gen exists: a gen mismatch
  // (or an impossible cursor) tells the client to re-seed rather than silently
  // skip or duplicate rows.
  if (P.since !== undefined) {
    const gen = currentGen_();
    if (String(P.gen || "") !== gen) return json({ reseed: true, gen: gen });

    const sheet = getCurrentSheet();
    const lastRow = sheet.getLastRow();
    const since = Math.max(1, parseInt(P.since, 10) || 1);
    if (since > lastRow) return json({ reseed: true, gen: gen }); // Current shrank unexpectedly
    if (lastRow <= since) {
      return json({ gen: gen, cursor: lastRow, headers: [], rows: [], count: 0 });
    }

    const lastCol = Math.max(sheet.getLastColumn(), SHEET_HEADERS.length);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const dateIdx = headers.indexOf("Date");
    const tsIdx = headers.indexOf("Timestamp");
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

    const values = sheet.getRange(since + 1, 1, lastRow - since, lastCol).getValues();
    const rows = [];
    for (let i = 0; i < values.length; i++) {
      if (rowInWindow_(values[i], dateIdx, tsIdx, cutoff)) rows.push(serializeRow_(values[i]));
    }
    return json({ gen: gen, cursor: lastRow, headers: headers, rows: rows, count: rows.length });
  }

  // ── LEGACY FULL FETCH (no parameters) ────────────────────────────────
  // Unchanged wire format — an array of row OBJECTS for the last WINDOW_DAYS —
  // so a browser still running the PREVIOUS App.tsx keeps working after this
  // script is deployed. Now served from the snapshot instead of a live
  // full-tab read, so even the old client no longer strains the quota.
  const snap = getSnapshot_();
  const headers = snap.headers;
  const out = snap.rows.map(function (row) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    return obj;
  });
  return json(out);
}

function purgeOldFiles() {
  // Daily maintenance also files rows older than CURRENT_DAYS from Current into
  // their immutable weekly tabs here (moved off the per-submission path to
  // avoid lock contention at busy hours). The roll is batched and returns true
  // when aged rows still remain, so we resume it via the catch-up trigger below.
  let rollMore = false;
  try { rollMore = rollCurrentToWeeklyTabs(); } catch (e) {}

  const RETENTION_DAYS = 10;
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const now = new Date();
  const startTime = Date.now();
  const MAX_MS = 5 * 60 * 1000; // stop ~1 min before Apps Script's 6-min limit

  // Cutoff = midnight today (UTC) minus retention. Date folders dated before
  // this are past retention and their files get purged.
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

  // Derive a date folder's date from its NAME (e.g. "20 May 2026"); fall back
  // to its creation time if the name isn't parseable.
  function folderDate(folder) {
    const byName = new Date(folder.getName());
    if (!isNaN(byName.getTime())) return byName;
    return folder.getDateCreated();
  }

  let totalDeleted = 0, totalFreedMB = 0, stoppedEarly = false;

  const storeFolders = rootFolder.getFolders();
  outer:
  while (storeFolders.hasNext()) {
    const storeFolder = storeFolders.next();
    const dateFolders = storeFolder.getFolders();
    while (dateFolders.hasNext()) {
      if (Date.now() - startTime > MAX_MS) { stoppedEarly = true; break outer; }
      const dateFolder = dateFolders.next();
      const d = folderDate(dateFolder);
      if (d >= cutoff) continue; // still within retention window — keep

      // FILES LIVE INSIDE HOUR SUBFOLDERS: Store -> Date -> HourSlot -> files
      // (The old code looked in the Date folder directly and found nothing,
      //  which is why every purge logged "Nothing to delete".)
      const hourFolders = dateFolder.getFolders();
      while (hourFolders.hasNext()) {
        const hourFolder = hourFolders.next();
        // 1) delete the real files in the hour folder
        const files = hourFolder.getFiles();
        while (files.hasNext()) {
          const f = files.next();
          totalFreedMB += f.getSize() / (1024 * 1024);
          f.setTrashed(true);
          totalDeleted++;
        }
        // 2) clean any leftover _tmp chunk folders (abandoned chunked uploads)
        const subs = hourFolder.getFolders();
        while (subs.hasNext()) {
          const sub = subs.next();
          const sf = sub.getFiles();
          while (sf.hasNext()) {
            const cf = sf.next();
            totalFreedMB += cf.getSize() / (1024 * 1024);
            cf.setTrashed(true);
            totalDeleted++;
          }
        }
      }
      // NOTE: we NEVER delete folders — they stay as a permanent audit trail
      // of when each store submitted. Only the files inside are purged.
    }
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let purgeLog = ss.getSheetByName("Purge Log");
  if (!purgeLog) {
    purgeLog = ss.insertSheet("Purge Log");
    purgeLog.appendRow(["Timestamp","Files Deleted","Space Freed (MB)","Cutoff Date","Note"]);
  }
  purgeLog.appendRow([
    new Date().toISOString(),
    totalDeleted,
    totalFreedMB.toFixed(2),
    cutoff.toUTCString(),
    stoppedEarly
      ? `Deleted ${totalDeleted} files; stopped early (time limit) — auto-resuming in ~2 min`
      : (totalDeleted > 0
          ? `Deleted ${totalDeleted} files older than ${RETENTION_DAYS} days`
          : "Nothing to delete")
  ]);

  // The roll rewrites Current and drops the snapshot. Rebuild it once here, at
  // the end of maintenance, so the first dashboard to open afterwards is served
  // from cache instead of paying for a full-tab read itself.
  try { buildSnapshot_(); } catch (e) {}

  // ── SELF-RESCHEDULE ───────────────────────────────────────────────────
  // If the file purge OR the weekly roll still has backlog, schedule a one-time
  // trigger to resume in ~2 minutes. When both finish clean, remove any leftover
  // catch-up triggers. This lets a large backlog (files AND the first big roll)
  // chew through on its own, then settle back into the normal nightly schedule.
  if (stoppedEarly || rollMore) {
    ensureCatchUpTrigger();
  } else {
    clearCatchUpTriggers();
  }
}

// Create a one-time "resume in ~2 min" trigger, but only if one isn't already
// pending (avoids stacking duplicates).
function ensureCatchUpTrigger() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "purgeCatchUp");
  if (existing.length > 0) return;
  ScriptApp.newTrigger("purgeCatchUp").timeBased().after(2 * 60 * 1000).create();
}

// Remove all pending one-time catch-up triggers (called when backlog is clear).
function clearCatchUpTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "purgeCatchUp")
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// The catch-up entry point fired by the one-time trigger. It removes the
// trigger that invoked it (one-time triggers don't auto-delete), then runs
// the purge again — which will re-schedule itself if there's still backlog.
function purgeCatchUp() {
  clearCatchUpTriggers();
  purgeOldFiles();
}

// ── TRIGGER INSTALLER ─────────────────────────────────────────────────────
// Run ONCE from the editor after deploying. Idempotent: existing triggers for
// these handlers are deleted first, so pressing Run twice never stacks copies.
//
// Installs:
//   1. purgeOldFiles   — daily (~3 AM). Purges Drive files past retention AND
//                        rolls aged rows out of Current into weekly tabs.
//   2. rebuildSnapshot — every 10 minutes. Keeps the cached read snapshot warm
//                        so dashboard seeds never touch the Spreadsheet service.
//
// 10 minutes is the recommended interval: it matches SNAP_MAX_AGE_MS, costs
// ~144 executions/day (comfortably inside quota), and means a seed is at most
// 10 minutes stale — which is harmless, because the client immediately deltas
// forward from the snapshot's own cursor and catches up in one cheap call.
function ensureMaintenanceTriggers() {
  const wanted = ["purgeOldFiles", "rebuildSnapshot"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("purgeOldFiles").timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger("rebuildSnapshot").timeBased().everyMinutes(10).create();
  buildSnapshot_(); // prime immediately so the very first read is already cached
  Logger.log("Installed: purgeOldFiles (daily ~3 AM) + rebuildSnapshot (every 10 min). Snapshot primed.");
}

function testSheet() {
  const sheet = getCurrentSheet();
  sheet.appendRow(["TEST", new Date().toISOString(), "Connection OK"]);
}

// ── WHATSAPP ALERTS (free via CallMeBot) ────────────────────────────────
// SETUP (one-time, 2 minutes):
// 1. Save +34 644 51 95 23 ("CallMeBot") to your phone contacts
// 2. Send this WhatsApp message to it: "I allow callmebot to send me messages"
// 3. You'll receive an API key. Paste it into WHATSAPP_API_KEY below
// 4. Put your number (with country code, no +) into WHATSAPP_PHONE
const WHATSAPP_PHONE = "971500000000";        // ← your number, e.g. 9715XXXXXXXX
const WHATSAPP_API_KEY = "PASTE_YOUR_KEY";    // ← key from CallMeBot

function sendWhatsApp(message) {
  if (WHATSAPP_API_KEY === "PASTE_YOUR_KEY") {
    console.warn("WhatsApp not configured — skipping alert");
    return;
  }
  try {
    const url = "https://api.callmebot.com/whatsapp.php"
      + "?phone=" + WHATSAPP_PHONE
      + "&text=" + encodeURIComponent(message)
      + "&apikey=" + WHATSAPP_API_KEY;
    UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (err) {
    console.error("WhatsApp send failed:", err.message);
  }
}

// Daily flagged-store digest — run via a trigger (e.g. once at 6 PM)
// Counts how many slots each store missed today and WhatsApps a summary
function sendDailyFlaggedAlert() {
  const sheet = getCurrentSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateCol = headers.indexOf("Date");
  const storeCol = headers.indexOf("Store");
  if (dateCol === -1 || storeCol === -1) return;

  // Today's date in "DD Mon YYYY" to match how the app stores it
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const todayStr = String(now.getDate()).padStart(2,"0") + " " + months[now.getMonth()] + " " + now.getFullYear();

  // Count submissions per store today
  const counts = {};
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][dateCol];
    let normalized = rowDate;
    try {
      const d = new Date(rowDate);
      if (!isNaN(d.getTime())) {
        normalized = String(d.getDate()).padStart(2,"0") + " " + months[d.getMonth()] + " " + d.getFullYear();
      }
    } catch (e) {}
    if (normalized === todayStr) {
      const store = data[i][storeCol];
      counts[store] = (counts[store] || 0) + 1;
    }
  }

  // Expected slots elapsed so far today (8AM–10PM = 14 slots)
  const hour = now.getHours();
  let elapsed = 0;
  if (hour >= 8 && hour < 22) elapsed = hour - 8;
  else if (hour >= 22) elapsed = 14;
  if (elapsed === 0) return; // too early to flag

  // Find stores below 90% adherence
  const flagged = [];
  for (const store in counts) {
    const pct = Math.round((counts[store] / elapsed) * 100);
    if (pct < 90) flagged.push(store + " (" + pct + "%)");
  }

  if (flagged.length === 0) {
    sendWhatsApp("✅ noon Minutes — All stores meeting 90% adherence as of " + hour + ":00. Great work!");
  } else {
    const msg = "⚠️ noon Minutes — Flagged stores (below 90%) as of " + hour + ":00:\n\n"
      + flagged.slice(0, 30).join("\n")
      + (flagged.length > 30 ? "\n\n…and " + (flagged.length - 30) + " more" : "");
    sendWhatsApp(msg);
  }
}
