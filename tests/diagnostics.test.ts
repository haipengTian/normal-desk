import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, rendererIncident, diagnosticReport } from "../desktop/diagnostics";

test("redacts credentials, URLs and local paths before persistence", () => {
  const value = redact('Authorization: Bearer abc123\napi_key="secret-123" password=hunter2 cookie: session=abc\nhttps://user:pass@host.test/a?token=secret#private C:\\Users\\Alice\\secret.txt /home/alice/private.txt');
  for (const secret of ["abc123", "secret-123", "hunter2", "session=abc", "user:pass", "token=secret", "#private", "Alice", "/home/alice"]) assert.ok(!value.includes(secret), value);
  assert.ok(value.includes("[REDACTED]"));
});
test("renderer reports accept only known categories, never arbitrary error text", () => {
  assert.equal(rendererIncident({ kind: "unhandledrejection" }), "unhandledrejection");
  for (const value of [null, "error", {kind:"other"}, {kind:"error",message:"password"}]) assert.throws(() => rendererIncident(value));
});
test("export allowlists metadata and bounds sanitized logs", () => {
  const report = diagnosticReport({ name:"Desktop Starter", version:"0.2.0", electron:"44", chromium:"150", platform:"win32", architecture:"x64", packaged:true, dataPath:"C:/Users/Alice", startupWarning:null }, "token=secret\n" + "x".repeat(400000));
  assert.ok(!JSON.stringify(report).includes("Alice"));
  assert.ok(!JSON.stringify(report).includes("token=secret"));
  assert.ok(report.logs.length <= 262144);
  assert.equal(report.application.version, "0.2.0");
});

test("export bounds UTF-8 bytes without corrupting Chinese text or app URLs",()=>{
 const info={name:"Desktop Starter",version:"0.2.0",electron:"44",chromium:"152",platform:"win32",architecture:"x64",packaged:true,dataPath:"private",startupWarning:null};
 const report=diagnosticReport(info,"应用事件。".repeat(100000));
 assert.ok(Buffer.byteLength(report.logs,"utf8")<=262144);assert.ok(!report.logs.includes("�"));
 assert.equal(redact("app://desktop/"),"app://desktop/");
});
