const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'web-source', 'AI小说生成器9.0.html');
const htmlUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  page.on('console', message => { if(message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.getElementById('storageIndicator')?.textContent || '').includes('IndexedDB'), { timeout: 120000 });
  const result = await page.evaluate(() => ({
    title: document.title,
    indicator: document.getElementById('storageIndicator')?.textContent || '',
    hasBookShell: !!document.getElementById('bookList'),
    hasAndroidRestore: !!document.getElementById('androidRestoreFileInput')
  }));
  assert.match(result.title, /AI小说生成器/);
  assert.equal(result.hasBookShell, true);
  assert.equal(result.hasAndroidRestore, true);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  await browser.close();
  console.log(JSON.stringify({ ok: true, result }, null, 2));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
