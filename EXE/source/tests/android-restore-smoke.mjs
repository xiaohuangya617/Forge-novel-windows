import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const htmlPath = process.env.NOVEL_RESTORE_HTML
  ? path.resolve(process.env.NOVEL_RESTORE_HTML)
  : path.join(projectRoot, 'web-source', 'AI小说生成器9.0.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = html.slice(scriptStart, scriptEnd);
const begin = script.indexOf('    function androidBookKey');
const end = script.indexOf('    async function importAndroidBookArchive', begin);
assert.ok(begin >= 0 && end > begin, 'HTML 中缺少安卓恢复函数');
const restoreSource = script.slice(begin, end);
const context = {
  JSON,
  Date,
  ensureArray(value) { return Array.isArray(value) ? value : []; },
  uuid() { return 'generated-id'; }
};
const api = vm.runInNewContext(`(() => { ${restoreSource}; return { normalizeAndroidBook, mergeAndroidBook, createBookFromAndroid }; })()`, context);

const incomingRaw = {
  id: 'android-book-1',
  name: '安卓测试书',
  worldview: '海岛世界观',
  plotSet: '主线追查灯塔失踪案',
  globalPrompt: '保持线索可追溯',
  writingStyle: '语言克制，场景具体',
  chatHistory: [
    { role: 'assistant', content: '旧助手消息', ts: 1, costLabel: '$0.01', ignored: 'drop' },
    { role: 'user', content: '继续追查', ts: 2, retry: 'chapter' },
    { role: 'system', content: '不应进入运行态', contentType: 'drop' }
  ],
  chapters: [
    { id: 'source-1', title: '原作参考', content: '原作正文', sourceChapter: true },
    { id: 'chapter-1', title: '第一章', content: '安卓正文', summary: '安卓摘要', prompt: '安卓指令' },
    { id: 'chapter-1', title: '重复章节', content: '不应覆盖' }
  ],
  characters: [
    { id: 'char-1', name: '林澈', personality: '安卓版本' },
    { id: 'char-2', name: '苏晚', appearance: '雨衣' }
  ],
  apiConfig: { key: 'must-not-import' },
  globalCharacters: [{ id: 'global-1', name: '不应导入' }]
};
const incoming = JSON.parse(JSON.stringify(api.normalizeAndroidBook(incomingRaw)));

assert.equal(incoming.worldview, '海岛世界观');
assert.equal(incoming.plotSet, '主线追查灯塔失踪案');
assert.equal(incoming.globalPrompt, '保持线索可追溯');
assert.equal(incoming.writingStyle, '语言克制，场景具体');
assert.deepEqual(incoming.chatHistory, [
  { role: 'assistant', content: '旧助手消息', ts: 1, costLabel: '$0.01' },
  { role: 'user', content: '继续追查', ts: 2, retry: 'chapter' }
]);
assert.equal(incoming.chapters[0].sourceChapter, true);
assert.equal('apiConfig' in incoming, false);
assert.equal('globalCharacters' in incoming, false);

const existing = {
  id: 'android-book-1',
  name: '安卓测试书',
  worldview: '旧世界观',
  plotSet: '旧主线',
  globalPrompt: '旧提示词',
  writingStyle: '旧文风',
  chatHistory: [{ role: 'assistant', content: '旧聊天', ts: 0 }],
  chapters: [{ id: 'chapter-1', title: '第一章', content: 'PC 正文' }],
  characters: [{ id: 'char-1', name: '林澈', personality: 'PC 版本' }]
};
const merged = api.mergeAndroidBook(existing, incoming);
assert.equal(merged.addedChapters, 1);
assert.equal(merged.addedCharacters, 1);
assert.equal(existing.worldview, '海岛世界观');
assert.equal(existing.plotSet, '主线追查灯塔失踪案');
assert.equal(existing.globalPrompt, '保持线索可追溯');
assert.equal(existing.writingStyle, '语言克制，场景具体');
assert.deepEqual(JSON.parse(JSON.stringify(existing.chatHistory)), incoming.chatHistory);
assert.equal(existing.chapters.length, 2);
assert.equal(existing.chapters.find(ch => ch.id === 'chapter-1').content, 'PC 正文');
assert.equal(existing.chapters.find(ch => ch.id === 'source-1').sourceChapter, true);
assert.equal(existing.characters.length, 2);
assert.equal(existing.characters.find(ch => ch.id === 'char-1').personality, 'PC 版本');

const oldIncoming = api.normalizeAndroidBook({ id: 'old-book', name: '旧安卓书', chapters: [], characters: [] });
api.mergeAndroidBook(existing, oldIncoming);
assert.equal(existing.worldview, '海岛世界观');
assert.deepEqual(existing.chatHistory, incoming.chatHistory);
const newBook = api.createBookFromAndroid(oldIncoming, new Set());
assert.equal(newBook.worldview, '');
assert.equal(newBook.plotSet, '');
assert.equal(newBook.globalPrompt, '你是一位擅长细腻情感的言情小说家。');
assert.equal(newBook.writingStyle, '文风细腻，多用心理描写。');
assert.equal(newBook.chatHistory.length, 0);

console.log(JSON.stringify({ ok: true, normalizedMessages: incoming.chatHistory.length, mergedChapters: existing.chapters.length, mergedCharacters: existing.characters.length }, null, 2));
