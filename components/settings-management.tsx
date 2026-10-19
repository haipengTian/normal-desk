"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { LoginSettings, Preferences } from "@/shared/contracts";

export type SettingsOperation = "import" | "export" | "reset";
export function SettingsManagement({ disabled, manage }: { disabled: boolean; manage: (operation: SettingsOperation) => Promise<void> }) {
  return <section className="border-t border-border/70 py-8">
    <h2 className="text-sm font-semibold">设置备份</h2>
    <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">迁移外观与交互偏好，不包含凭据、托盘或系统启动选项。</p>
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={disabled} onClick={() => void manage("export")}><Download />导出设置</Button>
      <Button variant="outline" disabled={disabled} onClick={() => void manage("import")}><Upload />导入设置</Button>
      <Button variant="ghost" disabled={disabled} onClick={() => void manage("reset")}><RotateCcw />恢复默认</Button>
    </div>
  </section>;
}
export function DesktopBehavior({ preferences, disabled, update }: { preferences: Preferences; disabled: boolean; update: (patch: Partial<Preferences>) => Promise<void> }) {
  const [login, setLogin] = useState<LoginSettings | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    window.desktop?.getLoginSettings().then(value => { if (active) setLogin(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  async function setStartup(enabled: boolean) {
    if (!window.desktop || busy) return;
    setBusy(true);
    try { setLogin(await window.desktop.setLoginEnabled(enabled)); }
    catch { toast.error("无法更改登录启动选项，请检查 Windows 启动应用设置。当前选项未更改。"); }
    finally { setBusy(false); }
  }
  return <section className="border-t border-border/70 py-3">
    <h2 className="pt-5 text-sm font-semibold">桌面行为</h2>
    <div className="flex items-center justify-between gap-6 border-b border-border/70 py-5"><div>
      <Label htmlFor="tray-enabled" className="text-sm">关闭窗口后留在托盘</Label>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">默认关闭。开启后可从托盘重新打开；选择“退出”才结束应用。</p>
    </div><Switch id="tray-enabled" disabled={disabled} checked={preferences.trayEnabled} onCheckedChange={value => void update({ trayEnabled: value })} /></div>
    <div className="flex items-center justify-between gap-6 py-5"><div>
      <Label htmlFor="login-enabled" className="text-sm">登录系统时启动</Label>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{error ? "无法读取系统启动选项，请重新打开设置页。" : !login ? "正在读取系统选项…" : login.supported ? "默认关闭，启动时显示窗口。此选项由系统单独保存。" : "在 Windows 安装版中可用。"}</p>
    </div><Switch id="login-enabled" disabled={disabled || busy || !login?.supported} checked={login?.enabled ?? false} onCheckedChange={value => void setStartup(value)} /></div>
  </section>;
}
