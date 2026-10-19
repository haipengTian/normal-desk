import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { UpdateController } from "../desktop/updates";
class Updater extends EventEmitter {
 autoDownload=true;autoInstallOnAppQuit=true;allowDowngrade=true;allowPrerelease=true;disableWebInstaller=false;
 checks=0;downloads=0;installs=0;failure=false;
 async checkForUpdates(){this.checks++;if(this.failure)throw Error("secret network error");this.emit("update-available",{version:"0.4.0"});}
 async downloadUpdate(){this.downloads++;if(this.failure)throw Error("network");this.emit("download-progress",{percent:43.4});this.emit("update-downloaded",{version:"0.4.0"});return ["installer.exe"];}
 quitAndInstall(){this.installs++;}
}
test("updating is explicit, single-flight, and install only follows verified download",async()=>{
 const port=new Updater();const service=new UpdateController(port,()=>{});
 assert.equal(port.autoDownload,false);assert.equal(port.autoInstallOnAppQuit,false);assert.equal(port.allowDowngrade,false);assert.equal(port.disableWebInstaller,true);
 await assert.rejects(service.install());await Promise.all([service.check(),service.check()]);assert.equal(port.checks,1);assert.equal(service.snapshot.phase,"available");
 await service.download();assert.equal(port.downloads,1);assert.equal(service.snapshot.phase,"downloaded");await service.install();assert.equal(port.installs,1);
});
test("failure exposes safe retry without raw messages or auto installing on quit",async()=>{
 const port=new Updater();const service=new UpdateController(port,()=>{});port.failure=true;await service.check();
 assert.equal(service.snapshot.phase,"error");assert.ok(!JSON.stringify(service.snapshot).includes("secret"));
 port.failure=false;await service.check();port.failure=true;await service.download();assert.equal(service.snapshot.retry,"download");await assert.rejects(service.install());
 port.failure=false;await service.download();assert.equal(service.snapshot.phase,"downloaded");
});
test("unconfigured update channels cannot download or execute",async()=>{
 const service=new UpdateController(null,()=>{},"unconfigured");await assert.rejects(service.check());await assert.rejects(service.download());await assert.rejects(service.install());assert.equal(service.snapshot.phase,"unconfigured");
});
test("async install failure offers effective retry without re-downloading", async()=>{
 const port=new Updater();let attempts=0;port.quitAndInstall=async()=>{if(++attempts===1)throw Error("OS refused");};
 const service=new UpdateController(port,()=>{});await service.check();await service.download();await service.install();
 assert.equal(service.snapshot.phase,"error");assert.equal(service.snapshot.retry,"install");assert.equal(attempts,1);
 await service.install();assert.equal(attempts,2);assert.equal(port.downloads,1);
});
test("no-update, malformed metadata and progress boundaries are deterministic",async()=>{
 const port=new Updater();port.checkForUpdates=async()=>{port.emit("update-not-available");};
 const service=new UpdateController(port,()=>{});await service.check();assert.deepEqual(service.snapshot,{phase:"idle"});
 port.checkForUpdates=async()=>{port.emit("update-available",{version:"invalid"});};await service.check();assert.equal(service.snapshot.retry,"check");
 port.checkForUpdates=async()=>{port.emit("update-available",{version:"0.4.0"});};await service.check();
 port.downloadUpdate=async()=>{port.emit("download-progress",{percent:Infinity});assert.equal(service.snapshot.percent,0);port.emit("download-progress",{percent:101});assert.equal(service.snapshot.percent,100);port.emit("download-progress",{percent:-1});assert.equal(service.snapshot.percent,0);port.emit("update-downloaded");return [];};
 await service.download();assert.equal(service.snapshot.phase,"downloaded");
});
