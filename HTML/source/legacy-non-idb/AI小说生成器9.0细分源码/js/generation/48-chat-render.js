    function addChat(role, content, returnId=false) {
        let book = getCurrentBook(); if(!book) return null;
        if(!book.chatHistory) book.chatHistory = [];
        let msg = { role, content, timestamp:new Date().toLocaleTimeString(), ts:Date.now(), id:uuid() }; // v7.6：ts 真实时间戳（统计每日输入字数用）
        book.chatHistory.push(msg);
        while(book.chatHistory.length > 50) book.chatHistory.shift();
        saveAll(); renderChat();
        if(returnId) return msg.id; return null;
    }
    function replaceChatMessage(id, newContent, targetBook) {
        let book = targetBook || getCurrentBook(); if(!book || !book.chatHistory) return;
        let msg = book.chatHistory.find(m=>m.id==id);
        if(msg) { msg.content = newContent; saveAll(); renderChat(); }
        else console.warn('replaceChatMessage: 未找到消息 id=', id, 'chatHistory 长度=', book.chatHistory.length);
    }
    function renderChat() {
        let book = getCurrentBook(); const chatMsgs = $('chatMsgs'); if(!chatMsgs) return;
        chatMsgs.innerHTML = '';
        if(!book || !book.chatHistory?.length) { chatMsgs.innerHTML='<div class="msg-bubble">输入创作指令</div>'; return; }
        book.chatHistory.forEach(m => {
            let d = document.createElement('div');
            d.className = m.role==='user' ? 'user-msg' : '';
            d.innerHTML = `<div class="msg-bubble">${escapeHtml(m.content)}</div><div style="font-size:9px;color:#6A627A;">${escapeHtml(m.timestamp)}</div>`; // v8.7-F01：timestamp 未转义——备份导入的 chatHistory 可携带任意字符串，含事件属性时会经 innerHTML 触发 XSS（审计 F-01）
            chatMsgs.appendChild(d);
        });
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }
    function clearChatHistory() {
        // 生成/双版选择期间清空聊天会丢失"生成中"占位消息 → 结果反馈无法显示
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) { toast("生成或双版选择进行中，暂不能清空聊天记录"); return; }
        const book = getCurrentBook();
        if(!book || !book.chatHistory || !book.chatHistory.length) { toast("聊天记录已为空"); return; }
        if(!confirm(`确认清空全部 ${book.chatHistory.length} 条聊天记录？此操作不可撤销。`)) return;
        book.chatHistory = []; saveAll(); renderChat();
        toast("聊天记录已清空"); updateStorageIndicator();
    }

    async function onSend() {
        let instr = $('chatInp')?.value.trim();
        if(!currentBookId) { toast("请先选择或创建小说"); return; }
        if(!instr) { toast("请输入创作指令"); return; }
        let book = getCurrentBook();
        if(importPending) { toast("备份导入进行中，请等待完成后再发送"); return; } // v8.10-F011：恢复读取窗口内禁止启动任务（原短任务可在窗口内完成、忙标志复位后仍被迟到备份覆盖，HTML v5 复审 F-011 残余）
        if(isGenerating) { toast("已有生成任务进行中"); return; }
        if(pendingPolish || polishMode) { toast(pendingPolish ? "润色进行中，请先等待完成" : "润色预览中，请先应用或取消"); return; }
        if(pendingBranch) { toast("走向生成中，请稍候"); return; } // v7.3 C3 修复：走向请求期间禁止并发生成
        if(banterBusy) { toast("吐槽生成中，请等待完成后再发送"); return; } // v8.7 EXE-87-F01 同步修复：吐槽在途禁止启动正文生成（正文/续写会新建或切换当前章，与吐槽"发起时当前章+指纹"的缓存基准冲突）
        if(!ensureCurrentChapterSaved()) return;
        sessionInputChars += instr.length; // v7.9m：本次输入字数累计（正文指令/续写/重写指令均计）
        addDailyInputStats(instr.length); // v8.1：独立存储每日输入字数（清空聊天不影响）
        // v7.2：重写态——发送 = 重写本章（pendingRewrite 由 onRegenerate 设置，切章节/完成/新生成时清除）
        if(pendingRewrite) {
            const pr = pendingRewrite;
            // 校验目标书/章仍存在（用户可能已切换小说）
            const tBook = pr.bookId ? books.find(b => b.id === pr.bookId) : book;
            if(!tBook) { toast("原小说已不存在，已取消重写"); setRewriteMode(false, null); return; }
            const tChap = tBook.chapters.find(c => c.id === pr.chapterId);
            if(!tChap) { toast("目标章节已不存在，已取消重写"); setRewriteMode(false, null); return; }
            // 若当前书不是目标书，切回目标书再重写（防数据写入错书）
            if(currentBookId !== tBook.id) {
                const sw = switchBook(tBook.id);
                if(!sw || currentBookId !== tBook.id) { toast("无法切回目标小说，已取消重写"); setRewriteMode(false, null); return; }
            }
            setRewriteMode(false, null);
            await doRegenerateWithInstr(instr, pr.chapterId);
            return;
        }
        // v7.2：走向态——发送 = 续写（走向已填入消息栏）
        if(branchContinuePending) {
            // v7.3 C1 修复：校验走向所属书仍为当前书（走向生成中切书 → 拦截，防跨书上下文错配）
            if(branchBookId && branchBookId !== currentBookId) {
                branchContinuePending = false; branchBookId = null;
                toast("走向来自其他小说，已取消续写，请重新发起");
                return;
            }
            branchContinuePending = false; branchBookId = null;
            await doContinueWithInstr(instr);
            return;
        }
        // v5.8：用户手动发起新任务即放弃旧挂起任务——防 API 配置保存失败后
        // 保留的 pendingGeneration 在之后重新保存 API 时意外自动重试（幽灵章节）
        if(pendingGeneration) cancelPendingGeneration('⚠️ 已被新的生成任务覆盖');
        // v5.8：双版模式在任务启动时立即单次消费（与精准模式一致）——
        // 若在 await 之后才关闭，旧任务异步收尾会把用户停止后重新打开的双版开关误关
        const useDualMode = api.dualMode;
        if(useDualMode) { api.dualMode = false; saveAll(); updateDualModeButton(); }
        // v8.0.34：连发多章同样在任务启动时单次消费
        const useMultiChap = api.multiChap;
        if(useMultiChap) { api.multiChap = false; saveAll(); updateDualModeButton(); }
        
        // v8.0.34：连发多章模式
        if(useMultiChap) { await runMultiChap(instr, book); return; }
        
        // Non-dual or continue/regen: original flow
        if(!useDualMode) {
            addChat('user', instr);
            if($('chatInp')) $('chatInp').value = '';
            let lid = addChat('assistant', '✍️ 生成中...', true);
            const startTime = Date.now();
            const wasPrecision = book?.precisionMode || false;
            await executeGeneration(instr, false, null, false, lid, (chap, cost, aborted, saveFailed, abortReason) => {
                if(chap) {
                    const elapsed = formatTime(Date.now() - startTime);
                    let tail = cost > 0 ? ` (正文 $${cost.toFixed(2)}USD) (耗时：${elapsed})` : ` (耗时：${elapsed})`; // v8.4-④：预估→正文，明确该笔为正文部分
                    lastGenCostRef = { bookId: book.id, chapId: chap.id, cost: cost }; // v8.4-④：供摘要完成合并展示
                    if(wasPrecision) tail += ' (精准模式)';
                    // v5.8：保存失败时聊天显示警告而非普通成功（toast 一闪而过，聊天是持久状态）
                    if(saveFailed) {
                        replaceChatMessage(lid, `⚠️ 已生成第${book.chapters.length}章《${chap.title}》但本地保存失败！请立即导出或复制正文，刷新可能丢失`, book);
                        toast('⚠️ 章节已生成但保存失败，请立即导出备份或复制正文');
                    } else {
                        replaceChatMessage(lid, `✅ 已生成第${book.chapters.length}章《${chap.title}》${tail}`, book);
                        startTabBlink(`✅ 已生成第${book.chapters.length}章《${chap.title}》`);
                    }
                    if(book && book.precisionMode) { book.precisionMode = false; saveAll(); updatePrecisionButton(); }
                } else { replaceChatMessage(lid, aborted ? (abortReason === 'timeout' ? '⏹ 生成超时（10分钟）已取消' : '⏹ 已停止') : '❌ 生成失败', book); if(!aborted) startTabBlink('❌ 生成失败'); } // v8.7-M3：超时与主动停止聊天文案分开
            });
            return;
        }
        
        // DUAL MODE: first-time generation only
        if(isGenerating) return;
        addChat('user', instr);
        if($('chatInp')) $('chatInp').value = '';
        const dualLid = addChat('assistant', '🔀 并发生成 A/B 版本中...', true);
        await runDualGeneration(instr, book, dualLid);
        // 双版开关已在任务启动时消费（v5.8），此处不再关闭——防旧任务收尾误关用户新开关
    }

