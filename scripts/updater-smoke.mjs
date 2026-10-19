import { _electron as electron, expect } from 'playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A bounded loopback feed tests the real NSIS downloader, never runs an installer,
// and adds no alternate feed, switch or back door to the production application.
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const profile = await mkdtemp(path.join(os.tmpdir(), 'desktop-update-fixture-'));
const payload = Buffer.alloc(256 * 1024, 0x41);
const checksum = createHash('sha512').update(payload).digest('base64');
let corrupt = true, downloads = 0;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/latest.yml') {
    res.writeHead(200, { 'Content-Type': 'text/yaml' });
    res.end(`version: 0.4.0\nfiles:\n  - url: Fixture-Setup.exe\n    sha512: ${checksum}\n    size: ${payload.length}\npath: Fixture-Setup.exe\nsha512: ${checksum}\nreleaseDate: '2026-10-19T00:00:00.000Z'\n`);
  } else if (url.pathname === '/Fixture-Setup.exe') {
    downloads++;
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': payload.length });
    res.end(corrupt ? Buffer.alloc(payload.length, 0x42) : payload);
  } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const configPath = path.join(profile, 'fixture-update.yml');
await writeFile(configPath, `provider: generic\nurl: ${url}\nupdaterCacheDirName: fixture-cache\n`);
const env = { ...process.env, DESKTOP_STARTER_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
let application;
try {
  application = await electron.launch({ args: [root], env });
  const page = await application.firstWindow();
  await expect(page.getByTestId('desktop-shell')).toHaveAttribute('data-ready', 'true');
  await application.evaluate(({ app }, { profile, configPath, url }) => {
    const bootstrap = process.mainModule.require.bind(process.mainModule);
    const req = bootstrap('node:module').createRequire(bootstrap('node:path').join(app.getAppPath(), 'desktop-dist/desktop/main.js'));
    const { SafeNsisUpdater } = req('./native-updater.js');
    const { UpdateController } = req('./updates.js');
    const { ElectronHttpExecutor } = req('electron-updater/out/electronHttpExecutor');
    const adapter = { name: 'fixture', version: '0.3.0', isPackaged: true, appUpdateConfigPath: configPath, userDataPath: profile, baseCachePath: profile, whenReady: () => app.whenReady(), onQuit() {}, quit() { throw Error('Fixture must never launch or quit for installation'); }, relaunch() {} };
    const updater = new SafeNsisUpdater(undefined, adapter);
    updater.logger = null;
    updater.httpExecutor = new ElectronHttpExecutor(() => {});
    updater.disableDifferentialDownload = true;
    updater.setFeedURL({ provider: 'generic', url });
    globalThis.fixtureErrors = [];
    globalThis.fixtureStates = [];
    globalThis.fixture = new UpdateController(updater, state => globalThis.fixtureStates.push(state), 'idle', (_code, error) => globalThis.fixtureErrors.push(String(error)));
  }, { profile, configPath, url });
  await application.evaluate(() => globalThis.fixture.check());
  expect(await application.evaluate(() => globalThis.fixture.snapshot)).toMatchObject({ phase: 'available', version: '0.4.0' });
  expect(downloads).toBe(0);
  await application.evaluate(() => globalThis.fixture.download());
  expect(await application.evaluate(() => globalThis.fixture.snapshot)).toMatchObject({ phase: 'error', retry: 'download' });
  expect(await application.evaluate(() => globalThis.fixtureErrors.join('\n'))).toMatch(/checksum mismatch/i);
  corrupt = false;
  await application.evaluate(() => globalThis.fixture.download());
  expect(await application.evaluate(() => globalThis.fixture.snapshot)).toMatchObject({ phase: 'downloaded', percent: 100 });
  expect(downloads).toBe(2);
  expect(await application.evaluate(() => globalThis.fixtureStates.some(state => state.phase === 'downloading' && state.percent > 0))).toBe(true);
  const result = { status: 'passed', library: 'electron-updater 6.8.9 / real Electron network', profile, checks: ['metadata version discovery', 'no automatic download', 'corrupted payload rejected by SHA-512', 'full download retry succeeds', 'progress and verified downloaded events'], installation: 'not executed; fixture is non-executable data' };
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts/updater-fixture.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (application) await application.close();
  await new Promise(resolve => server.close(resolve));
}
