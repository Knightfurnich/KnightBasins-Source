import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { classifyContrastRow } from "../../../qa/tools/contrast-row-policy.mjs";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
test("471-R revision 2: semantic row thresholds, not selector exemptions",()=>{
  for(const control of ["icon-currentColor","icon-text","custom-checkbox","custom-radio","input-border"]){
    const r=classifyContrastRow({control});assert.equal(r.category,"ui");assert.equal(r.threshold,3);assert.equal(r.criterion,"WCAG 1.4.11");
  }
  for(const control of [null,"input-value","placeholder"]){
    const r=classifyContrastRow({control});assert.equal(r.category,"text");assert.equal(r.threshold,4.5);
  }
  assert.equal(classifyContrastRow({large:true}).threshold,3);
  assert.deepEqual(classifyContrastRow({decorativeReason:"duplicates visible text"}),{category:"decorative",threshold:null,criterion:null,reason:"duplicates visible text"});
});
const run = (path: string, args: string[], env = {}) => new Promise<{status: number|null; log: string}>(resolve => {
  const child = spawn(process.execPath, [new URL(path, root).pathname, ...args], {env:{...process.env,...env}});
  let log = "";
  child.stdout.on("data", data=>{log+=data;}); child.stderr.on("data", data=>{log+=data;});
  child.on("close", status=>resolve({status,log}));
});

test("471-R option B: bounded retries, timeout, request logs and per-preview byte cache", () => {
  const mock = read("qa/tools/mock-api-466c.mjs");
  assert.match(mock, /attempt <= 3/);
  assert.match(mock, /AbortSignal\.timeout\(5000\)/);
  assert.match(mock, /cache\.set\(url,result\)/);
  assert.match(mock, /if \(req\.method !== "GET"\)/);
  assert.match(mock, /res\.on\("finish"/);
  const workflow = read(".github/workflows/release-validation.yml");
  assert.match(workflow, /for round in 1 2 3; do/);
  assert.match(workflow, /if: always\(\)\s+needs: contrast-sweep/);
  assert.match(workflow, /node qa\/tools\/wait-contrast-preview\.mjs/);
  assert.match(read("qa/tools/sweep-467c.mjs"), /Expected six complete same-commit/);
});

test("471-R F/G: short text, value and SVG controls; strict seeded cart contract", () => {
  const scanner = read("qa/tools/gradient-scan-465c.mjs");
  assert.doesNotMatch(scanner, /if \(own\.length < 3\) return/);
  for (const name of ["input-value", "icon-currentColor", "custom-checkbox", "cartOK", "quantityBoxes", "cart quantity coverage incomplete"])
    assert.ok(scanner.includes(name), name);
  assert.match(scanner, /state === "cart"/);
  assert.match(scanner, /rows\.filter\(r=>r\.stepper\)\.length !== CART\.length \* 3/);
});

test("471-R B: blocked portfolio exits 2, even when HTML and catalog succeed", async () => {
  const server = http.createServer((req,res)=>{
    if(req.url==="/")res.end("<html>ready</html>");
    else if(req.url==="/api/catalog")res.end('{"basins":[]}');
    else {res.writeHead(503);res.end("{}");}
  }).listen(0,"127.0.0.1");
  await once(server,"listening");
  try {
    const address=server.address() as {port:number};
    const result=await run("qa/tools/wait-contrast-preview.mjs",["http://127.0.0.1:"+address.port],{PREVIEW_READY_TIMEOUT_MS:"700"});
    assert.equal(result.status,2,result.log);
    assert.match(result.log,/ยังไม่ได้ตรวจ \(หน้าโหลดไม่จบ: \/api\/portfolio\)/);
    assert.doesNotMatch(result.log,/READY:/);
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test("471-R B: real proxy retries three times, caches only success, logs final status", async () => {
  const reservation=http.createServer().listen(0,"127.0.0.1");
  await once(reservation,"listening");
  const port=(reservation.address() as {port:number}).port;
  await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  const preload=`let n=0;globalThis.fetch=async url=>{
    console.log("UPSTREAM "+url);
    if(url.includes("/api/down"))throw Error("controlled offline");
    n++;return new Response(n<3?'{}':'{"basins":[]}',{status:n<3?503:200,headers:{"content-type":"application/json"}});
  };`;
  const child=spawn(process.execPath,["--import","data:text/javascript,"+encodeURIComponent(preload),new URL("qa/tools/mock-api-466c.mjs",root).pathname],
    {env:{...process.env,CONTRAST_API_PORT:String(port)}});
  let log="";child.stdout.on("data",d=>{log+=d;});child.stderr.on("data",d=>{log+=d;});
  try {
    const base="http://127.0.0.1:"+port;
    let response: Response|undefined;
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      try { response=await fetch(base+"/api/catalog");break; } catch {await new Promise(r=>setTimeout(r,25));}
    }
    assert.equal(response?.status,200,log);await response?.text();
    assert.equal((await fetch(base+"/api/catalog")).status,200);
    assert.equal((await fetch(base+"/api/down")).status,502);
    assert.equal((await fetch(base+"/api/down")).status,502);
    assert.equal((await fetch(base+"/api/no-write",{method:"POST"})).status,405);
    await new Promise(r=>setTimeout(r,50));
    assert.equal((log.match(/UPSTREAM https:\/\/knightbasins\.com\/api\/catalog/g)||[]).length,3,log);
    assert.equal((log.match(/UPSTREAM https:\/\/knightbasins\.com\/api\/down/g)||[]).length,6,log);
    assert.match(log,/GET \/api\/catalog 200 [\d.]+ms .*"source":"cache"/);
    assert.match(log,/GET \/api\/down 502 [\d.]+ms .*"attempt":3/);
    assert.match(log,/POST \/api\/no-write 405/);
  } finally {if(child.exitCode===null){child.kill();await once(child,"close");}}
});

test("471-R C: comparison rejects missing rounds and third-round drift", async () => {
  const dir=mkdtempSync(join(tmpdir(),"471-rounds-"));
  const rows=Array.from({length:34},(_,i)=>({commit:process.env.GITHUB_SHA??null,theme:i<17?"dark":"light",target:"/"+(i%17),checked:10,real:0,overflowPx:0,readiness:{ok:true},occluded:0,notMeasurable:0,coverage:{stepper:0},excluded:[] as {selector:string;reason:string}[]}));
  for(const width of [1440,390])for(const round of [1,2,3]){
    const path=join(dir,`contrast-${width}-round${round}`);mkdirSync(path);
    writeFileSync(join(path,"sweep-summary.json"),JSON.stringify(rows));
  }
  const pass=await run("qa/tools/sweep-467c.mjs",["--compare-rounds",dir]);
  assert.equal(pass.status,0,pass.log);
  assert.match(pass.log,/across three rounds/);
  rows[0].excluded=[{selector:"svg",reason:"different decorative evidence"}];
  writeFileSync(join(dir,"contrast-390-round3/sweep-summary.json"),JSON.stringify(rows));
  const changedExclusion=await run("qa/tools/sweep-467c.mjs",["--compare-rounds",dir]);
  assert.notEqual(changedExclusion.status,0);
  assert.match(changedExclusion.log,/differ across rounds/);
  rows[0].excluded=[];
  rows[0].coverage.stepper=1;
  writeFileSync(join(dir,"contrast-390-round3/sweep-summary.json"),JSON.stringify(rows));
  const fail=await run("qa/tools/sweep-467c.mjs",["--compare-rounds",dir]);
  assert.notEqual(fail.status,0);
  assert.match(fail.log,/differ across rounds/);
  unlinkSync(join(dir,"contrast-390-round3/sweep-summary.json"));
  const missing=await run("qa/tools/sweep-467c.mjs",["--compare-rounds",dir]);
  assert.notEqual(missing.status,0);
  assert.match(missing.log,/Expected six complete/);
});
