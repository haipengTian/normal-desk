import { test } from "node:test";
import assert from "node:assert/strict";
import { RecoveryController } from "../desktop/recovery";

test("recovery waits for user, deduplicates incidents and reloads only on request", async () => {
  let choose!: (choice: number) => void;
  let prompts=0, reloads=0;
  const recovery = new RecoveryController({ prompt: async () => { prompts++; return new Promise<number>(resolve => { choose=resolve; }); }, reload:()=>{reloads++;}, export:async()=>{}, quit:()=>{} });
  const first=recovery.run("crashed");
  await recovery.run("crashed");
  assert.equal(prompts,1); assert.equal(reloads,0);
  choose(0); await first; assert.equal(reloads,1);
});
test("export returns to recovery choices; waiting never reloads", async () => {
  const choices=[1,3]; let exports=0, reloads=0;
  const recovery=new RecoveryController({prompt:async()=>choices.shift()!, export:async()=>{exports++;}, reload:()=>{reloads++;}, quit:()=>{} });
  await recovery.run("unresponsive");
  assert.equal(exports,1); assert.equal(reloads,0);
});
