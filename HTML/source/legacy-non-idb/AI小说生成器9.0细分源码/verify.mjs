import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..', 'AI小说生成器8.9源码');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'build-manifest.json'), 'utf8'));
const sourceMap = manifest.sourceMap || [];
const fail = message => { throw new Error(message); };
const patches = manifest.htmlPatches || [];
const applyPatches = (file, text) => {
  let out = text;
  for(const patch of patches) {
    if(patch.file !== file) continue;
    if(!out.includes(patch.from)) fail('HTML 适配补丁未命中来源：' + file);
    out = out.replace(patch.from, patch.to);
  }
  return out;
};
const applyPatchesForSource = (source, text) => {
  let out = text;
  for(const patch of patches) {
    const owner = sourceMap.find(item => item.file === patch.file)?.source;
    if(owner !== source) continue;
    if(!out.includes(patch.from)) fail('源码版本补丁未命中来源：' + source);
    out = out.replace(patch.from, patch.to);
  }
  return out;
};

if(!manifest.scriptFiles.length || manifest.scriptFiles.length !== sourceMap.length) fail('构建清单与来源映射数量不一致');
if(new Set(manifest.scriptFiles).size !== manifest.scriptFiles.length) fail('构建清单存在重复模块');
if(new Set(sourceMap.map(item => item.file)).size !== sourceMap.length) fail('来源映射存在重复模块');

const chunksBySource = new Map();
for(const item of sourceMap) {
  const modulePath = path.join(here, 'js', item.file);
  if(!fs.existsSync(modulePath)) fail('缺少模块：' + item.file);
  const text = fs.readFileSync(modulePath, 'utf8');
  if(!chunksBySource.has(item.source)) chunksBySource.set(item.source, []);
  chunksBySource.get(item.source).push(text);
}

const sourceFiles = [...new Set(sourceMap.map(item => item.source))];
for(const relativeSource of sourceFiles) {
  const expected = fs.readFileSync(path.join(sourceRoot, relativeSource), 'utf8');
  const actual = (chunksBySource.get(relativeSource) || []).join('');
  const patchedExpected = applyPatchesForSource(relativeSource, expected);
  if(actual !== patchedExpected) fail('源码拆分拼接不一致：' + relativeSource);
}

const sourceOf = new Map(sourceMap.map(item => [item.file, item.source]));
let combined = '';
manifest.scriptFiles.forEach((file, index) => {
  if(index > 0 && sourceOf.get(file) !== sourceOf.get(manifest.scriptFiles[index - 1])) combined += '\n';
  combined += fs.readFileSync(path.join(here, 'js', file), 'utf8');
});
const oldManifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'build-manifest.json'), 'utf8'));
let oldCombined = '';
oldManifest.scriptFiles.forEach((file, index) => {
  if(index) oldCombined += '\n';
  oldCombined += applyPatchesForSource('js/' + file, fs.readFileSync(path.join(sourceRoot, 'js', file), 'utf8'));
});
if(combined.replaceAll('\r\n', '\n') !== oldCombined.replaceAll('\r\n', '\n')) fail('构建顺序拼接结果不一致');

const tempPath = path.join(os.tmpdir(), `novel-writer-9.0-${process.pid}.js`);
fs.writeFileSync(tempPath, combined, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tempPath], { stdio: 'pipe' });
} finally {
  try { fs.unlinkSync(tempPath); } catch {}
}

const template = fs.readFileSync(path.join(here, 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(here, 'styles.css'), 'utf8');
const expectedHtml = template.replace('/* @STYLE */', () => css.trimEnd()).replace('/* @SCRIPT */', () => combined.trimEnd());
const outputPath = path.resolve(here, '..', 'AI小说生成器9.0.html');
if(!fs.existsSync(outputPath)) fail('缺少构建产物：' + outputPath);
if(fs.readFileSync(outputPath, 'utf8') !== expectedHtml) fail('构建产物与当前模板、源码不一致');

console.log(`verified ${manifest.scriptFiles.length} modules`);
console.log('source chunks: exact');
console.log('combined JavaScript: exact and node --check passed');
console.log('built HTML: exact');
