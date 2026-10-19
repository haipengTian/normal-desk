import { _electron as electron, expect } from 'playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const profile=await mkdtemp(path.join(os.tmpdir(),'desktop-stability-'));
const artifacts=path.join(root,'artifacts'); await mkdir(artifacts,{recursive:true});
const env={...process.env,DESKTOP_STARTER_PROFILE:profile}; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
const executablePath=process.env.DESKTOP_TEST_EXECUTABLE;
const app=await electron.launch({...executablePath?{executablePath,args:[]}:{args:[root]},env,timeout:45000});
try {
 const page=await app.firstWindow();
 await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:'关于',exact:true}).click();
 await expect(page.getByRole('button',{name:'导出诊断',exact:true})).toBeVisible();
 const target=path.join(profile,'diagnostic.json');
 await app.evaluate(({dialog},target)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:target});},target);
 await page.getByRole('button',{name:'导出诊断',exact:true}).click();
 await expect(page.getByText('诊断文件已导出',{exact:true})).toBeVisible();
 const report=JSON.parse(await readFile(target,'utf8'));
 if(report.application.version!==(await page.evaluate(()=>window.desktop.getInfo())).version||report.application.dataPath||!report.logs.includes('session.started'))throw Error('Invalid diagnostics export');
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
 expect(await page.evaluate(()=>window.desktop.exportDiagnostics())).toBe(false);
 await app.evaluate(({dialog},target)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:target+'/missing/file'});},target);
 await expect(page.evaluate(()=>window.desktop.exportDiagnostics())).rejects.toThrow();
 await page.evaluate(async()=>{
   await window.desktop.reportIncident({kind:'error'});
   await window.desktop.reportIncident({kind:'unhandledrejection'});
 });
 await expect(page.evaluate(()=>window.desktop.reportIncident({kind:'error',message:'secret'}))).rejects.toThrow();
 await expect(page.locator('.page-enter')).toHaveCSS('opacity','1');
 await page.screenshot({path:path.join(artifacts,'diagnostics-about.png')});
 // Force a real React render failure through an invalid info result.
 const info=await page.evaluate(()=>window.desktop.getInfo());
 await app.evaluate(({ipcMain},info)=>{ipcMain.removeHandler('desktop:info');ipcMain.handle('desktop:info',()=>({...info,version:{invalid:true}}));},info);
 await page.reload(); await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:'关于',exact:true}).click();
 await expect(page.getByRole('heading',{name:'界面暂时出了点问题'})).toBeVisible();
 await page.screenshot({path:path.join(artifacts,'recovery-fallback.png')});
 await app.evaluate(({ipcMain},info)=>{ipcMain.removeHandler('desktop:info');ipcMain.handle('desktop:info',()=>info);},info);
 await page.getByRole('button',{name:'重新加载',exact:true}).click();
 await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready','true');
 // Render failure before initialization finishes must cancel the white-screen watchdog.
 const preferences=await page.evaluate(()=>window.desktop.getPreferences());
 await app.evaluate(({dialog,ipcMain})=>{
   globalThis.earlyDialogs=[];dialog.showMessageBox=async(...args)=>{globalThis.earlyDialogs.push(args.at(-1));return {response:3};};
   ipcMain.removeHandler('desktop:preferences:get');ipcMain.handle('desktop:preferences:get',()=>null);
   ipcMain.removeHandler('desktop:info');ipcMain.handle('desktop:info',()=>new Promise(()=>{}));
 });
 await page.reload();await expect(page.getByRole('heading',{name:'界面暂时出了点问题'})).toBeVisible();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
 // The watchdog is 20s; this is an intentional check of the absence of a second prompt.
 await new Promise(resolve=>setTimeout(resolve,21000));
 expect(await app.evaluate(()=>globalThis.earlyDialogs.length)).toBe(0);
 await app.evaluate(({ipcMain},{info,preferences})=>{
   ipcMain.removeHandler('desktop:preferences:get');ipcMain.handle('desktop:preferences:get',()=>preferences);
   ipcMain.removeHandler('desktop:info');ipcMain.handle('desktop:info',()=>info);
 },{info,preferences});
 await page.getByRole('button',{name:'重新加载',exact:true}).click();
 await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready','true');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
 // Gate the real native recovery dialog and crash the actual renderer process.
 await app.evaluate(({dialog})=>{
   globalThis.prompts=[];
   dialog.showMessageBox=async(...args)=>{globalThis.prompts.push(args.at(-1));return new Promise(resolve=>{globalThis.chooseRecovery=response=>resolve({response});});};
 });
 const crashed=page.waitForEvent('crash');
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer();});
 await crashed;
 await expect.poll(()=>app.evaluate(()=>globalThis.prompts.length)).toBe(1);
 const loaded=page.waitForEvent('domcontentloaded'); await app.evaluate(()=>globalThis.chooseRecovery(0)); await loaded;
 await expect.poll(() => app.evaluate(async ({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelector('[data-testid=desktop-shell]')?.dataset.ready")),{timeout:15000}).toBe('true');
 // Unresponsive -> wait. No reload or repeat dialog.
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].emit('unresponsive');});
 await expect.poll(()=>app.evaluate(()=>globalThis.prompts.length)).toBe(2);
 await app.evaluate(()=>globalThis.chooseRecovery(3));
 // Main frame load failure uses the same native recovery path.
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.emit('did-fail-load',{},-105,'test failure','app://desktop/',true);});
 await expect.poll(()=>app.evaluate(()=>globalThis.prompts.length)).toBe(3);
 await app.evaluate(({BrowserWindow})=>{globalThis.reloaded=false;BrowserWindow.getAllWindows()[0].webContents.once('did-finish-load',()=>{globalThis.reloaded=true;});globalThis.chooseRecovery(0);});
 await expect.poll(()=>app.evaluate(()=>globalThis.reloaded)).toBe(true);
 await expect.poll(() => app.evaluate(async ({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelector('[data-testid=desktop-shell]')?.dataset.ready"))).toBe('true');
 const logs=await readFile(path.join(profile,'logs/main.log'),'utf8');
 for(const code of ['session.started','renderer.gone','renderer.unresponsive','renderer.load_failed','renderer.incident','diagnostics.export_failed'])if(!logs.includes(code))throw Error('Missing log '+code);
 const result={status:'passed',packaged:!!executablePath,profile,checks:['export / cancel / IO error','category-only renderer reports','actual renderer crash + user reload','unresponsive wait','load failure recovery','React error fallback + reload','early error cancels 20s watchdog','fatal main-process exit']};
 await app.evaluate(()=>{process.emit('uncaughtException',new Error('token=sensitive-test'));});
 await expect.poll(()=>app.evaluate(()=>globalThis.prompts.length)).toBe(4);
 const fatalDialog=await app.evaluate(()=>globalThis.prompts.at(-1));expect(fatalDialog.buttons).toContain('重新启动');
 const closed=app.waitForEvent('close');await app.evaluate(()=>globalThis.chooseRecovery(2)).catch(()=>{});await closed;
 const finalLogs=await readFile(path.join(profile,'logs/main.log'),'utf8');if(finalLogs.includes('sensitive-test')||!finalLogs.includes('process.fatal'))throw Error('Fatal log filtering failed');
 await writeFile(path.join(artifacts,executablePath?'packaged-stability.json':'stability.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await app.close().catch(()=>{});}
