import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (file, args) => spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
if (run(fileURLToPath(new URL('./themes.mjs', import.meta.url)), []).status !== 0 || run(require.resolve('typescript/bin/tsc'), ['-p', 'tsconfig.desktop.json']).status !== 0) process.exit(1);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill();
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3014'], { cwd: root, stdio: 'inherit', windowsHide: true });
children.push(server);
server.on('error', error => { console.error(error); stop(1); });
server.on('exit', code => { if (!stopping) stop(code ?? 1); });
try {
  const deadline = Date.now() + 60000;
  while (!stopping) {
    try { const response = await fetch('http://127.0.0.1:3014', { signal: AbortSignal.timeout(1500) }); if (response.ok) break; }
    catch { /* The owned development server is still starting. */ }
    if (Date.now() > deadline) throw new Error('界面服务未能启动');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!stopping) {
    const env = { ...process.env, ELECTRON_RENDERER_URL: 'http://127.0.0.1:3014' };
    delete env.ELECTRON_RUN_AS_NODE;
    const desktop = spawn(require('electron'), ['.'], { cwd: root, env, stdio: 'inherit' });
    children.push(desktop);
    desktop.on('error', error => { console.error(error); stop(1); });
    desktop.on('exit', code => stop(code ?? 0));
  }
} catch (error) { console.error(error); stop(1); }
