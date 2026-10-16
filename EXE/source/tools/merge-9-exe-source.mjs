import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const targetRoot = path.join(projectRoot, 'web-source', 'AI小说生成器9.0源码');
const base89Root = path.resolve(projectRoot, '..', 'AI小说生成器8.9源码');
const idb89Root = path.resolve(projectRoot, '..', 'AI小说生成器8.9-EXE-IDB独立项目', 'web-source', 'AI小说生成器8.9源码');
const workRoot = path.join(projectRoot, 'tests', '_tmp', 'merge-9');

const manifest = JSON.parse(fs.readFileSync(path.join(targetRoot, 'build-manifest.json'), 'utf8'));
const sourceFiles = [...new Set(manifest.sourceMap.map(item => item.source))];
const bySource = new Map();
for (const item of manifest.sourceMap) {
  if (!bySource.has(item.source)) bySource.set(item.source, []);
  bySource.get(item.source).push(item);
}

function p(root, rel) { return path.join(root, rel.replaceAll('/', path.sep)); }
function read(root, rel) { return fs.readFileSync(p(root, rel), 'utf8'); }
function write(root, rel, text) {
  const file = p(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}
function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
function runDiffPatch(original, modified, target) {
  const args = ['diff', '--no-index', '--unified=3', '--no-prefix', '--', original, modified];
  let patch = '';
  try { patch = execFileSync('git', args, { encoding: 'utf8' }); }
  catch (err) { if (err.status !== 1) throw err; patch = String(err.stdout || ''); }
  if (!patch.trim()) return false;
  const originalHeader = original.replaceAll('\\', '/');
  const modifiedHeader = modified.replaceAll('\\', '/');
  const targetHeader = target.replaceAll('\\', '/');
  patch = patch.replaceAll(originalHeader, targetHeader).replaceAll(modifiedHeader, targetHeader);
  const patchFile = path.join(workRoot, 'current.patch');
  fs.writeFileSync(patchFile, patch, 'utf8');
  try {
    execFileSync('git', ['apply', '-p0', '--unsafe-paths', '--whitespace=nowarn', patchFile], { stdio: 'pipe' });
  } catch (err) {
    const detail = String(err.stderr || err.stdout || err.message || '');
    throw new Error(`无法把 8.9 EXE 适配补丁合并到 ${target}: ${detail}`);
  }
  return true;
}

fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(workRoot, { recursive: true });

// 将 9.0 的 68 个片段按 sourceMap 恢复为 10 个连续源码文件。
// 这样可以把已验证的 8.9 IndexedDB/Electron 改动按文本补丁合并，再按原边界切回 9.0 片段。
for (const source of sourceFiles) {
  const pieces = bySource.get(source);
  write(workRoot, `canonical/${source}`, pieces.map(item => read(targetRoot, `js/${item.file}`)).join(''));
  copyFile(p(base89Root, source), p(workRoot, `original/${source}`));
  copyFile(p(idb89Root, source), p(workRoot, `idb/${source}`));
}

for (const source of sourceFiles) {
  const original = p(workRoot, `original/${source}`);
  const modified = p(workRoot, `idb/${source}`);
  const target = p(workRoot, `canonical/${source}`);
  runDiffPatch(original, modified, target);
}

// 按 9.0 的原始切片起点顺序重新写回细分目录。
for (const source of sourceFiles) {
  const pieces = bySource.get(source);
  const merged = read(workRoot, `canonical/${source}`);
  let cursor = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const originalPiece = read(targetRoot, `js/${piece.file}`);
    const firstLine = originalPiece.split(/\r?\n/, 1)[0];
    let start = merged.indexOf(firstLine, cursor);
    if (start < 0) throw new Error(`无法定位 9.0 片段起点：${piece.file} / ${firstLine}`);
    if (i === 0 && start !== 0) throw new Error(`首片段不是从文件起点开始：${piece.file}`);
    const next = pieces[i + 1];
    let end = merged.length;
    if (next) {
      const nextOriginal = read(targetRoot, `js/${next.file}`);
      const nextFirstLine = nextOriginal.split(/\r?\n/, 1)[0];
      end = merged.indexOf(nextFirstLine, start + firstLine.length);
      if (end < 0) throw new Error(`无法定位 9.0 片段终点：${piece.file} -> ${next.file}`);
    }
    write(targetRoot, `js/${piece.file}`, merged.slice(start, end));
    cursor = end;
  }
}

// IndexedDB 存储和 Electron 应用内弹窗是 EXE 适配层，插入共享业务片段之前。
copyFile(p(idb89Root, 'js/05-indexeddb-storage.js'), p(targetRoot, 'js/storage/05-indexeddb-storage.js'));
copyFile(p(idb89Root, 'js/08-dialogs.js'), p(targetRoot, 'js/ui/08-dialogs.js'));

const nextFiles = [];
for (const file of manifest.scriptFiles) {
  if (file === 'roleplay/10-roleplay.js') {
    nextFiles.push('storage/05-indexeddb-storage.js', 'ui/08-dialogs.js');
  }
  nextFiles.push(file);
}
manifest.version = '9.0';
manifest.product = 'exe-idb';
manifest.scriptFiles = nextFiles;
manifest.sourceMap = manifest.sourceMap.map(item => ({ ...item }));
manifest.sourceMap.unshift(
  { file: 'storage/05-indexeddb-storage.js', source: 'adapter/05-indexeddb-storage.js', startLine: 1, endLine: read(targetRoot, 'js/storage/05-indexeddb-storage.js').split(/\r?\n/).length },
  { file: 'ui/08-dialogs.js', source: 'adapter/08-dialogs.js', startLine: 1, endLine: read(targetRoot, 'js/ui/08-dialogs.js').split(/\r?\n/).length }
);
manifest.htmlPatches = [];
fs.writeFileSync(path.join(targetRoot, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`merged 9.0 renderer: ${manifest.scriptFiles.length} script files`);
