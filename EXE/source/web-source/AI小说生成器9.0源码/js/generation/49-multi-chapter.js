    // v8.5.2-P1：连发多章进行中标志——连发内部任务不释放全局锁（isGenerating/写作锁），
    // 由 runMultiChap 统一管理；防第 N 章摘要/正文 finally 误释放第 N+1 章生成中的锁
    let multiChapRunning = false;
    // v8.0.34：连发多章——第1章按指令生成，之后每章自动续写，直到 N 章
    async function runMultiChap(instr, book) {
        const runToken = ++multiChapRunToken;
        const count = Math.max(2, Math.min(10, api.multiChapCount || 3));
        // v8.7-F001：连发启动前统一校验 API 配置——原每章 executeGeneration 各自返回 need-api 且循环不检查，缺 Key 时全轮零生成却显示"共生成 N 章"假成功（项目零审查 F-001）
        if(!api.key) { toast('请先配置 API Key 再开始连发'); openApiModal(); return; }
        // v8.3：连发目标记忆——用户指令转「连发目标」贯穿每章（第2章起不再丢失方向）
        const goal = (instr && instr.trim()) ? '【连发目标】' + instr + '\n请沿此方向持续推进，每章要有独立进展，避免一章内仓促完成全部目标。' : '';
        addChat('user', instr);
        if($('chatInp')) $('chatInp').value = '';
        let lid = addChat('assistant', '📚 连发多章：共 ' + count + ' 章，正在生成第 1/' + count + ' 章...', true);
        const startTime = Date.now();
        // v8.0.35：连发多章状态行（startSbStages 不清空它）
        sbMultiRunning = true;
        summarySkippedChaps = []; // v8.6-②：本轮连发清空摘要跳过记录
        multiChapRunning = true; // v8.5.2-P1：连发进行中标志——内部任务不释放全局锁，防止锁被摘要/正文 finally 误解
        const multiStages = [
            { pct: 15, text: '正在回顾前文…' },
            { pct: 45, text: '正在构思续写走向…' },
            { pct: 75, text: '正在撰写正文…' },
            { pct: 90, text: '正在收尾…' }
        ];
        startSbStages(multiStages, 20000, '⚠️ 请勿关闭网页，等待AI续写中...');
        setSbMultiStatus(0, count);
        let stopped = false, failedAt = 0, timedOutAt = 0, needApiAt = 0; // v8.7-M3：timedOutAt——连发中某章 10 分钟超时与主动停止分开标识；v8.7-F001：needApiAt——缺 Key 暂停整轮（入口已拦，此为运行中防御）
        // v8.5.2-P1-2：连发会话基准——stopGeneration 会推进 generationSessionId（含摘要阶段点停止，
        // 摘要用独立 controller 无法被 abort），每章启动前对比预期进度，被停止打断即不再启动下一章
        const multiBaseSession = generationSessionId;
        for(let i = 1; i <= count; i++) {
            if(stopped) break;
            // v8.5.2-P1-2：第 i 章启动前，预期会话号 = base + (i-1)（每章 executeGeneration 推进 1 次）；
            // 若已被 stopGeneration 额外推进（摘要阶段停止/用户发了新任务）→ 不再启动本章，静默终止连发
            if(generationSessionId > multiBaseSession + (i - 1)) { stopped = true; break; }
            replaceChatMessage(lid, '📚 连发多章：正在生成第 ' + i + '/' + count + ' 章...', book);
            const isFirst = (i === 1);
            // v8.0.35：每章启动进度窗口（第1章按生文节奏 40s/生文中，后续续写 20s/续写中）+ 更新状态行
            startSbStages(
                isFirst ? [{pct:15,text:'正在构思本章内容…'},{pct:45,text:'正在撰写正文…'},{pct:75,text:'正在润饰行文…'},{pct:90,text:'正在收尾…'}] : multiStages,
                isFirst ? 40000 : 20000,
                isFirst ? '⚠️ 请勿关闭网页，等待AI生文中...' : '⚠️ 请勿关闭网页，等待AI续写中...'
            );
            setSbMultiStatus(i - 1, count);
            const rExec = await executeGeneration(
                isFirst ? instr : goal,     // v8.3：第1章用指令，之后注入连发目标
                false, null, !isFirst, lid, // isCont=true 走续写链路（getPrev 注入前文）
                (chap, cost, aborted, saveFailed, abortReason) => {
                    if(aborted) { stopped = true; if(abortReason === 'timeout' && !timedOutAt) timedOutAt = i; return; } // v8.7-M3：记录超时章号（不覆盖已记录值）
                    if(!chap) { stopped = true; failedAt = i; }
                    else if(cost > 0) lastGenCostRef = { bookId: book.id, chapId: chap.id, cost: cost }; // v8.5.2-P3-7：连发每章补成本快照——摘要 toast 合并「正文 x，摘要经历 y，共 z」
                },
                false, null, book ? book.id : null,
                true, // v8.5.2-P1：来自连发多章——启动检查放行、finally 保持全局锁（锁由本函数统一管理）
                runToken
            );
            // v8.7-F001：检查每章返回——need-api（Key 缺失/被清）时暂停整轮，绝不再报"共生成 N 章"假成功（executeGeneration 已挂起该章为待配置任务）
            if(rExec && rExec.status === 'need-api') { stopped = true; if(!needApiAt) needApiAt = i; break; }
            if(rExec === null && !stopped) { stopped = true; if(!failedAt) failedAt = i; } // 其他前置失败（地址无效等）：按失败中断处理（executeGeneration 已 toast）
        }
        const runSkippedChaps = summarySkippedChaps.slice();
        const ownsMultiState = runToken === multiChapRunToken;
        if(ownsMultiState) {
            sbMultiRunning = false;
            summaryGrowthPending = false; // v8.6-fix25：连发收尾清挂起标志（防手动摘要 finally 不清导致的残留卡死）
            multiChapRunning = false; // v8.5.2-P1：连发结束，统一释放全局锁与写作锁（摘要 finally 若仍挂起会再释放一次，幂等无害）
            isGenerating = false;
            setWritingLockTip('');
            setWritingLock(false);
            const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
        }
        if(ownsMultiState) { const mEl = $('sbProgressMulti'); if(mEl) mEl.innerText = ''; }
        const elapsed = formatTime(Date.now() - startTime);
        // v8.6-②+P2-1：完成消息延迟一个宏任务——末章摘要的 setTimeout(0) 记录先执行，跳过提示不漏（同步拼接会漏末章）
        setTimeout(() => {
            const skipTxt = runSkippedChaps.length ? '；⚠️ 摘要被跳过：' + runSkippedChaps.join('、') + '（可手动重新生成）' : '';
            if(needApiAt) { // v8.7-F001：缺 Key 暂停整轮——不报假成功
                replaceChatMessage(lid, '⏸ 连发多章暂停：第 ' + needApiAt + '/' + count + ' 章需配置 API Key（已生成 ' + (needApiAt - 1) + ' 章；配置 Key 后将自动重试该单章）' + skipTxt, book);
                startTabBlink('⏸ 连发暂停：请配置 API Key');
            } else if(timedOutAt) { // v8.7-M3：超时优先于"已停止"（超时是模型慢/请求大，不是用户操作）
                replaceChatMessage(lid, '⏱ 连发多章中断：第 ' + timedOutAt + '/' + count + ' 章生成超时（10分钟）已取消（已生成 ' + (timedOutAt - 1) + ' 章，耗时 ' + elapsed + '）' + skipTxt, book);
                startTabBlink('⏱ 连发多章超时中断');
            } else if(failedAt) {
                replaceChatMessage(lid, '❌ 连发多章中断：第 ' + failedAt + '/' + count + ' 章生成失败（已生成 ' + (failedAt - 1) + ' 章，耗时 ' + elapsed + '）' + skipTxt, book);
                startTabBlink('❌ 连发多章中断');
            } else if(stopped) {
                replaceChatMessage(lid, '⏹ 连发多章已停止' + skipTxt, book);
                startTabBlink('⏹ 连发多章已停止');
            } else {
                replaceChatMessage(lid, '✅ 连发多章完成：共生成 ' + count + ' 章（耗时 ' + elapsed + '）' + skipTxt, book);
                startTabBlink('✅ 连发多章完成：' + count + ' 章');
            }
        }, 0);
        if(ownsMultiState) stopSbStages();
        if(ownsMultiState) resetSbProgress();
    }

