    // v7.2 实际执行续写（走向自动发送 / branchContinuePending 发送共用）
    async function doContinueWithInstr(instr) {
        if(banterBusy) { toast("吐槽生成中，请等待完成后再续写"); return; } // v8.7 EXE-87-R2-F01 收口：续写共享入口（走向卡片手动/自动续写均直达本函数）与吐槽互斥——迟到吐槽会按续写后新章重算缓存键污染新章
        let book = getCurrentBook();
        if(!book || !book.chapters.length) { toast("请先生成第一章后再续写"); return; }
        // v8.7-F04b：走向归属校验兜底（复审 F-04：卡片生成后切书，自动续写路径直接调本函数无归属校验——branchBookId 非空且不属于当前书则作废卡片状态并拒绝）
        if(branchBookId && String(branchBookId) !== String(book.id)) {
            branchContinuePending = false; branchBookId = null;
            const bm = $('branchModal'); if(bm) bm.style.display = 'none';
            toast('走向来自其他小说，已取消续写，请重新发起');
            return;
        }
        if(isGenerating) { toast("已有生成任务进行中，请等待或点击停止"); return; }
        if(!await ensureCurrentChapterSavedAndCommitted()) return;
        if(pendingGeneration) cancelPendingGeneration('⚠️ 已被新的生成任务覆盖');
        if(instr) { addChat('user', instr); }
        if($('chatInp')) $('chatInp').value = '';
        let lid = addChat('assistant', instr ? `⏳ 根据走向续写：${instr.slice(0, 30)}...` : '⏳ 续写中...', true);
        const startTime = Date.now();
        await executeGeneration(instr, false, null, true, lid, (chap, cost, aborted, saveFailed, abortReason) => {
            if(chap) {
                const elapsed = formatTime(Date.now() - startTime);
                let tail = cost > 0 ? ` (正文 $${cost.toFixed(2)}USD) (耗时：${elapsed})` : ` (耗时：${elapsed})`;
                if(saveFailed) {
                    replaceChatMessage(lid, `⚠️ 续写第${book.chapters.length}章《${chap.title}》完成但本地保存失败！请立即导出或复制正文，刷新可能丢失`, book);
                    toast('⚠️ 续写完成但保存失败，请立即导出备份或复制正文');
                } else {
                    replaceChatMessage(lid, `✅ 续写第${book.chapters.length}章《${chap.title}》完成${tail}`, book);
                    startTabBlink(`✅ 续写完成：第${book.chapters.length}章《${chap.title}》`);
                }
            } else { if(!aborted) startTabBlink('❌ 续写失败'); replaceChatMessage(lid, aborted ? (abortReason === 'timeout' ? '⏹ 续写超时（10分钟）已取消' : '⏹ 已停止') : '❌ 续写失败', book); } // v8.7-M3：超时与主动停止文案分开
        });
    }
    async function onContinue() {
        if(importPending) { toast("备份导入进行中，请等待完成后再生成走向"); return; } // v8.10-F011
        let book = getCurrentBook();
        if(!book || !book.chapters.length) { toast("请先生成第一章后再续写"); return; }
        if(isGenerating) { toast("已有生成任务进行中，请等待或点击停止"); return; }
        if(pendingPolish || polishMode) { toast(pendingPolish ? "润色进行中，请先等待完成" : "润色预览中，请先应用或取消"); return; }
        if(pendingBranch) { toast("走向生成中，请稍候"); return; }
        if(banterBusy) { toast("吐槽生成中，请等待完成后再生成走向"); return; } // v8.7 EXE-87-F01 同步修复：吐槽在途禁止生成走向（走向会跳转/新建章节，与吐槽缓存基准冲突）
        if(!await ensureCurrentChapterSavedAndCommitted()) return;
        // v7.8：续写常态锁定——先弹窗确认，确认后才跳转最新章节（v8.6-r14：原逻辑先跳章再确认，取消后不跳回，用户输入落入错误章节）
        if(book.chapters.length) {
            const last = book.chapters[book.chapters.length - 1];
            const changed = book.currentChapterId !== last.id;
            if(!await appConfirmAsync('是否生成续写剧情导向？' + (changed ? '\n将跳转至最新章节《' + (last.title || '未命名') + '》。' : '\n将基于最新章节《' + (last.title || '未命名') + '》生成 3 个剧情走向卡片。') + '\n确认后生成走向，选中卡片后才会续写。')) return;
            if(changed) {
                book.currentChapterId = last.id;
                setRewriteMode(false, null); branchContinuePending = false; branchBookId = null;
                loadCurChapter(); renderChapters(); saveAll(); await awaitNovelPersistence();
            }
        }
        if(pendingGeneration) cancelPendingGeneration('⚠️ 已被新的生成任务覆盖');
        // v7.2：发起新生成（续写）即退出重写态（用户拍板：发送完成/切章节/新生成三时机清状态）
        setRewriteMode(false, null);
        // v7.3 C2 修复：发起新走向请求前清旧走向待发态（防"选卡片→再点续写→取消→Ctrl+Enter 意外续写旧内容"）
        branchContinuePending = false; branchBookId = null;
        // v7.2：聊天区显示"生成走向中"消息 + 锁定正文编辑（用户拍板：让用户知道正在生成导向）
        const branchLid = addChat('assistant', '⏳ 生成走向中...', true);
        setWritingLock(true);
        // v7.2：先请求 3 个走向（独立 API，复用正文配置），锁定续写入口
        pendingBranch = true;
        // v8.0.23：续写走向也加伪阶段进度窗口（20s 一格）
        startSbStages([
            { pct: 15, text: '正在分析前文与角色…' },
            { pct: 45, text: '正在构思三个剧情走向…' },
            { pct: 75, text: '正在撰写走向大纲…' },
            { pct: 90, text: '正在收尾整理…' }
        ], 20000, '⚠️ 请勿关闭网页，等待AI导向中...');
        try {
            const result = await requestBranchOutlines(book);
            if(!result.ok) {
                // v7.2 修复：失败/超时除了 toast（2.5s 易漏看），聊天记录持久可见 + 页签闪烁
                toast(result.err);
                replaceChatMessage(branchLid, '❌ ' + result.err, book);
                startTabBlink('❌ 走向生成失败');
                return;
            }
            replaceChatMessage(branchLid, '✅ 已生成 3 个剧情走向，请选择' + (result.cost ? `（消费 $${result.cost.toFixed(2)} USD）` : ''), book);
            showBranchCards(result.outlines);
            startTabBlink('✅ 已生成 3 个剧情走向，请选择');
        } finally {
            pendingBranch = false;
            setWritingLock(false);
            stopSbStages(); resetSbProgress(); // v8.0.23：清理走向进度窗口
        }
    }
    
