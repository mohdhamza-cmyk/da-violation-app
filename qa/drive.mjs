import { chromium } from "playwright";

const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const d=new Date();
const today=`${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const STORES={
  order:["Dubai Marina","JLT","Riyadh 1","Jeddah 1","Cairo 1"],
  mapping:{},
  stores:[
    {country:"UAE",store:"Dubai Marina",tl:"T",supervisor:"UaeSup",am:"A",cityManager:"CM1"},
    {country:"UAE",store:"JLT",tl:"T",supervisor:"UaeSup",am:"A",cityManager:"CM1"},
    {country:"KSA",store:"Riyadh 1",tl:"T",supervisor:"KsaSup",am:"A",cityManager:"CM2"},
    {country:"KSA",store:"Jeddah 1",tl:"T",supervisor:"KsaSup",am:"A",cityManager:"CM2"},
    {country:"Egypt",store:"Cairo 1",tl:"T",supervisor:"EgSup",am:"A",cityManager:"CM3"},
  ],
};
const USERS={
  admin:{username:"admin",name:"Admin",role:"Admin",scopeType:"all",scopeValue:"",countries:["UAE","KSA","Egypt","Bahrain","Qatar","Kuwait"]},
  ksa:  {username:"ksa",name:"KSA Sup",role:"L1",scopeType:"supervisor",scopeValue:"KsaSup",countries:["KSA"]},
};
function rowsFor(country){
  return STORES.stores.filter(s=>s.country===country).map((s,i)=>({
    ID:country+i,Timestamp:d.toISOString(),Date:today,HourSlot:"9:00 AM",Store:s.store,
    TL:s.tl,Supervisor:s.supervisor,AM:s.am,CityManager:s.cityManager,
    Inside_Count:"5",Outside_Count:"5",Parking_Count:"5",TotalFiles:"15",Country:country,
  }));
}

let PASS=0,FAIL=0; const ok=(c,l)=>{ c?(PASS++,console.log("  ✓ "+l)):(FAIL++,console.log("  ✗ FAIL: "+l)); };

async function newPage(browser){
  const ctx=await browser.newContext();
  const fetched=[]; const posts=[];
  await ctx.route("**/macros/s/**", async route=>{
    const req=route.request(); const url=new URL(req.url()); const p=url.searchParams;
    const json=o=>route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(o)});
    if(req.method()==="POST"){ posts.push(req.postData()||""); return json({success:true}); }
    if(p.has("stores")) return json(globalThis.__STORES_OVERRIDE||STORES);
    if(p.has("login")) { const u=(p.get("u")||"").toLowerCase(); return json(USERS[u]?{ok:true,user:USERS[u]}:{ok:false}); }
    if(p.has("check")) return json({found:true});
    if(p.has("fileCount")) return json({count:0,indices:[]});
    if(p.has("country")) { fetched.push(p.get("country")); return json(rowsFor(p.get("country"))); }
    return json([]);
  });
  const page=await ctx.newPage();
  const errors=[]; page.on("pageerror",e=>errors.push(String(e)));
  return {ctx,page,fetched,posts,errors};
}

const EXE=process.env.PW_CHROME||"";
const browser=await chromium.launch(EXE?{executablePath:EXE}:{});
try{
  // ---------- Scenario 1: Upload country selector + store filtering ----------
  console.log("\n[1] Upload: country selector gates store list");
  { const {page,errors}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForResponse(r=>r.url().includes("stores"),{timeout:15000}).catch(()=>{});
    await page.waitForTimeout(800);
    const countrySel=page.locator('select').filter({has:page.locator('option[value="KSA"]')}).first();
    const copts=await countrySel.locator('option').allInnerTexts();
    ok(["UAE","KSA","Egypt"].every(c=>copts.includes(c)),"country dropdown lists UAE/KSA/Egypt ("+copts.join(",")+")");
    await countrySel.selectOption("KSA");
    await page.waitForTimeout(300);
    const storeSel=page.locator('select').filter({hasText:"Select your store"}).first();
    const sopts=await storeSel.locator('option').allInnerTexts();
    ok(sopts.includes("Riyadh 1")&&sopts.includes("Jeddah 1"),"KSA selected -> KSA stores shown");
    ok(!sopts.includes("Dubai Marina")&&!sopts.includes("Cairo 1"),"KSA selected -> other countries' stores hidden");
    await countrySel.selectOption("UAE");
    await page.waitForTimeout(300);
    const sopts2=await storeSel.locator('option').allInnerTexts();
    ok(sopts2.includes("Dubai Marina")&&!sopts2.includes("Riyadh 1"),"switch to UAE -> UAE stores only");
    ok(errors.length===0,"no runtime page errors on Upload ("+errors.length+")");
    await page.context().close();
  }

  // ---------- Scenario 2: Admin dashboard fans out to ALL countries ----------
  console.log("\n[2] Dashboard: admin (all countries) fans out per country");
  { const {page,fetched,errors}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForResponse(r=>r.url().includes("stores"),{timeout:15000}).catch(()=>{});
    await page.waitForTimeout(500);
    await page.getByText("DASHBOARD",{exact:false}).first().click();
    await page.getByPlaceholder("Enter username").fill("admin");
    await page.getByPlaceholder("Enter password").fill("x");
    await page.getByRole("button",{name:/Sign In/}).click();
    await page.waitForTimeout(2500);
    const uniq=[...new Set(fetched)].sort();
    ok(uniq.includes("UAE")&&uniq.includes("KSA")&&uniq.includes("Egypt"),"admin fetched UAE+KSA+Egypt ("+uniq.join(",")+")");
    ok(errors.length===0,"no runtime errors after admin login ("+errors.length+")");
    await page.context().close();
  }

  // ---------- Scenario 3: KSA-scoped user only sees/fetches KSA ----------
  console.log("\n[3] Dashboard: KSA supervisor is country-scoped");
  { const {page,fetched,errors}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForResponse(r=>r.url().includes("stores"),{timeout:15000}).catch(()=>{});
    await page.waitForTimeout(500);
    await page.getByText("DASHBOARD",{exact:false}).first().click();
    await page.getByPlaceholder("Enter username").fill("ksa");
    await page.getByPlaceholder("Enter password").fill("x");
    await page.getByRole("button",{name:/Sign In/}).click();
    await page.waitForTimeout(2500);
    const uniq=[...new Set(fetched)].sort();
    ok(uniq.length===1&&uniq[0]==="KSA","KSA supervisor fetched ONLY KSA ("+uniq.join(",")+")");
    const body=await page.locator("body").innerText();
    ok(!/Dubai Marina|Cairo 1/.test(body),"KSA user's dashboard shows no UAE/Egypt store names");
    ok(errors.length===0,"no runtime errors after KSA login ("+errors.length+")");
    await page.context().close();
  }

  // ---------- Scenario 4: OLD backend (no stores[]) still works (UAE only) ----------
  console.log("\n[4] Backward compat: legacy ?stores payload (no stores[])");
  { globalThis.__STORES_OVERRIDE={order:["Dubai Marina","JLT"],mapping:{"Dubai Marina":{tl:"T",supervisor:"UaeSup",am:"A",cityManager:"CM1"},"JLT":{tl:"T",supervisor:"UaeSup",am:"A",cityManager:"CM1"}}};
    const {page,errors}=await newPage(browser);
    await page.goto("http://localhost:4173/");
    await page.waitForResponse(r=>r.url().includes("stores"),{timeout:15000}).catch(()=>{});
    await page.waitForTimeout(800);
    const countrySel=page.locator('select').filter({has:page.locator('option[value="UAE"]')}).first();
    const copts=await countrySel.locator('option').allInnerTexts();
    ok(copts.includes("UAE")&&!copts.includes("KSA"),"legacy backend -> country dropdown shows UAE only ("+copts.join(",")+")");
    const storeSel=page.locator('select').filter({hasText:"Select your store"}).first();
    const sopts=await storeSel.locator('option').allInnerTexts();
    ok(sopts.includes("Dubai Marina"),"legacy backend -> UAE stores still populate");
    ok(errors.length===0,"no runtime errors on legacy backend ("+errors.length+")");
    globalThis.__STORES_OVERRIDE=null;
    await page.context().close();
  }
} finally { await browser.close(); }

console.log(`\n==== UI E2E: ${PASS} pass, ${FAIL} fail ====`);
process.exit(FAIL?1:0);
