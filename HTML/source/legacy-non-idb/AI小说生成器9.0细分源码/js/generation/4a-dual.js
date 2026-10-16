    async function runDualGeneration(instr, book, dualLid) {
        // v5.8：双版启动前先检查 API Key——无 Key 时提前挂起单条待生成任务并提示，
        // 避免两个并行 executeGeneration 各自创建 pendingGeneration（重复覆盖）+ 先显示"并发生成中"
        if(!api.key) {
            pendingGeneration = { sourceBookId: book ? book.id : null, instr, isRegen: false, targetId: null, isCont: false, chatId: dualLid, onSuccess: null, isDual: true };
            if(dualLid && book) replaceChatMessage(dualLid, '⚙️ 请配置 API Key，保存后将自动重试双版生成', book);
            openApiModal();
            toast("请先配置 API Key");
            return;
        }
        dualStopRequested = false;
        // 双版会话号：本任务的最新会话；停止后若用户已发新任务（会话号被新任务推进）则放弃清理
        const dualSessionId = ++generationSessionId;
        dualActiveSessionId = dualSessionId; // 供 finalize/选版校验
        isGenerating = true;
        dualChatId = dualLid;
        dualOriginBookId = book ? book.id : currentBookId; // 重试场景 book 为原书（可能非当前书）
        const startTime = Date.now();
        const wasPrecision = book?.precisionMode || false;
        dualStartTime = startTime; dualWasPrecision = wasPrecision; dualCosts = {A:0, B:0};
        
        // Setup split editor — hide novelContent, append split div
        const editorArea = document.querySelector('.editable-area');
        if(!editorArea) { isGenerating = false; return; }
        const novelContent = $('novelContent');
        if(novelContent) novelContent.style.display = 'none'; const sw2 = $( 'summaryAreaWrap'); if(sw2) sw2.style.display = 'none';
        const split = document.createElement('div');
        split.id = 'editorSplit';
        split.className = 'editor-split';
        split.innerHTML = '<div class="split-pane" id="splitPaneA" style="cursor:pointer;" title="点击选择保留此版本" onclick="window._selectDualVersion(\'A\')"><div class="split-pane-header"><span>📗 版本 A</span><span style="font-size:0.6rem;color:#8A84A8;" id="splitStatusA">⏳ 生成中...</span></div><div class="split-pane-content" id="splitContentA">⏳ 生成中...</div></div><div class="split-pane" id="splitPaneB" style="cursor:pointer;" title="点击选择保留此版本" onclick="window._selectDualVersion(\'B\')"><div class="split-pane-header"><span>📘 版本 B</span><span style="font-size:0.6rem;color:#8A84A8;" id="splitStatusB">⏳ 生成中...</span></div><div class="split-pane-content" id="splitContentB">⏳ 生成中...</div></div>';
        editorArea.appendChild(split);
        
        // Launch both in parallel
        const controllerA = new AbortController(), controllerB = new AbortController();
        dualAbortControllers = [controllerA, controllerB];
        // 来源书穿透（v5.8）：API 配置后自动重试场景 book 可能是原书（非当前书），
        // executeGeneration 必须按来源书生成，否则双版结果写错书
        const execA = executeGeneration(instr, false, null, false, dualLid, null, true, controllerA, book.id).then(r => ({r, ver:'A'}));
        const execB = executeGeneration(instr, false, null, false, dualLid, null, true, controllerB, book.id).then(r => ({r, ver:'B'}));
        const results = await Promise.allSettled([execA, execB]);

        // 会话/停止检查（v5.8）：必须在写入候选之前判断任务是否已过期或已停止——
        // 否则停止后旧任务返回会重新写回 dualPendingChapA/B，再因会话不一致 return
        // 时跳过清理，造成候选状态残留 + isGenerating 永久卡死（只能再点一次停止恢复）
        if(dualSessionId !== generationSessionId || dualStopRequested) return;

        const aOk = results[0].status==='fulfilled' && results[0].value.r?.chap;
        const bOk = results[1].status==='fulfilled' && results[1].value.r?.chap;
        const aChap = aOk ? results[0].value.r.chap : null;
        const bChap = bOk ? results[1].value.r.chap : null;
        const aCost = aOk ? results[0].value.r.cost : 0;
        const bCost = bOk ? results[1].value.r.cost : 0;
        // v8.5.1-P0：删除原 recordCost(aCost, sourceBook && sourceBook.id)——
        // sourceBook 在 runDualGeneration 作用域未定义（ReferenceError 双版必崩，v8.3 遗留）；
        // 成本已由 executeGeneration(3582) 无条件记账（双版期间 switchBook 被拦截，当前书=源书），此处为重复记账
        
        dualPendingChapA = aChap; dualPendingChapB = bChap;
        dualCosts.A = aCost; dualCosts.B = bCost;
        const elapsed = formatTime(Date.now() - startTime);

        // 用户主动停止：丢弃全部结果（与"某一版自然失败自动保留"区分）
        // stopGeneration 已清理 UI/状态，此处只须防成功版本被写入
        if(dualStopRequested) {
            // 会话号校验：停止后用户已发新任务（会话号被新任务推进）→ 放弃本任务的清理，
            // 防止把新任务的状态清空（旧任务与新任务交叠的关键防护）
            if(dualSessionId !== generationSessionId) return;
            const splitEl = $('editorSplit'); if(splitEl) splitEl.remove();
            const nc = $('novelContent'); if(nc) nc.style.display = ''; const sw = $( 'summaryAreaWrap'); if(sw) sw.style.display = '';
            replaceChatMessage(dualLid, '⏹ 已停止，A/B 结果已丢弃', book);
            dualPendingChapA = null; dualPendingChapB = null;
            dualOriginBookId = null;
            dualChatId = null; dualStartTime = 0; dualWasPrecision = false; dualCosts = {A:0, B:0};
            dualAbortControllers = []; dualStopRequested = false;
            currentAbortController = null;
            isGenerating = false;
            const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
            loadCurChapter();
            return;
        }
        
        if(aOk && bOk) {
            // Both ok - show both for selection
            document.getElementById('splitStatusA').innerHTML = '<span style="color:#4AE06A;">✅ 完成</span> <span style="font-size:0.55rem;color:#8A84A8;">正文 $'+aCost.toFixed(2)+'</span>';
            document.getElementById('splitStatusB').innerHTML = '<span style="color:#4AE06A;">✅ 完成</span> <span style="font-size:0.55rem;color:#8A84A8;">正文 $'+bCost.toFixed(2)+'</span>';
            // 分屏顶部展示各版本摘要（同请求已生成），便于选版对比
            const aSum = aChap.summary ? '\n\n📝 摘要：'+aChap.summary : '';
            const bSum = bChap.summary ? '\n\n📝 摘要：'+bChap.summary : '';
            document.getElementById('splitContentA').innerText = '📗 '+aChap.title+aSum+'\n\n'+aChap.content;
            document.getElementById('splitContentB').innerText = '📘 '+bChap.title+bSum+'\n\n'+bChap.content;
            document.getElementById('splitContentA').style.cursor = 'pointer';
            document.getElementById('splitContentB').style.cursor = 'pointer';
            const totalCost = aCost + bCost;
            const tail = totalCost>0?' (正文合计 $'+totalCost.toFixed(2)+'USD) (耗时：'+elapsed+')':' (耗时：'+elapsed+')';
            const aWC = aChap ? aChap.content.length : 0;
            const bWC = bChap ? bChap.content.length : 0;
            replaceChatMessage(dualLid, '🔀 A/B两版均生成完成 (A版正文 $'+aCost.toFixed(2)+'，字数'+aWC+') (B版正文 $'+bCost.toFixed(2)+'，字数'+bWC+') '+tail+' — 请点击左侧版本选择保留', book);
            if(book && book.precisionMode) { book.precisionMode = false; saveAll(); updatePrecisionButton(); }
        } else if(aOk || bOk) {
            // One failed - auto keep the successful one
            const winner = aOk ? 'A' : 'B';
            const chap = aOk ? aChap : bChap;
            const cost = aOk ? aCost : bCost;
            finalizeDualSelection(winner, chap, book, dualLid, startTime, cost, wasPrecision, true);
            toast('版本 '+(aOk?'B':'A')+' 生成失败，已自动保留版本 '+winner);
        } else {
            // Both failed
            const splitEl = $('editorSplit'); if(splitEl) splitEl.remove();
            const nc = $('novelContent'); if(nc) nc.style.display = ''; const sw = $( 'summaryAreaWrap'); if(sw) sw.style.display = '';
            if(dualStopRequested) {
                replaceChatMessage(dualLid, '⏹ 已停止', book);
            } else if(pendingGeneration) {
                // 无 API Key：等待配置，saveApi 将自动重试
                replaceChatMessage(dualLid, '⚠️ 需要配置 API Key，保存后自动重试双版生成', book);
                toast('请配置 API Key 后保存');
            } else {
                toast('A/B 两个版本均生成失败');
                startTabBlink('❌ A/B 两版均生成失败');
                replaceChatMessage(dualLid, '❌ A/B 两版均生成失败', book);
            }
        }
        
        dualAbortControllers = [];
        dualStopRequested = false;
        currentAbortController = null;
        // both-ok 时保持锁定直到用户选择（finalizeDualSelection 释放）；其他分支已由 finalize 或此处释放
        if(!dualPendingChapA && !dualPendingChapB) {
            // v5.8：两版均失败（或自然收尾）也清空活跃会话——与 stop/finalize/resetAll 清理标准一致
            dualActiveSessionId = 0;
            isGenerating = false;
            const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
        }
    }
    window._selectDualVersion = function(ver) {
        const book = dualOriginBookId ? books.find(b => b.id === dualOriginBookId) : getCurrentBook();
        if(!book || !dualPendingChapA || !dualPendingChapB) { toast("选择已失效，请重新生成或刷新页面"); return; }
        const cost = ver==='A' ? dualCosts.A : dualCosts.B;
        // msgId 兜底：dualChatId 意外失效时，从聊天记录找回"并发生成"那条消息
        let msgId = dualChatId;
        if(!msgId && book.chatHistory) {
            const found = [...book.chatHistory].reverse().find(m => m.role==='assistant' && m.content && m.content.indexOf('🔀 并发生成') !== -1);
            if(found) msgId = found.id;
        }
        finalizeDualSelection(ver, ver==='A'?dualPendingChapA:dualPendingChapB, book, msgId, dualStartTime, cost, dualWasPrecision);
    };
    
    function finalizeDualSelection(ver, chap, book, lid, startTime, cost, wasPrecision, autoKeep=false) {
        // 会话校验：停止后新任务已启动（会话推进）→ 旧双版的选版/定稿失效，防结果写入新任务流程
        if(dualActiveSessionId !== generationSessionId) { toast("双版结果已失效"); return; }
        try {
            book.chapters.push(chap);
            sessionGenChars += (chap.content || '').length; // v7.9m 本次生成字数（双版新增章节）
            book.currentChapterId = chap.id;
            // v7.8：成长不再随正文请求生成、无 growthPending 挂载；选中版本后保持锁定，
            // 由合并请求（generateSummaryGrowth）生成摘要+经历，完成/超时后解锁
            const savedOk = saveAll();
            // v8.6-fix31：双版选中也累计精准统计（原仅单版 executeGeneration 累计，双版路径 TOP10 排行缺失）
            if(book.precisionMode && ((book.precisionChars||[]).length + (book.precisionActions||[]).length + ((book.precisionCostumes||[]).length) > 0)) {
                if(!book.precisionStats) book.precisionStats = { chars: {}, actions: {}, costumes: {} };
                (book.precisionChars||[]).forEach(pid => { book.precisionStats.chars[String(pid)] = (book.precisionStats.chars[String(pid)]||0) + 1; });
                (book.precisionActions||[]).forEach(pid => { book.precisionStats.actions[String(pid)] = (book.precisionStats.actions[String(pid)]||0) + 1; });
                (book.precisionCostumes||[]).forEach(pid => { book.precisionStats.costumes[String(pid)] = (book.precisionStats.costumes[String(pid)]||0) + 1; });
            }
            lastGenCostRef = { bookId: book.id, chapId: chap.id, cost: cost }; // v8.4.4-P2.1：双版选版补正文成本快照——摘要完成合并展示「正文 x，摘要经历 y，共 z」（对齐单版）
            // v7.3：冲突检测改为仅手动——双版选中同样不再自动检测
            // const chIdx = book.chapters.length - 1;
            // void afterChapterGenerated(book, chap, chIdx).catch(err => console.warn(err));
            // Remove split div, show novelContent
            const splitEl = $('editorSplit'); if(splitEl) splitEl.remove();
            const nc = $('novelContent'); if(nc) nc.style.display = ''; const sw = $( 'summaryAreaWrap'); if(sw) sw.style.display = '';
            renderChapters(); loadCurChapter();
            // v7.8：选中版本后保持锁定，合并请求生成摘要+经历，完成/超时后解锁
            summaryGrowthPending = true;
            setWritingLock(true);
            setWritingLockTip('📝 正文已生成，摘要与经历生成中…');
            const sgBook = book, sgChap = chap;
            setTimeout(() => { void generateSummaryGrowth(sgBook, sgChap, null, { fromGeneration: true }).catch(() => { summaryGrowthPending = false; if(!multiChapRunning) isGenerating = false; setWritingLock(false); }); }, 0); // v8.6-r16：摘要异常 catch 补 isGenerating 释放（新逻辑保持锁，防永久卡死）
            // 反馈消息与精准关闭：独立保护，任何异常都不阻塞锁释放
            try {
                if(lid) {
                    const elapsed = formatTime(Date.now() - startTime);
                    let tail = cost>0?' (正文 $'+cost.toFixed(2)+'USD) (耗时：'+elapsed+')':' (耗时：'+elapsed+')';
                    if(wasPrecision) tail += ' (精准模式)';
                    const wc = '('+(chap.content ? chap.content.length : 0)+')';
                    if(!savedOk) {
                        const failTxt = '⚠️ 版本'+ver+'已选择但本地保存失败！请立即导出或复制正文，刷新可能丢失';
                        replaceChatMessage(lid, failTxt, book);
                        toast('⚠️ 版本已选择但本地保存失败，请立即导出或复制正文');
                        startTabBlink('⚠️ 双版保存失败');
                    } else if(autoKeep) {
                        const msgTxt = '⚠️ 版本'+(ver==='A'?'B':'A')+'生成失败，已自动保留版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》 (字数'+wc+') '+tail;
                        replaceChatMessage(lid, msgTxt, book);
                        toast('✅ 已自动保留版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》 (字数'+wc+') '+tail); // 兜底反馈
                        startTabBlink('✅ 已自动保留版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》');
                    } else {
                        const msgTxt = '✅ 已选择版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》 (字数'+wc+') '+tail;
                        replaceChatMessage(lid, msgTxt, book);
                        toast('✅ 已选择版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》 (字数'+wc+') '+tail); // 兜底反馈
                        startTabBlink('✅ 已选择版本'+ver+'：第'+book.chapters.length+'章《'+chap.title+'》');
                    }
                }
                if(book && wasPrecision) { book.precisionMode = false; saveAll(); updatePrecisionButton(); }
            } catch(e) { console.warn('双版选择反馈异常(不影响结果):', e); }
        } finally {
            // 状态清理：无论成功失败，必释放生成锁与双版状态，保证可继续操作
            dualPendingChapA = null; dualPendingChapB = null;
            dualOriginBookId = null;
            dualChatId = null; dualStartTime = 0; dualWasPrecision = false; dualCosts = {A:0, B:0};
            dualAbortControllers = [];
            dualActiveSessionId = 0;
            currentAbortController = null;
            isGenerating = false;
            const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
        }
    }

