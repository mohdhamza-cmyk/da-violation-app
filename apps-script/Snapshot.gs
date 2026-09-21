// ══════════════════════════════════════════════════════════════════════════
// Snapshot.gs — bounded reads, cached snapshot, and delta sync.
//
// This is a SECOND file in the same Apps Script project. Apps Script shares one
// global scope across files, so everything here can call functions defined in
// Code.gs (getCurrentSheet, getHourFolder, SHEET_HEADERS, getStoreMappingJSON).
//
// Code.gs needs exactly ONE change: its old `doGet` is renamed to
// `doGetLegacy_` so the `doGet` below takes over. Nothing else is touched.
// ══════════════════════════════════════════════════════════════════════════

// Bounds every bulk read. The dashboard renders Today / 7 / 10 days, so nothing
// older is ever shipped to a device.
const WINDOW_DAYS = 11;

// How far back ?check looks for a just-written row. A verification is always a
// retry of a very recent submission, so a bounded tail is enough - and keeps the
// cost independent of total sheet size.
const CHECK_TAIL_ROWS = 1000;

// ── GENERATION ────────────────────────────────────────────────────────────
// Clients hold a ROW CURSOR into Current. That is valid while Current is only
// appended to, but the nightly roll REWRITES it, which would make every cursor
// silently skip or duplicate rows.
//
// So gen = the ID of the OLDEST row in Current. Appending never changes it;
// removing old rows always does. That makes it a pure function of the sheet -
// no stored state, and no edits needed in rollCurrentToWeeklyTabs or
// seedCurrentFromHistory. Cached briefly so a burst of requests costs one read.
function currentGen_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("cur_gen_v1");
  if (hit) return hit;
  const sheet = getCurrentSheet();
  const lastRow = sheet.getLastRow();
  const g = lastRow < 2 ? "empty" : String(sheet.getRange(2, 1).getValue());
  cache.put("cur_gen_v1", g, 30);
  return g;
}

// Date cells come back as Date objects; normalize to ISO so the wire format is
// stable however a column happens to be formatted.
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
// A cached copy of the Current window, so the SEED read - the only expensive
// read left - is served from CacheService rather than the Spreadsheet service.
// CacheService caps one value at 100KB, so the payload is chunked.
const SNAP_PREFIX = "snap_v1_";
const SNAP_TTL_SEC = 21600;              // 6h; the trigger refreshes long before this
const SNAP_MAX_AGE_MS = 10 * 60 * 1000;  // treat as stale after 10 min
const SNAP_CHUNK_CHARS = 90000;          // under the 100KB-per-value cap
const SNAP_MAX_CHUNKS = 24;              // ~2.1MB ceiling; larger => serve live

function snapPut_(payload) {
  const json = JSON.stringify(payload);
  const n = Math.ceil(json.length / SNAP_CHUNK_CHARS);
  if (n > SNAP_MAX_CHUNKS) return false;
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
    if (part == null) return null; // a chunk expired - treat the snapshot as missing
    json += part;
  }
  try { return JSON.parse(json); } catch (e) { return null; }
}

// Reads the Current window ONCE and caches it. Runs on a trigger, or lazily
// when stale - never repeatedly on user request paths.
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
    gen: lastRow < 2 ? "empty" : String(sheet.getRange(2, 1).getValue()),
    cursor: lastRow,
    headers: headers,
    rows: rows,
    count: rows.length,
    builtAt: Date.now()
  };
  snapPut_(payload);
  return payload;
}

// Serve a snapshot, rebuilding only when stale or when Current was rewritten.
// Under load exactly ONE execution rebuilds; the rest serve the slightly-stale
// copy instead of piling onto the Spreadsheet service - which is what produced
// the "Too many scripts running simultaneously" page.
function getSnapshot_() {
  const gen = currentGen_();
  const snap = snapGet_();
  const fresh = snap && snap.gen === gen && (Date.now() - (snap.builtAt || 0) < SNAP_MAX_AGE_MS);
  if (fresh) return snap;

  const lock = LockService.getScriptLock();
  const got = lock.tryLock(500);
  if (!got && snap) return snap;
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

// ── WEB APP ENTRY POINT ───────────────────────────────────────────────────
function doGet(e) {
  const P = (e && e.parameter) ? e.parameter : {};
  const json = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };

  // ── LIVE STORE LIST: ?stores ───────────────────────────────────────────
  if (P.stores !== undefined) {
    return ContentService.createTextOutput(getStoreMappingJSON())
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── FILE COUNT: ?fileCount=ID&store=X&date=Y&slot=Z ────────────────────
  // Deliberately does NOT open the spreadsheet. The old code called
  // getCurrentSheet() ABOVE this branch, so every file-count ping opened the
  // whole Spreadsheet - ~3 per submission across 166 stores at the top of each
  // hour - to read data this endpoint never looks at.
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

  // ── FAST VERIFICATION: ?check=RECORD_ID ────────────────────────────────
  // Reads ONLY the ID column of the last CHECK_TAIL_ROWS rows. The old code ran
  // sheet.getDataRange().getValues() on EVERY verification - the main generator
  // of the quota page, which then made this endpoint fail and mark landed
  // submissions as failed.
  //
  // Deliberately NOT snapshot-backed: finalize->check happens within seconds and
  // a stale snapshot would report a landed row as missing.
  if (P.check) {
    const targetId = String(P.check);
    const sheet = getCurrentSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return json({ found: false });
    const from = Math.max(2, lastRow - CHECK_TAIL_ROWS + 1);
    const ids = sheet.getRange(from, 1, lastRow - from + 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === targetId) return json({ found: true });
    }
    return json({ found: false });
  }

  // ── SEED: ?seed=1 ──────────────────────────────────────────────────────
  // One bounded window fetch that primes a device's cache, served from the
  // cached snapshot, plus the cursor and gen to resume delta syncing from.
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

  // ── DELTA: ?since=<cursor>&gen=<gen> ───────────────────────────────────
  // Only rows appended after the client's cursor. Cost is O(new rows),
  // independent of how large Current or the history gets.
  if (P.since !== undefined) {
    const gen = currentGen_();
    if (String(P.gen || "") !== gen) return json({ reseed: true, gen: gen });

    const sheet = getCurrentSheet();
    const lastRow = sheet.getLastRow();
    const since = Math.max(1, parseInt(P.since, 10) || 1);
    if (since > lastRow) return json({ reseed: true, gen: gen });
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

  // ── LEGACY FULL FETCH (no parameters) ──────────────────────────────────
  // Unchanged wire format - an array of row OBJECTS - so a browser still running
  // the previous App.tsx keeps working. Now snapshot-backed rather than a live
  // full-tab read.
  const snap = getSnapshot_();
  const headers = snap.headers;
  const out = snap.rows.map(function (row) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    return obj;
  });
  return json(out);
}

// ── TRIGGER INSTALLER ─────────────────────────────────────────────────────
// Run ONCE from the editor after saving. Idempotent: existing triggers for
// these handlers are deleted first, so running it twice never stacks copies.
//
//   purgeOldFiles   - daily (~3 AM). Purges Drive files past retention AND
//                     rolls aged rows out of Current into weekly tabs.
//   rebuildSnapshot - every 10 minutes. Keeps the cached read snapshot warm.
function ensureMaintenanceTriggers() {
  const wanted = ["purgeOldFiles", "rebuildSnapshot"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("purgeOldFiles").timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger("rebuildSnapshot").timeBased().everyMinutes(10).create();
  buildSnapshot_();
  Logger.log("Installed: purgeOldFiles (daily ~3 AM) + rebuildSnapshot (every 10 min). Snapshot primed.");
}

// ── DIAGNOSTIC ────────────────────────────────────────────────────────────
// Run from the editor and read the Execution log. Answers, definitively:
//   - how many days of data the Current tab actually holds
//   - whether any rows have a blank ID (those used to be dropped client-side)
//   - exactly what the snapshot would serve to a device
// Read-only: changes nothing.
function diagnoseCurrent() {
  const sheet = getCurrentSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), SHEET_HEADERS.length);
  Logger.log("Current tab: " + (lastRow - 1) + " data rows, " + lastCol + " columns");
  if (lastRow < 2) {
    Logger.log("EMPTY -> nothing to serve. Run seedCurrentFromHistory() once.");
    return;
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log("Headers: " + headers.join(" | "));
  const dateIdx = headers.indexOf("Date");
  const idIdx = headers.indexOf("ID");

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const byDate = {};
  let blankIds = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i][dateIdx];
    const key = (d instanceof Date)
      ? Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy")
      : String(d);
    byDate[key] = (byDate[key] || 0) + 1;
    if (idIdx >= 0 && (values[i][idIdx] === "" || values[i][idIdx] == null)) blankIds++;
  }
  const keys = Object.keys(byDate).sort();
  Logger.log("Distinct dates in Current: " + keys.length);
  for (let k = 0; k < keys.length; k++) Logger.log("   " + keys[k] + "  ->  " + byDate[keys[k]] + " rows");
  Logger.log("Rows with a BLANK ID: " + blankIds);

  const snap = buildSnapshot_();
  Logger.log("Snapshot would serve " + snap.count + " of those rows"
    + " (cursor=" + snap.cursor + ", gen=" + snap.gen + ")");
  Logger.log("If 'Distinct dates' is 1, the older data is not in Current -"
    + " it is in Sheet1 / the weekly tabs, and seedCurrentFromHistory() is needed.");
}
