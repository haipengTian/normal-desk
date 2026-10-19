import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Diagnostics } from "../desktop/logging";
const info={name:"Desktop Starter",version:"0.2.0",electron:"44",chromium:"152",platform:"win32",architecture:"x64",packaged:true,dataPath:"private",startupWarning:null};
test("file logger sanitizes on disk and rotates to one bounded archive", async () => {
 const root=await mkdtemp(path.join(os.tmpdir(),"desktop-logs-test-"));const logs=new Diagnostics(root);
 logs.event("test",new Error("password=hunter2 C:\\Users\\Alice\\private.txt"));
 const text=await readFile(path.join(root,"logs/main.log"),"utf8");assert.ok(!text.includes("hunter2"));assert.ok(!text.includes("Alice"));
 for(let i=0;i<530;i++)logs.event("rotation", "x".repeat(4096));
 assert.ok((await stat(path.join(root,"logs/main.log"))).size<1055000);
 assert.ok((await stat(path.join(root,"logs/main.old.log"))).size<1055000);
});
test("diagnostics still exports metadata when a log cannot be read", async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"desktop-logs-test-"));const logs=new Diagnostics(root);
 await mkdir(path.join(root,"logs/main.old.log"),{recursive:true});
 const target=path.join(root,"report.json"); await logs.export(target,info);
 const report=JSON.parse(await readFile(target,"utf8"));assert.ok(report.logs.includes("LOG_UNAVAILABLE"));assert.ok(!report.logs.includes(root));
});
