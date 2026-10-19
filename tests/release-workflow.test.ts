import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("tag release stays draft until the installer and both update files are uploaded", async () => {
  const workflow = await readFile(".github/workflows/release.yml", "utf8");
  assert.match(workflow, /run: pwsh -File scripts\/publish-release\.ps1/);
  assert.ok(workflow.indexOf("scripts/publish-release.ps1") > workflow.indexOf("--publish always"));
  const script = await readFile("scripts/publish-release.ps1", "utf8");
  for (const asset of ["Desktop-Starter-Setup.exe", "Desktop-Starter-Setup.exe.blockmap", "latest.yml"]) assert.ok(script.includes(asset));
  assert.ok(script.indexOf("gh release edit") > script.indexOf("Missing release asset"));
  assert.match(script, /--draft=false/);
  assert.match(script, /if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(script, /\$release\.isDraft/);
  assert.match(script, /notes-file/);
});

for (const scenario of ["complete", "missing", "published", "read-failed", "publish-failed"] as const) {
  test(`release publication gate: ${scenario}`, { skip: process.platform !== "win32" }, () => {
    const assets = ["Desktop-Starter-Setup.exe", "Desktop-Starter-Setup.exe.blockmap", "latest.yml"].map(name => ({ name, size: 123 }));
    if (scenario === "missing") assets.pop();
    const json = JSON.stringify({ isDraft: scenario !== "published", assets });
    const command = `function global:gh {
      $global:LASTEXITCODE = 0
      if ($args[1] -eq 'view') {
        ${scenario === "read-failed" ? "$global:LASTEXITCODE = 1" : ""}
        return '${json}'
      }
      Write-Output 'GH_EDIT_CALLED'
      ${scenario === "publish-failed" ? "$global:LASTEXITCODE = 1" : ""}
    }
    & ./scripts/publish-release.ps1`;
    const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], {
      encoding: "utf8", env: { ...process.env, RELEASE_TAG: `v${JSON.parse(readFileSync("package.json", "utf8")).version}`, GITHUB_REPOSITORY: "haipengTian/normal-desk", GH_TOKEN: "" },
    });
    if (result.error) throw result.error;
    assert.equal(result.status === 0, ["complete", "published"].includes(scenario), result.stderr);
    assert.equal(result.stdout.includes("GH_EDIT_CALLED"), ["complete", "publish-failed"].includes(scenario));
  });
}
