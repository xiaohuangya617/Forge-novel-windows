import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'build-manifest.json'), 'utf8'));
const sourceMap = manifest.sourceMap || [];
const fail = message => { throw new Error(message); };
const sourceOf = new Map(sourceMap.map(item => [item.file, item.source]));

if(!manifest.scriptFiles.length || manifest.scriptFiles.length !== sourceMap.length) fail('构建清单与来源映射数量不一致');
if(new Set(manifest.scriptFiles).size !== manifest.scriptFiles.length) fail('构建清单存在重复模块');
if(new Set(sourceMap.map(item => item.file)).size !== sourceMap.length) fail('来源映射存在重复模块');

let combined = '';
for(let i = 0; i < manifest.scriptFiles.length; i++) {
  const file = manifest.scriptFiles[i];
  const modulePath = path.join(here, 'js', file);
  if(!fs.existsSync(modulePath)) fail('缺少模块：' + file);
  if(!sourceOf.has(file)) fail('缺少模块来源映射：' + file);
  if(i > 0 && sourceOf.get(file) !== sourceOf.get(manifest.scriptFiles[i - 1])) combined += '\n';
  combined += fs.readFileSync(modulePath, 'utf8');
}

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
console.log('module mapping: exact');
console.log('combined JavaScript: exact and node --check passed');
console.log('built HTML: exact');
