import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES } from "../shared/preferences";
import { exportPreferences, parsePreferencesBackup } from "../shared/preferences-backup";

test("backup contains only portable preferences, not runtime options or credentials",()=>{
 const backup=exportPreferences({...DEFAULT_PREFERENCES, trayEnabled:true, token:"secret"} as never);
 assert.deepEqual(Object.keys(backup.preferences).sort(),["colorTheme","reducedMotion","sidebarCollapsed","themeMode"]);
 assert.ok(!JSON.stringify(backup).includes("secret"));assert.ok(!JSON.stringify(backup).includes("trayEnabled"));
 assert.equal(parsePreferencesBackup(JSON.stringify(backup)).themeMode,"system");
});
test("invalid or future backups are rejected, never partially applied",()=>{
 for(const raw of ["{", "null", JSON.stringify({version:2}), JSON.stringify({format:"desktop-starter/preferences",version:1,preferences:{themeMode:"dark"}}), JSON.stringify({format:"desktop-starter/preferences",version:1,preferences:{...DEFAULT_PREFERENCES}}),"x".repeat(65537)])assert.throws(()=>parsePreferencesBackup(raw));
});
