import { spawn } from "node:child_process";
import { NsisUpdater } from "electron-updater";

/** Keep upstream provider, download, checksum and signature verification intact.
 * Only explicit per-user installer launch waits for Windows to accept the process.
 * Upstream 6.8.9 quits before its asynchronous spawn failure can be handled.
 */
export class SafeNsisUpdater extends NsisUpdater {
  protected launchInstaller(file: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, { detached: true, stdio: "ignore" });
      child.once("error", reject);
      child.once("spawn", () => { child.unref(); resolve(); });
    });
  }
  override async quitAndInstall(isSilent = false, isForceRunAfter = false): Promise<void> {
    if (this.quitAndInstallCalled) return;
    const helper = this.downloadedUpdateHelper;
    if (!helper?.file || !helper.downloadedFileInfo) throw new Error("请先完整下载更新");
    // This product deliberately ships only full, current-user NSIS installers.
    if (helper.packageFile || helper.downloadedFileInfo.isAdminRightsRequired) throw new Error("此更新需要手动安装");
    const args = ["--updated"];
    if (isSilent) args.push("/S");
    if (isSilent ? isForceRunAfter : this.autoRunAppAfterInstall) args.push("--force-run");
    if (this.installDirectory) args.push(`/D=${this.installDirectory}`);
    this.quitAndInstallCalled = true;
    try { await this.launchInstaller(helper.file, args); }
    catch (error) { this.quitAndInstallCalled = false; throw error; }
    this.app.quit();
  }
}
