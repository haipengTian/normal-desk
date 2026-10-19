import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const names = ["Desktop-Starter-Setup.exe", "Desktop-Starter-Setup.exe.blockmap", "latest.yml"];

test("release workflow uploads one complete local build and can recover an existing version tag", async () => {
  const workflow = await readFile(".github/workflows/release.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /--publish never/);
  assert.doesNotMatch(workflow, /--publish always/);
  assert.match(workflow, /ref: \$\{\{ env.RELEASE_TAG \}\}/);
  assert.match(workflow, /run: pwsh -File \.\.\/release-tools\/scripts\/publish-release\.ps1/);
  assert.ok(workflow.indexOf("run: pwsh") > workflow.indexOf("--publish never"));
});

for (const scenario of ["new", "draft-missing-blockmap", "incomplete-upload", "published", "read-failed", "upload-failed", "publish-failed", "missing-local"] as const) {
  test(`release publication gate: ${scenario}`, { skip: process.platform !== "win32" }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "desktop-publish-"));
    try {
      for (const name of names) {
        if (scenario === "missing-local" && name.endsWith(".blockmap")) continue;
        await writeFile(path.join(directory, name), "fixture");
      }
      const version = JSON.parse(readFileSync("package.json", "utf8")).version;
      const assets = names.filter(name => scenario !== "incomplete-upload" || !name.endsWith(".blockmap")).map(name => ({ name, size: 123 }));
      const release = JSON.stringify({ isDraft: scenario !== "published", assets });
      const listing = JSON.stringify(scenario === "new" ? [] : [{ tagName: `v${version}`, isDraft: scenario !== "published" }]);
      // Only gh is replaced: exercise the actual PowerShell filesystem, ordering and exit checks.
      const command = `function global:gh {
        $global:LASTEXITCODE = 0
        if ($args[1] -eq 'list') {
          ${scenario === "read-failed" ? "$global:LASTEXITCODE = 1" : ""}
          return '${listing}'
        }
        if ($args[1] -eq 'view') { return '${release}' }
        if ($args[1] -eq 'create') { Write-Output 'GH_CREATE_CALLED'; return }
        if ($args[1] -eq 'upload') {
          foreach ($name in @('Desktop-Starter-Setup.exe','Desktop-Starter-Setup.exe.blockmap','latest.yml')) {
            if (-not ($args | Where-Object { [string]$_ -like "*$name" })) { throw "Upload omitted: $name" }
          }
          Write-Output 'GH_UPLOAD_CALLED'
          ${scenario === "upload-failed" ? "$global:LASTEXITCODE = 1" : ""}
          return
        }
        if ($args[1] -eq 'edit') {
          Write-Output 'GH_EDIT_CALLED'
          ${scenario === "publish-failed" ? "$global:LASTEXITCODE = 1" : ""}
          return
        }
        throw 'Unexpected gh command'
      }
      & ./scripts/publish-release.ps1 -ArtifactDirectory $env:TEST_RELEASE_DIRECTORY`;
      const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], {
        encoding: "utf8", env: { ...process.env, RELEASE_TAG: `v${version}`, GITHUB_REPOSITORY: "haipengTian/normal-desk", GH_TOKEN: "", TEST_RELEASE_DIRECTORY: directory },
      });
      if (result.error) throw result.error;
      assert.equal(result.status === 0, ["new", "draft-missing-blockmap", "published"].includes(scenario), result.stderr);
      assert.equal(result.stdout.includes("GH_CREATE_CALLED"), scenario === "new", result.stdout);
      assert.equal(result.stdout.includes("GH_UPLOAD_CALLED"), !["published", "read-failed", "missing-local"].includes(scenario), result.stdout);
      assert.equal(result.stdout.includes("GH_EDIT_CALLED"), ["new", "draft-missing-blockmap", "publish-failed"].includes(scenario), result.stdout);
      if (scenario === "draft-missing-blockmap") assert.ok(result.stdout.indexOf("GH_UPLOAD_CALLED") < result.stdout.indexOf("GH_EDIT_CALLED"));
      if (scenario === "incomplete-upload") assert.match(result.stderr, /Missing release asset: Desktop-Starter-Setup.exe.blockmap/);
      if (scenario === "missing-local") assert.match(result.stderr, /Missing local release asset/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
