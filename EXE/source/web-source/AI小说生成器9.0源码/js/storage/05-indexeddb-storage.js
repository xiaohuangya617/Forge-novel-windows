// ======================== IndexedDB 存储层（9.0-EXE-IDB） ========================
// 本文件位于运行时状态声明之后、业务脚本之前。构建脚本会把所有片段拼进同一个
// DOMContentLoaded 作用域，因此这里可以安全地提供给 saveAll/init/备份链路使用的仓库。
// 约束：IndexedDB 是唯一的大数据主存储；localStorage 只作为兼容迁移来源和轻量设置缓存。

    const NOVEL_IDB_NAME = 'ai_novel_generator_v1';
    const NOVEL_IDB_VERSION = 1;
    const NOVEL_IDB_INDEX_KEY = 'runtimeIndex_v1';
    let novelStoragePrimary = false;
    let novelStorageOpenError = null;
    // saveAll 保留旧版同步返回值，但所有 IndexedDB 写入都汇总到这个尾 promise。
    // 需要切书/切章/导入/关闭前确认提交时，只等待这个边界，避免把“已入队”误当作“已落盘”。
    let lastNovelPersistencePromise = Promise.resolve(true);
    let novelElectronSnapshotTimer = null;
    let novelElectronSnapshotInFlight = false;
    let novelElectronSnapshotQueued = false;

    function novelStorageClone(value) {
        if(value === undefined) return undefined;
        try { return JSON.parse(JSON.stringify(value)); } catch(e) { throw new Error('数据无法序列化：' + (e && e.message || e)); }
    }
    function novelStorageKey(bookId, itemId) { return String(bookId) + '::' + String(itemId); }
    function novelStorageReq(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败'));
        });
    }
    function novelStorageTxDone(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error('IndexedDB 事务失败'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB 事务已中止'));
        });
    }

    const novelStore = (() => {
        let db = null;
        let openPromise = null;
        let writeTail = Promise.resolve();
        let runtimeIndex = { bookIds: [], chapterKeys: [], characterKeys: [], chatKeys: [] };
        let runtimeUpdatedAt = 0;

        function onUpgrade(event) {
            const dbRef = event.target.result;
            if(!dbRef.objectStoreNames.contains('books')) dbRef.createObjectStore('books', { keyPath: 'id' });
            if(!dbRef.objectStoreNames.contains('chapters')) {
                const store = dbRef.createObjectStore('chapters', { keyPath: 'key' });
                store.createIndex('byBookId', 'bookId', { unique: false });
            }
            if(!dbRef.objectStoreNames.contains('characters')) {
                const store = dbRef.createObjectStore('characters', { keyPath: 'key' });
                store.createIndex('byBookId', 'bookId', { unique: false });
            }
            if(!dbRef.objectStoreNames.contains('chatMessages')) {
                const store = dbRef.createObjectStore('chatMessages', { keyPath: 'key' });
                store.createIndex('byBookId', 'bookId', { unique: false });
            }
            if(!dbRef.objectStoreNames.contains('collections')) dbRef.createObjectStore('collections', { keyPath: 'key' });
            if(!dbRef.objectStoreNames.contains('storageMeta')) dbRef.createObjectStore('storageMeta', { keyPath: 'key' });
        }
        function open() {
            if(openPromise) return openPromise;
            if(typeof indexedDB === 'undefined') {
                novelStorageOpenError = new Error('当前运行环境不支持 IndexedDB');
                return Promise.resolve(false);
            }
            openPromise = new Promise((resolve) => {
                let request;
                try { request = indexedDB.open(NOVEL_IDB_NAME, NOVEL_IDB_VERSION); }
                catch(err) { novelStorageOpenError = err; resolve(false); return; }
                request.onupgradeneeded = onUpgrade;
                request.onsuccess = async () => {
                    db = request.result;
                    db.onversionchange = () => { try { db.close(); } catch(_) {} };
                    try {
                        const tx = db.transaction(['storageMeta'], 'readonly');
                        const done = novelStorageTxDone(tx).catch(() => {});
                        const saved = await novelStorageReq(tx.objectStore('storageMeta').get(NOVEL_IDB_INDEX_KEY));
                        await done;
                        if(saved && saved.value) runtimeIndex = saved.value;
                        if(saved && Number.isFinite(Number(saved.updatedAt))) runtimeUpdatedAt = Number(saved.updatedAt);
                    } catch(_) { runtimeIndex = { bookIds: [], chapterKeys: [], characterKeys: [], chatKeys: [] }; }
                    resolve(true);
                };
                request.onerror = () => { novelStorageOpenError = request.error || new Error('IndexedDB 打开失败'); resolve(false); };
                request.onblocked = () => { novelStorageOpenError = new Error('IndexedDB 被其他页面占用'); };
            });
            return openPromise;
        }
        async function load() {
            if(!db && !(await open())) return null;
            const tx = db.transaction(['books','chapters','characters','chatMessages','collections'], 'readonly');
            const done = novelStorageTxDone(tx);
            const [bookRows, chapterRows, characterRows, chatRows, collectionRows] = await Promise.all([
                novelStorageReq(tx.objectStore('books').getAll()),
                novelStorageReq(tx.objectStore('chapters').getAll()),
                novelStorageReq(tx.objectStore('characters').getAll()),
                novelStorageReq(tx.objectStore('chatMessages').getAll()),
                novelStorageReq(tx.objectStore('collections').getAll())
            ]);
            await done;
            if(!bookRows.length && !chapterRows.length && !characterRows.length && !collectionRows.length) return null;
            const collections = {};
            collectionRows.forEach(row => { if(row && row.key) collections[row.key] = row.value; });
            const chapterMap = new Map();
            chapterRows.forEach(row => {
                if(!row || row.bookId == null) return;
                const list = chapterMap.get(String(row.bookId)) || [];
                const item = { ...row };
                delete item.key; delete item.bookId; delete item.order;
                if(item.id != null) item.id = String(item.id);
                list.push({ order: Number(row.order) || 0, item });
                chapterMap.set(String(row.bookId), list);
            });
            const characterMap = new Map();
            characterRows.forEach(row => {
                if(!row || row.bookId == null) return;
                const list = characterMap.get(String(row.bookId)) || [];
                const item = { ...row };
                delete item.key; delete item.bookId; delete item.order;
                if(item.id != null) item.id = String(item.id);
                list.push({ order: Number(row.order) || 0, item });
                characterMap.set(String(row.bookId), list);
            });
            const chatMap = new Map();
            chatRows.forEach(row => {
                if(!row || row.bookId == null) return;
                const list = chatMap.get(String(row.bookId)) || [];
                const item = { ...row };
                delete item.key; delete item.bookId; delete item.order;
                list.push({ order: Number(row.order) || 0, item });
                chatMap.set(String(row.bookId), list);
            });
            const books = bookRows.slice().sort((a,b) => (Number(a.order)||0) - (Number(b.order)||0)).map(row => {
                const book = { ...row };
                delete book.order;
                book.id = String(book.id);
                book.chapters = (chapterMap.get(book.id) || []).sort((a,b) => a.order-b.order).map(x => x.item);
                book.characters = (characterMap.get(book.id) || []).sort((a,b) => a.order-b.order).map(x => x.item);
                book.chatHistory = (chatMap.get(book.id) || []).sort((a,b) => a.order-b.order).map(x => x.item);
                if(!Array.isArray(book.forbiddenWords)) book.forbiddenWords = [];
                return book;
            });
            runtimeIndex = {
                bookIds: books.map(b => String(b.id)),
                chapterKeys: chapterRows.filter(x => x && x.key).map(x => String(x.key)),
                characterKeys: characterRows.filter(x => x && x.key).map(x => String(x.key)),
                chatKeys: chatRows.filter(x => x && x.key).map(x => String(x.key))
            };
            return {
                books,
                currentBookId: collections.currentBookId == null ? null : String(collections.currentBookId),
                globalCharacters: Array.isArray(collections.globalCharacters) ? collections.globalCharacters : [],
                globalActions: Array.isArray(collections.globalActions) ? collections.globalActions : [],
                globalCostumes: Array.isArray(collections.globalCostumes) ? collections.globalCostumes : []
            };
        }
        async function putRuntime(runtime) {
            if(!db && !(await open())) throw novelStorageOpenError || new Error('IndexedDB 未就绪');
            const state = runtime || {};
            const books = Array.isArray(state.books) ? state.books : [];
            const nextIndex = { bookIds: [], chapterKeys: [], characterKeys: [], chatKeys: [] };
            const tx = db.transaction(['books','chapters','characters','chatMessages','collections','storageMeta'], 'readwrite');
            const bookStore = tx.objectStore('books');
            const chapterStore = tx.objectStore('chapters');
            const characterStore = tx.objectStore('characters');
            const chatStore = tx.objectStore('chatMessages');
            const collectionsStore = tx.objectStore('collections');
            const metaStore = tx.objectStore('storageMeta');
            const done = novelStorageTxDone(tx);
            const old = runtimeIndex || { bookIds: [], chapterKeys: [], characterKeys: [], chatKeys: [] };
            const nextBookSet = new Set();
            const nextChapterSet = new Set();
            const nextCharacterSet = new Set();
            const nextChatSet = new Set();
            books.forEach((sourceBook, bookOrder) => {
                const book = novelStorageClone(sourceBook) || {};
                const bookId = String(book.id || ('book-' + Date.now() + '-' + bookOrder));
                book.id = bookId;
                delete book.chapters; delete book.characters; delete book.chatHistory; delete book.order;
                bookStore.put({ ...book, id: bookId, order: bookOrder });
                nextBookSet.add(bookId); nextIndex.bookIds.push(bookId);
                (Array.isArray(sourceBook.chapters) ? sourceBook.chapters : []).forEach((sourceChapter, order) => {
                    const chapter = novelStorageClone(sourceChapter) || {};
                    const chapterId = String(chapter.id || ('chapter-' + order));
                    const key = novelStorageKey(bookId, chapterId);
                    chapter.id = chapterId; chapter.key = key; chapter.bookId = bookId; chapter.order = order;
                    chapterStore.put(chapter); nextChapterSet.add(key); nextIndex.chapterKeys.push(key);
                });
                (Array.isArray(sourceBook.characters) ? sourceBook.characters : []).forEach((sourceCharacter, order) => {
                    const character = novelStorageClone(sourceCharacter) || {};
                    const characterId = String(character.id || ('character-' + order));
                    const key = novelStorageKey(bookId, characterId);
                    character.id = characterId; character.key = key; character.bookId = bookId; character.order = order;
                    characterStore.put(character); nextCharacterSet.add(key); nextIndex.characterKeys.push(key);
                });
                (Array.isArray(sourceBook.chatHistory) ? sourceBook.chatHistory : []).forEach((sourceMessage, order) => {
                    const message = novelStorageClone(sourceMessage) || {};
                    const key = novelStorageKey(bookId, order);
                    message.key = key; message.bookId = bookId; message.order = order;
                    chatStore.put(message); nextChatSet.add(key); nextIndex.chatKeys.push(key);
                });
            });
            old.bookIds.filter(id => !nextBookSet.has(String(id))).forEach(id => bookStore.delete(String(id)));
            old.chapterKeys.filter(key => !nextChapterSet.has(String(key))).forEach(key => chapterStore.delete(String(key)));
            old.characterKeys.filter(key => !nextCharacterSet.has(String(key))).forEach(key => characterStore.delete(String(key)));
            old.chatKeys.filter(key => !nextChatSet.has(String(key))).forEach(key => chatStore.delete(String(key)));
            collectionsStore.put({ key: 'currentBookId', value: state.currentBookId == null ? null : String(state.currentBookId) });
            collectionsStore.put({ key: 'globalCharacters', value: novelStorageClone(state.globalCharacters || []) });
            collectionsStore.put({ key: 'globalActions', value: novelStorageClone(state.globalActions || []) });
            collectionsStore.put({ key: 'globalCostumes', value: novelStorageClone(state.globalCostumes || []) });
            const committedAt = Date.now();
            metaStore.put({ key: NOVEL_IDB_INDEX_KEY, value: nextIndex, schemaVersion: NOVEL_IDB_VERSION, updatedAt: committedAt });
            await done;
            runtimeIndex = nextIndex;
            runtimeUpdatedAt = committedAt;
            return true;
        }
        function enqueue(runtime) {
            const snapshot = novelStorageClone(runtime);
            writeTail = writeTail.catch(() => {}).then(() => putRuntime(snapshot));
            return writeTail;
        }
        function replace(runtime) {
            const snapshot = novelStorageClone(runtime);
            writeTail = writeTail.catch(() => {}).then(() => putRuntime(snapshot));
            return writeTail;
        }
        function clear() {
            writeTail = writeTail.catch(() => {}).then(async () => {
                if(!db && !(await open())) throw novelStorageOpenError || new Error('IndexedDB 未就绪');
                const tx = db.transaction(['books','chapters','characters','chatMessages','collections','storageMeta'], 'readwrite');
                const done = novelStorageTxDone(tx);
                ['books','chapters','characters','chatMessages','collections','storageMeta'].forEach(name => tx.objectStore(name).clear());
                await done;
                runtimeIndex = { bookIds: [], chapterKeys: [], characterKeys: [], chatKeys: [] };
                runtimeUpdatedAt = Date.now();
                return true;
            });
            return writeTail;
        }
        return {
            open,
            load,
            replace,
            enqueue,
            clear,
            get lastUpdatedAt() { return runtimeUpdatedAt; },
            get available() { return !!db; },
            get error() { return novelStorageOpenError; }
        };
    })();

    async function openNovelStorage() {
        const ok = await novelStore.open();
        if(ok) await restoreNovelElectronSnapshotIfNeeded();
        if(!ok && novelStore.error) console.warn('IndexedDB 不可用，将暂时使用旧存储：', novelStore.error.message || novelStore.error);
        return ok;
    }
    function buildNovelRuntimeState() {
        return {
            books: novelStorageClone(books || []),
            currentBookId: currentBookId == null ? null : String(currentBookId),
            globalCharacters: novelStorageClone(globalCharacters || []),
            globalActions: novelStorageClone(globalActions || []),
            globalCostumes: novelStorageClone(globalCostumes || [])
        };
    }
    function applyNovelRuntimeState(state) {
        if(!state || typeof state !== 'object') throw new Error('IndexedDB 运行态无效');
        books = Array.isArray(state.books) ? state.books.filter(b => b && typeof b === 'object') : [];
        books.forEach(book => {
            ['chapters','characters','chatHistory','forbiddenWords'].forEach(field => { if(!Array.isArray(book[field])) book[field] = []; });
            book.chapters = book.chapters.filter(x => x && typeof x === 'object');
            book.characters = book.characters.filter(x => x && typeof x === 'object');
            book.chatHistory = book.chatHistory.filter(x => x && typeof x === 'object');
            book.forbiddenWords = book.forbiddenWords.filter(x => x && typeof x === 'object');
            book.id = book.id == null ? uuid() : String(book.id);
            book.chapters.forEach(ch => { ch.id = ch.id == null ? uuid() : String(ch.id); if(!Array.isArray(ch.checkResult)) ch.checkResult = []; });
            book.characters.forEach(c => { if(c.id != null) c.id = String(c.id); });
            if(typeof migrateChapter === 'function') migrateChapter(book);
        });
        currentBookId = state.currentBookId == null ? null : String(state.currentBookId);
        globalCharacters = Array.isArray(state.globalCharacters) ? state.globalCharacters.filter(x => x && typeof x === 'object') : [];
        globalActions = Array.isArray(state.globalActions) ? state.globalActions.filter(x => x && typeof x === 'object') : [];
        globalCostumes = Array.isArray(state.globalCostumes) ? state.globalCostumes.filter(x => x && typeof x === 'object') : [];
        [globalCharacters, globalActions, globalCostumes].forEach(list => list.forEach(item => { if(item.id != null) item.id = String(item.id); }));
        if(!currentBookId || !books.some(book => book.id === currentBookId)) currentBookId = books[0]?.id || null;
    }
    function scheduleNovelRuntimeSave() {
        if(!novelStoragePrimary || !novelStore.available) return Promise.resolve(false);
        lastNovelPersistencePromise = novelStore.enqueue(buildNovelRuntimeState()).then(() => true).catch(err => {
            console.error('IndexedDB 保存失败', err);
            const msg = err && err.message ? err.message : String(err);
            if(typeof toast === 'function') toast('IndexedDB 保存失败：' + msg);
            return false;
        });
        return lastNovelPersistencePromise;
    }
    function awaitNovelPersistence() {
        return Promise.resolve(lastNovelPersistencePromise).then(ok => ok !== false);
    }
    async function persistNovelRuntimeCritical() {
        if(!novelStoragePrimary || !novelStore.available) return saveAll();
        try {
            localStorage.setItem('currentBookId_v2', currentBookId || '');
            localStorage.setItem('api_config_v3', JSON.stringify({ main: api, polish: polishApi, image: imageApiCfg, act: actApi }));
            lastNovelPersistencePromise = novelStore.enqueue(buildNovelRuntimeState()).then(() => true).catch(err => {
                console.error('关键 IndexedDB 提交失败', err);
                return false;
            });
            if(!await lastNovelPersistencePromise) return false;
            retireNovelLegacyPayload();
            scheduleNovelElectronSnapshot();
            return true;
        } catch(err) {
            console.error('关键 IndexedDB 提交失败', err);
            return false;
        }
    }
    function buildNovelElectronSnapshot() {
        return {
            schemaVersion: 2,
            productVersion: '9.0-idb',
            savedAt: Date.now(),
            runtime: buildNovelRuntimeState(),
            settings: {
                apiConfig: { main: api, polish: polishApi, image: imageApiCfg, act: actApi },
                scratchpadPages: novelStorageClone(scratchpadPages || [])
            }
        };
    }
    function persistNovelElectronSnapshotNow(sync) {
        if(!window.novelData) return Promise.resolve(false);
        const payload = buildNovelElectronSnapshot();
        try {
            if(sync && typeof window.novelData.saveSync === 'function') {
                const result = window.novelData.saveSync(payload);
                return Promise.resolve(!result || result.ok !== false);
            }
            if(typeof window.novelData.save === 'function') {
                return Promise.resolve(window.novelData.save(payload)).then(result => !result || result.ok !== false);
            }
        } catch(err) {
            console.warn('Electron 快照写入失败', err);
        }
        return Promise.resolve(false);
    }
    function scheduleNovelElectronSnapshot() {
        if(!window.novelData || typeof window.novelData.save !== 'function') return;
        novelElectronSnapshotQueued = true;
        if(novelElectronSnapshotTimer) clearTimeout(novelElectronSnapshotTimer);
        novelElectronSnapshotTimer = setTimeout(() => {
            novelElectronSnapshotTimer = null;
            if(novelElectronSnapshotInFlight || !novelElectronSnapshotQueued) return;
            novelElectronSnapshotQueued = false;
            novelElectronSnapshotInFlight = true;
            persistNovelElectronSnapshotNow(false).catch(() => false).finally(() => {
                novelElectronSnapshotInFlight = false;
                if(novelElectronSnapshotQueued) scheduleNovelElectronSnapshot();
            });
        }, 1500);
    }
    function flushNovelElectronSnapshotSync() {
        if(novelElectronSnapshotTimer) { clearTimeout(novelElectronSnapshotTimer); novelElectronSnapshotTimer = null; }
        novelElectronSnapshotQueued = false;
        try { return persistNovelElectronSnapshotNow(true); } catch(_) { return Promise.resolve(false); }
    }
    function parseNovelSnapshotJson(value, fallback) {
        try { return JSON.parse(value); } catch(_) { return fallback; }
    }
    async function restoreNovelElectronSnapshotIfNeeded() {
        if(!window.novelData || typeof window.novelData.load !== 'function' || !novelStore.available) return false;
        try {
            const existingRuntime = await novelStore.load();
            const result = await window.novelData.load();
            if(!result || result.missing) return false;
            if(result.error) { console.warn('Electron 快照读取失败：', result.error); return false; }
            const data = result.data;
            if(!data || typeof data !== 'object') return false;
            // 有现存 IndexedDB 时，只有带有效时间戳且确实更新的快照才允许回填。
            // 旧 EXE 快照没有 savedAt，只能在 IndexedDB 为空时兼容导入。
            const snapshotSavedAt = Number(data.savedAt);
            if(existingRuntime && (!Number.isFinite(snapshotSavedAt) || snapshotSavedAt <= novelStore.lastUpdatedAt)) return false;
            let runtime = data.runtime;
            if(!runtime && data.books_v2) {
                runtime = {
                    books: parseNovelSnapshotJson(data.books_v2, []),
                    currentBookId: data.currentBookId_v2 || null,
                    globalCharacters: parseNovelSnapshotJson(data.global_characters_v2, []),
                    globalActions: parseNovelSnapshotJson(data.global_actions_v2, []),
                    globalCostumes: parseNovelSnapshotJson(data.global_costumes_v2, [])
                };
            }
            if(!runtime || !Array.isArray(runtime.books)) return false;
            await novelStore.replace(runtime);
            if(data.settings && data.settings.apiConfig) {
                try { localStorage.setItem('api_config_v3', JSON.stringify(data.settings.apiConfig)); } catch(_) {}
            } else if(data.api_config_v3) {
                try { localStorage.setItem('api_config_v3', data.api_config_v3); } catch(_) {}
            }
            if(data.settings && Array.isArray(data.settings.scratchpadPages)) {
                try { localStorage.setItem('scratchpad_pages_v1', JSON.stringify(data.settings.scratchpadPages)); } catch(_) {}
            }
            return true;
        } catch(err) {
            console.warn('Electron 快照导入 IndexedDB 失败：', err);
            return false;
        }
    }
    function replaceNovelRuntime() {
        if(!novelStore.available) return Promise.resolve(false);
        return novelStore.replace(buildNovelRuntimeState()).then(() => true).catch(err => {
            console.error('IndexedDB 初始迁移失败', err);
            return false;
        });
    }
    function retireNovelLegacyPayload() {
        // 只有 IndexedDB 事务完成后才清理旧的大键；失败时保留旧数据作为回滚源。
        ['books_v2','global_characters_v2','global_actions_v2','global_costumes_v2'].forEach(key => {
            try { localStorage.removeItem(key); } catch(_) {}
        });
        try { localStorage.setItem('storage_migrated_v1', '1'); } catch(_) {}
    }

