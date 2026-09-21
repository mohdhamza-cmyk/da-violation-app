// Answers four specific questions with a real browser:
//  1. Does the Admin's "Force full re-sync" affect OTHER users' devices?
//  2. Does older cached data drive the 7/10-day views?
//  3. Does the foreground (visibilitychange) path actually re-sync when stale?
//  4. Does a force re-sync mutate anything server-side?
import { chromium } from "playwright";
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const day=(o=0)=>{const d=new Date();d.setDate(d.getDate()-o);
  return `${String(d.getDate()).padStart(2,"0")} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
const HEADERS=["ID","Timestamp","Date","HourSlot","Store","TL","Supervisor","AM","CityManager",
 "Inside_Count","Outside_Count","Parking_Count","TotalFiles","DriveLink","FileLinks","Week"];
const STORES=["Dubai Festival City","Al Garhoud","Nadd Al Hamar"];
const MAPPING={}; STORES.forEach(s=>MAPPING[s]={tl:"Soleman",supervisor:"Nitesh Nair",am:"Kiran Anand",cityManager:"Hamza Khan"});

// Shared server state: rows spanning the last 10 days.
let ROWS=[], n=0;
for(let d=0; d<10; d++)
  STORES.forEach(s=>{ for(let h=8;h<=12;h++)
    ROWS.push([`r${n++}`,new Date().toISOString(),day(d),`${h%12||12}:00 ${h<12?"AM":"PM"}`,
      s,"Soleman","Nitesh Nair","Kiran Anand","Hamza Khan",5,5,5,15,"x","x",""]); });
const GEN="gen-1";
const writes=[];   // any request that could MUTATE server state

let P=0,F=0; const ok=(c,l)=>{c?(P++,console.log("  ✓ "+l)):(F++,console.log("  ✗ FAIL: "+l));};

async function mkUser(browser){
  const ctx=await browser.newContext();
  const calls=[];
  await ctx.route("**/macros/s/**", route=>{
    const req=route.request(); const p=new URL(req.url()).searchParams;
    calls.push((req.method()==="POST"?"POST":"GET")+" "+(new URL(req.url()).search||"(none)"));
    if(req.method()!=="GET") writes.push(req.url());
    const j=o=>route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(o)});
    if(req.method()==="POST") return j({success:true});
    if(p.has("stores")) return j({mapping:MAPPING,order:STORES,count:STORES.length});
    if(p.has("check")) return j({found:true});
    if(p.has("seed")) return j({gen:GEN,cursor:ROWS.length+1,headers:HEADERS,rows:ROWS,
                                count:ROWS.length,builtAt:Date.now()});
    if(p.has("since")){
      const since=parseInt(p.get("since"),10);
      const extra=ROWS.slice(Math.max(0,since-1));
      return j({gen:GEN,cursor:ROWS.length+1,headers:HEADERS,rows:extra,count:extra.length});
    }
    return j([]);
  });
  const page=await ctx.newPage();
  return {ctx,page,calls};
}
const login=async(page,u,pw)=>{
  await page.getByText("DASHBOARD",{exact:true}).first().click();
  await page.getByPlaceholder("Enter username").fill(u);
  await page.getByPlaceholder("Enter password").fill(pw);
  await page.getByRole("button",{name:/Sign In/}).click();
  await page.waitForTimeout(2000);
};
const records=async(page)=>{
  const t=await page.locator("body").innerText();
  const m=t.match(/(\d+)\s+records/); return m?parseInt(m[1],10):-1;
};
const submitted=async(page)=>{
  const t=await page.locator("body").innerText();
  const m=t.match(/UPDATES SUBMITTED\s*\n\s*(\d+)/); return m?parseInt(m[1],10):-1;
};

const browser=await chromium.launch({executablePath:process.env.PW_CHROME||undefined});
try{
  console.log("\n[Q2] older cached data drives the 7 / 10-day views");
  { const {page,ctx}=await mkUser(browser);
    await page.goto("http://localhost:4173/"); await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    await page.getByText("Today",{exact:true}).first().click(); await page.waitForTimeout(500);
    const todayN=await submitted(page);
    await page.getByText("10 days",{exact:true}).first().click(); await page.waitForTimeout(600);
    const tenN=await submitted(page);
    ok(todayN>0,`Today view counts submissions (${todayN})`);
    ok(tenN>todayN,`10-day view includes older cached days (${tenN} > ${todayN})`);
    ok(tenN===150,`all 10 days of cached rows are used (${tenN} of 150)`);
    await ctx.close();
  }

  console.log("\n[Q1] Admin 'Force full re-sync' is DEVICE-LOCAL, not global");
  { const A=await mkUser(browser);   // Admin
    const B=await mkUser(browser);   // a different user, separate browser profile
    await A.page.goto("http://localhost:4173/"); await A.page.waitForTimeout(400);
    await login(A.page,"admin","noon@2026");
    await B.page.goto("http://localhost:4173/"); await B.page.waitForTimeout(400);
    await login(B.page,"nitesh","nitesh@123");
    const a0=await records(A.page), b0=await records(B.page);
    ok(a0===b0 && a0>0,`both users start with the same cached rows (${a0})`);

    // A new submission lands on the server AFTER both have seeded.
    ROWS.push([`NEW1`,new Date().toISOString(),day(0),"1:00 PM",STORES[0],
      "Soleman","Nitesh Nair","Kiran Anand","Hamza Khan",5,5,5,15,"x","x",""]);

    const bCallsBefore=B.calls.length;
    await A.page.getByText("Force full re-sync",{exact:true}).click();
    await A.page.waitForTimeout(2500);

    const a1=await records(A.page), b1=await records(B.page);
    ok(a1===a0+1,`Admin's own device picked up the new row (${a0} → ${a1})`);
    ok(b1===b0,`the OTHER user's data is UNCHANGED (${b0} → ${b1}) — refresh is not global`);
    ok(B.calls.length===bCallsBefore,
       `the other user's device made ZERO requests as a result (${B.calls.length-bCallsBefore})`);
    await A.ctx.close(); await B.ctx.close();
  }

  console.log("\n[Q3] hourly auto-refresh actually fires (clock advanced for real)");
  { const {page,ctx,calls}=await mkUser(browser);
    await page.clock.install();                       // fake timers BEFORE load
    await page.goto("http://localhost:4173/"); await page.waitForTimeout(400);
    await login(page,"admin","noon@2026");
    const before=calls.length;
    // Nothing should happen in the next few simulated minutes.
    await page.clock.fastForward("05:00");
    await page.waitForTimeout(800);
    ok(calls.slice(before).filter(c=>c.includes("since=")||c.includes("seed")).length===0,
       "no data fetch a few minutes in (the 60s poll really is gone)");
    // Now cross the top of the hour.
    await page.clock.fastForward("01:05:00");
    await page.waitForTimeout(2000);
    const fired=calls.slice(before).filter(c=>c.includes("since="));
    ok(fired.length>0,`crossing the hour boundary fired a delta sync (${fired.length})`);
    ok(fired.length<=2,`and only once, not a poll storm (${fired.length} in ~1h)`);
    await ctx.close();
  }

  console.log("\n[Q4] a force re-sync mutates nothing on the server");
  ok(writes.length===0,`no POST/write requests were made by any refresh (${writes.length})`);
} finally { await browser.close(); }
console.log(`\n==== scope checks: ${P} pass, ${F} fail ====`);
process.exit(F?1:0);
