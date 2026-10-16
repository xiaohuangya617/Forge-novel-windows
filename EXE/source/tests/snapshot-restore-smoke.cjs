const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const rendererPath = path.join(projectRoot, 'electron', 'resources', 'app', 'index.html');
const rendererUrl = 'file:///' + rendererPath.replace(/\\/g, '/');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

function runtime(bookName, chapterText) {
  return {
    books: [{
      id: 'snapshot-book', name: bookName, currentChapterId: 'snapshot-chapter',
      chapters: [{ id: 'snapshot-chapter', title: '第一章', content: chapterText, summary: '', prompt: '', checkResult: [] }],
      characters: [], chatHistory: [], forbiddenWords: []
    }],
    currentBookId: 'snapshot-book', globalCharacters: [], globalActions: [], globalCostumes: []
  };
}

async function waitBoot(page) {
  await page.waitForFunction(() => document.body && document.body.innerText.includes('AI小说生成器'));
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  const now = Date.now();
  const older = { schemaVersion: 2, productVersion: '9.0-idb', savedAt: now - 60000, runtime: runtime('旧快照', '旧正文'), settings: {} };
  const first = { schemaVersion: 2, productVersion: '9.0-idb', savedAt: now + 10000, runtime: runtime('首个快照', '首个正文'), settings: {} };
  const newer = { schemaVersion: 2, productVersion: '9.0-idb', savedAt: now + 20000, runtime: runtime('更新快照', '更新正文'), settings: {} };
  await context.addInitScript(({ firstSnapshot, newerSnapshot, olderSnapshot }) => {
    const mode = localStorage.getItem('__snapshot_test_mode') || 'first';
    const selected = mode === 'newer' ? newerSnapshot : mode === 'older' ? olderSnapshot : firstSnapshot;
    window.novelData = {
      load: async () => ({ data: selected }),
      save: async () => ({ ok: true }),
      saveSync: () => ({ ok: true })
    };
  }, { firstSnapshot: first, newerSnapshot: newer, olderSnapshot: older });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  await page.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  assert.equal(await page.locator('#curBookName').textContent(), '首个快照');

  await page.evaluate(() => localStorage.setItem('__snapshot_test_mode', 'newer'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  assert.equal(await page.locator('#curBookName').textContent(), '更新快照');
  assert.equal(await page.locator('#novelContent').textContent(), '更新正文');

  await page.evaluate(() => localStorage.setItem('__snapshot_test_mode', 'older'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  assert.equal(await page.locator('#curBookName').textContent(), '更新快照');
  assert.equal(await page.locator('#novelContent').textContent(), '更新正文');
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  const legacyContext = await browser.newContext();
  const legacyBook = runtime('旧 EXE 快照', '旧格式正文');
  await legacyContext.addInitScript(book => {
    window.novelData = {
      load: async () => ({ data: {
        books_v2: JSON.stringify(book.books),
        currentBookId_v2: book.currentBookId,
        global_characters_v2: JSON.stringify(book.globalCharacters),
        global_actions_v2: JSON.stringify(book.globalActions),
        global_costumes_v2: JSON.stringify(book.globalCostumes)
      } }),
      save: async () => ({ ok: true }),
      saveSync: () => ({ ok: true })
    };
  }, legacyBook);
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await waitBoot(legacyPage);
  assert.equal(await legacyPage.locator('#curBookName').textContent(), '旧 EXE 快照');
  assert.equal(await legacyPage.locator('#novelContent').textContent(), '旧格式正文');
  await legacyContext.close();

  const beforeUnloadSyncCalls = await page.evaluate(() => {
    let calls = 0;
    window.novelData.saveSync = () => { calls++; return { ok: true }; };
    window.dispatchEvent(new Event('beforeunload'));
    return calls;
  });
  assert.equal(beforeUnloadSyncCalls, 1);

  await browser.close();
  console.log(JSON.stringify({ ok: true, checked: ['empty IDB restores snapshot', 'newer snapshot replaces IDB', 'older snapshot is ignored', 'legacy EXE snapshot compatibility', 'beforeunload synchronous snapshot hook'] }, null, 2));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
