import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(projectRoot, 'web-source', 'AI小说生成器9.0源码');
const oldRoot = path.resolve(projectRoot, '..', 'AI小说生成器8.9-EXE-IDB独立项目');
const oldSource = path.join(oldRoot, 'web-source', 'AI小说生成器8.9源码');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, value) { fs.writeFileSync(p, value.replace(/\r\n/g, '\n'), 'utf8'); }
function must(value, label) { if (!value) throw new Error(`missing anchor: ${label}`); return value; }

// 1) IndexedDB 模式显示真实浏览器配额；仅在 HTML fallback 时显示旧 localStorage 5MB 警告。
const oldStorage = read(path.join(oldSource, 'js', '10-roleplay-rules-storage.js'));
const capacityStart = oldStorage.indexOf('    const MAX_STORAGE_MB = 5;');
const capacityEnd = oldStorage.indexOf('    let lastSaveErrorShown = false;', capacityStart);
must(capacityStart >= 0 && capacityEnd > capacityStart, 'capacity block');
write(path.join(srcRoot, 'js', 'storage', '16-capacity.js'), oldStorage.slice(capacityStart, capacityEnd).trimEnd() + '\n');

// 2) 把已验证的 IDB saveAll 分支移入细分 archive 文件，并保留同步兼容返回值。
const oldSaveStart = oldStorage.indexOf('    function saveAll() {');
const oldSaveEnd = oldStorage.indexOf('    // v5.8：非正文操作', oldSaveStart);
must(oldSaveStart >= 0 && oldSaveEnd > oldSaveStart, 'IDB saveAll block');
const idbSaveBlock = oldStorage.slice(oldSaveStart, oldSaveEnd).trimEnd();
const archivePath = path.join(srcRoot, 'js', 'storage', '17-archive.js');
let archive = read(archivePath);
const saveStart = archive.indexOf('    function saveAll() {');
must(saveStart >= 0, 'archive saveAll');
const saveEnd = archive.indexOf('    // v5.8：非正文操作', saveStart);
must(saveEnd > saveStart, 'archive saveAll end');
archive = archive.slice(0, saveStart) + idbSaveBlock + '\n' + archive.slice(saveEnd);
archive = archive.replace(
  '    function writeArchiveSnapshot(force) {\n',
  '    function writeArchiveSnapshot(force) {\n        if(novelStoragePrimary) return false; // 9.0-EXE-IDB：正文已迁入 IndexedDB，不再复制完整运行态回 localStorage 增量链\n'
);
const persistAnchor = '    function persistOrWarn() {';
const persistStart = archive.indexOf(persistAnchor);
must(persistStart >= 0, 'persistOrWarn');
const persistEnd = archive.indexOf('\n    }', persistStart) + '\n    }'.length;
must(persistEnd > persistStart, 'persistOrWarn end');
const asyncBoundary = `

    // 异步边界：同步兼容入口只代表写入已排队；关键流程必须等待实际事务提交。
    async function persistOrWarnAsync() {
        const ok = persistOrWarn();
        if(!ok) return false;
        const committed = await awaitNovelPersistence();
        if(!committed) {
            const sp = $('saveStatus'); if(sp) sp.innerText = '保存失败';
            if(typeof toast === 'function') toast('保存失败，请检查存储空间或先导出备份');
        }
        return committed;
    }
`;
archive = archive.slice(0, persistEnd) + asyncBoundary + archive.slice(persistEnd);
write(archivePath, archive);

// 3) 以已验证的异步启动链替换 HTML 版同步 init；resetAll 的 9.0 状态清理位于独立 app/90 文件中并保留。
const oldDistIndex = path.join(oldRoot, 'electron', 'resources', 'app', 'index.html');
const oldHtml = read(oldDistIndex);
const initStart = oldHtml.indexOf('    async function init() {');
const initEnd = oldHtml.indexOf('\n</script>', initStart);
must(initStart >= 0 && initEnd > initStart, 'async init block');
const initBlock = oldHtml.slice(initStart, initEnd).trimEnd();
const initPath = path.join(srcRoot, 'js', 'app', '92-init.js');
let currentInit = read(initPath);
const currentStart = currentInit.indexOf('    function init() {');
must(currentStart >= 0, 'current init block');
// 当前片段末尾包含原始 DOMContentLoaded 的闭合 `});`，新 block 自带 boot 与闭合。
currentInit = currentInit.slice(0, currentStart) + initBlock + '\n';
write(initPath, currentInit);

// 4) 快照 envelope 的版本升级到 9.0，避免 8.9 兼容标记污染新构建。
const storagePath = path.join(srcRoot, 'js', 'storage', '05-indexeddb-storage.js');
let storage = read(storagePath).replace(/IndexedDB 存储层（8\.9-EXE-IDB）/g, 'IndexedDB 存储层（9.0-EXE-IDB）');
storage = storage.replace(/productVersion:\s*'8\.9-idb'/g, "productVersion: '9.0-idb'");
write(storagePath, storage);

console.log('completed 9.0 storage/init merge');
