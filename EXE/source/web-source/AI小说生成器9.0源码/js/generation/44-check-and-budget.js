    // ======================== 单章摘要（v5.8） ========================
    // 正文生成时同请求附带【摘要】；本函数仅用于「重新生成」手动触发（独立轻量请求），
    // 并带虚构文学数据安全声明，避免 AI 因正文敏感内容而拒绝总结。
    const SUMMARY_PLACEHOLDER = '⏳ 摘要生成中...';
    // v6.0：摘要生成进行中标志——防重复点击发起多个摘要请求浪费 API 费用
    let summaryGenerating = false;
    let summarySkippedChaps = []; // v8.6-②：连发多章中被跳过的摘要章号记录——完成消息提示用户可手动补
    let currentSummaryController = null; // v8.5.3-P2-2：摘要在途 controller——供 stopGeneration 中止（摘要阶段可停止）
    // v8.4-④：生文完成时的正文成本快照（bookId/chapId/cost）——供自动摘要完成后合并展示总成本
    let lastGenCostRef = null;
    // v8.4-③-b：检查正文标色激活标志（保存/切章/关面板时剥离 <mark> 防污染数据）
    let checkMarksActive = false;
    // v8.4-②：上下文预算占用进度条——实时估算本次请求 token（输入×0.7 + 固定开销），绿/黄/红三态
    // v8.5.2-A：发送后用 API 真实 usage（prompt+completion）覆盖；再次输入回到估算
    // v8.5.3-FIX：本块必须定义在顶层作用域——6 个请求函数（生文/摘要/检测/润色/吐槽/走向）直接调用 setCtxBudgetFromUsage，
    // 原误定义在 bindEvents 闭包内导致「setCtxBudgetFromUsage is not defined」请求失败
    let ctxBudgetReal = null; // { p: prompt_tokens, c: completion_tokens }——最近一次真实请求
    function renderCtxBudget(pct, color, detailText) {
        const fill = $('ctxBudgetFill'); const pctEl = $('ctxBudgetPct'); const detailEl = $('ctxBudgetDetail');
        if(!fill || !pctEl) return;
        fill.style.width = pct + '%';
        fill.style.background = color;
        pctEl.textContent = pct + '%';
        pctEl.style.color = color;
        if(detailEl) detailEl.textContent = detailText || '';
    }
    function updateCtxBudgetBar() {
        ctxBudgetReal = null; // 新输入 → 回到估算（真实值仅保留到下一次请求）
        const inp = $('chatInp');
        const book = getCurrentBook();
        const idx = book ? book.chapters.findIndex(c => c.id === book.currentChapterId) : -1;
        const fixed = book && idx >= 0 ? (buildSys(book, !!book.precisionMode) + (getPrev(book, idx) || '')).length : 12000;
        const estTok = Math.ceil((fixed + (inp ? (inp.value || '').length : 0)) * 0.7);
        const budget = getContextWindow(api.model);
        const reserve = Math.min(Number(api.maxTokens) || 1000, Math.floor(budget * 0.25));
        const totalEst = estTok + reserve;
        // v8.4-P2.3：真正超限才封顶 100%（红），接近未超只显示 99%（黄）
        const pct = (totalEst >= budget) ? 100 : Math.min(99, Math.round(totalEst / budget * 100));
        let color = '#3BAF5A';
        if(pct >= 80 && pct < 100) color = '#F0C05A';
        else if(pct >= 100) color = '#FF6B6B';
        renderCtxBudget(pct, color, totalEst >= budget ? ('估算（含输出预留，超限前请减少设定或章节）') : ('估算（含输出预留）'));
    }
    // v8.5.2-A：发送后真实 usage 覆盖（prompt+completion 共用 64K 窗口）
    function setCtxBudgetFromUsage(promptTok, completionTok) {
        if(!promptTok && !completionTok) return;
        ctxBudgetReal = { p: promptTok || 0, c: completionTok || 0 };
        const budget = getContextWindow(api.model);
        const total = ctxBudgetReal.p + ctxBudgetReal.c;
        const pct = (total >= budget) ? 100 : Math.min(99, Math.round(total / budget * 100));
        let color = '#3BAF5A';
        if(pct >= 80 && pct < 100) color = '#F0C05A';
        else if(pct >= 100) color = '#FF6B6B';
        renderCtxBudget(pct, color, '真实 入' + ctxBudgetReal.p + '/出' + ctxBudgetReal.c + ' / 窗口 ' + budget);
    }

    async function recheckCurrentChapter() {
        if(importPending) { toast('备份导入进行中，请等待完成后再检测'); return; } // v8.10-F011
        // v6.0：检测进行中禁止重复发起（自动/手动检测共用 conflictCheckingCount，
        // 防网络慢/思考模式时重复点击产生多个 API 请求浪费费用；计数在 finally 中可靠释放）
        if(conflictCheckingCount > 0) { toast('冲突检测进行中，请稍候'); return; }
        const book = getCurrentBook(); if(!book || !book.currentChapterId) { toast("请先选择章节"); return; }
        const chap = book.chapters.find(c=>c.id===book.currentChapterId); if(!chap) return;
        const idx = book.chapters.findIndex(c=>c.id===chap.id);
        // v5.9：先同步编辑器中的未保存正文到章节数据——检测必须基于用户当前看到的最新正文，
        // 否则 AI 会基于旧 chap.content 检测（saveCurChapter 即使 localStorage 保存失败也已写入内存）
        if(book.currentChapterId === chap.id) saveCurChapter();
        // 正文快照：检测期间正文被编辑/章节被替换 → 结果作废（防旧结果覆盖新正文）
        const contentSnapshot = chap.content;
        const chapterId = chap.id;
        // 请求版本号：连续点击"重新检测"并发时，只保留最新一次结果（防旧结果覆盖新结果）
        chap.checkRequestVersion = (chap.checkRequestVersion || 0) + 1;
        const requestVersion = chap.checkRequestVersion;
        setConflictChecking(true);
        // v8.0.35：冲突检查接入伪阶段进度窗口（20s 一格）
        startSbStages([
            { pct: 15, text: '正在读取本章与上下文…' },
            { pct: 45, text: '正在扫描设定冲突…' },
            { pct: 75, text: '正在核对前后文一致性…' },
            { pct: 90, text: '正在汇总结果…' }
        ], 20000, '⚠️ 请勿关闭网页，等待AI检测中...');
        try {
            // v8.5.2-P3-2：旧 20000 预算前文构造已移除（runChapterCheck 内部改用 buildCheckPrev 前3章≤1000）
            const result = await runChapterCheck(book, chap, true);
            // 检测期间用户可能已切换章节/书籍/正文已编辑，结果作废
            if(book.currentChapterId !== chapterId || currentBookId !== book.id) return;
            const current = book.chapters.find(c => c.id === chapterId);
            if(!current || current.content !== contentSnapshot) return;
            if(current.checkRequestVersion !== requestVersion) return; // 已有更新的检测请求
            const checkBtn = $('checkConflictBtn');
            if(result.ok) {
                if(result.cost > 0) recordCost(result.cost); // v7.8.1：累计消耗金额
                current.checkResult = (result.conflicts || []).filter(c => (c.severity || 'mid') !== 'low'); current.checkState = 'done'; // v8.4.2：落库即过滤 low 提示性条目——通知/按钮/面板数量自动一致
                if(result.checkReport) current.checkReport = result.checkReport; else delete current.checkReport; // v8.4-③-b：完整报告（五档+维度；v8.4.2 去语言表达维度/fix_tickets 仅不展示，模型残留字段无害）
                if(checkBtn) checkBtn.style.background = current.checkResult.length ? "#C97A3A" : "#3A3A6A";
                const cCostTxt = result.cost ? `（消费 $${result.cost.toFixed(2)} USD）` : '';
                if(current.checkResult.length) toast(`检测发现 ${current.checkResult.length} 处潜在冲突${cCostTxt}`);
                else toast(`未检测到明显冲突${cCostTxt}`);
                // v8.4-④：检查系统通知补金额（toast 已有，系统通知此前缺失）
                startTabBlink(current.checkResult.length ? `✅ 检测发现 ${current.checkResult.length} 处冲突${cCostTxt}` : '✅ 未检测到明显冲突' + cCostTxt);
                // v8.4.1-⑥-b：检查完成通知到左侧聊天面板
                const gradeTxt = current.checkReport && current.checkReport.overall_grade ? `，评级 ${current.checkReport.overall_grade}` : '';
                // v8.7-C-友2：规则层 AI 味评分随检测结果展示（词表扫描零成本；与模型评级双通道并存）
                const ruleScan = scanAiTaste(current.content || '');
                const aiScoreTxt = '【AI 味规则层 ' + ruleScan.score + '/100' + (ruleScan.hits ? '，命中 ' + ruleScan.hits + ' 处】' : '，无命中】');
                addChat('assistant', aiScoreTxt + (current.checkResult.length ? `✅ 检测完成${gradeTxt}，发现 ${current.checkResult.length} 处冲突${cCostTxt}` : `✅ 检测完成${gradeTxt}，未检测到明显冲突${cCostTxt}`));
                if(conflictVisible) renderConflictPanel(current); // v8.4-③-b：面板开着时刷新渲染 + 重新标色
            } else {
                // v8.6-r13：失败不再清空既有检测结果（原无条件清空+落盘，一次瞬时失败就抹掉上一轮有效结果并持久化为"检测失败"，用户需重新付费检测）——保留旧结果仅提示
                if(checkBtn) checkBtn.style.background = (current.checkResult && current.checkResult.length) ? "#C97A3A" : "#3A3A6A"; // v9.0：失败保留上一轮结果时，按钮颜色必须与保留结果一致
                // v8.7-C-友3：模型失败优雅降级——规则层有命中时展示词表检测结果，不空手而归
                const ruleScanF = scanAiTaste(current.content || '');
                if(ruleScanF.hits) { const rt = aiTasteHitsText(ruleScanF); const failMsg = (result.error || '') || '未知错误'; addChat('assistant', '⚠️ 模型检测失败：' + failMsg + '\n\n以下为词表规则层检测结果（零成本降级报告）：\n' + rt); }
                toast((result.error || "冲突检测失败") + (current.checkResult && current.checkResult.length ? '，已保留上一轮检测结果' : ''));
                startTabBlink('❌ 冲突检测失败');
                if(conflictVisible) renderConflictPanel(current); // v8.5.1-P2：失败也刷新面板，清除「自动重测中」占位
            }
            saveAll();
        } finally { setConflictChecking(false); stopSbStages(); resetSbProgress(); } // v8.0.35：清理检查进度窗口
    }

