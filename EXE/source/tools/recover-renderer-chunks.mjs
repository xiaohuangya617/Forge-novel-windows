import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const sourceRoot = path.resolve(projectRoot, '..', 'AI小说生成器8.9源码');
const rendererRoot = path.join(projectRoot, 'web-source', 'AI小说生成器9.0源码');
const artifactPath = path.join(projectRoot, 'electron', 'resources', 'app', 'index.html');
const manifestPath = path.join(rendererRoot, 'build-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const orderedMap = manifest.scriptFiles.map(file => manifest.sourceMap.find(item => item.file === file));
if(orderedMap.some(item => !item)) throw new Error('build-manifest 缺少 scriptFiles 对应的来源映射');
const html = fs.readFileSync(artifactPath, 'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>', scriptStart + 8);
if(scriptStart < 0 || scriptEnd < 0) throw new Error('9.0 HTML 构建产物缺少主脚本');
const script = html.slice(scriptStart + '<script>'.length, scriptEnd);

const adapterAnchors = new Map([
  ['storage/05-indexeddb-storage.js', '// ======================== IndexedDB 存储层（9.0-EXE-IDB） ========================'],
  ['ui/08-dialogs.js', '// ======================== 8.9 统一应用内弹窗 ========================']
]);
const sourceCache = new Map();
function sourceText(relative) {
  if(!sourceCache.has(relative)) sourceCache.set(relative, fs.readFileSync(path.join(sourceRoot, relative), 'utf8'));
  return sourceCache.get(relative);
}
function anchorFor(item) {
  if(adapterAnchors.has(item.file)) return adapterAnchors.get(item.file);
  const lines = sourceText(item.source).split(String.fromCharCode(10)).map(line => line.replace(/\r$/, ''));
  const anchor = lines[item.startLine - 1];
  if(!anchor) throw new Error(`无法读取模块起始行：${item.file}`);
  return anchor;
}

const starts = [];
let cursor = 0;
for(const item of orderedMap) {
  const anchor = anchorFor(item);
  const functionAnchor = anchor.match(/function\s+[A-Za-z_$][\w$]*\s*\(/)?.[0] || '';
  const candidates = [anchor, anchor.slice(0, 160), anchor.slice(0, 100), anchor.slice(0, 60), anchor.slice(0, 36), functionAnchor].filter((value, index, list) => value && list.indexOf(value) === index);
  const pos = candidates.reduce((found, candidate) => found >= 0 ? found : script.indexOf(candidate, cursor), -1);
  if(pos < 0) throw new Error(`无法在 9.0 HTML 中定位模块：${item.file}\n锚点：${JSON.stringify(anchor.slice(0, 120))}\n脚本前缀：${JSON.stringify(script.slice(0, 120))}\n无游标位置：${script.indexOf(anchor)}`);
  starts.push(pos);
  cursor = pos + anchor.length;
}

const jsRoot = path.join(rendererRoot, 'js');
fs.rmSync(jsRoot, { recursive: true, force: true });
fs.mkdirSync(jsRoot, { recursive: true });
const chunks = [];
for(let i = 0; i < orderedMap.length; i++) {
  const item = orderedMap[i];
  const next = i + 1 < starts.length ? starts[i + 1] : script.length;
  let content = script.slice(starts[i], next);
  if(i + 1 < starts.length && orderedMap[i + 1].source !== item.source && content.endsWith('\n')) content = content.slice(0, -1);
  if(i + 1 === starts.length) content = content.trimEnd();
  const target = path.join(jsRoot, item.file.replaceAll('/', path.sep));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  chunks.push({ file: item.file, content });
}

let rebuilt = '';
const sourceOf = new Map(orderedMap.map(item => [item.file, item.source]));
for(let i = 0; i < chunks.length; i++) {
  if(i > 0 && sourceOf.get(chunks[i].file) !== sourceOf.get(chunks[i - 1].file)) rebuilt += '\n';
  rebuilt += chunks[i].content;
}
const expected = script.slice(starts[0]).trimEnd();
if(rebuilt !== expected) {
  let index = 0;
  while(index < rebuilt.length && rebuilt[index] === expected[index]) index++;
  throw new Error(`分块恢复后无法精确重建 HTML 脚本，差异位置 ${index}`);
}
console.log(`recovered ${chunks.length} renderer modules from ${artifactPath}`);
