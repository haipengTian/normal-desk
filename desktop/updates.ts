import type { UpdateState } from "../shared/contracts";

export interface UpdaterPort {
  autoDownload: boolean; autoInstallOnAppQuit: boolean; allowDowngrade: boolean; allowPrerelease: boolean; disableWebInstaller: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void | Promise<void>;
}
export class UpdateController {
  private state: UpdateState;
  private busy = false;
  constructor(private readonly updater: UpdaterPort | null, private readonly changed: (state: UpdateState) => void,
    phase: "idle" | "unconfigured" | "unsupported" = "idle", private readonly log: (code: string, error?: unknown) => void = () => {}) {
    this.state = { phase };
    if (!updater) return;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;
    updater.on("update-available", info => {
      if (this.state.phase !== "checking") return;
      if (!info || typeof info.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\da-zA-Z.-]+)?$/.test(info.version)) { this.fail("check"); return; }
      this.set({ phase: "available", version: info.version });
    });
    updater.on("update-not-available", () => { if (this.state.phase === "checking") this.set({ phase: "idle" }); });
    updater.on("download-progress", progress => {
      if (this.state.phase === "downloading" && Number.isFinite(progress?.percent)) this.set({ ...this.state, percent: Math.min(100, Math.max(0, progress.percent)) });
    });
    updater.on("update-downloaded", () => { if (this.state.phase === "downloading") this.set({ phase: "downloaded", version: this.state.version, percent: 100 }); });
    updater.on("error", error => {
      this.log("updater.error", error);
      if (["checking", "downloading"].includes(this.state.phase)) this.fail(this.state.phase === "checking" ? "check" : "download");
      else if (this.state.phase === "downloaded") this.fail("install");
    });
  }
  get snapshot(): UpdateState { return { ...this.state }; }
  private set(state: UpdateState) { this.state = state; this.changed(this.snapshot); }
  private fail(retry: "check" | "download" | "install") { this.set({ phase: "error", retry, ...(retry !== "check" ? { version: this.state.version } : {}) }); }
  async check(): Promise<void> {
    if (!this.updater) throw new Error("当前客户端未启用更新渠道");
    if (this.busy || ["downloading", "downloaded"].includes(this.state.phase)) return;
    this.busy = true;
    this.set({ phase: "checking" });
    try { await this.updater.checkForUpdates(); }
    catch (error) { this.log("updater.check_failed", error); this.fail("check"); }
    finally { this.busy = false; }
  }
  async download(): Promise<void> {
    if (!this.updater) throw new Error("当前客户端未启用更新渠道");
    if (this.busy) return;
    if (!(this.state.phase === "available" || this.state.phase === "error" && this.state.retry === "download")) throw new Error("请先检查更新");
    this.busy = true;
    this.set({ phase: "downloading", version: this.state.version, percent: 0 });
    try { await this.updater.downloadUpdate(); }
    catch (error) { this.log("updater.download_failed", error); this.fail("download"); }
    finally { this.busy = false; }
  }
  async install(): Promise<void> {
    if (!this.updater || this.busy || !(this.state.phase === "downloaded" || this.state.phase === "error" && this.state.retry === "install")) throw new Error("请先完整下载更新");
    this.set({ phase: "downloaded", version: this.state.version, percent: 100 });
    try { await this.updater.quitAndInstall(); }
    catch (error) { this.log("updater.install_failed", error); this.fail("install"); }
  }
}
