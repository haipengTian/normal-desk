import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("installer enables native browse auto-append without overriding restored installation paths", async () => {
  const configuration = await readFile(path.resolve("electron-builder.yml"), "utf8");
  assert.match(configuration, /^  include: installer\.nsh$/m);
  const include = await readFile(path.resolve("build/installer.nsh"), "utf8");
  // NSIS takes the final component of InstallDir for the Browse button suffix.
  // A runtime StrCpy cannot configure that native behavior and would reset upgrades.
  assert.match(include, /!macro customHeader\s+InstallDir "\$LOCALAPPDATA\\Programs\\\$\{APP_FILENAME\}"\s+!macroend/);
  assert.doesNotMatch(include, /StrCpy\s+\$INSTDIR/);
});
