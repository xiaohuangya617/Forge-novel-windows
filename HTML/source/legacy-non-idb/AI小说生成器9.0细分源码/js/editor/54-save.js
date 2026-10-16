    let contentDirty = false;
    function markContentDirty() { contentDirty = true; const saveSpan = $('saveStatus'); if(saveSpan) saveSpan.innerText = '未保存'; const book = getCurrentBook(); const chap = book && book.currentChapterId ? book.chapters.find(c=>c.id===book.currentChapterId) : null; if(chap) { chap.checkRequestVersion = (chap.checkRequestVersion || 0) + 1; chap.summaryRequestVersion = (chap.summaryRequestVersion || 0) + 1;
        // v6.3：编辑正文不再清空 checkState/checkResult（用户编辑后会主动点「重新检测」更新，
        // 旧结果保留供查看）；仅递增版本号使在途检测/摘要结果作废（竞态保护不变）
        // v6.0：正文编辑同时递增 summaryRequestVersion——摘要在途时编辑正文，旧摘要返回也会被丢弃，
        // 否则旧正文摘要会被写入并被后续章节作为前文上下文注入，造成剧情错位
        // v6.3：按钮颜色按保留的 checkResult 着色（有旧冲突保持橙色，与面板保留结果一致）——
        // 修复前强制变蓝会与"结果保留"状态矛盾（按钮显示无冲突、面板却有旧冲突）
        const checkBtn = $('checkConflictBtn'); if(checkBtn) checkBtn.style.background = (chap.checkResult && chap.checkResult.length) ? "#C97A3A" : "#3A3A6A"; } }
    // v8.7-F003：编辑器→章节内存同步（不含持久化）——存储满时导出救援路径只要求"内存最新"，不应被 saveAll 失败阻断（项目零审查 F-003）
    function syncCurChapterToMemory() {
        if(polishMode) return true;
        let b = getCurrentBook(); if(!b) return true;
        if(!b.currentChapterId) return true; // v8.7-F013：无当前章节 = 无正文可同步 = 空操作成功——完整备份（含 API/素材/草稿等非章节数据）不应被静默取消（原返回 false 使 exportBackup 无条件中止，空书/无书时零下载零提示，为 F-003 重构引入的回归）
        let c = b.chapters.find(ch=>ch.id===b.currentChapterId);
        const el = $('novelContent'); if(!c || !el) return false;
        if(checkMarksActive && !conflictVisible) clearCheckMarks(); // v8.4-③-b：保存前剥离检查标色防 <mark> 污染；v8.4.2：面板打开时保留标色（getEditorText 剥标签，数据不受污染），高亮持续到关面板
        c.content = getEditorText(); contentDirty = false;
        if(!c.savedAt) c.savedAt = Date.now(); // v7.6：章节首次保存记录时间戳（统计每日字数/连续更新/码字时点用）
        const sumEl = $('summaryArea'); if(sumEl && sumEl.value.trim() !== SUMMARY_PLACEHOLDER) { const newSummary = sumEl.value.trim().slice(0, 300); if(c.summary !== newSummary) { c.summary = newSummary; c.summaryRequestVersion = (c.summaryRequestVersion || 0) + 1; } }
        return true;
    }
    function saveCurChapter() {
        // v7.3 修复：润色预览态（polishMode）下禁止保存——正文含 <mark> 红绿理由标签，
        // getEditorText 剥标签会把"旧+新+📎理由"拼接污染正文。所有保存路径（30s自动保存/
        // blur/切章/快捷键/导出）都走这里，源头一刀切；应用/取消直接操作 chap+saveAll 不受影响
        if(!syncCurChapterToMemory()) return false;
        const ok = saveAll();
        if(ok) { const saveSpan = $('saveStatus'); if(saveSpan) saveSpan.innerText = '已存'; updateWord(); renderChapters(); banterPanelInvalidate(true); } // v8.7 EXE-87-R6/R7-F01：保存成功（正文定稿点）经统一失效入口刷新面板并清陈旧提示——键随内容更新后旧点评不再残留（读新键为空则显示"暂无吐槽"）
        else { contentDirty = true; }
        const bkNow = getCurrentBook(); const chNow = bkNow && bkNow.currentChapterId ? bkNow.chapters.find(x=>x.id===bkNow.currentChapterId) : null;
        const checkBtn = $('checkConflictBtn'); if(checkBtn && chNow) checkBtn.style.background = (chNow.checkResult && chNow.checkResult.length>0) ? "#C97A3A" : "#3A3A6A";
        return ok;
    }
    // 保存当前章节并校验成功：切换章节/书籍/发送/续写/重写/新增/导出等操作前置调用，
    // localStorage 满导致保存失败时取消操作，防未保存编辑在切换时被覆盖丢失
    function ensureCurrentChapterSaved() {
        const book = getCurrentBook();
        if(!book || !book.currentChapterId) return true;
        const ok = saveCurChapter();
        if(!ok) { toast("当前章节保存失败，已取消本次操作"); return false; }
        return true;
    }
    function getEditorText() {
        const el = $('novelContent'); if(!el) return '';
        let html = el.innerHTML;
        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<\/div>/gi, '\n');
        html = html.replace(/<\/p>/gi, '\n');
        html = html.replace(/<[^>]+>/g, '');
        // v8.6-fix27：单次完整解码——原链式 replace 会把正文中字面实体文本二次解码篡改（数据损坏）；textarea RCDATA 只解一层
        try {
            const ta = document.createElement('textarea');
            ta.innerHTML = html;
            return ta.value;
        } catch(e) { return html; }
    }
    function updateWord() {
        const novelContent = $('novelContent'); const wordCount = $('wordCount');
        if(novelContent && wordCount) { let txt = getEditorText(); wordCount.innerText = txt.replace(/\s+/g,'').length; }
    }

