"use client";
import { useState } from "react";
import { Download, FolderOpen, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DiagnosticActions({ available = true }: { available?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function exportFile() {
    if (!window.desktop || busy) return;
    setBusy(true); setStatus("");
    try { if (await window.desktop.exportDiagnostics()) setStatus("诊断文件已导出"); }
    catch { setStatus("无法导出，请选择可写的位置后重试。"); }
    finally { setBusy(false); }
  }
  async function openLogs() {
    try { await window.desktop?.openLogsDirectory(); }
    catch { toast.error("无法打开日志目录。"); setStatus("无法打开日志目录。"); }
  }
  return <div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={!available || busy} onClick={() => void exportFile()}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}导出诊断</Button>
      <Button variant="ghost" size="sm" disabled={!available || busy} onClick={() => void openLogs()}><FolderOpen className="size-3.5" />打开日志</Button>
    </div>
    <p role="status" className="mt-2 text-sm text-muted-foreground">{status}</p>
  </div>;
}
