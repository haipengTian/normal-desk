import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, protocol, screen, session, shell, Tray } from "electron";
import type { IpcMainInvokeEvent, MenuItemConstructorOptions } from "electron";
import { open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Diagnostics } from "./logging";
import { rendererIncident } from "./diagnostics";
import { RecoveryController } from "./recovery";
import { SettingsStore } from "./settings";
import { SafeNsisUpdater } from "./native-updater";
import { UpdateController } from "./updates";
import { DEFAULT_PREFERENCES, validatePreferencesPatch } from "../shared/preferences";
import { exportPreferences, parsePreferencesBackup } from "../shared/preferences-backup";
import { documentationUrl, isTrustedRendererUrl, resolveAssetPath, validateTitleBarColors } from "./security";
import type { AppInfo, LoginSettings, Page, Preferences } from "../shared/contracts";

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
// Test runners use an isolated profile instead of touching the user's preferences.
if (process.env.DESKTOP_STARTER_PROFILE) app.setPath("userData", path.resolve(process.env.DESKTOP_STARTER_PROFILE));
app.setName("Desktop Starter");
app.setAppUserModelId("local.desktop-starter");
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
if (devUrl && devUrl !== "http://127.0.0.1:3014") throw new Error("Unsupported development origin");
const assetRoot = path.join(app.getAppPath(), "out");
let mainWindow: BrowserWindow | null = null;
let settings: SettingsStore;
const diagnostics = new Diagnostics(app.getPath("userData"));
let clearStartupTimer = () => {};
let exportOpen = false;
let fatalOpen = false;
let tray: Tray | null = null;
let quitting = false;
let updates: UpdateController;
let saveCurrentWindow = async () => {};
let windowStateSavedForUpdate = false;
let preferenceQueue: Promise<unknown> = Promise.resolve();

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
function makeTray(): Tray {
  const icon = nativeImage.createFromPath(path.join(assetRoot, "icon.png")).resize({ width: 16, height: 16 });
  if (icon.isEmpty()) throw new Error("无法加载托盘图标");
  const candidate = new Tray(icon);
  try {
    candidate.setToolTip(app.getName());
    candidate.setContextMenu(Menu.buildFromTemplate([
      { label: "显示窗口", click: showWindow },
      { label: "设置", click: () => { showWindow(); navigate("settings"); } },
      { type: "separator" }, { label: "退出", click: () => app.quit() },
    ]));
    candidate.on("click", showWindow); candidate.on("double-click", showWindow);
    return candidate;
  } catch (error) { candidate.destroy(); throw error; }
}
function applyPreferences(input: unknown): Promise<Preferences> {
  const change = preferenceQueue.then(async () => {
    const patch = validatePreferencesPatch(input);
    let candidate: Tray | null = null;
    if (patch.trayEnabled && (!tray || tray.isDestroyed())) candidate = makeTray();
    try {
      const preferences = await settings.update(patch);
      if (candidate) tray = candidate;
      if (!preferences.trayEnabled) { tray?.destroy(); tray = null; }
      nativeTheme.themeSource = preferences.themeMode;
      return preferences;
    } catch (error) { candidate?.destroy(); diagnostics.event("settings.write_failed", error); throw error; }
  });
  preferenceQueue = change.catch(() => {});
  return change;
}
function loginSettings(): LoginSettings {
  const supported = app.isPackaged && process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_FILE;
  if (!supported) return { supported: false, enabled: false };
  const actual = app.getLoginItemSettings({ path: process.execPath, args: [] });
  return { supported: true, enabled: actual.openAtLogin && actual.executableWillLaunchAtLogin };
}
function initializeUpdates(): void {
  const supported = app.isPackaged && process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_FILE;
  const updater = supported ? new SafeNsisUpdater() : null;
  if (updater) updater.logger = {
    info: message => diagnostics.event("updater.info", message),
    warn: message => diagnostics.event("updater.warning", message),
    error: message => diagnostics.event("updater.failure", message),
  };
  updates = new UpdateController(updater, state => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("desktop:update:state", state);
  }, supported ? "idle" : "unsupported", (code, error) => diagnostics.event(code, error));
}

function appInfo(): AppInfo {
  return { name: app.getName(), version: app.getVersion(), electron: process.versions.electron,
    chromium: process.versions.chrome, platform: process.platform, architecture: process.arch,
    packaged: app.isPackaged, dataPath: app.getPath("userData"), startupWarning: settings?.warning ?? null };
}

async function exportDiagnostics(): Promise<boolean> {
  if (exportOpen) throw new Error("诊断导出窗口已经打开");
  exportOpen = true;
  try {
    const options = { title: "导出诊断", defaultPath: `Desktop-Starter-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, filters: [{ name: "诊断文件", extensions: ["json"] }] };
    const result = mainWindow && !mainWindow.isDestroyed() ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    diagnostics.event("diagnostics.export");
    await diagnostics.export(result.filePath, appInfo());
    return true;
  } catch (error) { diagnostics.event("diagnostics.export_failed", error); throw new Error("无法导出诊断，请选择可写的位置后重试。"); }
  finally { exportOpen = false; }
}

async function exportFromRecovery(): Promise<void> {
  try { await exportDiagnostics(); }
  catch { dialog.showErrorBox("导出失败", "无法写入诊断文件，请选择可写的位置后重试。"); }
}

async function fatal(error: unknown): Promise<void> {
  diagnostics.event("process.fatal", error);
  if (fatalOpen) return;
  fatalOpen = true;
  clearStartupTimer();
  try {
    await app.whenReady();
    for (;;) {
      const { response } = await dialog.showMessageBox({ type: "error", title: "客户端无法继续运行", message: "客户端遇到异常，需要重新启动。", detail: "可以先导出诊断用于排查。本地设置将保留；重启前请检查数据目录权限。", buttons: ["重新启动", "导出诊断", "退出"], defaultId: 1, cancelId: 2 });
      if (response === 1) { await exportFromRecovery(); continue; }
      if (response === 0) app.relaunch();
      app.exit(1); return;
    }
  } catch { app.exit(1); }
}
process.on("uncaughtException", error => { void fatal(error); });
process.on("unhandledRejection", error => { void fatal(error); });
app.on("before-quit", () => { quitting = true; });
app.on("will-quit", () => { tray?.destroy(); diagnostics.event("session.ended"); });

const mimeTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

async function serveAsset(request: Request): Promise<Response> {
  const file = resolveAssetPath(request.url, assetRoot);
  if (!file || request.method !== "GET") return new Response("Forbidden", { status: 403 });
  try {
    const contents = await readFile(file);
    const headers: Record<string, string> = { "Content-Type": mimeTypes[path.extname(file)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" };
    if (file.endsWith(".html")) {
      // Next's static bootstrap is inline; hash only the scripts shipped with the app.
      const scripts = [...contents.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
      const hashes = scripts.map(match => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`).join(" ");
      headers["Content-Security-Policy"] = `default-src 'none'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
    }
    return new Response(new Uint8Array(contents), { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") diagnostics.event("asset.read_failed", error);
    return new Response("Not found", { status: 404 });
  }
}

function assertSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame ||
    !event.senderFrame || !isTrustedRendererUrl(event.senderFrame.url, devUrl)) throw new Error("不受信任的调用来源");
}

function registerIPC(): void {
  const handle = (channel: string, handler: (argument: unknown) => unknown) => {
    ipcMain.handle(channel, async (event, argument: unknown) => {
      try { assertSender(event); return await handler(argument); }
      catch (error) { diagnostics.event("ipc.failed", channel); throw error; }
    });
  };
  handle("desktop:titlebar:colors", input => {
    const colors = validateTitleBarColors(input);
    if (process.platform !== "darwin") mainWindow!.setTitleBarOverlay({ ...colors, height: 48 });
  });
  handle("desktop:info", appInfo);
  handle("desktop:ready", () => { clearStartupTimer(); });
  handle("desktop:diagnostics:export", exportDiagnostics);
  handle("desktop:logs:open", async () => {
    const error = await shell.openPath(await diagnostics.openDirectory());
    if (error) throw new Error("无法打开日志目录");
  });
  let incidentWindow = Date.now(), incidentCount = 0;
  handle("desktop:incident", input => {
    const kind = rendererIncident(input);
    if (Date.now() - incidentWindow >= 60000) { incidentWindow = Date.now(); incidentCount = 0; }
    if (++incidentCount <= 20) diagnostics.event("renderer.incident", kind);
  });
  handle("desktop:preferences:get", () => settings.preferences);
  handle("desktop:preferences:set", applyPreferences);
  let transferOpen = false;
  const transfer = async <T>(action: () => Promise<T>): Promise<T> => {
    if (transferOpen) throw new Error("设置管理窗口已经打开");
    transferOpen = true;
    try { return await action(); } finally { transferOpen = false; }
  };
  handle("desktop:preferences:export", () => transfer(async () => {
    const result = await dialog.showSaveDialog(mainWindow!, { title: "导出设置", defaultPath: "Desktop-Starter-preferences.json", filters: [{ name: "设置备份", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(exportPreferences(settings.preferences), null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    return true;
  }));
  handle("desktop:preferences:import", () => transfer(async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { title: "导入设置", properties: ["openFile"], filters: [{ name: "设置备份", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = await open(result.filePaths[0], "r");
    let raw: string;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 65536) throw new Error("请选择不超过 64 KiB 的设置文件");
      const buffer = Buffer.alloc(65537);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 65536) throw new Error("设置文件不能超过 64 KiB");
      raw = buffer.subarray(0, length).toString("utf8");
    } finally { await file.close(); }
    return applyPreferences(parsePreferencesBackup(raw));
  }));
  handle("desktop:preferences:reset", () => transfer(async () => {
    const { response } = await dialog.showMessageBox(mainWindow!, { type: "question", title: "恢复默认设置", message: "恢复默认外观和使用习惯？", detail: "将关闭托盘驻留；保留窗口位置、本地文件与系统登录启动选项。", buttons: ["恢复默认", "取消"], defaultId: 1, cancelId: 1 });
    return response === 0 ? applyPreferences({ ...DEFAULT_PREFERENCES }) : null;
  }));
  handle("desktop:login:get", loginSettings);
  handle("desktop:login:set", enabled => {
    if (typeof enabled !== "boolean") throw new Error("启动选项参数无效");
    if (!loginSettings().supported) throw new Error("请在 Windows 安装版中设置登录启动");
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] });
    const actual = loginSettings();
    if (actual.enabled !== enabled) throw new Error("系统未应用此选项，请检查 Windows 启动应用设置。");
    return actual;
  });
  handle("desktop:update:get", () => updates.snapshot);
  handle("desktop:update:check", () => updates.check());
  handle("desktop:update:download", () => updates.download());
  let installOpen = false;
  handle("desktop:update:install", async () => {
    if (installOpen) return;
    installOpen = true;
    try {
      if (!(updates.snapshot.phase === "downloaded" || updates.snapshot.retry === "install")) throw new Error("请先完整下载更新");
      const { response } = await dialog.showMessageBox(mainWindow!, { type: "question", title: "安装更新", message: "现在重启并安装更新？", detail: "客户端将关闭，安装完成后重新打开。本地设置将保留。", buttons: ["重启并安装", "稍后"], defaultId: 1, cancelId: 1 });
      if (response !== 0) return;
      await preferenceQueue;
      await saveCurrentWindow();
      windowStateSavedForUpdate = true;
      try { await updates.install(); }
      finally { windowStateSavedForUpdate = false; }
    } finally { installOpen = false; }
  });
  let directoryDialogOpen = false;
  handle("desktop:directory:choose", async () => {
    if (directoryDialogOpen) throw new Error("目录选择窗口已经打开");
    directoryDialogOpen = true;
    try {
      const result = await dialog.showOpenDialog(mainWindow!, { title: "选择目录", properties: ["openDirectory"] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    } finally { directoryDialogOpen = false; }
  });
  handle("desktop:data:open", async () => {
    const error = await shell.openPath(app.getPath("userData"));
    if (error) throw new Error(`无法打开数据目录：${error}`);
  });
  handle("desktop:documentation:open", key => shell.openExternal(documentationUrl(key)));
}

function navigate(page: Page): void { mainWindow?.webContents.send("desktop:navigate", page); }

function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
    { label: "应用", submenu: [
      { label: "概览", click: () => navigate("overview") },
      { label: "设置", accelerator: "CmdOrCtrl+,", click: () => navigate("settings") },
      { label: "快捷操作", accelerator: "CmdOrCtrl+K", click: () => mainWindow?.webContents.send("desktop:commands") },
      { type: "separator" }, { role: "quit", label: "退出" },
    ] },
    { label: "编辑", submenu: [{ role: "undo", label: "撤销" }, { role: "redo", label: "重做" }, { type: "separator" }, { role: "cut", label: "剪切" }, { role: "copy", label: "复制" }, { role: "paste", label: "粘贴" }, { role: "selectAll", label: "全选" }] },
    { label: "视图", submenu: [
      { role: "resetZoom", label: "实际大小" }, { role: "zoomIn", label: "放大" }, { role: "zoomOut", label: "缩小" },
      { role: "togglefullscreen", label: "全屏" },
      ...(!app.isPackaged ? [{ role: "toggleDevTools" as const, label: "开发者工具" }] : []),
    ] },
    { label: "帮助", submenu: [{ label: "关于 Desktop Starter", click: () => navigate("about") }, { label: "导出诊断", click: () => { void exportFromRecovery(); } }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const saved = settings.window;
  const area = saved ? screen.getDisplayMatching(saved).workArea : screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.max(saved?.width ?? 1280, 900), area.width);
  const height = Math.min(Math.max(saved?.height ?? 860, 620), area.height);
  const x = saved ? Math.max(area.x, Math.min(saved.x, area.x + area.width - width)) : undefined;
  const y = saved ? Math.max(area.y, Math.min(saved.y, area.y + area.height - height)) : undefined;
  const titleBarColors = {
    color: nativeTheme.shouldUseDarkColors ? "#18181b" : "#ffffff",
    symbolColor: nativeTheme.shouldUseDarkColors ? "#e4e4e7" : "#3f3f46",
  };
  const window = new BrowserWindow({
    title: "Desktop Starter", width, height, x, y,
    minWidth: Math.min(900, area.width), minHeight: Math.min(620, area.height),
    show: false, backgroundColor: nativeTheme.shouldUseDarkColors ? "#18181b" : "#ffffff",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    ...(process.platform !== "darwin" ? { titleBarOverlay: {
      ...titleBarColors, height: 48,
    } } : { trafficLightPosition: { x: 16, y: 17 } }),
    icon: path.join(app.getAppPath(), "out/icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged },
  });
  mainWindow = window;
  // Persist content bounds: hidden title bars on Windows include invisible frame
  // pixels in outer bounds, which otherwise accumulate at fractional display DPI.
  let normalBounds = { x: x ?? window.getContentBounds().x, y: y ?? window.getContentBounds().y, width, height };
  const rememberBounds = () => {
    if (!window.isMaximized() && !window.isMinimized() && !window.isFullScreen()) normalBounds = window.getContentBounds();
  };
  window.on("resize", rememberBounds);
  window.on("move", rememberBounds);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => { if (!isTrustedRendererUrl(url, devUrl)) event.preventDefault(); });
  window.webContents.on("will-attach-webview", event => event.preventDefault());
  let startupTimer: NodeJS.Timeout | undefined;
  clearStartupTimer = () => { clearTimeout(startupTimer); };
  let restartingRenderer = false;
  const recovery = new RecoveryController({
    prompt: async reason => {
      clearStartupTimer();
      if (window.isDestroyed()) return 3;
      window.show();
      const waiting = reason === "unresponsive";
      const options: Electron.MessageBoxOptions = {
        type: "warning", title: "恢复应用", message: waiting ? "界面暂时没有响应" : "界面未能正常显示",
        detail: "重新加载不会清除本地设置，未保存的页面内容可能丢失。也可以导出诊断后退出。",
        buttons: ["重新加载", "导出诊断", "退出", ...(waiting ? ["继续等待"] : [])], defaultId: waiting ? 3 : 0, cancelId: waiting ? 3 : 2,
      };
      return (await dialog.showMessageBox(window, options)).response;
    },
    reload: reason => {
      if (window.isDestroyed()) return;
      if (reason === "unresponsive") { restartingRenderer = true; window.webContents.forcefullyCrashRenderer(); }
      window.webContents.reload();
    },
    export: exportFromRecovery,
    quit: () => app.quit(),
  });
  window.webContents.on("did-start-loading", () => {
    clearStartupTimer();
    startupTimer = setTimeout(() => { diagnostics.event("renderer.ready_timeout"); void recovery.run("timeout"); }, 20000);
  });
  window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (code !== -3 && isMainFrame) { diagnostics.event("renderer.load_failed", code); void recovery.run("load"); }
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    clearStartupTimer();
    if (restartingRenderer) { restartingRenderer = false; return; }
    if (details.reason !== "clean-exit") { diagnostics.event("renderer.gone", `${details.reason} / ${details.exitCode}`); void recovery.run("crashed"); }
  });
  window.on("unresponsive", () => { diagnostics.event("renderer.unresponsive"); void recovery.run("unresponsive"); });
  window.once("ready-to-show", () => {
    window.setContentBounds(normalBounds);
    rememberBounds();
    if (saved?.maximized) window.maximize();
    window.show();
  });
  saveCurrentWindow = async () => {
    if (window.isDestroyed()) return;
    rememberBounds();
    await settings.saveWindow({ ...normalBounds, maximized: window.isMaximized() });
  };
  let closing = false, savingClose = false;
  window.on("close", event => {
    if (closing) return;
    // The installer is already running and waiting for this process to exit.
    // Geometry was persisted before launch; don't risk cancelling quit on a second write.
    if (quitting && windowStateSavedForUpdate) { closing = true; return; }
    event.preventDefault();
    if (savingClose) return;
    savingClose = true;
    void saveCurrentWindow().then(() => {
      if (!quitting && tray && !tray.isDestroyed()) { window.hide(); return; }
      closing = true; window.close();
    }).catch(async error => {
      diagnostics.event("settings.window_save_failed", error);
      const result = await dialog.showMessageBox(window, { type: "error", title: "无法保存窗口状态", message: "本次窗口状态未能保存。", detail: String(error), buttons: ["返回应用", "仍然退出"], defaultId: 0, cancelId: 0 });
      if (result.response === 1) { closing = true; window.close(); }
      else { quitting = false; window.show(); }
    }).finally(() => { savingClose = false; });
  });
  window.on("closed", () => { clearStartupTimer(); mainWindow = null; });
  void window.loadURL(devUrl ?? "app://desktop/").catch(error => diagnostics.event("renderer.load_failed", error));
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", showWindow);
  app.whenReady().then(async () => {
    diagnostics.event("session.started", `v${app.getVersion()} / ${process.platform} / ${process.arch} / packaged=${app.isPackaged}`);
    settings = new SettingsStore(app.getPath("userData"));
    await settings.load();
    if (settings.warning) diagnostics.event("settings.recovered");
    nativeTheme.themeSource = settings.preferences.themeMode;
    if (settings.preferences.trayEnabled) {
      try { tray = makeTray(); }
      catch (error) { diagnostics.event("tray.failed", error); await settings.update({ trayEnabled: false }); settings.warning = "托盘不可用，已关闭后台驻留。"; }
    }
    initializeUpdates();
    protocol.handle("app", serveAsset);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on("will-download", event => event.preventDefault());
    registerIPC(); createMenu(); createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { void fatal(error); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
