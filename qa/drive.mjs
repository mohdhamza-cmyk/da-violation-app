import { chromium } from "playwright";

const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const day=(o=0)=>{const d=new Date();d.setDate(d.getDate()-o);
  return `${String(d.getDate()).padStart(2,"0")} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
const HEADERS=["ID","Timestamp","Date","HourSlot","Store","TL","Supervisor","AM","CityManager",
 "Inside_Count","Outside_Count","Parking_Count","TotalFiles","DriveLink","FileLinks","Week"];
const STORES=["Dubai Festival City","Al Garhoud","Nadd Al Hamar"];
const MAPPING={}; STORES.forEach(s=>MAPPING[s]={tl:"Soleman",supervisor:"Nitesh Nair",am:"Kiran Anand",cityManager:"Hamza Khan"});
const mkRow=(i,store,hour)=>[`r${i}`,new Date().toISOString(),day(0),
  `${hour%12||12}:00 ${hour<12?"AM":"PM"}`,store,"Soleman","Nitesh Nair","Kiran Anand","Hamza Khan",
  5,5,5,15,"https://drive.google.com/d/AAA","https://drive.google.com/d/AAA",""];
let SEED_ROWS=[]; let n=0;
STORES.forEach(s=>{ for(let h=8;h<=12;h++) SEED_ROWS.push(mkRow(n++,s,h)); });
const GEN="gen-1";

let P=0,F=0; const ok=(c,l)=>{c?(P++,console.log("  ✓ "+l)):(F++,console.log("  ✗ FAIL: "+l));};

async function newPage(browser){
  const ctx=await browser.newContext();
  const calls=[];                 // every request to the Apps Script URL
  let blocked=false;
  await ctx.route("**/macros/s/**", async route=>{
    const url=new URL(route.request().url()); const p=url.searchParams;
    calls.push(url.search || "(none)");
    if(blocked) return route.abort();
    const json=o=>route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(o)});
    if(route.request().method()==="POST") return json({success:true});
    if(p.has("stores")) return json({mapping:MAPPING,order:STORES,count:STORES.length});
    if(p.has("check"))  return json({found:true});
    if(p.has("fileCount")) return json({count:0,indices:[]});
    if(p.has("seed"))   return json({gen:GEN,cursor:SEED_ROWS.length+1,headers:HEADERS,
                                     rows:SEED_ROWS,count:SEED_ROWS.length,builtAt:Date.now()});
    if(p.has("since"))  return json({gen:GEN,cursor:SEED_ROWS.length+1,headers:HEADERS,rows:[],count:0});
    return json([]);
  });
  const page=await ctx.newPage();
  const errors=[]; page.on("pageerror",e=>errors.push(String(e)));
  return {ctx,page,calls,errors,setBlocked:(b)=>{blocked=b;}};
}
const login=async(page,u,p)=>{
  await page.getByText("DASHBOARD",{exact:true}).first().click();
  await page.getByPlaceholder("Enter username").fill(u);
  await page.getByPlaceholder("Enter password").fill(p);
  await page.getByRole("button",{name:/Sign In/}).click();
  await page.waitForTimeout(1800);
};

const browser=await chromium.launch({executablePath:process.env.PW_CHROME||undefined});
try{
  // ── P3/C3: tab switch is instant, network-free, state-preserving ──────
  console.log("\n[P3/C3] tab switch: zero network, no spinner, state preserved");
  { const {page,calls,errors,ctx}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForTimeout(500);
    await login(page,"admin","noon@2026");
    ok(calls.some(c=>c.includes("seed")),"first load seeds the cache via ?seed=1");

    await page.getByText("Stores",{exact:true}).first().click();   // change dashboard tab
    await page.waitForTimeout(400);
    const before=calls.length;
    await page.getByText("UPLOAD",{exact:true}).first().click();
    await page.waitForTimeout(500);
    await page.getByText("DASHBOARD",{exact:true}).first().click();
    await page.waitForTimeout(800);
    ok(calls.length===before,`tab switch fired ZERO script calls (${calls.length-before} new)`);
    const body=await page.locator("body").innerText();
    ok(!/Loading data…/.test(body),"no loading spinner after switching back");
    ok(/Dubai Festival City/.test(body),"cached rows still rendered instantly");
    ok(errors.length===0,`no runtime errors (${errors.length})`);
    await ctx.close();
  }

  // ── P6/C1: reload re-uses the device cache, no re-download ────────────
  console.log("\n[P6/C1] reload serves from IndexedDB, no window re-fetch");
  { const {page,calls,ctx}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    const afterFirst=calls.length;
    await page.reload(); await page.waitForTimeout(1800);
    const dataCalls=calls.slice(afterFirst).filter(c=>c.includes("seed")||c.includes("since"));
    ok(dataCalls.length===0,`reload re-downloaded nothing (${dataCalls.length} data calls)`);
    const body=await page.locator("body").innerText();
    ok(/Dubai Festival City/.test(body),"rows rendered from the device cache after reload");
    await ctx.close();
  }

  // ── C2: when stale, sync is a DELTA (?since), never a full re-seed ────
  console.log("\n[C2] a stale cache syncs via ?since, not a full window fetch");
  { const {page,calls,ctx}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    // Age the cache past the staleness threshold, then reload.
    await page.evaluate(()=>{ const k="ds_sync_meta_v1";
      const m=JSON.parse(localStorage.getItem(k)); m.lastSync=Date.now()-3600*1000*3;
      localStorage.setItem(k,JSON.stringify(m)); });
    const before=calls.length;
    await page.reload(); await page.waitForTimeout(2000);
    const after=calls.slice(before);
    ok(after.some(c=>c.includes("since=")),"stale cache triggered a delta (?since=)");
    ok(!after.some(c=>c.includes("seed")),"did NOT re-seed the whole window");
    await ctx.close();
  }

  // ── P4a: a failing sync is silent — cached data stays, no banner ──────
  console.log("\n[P4a] failed sync is silent: cache intact, no error banner");
  { const {page,ctx,setBlocked}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    await page.evaluate(()=>{ const k="ds_sync_meta_v1";
      const m=JSON.parse(localStorage.getItem(k)); m.lastSync=0;
      localStorage.setItem(k,JSON.stringify(m)); });
    setBlocked(true);                       // every request now fails
    await page.reload(); await page.waitForTimeout(2500);
    const body=await page.locator("body").innerText();
    ok(/Dubai Festival City/.test(body),"cached data still renders with the network dead");
    ok(!/Server busy|unreachable|Couldn't|⚠️/.test(body),"no error banner shown");
    ok(!/Loading data…/.test(body),"no spinner left hanging");
    await ctx.close();
  }

  // ── P4: pull-to-refresh is Admin-only ────────────────────────────────
  console.log("\n[P4] manual refresh restricted to Admin");
  { const {page,ctx}=await newPage(browser);
    await page.goto("http://localhost:4173/"); await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    ok(/Force full re-sync/.test(await page.locator("body").innerText()),"Admin sees force full re-sync");
    await ctx.close();
  }
  { const {page,ctx}=await newPage(browser);
    await page.goto("http://localhost:4173/"); await page.waitForTimeout(400);
    await login(page,"nitesh","nitesh@123");
    const body=await page.locator("body").innerText();
    ok(!/Force full re-sync/.test(body),"supervisor (L1) does NOT see force re-sync");
    ok(/Supervisor · 3 stores/.test(body) && /15 records/.test(body),
       "…but still sees their scoped data (3 stores, 15 records)");
    await ctx.close();
  }
} finally { await browser.close(); }

console.log(`\n==== UI E2E: ${P} pass, ${F} fail ====`);
process.exit(F?1:0);
