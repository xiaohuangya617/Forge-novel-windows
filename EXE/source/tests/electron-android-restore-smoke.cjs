const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const exePath = path.join(root, 'dist', 'AI小说生成器9.0-IDB独立版', 'AI小说生成器9.0-IDB独立版.exe');
const dataDir = path.join(__dirname, `_electron-android-data-${process.pid}-${Date.now()}`);
const archivePath = path.join(__dirname, `_android-restore-${process.pid}.json`);
const port = Number(process.env.NOVEL_ELECTRON_ANDROID_CDP_PORT || 9342);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitCdp() {
  const end = Date.now() + 30000;
  while(Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if(r.ok) return; } catch(_) {}
    await sleep(250);
  }
  throw new Error('Electron CDP 未就绪');
}

async function readRuntime(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('ai_novel_generator_v1', 1);
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['books', 'chapters', 'characters', 'chatMessages'], 'readonly');
      const getAll = store => new Promise((res, rej) => {
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error || new Error(store + ' 读取失败'));
      });
      Promise.all(['books', 'chapters', 'characters', 'chatMessages'].map(getAll))
        .then(([books, chapters, characters, chatMessages]) => resolve({ books, chapters, characters, chatMessages }))
        .catch(reject);
    };
  }));
}

(async () => {
  assert.ok(fs.existsSync(exePath), `缺少独立 EXE：${exePath}`);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(archivePath, JSON.stringify({
    version: '1.47',
    apiConfig: { key: 'must-not-enter-runtime' },
    globalCharacters: [{ id: 'global-only', name: '不应导入' }],
    books: [{
      id: 'android-e2e-book',
      name: '安卓恢复实测书',
      worldview: '海岛世界观',
      plotSet: '追查灯塔失踪案',
      globalPrompt: '保持线索可追溯',
      writingStyle: '语言克制，场景具体',
      chatHistory: [{ role: 'user', content: '继续追查', ts: 10 }],
      chapters: [{ id: 'android-e2e-chapter', title: '第一章', content: '安卓正文', summary: '安卓摘要', prompt: '安卓指令', sourceChapter: true }],
      characters: [{ id: 'android-e2e-character', name: '林澈', personality: '冷静' }]
    }]
  }), 'utf8');

  const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
    cwd: path.dirname(exePath),
    env: { ...process.env, AI_NOVEL_E2E_DATA_DIR: dataDir },
    stdio: 'ignore',
    windowsHide: true
  });
  let browser;
  try {
    await waitCdp();
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const page = browser.contexts()[0].pages().find(p => /index\.html/i.test(p.url()));
    assert.ok(page, '主页面未出现');
    await page.waitForFunction(() => (document.getElementById('storageIndicator')?.textContent || '').includes('IndexedDB'));
    await page.locator('#androidRestoreFileInput').setInputFiles(archivePath);
    await page.waitForFunction(() => document.getElementById('confirmModal')?.style.display === 'flex');
    assert.match(await page.locator('#confirmModal .dialog-message').textContent(), /世界观/);
    await page.locator('#confirmOk').click();
    await page.waitForFunction(() => document.getElementById('curBookName')?.textContent === '安卓恢复实测书');
    await page.waitForFunction(() => document.getElementById('worldview')?.value === '海岛世界观');

    const visible = await page.evaluate(() => ({
      plotSet: document.getElementById('plotSet')?.value,
      globalPrompt: document.getElementById('globalPrompt')?.value,
      writingStyle: document.getElementById('writingStyle')?.value,
      content: document.getElementById('novelContent')?.textContent,
      chat: document.getElementById('chatMsgs')?.textContent
    }));
    assert.deepEqual(visible, {
      plotSet: '追查灯塔失踪案',
      globalPrompt: '保持线索可追溯',
      writingStyle: '语言克制，场景具体',
      content: '安卓正文',
      chat: '继续追查'
    });

    const runtime = await readRuntime(page);
    assert.equal(runtime.books.length, 1);
    assert.equal(runtime.books[0].worldview, '海岛世界观');
    assert.equal('apiConfig' in runtime.books[0], false);
    assert.equal(runtime.chapters[0].sourceChapter, true);
    assert.equal(runtime.characters[0].name, '林澈');
    assert.equal(runtime.chatMessages[0].content, '继续追查');

    await page.reload();
    await page.waitForFunction(() => document.getElementById('curBookName')?.textContent === '安卓恢复实测书');
    await page.waitForFunction(() => document.getElementById('worldview')?.value === '海岛世界观');
    assert.equal(await page.locator('#novelContent').textContent(), '安卓正文');
    console.log(JSON.stringify({ ok: true, checked: ['Electron Android restore UI', 'five book fields', 'chapter/character/chat IndexedDB persistence', 'reload persistence', 'extra data filtering'] }, null, 2));
  } finally {
    try { if(browser) await browser.close(); } catch(_) {}
    if(!child.killed) child.kill();
    await sleep(1200);
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(archivePath, { force: true });
  }
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
