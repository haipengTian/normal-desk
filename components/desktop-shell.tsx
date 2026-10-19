"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Blocks, Check, CircleHelp, Command, FolderOpen, Info, Layers3, LayoutDashboard, LoaderCircle, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings2, Sun } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFERENCES } from "@/shared/preferences";
import { DiagnosticActions } from "./diagnostic-actions";
import { CommandPalette } from "./command-palette";
import { DesktopBehavior, SettingsManagement } from "./settings-management";
import type { SettingsOperation } from "./settings-management";
import { UpdatePanel } from "./update-panel";
import themes from "@/shared/themes.generated.json";
import type { AppInfo, Page, Preferences, ThemeMode } from "@/shared/contracts";

const navigation = [
  { id: "overview" as const, label: "概览", icon: LayoutDashboard },
  { id: "components" as const, label: "交互组件", icon: Blocks },
  { id: "settings" as const, label: "设置", icon: Settings2 },
  { id: "about" as const, label: "关于", icon: Info },
];
const platformName = (platform?: string) => ({ win32: "Windows", darwin: "macOS", linux: "Linux" }[platform ?? ""] ?? "浏览器预览");
const themeVariables = new Set(themes.flatMap(theme => [...Object.keys(theme.light), ...Object.keys(theme.dark)]));

export function DesktopShell() {
  const [page, setPage] = useState<Page>("overview");
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const saveLock = useRef(false);
  const mainContent = useRef<HTMLElement>(null);
  const [systemDark, setSystemDark] = useState(false);
  const dark = preferences.themeMode === "dark" || preferences.themeMode === "system" && systemDark;
  const load = useCallback(async () => {
    if (!window.desktop) { setReady(true); return; }
    try {
      const [details] = await Promise.all([
        window.desktop.getInfo(),
        window.desktop.getPreferences().then(stored => { setPreferences(stored); }),
        document.fonts.ready,
      ]);
      setInfo(details); setLoadError(null);
      if (details.startupWarning) toast.warning(details.startupWarning, { duration: 10000 });
    } catch { setLoadError("无法连接桌面服务，请重试或重新启动客户端。"); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { void load(); return window.desktop?.onNavigate(setPage); }, [load]);
  useEffect(() => window.desktop?.onCommandPalette(() => setCommandsOpen(true)), []);
  useEffect(() => { mainContent.current?.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => { if (ready) void window.desktop?.markReady().catch(() => {}); }, [ready]);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("reduce-motion", preferences.reducedMotion);
    root.style.colorScheme = dark ? "dark" : "light";
    for (const key of themeVariables) root.style.removeProperty(`--${key}`);
    const selected = themes.find(theme => theme.id === preferences.colorTheme) ?? themes[0];
    for (const [key, value] of Object.entries(dark ? selected.dark : selected.light)) root.style.setProperty(`--${key}`, value);
    // Resolve any theme color syntax (including OKLCH) to opaque sRGB for native controls.
    const context = document.createElement("canvas").getContext("2d")!;
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return "#" + [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => channel.toString(16).padStart(2, "0")).join("");
    };
    const palette = dark ? selected.dark : selected.light;
    void window.desktop?.setTitleBarColors({ background: color(palette.background), foreground: color(palette.foreground) }).catch(() => toast.error("窗口配色同步失败，请重新打开客户端。"));
  }, [dark, preferences.colorTheme, preferences.reducedMotion]);
  const updatePreferences = useCallback(async (patch: Partial<Preferences>) => {
    if (saveLock.current || !window.desktop || !info) return;
    saveLock.current = true; setSaving(true);
    try { setPreferences(await window.desktop.setPreferences(patch)); }
    catch { toast.error("设置保存失败，请检查数据目录是否可写。当前设置未更改。"); }
    finally { saveLock.current = false; setSaving(false); }
  }, [info]);
  const managePreferences = async (operation: SettingsOperation) => {
    if (saveLock.current || !window.desktop || !info) return;
    saveLock.current = true; setSaving(true);
    try {
      if (operation === "export") {
        if (await window.desktop.exportPreferences()) toast.success("设置已导出");
      } else {
        const preferences = await (operation === "import" ? window.desktop.importPreferences() : window.desktop.resetPreferences());
        if (preferences) { setPreferences(preferences); toast.success(operation === "import" ? "设置已导入" : "已恢复默认设置"); }
      }
    } catch { toast.error(operation === "export" ? "无法导出设置，请选择可写的位置。" : operation === "import" ? "导入失败，请选择有效的设置备份（最大 64 KiB）。当前设置未更改。" : "恢复失败，当前设置未更改。"); }
    finally { saveLock.current = false; setSaving(false); }
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandsOpen(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault(); void updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [preferences.sidebarCollapsed, updatePreferences]);
  const title = navigation.find(item => item.id === page)!.label;
  const disabled = !info || saving;

  return <TooltipProvider delayDuration={250}>
    <div data-platform={info?.platform} data-testid="desktop-shell" data-initializing={!ready} data-ready={ready && !!info} className="desktop-shell flex h-dvh min-w-0 flex-col bg-background text-foreground">
      {!ready && <div data-testid="startup-screen" role="status" aria-label="正在启动应用" className="startup-screen fixed inset-0 z-50 flex select-none flex-col items-center justify-center bg-background">
        <div data-testid="startup-logo" className="startup-logo"><Brand className="size-16 rounded-[20px] shadow-sm" /></div>
        <span className="mt-5 text-sm font-medium tracking-tight text-foreground">Desktop</span>
      </div>}
      <header inert={!ready} data-testid="titlebar" className="desktop-titlebar flex shrink-0 items-center">
        <div data-collapsed={preferences.sidebarCollapsed} className="desktop-sidebar desktop-brand flex h-full shrink-0 items-center gap-2.5 px-5">
          <Brand className="size-6 rounded-lg" /><span className="sidebar-label text-[13px] font-semibold tracking-tight">Desktop</span>
        </div>
        <div className="flex h-full min-w-0 flex-1 items-center gap-3 pl-3">
          <Button disabled={disabled} variant="ghost" size="icon-sm" aria-label={preferences.sidebarCollapsed ? "展开侧栏" : "收起侧栏"} title="Ctrl / ⌘ + B" onClick={() => void updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed })}>{preferences.sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <div className="desktop-titlebar-actions ml-auto flex h-full items-center">
            <Button variant="ghost" size="sm" disabled={disabled || !ready} aria-label="快捷操作" title="Ctrl / ⌘ + K" className="mr-2 gap-2 text-muted-foreground" onClick={() => setCommandsOpen(true)}><Command className="size-3.5" /><span className="text-xs">Ctrl K</span></Button>
            <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={dark ? "切换到浅色" : "切换到深色"} onClick={() => void updatePreferences({ themeMode: dark ? "light" : "dark" })}>{dark ? <Sun /> : <Moon />}</Button>
          </div>
        </div>
      </header>
      <div inert={!ready} className="desktop-body flex min-h-0 flex-1">
      <aside data-testid="sidebar" data-collapsed={preferences.sidebarCollapsed} className="desktop-sidebar flex shrink-0 flex-col bg-sidebar/40 px-3 py-4">
        <nav aria-label="主导航" className="space-y-1">
          {navigation.map(item => <Tooltip key={item.id}><TooltipTrigger asChild>
            <button aria-label={item.label} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)} className={cn("sidebar-item flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", page === item.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
              <item.icon className="size-[18px] shrink-0" /><span className="sidebar-label">{item.label}</span>
            </button>
          </TooltipTrigger>{preferences.sidebarCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}</Tooltip>)}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main ref={mainContent} className="min-h-0 flex-1 overflow-y-auto px-7 py-8 lg:px-12" aria-label={title}>
          <div className="mx-auto max-w-5xl">
            {loadError && <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void load()}>重试连接</Button></div>}
            {!info && ready && !loadError && <div role="status" className="mb-6 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">当前为界面预览。通过 Electron 启动后可使用本地设置和系统接口。</div>}
            <div key={page} className="page-enter">
              {page === "overview" && <Overview navigate={setPage} />}
              {page === "components" && <Components nativeAvailable={!!info} />}
              {page === "settings" && <Settings preferences={preferences} update={updatePreferences} disabled={disabled} saving={saving} manage={managePreferences} />}
              {page === "about" && <About info={info} />}
            </div>
          </div>
        </main>
      </div>
      </div>
    </div>
    <CommandPalette open={commandsOpen && ready} onOpenChange={setCommandsOpen} commands={[
      ...navigation.map(item => ({ id: item.id, label: `打开${item.label}`, hint: item.id === "settings" ? "Ctrl ," : undefined, run: () => setPage(item.id) })),
      ...(info && !saving ? [
        { id: "theme", label: dark ? "切换到浅色" : "切换到深色", run: () => updatePreferences({ themeMode: dark ? "light" : "dark" }) },
        { id: "sidebar", label: preferences.sidebarCollapsed ? "展开侧栏" : "收起侧栏", hint: "Ctrl B", run: () => updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed }) },
        { id: "data", label: "打开数据目录", run: () => window.desktop!.openDataDirectory() },
        { id: "diagnostics", label: "导出诊断", run: async () => { if (await window.desktop!.exportDiagnostics()) toast.success("诊断文件已导出"); } },
      ] : []),
    ]} />
    <Toaster theme={dark ? "dark" : "light"} position="bottom-right" closeButton richColors />
  </TooltipProvider>;
}

function Brand({ className }: { className?: string }) {
  return <div className={cn("flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground", className)}><Layers3 className="size-[55%]" strokeWidth={1.7} /></div>;
}

function Overview({ navigate }: { navigate: (page: Page) => void }) {
  return <>
    <section className="relative flex min-h-[310px] items-center justify-between gap-10 border-b border-border/70 pb-10 pt-5">
      <div className="relative z-10 max-w-xl"><div className="mb-6 flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-muted-foreground"><span className="h-px w-6 bg-primary" />DESKTOP STARTER</div><h1 className="text-[32px] font-semibold leading-[1.5] tracking-tight xl:text-[38px]">你的下一个应用，<br />从这里开始。</h1><p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">熟悉的界面，原生的桌面能力。<br />一个干净、独立、可以持续扩展的起点。</p><div className="mt-7 flex gap-3"><Button onClick={() => navigate("components")}>探索组件<ArrowRight className="size-4" /></Button><Button variant="outline" onClick={() => navigate("settings")}>调整外观</Button></div></div>
      <div aria-hidden="true" className="welcome-art pointer-events-none mr-5 w-[270px] shrink-0 select-none">
        <div className="window-sketch h-[185px] rounded-xl border border-border bg-muted/30 p-2 shadow-sm"><div className="flex h-5 gap-1.5 px-2"><span className="size-1.5 rounded-full bg-muted-foreground/30" /><span className="size-1.5 rounded-full bg-muted-foreground/20" /><span className="size-1.5 rounded-full bg-muted-foreground/15" /></div><div className="window-sketch-inner flex h-[150px] overflow-hidden rounded-xl border bg-background shadow-lg shadow-black/5"><div className="w-12 space-y-3 border-r bg-muted/40 p-3"><div className="size-5 rounded-md bg-primary/20" /><div className="h-1 rounded bg-muted-foreground/20" /><div className="h-1 rounded bg-muted-foreground/20" /><div className="h-1 rounded bg-muted-foreground/20" /></div><div className="flex flex-1 flex-col justify-center gap-3 p-5"><Layers3 className="size-8 text-primary" strokeWidth={1.3} /><div className="h-2 w-24 rounded bg-foreground/15" /><div className="h-1.5 w-32 rounded bg-foreground/7" /><div className="h-5 w-14 rounded bg-primary/15" /></div></div></div>
      </div>
    </section>
    <section className="pt-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold">从基础开始</h2><span className="text-xs text-muted-foreground">界面 · 交互 · 桌面</span></div><div className="grid grid-cols-3 gap-4">{[
      { title: "交互组件", description: "按钮、输入、弹窗与通知。", icon: Blocks, page: "components" as const },
      { title: "个性外观", description: "明暗模式与多种原版配色。", icon: Sun, page: "settings" as const },
      { title: "关于应用", description: "应用信息与开源许可。", icon: CircleHelp, page: "about" as const },
    ].map(item => <button key={item.title} onClick={() => navigate(item.page)} className="group rounded-xl border border-border/70 p-5 text-left transition-colors hover:border-primary/35 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"><div className="mb-5 flex items-center justify-between"><item.icon className="size-5 text-primary" strokeWidth={1.5} /><ArrowUpRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><h3 className="text-sm font-medium">{item.title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{item.description}</p></button>)}</div></section>
  </>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-8"><p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div>;
}

function Components({ nativeAvailable }: { nativeAvailable: boolean }) {
  const [text, setText] = useState("");
  const [directory, setDirectory] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  async function choose() {
    if (!window.desktop) return;
    setChoosing(true);
    try { const selected = await window.desktop.chooseDirectory(); if (selected !== null) setDirectory(selected); }
    catch { toast.error("无法打开目录选择窗口，请重试。"); }
    finally { setChoosing(false); }
  }
  return <><PageHeading eyebrow="COMPONENTS" title="交互组件" description="试一试基础交互，作为后续页面的共同语言。" /><div className="grid grid-cols-2 gap-5">
    <DemoSection title="按钮与反馈" description="明确的主次操作，即时的状态反馈。"><div className="flex flex-wrap gap-2"><Button onClick={() => toast.success("通知已就绪", { description: "操作反馈会显示在窗口右下角。" })}>显示通知</Button><Button variant="outline" onClick={() => toast.info("这是一条提示消息")}>次要操作</Button><Button disabled>不可用</Button></div></DemoSection>
    <DemoSection title="对话框" description="支持焦点约束、Escape 关闭与键盘操作。"><Dialog><DialogTrigger asChild><Button variant="outline">打开示例弹窗</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>一个恰到好处的对话框</DialogTitle><DialogDescription>用于需要用户注意或确认的独立操作。</DialogDescription></DialogHeader><p className="py-4 text-sm leading-7 text-muted-foreground">正文、操作和退出路径都有自己的位置。这个示例不修改任何本地数据。</p><DialogFooter><DialogClose asChild><Button variant="outline">关闭</Button></DialogClose><DialogClose asChild><Button>知道了</Button></DialogClose></DialogFooter></DialogContent></Dialog></DemoSection>
    <DemoSection title="输入与状态" description="标签清晰，输入状态可以直接查看。"><Label htmlFor="example-input">示例文本</Label><Input id="example-input" className="mt-2" placeholder="输入一点内容…" value={text} onChange={event => setText(event.target.value)} maxLength={120} /><p className="mt-3 break-all text-xs leading-6 text-muted-foreground" aria-live="polite">{text ? `当前输入：${text}` : "尚未输入内容"}<span className="ml-2 font-mono">{text.length}/120</span></p></DemoSection>
    <DemoSection title="原生目录选择" description="通过系统窗口选择目录，仅显示路径。"><Button disabled={!nativeAvailable || choosing} variant="outline" onClick={() => void choose()}>{choosing ? <LoaderCircle className="animate-spin" /> : <FolderOpen />}选择目录</Button><p data-testid="directory-result" aria-live="polite" className="mt-4 break-all rounded-lg bg-muted/60 px-3 py-2.5 font-mono text-xs leading-6 text-muted-foreground">{directory ?? "尚未选择目录"}</p></DemoSection>
  </div></>;
}

function DemoSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border/70 p-6"><h2 className="text-sm font-semibold">{title}</h2><p className="mb-6 mt-2 text-xs leading-6 text-muted-foreground">{description}</p>{children}</section>;
}

function Settings({ preferences, update, disabled, saving, manage }: { preferences: Preferences; update: (patch: Partial<Preferences>) => Promise<void>; disabled: boolean; saving: boolean; manage: (operation: SettingsOperation) => Promise<void> }) {
  const modes: { id: ThemeMode; title: string; icon: typeof Sun }[] = [{ id: "light", title: "浅色", icon: Sun }, { id: "dark", title: "深色", icon: Moon }, { id: "system", title: "跟随系统", icon: Monitor }];
  const featured = ["default.css", "claude.css", "graphite.css", "ocean-breeze.css", "nature.css", "catppuccin.css"].map(id => themes.find(theme => theme.id === id)!);
  return <><PageHeading eyebrow="PREFERENCES" title="让界面适合你" description="调整外观和使用习惯，设置自动保存在本机。" />
    <section className="border-b border-border/70 pb-8"><h2 className="mb-4 text-sm font-semibold">显示模式</h2><div className="grid max-w-2xl grid-cols-3 gap-3">{modes.map(mode => <button key={mode.id} disabled={disabled} aria-pressed={preferences.themeMode === mode.id} onClick={() => void update({ themeMode: mode.id })} className={cn("flex items-center gap-3 rounded-xl border px-5 py-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", preferences.themeMode === mode.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-muted/40")}><mode.icon className="size-4 text-muted-foreground" />{mode.title}{preferences.themeMode === mode.id && <Check className="ml-auto size-3.5 text-primary" />}</button>)}</div></section>
    <section className="border-b border-border/70 py-8"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-sm font-semibold">配色方案</h2><div className="flex items-center gap-3"><Label htmlFor="color-theme" className="text-xs text-muted-foreground">全部 {themes.length} 种配色</Label><select id="color-theme" disabled={disabled} value={preferences.colorTheme} onChange={event => void update({ colorTheme: event.target.value })} className="h-8 max-w-48 rounded-md border bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring">{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></div></div><div className="grid grid-cols-3 gap-3 xl:grid-cols-6">{featured.map(theme => <button key={theme.id} disabled={disabled} aria-pressed={preferences.colorTheme === theme.id} onClick={() => void update({ colorTheme: theme.id })} className={cn("rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", preferences.colorTheme === theme.id ? "border-primary" : "border-border/70 hover:border-primary/40")}><div className="mb-3 flex h-14 items-end gap-1 rounded-md border p-2" style={{ background: theme.light.background }}>{[theme.light.primary, theme.light.secondary, theme.light.muted, theme.dark.primary].map((color, index) => <span key={index} className="h-6 flex-1 rounded-sm" style={{ background: color }} />)}</div><div className="flex items-center justify-between gap-1 text-xs"><span>{theme.name}</span>{preferences.colorTheme === theme.id && <Check className="size-3 shrink-0 text-primary" />}</div></button>)}</div></section>
    <section className="py-3"><div className="flex items-center justify-between gap-4 border-b border-border/70 py-5"><div><Label htmlFor="reduced-motion" className="text-sm">减少动态效果</Label><p className="mt-2 text-xs text-muted-foreground">关闭页面切换与界面过渡动画，也尊重系统的动态效果偏好。</p></div><Switch id="reduced-motion" disabled={disabled} checked={preferences.reducedMotion} onCheckedChange={value => void update({ reducedMotion: value })} /></div><div className="flex items-center justify-between gap-4 py-5"><div><Label htmlFor="collapse-sidebar" className="text-sm">紧凑侧栏</Label><p className="mt-2 text-xs text-muted-foreground">仅保留导航图标，为内容留出更多空间。</p></div><Switch id="collapse-sidebar" disabled={disabled} checked={preferences.sidebarCollapsed} onCheckedChange={value => void update({ sidebarCollapsed: value })} /></div></section>
    <DesktopBehavior preferences={preferences} update={update} disabled={disabled} />
    <SettingsManagement manage={manage} disabled={disabled} />
    <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownToLine className="size-3.5" />{saving ? "正在保存…" : disabled ? "桌面连接后可保存设置" : "更改会自动保存"}<span className="ml-auto flex items-center gap-1.5"><Command className="size-3" />Ctrl / ⌘ + K 快捷操作</span></div>
  </>;
}

function About({ info }: { info: AppInfo | null }) {
  async function openData() { try { await window.desktop?.openDataDirectory(); } catch { toast.error("无法打开数据目录。"); } }
  async function openDocs(document: "electron" | "credit") { try { await window.desktop?.openDocumentation(document); } catch { toast.error("无法打开文档链接。"); } }
  return <><div className="flex items-center gap-5 border-b border-border/70 pb-8 pt-2"><Brand className="size-16 rounded-2xl" /><div><h1 className="text-2xl font-semibold tracking-tight">Desktop Starter</h1><p className="mt-2 text-sm text-muted-foreground">通用桌面客户端 · v{info?.version ?? "—"}</p></div></div><UpdatePanel /><section className="py-8"><h2 className="mb-5 text-sm font-semibold">运行环境</h2><dl className="grid grid-cols-2 gap-x-12">{[["操作系统", platformName(info?.platform)], ["架构", info?.architecture ?? "—"], ["Electron", info?.electron ?? "—"], ["Chromium", info?.chromium ?? "—"], ["运行方式", info ? info.packaged ? "已打包客户端" : "源码运行" : "浏览器预览"], ["界面资源", "随应用内置"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-border/60 py-4 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono text-xs">{value}</dd></div>)}</dl></section><section className="rounded-xl border border-border/70 p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-medium">应用数据目录</h2><p className="mt-2 text-xs text-muted-foreground">存放外观设置、窗口状态和 Chromium 本地数据。</p></div><Button variant="outline" size="sm" disabled={!info} onClick={() => void openData()}><FolderOpen className="size-3.5" />打开目录</Button></div><p className="mt-4 break-all rounded-md bg-muted/50 px-3 py-2.5 font-mono text-xs leading-6 text-muted-foreground">{info?.dataPath ?? "桌面客户端启动后显示"}</p></section><section className="mt-6 rounded-xl border border-border/70 p-5"><h2 className="text-sm font-medium">诊断与恢复</h2><p className="mb-4 mt-2 text-sm leading-6 text-muted-foreground">遇到异常时导出运行环境与近期应用事件，不包含输入内容或本地文件。</p><DiagnosticActions available={!!info} /></section><section className="mt-8"><h2 className="text-sm font-semibold">来源与许可</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">界面基础来自 Credit UI（Apache-2.0），桌面运行时使用 Electron（MIT）。<br />原始许可与字体声明随客户端保留在 licenses 目录。</p><div className="mt-4 flex gap-5"><button disabled={!info} onClick={() => void openDocs("electron")} className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50">Electron 文档<ArrowUpRight className="size-3" /></button><button disabled={!info} onClick={() => void openDocs("credit")} className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50">Credit 源项目<ArrowUpRight className="size-3" /></button></div></section></>;
}
