    function getBookWordCount(book) { if(!book.chapters) return 0; let total=0; book.chapters.forEach(ch=>{ if(ch.content) total+=ch.content.replace(/\s+/g,'').length; }); return total; }
    let renderBookshelfTimer = null;
    function renderBookshelf() {
        if(renderBookshelfTimer) clearTimeout(renderBookshelfTimer);
        renderBookshelfTimer = setTimeout(() => {
            const bookList = $('bookList'); if(!bookList) return; bookList.innerHTML = '';
        books.forEach(b => {
            let d = document.createElement('div');
            d.className = `book-card ${currentBookId===b.id?'active':''}`;
            d.innerHTML = `<div class="book-title"><span>${escapeHtml(b.name)}</span><span style="display:flex;gap:2px;"><i class="fas fa-pen" data-action="rename" data-id="${escapeHtml(b.id)}" title="重命名"></i><i class="fas fa-copy" data-action="duplicate" data-id="${escapeHtml(b.id)}" title="复制书籍"></i><i class="fas fa-trash" data-action="delete" data-id="${escapeHtml(b.id)}"></i></span></div><div class="book-meta">${b.chapters?.length||0}章 | 角色:${b.characters?.length||0} | ${getBookWordCount(b)}字</div>`;
            d.addEventListener('click', (e) => { if(e.target.tagName!=='I') switchBook(b.id); });
            d.querySelector('[data-action="rename"]')?.addEventListener('click', (e) => { e.stopPropagation(); if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再重命名"); return; } const nb = prompt('重命名小说', b.name); if(nb && nb.trim() && nb.trim() !== b.name) { const oldName = b.name; b.name = nb.trim(); renderBookshelf(); if(!persistOrWarn()) { b.name = oldName; renderBookshelf(); toast('保存失败，已还原'); return; } if(currentBookId === b.id) { const curBookName = $('curBookName'); if(curBookName) curBookName.innerText = b.name; } toast(`已重命名《${b.name}》`); } });
            d.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => { e.stopPropagation(); if(confirm(`确认删除《${b.name}》？此操作不可撤销。`)) deleteBook(b.id); });
            d.querySelector('[data-action="duplicate"]')?.addEventListener('click', (e) => { e.stopPropagation(); duplicateBook(b.id); });
            bookList.appendChild(d);
        });
        if(!books.length) bookList.innerHTML = '<div style="padding:12px;color:#6A627A;">暂无小说</div>';
    }, 50);
    }

    let initialized = false;
    function switchBook(id, skipSave) {
        // 返回布尔值（v5.8）：saveApi 自动重试切回原书时需检查切换是否成功，
        // 失败则取消任务，杜绝"数据写入原书、界面停留新书"的错位
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再切换"); return false; } // v8.9-F017：补 summaryGenerating/conflictCheckingCount——手动摘要/检测不置 isGenerating，原可切书：摘要费用 3441 recordCost 无书 ID 记到响应时当前书、检测结果与费用在切书后静默丢弃（项目零 v4 复审 F-017）；v8.7-F04/F06 补拦 pendingBranch（走向）与 banterBusy（吐槽）同理
        // skipSave=true 用于删除当前书后的切换：该书已删除，其未保存修改随删除丢弃，
        // 必须先切 currentBookId 再加载，否则 saveCurChapter 会把旧编辑器内容写入新书（数据污染）
        if(initialized && !isImporting && !skipSave) { if(!ensureCurrentChapterSaved()) return false; }
        currentBookId = id;
        let b = books.find(x=>x.id===id);
        if(!b) return false;
        {
            const curBookName = $('curBookName'); if(curBookName) curBookName.innerText = b.name;
            ['worldview','plotSet'].forEach(elId => { let el = $(elId); if(el) el.value = b[elId]||''; }); // v7.6：termSet 移除
            const globalPrompt = $('globalPrompt'); if(globalPrompt) globalPrompt.value = b.globalPrompt === undefined ? '你是一位擅长细腻情感的言情小说家。' : b.globalPrompt;
            const writingStyle = $('writingStyle'); if(writingStyle) writingStyle.value = b.writingStyle === undefined ? '文风细腻，多用心理描写。' : b.writingStyle;
            if(!b.chapters) b.chapters=[]; if(!b.chatHistory) b.chatHistory=[]; if(!b.characters) b.characters=[]; if(!b.forbiddenWords) b.forbiddenWords=[];
            migrateChapter(b); clearRollbackSnapshot();
            // v7.2：切换章节即取消重写态/走向待发态（用户拍板：不设取消按钮，切章节即取消）
            setRewriteMode(false, null);
            branchContinuePending = false; branchBookId = null;
            const bmCls = $('branchModal'); if(bmCls) bmCls.style.display = 'none'; // v8.7-F04b：切书即关闭走向卡片弹窗（卡片属于原书，防切书后点旧卡片把 A 书走向续写进 B 书——复审 F-04"结果待选期"跨书路径）
            renderChapters(); renderChat(); loadCurChapter(); saveAll(); renderBookshelf();
            const conflictPanel = $('conflictPanel'); if(conflictPanel) conflictPanel.style.display = 'none';
            const banterPanel0 = $('banterPanel'); if(banterPanel0) banterPanel0.style.display = 'none'; banterVisible = false;
            closeRoleplay(); // v7.9：切书自动退出试演（v8.5.2-P3-1：去重重复调用，与 loadCurChapter 一致）
            const checkBtn = $('checkConflictBtn'); if(checkBtn) checkBtn.style.background = "#3A3A6A";
            conflictVisible = false;
            updatePrecisionButton();
        }
        return true;
    }
    // v7.4：复制书籍——全量深拷贝（章节/角色+成长/关系/聊天/设定/精准/关系图布局），id 重映射，副本内关系重定向
    function duplicateBook(id) {
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再复制"); return; }
        const book = books.find(b => b.id === id); if(!book) return;
        if(!ensureCurrentChapterSaved()) return;
        const newName = prompt('复制为新书，请输入新书名（默认：原书名-副本）', book.name + '-副本');
        if(!newName || !newName.trim()) { toast("已取消复制"); return; }
        const copy = JSON.parse(JSON.stringify(book));
        copy.id = uuid();
        copy.name = newName.trim();
        // 章节 id 重映射（v8.6-fix27：含角色成长记录 chapterId 引用）
        const chapIdMap = new Map();
        (copy.chapters || []).forEach(ch => { const oldId = String(ch.id); ch.id = uuid(); chapIdMap.set(oldId, ch.id); });
        // 角色 id 重映射
        const charIdMap = new Map();
        (copy.characters || []).forEach(c => { const oldId = String(c.id); const newId = uuid(); charIdMap.set(oldId, newId); c.id = newId; });
        // 关系：副本内 targetId 重映射（集合外保留原值——沿用"无脑带走"逻辑）
        (copy.characters || []).forEach(c => {
            if(Array.isArray(c.relationships)) {
                c.relationships = c.relationships.map(r => (r && charIdMap.has(String(r.targetId))) ? ({ ...r, targetId: charIdMap.get(String(r.targetId)) }) : r).filter(Boolean);
            }
        });
        // 精准勾选：角色 id 重映射（动作/服装指向全局库，保持原值）
        if(Array.isArray(copy.precisionChars)) {
            copy.precisionChars = copy.precisionChars.map(pid => charIdMap.has(String(pid)) ? charIdMap.get(String(pid)) : pid);
        }
        // 关系图布局：key 按角色 id 重映射（区域/颜色映射随副本复制）
        if(copy.relationPositions && typeof copy.relationPositions === 'object') {
            const newPos = {};
            for(const [k, v] of Object.entries(copy.relationPositions)) {
                if(charIdMap.has(String(k))) newPos[charIdMap.get(String(k))] = v;
            }
            copy.relationPositions = newPos;
        }
        // v8.6-fix27：角色成长 chapterId 按章节映射重指（原副本删章后成长无法清理）
        (copy.characters || []).forEach(c => { if(Array.isArray(c.growth)) c.growth.forEach(g => { if(g && chapIdMap.has(String(g.chapterId))) g.chapterId = chapIdMap.get(String(g.chapterId)); }); });
        // v8.6-fix27：精准统计键按角色映射重指（原副本 stats.chars 键仍指向旧角色 id，统计看板 TOP10 恒为 0）
        if(copy.precisionStats && copy.precisionStats.chars && typeof copy.precisionStats.chars === 'object') {
            const newChars = {};
            for(const [k, v] of Object.entries(copy.precisionStats.chars)) {
                if(charIdMap.has(String(k))) newChars[charIdMap.get(String(k))] = v;
            }
            copy.precisionStats.chars = newChars;
        }
        // 当前章节指向副本第一章节
        copy.currentChapterId = (copy.chapters && copy.chapters.length) ? copy.chapters[0].id : null;
        // 插入原书后，不自动切换
        const idx = books.findIndex(b => b.id === id);
        books.splice(idx + 1, 0, copy);
        if(!persistOrWarn()) { books.splice(idx + 1, 1); toast("保存失败，已取消复制"); return; }
        renderBookshelf();
        toast(`已复制为《${copy.name}》`);
    }

    function clearBanterCachesFor(bookId, chapterId) {
        const prefix = 'banter_cache_v1_' + String(bookId) + (chapterId == null ? '_' : '_' + String(chapterId) + '_');
        try {
            const gone=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith(prefix)) gone.push(k); }
            gone.forEach(k=>localStorage.removeItem(k));
            let meta={}; try{meta=JSON.parse(localStorage.getItem('banter_cache_meta_v1')||'{}')||{};}catch(_){}
            gone.forEach(k=>delete meta[k]); localStorage.setItem('banter_cache_meta_v1',JSON.stringify(meta));
        }catch(_){}
    }
    function deleteBook(id) {
        if(importPending) { toast("备份导入进行中，请等待完成后再删除"); return; } // v8.9-F011：导入读取/提交期间禁止删除（原删除后迟到导入回调可复活已删数据）
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再删除"); return; } // v8.8-F011：补 summaryGenerating/conflictCheckingCount（同族：摘要在途删书，返回后 recordCost 按新当前书记错书）；v8.7-F002 补拦 pendingBranch/banterBusy——原删当前书会绕行 switchBook 锁（先改 currentBookId 再切书失败也继续），走向响应返回后被归属到新当前书造成跨书污染（项目零审查 F-002）
        let idx = books.findIndex(b=>b.id===id);
        if(idx!==-1) {
            const removed = books[idx]; // v5.8：保存失败时回滚用
            const wasCurrent = currentBookId===id;
            books.splice(idx,1);
            if(wasCurrent) {
                currentBookId = books[0]?.id||null;
                if(currentBookId) switchBook(currentBookId, true);
                else { const curBookName = $('curBookName'); if(curBookName) curBookName.innerText='未选择'; const curChapName = $('curChapName'); if(curChapName) curChapName.innerText='无章节'; const novelContent = $('novelContent'); if(novelContent) novelContent.innerText='✨ 左侧按钮，一键起书，创作你的第一本小说吧！'; const wordCount = $('wordCount'); if(wordCount) wordCount.innerText='0'; const chaptersList = $('chaptersList'); if(chaptersList) chaptersList.innerHTML=''; const chatMsgs = $('chatMsgs'); if(chatMsgs) chatMsgs.innerHTML=''; const summaryArea = $('summaryArea'); if(summaryArea) summaryArea.value=''; ['worldview','plotSet','globalPrompt','writingStyle'].forEach(elId => { let el = $(elId); if(el) el.value=''; }); } // v8.0.13：补清 summaryArea
            }
            if(!persistOrWarn()) {
                // v5.8：保存失败回滚删除——恢复书籍数组 + 若删的是当前书则切回
                books.splice(idx, 0, removed);
                if(wasCurrent && currentBookId!==id) { currentBookId = id; switchBook(id, true); }
                renderBookshelf();
                toast('保存失败，已恢复《'+removed.name+'》');
                return;
            }
            clearBanterCachesFor(id);
            renderBookshelf(); toast('已删除');
        }
    }
    function newBook() {
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再新建"); return; } // v8.10-F017：补齐四标志——原摘要在途 newBook：书已加入但内部 switchBook 被拒，提示"已创建"与界面矛盾（HTML v5 复审 F-017 残余）
        let name = prompt('小说名称', `新作${books.length+1}`);
        if(!name || !name.trim()) { toast("书名不能为空"); return; }
        let b = { id:uuid(), name:name.trim(), chapters:[], currentChapterId:null, chatHistory:[], worldview:'', plotSet:'', globalPrompt:'你是一位擅长细腻情感的言情小说家。', writingStyle:'文风细腻，多用心理描写。', characters:[], forbiddenWords:[], precisionMode:false, precisionChars:[], precisionActions:[], precisionCostumes:[] };
        books.push(b);
        if(!persistOrWarn()) { books.pop(); toast('保存失败，已取消新建'); return; } // v5.8：失败回滚
        switchBook(b.id);
        toast(`已创建《${name}》`);
    }

