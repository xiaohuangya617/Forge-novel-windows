import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..', 'AI小说生成器8.9源码');
const outputJs = path.join(here, 'js');

// 每个起始行都位于原文件的同一层级，拆分只改变文件边界，不改变代码内容和执行顺序。
const groups = [
  {
    source: 'js/00-runtime-and-pricing.js',
    parts: [
      ['runtime/00-state.js', 1],
      ['runtime/01-pricing.js', 57],
      ['runtime/02-session.js', 104]
    ]
  },
  {
    source: 'js/10-roleplay-rules-storage.js',
    parts: [
      ['roleplay/10-roleplay.js', 1],
      ['rules/11-ai-taste.js', 261],
      ['ui/12-toast.js', 351],
      ['ui/13-logs.js', 355],
      ['ui/14-clipboard-combo.js', 365],
      ['ui/15-tab-notifications.js', 461],
      ['storage/16-capacity.js', 500],
      ['storage/17-archive.js', 542],
      ['storage/18-runtime-helpers.js', 741]
    ]
  },
  {
    source: 'js/20-api-and-libraries.js',
    parts: [
      ['api/20-config.js', 1],
      ['api/21-rollback.js', 439],
      ['library/22-book-characters.js', 498],
      ['library/23-global-characters.js', 601],
      ['library/24-global-actions.js', 658],
      ['library/25-global-costumes.js', 711],
      ['library/26-forbidden-words.js', 779]
    ]
  },
  {
    source: 'js/30-stats-relations.js',
    parts: [
      ['stats/30-compute.js', 1],
      ['stats/31-modal.js', 82],
      ['stats/32-tabs.js', 129],
      ['stats/33-open.js', 136],
      ['stats/34-close.js', 143],
      ['stats/35-export.js', 144],
      ['stats/36-forbidden-entry.js', 169]
    ]
  },
  {
    source: 'js/40-generation-and-polish.js',
    parts: [
      ['graph/40-core.js', 1],
      ['graph/41-regions.js', 71],
      ['graph/42-editor.js', 461],
      ['generation/43-context-builders.js', 528],
      ['generation/44-check-and-budget.js', 748],
      ['generation/45-summary-growth.js', 869],
      ['generation/46-core.js', 1137],
      ['generation/47-stop-and-chat.js', 1323],
      ['generation/48-chat-render.js', 1383],
      ['generation/49-multi-chapter.js', 1512],
      ['generation/4a-dual.js', 1602],
      ['generation/4b-branch-context.js', 1817],
      ['generation/4c-branch-continue.js', 1943]
    ]
  },
  {
    source: 'js/50-editor-and-backup.js',
    parts: [
      ['editor/50-polish.js', 1],
      ['editor/51-rewrite.js', 349],
      ['editor/52-bookshelf.js', 445],
      ['editor/53-start-book.js', 596],
      ['editor/54-save.js', 855],
      ['editor/55-chapters.js', 917],
      ['editor/56-format-and-export.js', 1035],
      ['backup/57-settings-and-export.js', 1079],
      ['backup/58-validation.js', 1123],
      ['backup/59-transaction.js', 1149],
      ['backup/5a-full-import.js', 1164],
      ['backup/5b-android-restore.js', 1259],
      ['editor/5c-conflict-panel.js', 1348],
      ['editor/5d-check-marks.js', 1419]
    ]
  },
  {
    source: 'js/60-banter-and-start-book.js',
    parts: [
      ['banter/60-banter.js', 1],
      ['editor/61-find-replace.js', 267],
      ['editor/62-autosave-resize.js', 326],
      ['bindings/63-events.js', 344]
    ]
  },
  {
    source: 'js/70-bindings-and-precision.js',
    parts: [
      ['precision/70-panel.js', 1],
      ['precision/71-filter.js', 57],
      ['precision/72-search.js', 83],
      ['precision/73-library-filter.js', 96]
    ]
  },
  {
    source: 'js/80-tags-layout-scratchpad.js',
    parts: [
      ['tags/80-core.js', 1],
      ['tags/81-batch.js', 74],
      ['layout/82-library-editor.js', 280],
      ['layout/83-textarea.js', 359]
    ]
  },
  {
    source: 'js/90-init.js',
    parts: [
      ['app/90-scratchpad.js', 1],
      ['app/91-menu.js', 158],
      ['app/92-init.js', 187]
    ]
  }
];

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

function sliceByLines(text, starts, begin, endExclusive) {
  const beginOffset = starts[begin - 1];
  const endOffset = endExclusive === undefined ? text.length : starts[endExclusive - 1];
  if (beginOffset === undefined || endOffset === undefined) throw new Error(`行号越界：${begin}-${endExclusive}`);
  return text.slice(beginOffset, endOffset);
}

fs.rmSync(outputJs, { recursive: true, force: true });
fs.mkdirSync(outputJs, { recursive: true });
const scriptFiles = [];
const sourceMap = [];

for (const group of groups) {
  const sourcePath = path.join(sourceRoot, group.source.replaceAll('/', path.sep));
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const starts = lineStarts(sourceText);
  const sourceLineCount = starts.length;
  for (let i = 0; i < group.parts.length; i++) {
    const [relativeFile, begin] = group.parts[i];
    const next = group.parts[i + 1];
    const endExclusive = next ? next[1] : undefined;
    if (begin < 1 || begin > sourceLineCount) throw new Error(`${group.source} 起始行无效：${begin}`);
    if (next && next[1] <= begin) throw new Error(`${group.source} 分段顺序错误：${begin} -> ${next[1]}`);
    const content = sliceByLines(sourceText, starts, begin, endExclusive);
    const target = path.join(outputJs, relativeFile.replaceAll('/', path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    scriptFiles.push(relativeFile);
    sourceMap.push({ file: relativeFile, source: group.source, startLine: begin, endLine: next ? next[1] - 1 : sourceLineCount });
  }
}

// HTML 版与 EXE 版的存储实现不同：HTML 使用同步 localStorage，不能调用 EXE 专用的
// ensureCurrentChapterSavedAndCommitted。9.0 HTML 在生成后应用这一处适配修复，
// 原 8.9 源码目录仍保留原样，便于后续对照。
const htmlPatches = [
  {
    file: 'banter/60-banter.js',
    from: 'if(!await ensureCurrentChapterSavedAndCommitted()) return;',
    to: 'if(!ensureCurrentChapterSaved()) return;'
  },
  {
    file: 'generation/46-core.js',
    from: 'if(!isRegen) { renderChapters(); loadCurChapter(); }',
    to: 'renderChapters(); loadCurChapter();'
  },
  {
    file: 'generation/46-core.js',
    from: 'saved = saveAll() && await awaitNovelPersistence();',
    to: 'saved = saveAll();'
  },
  {
    file: 'backup/57-settings-and-export.js',
    from: 'const backupData = { version:"8.9",',
    to: 'const backupData = { version:"9.0",'
  },
  {
    file: 'backup/5a-full-import.js',
    from: '"8.8","8.9"]; if(data.version && !compatVersions.includes(data.version)) { if(!confirm("备份版本("+data.version+")与当前版本(8.9)不匹配，可能存在兼容性问题。\\n\\n是否继续导入？"))',
    to: '"8.8","8.9","9.0"]; if(data.version && !compatVersions.includes(data.version)) { if(!confirm("备份版本("+data.version+")与当前版本(9.0)不匹配，可能存在兼容性问题。\\n\\n是否继续导入？"))'
  }
];
for(const patch of htmlPatches) {
  const target = path.join(outputJs, patch.file.replaceAll('/', path.sep));
  const text = fs.readFileSync(target, 'utf8');
  if(!text.includes(patch.from)) throw new Error(`HTML 适配补丁未命中：${patch.file}`);
  fs.writeFileSync(target, text.replace(patch.from, patch.to), 'utf8');
}

const template = fs.readFileSync(path.join(sourceRoot, 'index.template.html'), 'utf8')
  .replaceAll('v8.9', 'v9.0');
fs.writeFileSync(path.join(here, 'index.template.html'), template, 'utf8');
const styles = fs.readFileSync(path.join(sourceRoot, 'styles.css'), 'utf8')
  .replace('/* v8.9：顶部菜单保持单行，窄窗口改为横向滚动 */', '/* v9.0：顶部菜单保持单行，窄窗口改为横向滚动 */');
fs.writeFileSync(path.join(here, 'styles.css'), styles, 'utf8');
fs.writeFileSync(path.join(here, 'build-manifest.json'), JSON.stringify({ version: '9.0', scriptFiles, sourceMap, htmlPatches }, null, 2) + '\n', 'utf8');

const buildText = `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'build-manifest.json'), 'utf8'));
const templatePath = path.join(here, 'index.template.html');
const outputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(here, '..', 'AI小说生成器9.0.html');
const css = fs.readFileSync(path.join(here, 'styles.css'), 'utf8');
const sourceOf = new Map((manifest.sourceMap || []).map(item => [item.file, item.source]));
let js = '';
manifest.scriptFiles.forEach((file, index) => {
  if(index > 0 && sourceOf.get(file) !== sourceOf.get(manifest.scriptFiles[index - 1])) js += '\\n';
  js += fs.readFileSync(path.join(here, 'js', file), 'utf8');
});
let html = fs.readFileSync(templatePath, 'utf8');
if(!html.includes('/* @STYLE */') || !html.includes('/* @SCRIPT */')) throw new Error('模板缺少构建占位符');
html = html.replace('/* @STYLE */', () => css.trimEnd()).replace('/* @SCRIPT */', () => js.trimEnd());
fs.writeFileSync(outputPath, html, 'utf8');
console.log('built ' + outputPath);
`;
fs.writeFileSync(path.join(here, 'build.mjs'), buildText, 'utf8');

const readme = `# AI小说生成器 9.0 细分源码\n\n这是从 \`AI小说生成器8.9源码\` 独立复制出的 9.0 更细粒度维护版本。它与原 8.9 源码目录分开维护，不会自动合并回原目录。\n\n## 目录结构\n\n- \`runtime/\`：运行状态、DeepSeek 定价、会话统计\n- \`roleplay/\`、\`rules/\`：角色试演和 AI 味规则层\n- \`api/\`、\`library/\`：API、回滚和四类素材库\n- \`graph/\`、\`generation/\`：关系图、上下文、检测、生成、续写\n- \`editor/\`、\`backup/\`：编辑器、备份、完整导入和安卓恢复\n- \`banter/\`、\`precision/\`、\`tags/\`、\`layout/\`、\`bindings/\`、\`app/\`：其他界面功能和初始化\n\n各片段仍运行在同一个 DOMContentLoaded 作用域内，因此不依赖 ES Module，也不影响双击打开单文件 HTML。文件边界只按职责和安全的顶层边界划分，构建顺序由 \`build-manifest.json\` 固定。\n\n## HTML 适配修复\n\n9.0 HTML 包含 HTML 版适配和版本元数据更新：吐槽入口改用 HTML 已有的同步保存函数 \`ensureCurrentChapterSaved()\`，移除了原源码中误调用的 EXE 专用函数 \`ensureCurrentChapterSavedAndCommitted()\`。这项修复只写入本目录，原 8.9 源码保持不变。\n\n## 构建\n\n在项目根目录执行：\n\n~~~powershell\nnode .\\AI小说生成器9.0细分源码\\build.mjs\n~~~\n\n默认输出：\`AI小说生成器9.0.html\`。也可以指定输出路径：\n\n~~~powershell\nnode .\\AI小说生成器9.0细分源码\\build.mjs .\\AI小说生成器9.0.html\n~~~\n\n## 核对\n\n重新拆分时执行：\n\n~~~powershell\nnode .\\AI小说生成器9.0细分源码\\split-source.mjs\n~~~\n\n脚本会从现有 \`AI小说生成器8.9源码\\js\` 重新生成本目录，并写入每个片段对应的源文件和行号范围。构建后应执行：\n\n1. \`node .\\AI小说生成器9.0细分源码\\verify.mjs\`；\n2. 确认 68 个模块的来源映射完整；\n3. 确认拼接后的 JavaScript 通过 \`node --check\`；\n4. 继续运行现有 HTML 测试夹具。\n`;
fs.writeFileSync(path.join(here, 'README.md'), readme, 'utf8');

console.log(`split ${sourceMap.length} modules from ${groups.length} source files`);
