import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { documentationUrl, isTrustedRendererUrl, resolveAssetPath, validateTitleBarColors } from "../desktop/security";

test("trusts only the packaged origin or the explicitly configured dev origin", () => {
  assert.equal(isTrustedRendererUrl("app://desktop/"), true);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:3014/", "http://127.0.0.1:3014"), true);
  for (const url of ["https://example.com", "app://other/", "app://user:pass@desktop/", "app://desktop:90/", "file:///C:/private", "http://127.0.0.1:3014/"]) {
    assert.equal(isTrustedRendererUrl(url), false, url);
  }
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:3015/", "http://127.0.0.1:3014"), false);
});
test("resolves local static assets without allowing arbitrary filesystem paths", () => {
  const root = path.resolve("out");
  assert.equal(resolveAssetPath("app://desktop/", root), path.join(root, "index.html"));
  assert.equal(resolveAssetPath("app://desktop/_next/static/app.js?v=1", root), path.join(root, "_next/static/app.js"));
  for (const url of ["file:///C:/secret", "app://other/", "app://desktop/%2e%2e%5csecret", "app://desktop/%00", "app://desktop/C:%5csecret"]) {
    assert.equal(resolveAssetPath(url, root), null, url);
  }
});
test("external links are a fixed documentation allowlist", () => {
  assert.equal(documentationUrl("electron"), "https://www.electronjs.org/docs/latest/");
  assert.equal(documentationUrl("credit"), "https://github.com/linux-do/credit");
  for (const key of ["https://example.com", "file:///C:/secret", "__proto__", null]) {
    assert.throws(() => documentationUrl(key), /不支持的文档链接/);
  }
});

test("accepts opaque title bar colors without exposing arbitrary native window options", () => {
  assert.deepEqual(validateTitleBarColors({ background: "#ffffff", foreground: "#27272a" }), { color: "#ffffff", symbolColor: "#27272a" });
});
test("rejects invalid title bar colors and unrelated window options", () => {
  for (const input of [null, "#fff", { background: "transparent", foreground: "#ffffff" }, { background: "#ffffff", foreground: "red" }, { background: "#ffffff", foreground: "#27272a", height: 500 }]) {
    assert.throws(() => validateTitleBarColors(input), /标题栏颜色无效/);
  }
});
