import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', 'web-source', 'AI小说生成器9.0源码', 'js');
const files = new Map();
function file(rel) { return path.join(root, rel.replaceAll('/', path.sep)); }
function edit(rel, transforms) {
  const target = file(rel);
  let text = fs.readFileSync(target, 'utf8');
  for (const [label, pattern, replacement, expected] of transforms) {
    const count = (text.match(pattern) || []).length;
    if (count === 0 && text.includes(replacement)) continue;
    if (count !== expected) throw new Error(`${rel}: ${label} expected ${expected}, got ${count}`);
    text = text.replace(pattern, replacement);
  }
  fs.writeFileSync(target, text, 'utf8');
  files.set(rel, true);
}

edit('editor/50-polish.js', [
  ['polish save boundary', /if\(!ensureCurrentChapterSaved\(\)\) return; \/\/ 先保存当前正文（润色基于最新内容）/, 'if(!await ensureCurrentChapterSavedAndCommitted()) return; // 先保存当前正文并等待事务提交（润色基于最新内容）', 1],
  ['polish confirm', /if\(!confirm\('确定对本章进行润色吗？将调用审稿 API 并产生费用，润色结果需预览后应用。'\)\) return;/, "if(!await appConfirmAsync('确定对本章进行润色吗？将调用审稿 API 并产生费用，润色结果需预览后应用。')) return;", 1]
]);

edit('generation/4c-branch-continue.js', [
  ['continue save boundary', /if\(!ensureCurrentChapterSaved\(\)\) return;/g, 'if(!await ensureCurrentChapterSavedAndCommitted()) return;', 2],
  ['branch confirm', /if\(!confirm\('是否生成续写剧情导向？'/, "if(!await appConfirmAsync('是否生成续写剧情导向？'", 1],
  ['branch switch commit', /loadCurChapter\(\); renderChapters\(\); saveAll\(\);/, 'loadCurChapter(); renderChapters(); saveAll(); await awaitNovelPersistence();', 1]
]);

edit('editor/52-bookshelf.js', [
  ['rename callback async', /data-action="rename"\]'\)\?\.addEventListener\('click', \(e\) => \{ e\.stopPropagation\(\); if\(isGenerating/, "data-action=\"rename\"]')?.addEventListener('click', async (e) => { e.stopPropagation(); if(isGenerating", 1],
  ['rename prompt', /const nb = prompt\('重命名小说', b\.name\)/, "const nb = await appPromptAsync('重命名小说', '请输入书名', b.name)", 1],
  ['delete callback async', /data-action="delete"\]'\)\?\.addEventListener\('click', \(e\) => \{ e\.stopPropagation\(\); if\(confirm\(/, "data-action=\"delete\"]')?.addEventListener('click', async (e) => { e.stopPropagation(); if(await appConfirmAsync(", 1],
  ['duplicate function async', /function duplicateBook\(id\)/, 'async function duplicateBook(id)', 1],
  ['duplicate save boundary', /if\(!ensureCurrentChapterSaved\(\)\) return;/, 'if(!await ensureCurrentChapterSavedAndCommitted()) return;', 1],
  ['duplicate prompt', /const newName = prompt\('复制为新书，请输入新书名（默认：原书名-副本）', book\.name \+ '-副本'\)/, "const newName = await appPromptAsync('复制为新书，请输入新书名（默认：原书名-副本）', '请输入新书名', book.name + '-副本')", 1],
  ['duplicate commit', /if\(!persistOrWarn\(\)\) \{ books\.splice\(idx \+ 1, 1\); toast\("保存失败，已取消复制"\); return; \}/, 'if(!await persistOrWarnAsync()) { books.splice(idx + 1, 1); toast("保存失败，已取消复制"); return; }', 1],
  ['new book function async', /function newBook\(\)/, 'async function newBook()', 1],
  ['new book prompt', /let name = prompt\('小说名称', `新作\$\{books\.length\+1\}`\)/, "let name = await appPromptAsync('小说名称', '请输入小说名称', `新作${books.length+1}`)", 1]
]);

edit('editor/61-find-replace.js', [
  ['replace one async', /function replaceOne\(\)/, 'async function replaceOne()', 1],
  ['replace one confirm', /if\(!replacement && !confirm\('替换为空串将删除匹配内容，确定继续？'\)\)/, "if(!replacement && !await appConfirmAsync('替换为空串将删除匹配内容，确定继续？'))", 1],
  ['replace all async', /function replaceAll\(\)/, 'async function replaceAll()', 1],
  ['replace all confirm', /if\(!replacement && !confirm\('替换为空串将删除全部匹配内容，确定继续？'\)\)/, "if(!replacement && !await appConfirmAsync('替换为空串将删除全部匹配内容，确定继续？'))", 1]
]);

edit('generation/48-chat-render.js', [
  ['clear chat async', /function clearChatHistory\(\)/, 'async function clearChatHistory()', 1],
  ['clear chat confirm', /if\(!confirm\(`确认清空全部 \$\{book\.chatHistory\.length\} 条聊天记录？此操作不可撤销。`\)\)/, 'if(!await appConfirmAsync(`确认清空全部 ${book.chatHistory.length} 条聊天记录？此操作不可撤销。`))', 1],
  ['clear chat commit', /book\.chatHistory = \[\]; saveAll\(\); renderChat\(\);/, 'book.chatHistory = []; saveAll(); await awaitNovelPersistence(); renderChat();', 1]
]);

edit('stats/31-modal.js', [
  ['stats clear callback async', /clearBtn\.onclick = \(\) => \{ if\(confirm\(/, 'clearBtn.onclick = async () => { if(await appConfirmAsync(', 1]
]);

for (const rel of ['library/22-book-characters.js','library/23-global-characters.js','library/24-global-actions.js','library/25-global-costumes.js','library/26-forbidden-words.js']) {
  edit(rel, [['delete callback async', /addEventListener\('click',\(\)=> \{ if\(confirm\(/g, "addEventListener('click',async ()=> { if(await appConfirmAsync(", 1]]);
}

edit('tags/80-core.js', [
  ['tag click callbacks async', /addEventListener\('click', \(\) => \{/g, "addEventListener('click', async () => {", 2],
  ['tag prompt one', /const v = prompt\('新增单次标签：输入标签名，将标记在当前编辑项上', ''\);/, "const v = await appPromptAsync('新增单次标签：输入标签名，将标记在当前编辑项上', '请输入标签名', '');", 1],
  ['tag prompt two', /const v = prompt\(hint, ''\);/, "const v = await appPromptAsync(hint, '请输入标签名', '');", 1]
]);

edit('app/90-scratchpad.js', [
  ['reset function async', /function resetAll\(\)/, 'async function resetAll()', 1],
  ['reset confirm', /if\(!confirm\('⚠️ 此操作将清空所有数据（包括所有小说、角色、动作库、API配置、草稿本等），且不可恢复！\\n\\n建议先点击「备份」导出数据。\\n\\n确定要继续吗？'\)\) return;/, "if(!await appConfirmAsync('⚠️ 此操作将清空所有数据（包括所有小说、角色、动作库、API配置、草稿本等），且不可恢复！\\n\\n建议先点击「备份」导出数据。\\n\\n确定要继续吗？')) return;", 1]
]);

edit('backup/57-settings-and-export.js', [
  ['backup warning async', /if\(!confirm\('⚠️ 备份文件将包含您的 API Key（正文\/审稿\/扮演\/生图配置或一键起书草稿中的密钥），以明文存于 JSON。\\n\\n请勿上传网盘、发送他人或经聊天工具\/第三方编辑器流转，以免密钥泄露。\\n\\n是否仍要导出？'\)\) return;/, "if(!await appConfirmAsync('⚠️ 备份文件将包含您的 API Key（正文/审稿/扮演/生图配置或一键起书草稿中的密钥），以明文存于 JSON。\\n\\n请勿上传网盘、发送他人或经聊天工具/第三方编辑器流转，以免密钥泄露。\\n\\n是否仍要导出？')) return;", 1]
]);

edit('backup/5a-full-import.js', [
  ['import function async', /function importBackup\(file\)/, 'async function importBackup(file)', 1],
  ['import confirm', /if\(!confirm\("导入备份将覆盖当前全部数据（所有小说、设定、API 配置、素材库、草稿本等），且不可恢复！\\n\\n建议先点击「备份」导出当前数据。\\n\\n是否继续导入？"\)\) return;/, 'if(!await appConfirmAsync("导入备份将覆盖当前全部数据（所有小说、设定、API 配置、素材库、草稿本等），且不可恢复！\\n\\n建议先点击「备份」导出当前数据。\\n\\n是否继续导入？")) return;', 1],
  ['import reader async', /reader\.onload = function\(e\)/, 'reader.onload = async function(e)', 1],
  ['version confirm', /if\(!confirm\("备份版本\("\+data\.version\+"\)与当前版本\(9\.0\)不匹配，可能存在兼容性问题。\\n\\n是否继续导入？"\)\)/, 'if(!await appConfirmAsync("备份版本("+data.version+")与当前版本(9.0)不匹配，可能存在兼容性问题。\\n\\n是否继续导入？"))', 1],
  ['import critical commit', /const savedOk = saveAll\(\); if\(!savedOk\) throw new Error\('本地存储失败，导入已回滚'\);/, "const savedOk = await persistNovelRuntimeCritical(); if(!savedOk) throw new Error('本地存储失败，导入已回滚');", 1]
]);

edit('backup/5b-android-restore.js', [
  ['android function async', /function importAndroidBookArchive\(file\)/, 'async function importAndroidBookArchive(file)', 1],
  ['android confirm', /if\(!confirm\('安卓恢复只会追加书籍正文和本书角色库，不会导入 API、全局素材、草稿本、禁用词和统计。已有书籍、章节和角色不会被覆盖。\\n\\n是否继续？'\)\) return;/, "if(!await appConfirmAsync('安卓恢复只会追加书籍正文和本书角色库，不会导入 API、全局素材、草稿本、禁用词和统计。已有书籍、章节和角色不会被覆盖。\\n\\n是否继续？')) return;", 1],
  ['android reader async', /reader\.onload = function\(e\)/, 'reader.onload = async function(e)', 1],
  ['android critical commit', /if\(!saveAll\(\)\) throw new Error\('本地存储失败，安卓恢复已回滚'\);/, "if(!await persistNovelRuntimeCritical()) throw new Error('本地存储失败，安卓恢复已回滚');", 1]
]);

edit('editor/53-start-book.js', [
  ['template selector async', /function selectBookTpl\(t\)/, 'async function selectBookTpl(t)', 1],
  ['template selector confirm', /if\(edited\) \{ if\(!confirm\('切换页签后，当前模板已编辑的全局提示词\/行为规范将不会保存。是否继续切换？'\)\) return; \}/, "if(edited) { if(!await appConfirmAsync('切换页签后，当前模板已编辑的全局提示词/行为规范将不会保存。是否继续切换？')) return; }", 1]
]);

edit('editor/55-chapters.js', [
  ['chapter title async', /function renameCurrentChapter\(\)/, 'async function renameCurrentChapter()', 1],
  ['chapter title prompt', /let nt = prompt\('新章节标题', chap\.title\)/, "let nt = await appPromptAsync('新章节标题', '请输入章节标题', chap.title)", 1],
  ['chapter rename callback async', /data-action="rename"\]'\)\.addEventListener\('click', \(e\) =>/, "data-action=\"rename\"].addEventListener('click', async (e) =>", 1],
  ['chapter rename prompt', /let nt=prompt\('新章节标题',ch\.title\)/, "let nt=await appPromptAsync('新章节标题', '请输入章节标题', ch.title)", 1],
  ['chapter delete callback async', /data-action="delete"\]'\)\.addEventListener\('click', \(e\) =>/, "data-action=\"delete\"].addEventListener('click', async (e) =>", 1],
  ['chapter delete save boundary', /if\(!deletingCurrent && !ensureCurrentChapterSaved\(\)\)/, 'if(!deletingCurrent && !await ensureCurrentChapterSavedAndCommitted())', 1],
  ['chapter delete confirm', /if\(!confirm\(`确认删除章节「\$\{ch\.title\}」？`\)\)/, 'if(!await appConfirmAsync(`确认删除章节「${ch.title}」？`))', 1],
  ['chapter delete commit', /if\(!persistOrWarn\(\)\) \{ if\(oldLen===1\)/, 'if(!await persistOrWarnAsync()) { if(oldLen===1)', 1],
  ['chapter rename selector', /querySelector\('\[data-action="rename"\]\.addEventListener/, "querySelector('[data-action=\"rename\"]').addEventListener", 1],
  ['chapter delete selector', /querySelector\('\[data-action="delete"\]\.addEventListener/, "querySelector('[data-action=\"delete\"]').addEventListener", 1]
]);

console.log(`patched dialog/storage boundaries in ${files.size} files`);
