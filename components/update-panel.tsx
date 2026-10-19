"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import type { UpdateState } from "@/shared/contracts";

export function UpdatePanel() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const api = window.desktop;
    if (!api) { setState({ phase: "unsupported" }); return; }
    let active = true, received = false;
    const unsubscribe = api.onUpdateState(value => { received = true; if (active) setState(value); });
    api.getUpdateState().then(value => { if (active && !received) setState(value); }).catch(() => { if (active) setState({ phase: "error", retry: "check" }); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function run(action: "check" | "download" | "install") {
    const api = window.desktop;
    if (!api || lock.current) return;
    lock.current = true; setPending(true);
    try { await (action === "check" ? api.checkForUpdates() : action === "download" ? api.downloadUpdate() : api.installUpdate()); }
    catch { toast.error(action === "install" ? "未能开始安装，客户端已保留，请重试。" : "更新操作未完成，请重试。"); }
    finally { lock.current = false; setPending(false); }
  }
  const phase = state?.phase;
  const busy = pending || phase === "checking" || phase === "downloading";
  const unavailable = !state || phase === "unsupported" || phase === "unconfigured";
  const action = phase === "downloaded" || state?.retry === "install" ? "install" : phase === "available" || state?.retry === "download" ? "download" : "check";
  const label = action === "install" ? "重启并安装" : action === "download" ? "下载更新" : "检查更新";
  const description = !state ? "正在读取更新状态…" : phase === "unsupported" ? "在 Windows 安装版中可检查和安装更新。" : phase === "unconfigured" ? "尚未配置更新源。" : phase === "checking" ? "正在连接 GitHub Releases…" : phase === "available" ? `发现新版本 v${state.version}，准备好时再下载。` : phase === "downloading" ? `正在下载 v${state.version} · ${Math.round(state.percent ?? 0)}%` : phase === "downloaded" ? `v${state.version} 已下载，重启后安装。` : phase === "error" ? state.retry === "install" ? "安装未能启动，请重试或稍后手动安装。" : "更新失败，请检查网络及仓库是否已发布版本，然后重试。" : "手动检查新版本，不自动下载或重启。";
  return <section className="border-b border-border/70 py-7">
    <div className="flex items-center justify-between gap-6"><div><h2 className="text-sm font-semibold">应用更新</h2><p role="status" className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>
      <Button variant="outline" disabled={unavailable || busy} onClick={() => void run(action)}>
        {busy ? <LoaderCircle className="animate-spin" /> : action === "download" ? <ArrowDownToLine /> : <RefreshCw />}{busy ? phase === "downloading" ? "正在下载…" : "请稍候…" : phase === "error" ? `重试${action === "check" ? "检查" : action === "download" ? "下载" : "安装"}` : label}
      </Button>
    </div>
    {phase === "downloading" && <div role="progressbar" aria-label="更新下载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state?.percent ?? 0)} className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${state?.percent ?? 0}%` }} /></div>}
    <p className="mt-4 text-xs text-muted-foreground">更新源 · GitHub / haipengTian/normal-desk</p>
  </section>;
}
