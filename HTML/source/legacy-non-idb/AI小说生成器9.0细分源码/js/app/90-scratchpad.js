// ======================== 草稿本 ========================
    let scratchpadContent = ''; // v7.4：兼容旧字段（= 第 1 页内容）
    let scratchpadPages = ['','','','','']; // v7.4：5 页签数据
    let scratchpadCurPage = 0; // v7.4：当前页签 0-4

    function renderScratchpadTabs() {
        const wrap = $('scratchpadTabs'); if(!wrap) return;
        wrap.innerHTML = '';
        for(let i=0;i<5;i++){
            const b = document.createElement('button');
            const isAct = i === scratchpadCurPage;
            b.className = 'scratchpad-tab' + (isAct ? ' active' : '');
            b.title = '第 ' + (i+1) + ' 页';
            b.textContent = i+1;
            // v7.4：非空页显示小圆点指示（便于快速定位有内容的页）
            if(scratchpadPages[i] && scratchpadPages[i].trim()) {
                const dot = document.createElement('span');
                dot.className = 'tab-dot';
                b.appendChild(dot);
            }
            b.onclick = () => switchScratchpadPage(i);
            wrap.appendChild(b);
        }
    }
    function switchScratchpadPage(idx) {
        if(idx === scratchpadCurPage) return;
        saveScratchpad(false); // v7.4：切页自动保存当前页（静默）
        scratchpadCurPage = idx;
        const el = $('scratchpadContent'); if(el) el.value = scratchpadPages[idx] || '';
        renderScratchpadTabs();
    }
    function loadScratchpad() {
        // v7.4：优先 scratchpad_pages_v1（5 页数组）；旧 scratchpad_v1 字符串迁移到第 1 页
        try {
            const saved = localStorage.getItem('scratchpad_pages_v1');
            if(saved) {
                const arr = JSON.parse(saved);
                if(Array.isArray(arr) && arr.length === 5) scratchpadPages = arr.map(x => typeof x === 'string' ? x : '');
                else scratchpadPages = ['','','','',''];
            } else {
                scratchpadPages = ['','','','',''];
                const old = localStorage.getItem('scratchpad_v1');
                if(old) scratchpadPages[0] = old;
            }
        } catch(e) { scratchpadPages = ['','','','','']; }
        scratchpadContent = scratchpadPages[0] || '';
        const el = $('scratchpadContent'); if(el) el.value = scratchpadPages[scratchpadCurPage] || '';
        renderScratchpadTabs();
    }
    function saveScratchpad(showToast = true) {
        const el = $('scratchpadContent'); if(!el) return;
        scratchpadPages[scratchpadCurPage] = el.value;
        scratchpadContent = scratchpadPages[0] || '';
        try { localStorage.setItem('scratchpad_pages_v1', JSON.stringify(scratchpadPages)); if(showToast) toast("草稿已保存"); } catch(e) { if(showToast) toast("保存失败，可能存储空间不足"); }
    }
    function openScratchpadModal() {
        loadScratchpad();
        const modal = $('scratchpadModal'); if(modal) modal.style.display = 'flex';
        $('scratchpadContent')?.focus();
    }

    function resetAll() {
        if(importPending) { toast("备份导入进行中，请等待完成后再初始化"); return; } // v8.9-F011：导入读取/提交期间禁止重置（原重置后迟到导入回调可复活已清数据）
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再初始化"); return; } // v8.8-F011：补 summaryGenerating/conflictCheckingCount（同族：摘要在途清空数据，返回后费用/结果写回新空状态）；v8.7-F002：补拦 pendingBranch/banterBusy（同族：走向在途清空数据同样会造成响应归属错乱）
        if(!confirm('⚠️ 此操作将清空所有数据（包括所有小说、角色、动作库、API配置、草稿本等），且不可恢复！\n\n建议先点击「备份」导出数据。\n\n确定要继续吗？')) return;
        
        // 清空所有 localStorage 数据
        const coreKeys = ['books_v2', 'currentBookId_v2', 'api_config_v2', 'api_config_v3', 'global_characters_v2', 'global_actions_v2', 'global_costumes_v2', 'scratchpad_v1', 'custom_tags_v1', 'sb_draft_v1', 'archiveSettings_v1', 'archiveBase_v1', 'archiveDelta_v1']; // v8.8：重置同时清理增量存档，避免清空后启动被旧基线复活
        coreKeys.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
        // v8.6-fix11：补清累计金额与日志（与"清空所有数据"文案一致）
        ['cost_stats_v1', 'app_logs_v1'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
        // v8.6-fix30：补清每日输入统计与统计重置基线（原残留导致初始化后看板仍展示历史输入字数）
        ['daily_input_stats_v1', 'stats_global_reset_v1'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
        appLogs = []; // v8.6-fix11：内存日志同步清空
        ['left_width','right_width','chat_width','chat_input_height','editor_font_size'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
        try { localStorage.removeItem('scratchpad_pages_v1'); } catch(e) {}
        if(archiveScheduleTimer) { clearTimeout(archiveScheduleTimer); archiveScheduleTimer = null; }
        archiveLastHash = '';
        ['role','globalRole','action','costume'].forEach(k => { try { localStorage.removeItem('lib_editor_w_' + k); } catch(e) {} });
        ['charAppearance','charPersonality','charSpecial','charRelation','globalCharAppearance','globalCharPersonality','globalCharSpecial','globalCharRelation','globalActionKeyPoints','globalActionLines','globalActionDescriptionTips','globalCostumeStyle','globalCostumeDescTips'].forEach(tid => { try { localStorage.removeItem('lib_ta_w_' + tid); localStorage.removeItem('lib_ta_h_' + tid); } catch(e) {} });
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(id => { try { localStorage.removeItem('textarea_'+id); } catch(e) {} });
        // v8.7-L8：清动态键——关系图右键高亮（graph_hl_<bookId>）与吐槽缓存（banter_cache_v1_*）按前缀枚举删除
        //（原 coreKeys 为静态清单，漏掉动态键：初始化后同名 bookId 重建书时旧高亮残留复活、缓存残留）
        { const dynKeys = []; for(let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if(k && (k.startsWith('graph_hl_') || k.startsWith('banter_cache_v1_') || k === 'banter_cache_meta_v1')) dynKeys.push(k); } dynKeys.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} }); }
        
        // 重置内存变量
        books = []; currentBookId = null;
        globalCharacters = []; globalActions = []; globalCostumes = [];
        api = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', contextWindow:1000000, temp:1.0, top_p:0.92, repetition_penalty:1.15, maxTokens:60000, freqPenalty:0.4, presPenalty:0.5, ctxChapters:5, stopWords:'', thinking: false, reasoningEffort: 'high', notify: false, dualMode: false, multiChap: false, multiChapCount: 3, branchAutoSend: false, rewriteAutoSend: false };
        // v7.3 修复：重置时一并清空审稿/生图配置（与"清空所有数据"语义一致，防残留 key/url）
        polishApi = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', maxTokens:50000, reasoning:'max', ratio:50, paramMode:false, temp:0.5, topP:0.87, presPenalty:0, freqPenalty:0.1, repPenalty:1 }; // v8.6-P3：重置含参数模式字段（原缺省导致重置后参数 undefined）
        actApi = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', temp:0.7, maxTokens:800, rounds:10, persona:true, tone:true }; // v7.9：重置时一并清空扮演 API 配置
        imageApiCfg = { url:'', key:'', model:'', size:'1:1', style:'二次元插画风' };
        scratchpadContent = ''; scratchpadPages = ['','','','','']; scratchpadCurPage = 0;
        layoutPrefs = { libEditorW: { role: 0, globalRole: 0, action: 0, costume: 0 }, textarea: {} };
        rollbackSnapshot = null;
        currentEditingCharId = null; currentEditingGlobalCharId = null; currentEditingGlobalActionId = null; currentEditingGlobalCostumeId = null; currentEditingForbiddenId = null;
        relationNodePositions = {}; relationColorMap = {};
        graphLayoutMode = 'square'; graphCanvasH = 0; graphCanvasW = 0;
        graphRegions = []; graphActiveTab = 0; // v6.4：清空区域
        
        // 刷新 UI
        const curBookName = $('curBookName'); if(curBookName) curBookName.innerText = '未选择';
        const novelContent = $('novelContent'); if(novelContent) novelContent.innerText = '✨ 左侧按钮，一键起书，创作你的第一本小说吧！';
        const curChapName = $('curChapName'); if(curChapName) curChapName.innerText = '未选择';
        const wordCount = $('wordCount'); if(wordCount) wordCount.innerText = '0';
        const chatMsgs = $('chatMsgs'); if(chatMsgs) chatMsgs.innerHTML = '';
        const chaptersList = $('chaptersList'); if(chaptersList) chaptersList.innerHTML = '';
        const bookList = $('bookList'); if(bookList) bookList.innerHTML = '';
        const scratchpadEl = $('scratchpadContent'); if(scratchpadEl) scratchpadEl.value = '';
        // 修复（v6.0）：初始化后摘要框残留旧摘要（resetAll 此前漏清 summaryArea）
        const sumElReset = $('summaryArea'); if(sumElReset) sumElReset.value = '';
        
        // 重置右侧面板：世界观三要素 + 全局提示词
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(id => { let el = $(id); if(el) el.value = ''; });
        
        // 重置 API 表单字段为默认值
        const apiUrlInpEl = $('apiUrlInp'); if(apiUrlInpEl) apiUrlInpEl.value = 'https://api.deepseek.com/chat/completions';
        const modelInpEl = $('modelInp'); if(modelInpEl) modelInpEl.value = 'deepseek-flash';
        const maxTokensInpEl = $('maxTokensInp'); if(maxTokensInpEl) maxTokensInpEl.value = '60000';
        ['apiKeyInp'].forEach(id => { let el = $(id); if(el) el.value = ''; });
        const tempRangeEl = $('tempRange'); if(tempRangeEl) tempRangeEl.value = '1.0';
        const topPRangeEl = $('topPRange'); if(topPRangeEl) topPRangeEl.value = '0.92';
        const repPenaltyRangeEl = $('repPenaltyRange'); if(repPenaltyRangeEl) repPenaltyRangeEl.value = '1.15';
        const freqRangeEl = $('freqRange'); if(freqRangeEl) freqRangeEl.value = '0.4';
        const presRangeEl = $('presRange'); if(presRangeEl) presRangeEl.value = '0.5';
        const ctxRangeEl = $('ctxRange'); if(ctxRangeEl) ctxRangeEl.value = '5';
                const thinkingCheckEl = $('thinkingCheck'); if(thinkingCheckEl) thinkingCheckEl.checked = false;
        const reasoningRangeEl = $('reasoningRange'); if(reasoningRangeEl) { reasoningRangeEl.value = 1; reasoningRangeEl.disabled = false; }
        const reasoningValEl = $('reasoningVal'); if(reasoningValEl) reasoningValEl.innerText = 'high';
        const notifyBtnEl = $('notifyBtn'); if(notifyBtnEl) notifyBtnEl.classList.remove('guide-highlight');
        // 字号复位（内存变量与 UI 同步，刷新前即生效）
        currentFontSize = 16;
        const novelContentReset = $('novelContent'); if(novelContentReset) novelContentReset.style.fontSize = '16px';
        const fontSizeValReset = $('fontSizeVal'); if(fontSizeValReset) fontSizeValReset.innerText = '16px';
        // 清除残留状态
        setRewriteMode(false, null); // v9.0：初始化必须退出重写待发送态，避免新书首条指令被旧书状态拦截
        pendingBranch = false;
        branchContinuePending = false;
        branchBookId = null;
        const branchModalReset = $('branchModal'); if(branchModalReset) branchModalReset.style.display = 'none'; // v9.0：走向卡片属于旧书，初始化后不可继续显示
        pendingGeneration = null;
        conflictVisible = false;
        const conflictPanelEl = $('conflictPanel'); if(conflictPanelEl) conflictPanelEl.style.display = 'none';
        banterVisible = false;
        const banterPanelR = $('banterPanel'); if(banterPanelR) banterPanelR.style.display = 'none';
        closeRoleplay(); // v7.9：重置数据自动退出试演
        contentDirty = false;
        const saveStatusEl = $('saveStatus'); if(saveStatusEl) saveStatusEl.innerText = '已存';
        const chatInpReset = $('chatInp'); if(chatInpReset) chatInpReset.value = '';
        api.dualMode = false; updateDualModeButton();
        dualPendingChapA = null; dualPendingChapB = null; dualAbortControllers = []; dualActiveSessionId = 0;

        enableRollbackButton(false);
        updateStorageIndicator();
        updatePrecisionButton();
        toast('✅ 初始化完成，所有数据已清除');
    }

    window.addEventListener('error', (e) => { if(e.error) console.error('未捕获错误:', e.error.message); });

    // v8.9：顶部菜单隐藏原生滚动条，保留横向滚动并用边缘渐隐提示还有菜单项。
