const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const exePath = path.join(projectRoot, 'dist', 'AI小说生成器9.0-IDB独立版', 'AI小说生成器9.0-IDB独立版.exe');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.NOVEL_ELECTRON_CDP_PORT || 9339);

function runtime(bookName, content) {
  return {
    books: [{ id: 'electron-book', name: bookName, currentChapterId: 'electron-chapter',
      chapters: [{ id: 'electron-chapter', title: '第一章', content, summary: '', prompt: '', checkResult: [] }],
      characters: [], chatHistory: [], forbiddenWords: [] }],
    currentBookId: 'electron-book', globalCharacters: [], globalActions: [], globalCostumes: []
  };
}
function snapshot(bookName, content, savedAt = Date.now()) {
  return { schemaVersion: 2, productVersion: '9.0-idb', savedAt, runtime: runtime(bookName, content), settings: {} };
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitForCdp() {
  const deadline = Date.now() + 30000;
  while(Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if(response.ok) return true;
    } catch(_) {}
    await sleep(250);
  }
  throw new Error('Electron CDP 端口未就绪');
}
async function startApp(dataDir) {
  const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
    cwd: path.dirname(exePath),
    env: { ...process.env, AI_NOVEL_E2E_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  await waitForCdp();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const deadline = Date.now() + 30000;
  let page = null;
  while(Date.now() < deadline) {
    page = context.pages().find(item => /index\.html/i.test(item.url())) || null;
    if(page) break;
    await sleep(250);
  }
  if(!page) throw new Error(`Electron 主页面未出现。输出：${output.slice(-2000)}`);
  await page.waitForFunction(() => document.title.includes('AI小说生成器'));
  await page.waitForFunction(() => (document.getElementById('storageIndicator')?.textContent || '').includes('IndexedDB'), { timeout: 30000 });
  await page.waitForTimeout(500);
  return { child, browser, page, getOutput: () => output };
}
async function stopApp(app) {
  try { await app.browser.close(); } catch(_) {}
  if(!app.child.killed) app.child.kill();
  await sleep(1200);
}

(async () => {
  assert.ok(fs.existsSync(exePath), `缺少独立 EXE：${exePath}`);
  const ipcDataDir = path.join(__dirname, '_electron-ipc-data');
  const restoreDataDir = path.join(__dirname, '_electron-restore-data');
  fs.rmSync(ipcDataDir, { recursive: true, force: true });
  fs.rmSync(restoreDataDir, { recursive: true, force: true });
  fs.mkdirSync(ipcDataDir, { recursive: true });
  fs.mkdirSync(restoreDataDir, { recursive: true });

  const first = await startApp(ipcDataDir);
  try {
    const payload = snapshot('IPC写盘书', 'IPC写盘正文');
    const saveResult = await first.page.evaluate(async value => await window.novelData.save(value), payload);
    assert.equal(saveResult.ok, true);
    const savedFile = path.join(ipcDataDir, 'novel_data.json');
    assert.ok(fs.existsSync(savedFile), 'IPC 保存后缺少 novel_data.json');
    const saved = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
    assert.equal(saved.schemaVersion, 2);
    assert.equal(saved.runtime.books[0].name, 'IPC写盘书');
    const loadResult = await first.page.evaluate(async () => await window.novelData.load());
    assert.equal(loadResult.data.runtime.books[0].name, 'IPC写盘书');
    await first.page.locator('#resetAllBtn').click();
    await first.page.waitForFunction(() => document.getElementById('confirmModal')?.style.display === 'flex');
    await first.page.locator('#confirmOk').click();
    await first.page.waitForTimeout(1500);
    assert.equal(fs.existsSync(savedFile), false, '初始化后不应残留 Electron 快照');
  } finally {
    await stopApp(first);
  }

  fs.writeFileSync(path.join(restoreDataDir, 'novel_data.json'), JSON.stringify(snapshot('重启恢复书', '重启恢复正文', Date.now() + 60000)));
  const second = await startApp(restoreDataDir);
  try {
    assert.equal(await second.page.locator('#curBookName').textContent(), '重启恢复书');
    assert.equal(await second.page.locator('#novelContent').textContent(), '重启恢复正文');
    const bridge = await second.page.evaluate(() => ({ save: typeof window.novelData.save, load: typeof window.novelData.load, saveSync: typeof window.novelData.saveSync }));
    assert.deepEqual(bridge, { save: 'function', load: 'function', saveSync: 'function' });
  } finally {
    await stopApp(second);
  }

  fs.rmSync(ipcDataDir, { recursive: true, force: true });
  fs.rmSync(restoreDataDir, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: true, checked: ['real Electron IPC save/load', 'snapshot restore after fresh launch'] }, null, 2));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
