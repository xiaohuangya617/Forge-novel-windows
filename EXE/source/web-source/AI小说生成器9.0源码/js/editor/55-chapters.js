    let dragSrcIndex = null;
    function initDragSort() {
        const chaptersList = $('chaptersList'); if(!chaptersList) return;
        chaptersList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.chap-item'); if(!item) return;
            dragSrcIndex = Array.from(chaptersList.children).indexOf(item);
            e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragSrcIndex);
            const dragImage = new Image(); dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(dragImage, 0, 0); item.classList.add('dragging');
        });
        chaptersList.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        chaptersList.addEventListener('dragend', (e) => { const item = e.target.closest('.chap-item'); if(item) item.classList.remove('dragging'); dragSrcIndex = null; });
        chaptersList.addEventListener('drop', async (e) => {
            e.preventDefault(); const targetItem = e.target.closest('.chap-item');
            if(!targetItem || dragSrcIndex === null) return;
            if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再排序"); dragSrcIndex = null; return; }
            const sourceIndex = dragSrcIndex; // drop 后 dragend 可能先把全局索引清空，异步等待前必须固定本次拖拽来源
            const targetIndex = Array.from(chaptersList.children).indexOf(targetItem);
            if(sourceIndex === targetIndex) return;
            const book = getCurrentBook();
            if(book && book.chapters) { if(sourceIndex < 0 || sourceIndex >= book.chapters.length || targetIndex < 0 || targetIndex >= book.chapters.length) { dragSrcIndex = null; return; } if(!await ensureCurrentChapterSavedAndCommitted()) { dragSrcIndex = null; return; } const oldOrder = book.chapters.slice(); const [moved] = book.chapters.splice(sourceIndex, 1); book.chapters.splice(targetIndex, 0, moved); if(!await persistOrWarnAsync()) { book.chapters = oldOrder; renderChapters(); toast("保存失败，章节顺序已恢复"); return; } renderChapters(); toast("章节顺序已更新"); }
        });
    }

    // v8.3：编辑区标题点击改名（复用列表 rename 逻辑）
    async function renameCurrentChapter() {
        const book = getCurrentBook(); if(!book) return;
        const chap = book.chapters.find(c => c.id === book.currentChapterId);
        if(!chap) { toast('请先选择章节'); return; }
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再重命名"); return; }
        let nt = await appPromptAsync('新章节标题', '请输入章节标题', chap.title);
        if(nt && nt.trim()) {
            const oldTitle = chap.title;
            chap.title = nt.trim();
            renderChapters();
            if(!await persistOrWarnAsync()) { chap.title = oldTitle; renderChapters(); return; }
            const curChapName = $('curChapName'); if(curChapName) curChapName.innerText = chap.title.substring(0,25);
            toast('章节已重命名');
        }
    }

    function renderChapters() {
        const chaptersList = $('chaptersList'); if(!chaptersList) return; chaptersList.innerHTML = '';
        let b = getCurrentBook();
        if(!b || !b.chapters.length) { chaptersList.innerHTML='<div style="padding:12px;color:#6A627A;">暂无章节</div>'; return; }
        b.chapters.forEach(ch => {
            let div = document.createElement('div');
            div.className = `chap-item ${b.currentChapterId===ch.id?'active':''}`;
            div.setAttribute('draggable', 'true');
            const chapTitle = (ch.isInterlude ? '<i class="fas fa-feather-alt" style="margin-right:5px;color:#8A84A8;font-size:0.75rem;" title="间章"></i>' : '') + escapeHtml(ch.title||'未命名') + (ch.truncated ? ' <span style="color:#FFA070;font-size:0.7rem;" title="⚠️ 输出可能被截断，建议检查本章结尾">⚠️</span>' : ''); // v7.8：截断章节角标
            div.innerHTML = `<span style="cursor:pointer;flex:1;">${chapTitle}</span><div class="chap-actions"><i class="fas fa-pen" data-action="rename" data-id="${escapeHtml(ch.id)}"></i><i class="fas fa-trash" data-action="delete" data-id="${escapeHtml(ch.id)}"></i><i class="fas fa-exchange-alt" data-action="toggleInterlude" data-id="${escapeHtml(ch.id)}" title="正章⇄间章"></i></div>`;
            div.addEventListener('click', async (e) => { if(e.target.tagName==='I') return; if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再切换章节"); return; } if(!await ensureCurrentChapterSavedAndCommitted()) return; b.currentChapterId=ch.id; setRewriteMode(false, null); branchContinuePending = false; branchBookId = null; loadCurChapter(); renderChapters(); saveAll(); await awaitNovelPersistence(); }); // v9.0：切章等待 IndexedDB 事务提交
            div.querySelector('[data-action="rename"]').addEventListener('click', async (e) => { e.stopPropagation(); if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再重命名"); return; } let nt=await appPromptAsync('新章节标题', '请输入章节标题', ch.title); if(nt&&nt.trim()){ const oldTitle = ch.title; ch.title=nt.trim(); renderChapters(); if(!await persistOrWarnAsync()) { ch.title = oldTitle; renderChapters(); return; } if(b.currentChapterId===ch.id) { const curChapName = $('curChapName'); if(curChapName) curChapName.innerText = ch.title.substring(0,25); } } });
            div.querySelector('[data-action="delete"]').addEventListener('click', async (e) => { e.stopPropagation(); if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再删除"); return; } const deletingCurrent = b.currentChapterId===ch.id; if(!deletingCurrent && !await ensureCurrentChapterSavedAndCommitted()) { toast("当前章节保存失败，已取消删除操作"); return; } if(!await appConfirmAsync(`确认删除章节「${ch.title}」？`)) return; const idx=b.chapters.findIndex(c=>c.id===ch.id); if(idx!==-1) { const removed=b.chapters[idx]; const oldCurrentId=b.currentChapterId; const oldLen=b.chapters.length; b.chapters.splice(idx,1); if(b.chapters.length===0) { b.chapters.push({ id:uuid(), title:"新章节", content:"# 新章节\n\n在这里开始写作...", prompt:"", checkResult:[], isContinuation:false, isInterlude:false, savedAt: Date.now() }); b.currentChapterId=b.chapters[0].id; toast("已清空所有章节，自动创建空白章节"); } else { if(b.currentChapterId===ch.id) b.currentChapterId=b.chapters[0]?.id||null; toast(`已删除「${ch.title}」`); } if(!await persistOrWarnAsync()) { if(oldLen===1) b.chapters.pop(); b.chapters.splice(idx,0,removed); b.currentChapterId=oldCurrentId; renderChapters(); loadCurChapter(); toast('保存失败，已恢复章节'); return; } clearBanterCachesFor(b.id, ch.id); removeChapterGrowthFromAll(b, ch.id); renderChapters(); loadCurChapter(); } }); // v9.0：删除章节等待 IDB 提交并失败回滚
            div.querySelector('[data-action="toggleInterlude"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成进行中，请等待完成或点击停止后再切换间章"); return; }
                const book = getCurrentBook(); if(!book) return;
                const chap = book.chapters.find(c=>c.id===ch.id);
                if(chap) {
                    chap.isInterlude = !chap.isInterlude;
                if(!await persistOrWarnAsync()) return; renderChapters();
                    toast(chap.isInterlude ? '已转为间章' : '已转回正章');
                }
            });
            chaptersList.appendChild(div);
        });
    }

    function loadCurChapter() {
        contentDirty = false;
        // v6.3：切章/切书时关闭冲突面板——面板随当前章节走，残留旧章节结果无意义
        const conflictPanelEl = $('conflictPanel'); if(conflictPanelEl) conflictPanelEl.style.display = 'none';
        conflictVisible = false;
        clearCheckMarks(); // v8.4-③-b：切章剥离正文标色
        // v7.8：吐槽面板同样随章节关闭；按钮按当前章是否有正文启用
        const banterPanelEl = $('banterPanel'); if(banterPanelEl) banterPanelEl.style.display = 'none';
        banterVisible = false;
        closeRoleplay(); // v7.9：切章自动退出试演（v8.5.1-P3：去重重复调用）
        const banterBtnEl = $('banterBtn');
        let banterEnabled = false;
        let b = getCurrentBook();
        const novelContent = $('novelContent'); const curChapName = $('curChapName'); const sumEl = $('summaryArea');
        if(!b) { if(novelContent) novelContent.innerText='✨ 左侧按钮，一键起书，创作你的第一本小说吧！'; if(sumEl) sumEl.value=''; if(banterBtnEl) { banterBtnEl.disabled = true; banterBtnEl.style.background = "#2A2A3A"; } return; }
        if(b.currentChapterId) {
            let c = b.chapters.find(ch=>ch.id===b.currentChapterId);
            if(c) {
                if(novelContent) novelContent.innerText = c.content;
                if(curChapName) curChapName.innerText = c.title?.substring(0,25)||'未命名';
                if(sumEl) sumEl.value = c.summary || '';
                updateWord();
                const checkBtn = $('checkConflictBtn');
                if(checkBtn) checkBtn.style.background = (c.checkResult && c.checkResult.length>0) ? "#C97A3A" : "#3A3A6A";
                banterEnabled = !!(c.content || '').trim();
                if(banterBtnEl) { banterBtnEl.disabled = !banterEnabled; banterBtnEl.style.background = banterEnabled ? "#3A3A5A" : "#2A2A3A"; }
                return;
            }
        }
        if(b.chapters.length) { b.currentChapterId = b.chapters[0].id; const c = b.chapters[0]; if(novelContent) novelContent.innerText = c.content; if(curChapName) curChapName.innerText = (c.title||'未命名').substring(0,25); if(sumEl) sumEl.value = c.summary||''; updateWord(); banterEnabled = !!(c.content || '').trim(); if(banterBtnEl) { banterBtnEl.disabled = !banterEnabled; banterBtnEl.style.background = banterEnabled ? "#3A3A5A" : "#2A2A3A"; } }
        else { if(novelContent) novelContent.innerText='✨ 在左侧输入创作指令生成第一章'; if(curChapName) curChapName.innerText='无章节'; if(sumEl) sumEl.value=''; if(banterBtnEl) { banterBtnEl.disabled = true; banterBtnEl.style.background = "#2A2A3A"; } }
    }

    async function addNewChapter() {
        let b = getCurrentBook(); if(!b) return;
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再新增章节"); return; } // v8.10-F017：补齐四标志——原新增章节改写 currentChapterId，吐槽/检测在途时 A 章结果缓存到新章/结果丢弃（HTML v5 复审 F-017 残余/EXE-V9-F05）
        if(!await ensureCurrentChapterSavedAndCommitted()) return;
        // 默认创建普通正章（与"新增章节"文案语义一致）；需要间章可点击 ⬌ 切换
        b.chapters.push({ id:uuid(), title:'新章节', content:"# 新章节\n\n在这里书写...", prompt:"", checkResult:[], isContinuation:false, isInterlude:false, savedAt: Date.now() }); // v8.6-r9：新建空章带 savedAt
        b.currentChapterId = b.chapters[b.chapters.length-1].id;
        const saved = saveAll() && await awaitNovelPersistence(); renderChapters(); loadCurChapter();
        toast(saved ? "新章节已添加（如需间章可点 ⬌ 切换）" : "⚠️ 章节已创建但保存失败，请检查存储空间");
    }
    async function changeChap(delta) {
        let b = getCurrentBook(); if(!b || !b.chapters.length) return;
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再切换章节"); return; } // v8.9-F05b：同章节点击入口补齐任务锁（EXE-V8-F05 同源）
        let idx = b.chapters.findIndex(c=>c.id===b.currentChapterId);
        let nidx = idx+delta;
        if(nidx>=0 && nidx<b.chapters.length) { if(!await ensureCurrentChapterSavedAndCommitted()) return; b.currentChapterId = b.chapters[nidx].id; setRewriteMode(false, null); branchContinuePending = false; branchBookId = null; loadCurChapter(); renderChapters(); saveAll(); await awaitNovelPersistence(); }
    }


