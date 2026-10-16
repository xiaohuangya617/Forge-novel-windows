import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const sourceRoot = path.join(projectRoot, 'web-source', 'AI小说生成器9.0源码');
const buildScript = path.join(sourceRoot, 'build.mjs');
const tmpRoot = path.join(here, '_tmp');
const outputPath = path.join(tmpRoot, 'AI小说生成器9.0-review.html');

fs.mkdirSync(tmpRoot, { recursive: true });
try {
  execFileSync(process.execPath, [buildScript, outputPath], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  const html = fs.readFileSync(outputPath, 'utf8');
  const byteLength = Buffer.byteLength(html, 'utf8');
  assert.ok(byteLength > 100000, '构建产物异常过小');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(script => script.trim());
  assert.equal(scripts.length, 1, '应有一个非空内联业务脚本');
  new vm.Script(scripts[0], { filename: outputPath });
  assert.match(html, /AI小说生成器/);
  console.log(`build validation passed: ${outputPath} (${byteLength} bytes, ${html.length} UTF-16 code units)`);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

