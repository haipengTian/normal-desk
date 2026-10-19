import { test } from "node:test";
import assert from "node:assert/strict";
import { SettingsStore } from "../desktop/settings";
import { mkdtemp,writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_PREFERENCES } from "../shared/preferences";
test("old profiles gain a disabled tray without losing appearance",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"desktop-migration-"));await writeFile(path.join(root,"settings.json"),JSON.stringify({version:1,preferences:{themeMode:"dark",colorTheme:"default.css",reducedMotion:false,sidebarCollapsed:false},window:null}));
 const store=new SettingsStore(root);await store.load();assert.equal(store.preferences.trayEnabled,false);assert.equal(store.preferences.themeMode,"dark");assert.equal(store.warning,null);
});
test("reset restores preferences without discarding window geometry",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"desktop-reset-"));const store=new SettingsStore(root);await store.load();await store.update({themeMode:"dark",trayEnabled:true});const win={x:0,y:0,width:1000,height:700,maximized:false};await store.saveWindow(win);
 await store.reset();assert.deepEqual(store.preferences,DEFAULT_PREFERENCES);assert.deepEqual(store.window,win);
});
