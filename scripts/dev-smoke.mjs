import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { connect } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('This lifecycle smoke test currently targets Windows.');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const profile = await mkdtemp(path.join(os.tmpdir(), 'desktop-starter-dev-'));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function listening() { return new Promise(resolve => { const socket = connect({ host: '127.0.0.1', port: 3014 }); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); }); }
async function until(check, timeout = 60000) { const deadline = Date.now() + timeout; while (!await check()) { if (Date.now() > deadline) throw new Error('Lifecycle condition timed out'); await delay(250); } }
if (await listening()) throw new Error('Port 3014 is already in use; leave the existing service untouched.');
let dev;
let logs = '';
try {
  for (let iteration = 0; iteration < 2; iteration++) {
    dev = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: root, env: { ...process.env, DESKTOP_STARTER_PROFILE: profile }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    dev.stdout.on('data', data => { logs += data; }); dev.stderr.on('data', data => { logs += data; });
    let desktopPid;
    await until(async () => {
      if (dev.exitCode !== null) throw new Error(`Development process exited: ${logs}`);
      const value = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${dev.pid} AND Name='electron.exe'" | Select-Object -ExpandProperty ProcessId`], { encoding: 'utf8', windowsHide: true }).trim();
      if (value) desktopPid = Number(value);
      return desktopPid && await listening();
    });
    await until(() => execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${desktopPid}).MainWindowHandle -ne 0`], { encoding: 'utf8', windowsHide: true }).trim() === 'True', 15000);
    const exited = once(dev, 'exit');
    const closed = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${desktopPid}).CloseMainWindow()`], { encoding: 'utf8', windowsHide: true }).trim();
    if (closed !== 'True') throw new Error('Could not close the owned development window');
    const [code] = await Promise.race([exited, delay(20000).then(() => { throw new Error('Development process did not stop'); })]);
    if (code !== 0) throw new Error(`Development shutdown failed: ${logs}`);
    dev = null;
    await until(async () => !await listening(), 10000);
    console.log(`Development cycle ${iteration + 1}: window closed, process exited, port 3014 released.`);
  }
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts/dev-smoke.json'), JSON.stringify({ status: 'passed', cycles: 2, portReleased: true, profile }, null, 2));
} catch (error) { console.error(logs); throw error; }
finally {
  if (dev?.pid && dev.exitCode === null) spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}
