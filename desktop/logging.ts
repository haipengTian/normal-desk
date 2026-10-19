import log from "electron-log/node";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { diagnosticReport, redact } from "./diagnostics";
import type { AppInfo } from "../shared/contracts";

export class Diagnostics {
  readonly directory: string;
  constructor(userData: string) {
    this.directory = path.join(userData, "logs");
    // The Node entrypoint registers no generic Electron IPC or renderer preload.
    log.transports.file.resolvePathFn = () => path.join(this.directory, "main.log");
    log.transports.file.maxSize = 1024 * 1024;
    log.transports.file.sync = true;
    log.transports.console.level = false;
  }
  event(code: string, detail?: unknown): void {
    const text = detail instanceof Error ? `${detail.name}: ${detail.message}\n${detail.stack ?? ""}` : String(detail ?? "");
    log.info(code, redact(text).slice(0, 4096));
  }
  async openDirectory(): Promise<string> { await mkdir(this.directory, { recursive: true }); return this.directory; }
  async export(file: string, info: AppInfo): Promise<void> {
    const logs = await Promise.all(["main.old.log", "main.log"].map(async name => {
      try { return await readFile(path.join(this.directory, name), "utf8"); }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return code === "ENOENT" ? "" : `[LOG_UNAVAILABLE: ${code ?? "UNKNOWN"}]`;
      }
    }));
    await writeFile(file, JSON.stringify(diagnosticReport(info, logs.join("\n")), null, 2), { encoding: "utf8", mode: 0o600 });
  }
}
