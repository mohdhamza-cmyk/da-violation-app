// Backend acceptance harness: loads the REAL Code.gs into a stubbed Apps Script
// runtime and asserts both OUTPUT correctness and COST properties (which ranges
// were read). getDataRange() throws, so any hot path that still reads the whole
// sheet fails loudly.
import fs from "fs";
import vm from "vm";

const SRC = fs.readFileSync("apps-script/Code.gs", "utf8");
const HEADERS = ["ID","Timestamp","Date","HourSlot","Store","TL","Supervisor","AM","CityManager",
  "Inside_Count","Outside_Count","Parking_Count","TotalFiles","DriveLink","FileLinks","Week"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const d0 = new Date();
const fmt = (off) => { const d=new Date(d0); d.setDate(d.getDate()-off);
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

function makeCtx({ dataRows = 5000, oldRows = 200 } = {}) {
  const reads = [];           // every getRange() on the Current tab
  const opens = [];           // every openById()
  const rows = [];
  for (let i = 0; i < oldRows; i++)                    // outside the 11-day window
    rows.push([`old${i}`, new Date().toISOString(), fmt(40), "9:00 AM", "Store A",
      "T","S","A","C",5,5,5,15,"link","f1,f2",""]);
  for (let i = 0; i < dataRows; i++)                   // inside the window
    rows.push([`id${i}`, new Date().toISOString(), fmt(i % 5), "9:00 AM", `Store ${i%166}`,
      "T","S","A","C",5,5,5,15,"link","f1,f2",""]);
  rows.push(["TEST", new Date().toISOString(), fmt(0), "9:00 AM", "TEST",
    "T","S","A","C",0,0,0,0,"","",""]);              // must be filtered out

  const grid = [HEADERS, ...rows];
  const sheet = {
    getLastRow: () => grid.length,
    getLastColumn: () => HEADERS.length,
    getDataRange() { throw new Error("FORBIDDEN: getDataRange() on a request path"); },
    getRange(r, c, nr = 1, nc = 1) {
      reads.push({ r, c, nr, nc });
      return {
        getValues: () => grid.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)),
        setValues: () => {}, setValue: () => {}, getValue: () => "Week",
        setBackground(){return this;}, setFontColor(){return this;}, setFontWeight(){return this;},
      };
    },
    appendRow: (r) => grid.push(r),
    clearContents: () => {}, setFrozenRows: () => {}, getName: () => "Current",
  };
  const ss = {
    getSheetByName: (n) => (n === "Current" ? sheet : null),
    insertSheet: () => sheet, getSheets: () => [sheet], getId: () => "ss",
  };

  const store = {};                                   // PropertiesService
  const cache = {};                                   // CacheService (100KB/value enforced)
  const ctx = {
    console, JSON, Math, Date, String, Number, Object, Array, parseInt, isNaN, RegExp, Error,
    SpreadsheetApp: { openById: (id) => { opens.push(id); return ss; }, flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in store ? store[k] : null),
      setProperty: (k, v) => { store[k] = String(v); },
      getProperties: () => ({ ...store }),
    })},
    CacheService: { getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null),
      put: (k, v) => { if (v.length > 100000) throw new Error("cache value >100KB"); cache[k] = v; },
      putAll: (m) => { for (const k in m) {
        if (m[k].length > 100000) throw new Error(`cache value >100KB for ${k}`); cache[k] = m[k]; } },
      getAll: (keys) => { const o = {}; keys.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; },
      remove: k => { delete cache[k]; },
      removeAll: ks => ks.forEach(k => { delete cache[k]; }),
    })},
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ setMimeType: () => ({ text: s }) }) },
    DriveApp: { getFolderById: () => ({ getFolders: () => ({ hasNext: () => false }) }),
                Access: {}, Permission: {} },
    Utilities: { sleep: () => {} },
    Logger: { log: () => {} },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({
      everyDays: () => ({ atHour: () => ({ create: () => {} }) }), everyMinutes: () => ({ create: () => {} }),
      after: () => ({ create: () => {} }) }) }), deleteTrigger: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const call = (p) => JSON.parse(vm.runInContext(`doGet(${JSON.stringify({ parameter: p })})`, ctx).text);
  return { ctx, call, reads, opens, grid, cache, store,
           run: (expr) => vm.runInContext(expr, ctx) };
}

let P=0,F=0; const ok=(c,l)=>{ c?(P++,console.log("  ✓ "+l)):(F++,console.log("  ✗ FAIL: "+l)); };
const maxRowsRead = reads => reads.reduce((m,r)=>Math.max(m,r.nr),0);
const maxColsRead = reads => reads.reduce((m,r)=>Math.max(m,r.nc),0);

console.log("\n[P1] ?check is bounded (was a full getDataRange)");
{
  const { call, reads, grid } = makeCtx({ dataRows: 5000 });
  const recentId = grid[grid.length - 2][0];
  const r = call({ check: recentId });
  ok(r.found === true, "finds a recently written row");
  ok(maxRowsRead(reads) <= 1000, `reads at most 1000 rows (max ${maxRowsRead(reads)} of ${grid.length})`);
  ok(maxColsRead(reads) === 1, `reads only the ID column (max cols ${maxColsRead(reads)} of 16)`);
  const r2 = call({ check: "nope-not-here" });
  ok(r2.found === false, "unknown id returns found:false");
}

console.log("\n[P1] ?fileCount never opens the spreadsheet");
{
  const { call, opens } = makeCtx();
  const r = call({ fileCount: "id1", store: "Store A", date: fmt(0), slot: "9:00 AM" });
  ok(Array.isArray(r.indices), "returns an indices array");
  ok(opens.length === 0, `zero SpreadsheetApp.openById calls (was 1 per ping) — got ${opens.length}`);
}

console.log("\n[C2] ?seed then ?since — delta is O(new rows)");
{
  const { call, reads, grid, run } = makeCtx({ dataRows: 3000 });
  const seed = call({ seed: 1 });
  ok(seed.rows.length > 0 && Array.isArray(seed.rows[0]), "seed returns compact array-of-arrays");
  ok(seed.cursor === grid.length, `cursor = last row (${seed.cursor})`);
  ok(!seed.rows.some(r => r[0] === "TEST"), "TEST rows filtered out");
  ok(!seed.rows.some(r => String(r[0]).startsWith("old")), "rows outside the window filtered out");

  reads.length = 0;
  const seed2 = call({ seed: 1 });
  ok(reads.length === 0, `second seed served from cache with ZERO sheet reads (got ${reads.length})`);
  ok(seed2.count === seed.count, "cached seed matches");

}

console.log("\n[C2] delta returns only new rows, and re-seeds on gen change");
{
  const { call, reads, grid, run } = makeCtx({ dataRows: 2000 });
  const seed = call({ seed: 1 });
  const cursor = seed.cursor, gen = seed.gen;

  // Append 3 new rows directly to the backing grid
  run(`(function(){ var s = SpreadsheetApp.openById("x").getSheetByName("Current");
        for (var i = 0; i < 3; i++) s.appendRow(
          ["new"+i, new Date().toISOString(), ${JSON.stringify(fmt(0))}, "10:00 AM",
           "Store 1","T","S","A","C",5,5,5,15,"l","f",""]); })()`);

  reads.length = 0;
  const delta = call({ since: cursor, gen: gen });
  ok(delta.count === 3, `delta returned exactly the 3 new rows (got ${delta.count})`);
  ok(delta.cursor === cursor + 3, "cursor advanced by 3");
  ok(maxRowsRead(reads) <= 3, `read at most 3 data rows, not ${grid.length} (max ${maxRowsRead(reads)})`);

  const empty = call({ since: delta.cursor, gen: gen });
  ok(empty.count === 0, "no new rows ⇒ empty delta");

  const stale = call({ since: cursor, gen: "wrong-gen" });
  ok(stale.reseed === true, "gen mismatch ⇒ reseed");

  const impossible = call({ since: 999999, gen: gen });
  ok(impossible.reseed === true, "impossible cursor ⇒ reseed");
}

console.log("\n[C2] the nightly roll invalidates cursors (gen bump)");
{
  const { call, run } = makeCtx({ dataRows: 100 });
  const seed = call({ seed: 1 });
  run("bumpGen_(); snapClear_();");                 // what rollCurrentToWeeklyTabs does
  const after = call({ since: seed.cursor, gen: seed.gen });
  ok(after.reseed === true, "client with a pre-roll cursor is told to re-seed");
  const reseeded = call({ seed: 1 });
  ok(reseeded.gen !== seed.gen, "a fresh seed carries the new gen");
}

console.log("\n[Back-compat] legacy no-param fetch keeps the old object format");
{
  const { call } = makeCtx({ dataRows: 50 });
  const legacy = call({});
  ok(Array.isArray(legacy), "returns a bare array (unchanged shape)");
  ok(legacy[0] && typeof legacy[0] === "object" && !Array.isArray(legacy[0]), "elements are objects");
  ok("Store" in legacy[0] && "HourSlot" in legacy[0] && "ID" in legacy[0], "keyed by the same headers");
  ok(!legacy.some(r => r.Store === "TEST"), "TEST rows excluded as before");
}

console.log("\n[Snapshot] chunking respects the 100KB CacheService cap");
{
  const { call, cache } = makeCtx({ dataRows: 4000 });   // payload well over 100KB
  const seed = call({ seed: 1 });
  const keys = Object.keys(cache).filter(k => k.startsWith("snap_v1_") && k !== "snap_v1_meta");
  ok(keys.length > 1, `large window split across ${keys.length} cache chunks`);
  ok(keys.every(k => cache[k].length <= 100000), "no chunk exceeds the 100KB cap");
  const meta = JSON.parse(cache["snap_v1_meta"]);
  ok(meta.n === keys.length, "meta chunk count matches stored chunks");
  ok(seed.count > 0, "reassembled snapshot still yields rows");
}

console.log(`\n==== backend: ${P} pass, ${F} fail ====`);
process.exit(F ? 1 : 0);
