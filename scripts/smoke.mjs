import { _electron as electron, expect } from 'playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const profile = await mkdtemp(path.join(os.tmpdir(), 'desktop-starter-e2e-'));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const executablePath = process.env.DESKTOP_TEST_EXECUTABLE;
const env = { ...process.env, DESKTOP_STARTER_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
let app;
const errors = [];
async function launch() {
  app = await electron.launch({ ...(executablePath ? { executablePath, args: [] } : { args: [root] }), env, timeout: 45000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: /你的下一个应用，\s*从这里开始。/ }).waitFor();
  await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready', 'true');
  return page;
}
async function captureWindow(filename, checkCaption = false) {
  const data = await app.evaluate(async ({ BrowserWindow, desktopCapturer }, checkCaption) => {
    const window = BrowserWindow.getAllWindows()[0];
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1800, height: 1400 } });
    const source = sources.find(item => item.id === window.getMediaSourceId());
    if (!source || source.thumbnail.isEmpty()) throw new Error('Cannot capture the complete desktop window');
    if (checkCaption) {
      const { width } = source.thumbnail.getSize();
      const bitmap = source.thumbnail.toBitmap();
      const sample = x => [...bitmap.subarray((5 * width + x) * 4, (5 * width + x) * 4 + 3)];
      const caption = sample(width - 15), header = sample(Math.floor(width * 0.8));
      if (caption.some((channel, i) => Math.abs(channel - header[i]) > 3)) throw new Error(`Native caption color differs from header: ${caption} / ${header}`);
    }
    return source.thumbnail.toPNG().toString('base64');
  }, checkCaption);
  await writeFile(path.join(artifacts, filename), Buffer.from(data, 'base64'));
}
try {
  let page = await launch();
  const info = await page.evaluate(() => window.desktop.getInfo());
  if (executablePath && !info.packaged) throw new Error('Expected a packaged application');
  // Hold only the info IPC at the native boundary; no production startup delay.
  await app.evaluate(({ ipcMain }, info) => {
    ipcMain.removeHandler('desktop:info');
    ipcMain.handle('desktop:info', () => new Promise(resolve => { globalThis.releaseStartup = () => resolve(info); }));
  }, info);
  await page.reload();
  await expect(page.getByTestId('startup-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: '探索组件' })).not.toBeVisible();
  await expect(page.getByTestId('startup-screen')).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('startup-logo')).toHaveCSS('animation-name', 'startup-breathe');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('startup-logo')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await captureWindow('window-startup.png');
  await app.evaluate(() => globalThis.releaseStartup());
  await expect(page.getByTestId('startup-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '探索组件' })).toBeVisible();
  await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('desktop:info'); ipcMain.handle('desktop:info', () => { throw new Error('Injected startup failure'); }); });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: '无法连接桌面服务' })).toBeVisible();
  await expect(page.getByTestId('startup-screen')).toHaveCount(0);
  await app.evaluate(({ ipcMain }, info) => { ipcMain.removeHandler('desktop:info'); ipcMain.handle('desktop:info', () => info); }, info);
  await page.getByRole('button', { name: '重试连接' }).click();
  await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready', 'true');
  await expect(page).toHaveTitle('Desktop Starter');
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  if (!bodyFont.includes('Inter')) throw new Error(`Expected bundled Credit font, got ${bodyFont}`);
  await expect(page.getByText('本地运行', { exact: true })).toHaveCount(0);
  await expect(page.getByText('桌面连接正常', { exact: true })).toHaveCount(0);
  await expect(page.getByText('v0.1.0', { exact: true })).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.getByTestId('titlebar')).toHaveCSS('border-bottom-width', '0px');
  await expect(page.getByTestId('sidebar')).toHaveCSS('border-right-width', '0px');
  const overlay = await page.evaluate(() => {
    const controls = navigator.windowControlsOverlay;
    const rect = controls.getTitlebarAreaRect();
    const toggle = document.querySelector('[aria-label="切换到深色"]').getBoundingClientRect();
    return { visible: controls.visible, availableRight: rect.right, toggleRight: toggle.right, drag: getComputedStyle(document.querySelector('header')).webkitAppRegion };
  });
  if (!overlay.visible || overlay.toggleRight > overlay.availableRight || overlay.drag !== 'drag') throw new Error(`Title bar layout failed: ${JSON.stringify(overlay)}`);
  await page.screenshot({ path: path.join(artifacts, 'overview.png') });
  await captureWindow('window-light.png');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await page.getByRole('button', { name: 'Default', exact: true }).click();
  if (await page.evaluate(() => document.documentElement.style.getPropertyValue('--spacing'))) throw new Error('Previous color theme variables leaked into Default');
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await page.getByRole('switch', { name: '减少动态效果' }).click();
  await page.screenshot({ path: path.join(artifacts, 'settings-dark.png') });
  await captureWindow('window-dark.png');
  await page.getByRole('button', { name: '交互组件', exact: true }).click();
  await page.getByRole('button', { name: '打开示例弹窗' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '显示通知' }).click();
  await expect(page.getByText('通知已就绪')).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, 'components.png') });
  // Native dialog result is injected at the OS boundary; the real IPC/preload path is exercised.
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Example'] }); });
  await page.getByRole('button', { name: '选择目录', exact: true }).click();
  await expect(page.getByTestId('directory-result')).toHaveText('C:\\Example');
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await page.getByRole('button', { name: '选择目录', exact: true }).click();
  await expect(page.getByTestId('directory-result')).toHaveText('C:\\Example');
  const isolation = await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process, methods: Object.keys(window.desktop) }));
  if (isolation.require !== 'undefined' || isolation.process !== 'undefined' || isolation.methods.includes('send')) throw new Error('Renderer isolation failed');
  await page.evaluate(async () => {
    for (const run of [() => window.desktop.setPreferences({ themeMode: 'invalid' }), () => window.desktop.openDocumentation('file:///C:/secret'), () => window.desktop.setTitleBarColors({ background: 'transparent', foreground: '#ffffff' })]) {
      let rejected = false; try { await run(); } catch { rejected = true; }
      if (!rejected) throw new Error('Invalid IPC parameters accepted');
    }
  });
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].minimize(); });
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.restore(); window.focus(); });
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(false);
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setSize(1040, 740); });
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
  await captureWindow('window-compact.png');
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].maximize(); });
  // Close through the actual window close handler so state is saved before exit.
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
  await app.waitForEvent('close'); app = null;
  const saved = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
  if (!saved.window.maximized) throw new Error('Maximized window state was not saved');
  page = await launch();
  const prefs = await page.evaluate(() => window.desktop.getPreferences());
  if (prefs.themeMode !== 'dark' || prefs.colorTheme !== 'claude.css' || !prefs.reducedMotion || !prefs.sidebarCollapsed) throw new Error('Preferences did not survive restart');
  await app.evaluate(({ ipcMain }, info) => {
    ipcMain.removeHandler('desktop:info');
    ipcMain.handle('desktop:info', () => new Promise(resolve => { globalThis.releaseStartup = () => resolve(info); }));
  }, info);
  await page.reload();
  await expect(page.getByTestId('startup-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('startup-logo')).toHaveCSS('animation-name', 'none');
  await captureWindow('window-startup-dark.png');
  await app.evaluate(() => globalThis.releaseStartup());
  await expect(page.getByTestId('startup-screen')).toHaveCount(0);
  await app.evaluate(({ ipcMain }, info) => { ipcMain.removeHandler('desktop:info'); ipcMain.handle('desktop:info', () => info); }, info);
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
  await expect(async () => captureWindow('window-maximized.png', true)).toPass({ timeout: 5000, intervals: [100, 250] });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) => {
    const { width, height } = BrowserWindow.getAllWindows()[0].getContentBounds();
    return { width, height };
  })).toEqual({ width: 1040, height: 740 });
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await page.getByRole('button', { name: '关于', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Desktop Starter', exact: true })).toBeVisible();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow at minimum window size');
  await page.screenshot({ path: path.join(artifacts, 'about-compact.png') });
  // A second restart must keep the same dimensions, including at fractional DPI.
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
  await app.waitForEvent('close'); app = null;
  page = await launch();
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) => {
    const { width, height } = BrowserWindow.getAllWindows()[0].getContentBounds();
    return { width, height };
  })).toEqual({ width: 1040, height: 740 });
  if (errors.length) throw new Error(errors.join('\n'));
  const result = { status: 'passed', packaged: info.packaged, electron: info.electron, profile, assertions: ['startup screen / ready handoff / failure retry', 'startup theme + system/saved reduced motion', 'navigation', 'light/dark/color themes', 'integrated native title bar + control space', 'minimal shell copy', 'reduced motion', 'dialog/escape/toast', 'directory selection/cancel IPC', 'invalid IPC rejected', 'renderer isolation', 'persistent preferences', 'window minimize/restore/size/maximize/close', 'compact layout'], rendererErrors: errors };
  await writeFile(path.join(artifacts, executablePath ? 'packaged-smoke.json' : 'smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { if (app) await app.close(); }
