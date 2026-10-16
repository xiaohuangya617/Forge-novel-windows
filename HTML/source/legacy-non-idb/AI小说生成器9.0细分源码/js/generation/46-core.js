    async function executeGeneration(instr, isRegen=false, targetId=null, isCont=false, chatId=null, onSuccess=null, isDual=false, controller=null, sourceBookId=null, fromMultiChap=false) {
        // Prerequisites — no state changes
        // 来源书优先（API 配置后自动重试场景：原书可能已不是当前书，必须生成回原书）
        let book = (sourceBookId ? books.find(b=>b.id===sourceBookId) : null) || getCurrentBook();
        if(!book) { toast("请先创建或选择小说"); return null; }
        if(!apiUrlValid(api.url)) { toast("API 地址无效（需以 http:// 或 https:// 开头），请重新配置"); openApiModal(); return null; }
        if(!api.key) {
            toast("请先配置 API Key"); openApiModal();
            pendingGeneration = { sourceBookId: book.id, instr, isRegen, targetId, isCont, chatId, onSuccess, isDual };
            // v5.8：等待配置 Key 不是失败——不触发失败回调（否则显示"❌ 生成失败"误导），
            // 直接更新聊天为等待态；saveApi 保存后自动重试成功会覆盖为"✅"
            if(chatId && !isDual) replaceChatMessage(chatId, '⚙️ 请配置 API Key，保存后将自动重试', book);
            return { status: 'need-api' };
        }
        // State lock — after all prerequisites pass
        if(!isDual && isGenerating && !fromMultiChap) { toast("已有生成任务进行中，请等待或点击停止"); return null; } // v8.5.2-P1：连发内部任务（fromMultiChap）放行，用户任务仍被全局锁拦截
        if(!isDual) isGenerating = true;
        // 会话号：单版任务启动即成为最新会话（旧任务随之过期，finally 不再清理）；
        // 双版不在此递增（由 runDualGeneration 统一管理）
        const sessionId = isDual ? 0 : ++generationSessionId;
        const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = false;
        const localCtrl = controller || new AbortController();
        currentAbortController = localCtrl;
        // v5.8：单版生成期间锁定编辑器（双版已隐藏编辑器，不锁）
        if(!isDual) setWritingLock(true);
        // v8.0.14：伪阶段进度窗口——续写 20s/生文重写 40s 一格，最后一格卡住等真实完成
        if(!isDual) {
            if(isCont) {
                startSbStages([{pct:15,text:'正在回顾前文…'},{pct:45,text:'正在构思续写走向…'},{pct:75,text:'正在撰写正文…'},{pct:90,text:'正在收尾…'}], 20000, '⚠️ 请勿关闭网页，等待AI续写中...');
            } else if(isRegen) {
                startSbStages([{pct:15,text:'正在理解原文…'},{pct:45,text:'正在重新构思本章…'},{pct:75,text:'正在重写正文…'},{pct:90,text:'正在收尾…'}], 40000, '⚠️ 请勿关闭网页，等待AI重写中...');
            } else {
                startSbStages([{pct:15,text:'正在构思本章内容…'},{pct:45,text:'正在撰写正文…'},{pct:75,text:'正在润饰行文…'},{pct:90,text:'正在收尾…'}], 40000, '⚠️ 请勿关闭网页，等待AI生文中...');
            }
        }
        let idx = isRegen ? book.chapters.findIndex(c=>c.id===targetId) : book.chapters.length;
        if(idx===-1) idx=book.chapters.length;
        let prev = getPrev(book, idx);
        // v8.4-①缓存分区：稳定段（全局动作库/服装库固定提示）前置——可命中缓存；创作指令中段；【前文】垫底（变段不拖垮前缀）
        let user = '';
        if(globalActions.length) user += `请严格按照【全局动作库】中的定义来描写动作。\n\n`;
        if(globalCostumes.length) user += `请严格按照【全局服装库】中的定义来描写服装。\n\n`;
        if(isCont) {
            let ci = (instr && instr.trim()) ? instr : `请续写下一章（保持连贯），使用Markdown标题格式 "# 章节标题"。`;
            user += `${ci}\n\n【前文】\n${prev}`;
        } else if(isRegen) {
            let effectiveInstr = (instr && instr.trim()) ? instr : `请根据前文重新创作本章，保持连贯。`;
            user += `${effectiveInstr}\n\n【前文】\n${prev}`;
        } else {
            user += `创作指令：${instr}\n\n【前文】\n${prev}\n\n请以 Markdown 标题格式 "# 章节标题" 开头输出正文。`;
        }
        // v7.8：摘要/成长已从正文请求移除——改为正文生成后由合并请求独立生成（generateSummaryGrowth），
        // 正文输出预算全部用于正文，避免长输出末尾被截断导致摘要/成长丢失
        let stopWordsArray = [];
        if(api.stopWords && api.stopWords.trim()) stopWordsArray = api.stopWords.split(',').map(s=>s.trim()).filter(s=>s);
        let body = {
            model: api.model,
            messages: [{role:"system",content:buildSys(book, (!isCont && !isRegen) || book.precisionMode)},{role:"user",content:user}],
            temperature: api.temp, top_p: api.top_p, repetition_penalty: api.repetition_penalty,
            max_tokens: api.maxTokens, frequency_penalty: api.freqPenalty, presence_penalty: api.presPenalty,
            stop: stopWordsArray.length === 1 ? stopWordsArray[0] : (stopWordsArray.length ? stopWordsArray : undefined)
        };
        if(api.thinking) { body.thinking = { type: 'enabled' }; body.reasoning_effort = api.reasoningEffort || 'high'; }
        let timeoutId; let timedOut = false;
        try {
            timeoutId = setTimeout(() => { timedOut = true; localCtrl.abort(); }, 600000);
            let res = await fetch(api.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${api.key}`},
                body:JSON.stringify(body),
                signal: localCtrl.signal
            });
            if(!res.ok) {
                if(res.status === 401) throw new Error("API Key 无效(401)");
                if(res.status === 429) throw new Error("请求过于频繁，请稍后重试(429)");
                if(res.status === 402) throw new Error("API 余额不足(402)");
                throw new Error(await extractApiError(res)); // v6.5：兜底错误带后端具体原因
            }
            let data = await res.json();
            // 会话校验：响应解析完成后的首个异步节点——停止后旧任务响应已到达时在此拦截，
            // 不继续写入章节（abort 对已到达的响应无效，必须有逻辑层面的过期校验）
            if(!isDual && sessionId !== generationSessionId) {
                if(chatId) replaceChatMessage(chatId, '⏹ 已停止（旧任务结果已丢弃）', book);
                return null;
            }
            let content = data.choices[0]?.message?.content;
            if(!content) throw new Error("API 返回内容为空");
            // v7.4 H1 修复：截断检测——API 因 max_tokens/上下文超限返回半截时，finish_reason='length'，
            // 必须提示用户且标记本章未完成，防半截正文被当完整章节保存、又作为前文逐章累积污染
            // v7.8 增强：finish_reason 非 stop 且 completion_tokens 顶满 max_tokens*0.98 时也判定疑似截断
            //（部分中转站不报 length 时兜底）
            let truncated = false;
            try {
                const fr = data.choices && data.choices[0] && data.choices[0].finish_reason;
                if(fr === 'length') truncated = true;
                else if(data.usage && data.usage.completion_tokens && api.maxTokens && data.usage.completion_tokens >= Math.max(api.maxTokens, 1) * 0.98) truncated = true;
            } catch(e) {}
            let totalCost = 0;
            if(data.usage && (data.usage.prompt_tokens || data.usage.completion_tokens)) {
                totalCost = calcCost(api.model, data.usage); // v7.8：按模型+缓存命中计费
                if(totalCost > 0) recordCost(totalCost); // v7.8.1：累计消耗金额
                setCtxBudgetFromUsage(data.usage.prompt_tokens, data.usage.completion_tokens); // v8.5.2-A：生文真实 usage 覆盖预算条
            }
            // v7.8：摘要/成长已移至正文后合并请求（generateSummaryGrowth），正文请求不再解析标记，content 即完整正文
            let defaultTitle = isCont ? `续写` : ((instr && instr.trim().length <= 20) ? instr.trim() : "新章节");
            let title = extractTitle(content, defaultTitle);
            // v7.1 兜底：标题自动补章号（不依赖 AI 自觉）——新建按 idx 计算正章号，重写保持目标章号
            // v8.6-fix34（Bug2）：识别中文数字章号（AI 常输出"第五十二章"）——原正则只识别阿拉伯数字，
            // 中文数字章号被误判为"无章号"→ 按位置重复补"第N章 "前缀 → 产生"第48章 第五十二章"双章号
            if(title && !/^第\s*(?:\d+|[零〇一二三四五六七八九十百千两]+)\s*章/.test(title)) {
                const tRegular = (book.chapters || []).slice(0, idx).filter(c => !c.isInterlude).length + 1;
                title = '第' + tRegular + '章 ' + title;
            }
            let newChap = { id: uuid(), title, content, prompt: isCont ? (instr||'续写指令') : instr, checkResult: [], isContinuation: isCont ? true : false, isInterlude: false, summary: '', savedAt: Date.now() }; // v8.6-r9：建章即带 savedAt（统计写作日/日均字依赖）
            // v5.8 修复（严重回归）：saved 必须在 if(!isDual) 块外声明——
            // 之前在块内 let 声明、块外访问会抛 ReferenceError: saved is not defined，
            // 导致单版（章节已写入但反馈失败）与双版（A/B 全失败）同时崩溃
            let saved = isDual ? null : false;
            if(!isDual) {
            // 写入前二次校验：res.json 后到写入前若任务已过期（停止+新任务），丢弃结果
            if(sessionId !== generationSessionId) {
                if(chatId) replaceChatMessage(chatId, '⏹ 已停止（旧任务结果已丢弃）', book);
                return null;
            }
            if(isRegen && targetId) {
                let i = book.chapters.findIndex(c=>c.id===targetId);
                if(i!==-1) { let oldChap = book.chapters[i]; newChap.id = oldChap.id; if(title === defaultTitle && oldChap.title) newChap.title = oldChap.title; book.chapters[i] = newChap; newChap.prompt = oldChap.prompt; newChap.isContinuation = oldChap.isContinuation; newChap.isInterlude = oldChap.isInterlude; if(oldChap.summary) newChap.summary = oldChap.summary; book.currentChapterId = newChap.id; } // v7.8：重写保留旧摘要（合并请求回来后覆盖）
                else { toast("⚠️ 目标章节已不存在，作为新章节添加"); book.chapters.push(newChap); book.currentChapterId = newChap.id; sessionGenChars += (newChap.content || '').length; }
            } else {
                book.chapters.push(newChap);
                sessionGenChars += (newChap.content || '').length; // v7.9m 本次生成字数（新增章节）
                book.currentChapterId = newChap.id;
            }
                saved = saveAll();
                if(!saved) toast('⚠️ 内容已生成但存储空间不足，关闭页面前请导出备份！');
                // v7.4 H1 修复：截断标记——finish_reason='length' 时提示用户并标记章节未完成，
                // 防半截正文被当完整章节（该章后续作为前文注入时也如实提示）
                if(truncated) {
                    newChap.truncated = true;
                    toast('⚠️ 输出可能被截断（达到长度上限）！建议降低每章字数或减少上下文章节数，再检查本章结尾');
                    if(chatId) replaceChatMessage(chatId, '⚠️ 输出可能被截断（达到长度上限），建议检查本章结尾；摘要与经历仍将基于已生成正文生成', book);
                } else { newChap.truncated = false; }
                renderChapters(); loadCurChapter();
                // v7.8：正文生成完成（单版）→ 保持锁定 → 合并请求生成摘要+经历 → 完成/超时后解锁
                if(!isDual) {
                    summaryGrowthPending = true;
                    setWritingLockTip('📝 正文已生成，摘要与经历生成中…');
                    const sgBook = book, sgChap = newChap;
                    setTimeout(() => { void generateSummaryGrowth(sgBook, sgChap, null, { fromGeneration: true }).catch(() => { summaryGrowthPending = false; if(!multiChapRunning) isGenerating = false; setWritingLock(false); }); }, 0); // v8.6-r16：摘要异常 catch 补 isGenerating 释放（新逻辑保持锁，防永久卡死）
                }
                // v7.6：精准模式生成成功后，累计本次勾选的角色/动作/服装引用次数（统计看板三库 TOP10 数据源；旧书无历史数据）
                if(((!isCont && !isRegen) || book.precisionMode) && book.precisionMode && ((book.precisionChars||[]).length + (book.precisionActions||[]).length + ((book.precisionCostumes||[]).length) > 0)) {
                    if(!book.precisionStats) book.precisionStats = { chars: {}, actions: {}, costumes: {} };
                    (book.precisionChars||[]).forEach(pid => { book.precisionStats.chars[String(pid)] = (book.precisionStats.chars[String(pid)]||0) + 1; });
                    (book.precisionActions||[]).forEach(pid => { book.precisionStats.actions[String(pid)] = (book.precisionStats.actions[String(pid)]||0) + 1; });
                    (book.precisionCostumes||[]).forEach(pid => { book.precisionStats.costumes[String(pid)] = (book.precisionStats.costumes[String(pid)]||0) + 1; });
                }
                // v7.3：冲突检测改为仅手动（用户拍板）——生成后不再自动检测，省每章一次 API
                // void afterChapterGenerated(book, newChap, isRegen ? idx : book.chapters.length-1).catch(err => console.warn(err));
            }
            // v5.8：第4参 saveFailed 传给回调——保存失败时聊天必须显示警告而非普通成功
            if (onSuccess) onSuccess(newChap, totalCost, false, !saved);
            return { chap: newChap, cost: totalCost, saved: !!saved };
        } catch(e) {
            if(e.name === 'AbortError') { if(timedOut) toast("生成超时（10分钟）已取消，建议调低 maxTokens 或关闭思考模式"); else if(!isDual) toast("生成已取消"); if (onSuccess) onSuccess(null, 0, true, false, timedOut ? 'timeout' : 'stop'); return null; } // v8.7-M3：透传 abortReason——超时与主动停止共用一个 aborted 标志，聊天侧据此区分文案（原统一"⏹ 已停止"掩盖超时真相）
            toast("生成失败: "+e.message);
            if (onSuccess) onSuccess(null, 0); return null;
        } finally {
            clearTimeout(timeoutId);
            if(!isDual) {
                // 会话号校验：若此任务已不是最新会话（停止后新任务已启动），
                // 不得清理全局状态——否则会清空新任务的状态
                if(sessionId !== generationSessionId) return;
                // v8.5.2-P1：连发内部任务（fromMultiChap）且连发未结束 → 保持全局锁与写作锁，
                // 防第 N 章摘要/正文 finally 误释放第 N+1 章正文生成中的锁（原 v8.3 遗留：锁被解、用户编辑被 AI 结果覆盖）
                const keepLock = fromMultiChap && multiChapRunning;
                if(!keepLock && !summaryGrowthPending) isGenerating = false; // v8.6-r16：有摘要待启动（summaryGrowthPending）则保持 isGenerating——原无条件置 false，宏任务窗口内用户可并发启动新任务、新章摘要被静默跳过
                const stopBtn = $('stopGenBtn'); if(stopBtn) stopBtn.disabled = true;
                currentAbortController = null;
                stopSbStages(); resetSbProgress(); // v8.0.14：清理进度窗口
                // v7.8：正文完成后进入"摘要与经历生成中"阶段，锁定由合并请求完成/超时后释放
                if(!summaryGrowthPending && !keepLock) setWritingLock(false);
            }
        }
    }

