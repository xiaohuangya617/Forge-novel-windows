const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const rendererPath = path.join(projectRoot, 'electron', 'resources', 'app', 'index.html');
const templatePath = path.join(projectRoot, 'web-source', 'AI小说生成器9.0源码', 'index.template.html');
const rendererUrl = 'file:///' + rendererPath.replace(/\\/g, '/');
const templateUrl = 'file:///' + templatePath.replace(/\\/g, '/');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const bookCount = 10;
const bookSizeMiB = Number(process.env.NOVEL_LARGE_BOOK_MB || 10);

async function waitReady(page) {
  await page.waitForFunction(() => (document.getElementById('storageIndicator')?.textContent || '').includes('IndexedDB'), { timeout: 120000 });
  await page.waitForTimeout(1000);
}

(async () => {
  assert.ok(Number.isFinite(bookSizeMiB) && bookSizeMiB > 0 && bookSizeMiB <= 20, 'NOVEL_LARGE_BOOK_MB 应在 1-20 之间');
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  const seedPage = await context.newPage();
  await seedPage.goto(templateUrl, { waitUntil: 'domcontentloaded' });
  await seedPage.evaluate(({ bookCount: count, bookSizeMiB: size }) => new Promise((resolve, reject) => {
    const open = indexedDB.open('ai_novel_generator_v1', 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if(!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if(!db.objectStoreNames.contains('chapters')) db.createObjectStore('chapters', { keyPath: 'key' });
      if(!db.objectStoreNames.contains('characters')) db.createObjectStore('characters', { keyPath: 'key' });
      if(!db.objectStoreNames.contains('chatMessages')) db.createObjectStore('chatMessages', { keyPath: 'key' });
      if(!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'key' });
      if(!db.objectStoreNames.contains('storageMeta')) db.createObjectStore('storageMeta', { keyPath: 'key' });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['books', 'chapters', 'characters', 'chatMessages', 'collections', 'storageMeta'], 'readwrite');
      ['books', 'chapters', 'characters', 'chatMessages', 'collections', 'storageMeta'].forEach(name => tx.objectStore(name).clear());
      const unit = '大数据测试正文。';
      const content = unit.repeat(Math.ceil(size * 1024 * 1024 / unit.length));
      const bookIds = [];
      const chapterKeys = [];
      for(let i = 0; i < count; i++) {
        const bookId = 'large-book-' + i;
        const chapterId = 'large-chapter-' + i;
        const key = bookId + '::' + chapterId;
        bookIds.push(bookId); chapterKeys.push(key);
        tx.objectStore('books').put({ id: bookId, name: '大数据书-' + i, currentChapterId: chapterId, forbiddenWords: [], order: i });
        tx.objectStore('chapters').put({ key, id: chapterId, bookId, order: 0, title: '第一章', content, summary: '', prompt: '', checkResult: [] });
      }
      tx.objectStore('collections').put({ key: 'currentBookId', value: bookIds[0] });
      tx.objectStore('collections').put({ key: 'globalCharacters', value: [] });
      tx.objectStore('collections').put({ key: 'globalActions', value: [] });
      tx.objectStore('collections').put({ key: 'globalCostumes', value: [] });
      tx.objectStore('storageMeta').put({ key: 'runtimeIndex_v1', value: { bookIds, chapterKeys, characterKeys: [], chatKeys: [] }, schemaVersion: 1, updatedAt: Date.now() });
      tx.oncomplete = () => resolve({ bytes: content.length * count });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('seed transaction aborted'));
    };
  }), { bookCount, bookSizeMiB });
  await seedPage.close();

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  await page.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const loaded = await page.evaluate(async () => {
    const req = indexedDB.open('ai_novel_generator_v1');
    return await new Promise((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction(['books', 'chapters'], 'readonly');
        Promise.all(['books', 'chapters'].map(name => new Promise((res, rej) => {
          const get = tx.objectStore(name).getAll();
          get.onsuccess = () => res([name, get.result]);
          get.onerror = () => rej(get.error);
        }))).then(rows => {
          const map = Object.fromEntries(rows);
          resolve({ books: map.books.length, chapters: map.chapters.length, contentBytes: map.chapters.reduce((sum, row) => sum + String(row.content || '').length, 0) });
        }).catch(reject);
      };
    });
  });
  assert.equal(loaded.books, bookCount);
  assert.equal(loaded.chapters, bookCount);
  assert.ok(loaded.contentBytes >= bookCount * bookSizeMiB * 1024 * 1024, `正文总量不足：${loaded.contentBytes}`);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  assert.equal(await page.locator('#curBookName').textContent(), '大数据书-0');
  await browser.close();
  console.log(JSON.stringify({ ok: true, books: loaded.books, chapters: loaded.chapters, contentBytes: loaded.contentBytes, approxMiB: Math.round(loaded.contentBytes / 1024 / 1024) }, null, 2));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
