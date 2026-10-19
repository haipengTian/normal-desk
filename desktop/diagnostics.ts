import type { AppInfo } from "../shared/contracts";

/** Defense in depth. Callers log event codes, not user input or file contents. */
export function redact(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, raw => {
      try { const url = new URL(raw); return `${url.protocol}//${url.host}/[REDACTED]`; }
      catch { return "[REDACTED]"; }
    })
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=][^\r\n]*/gi, "[REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[REDACTED]")
    .replace(/\bsk-[\w-]+/g, "[REDACTED]")
    .replace(/(?:\b[A-Za-z]:[\\/]|\\\\)[^\r\n"'<>]*/g, "[LOCAL_PATH]")
    .replace(/\/(?:home|Users|tmp|var|private|mnt|Volumes)\/[^\s"'<>]+/g, "[LOCAL_PATH]");
}

export function rendererIncident(input: unknown): "error" | "unhandledrejection" | "react" {
  if (!input || typeof input !== "object" || Object.keys(input).length !== 1 ||
    !["error", "unhandledrejection", "react"].includes((input as { kind: string }).kind)) throw new Error("无效的界面异常报告");
  return (input as { kind: "error" | "unhandledrejection" | "react" }).kind;
}

export function diagnosticReport(info: AppInfo, logs: string) {
  const { name, version, electron, chromium, platform, architecture, packaged } = info;
  const bytes = Buffer.from(redact(logs), "utf8");
  let start = Math.max(0, bytes.length - 262144);
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  return {
    format: 1, createdAt: new Date().toISOString(),
    application: { name, version, electron, chromium, platform, architecture, packaged },
    collection: "仅应用事件与运行环境；不含输入内容、本地文件、环境变量或完整设置。",
    logs: bytes.subarray(start).toString("utf8"),
  };
}
