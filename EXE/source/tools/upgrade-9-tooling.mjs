import fs from 'node:fs';

const files = [
  'tests/validate-build.mjs',
  'tests/feature-compare.mjs',
  'tests/headless-smoke.cjs',
  'tests/snapshot-restore-smoke.cjs',
  'tests/large-idb-smoke.cjs',
  'tests/electron-ipc-smoke.cjs',
  'tests/electron-ui-smoke.cjs'
];
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  source = source
    .replaceAll('web-source\\AI小说生成器8.9源码', 'web-source\\AI小说生成器9.0源码')
    .replaceAll('web-source/AI小说生成器8.9源码', 'web-source/AI小说生成器9.0源码')
    .replaceAll('AI小说生成器8.9-review.html', 'AI小说生成器9.0-review.html')
    .replaceAll('AI小说生成器8.9-IDB独立版', 'AI小说生成器9.0-IDB独立版')
    .replaceAll('8.9-idb', '9.0-idb')
    .replaceAll("version: '8.9'", "version: '9.0'")
    .replaceAll('由 8.9 新入口替代', '由 9.0 新入口替代');
  fs.writeFileSync(file, source, 'utf8');
}
let packageJson = fs.readFileSync('package.json', 'utf8');
packageJson = packageJson.replaceAll('ai-novel-generator-8.9-exe-idb', 'ai-novel-generator-9.0-exe-idb');
fs.writeFileSync('package.json', packageJson, 'utf8');
console.log('upgraded test/build tooling to 9.0');
