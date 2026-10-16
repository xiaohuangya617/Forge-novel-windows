const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const rendererPath = path.join(projectRoot, 'electron', 'resources', 'app', 'index.html');
const rendererUrl = 'file:///' + rendererPath.replace(/\\/g, '/');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const legacyBook = {
  id: 'smoke-book',
  name: '迁移烟雾测试',
  currentChapterId: 'smoke-chapter',
  worldview: '',
  plotSet: '',
  globalPrompt: '',
  writingStyle: '',
  characters: [{ id: 'smoke-character', name: '测试角色' }],
  chapters: [{ id: 'smoke-chapter', title: '第一章', content: '迁移正文', summary: '', prompt: '', checkResult: [] }],
  chatHistory: [{ role: 'assistant', content: '迁移消息', ts: Date.now() }],
  forbiddenWords: []
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  await context.addInitScript(book => {
    if (localStorage.getItem('idb_smoke_seeded')) return;
    localStorage.setItem('books_v2', JSON.stringify([book]));
    localStorage.setItem('currentBookId_v2', book.id);
    localStorage.setItem('global_characters_v2', '[]');
    localStorage.setItem('global_actions_v2', '[]');
    localStorage.setItem('global_costumes_v2', '[]');
    localStorage.setItem('idb_smoke_seeded', '1');
  }, legacyBook);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  page.on('console', message => { if(message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async () => {
    const stores = {};
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('ai_novel_generator_v1');
      req.onerror = () => reject(req.error || new Error('open failed'));
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['books', 'chapters', 'characters'], 'readonly');
        Promise.all(['books', 'chapters', 'characters'].map(name => new Promise((res, rej) => {
          const r = tx.objectStore(name).getAll();
          r.onsuccess = () => res([name, r.result.length]);
          r.onerror = () => rej(r.error);
        }))).then(rows => { rows.forEach(([name, count]) => { stores[name] = count; }); resolve(); }).catch(reject);
      };
    });
    return {
      title: document.title,
      indicator: document.getElementById('storageIndicator')?.textContent || '',
      legacyBooks: localStorage.getItem('books_v2'),
      stores
    };
  });
  assert.equal(result.stores.books, 1);
  assert.equal(result.stores.chapters, 1);
  assert.equal(result.stores.characters, 1);
  assert.equal(result.legacyBooks, null);
  assert.match(result.indicator, /IndexedDB/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const reloadResult = await page.evaluate(() => ({
    title: document.title,
    legacyBooks: localStorage.getItem('books_v2'),
    bodyHasMigratedBook: document.body.innerText.includes('迁移烟雾测试')
  }));
  await page.locator('#novelContent').fill('迁移后正文已更新');
  await page.locator('#saveChapBtn').click();
  await page.waitForTimeout(1000);
  const writeResult = await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('ai_novel_generator_v1');
      req.onerror = () => reject(req.error || new Error('open failed'));
      req.onsuccess = () => {
        const tx = req.result.transaction('chapters', 'readonly');
        const get = tx.objectStore('chapters').getAll();
        get.onsuccess = () => resolve(get.result.map(row => row.content));
        get.onerror = () => reject(get.error || new Error('read failed'));
      };
    });
  });
  assert.equal(reloadResult.legacyBooks, null);
  assert.equal(reloadResult.bodyHasMigratedBook, true);
  assert.deepEqual(writeResult, ['迁移后正文已更新']);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  await browser.close();
  console.log(JSON.stringify({ ok: true, result, reloadResult, writeResult }, null, 2));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});

