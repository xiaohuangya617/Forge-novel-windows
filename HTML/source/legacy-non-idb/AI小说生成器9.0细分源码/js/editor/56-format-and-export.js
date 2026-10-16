    // ===== 字体大小调整 =====
    function changeFontSize(delta) {
        currentFontSize = Math.min(24, Math.max(12, currentFontSize + delta));
        const novelContent = $('novelContent');
        if(novelContent) novelContent.style.fontSize = currentFontSize + 'px';
        const fontSizeVal = $('fontSizeVal'); if(fontSizeVal) fontSizeVal.innerText = currentFontSize + 'px';
        try { localStorage.setItem('editor_font_size', currentFontSize); } catch(e) {}
    }

    // v8.7-N2：本地时间戳工具（8.7 更新清单 N2）——导出文件名统一用系统本地时间，精度到秒：
    // 原 `fmtStamp()` ①仅到日期（同日多次导出同名互覆盖）②toISOString 为 UTC（UTC+8 本地 0:00-8:00 文件名日期比系统日期早一天）
    function fmtStamp() {
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }
    function fmtDayDash() { // 本地日期键 YYYY-MM-DD（每日统计等天粒度用途；原 toISOString 为 UTC 日期，本地凌晨会错一天）
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return '' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function sanitizeFilename(name) { let f = (name||'未命名').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').replace(/^\.+/, '').replace(/^_+$/, 'untitled').substring(0, 50); return f || 'untitled'; }
    function exportFull() {
        let b = getCurrentBook(); if(!b || !b.chapters.length) { toast("无内容"); return; }
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) toast("⚠️ 生成或双版选择进行中，导出内容不包含未完成结果");
        if(polishMode) { toast("润色预览中，请先应用或取消后再导出"); return; }
        if(!syncCurChapterToMemory()) return; // v8.7-F003：导出救援只要求编辑器→内存同步（syncCurChapterToMemory 不含持久化）——存储满时最新正文在内存，必须允许导出 Blob 救援，不能被 saveAll 失败阻断（原 ensureCurrentChapterSaved 会取消导出）
        toast("正在生成导出文件…"); // v7.4 M7 修复：大书导出前给进度反馈（Blob 构建为同步操作，避免体感卡死）
        // 正文章号独立计数（间章不占号）：第一章→间章→第二章，而非 1→间章→3
        let regularNo = 0;
        let txt = b.chapters.map(ch => { const label = ch.isInterlude ? '间章' : '第'+(++regularNo)+'章'; return `${label} ${ch.title}\n\n${ch.content}\n\n`; }).join('');
        let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt],{type:"text/plain"})); a.download = `${sanitizeFilename(b.name)}_全书_${fmtStamp()}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("全书导出成功");
    }
    function exportCurrentChapter() {
        let b = getCurrentBook(); if(!b || !b.currentChapterId) { toast("请先选择章节"); return; }
        let c = b.chapters.find(ch=>ch.id===b.currentChapterId);
        if(!c) { toast("未找到当前章节"); return; }
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) toast("⚠️ 生成或双版选择进行中，导出内容不包含未完成结果");
        if(polishMode) { toast("润色预览中，请先应用或取消后再导出"); return; }
        if(!syncCurChapterToMemory()) return; // v8.7-F003：导出救援——内存同步即可，持久化失败不阻断（原 ensure 会因存储满取消导出本章，最新正文将无法救援）
        let txt = `${c.title}\n\n${c.content}`;
        let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt],{type:"text/plain"}));
        a.download = `${sanitizeFilename(b.name)}_${sanitizeFilename(c.title)}_${fmtStamp()}.txt`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(`已导出本章「${c.title}」`);
    }
