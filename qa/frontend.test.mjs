// Extracts the REAL logic functions from App.tsx and exercises them directly,
// so these assertions are about shipped code, not a reimplementation.
// Types are stripped with esbuild (not regex) so the extraction stays honest.
import fs from "fs";
import { transformSync } from "esbuild";
const SRC = fs.readFileSync("../frontend/src/App.tsx", "utf8");
const grab = (name) => {
  const re = new RegExp(`^function ${name}\\b[\\s\\S]*?\\n\\}`, "m");
  const m = SRC.match(re);
  if (!m) throw new Error("not found: " + name);
  return m[0];
};
const strip = (ts) => transformSync(ts, { loader: "ts" }).code;
const grabConst = (name) => {
  const m = SRC.match(new RegExp(`^const ${name} = .*?;`, "m"));
  if (!m) throw new Error("const not found: " + name);
  return m[0];
};

let code = [
  "norm","extractDate","extractHourSlot","slotLabelToHour","slotKey",
  "isRealRow","rowsFromCompact","cacheCutoffMs","withinCacheWindow",
].map(grab).join("\n");
code = [grabConst("CACHE_WINDOW_DAYS")].join("\n") + "\n" + code;
const js = strip(code);

const ctx = {};
new Function("ctx", js + "\nObject.assign(ctx,{norm,extractDate,extractHourSlot,slotLabelToHour,slotKey,isRealRow,rowsFromCompact,cacheCutoffMs,withinCacheWindow});")(ctx);
const { slotKey, isRealRow, rowsFromCompact, cacheCutoffMs, withinCacheWindow } = ctx;

let P=0,F=0; const ok=(c,l)=>{c?(P++,console.log("  ✓ "+l)):(F++,console.log("  ✗ FAIL: "+l));};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dayStr=(off)=>{const d=new Date();d.setDate(d.getDate()-off);
  return `${String(d.getDate()).padStart(2,"0")} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
const row=(o)=>({ID:"x",Store:"Deira",Date:dayStr(0),HourSlot:"8:00 AM",...o});

console.log("\n[P5] unique-slot key collapses duplicates");
{
  const a=row({}), b=row({ID:"y"});
  ok(slotKey(a)===slotKey(b),"two submissions, same store+date+slot ⇒ one key (retries don't inflate)");
  ok(slotKey(row({Store:"Deira"}))===slotKey(row({Store:" deira "})),
     "store name normalized (case + whitespace) — the old raw r.Store bug");
  ok(slotKey(row({HourSlot:"8:00 AM"}))===slotKey(row({HourSlot:"8:00AM"})),
     "slot label spacing normalized");
  ok(slotKey(row({HourSlot:"9:00 AM"}))!==slotKey(row({HourSlot:"8:00 AM"})),
     "genuinely different slots stay distinct");
  ok(slotKey(row({Date:dayStr(1)}))!==slotKey(row({Date:dayStr(0)})),
     "different dates stay distinct");
}

console.log("\n[P5] mixed clean-label and ISO HourSlot collapse to the same slot");
{
  const d=new Date(); d.setHours(8,0,0,0);
  const iso=row({HourSlot:d.toISOString()});
  const clean=row({HourSlot:"8:00 AM"});
  const isoH=ctx.slotLabelToHour(ctx.extractHourSlot(iso.HourSlot));
  ok(isoH===8,`ISO HourSlot parses to hour 8 (got ${isoH})`);
  ok(slotKey(iso)===slotKey(clean),"ISO row and '8:00 AM' row are ONE unique slot");
}

console.log("\n[P5] adherence: submitted never exceeds expected");
{
  const rows=[]; for(let i=0;i<20;i++) rows.push(row({ID:"r"+i})); // 20 retries, one slot
  const uniq=new Set(rows.map(slotKey));
  ok(uniq.size===1,`20 retries of one slot ⇒ submitted = 1 (got ${uniq.size})`);
  const full=[]; for(let h=8;h<=22;h++) full.push(row({ID:"h"+h,HourSlot:`${h%12||12}:00 ${h<12?"AM":"PM"}`}));
  full.push(row({ID:"dupe",HourSlot:"8:00 AM"}));           // a retry
  ok(new Set(full.map(slotKey)).size===15,"a fully-covered day = 15 unique slots despite a retry (⇒100%)");
}

console.log("\n[C2] compact wire format expands to row objects");
{
  const headers=["ID","Store","Date","HourSlot","TotalFiles"];
  const out=rowsFromCompact(headers,[["1","Deira",dayStr(0),"8:00 AM",15]]);
  ok(out.length===1 && out[0].Store==="Deira" && out[0].TotalFiles===15,"headers+arrays ⇒ keyed objects");
  ok(rowsFromCompact(null,null).length===0,"malformed payload ⇒ empty, no throw");
  ok(rowsFromCompact(headers,[]).length===0,"empty delta ⇒ no rows");
}

console.log("\n[C1] cache hygiene: junk and out-of-window rows are dropped");
{
  ok(isRealRow(row({}))===true,"a real row is kept");
  ok(isRealRow(row({Store:"TEST"}))===false,"TEST rows rejected");
  ok(isRealRow({ID:"",Store:"Deira"})===false,"row without an ID rejected");
  ok(isRealRow(null)===false,"null rejected");
  const cut=cacheCutoffMs();
  ok(withinCacheWindow(row({Date:dayStr(0)}),cut)===true,"today is inside the window");
  ok(withinCacheWindow(row({Date:dayStr(40)}),cut)===false,"40 days old is outside the window");
  ok(withinCacheWindow(row({Date:"not-a-date",Timestamp:""}),cut)===true,"undated rows kept (unchanged behaviour)");
}

console.log("\n[P4a] silent failure + [P3] no fetch on tab switch — source guarantees");
{
  ok(!/setInterval\([^)]*fetchSheet|60000\)/.test(SRC),"the 60s dashboard poll is gone");
  ok(!/function fetchSheet/.test(SRC),"fetchSheet removed entirely");
  ok(!/key=\{`[ud]\$\{storesVersion\}`\}/.test(SRC),"storesVersion remount keys removed");
  const dash=SRC.slice(SRC.indexOf("function DashboardView"),SRC.indexOf("function LoginView"));
  ok(!/setError\(/.test(dash),"dashboard never sets an error banner (P4a)");
  ok(/Server busy/.test(SRC)===false,"the 'Server busy' banner text is gone");
  ok(/if \(!isAdmin \|\| !active\) return;/.test(dash),"pull-to-refresh is Admin-only");
  ok(/Force full re-sync/.test(dash),"Admin force full re-sync exists");
  ok(/next\.setHours\(now\.getHours\(\) \+ 1, 0, 30, 0\)/.test(SRC),"hourly scheduler aligns to HH:00:30");
  ok(/Math\.floor\(Math\.random\(\) \* 20000\)/.test(SRC),"scheduler is jittered");
  ok(/verdict === "unknown"|already === "unknown"/.test(SRC),"'unknown' verification is handled distinctly from failure");
}

console.log(`\n==== frontend: ${P} pass, ${F} fail ====`);
process.exit(F?1:0);
