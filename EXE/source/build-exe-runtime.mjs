import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceExeRoot = path.resolve(process.env.AI_NOVEL_SOURCE_EXE || 'E:/deepseek/AI小说生成器8.6终极版/EXE版');
const outputRoot = path.join(projectRoot, 'dist', 'AI小说生成器9.0-IDB独立版');
const sourceExePath = path.join(sourceExeRoot, 'AI小说生成器.exe');
const outputExePath = path.join(outputRoot, 'AI小说生成器9.0-IDB独立版.exe');
const appSource = path.join(projectRoot, 'electron', 'resources', 'app');
const appOutput = path.join(outputRoot, 'resources', 'app');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function copyEntry(source, target) {
  const stat = fs.lstatSync(source);
  if(stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for(const child of fs.readdirSync(source)) copyEntry(path.join(source, child), path.join(target, child));
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

if(!fs.existsSync(sourceExePath)) throw new Error(`找不到原始 Electron 运行时：${sourceExePath}`);
if(fs.existsSync(outputRoot)) fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for(const entry of fs.readdirSync(sourceExeRoot, { withFileTypes: true })) {
  if(entry.name === 'userData' || entry.name === 'resources') continue;
  copyEntry(path.join(sourceExeRoot, entry.name), path.join(outputRoot, entry.name));
}
copyEntry(path.join(sourceExeRoot, 'resources'), path.join(outputRoot, 'resources'));
fs.rmSync(appOutput, { recursive: true, force: true });
copyEntry(appSource, appOutput);

// 图标与字体属于 Electron 运行时资源，不进入 renderer 业务主线；只从旧运行时提取公开静态资源。
const sourceApp = path.join(sourceExeRoot, 'resources', 'app');
for(const name of ['assets', 'build']) {
  const source = path.join(sourceApp, name);
  const target = path.join(appOutput, name);
  if(fs.existsSync(source) && !fs.existsSync(target)) copyEntry(source, target);
}

fs.renameSync(path.join(outputRoot, 'AI小说生成器.exe'), outputExePath);
const manifest = {
  productVersion: '9.0-idb',
  builtAt: new Date().toISOString(),
  sourceRuntime: sourceExeRoot,
  sourceExeSha256: sha256(sourceExePath),
  outputExeSha256: sha256(outputExePath),
  outputExeBytes: fs.statSync(outputExePath).size,
  rendererSha256: sha256(path.join(appOutput, 'index.html')),
  excludes: ['userData']
};
fs.writeFileSync(path.join(outputRoot, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`独立 EXE 运行目录已生成：${outputRoot}`);
console.log(`EXE：${outputExePath}`);
console.log(`SHA-256：${manifest.outputExeSha256}`);
