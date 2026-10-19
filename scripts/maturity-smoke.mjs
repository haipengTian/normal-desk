import { _electron as electron, expect } from 'playwright/test';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));const profile=await mkdtemp(path.join(os.tmpdir(),'desktop-maturity-'));
const env={...process.env,DESKTOP_STARTER_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
const executablePath=process.env.DESKTOP_TEST_EXECUTABLE;const artifacts=path.join(root,'artifacts');await mkdir(artifacts,{recursive:true});
const app=await electron.launch({...executablePath?{executablePath,args:[]}:{args:[root]},env});
try{
 const page=await app.firstWindow();await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready','true');
 const normalViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'快捷操作'})).toBeVisible();
 await page.keyboard.press('ArrowDown');await expect(page.getByRole('option',{name:'打开交互组件'})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowUp');await expect(page.getByRole('option',{name:'打开概览'})).toHaveAttribute('aria-selected','true');
 await page.getByPlaceholder('搜索页面或操作…').fill('设置');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'让界面适合你'})).toBeVisible();
 const target=path.join(profile,'preferences.json');await app.evaluate(({dialog},target)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:target});},target);
 await page.getByRole('button',{name:'深色',exact:true}).click();await page.getByRole('button',{name:'导出设置',exact:true}).click();
 await expect(page.getByText('设置已导出',{exact:true})).toBeVisible();const backup=JSON.parse(await readFile(target,'utf8'));expect(backup.preferences.themeMode).toBe('dark');expect(backup.preferences.trayEnabled).toBeUndefined();
 await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});
 await page.getByRole('button',{name:'恢复默认',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.desktop.getPreferences())).toMatchObject({themeMode:'system',trayEnabled:false});
 await app.evaluate(({dialog},target)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});},target);
 await page.getByRole('button',{name:'导入设置',exact:true}).click();await expect(page.locator('html')).toHaveClass(/dark/);
 const before=await page.evaluate(()=>window.desktop.getPreferences());await writeFile(target,'{"format":"wrong"}');await expect(page.evaluate(()=>window.desktop.importPreferences())).rejects.toThrow();expect(await page.evaluate(()=>window.desktop.getPreferences())).toEqual(before);
 await writeFile(target,'x'.repeat(65537));await expect(page.evaluate(()=>window.desktop.importPreferences())).rejects.toThrow();
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});dialog.showSaveDialog=async()=>({canceled:true});dialog.showMessageBox=async()=>({response:1});});
 expect(await page.evaluate(()=>window.desktop.importPreferences())).toBeNull();expect(await page.evaluate(()=>window.desktop.exportPreferences())).toBe(false);expect(await page.evaluate(()=>window.desktop.resetPreferences())).toBeNull();
 await page.getByRole('switch',{name:'关闭窗口后留在托盘'}).click();await expect.poll(()=>page.evaluate(()=>window.desktop.getPreferences())).toMatchObject({trayEnabled:true});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
 await app.evaluate(({app})=>app.emit('second-instance'));await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
 await page.getByRole('switch',{name:'关闭窗口后留在托盘'}).click();await expect.poll(()=>page.evaluate(()=>window.desktop.getPreferences())).toMatchObject({trayEnabled:false});
 await expect(page.getByRole('switch',{name:'关闭窗口后留在托盘'})).toHaveAttribute('data-state','unchecked');
 await expect(page.locator('.page-enter')).toHaveCSS('opacity','1');await page.screenshot({path:path.join(artifacts,'maturity-settings.png')});
 if(executablePath){
   await app.evaluate(({app})=>{globalThis.loginWrites=[];globalThis.loginEnabled=false;app.getLoginItemSettings=()=>({openAtLogin:globalThis.loginEnabled,executableWillLaunchAtLogin:globalThis.loginEnabled});app.setLoginItemSettings=options=>{globalThis.loginWrites.push(options);globalThis.loginEnabled=options.openAtLogin;};});
   await page.getByRole('button',{name:'概览',exact:true}).click();await page.getByRole('button',{name:'设置',exact:true}).click();
   await page.getByRole('switch',{name:'登录系统时启动'}).click();await expect.poll(()=>app.evaluate(()=>globalThis.loginWrites.length)).toBe(1);
   await page.getByRole('switch',{name:'登录系统时启动'}).click();await expect.poll(()=>app.evaluate(()=>globalThis.loginWrites.length)).toBe(2);
   await expect(page.evaluate(()=>window.desktop.setLoginEnabled({enabled:true}))).rejects.toThrow();
 }
 await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'快捷操作'})).toBeVisible();await page.getByPlaceholder('搜索页面或操作…').fill('找不到的操作');await expect(page.getByText('没有匹配的操作',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'快捷操作'})).toHaveCSS('opacity','1');
 await page.setViewportSize({width:900,height:620});await page.keyboard.press('ArrowUp');await expect(page.getByRole('option',{name:'导出诊断'})).toBeInViewport();
 await page.setViewportSize(normalViewport);await page.keyboard.press('ArrowDown');await page.screenshot({path:path.join(artifacts,'command-palette.png')});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'关于',exact:true}).click();await expect(page.getByRole('heading',{name:'应用更新'})).toBeVisible();
 if(!executablePath){expect((await page.evaluate(()=>window.desktop.getUpdateState())).phase).toBe('unsupported');}
 await expect(page.locator('.page-enter')).toHaveCSS('opacity','1');await expect(page.getByRole('heading',{name:'应用更新'})).toBeInViewport();
 await page.screenshot({path:path.join(artifacts,'update-panel.png')});
 if(executablePath){
   // Keep real production controller, main IPC and confirmation; substitute only the updater library boundary.
   await app.evaluate(({app})=>{
     const bootstrap=process.mainModule.require.bind(process.mainModule);
     const req=bootstrap('node:module').createRequire(bootstrap('node:path').join(app.getAppPath(),'desktop-dist/desktop/main.js'));
     const {SafeNsisUpdater}=req('./native-updater.js');const {NsisUpdater}=req('electron-updater');
     NsisUpdater.prototype.checkForUpdates=async function(){globalThis.fixtureUpdater=this;this.emit('update-available',{version:'0.4.0'});};
     NsisUpdater.prototype.downloadUpdate=async function(){this.emit('download-progress',{percent:42});await new Promise(resolve=>{globalThis.finishDownload=()=>{this.emit('update-downloaded',{version:'0.4.0'});resolve([]);};});};
     globalThis.installAttempts=0;SafeNsisUpdater.prototype.quitAndInstall=async function(){globalThis.installAttempts++;throw Error('OS launch refused');};
   });
   await page.getByRole('button',{name:'检查更新',exact:true}).click();await expect(page.getByText('发现新版本 v0.4.0，准备好时再下载。',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'下载更新',exact:true}).click();await expect(page.getByRole('progressbar',{name:'更新下载进度'})).toHaveAttribute('aria-valuenow','42');
   await page.screenshot({path:path.join(artifacts,'update-progress.png')});await app.evaluate(()=>globalThis.finishDownload());
   await expect(page.getByRole('button',{name:'重启并安装',exact:true})).toBeEnabled();
   await page.getByRole('button',{name:'重启并安装',exact:true}).click();expect(await app.evaluate(()=>globalThis.installAttempts)).toBe(0);
   await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});
   await page.getByRole('button',{name:'重启并安装',exact:true}).click();await expect(page.getByRole('button',{name:'重试安装',exact:true})).toBeVisible();
   expect(await app.evaluate(()=>globalThis.installAttempts)).toBe(1);await page.getByRole('button',{name:'重试安装',exact:true}).click();await expect.poll(()=>app.evaluate(()=>globalThis.installAttempts)).toBe(2);
   // Main's explicit install persists geometry, and neither cancelled nor failed launch exits.
   expect(JSON.parse(await readFile(path.join(profile,'settings.json'),'utf8')).window.width).toBeGreaterThan(0);
   await page.screenshot({path:path.join(artifacts,'update-retry.png')});
 }
 const result={status:'passed',packaged:!!executablePath,profile,checks:['palette keyboard / search / no match / escape','backup export / import / reset / cancellation / malformed / oversized','tray close / second instance show / disable',...(executablePath?['login OS boundary only','update library boundary: available / progress / cancelled install / async failed install retry']:[]),'updates panel']};await writeFile(path.join(artifacts,executablePath?'packaged-maturity.json':'maturity.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
