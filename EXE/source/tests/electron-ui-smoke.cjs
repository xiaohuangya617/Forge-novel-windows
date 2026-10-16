const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const exePath = path.join(root, 'dist', 'AI小说生成器9.0-IDB独立版', 'AI小说生成器9.0-IDB独立版.exe');
const dataDir = path.join(__dirname, `_electron-ui-data-${process.pid}-${Date.now()}`);
const outDir = path.join(__dirname, '_tmp', 'ui');
const port = Number(process.env.NOVEL_ELECTRON_UI_CDP_PORT || 9341);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitCdp() {
  const end = Date.now() + 30000;
  while(Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if(r.ok) return; } catch(_) {}
    await sleep(250);
  }
  throw new Error('Electron CDP 未就绪');
}

(async () => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const child = spawn(exePath, [`--remote-debugging-port=${port}`], { cwd: path.dirname(exePath), env: { ...process.env, AI_NOVEL_E2E_DATA_DIR: dataDir }, stdio: 'ignore', windowsHide: true });
  await waitCdp();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages().find(p => /index\.html/i.test(p.url()));
  assert.ok(page, '主页面未出现');
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.stack || e)));
  await page.waitForFunction(() => (document.getElementById('storageIndicator')?.textContent || '').includes('IndexedDB'));
  await page.screenshot({ path: path.join(outDir, 'main.png'), fullPage: true });

  await page.locator('#newBookIcon').click();
  await page.waitForFunction(() => document.getElementById('promptModal')?.style.display === 'flex');
  const promptStyle = await page.locator('#promptModal .modal-card').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
  assert.notEqual(promptStyle.background, 'rgb(255, 255, 255)');
  await page.screenshot({ path: path.join(outDir, 'prompt.png'), fullPage: true });
  await page.locator('#promptCancel').click();

  await page.locator('#resetAllBtn').click();
  await page.waitForFunction(() => document.getElementById('confirmModal')?.style.display === 'flex');
  const confirmStyle = await page.locator('#confirmModal .modal-card').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
  assert.notEqual(confirmStyle.background, 'rgb(255, 255, 255)');
  await page.screenshot({ path: path.join(outDir, 'confirm.png'), fullPage: true });
  await page.locator('#confirmCancel').click();

  await page.locator('#apiBtnSidebar').click();
  await page.waitForFunction(() => document.getElementById('apiModal')?.style.display === 'flex');
  const modalBg = await page.locator('#apiModal .modal-card').evaluate(el => getComputedStyle(el).backgroundColor);
  assert.notEqual(modalBg, 'rgb(255, 255, 255)');
  await page.locator('#closeApiBtn').click();
  assert.deepEqual(await page.evaluate(() => ({ prompt: document.getElementById('promptModal').style.display, confirm: document.getElementById('confirmModal').style.display })), { prompt: 'none', confirm: 'none' });
  const second = spawn(exePath, [], { cwd: path.dirname(exePath), env: { ...process.env, AI_NOVEL_E2E_DATA_DIR: dataDir }, stdio: 'ignore', windowsHide: true });
  await page.waitForFunction(() => document.getElementById('secondInstanceModal')?.style.display === 'flex', { timeout: 10000 });
  assert.equal(await page.locator('#secondInstanceModal .dialog-message').textContent(), '程序已在运行，已切换到现有窗口。');
  if(!second.killed) second.kill();
  await page.locator('#secondInstanceOk').click();
  await browser.close();
  if(!child.killed) child.kill();
  await sleep(1200);
  fs.rmSync(dataDir, { recursive: true, force: true });
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  console.log(JSON.stringify({ ok: true, checked: ['main dark theme', 'custom prompt', 'custom confirm', 'second-instance modal', 'API modal'], screenshots: outDir }, null, 2));
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
