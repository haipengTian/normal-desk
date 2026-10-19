import { test } from "node:test";
import assert from "node:assert/strict";
import { SafeNsisUpdater } from "../desktop/native-updater";

test("async installer launch failure keeps app alive and allows retry before quitting", async () => {
  let quits = 0, launches = 0, rejectLaunch: (error: Error) => void = () => {};
  const adapter = { version: "0.3.0", name: "test", isPackaged: true, appUpdateConfigPath: "unused", userDataPath: "unused", baseCachePath: "unused", whenReady: async () => {}, relaunch() {}, quit() { quits++; }, onQuit() {} };
  class Candidate extends SafeNsisUpdater {
    constructor() { super(undefined, adapter); }
    protected async launchInstaller(file: string, args: string[]) {
      assert.equal(file, "verified.exe"); assert.deepEqual(args, ["--updated", "--force-run"]);
      launches++;
      if (launches === 1) await new Promise<void>((_resolve, reject) => { rejectLaunch = reject; });
    }
    prepare() { this.downloadedUpdateHelper = { file: "verified.exe", packageFile: null, downloadedFileInfo: { isAdminRightsRequired: false } } as any; }
  }
  const updater = new Candidate(); updater.prepare();
  const first = updater.quitAndInstall();
  assert.equal(quits, 0); rejectLaunch(new Error("OS denied installer"));
  await assert.rejects(first, /OS denied/); assert.equal(quits, 0);
  await updater.quitAndInstall(); assert.equal(launches, 2); assert.equal(quits, 1);
});
