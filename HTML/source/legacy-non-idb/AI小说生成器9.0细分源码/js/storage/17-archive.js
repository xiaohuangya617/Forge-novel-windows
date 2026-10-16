    let lastSaveErrorShown = false;
    let archiveWriteInProgress = false;
    let archiveScheduleTimer = null;
    let archiveLastHash = '';
    function archiveDefaultSettings() {
        return { enabled:true, intervalMs:60000, baselineEvery:10, retention:5, maxKB:2048, includeApi:false };
    }
    function getArchiveSettings() {
        try {
            const v = JSON.parse(localStorage.getItem('archiveSettings_v1') || 'null');
            const d = archiveDefaultSettings();
            if(!v || typeof v !== 'object') return d;
            return Object.assign(d, {
                enabled: v.enabled !== false,
                intervalMs: [0,30000,60000,300000,900000].includes(Number(v.intervalMs)) ? Number(v.intervalMs) : d.intervalMs,
                baselineEvery: Math.max(1, Math.min(100, parseInt(v.baselineEvery) || d.baselineEvery)),
                retention: Math.max(1, Math.min(20, parseInt(v.retention) || d.retention)),
                maxKB: Math.max(256, Math.min(8192, parseInt(v.maxKB) || d.maxKB)),
                includeApi: v.includeApi === true
            });
        } catch(e) { return archiveDefaultSettings(); }
    }
    function archiveStatePayload(includeApi) {
        const payload = { books: JSON.parse(JSON.stringify(books)), currentBookId, globalCharacters: JSON.parse(JSON.stringify(globalCharacters)), globalActions: JSON.parse(JSON.stringify(globalActions)), globalCostumes: JSON.parse(JSON.stringify(globalCostumes)), scratchpadPages: JSON.parse(JSON.stringify(scratchpadPages || [])) };
        if(includeApi) payload.apiConfig = { main:api, polish:polishApi, image:imageApiCfg, act:actApi };
        return payload;
    }
    function archiveHash(v) {
        let str = JSON.stringify(v), h = 2166136261;
        for(let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h,16777619); }
        return (h >>> 0).toString(16);
    }
    function getLatestIncrementalArchive() {
        try {
            const base = JSON.parse(localStorage.getItem('archiveBase_v1') || 'null');
            const deltas = JSON.parse(localStorage.getItem('archiveDelta_v1') || '[]');
            const candidates = [];
            if(base && typeof base === 'object' && base.state) candidates.push(base);
            if(Array.isArray(deltas)) deltas.forEach(d => { if(d && typeof d === 'object' && d.state) candidates.push(d); });
            candidates.sort((a,b) => (Number(b.seq)||0) - (Number(a.seq)||0) || (Number(b.ts)||0) - (Number(a.ts)||0));
            for(const item of candidates) {
                try {
                    if(item !== base && item.baseId && base && base.id && item.baseId !== base.id) continue;
                    validateArchiveState(item.state);
                    if(item.hash && archiveHash(item.state) !== item.hash) continue;
                    return item;
                } catch(_) {}
            }
        } catch(_) {}
        return null;
    }
    function validateArchiveState(state) {
        if(!state || typeof state !== 'object') throw new Error('增量存档状态无效');
        validateBackupData({ books: state.books, currentBookId: state.currentBookId, globalCharacters: state.globalCharacters, globalActions: state.globalActions, globalCostumes: state.globalCostumes, scratchpadPages: state.scratchpadPages, apiConfig: state.apiConfig });
        return true;
    }
    function applyIncrementalArchiveState(state) {
        validateArchiveState(state);
        const restoredBooks = JSON.parse(JSON.stringify(state.books));
        restoredBooks.forEach(book => {
            book.id = String(book.id);
            book.characters = ensureArray(book.characters);
            book.chatHistory = ensureArray(book.chatHistory);
            book.chapters = ensureArray(book.chapters);
            book.forbiddenWords = ensureArray(book.forbiddenWords);
            book.characters.forEach(c => { if(c.id != null) c.id = String(c.id); });
            book.chapters.forEach(ch => { ch.id = String(ch.id); if(!Array.isArray(ch.checkResult)) ch.checkResult = []; });
            migrateChapter(book);
        });
        const restoredChars = state.globalCharacters ? JSON.parse(JSON.stringify(state.globalCharacters)) : [];
        const restoredActions = state.globalActions ? JSON.parse(JSON.stringify(state.globalActions)) : [];
        const restoredCostumes = state.globalCostumes ? JSON.parse(JSON.stringify(state.globalCostumes)) : [];
        [restoredChars, restoredActions, restoredCostumes].forEach(list => list.forEach(x => { if(x.id != null) x.id = String(x.id); }));
        const requestedId = state.currentBookId == null ? null : String(state.currentBookId);
        const restoredCurrentId = requestedId && restoredBooks.some(b => b.id === requestedId) ? requestedId : (restoredBooks[0]?.id || null);
        const restoredScratch = Array.isArray(state.scratchpadPages) && state.scratchpadPages.length === 5 ? state.scratchpadPages.map(x => typeof x === 'string' ? x : '') : null;
        const writes = {
            books_v2: JSON.stringify(restoredBooks),
            currentBookId_v2: restoredCurrentId || '',
            global_characters_v2: JSON.stringify(restoredChars),
            global_actions_v2: JSON.stringify(restoredActions),
            global_costumes_v2: JSON.stringify(restoredCostumes)
        };
        if(restoredScratch) writes.scratchpad_pages_v1 = JSON.stringify(restoredScratch);
        if(state.apiConfig && typeof state.apiConfig === 'object' && !Array.isArray(state.apiConfig)) writes.api_config_v3 = JSON.stringify(state.apiConfig);
        const old = {};
        const keys = Object.keys(writes);
        try { keys.forEach(k => { old[k] = localStorage.getItem(k); }); keys.forEach(k => localStorage.setItem(k, writes[k])); }
        catch(e) {
            keys.forEach(k => { try { if(old[k] === null || old[k] === undefined) localStorage.removeItem(k); else localStorage.setItem(k, old[k]); } catch(_) {} });
            throw e;
        }
        books = restoredBooks;
        currentBookId = restoredCurrentId;
        globalCharacters = restoredChars;
        globalActions = restoredActions;
        globalCostumes = restoredCostumes;
        if(restoredScratch) { scratchpadPages = restoredScratch; scratchpadContent = restoredScratch[0] || ''; }
        return true;
    }
    function recoverFromIncrementalArchive() {
        const latest = getLatestIncrementalArchive();
        if(!latest) return false;
        try {
            applyIncrementalArchiveState(latest.state);
            archiveLastHash = latest.hash || archiveHash(latest.state);
            toast('✅ 主数据损坏，已从增量存档恢复');
            return true;
        } catch(e) {
            console.warn('增量存档恢复失败', e);
            return false;
        }
    }
    function writeArchiveSnapshot(force) {
        if(archiveWriteInProgress) return false;
        const cfg = getArchiveSettings();
        if(!cfg.enabled && !force) return false;
        archiveWriteInProgress = true;
        try {
            const state = archiveStatePayload(cfg.includeApi);
            const hash = archiveHash(state);
            if(!force && hash === archiveLastHash) return true;
            const base = JSON.parse(localStorage.getItem('archiveBase_v1') || 'null');
            const deltas = JSON.parse(localStorage.getItem('archiveDelta_v1') || '[]');
            const now = Date.now();
            const next = { seq: (deltas.length ? (deltas[deltas.length-1].seq || 0) + 1 : ((base && base.seq) || 0) + 1), ts: now, hash, baseId: base && base.id || null, state };
            let nextDeltas = Array.isArray(deltas) ? deltas : [];
            if(!base) { localStorage.setItem('archiveBase_v1', JSON.stringify({ id:'base_' + now, ts:now, seq:next.seq, hash, state })); nextDeltas = []; }
            else {
                nextDeltas.push(next);
                if(nextDeltas.length >= cfg.baselineEvery || JSON.stringify(nextDeltas).length > cfg.maxKB * 1024) {
                    localStorage.setItem('archiveBase_v1', JSON.stringify({ id:'base_' + now, ts:now, seq:next.seq, hash, state }));
                    nextDeltas = [];
                }
            }
            while(nextDeltas.length > cfg.retention) nextDeltas.shift();
            while(JSON.stringify(nextDeltas).length > cfg.maxKB * 1024 && nextDeltas.length > 1) nextDeltas.shift();
            localStorage.setItem('archiveDelta_v1', JSON.stringify(nextDeltas));
            localStorage.setItem('archiveSettings_v1', JSON.stringify(cfg));
            archiveLastHash = hash;
            return true;
        } catch(e) {
            if(!lastSaveErrorShown) toast('增量存档写入失败，请导出完整备份');
            return false;
        } finally { archiveWriteInProgress = false; }
    }
    function scheduleIncrementalArchive() {
        const cfg = getArchiveSettings();
        if(!cfg.enabled || !initialized || cfg.intervalMs <= 0) { if(archiveScheduleTimer) { clearTimeout(archiveScheduleTimer); archiveScheduleTimer = null; } return; }
        if(archiveScheduleTimer) clearTimeout(archiveScheduleTimer);
        archiveScheduleTimer = setTimeout(() => { archiveScheduleTimer = null; writeArchiveSnapshot(false); }, cfg.intervalMs);
    }
    function saveAll() {
        const values = {
            books_v2: JSON.stringify(books),
            currentBookId_v2: currentBookId || '',
            api_config_v3: JSON.stringify({ main: api, polish: polishApi, image: imageApiCfg, act: actApi }),
            global_characters_v2: JSON.stringify(globalCharacters),
            global_actions_v2: JSON.stringify(globalActions),
            global_costumes_v2: JSON.stringify(globalCostumes)
        };
        const keys = Object.keys(values), old = {};
        try {
            keys.forEach(k => { old[k] = localStorage.getItem(k); });
        } catch(e) {
            if(!lastSaveErrorShown) { toast('无法读取本地存储，请立即导出备份'); lastSaveErrorShown = true; }
            return false;
        }
        try {
            keys.forEach(k => localStorage.setItem(k, values[k]));
            lastSaveErrorShown = false;
        } catch(e) {
            keys.forEach(k => { try { if(old[k] === null || old[k] === undefined) localStorage.removeItem(k); else localStorage.setItem(k, old[k]); } catch(_) {} });
            if (!lastSaveErrorShown) { toast('存储空间不足！请立即导出备份，数据可能丢失'); lastSaveErrorShown = true; }
            return false;
        }
        const ctxSpan = $('ctxNum'); if(ctxSpan) ctxSpan.innerText = api.ctxChapters;
        updateStorageIndicator();
        scheduleIncrementalArchive();
        return true;
    }
    // v5.8：非正文操作（设定/角色/动作/服装/禁用词/关系/重命名/间章切换等）的保存封装——
    // saveAll 失败时明确提示（saveAll 内部已有一次"存储空间不足"提示，此处补一次可操作的指引），
    // 调用方据此取消成功提示，避免"内存已改、UI 显示最新、实际没落盘"的虚假成功
    function persistOrWarn() {
        const ok = saveAll();
        if(!ok) {
            toast("保存失败，请检查存储空间或先导出备份");
            lastSaveErrorShown = true;
            // v5.8：状态栏持续提示（非一闪而过的 toast），用户随时可见
            const sp = $('saveStatus'); if(sp) sp.innerText = '保存失败';
        }
        return ok;
    }

    // v5.8：生成期间锁定正文/摘要编辑与相关按钮——防止 AI 返回后 loadCurChapter()
    // 用生成结果覆盖用户在等待期间输入、但尚未保存的内容（创作工具最高风险场景）
    // v5.9：锁定前记录各按钮原禁用状态，解锁时恢复原状（rollbackBtn 由 enableRollbackButton 管理，
    // 不能粗暴解锁为可用，否则无快照时回滚按钮会错误点亮）
