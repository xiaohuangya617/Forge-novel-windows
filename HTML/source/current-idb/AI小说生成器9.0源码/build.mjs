import fs from 'node:fs';
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
  if(index > 0 && sourceOf.get(file) !== sourceOf.get(manifest.scriptFiles[index - 1])) js += '\n';
  js += fs.readFileSync(path.join(here, 'js', file), 'utf8');
});
let html = fs.readFileSync(templatePath, 'utf8');
if(!html.includes('/* @STYLE */') || !html.includes('/* @SCRIPT */')) throw new Error('模板缺少构建占位符');
html = html.replace('/* @STYLE */', () => css.trimEnd()).replace('/* @SCRIPT */', () => js.trimEnd());
fs.writeFileSync(outputPath, html, 'utf8');
console.log('built ' + outputPath);
