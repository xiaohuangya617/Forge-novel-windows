function init() {
        let restoredFromIndexedDb = false;
        if(novelStore.available) {
            try {
                const storedRuntime = await novelStore.load();
                if(storedRuntime) {
                    applyNovelRuntimeState(storedRuntime);
                    restoredFromIndexedDb = true;
                    novelStoragePrimary = true;
                }
            } catch(e) {
                console.warn('IndexedDB 读取失败，将尝试旧存储：', e);
            }
        }
        if(!restoredFromIndexedDb) {
        try {
            let savedBooks = localStorage.getItem('books_v2');
            let recoveredFromArchive = false;
            if(savedBooks) {
                try {
                    const parsed = JSON.parse(savedBooks);
                    if(Array.isArray(parsed)) books = parsed;
                    else { recoveredFromArchive = recoverFromIncrementalArchive(); if(!recoveredFromArchive) throw new Error('books_v2 不是数组'); }
                } catch(e) {
                    recoveredFromArchive = recoverFromIncrementalArchive();
                    if(!recoveredFromArchive) throw e;
                }
            } else {
                recoveredFromArchive = recoverFromIncrementalArchive();
            }
            if(recoveredFromArchive) savedBooks = localStorage.getItem('books_v2'); // 增量恢复已将主键写回，后续初始化继续走统一迁移链
        } catch(e) {
            console.error("数据解析失败，已重置", e);
            toast("⚠️ 存储数据损坏，已自动重置。如有备份请恢复。");
            // v8.7-F03/M6：只隔离损坏源 books_v2 与 currentBookId_v2，不连坐删除 API 配置/全局库/草稿等可独立恢复的键（原 coreKeys 全删 → HTML 版 API Key 永久丢失）
            ['books_v2','currentBookId_v2'].forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
            books = [];
        }
        if(!Array.isArray(books)) books = []; // v8.7-F03：双重兜底——parse 合法但非数组时也归零（防后续 forEach 崩溃）
        // v8.7-F03b：嵌套数据防御——过滤非对象书条目（books:[null] 不再让迁移/初始化崩）；chapters/characters/chatHistory/forbiddenWords 字段级强制数组（chapters:{} 不再抛 forEach）；章元素过滤非对象（复审 F-03 实测复现）
        books = books.filter(b => b && typeof b === 'object');
        books.forEach(b => {
            ['chapters','characters','chatHistory','forbiddenWords'].forEach(f => { if(!Array.isArray(b[f])) b[f] = []; });
            // v8.7-F03c：嵌套数组元素级过滤——characters:[null] 崩迁移读 c.id、forbiddenWords:[null] 崩渲染读 item.id、chatHistory:[null] 崩渲染读 m.role（复审 F-03c 实测），非对象元素一律丢弃
            b.characters = b.characters.filter(x => x && typeof x === 'object');
            b.chatHistory = b.chatHistory.filter(x => x && typeof x === 'object');
            b.forbiddenWords = b.forbiddenWords.filter(x => x && typeof x === 'object');
            b.chapters = b.chapters.filter(ch => ch && typeof ch === 'object');
            b.chapters.forEach(ch => { if(ch.id != null) ch.id = String(ch.id); }); // F12：章 id 字符串化
            b.characters.forEach(c => { if(c.id != null) c.id = String(c.id); }); // F12：本书角色 id 字符串化
        });
        // v8.7-F12：书 ID 统一为字符串——存量数字 ID（如书 id=2）与 currentBookId_v2 字符串 "2" 严格 === 比较失效（重启不恢复该书、试演选角不稳回显）
        books.forEach(b => { if(b.id != null) b.id = String(b.id); else b.id = uuid(); });
        if(currentBookId != null) currentBookId = String(currentBookId);
        books.forEach(book => { if(book.charSet && !book.worldview) { book.worldview=book.charSet; delete book.charSet; } migrateChapter(book); if(book.chapters) book.chapters.forEach(ch => { if(!ch.checkResult) ch.checkResult=[]; }); });
        currentBookId = localStorage.getItem('currentBookId_v2') || (books[0]?.id||null);
        let savedChars = localStorage.getItem('global_characters_v2'); globalCharacters = savedChars ? (() => { try { const v = JSON.parse(savedChars); return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []; } catch(e) { console.warn("全局角色解析失败", e); return []; } })() : []; // v8.7-F03d：全局库元素级过滤（global_characters_v2=[null] 不再让素材库渲染链崩 null.id，v4 复审实测）
        let savedActions = localStorage.getItem('global_actions_v2'); globalActions = savedActions ? (() => { try { const v = JSON.parse(savedActions); return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []; } catch(e) { console.warn("全局动作解析失败", e); return []; } })() : [];
        globalActions.forEach(a => { if(a) { if(a.id != null) a.id = String(a.id); delete a.tags; } }); // v8.7-F12：动作 id 字符串化；v7.7 移除标签（启动彻底清空）
        globalCharacters.forEach(c => { if(c && c.id != null) c.id = String(c.id); }); // v8.7-F12：全局角色 id 字符串化（试演/precision 严格比较统一）
        let savedCostumes = localStorage.getItem('global_costumes_v2'); globalCostumes = savedCostumes ? (() => { try { const v = JSON.parse(savedCostumes); return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []; } catch(e) { console.warn("全局服装解析失败", e); return []; } })() : [];
        globalCostumes.forEach(c => { if(c && c.id != null) c.id = String(c.id); }); // v8.7-F12b：全局服装 id 字符串化必须在本库 parse 赋值之后——原顺序错误（先于 parse 处理旧空数组，新加载服装数字 id 未迁移，复审 F-12 实测复现）
        }
        if(!restoredFromIndexedDb && novelStore.available) {
            const migrated = await replaceNovelRuntime();
            if(migrated) novelStoragePrimary = true;
            else toast('⚠️ IndexedDB 首次迁移失败，暂时保留旧存储；请先导出备份');
        }
        // v7.9j：老书已有角色/服装标签统一取消高亮（一次性迁移，方便后续批量打标签）
        try {
            if(!localStorage.getItem('tag_clear_v1')) {
                let migrated = 0;
                (books || []).forEach(b => (b.characters || []).forEach(c => { if(c.tags && c.tags.length) { c.tags = []; migrated++; } }));
                (globalCharacters || []).forEach(c => { if(c.tags && c.tags.length) { c.tags = []; migrated++; } });
                (globalCostumes || []).forEach(c => { if(c.tags && c.tags.length) { c.tags = []; migrated++; } });
                if(migrated > 0) { saveAll(); console.log('v7.9j 已清空老书标签高亮', migrated, '项'); }
                localStorage.setItem('tag_clear_v1', '1');
            }
        } catch(e) { console.warn('v7.9j 标签迁移失败', e); }
        loadApi();
        loadScratchpad();
        // 恢复字体大小
        let savedFontSize = localStorage.getItem('editor_font_size');
        if(savedFontSize) { currentFontSize = parseInt(savedFontSize) || 16; }
        const novelContent = $('novelContent'); if(novelContent) novelContent.style.fontSize = currentFontSize + 'px';
        const fontSizeVal = $('fontSizeVal'); if(fontSizeVal) fontSizeVal.innerText = currentFontSize + 'px';

        renderBookshelf();
        if(currentBookId && books.find(b=>b.id===currentBookId)) switchBook(currentBookId);
        else if(books.length) switchBook(books[0].id);
        else { const curBookName = $('curBookName'); if(curBookName) curBookName.innerText='未选择'; const novelContent = $('novelContent'); if(novelContent) novelContent.innerText='✨ 左侧按钮，一键起书，创作你的第一本小说吧！'; }
        bindNovelDialogs(); bindEvents(); bindPrecisionSearch(); bindLibSearch(); initTagEvents(); bctBind(); initResize(); startSysPanel(); initDragSort(); initEditorBlurSnapshot(); initFindKeys(); startAutoSave(); initLibEditorLayout(); initLibTextareaResize(); initTopMenuScrollHint();
        updateStorageIndicator(); updatePrecisionButton(); initialized = true; writeArchiveSnapshot(false);
        renderLogList(); // v7.5：启动即渲染日志列表（默认日志页签直接显示历史，不依赖首条 pushLog）
    }
    (async function bootNovelApp() {
        await openNovelStorage();
        await init();
    })().catch(err => {
        console.error('应用启动失败', err);
        toast('⚠️ 应用启动失败：' + (err && err.message || err));
    });
});