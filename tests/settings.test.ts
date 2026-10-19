import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SettingsStore } from "../desktop/settings";
import { DEFAULT_PREFERENCES } from "../shared/preferences";

async function fixture(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desktop-starter-unit-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
test("first launch uses defaults and returns defensive copies", () => fixture(async directory => {
  const store = new SettingsStore(directory); await store.load();
  assert.deepEqual(store.preferences, DEFAULT_PREFERENCES);
  const copy = store.preferences; copy.themeMode = "dark";
  assert.equal(store.preferences.themeMode, "system");
  assert.equal(store.window, null);
}));
test("persists preferences and window state across restart", () => fixture(async directory => {
  const store = new SettingsStore(directory); await store.load();
  await store.update({ themeMode: "dark", colorTheme: "claude.css" });
  const window = { x: 50, y: 40, width: 1100, height: 780, maximized: true };
  await store.saveWindow(window);
  const restarted = new SettingsStore(directory); await restarted.load();
  assert.equal(restarted.preferences.themeMode, "dark");
  assert.equal(restarted.preferences.colorTheme, "claude.css");
  assert.deepEqual(restarted.window, window);
}));
test("serializes concurrent updates without losing unrelated values", () => fixture(async directory => {
  const store = new SettingsStore(directory); await store.load();
  await Promise.all([store.update({ themeMode: "light" }), store.update({ reducedMotion: true }), store.update({ sidebarCollapsed: true })]);
  const restarted = new SettingsStore(directory); await restarted.load();
  assert.deepEqual(restarted.preferences, { ...DEFAULT_PREFERENCES, themeMode: "light", reducedMotion: true, sidebarCollapsed: true });
}));
test("rejects invalid updates without touching saved data", () => fixture(async directory => {
  const store = new SettingsStore(directory); await store.load();
  await store.update({ themeMode: "dark" });
  const before = await readFile(path.join(directory, "settings.json"), "utf8");
  await assert.rejects(store.update({ themeMode: "invalid" }), /设置参数无效/);
  assert.equal(await readFile(path.join(directory, "settings.json"), "utf8"), before);
}));
test("preserves invalid settings in a backup before loading defaults", () => fixture(async directory => {
  const raw = '{"version":1,broken';
  await writeFile(path.join(directory, "settings.json"), raw);
  const store = new SettingsStore(directory); await store.load();
  assert.deepEqual(store.preferences, DEFAULT_PREFERENCES);
  assert.match(store.warning ?? "", /备份/);
  const backup = (await readdir(directory)).find(name => name.startsWith("settings.invalid-"));
  assert.ok(backup);
  assert.equal(await readFile(path.join(directory, backup), "utf8"), raw);
}));
