    let stopDebounce = null;
    function stopGeneration() {
        // v7.4 E2 修复：300ms 防抖——防用户先点停止再立刻点重新生成时误触（旧任务已过期，无需重复中止）
        if(stopDebounce) return; stopDebounce = setTimeout(() => { stopDebounce = null; }, 300);
        // 立即使所有在途任务过期：旧任务的响应即使已到达，后续写入/回调也会被 sessionId 校验拦截
        generationSessionId++;
        if(dualAbortControllers.length) {
            // 双版生成中点停止：置停止标志，runDualGeneration both-failed 分支据此显示"⏹ 已停止"而非"生成失败"
            dualStopRequested = true;
            // 立即更新聊天（不等 allSettled），防 abort 回调延迟时用户看到"生成中"残留
            const sb = dualOriginBookId ? books.find(b => b.id === dualOriginBookId) : getCurrentBook();
            if(sb && dualChatId) replaceChatMessage(dualChatId, '⏹ 正在停止 A/B 双版生成...', sb);
            dualAbortControllers.forEach(c => { try { c.abort(); } catch(e) {} });
            dualAbortControllers = [];
            dualPendingChapA = null; dualPendingChapB = null;
            dualOriginBookId = null;
            dualChatId = null; dualStartTime = 0; dualWasPrecision = false; dualCosts = {A:0, B:0};
            // v5.8 补收尾：旧 runDualGeneration 会在 allSettled 后因会话检查直接 return（不负责清理），
            // 此处必须完整释放生成锁与双版活跃会话，否则 isGenerating 永久卡死、候选状态残留
            isGenerating = false;
            currentAbortController = null;
            dualActiveSessionId = 0;
            const stopBtnA = $('stopGenBtn'); if(stopBtnA) stopBtnA.disabled = true;
            const splitEl = $('editorSplit'); if(splitEl) splitEl.remove();
            const nc = $('novelContent'); if(nc) nc.style.display = ''; const sw = $( 'summaryAreaWrap'); if(sw) sw.style.display = '';
            stopSbStages(); resetSbProgress(); // v8.7-M2：双版生成中停止也要清进度浮层与定时器（原 finally 会话早退跳过清理，浮层常驻+interval 空转）
            loadCurChapter();
        } else if(dualPendingChapA || dualPendingChapB) {
            // 双版已生成完毕、等待选择时点击停止：放弃选择，更新聊天记录为"已放弃"，
            // 清理双版 UI（防聊天显示"请选择保留"与实际状态矛盾）
            const originBook = dualOriginBookId ? books.find(b => b.id === dualOriginBookId) : getCurrentBook();
            if(originBook && dualChatId) {
                replaceChatMessage(dualChatId, '⏹ 已放弃 A/B 双版结果，未保存任何版本', originBook);
            }
            dualStopRequested = true;
            dualPendingChapA = null; dualPendingChapB = null;
            dualOriginBookId = null;
            dualChatId = null; dualStartTime = 0; dualWasPrecision = false; dualCosts = {A:0, B:0};
            const splitEl = $('editorSplit'); if(splitEl) splitEl.remove();
            const nc = $('novelContent'); if(nc) nc.style.display = ''; const sw = $( 'summaryAreaWrap'); if(sw) sw.style.display = '';
            // 关键：释放生成锁（等待选择时 isGenerating 保持 true，此处必须复位，
            // 否则"已有生成任务进行中"永久拦截所有操作，只能刷新页面）
            isGenerating = false;
            currentAbortController = null;
            dualActiveSessionId = 0; // 与分支1 一致：停止即作废双版活跃会话
            const stopBtn2 = $('stopGenBtn'); if(stopBtn2) stopBtn2.disabled = true;
            stopSbStages(); resetSbProgress(); // v8.7-M2：等待选版时停止同样清理进度浮层（双版进度已结束但浮层可能残留）
            loadCurChapter();
            toast("已放弃 A/B 两版结果，未保存章节");
            return;
        }
        if(currentAbortController) { currentAbortController.abort(); currentAbortController = null; }
        if(currentSummaryController) { currentSummaryController.abort(); currentSummaryController = null; } // v8.5.3-P2-2：摘要阶段停止（摘要用独立 controller，原无法中止）
        isGenerating = false;
        const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
        stopSbStages(); resetSbProgress(); // v8.7-M2：普通生成/摘要/连发停止也要清理——旧任务 finally 因会话号早退跳过清理（HTML 3702 只在会话匹配时执行），此处兜底补上
        setWritingLock(false); // v5.8：停止即解锁编辑器（旧任务 finally 会因会话过期跳过解锁）
        toast("已请求停止生成");
    }

