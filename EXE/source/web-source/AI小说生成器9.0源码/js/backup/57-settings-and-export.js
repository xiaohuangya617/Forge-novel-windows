    function saveBookSettings() {
        let b = getCurrentBook();
        if(b) {
            ['worldview','plotSet','globalPrompt','writingStyle'].forEach(elId => { let el = $(elId); if(el) b[elId]=el.value; });
            if(!persistOrWarn()) return; toast("设定已保存");
        }
    }
    async function exportBackup() {
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode) toast("⚠️ 生成或双版选择进行中，备份不包含未完成结果");
        if(polishMode) { toast("润色预览中，请先应用或取消后再备份"); return; }
        if(!syncCurChapterToMemory()) return; // v8.7-F003：导出救援——内存同步即可，持久化失败不阻断（原 ensure 会因存储满取消备份导出，最新正文将无法救援）
        // v8.7-F10：备份明文含全部 API Key，导出前明确警告（此前仅"备份已导出"提示，未覆盖"备份文件也含密钥"的事实）
        // v8.7-F005：凭据扫描纳入一键起书草稿（sb_draft_v1 含面板 Key 输入，原扫描四组 API 配置漏掉它——草稿被无条件写入备份时无警告，项目零审查 F-005）
        let sbDraftHasKey = false;
        try { const sd = JSON.parse(localStorage.getItem('sb_draft_v1') || 'null'); if(sd && sd.key) sbDraftHasKey = true; } catch(e) {}
        if((api && api.key) || (polishApi && polishApi.key) || (actApi && actApi.key) || (imageApiCfg && imageApiCfg.key) || sbDraftHasKey) {
            if(!await appConfirmAsync('⚠️ 备份文件将包含您的 API Key（正文/审稿/扮演/生图配置或一键起书草稿中的密钥），以明文存于 JSON。\n\n请勿上传网盘、发送他人或经聊天工具/第三方编辑器流转，以免密钥泄露。\n\n是否仍要导出？')) return;
        }
        const scratchpadModalEl = $('scratchpadModal'); const scratchpadEl = $('scratchpadContent');
        if(scratchpadEl && scratchpadModalEl && scratchpadModalEl.style.display === 'flex') {
            scratchpadPages[scratchpadCurPage] = scratchpadEl.value; // v7.4：同步当前页
            scratchpadContent = scratchpadPages[0] || '';
        }
        // v8.1：备份携带累计消耗金额（costStats），导入按存档金额恢复
        let costStats = {};
        try { costStats = JSON.parse(localStorage.getItem('cost_stats_v1') || '{}'); } catch(e) {}
        // v8.2：备份携带自定义标签库（custom_tags_v1），导入恢复
        let customTags = [];
        try { customTags = JSON.parse(localStorage.getItem('custom_tags_v1') || '[]'); } catch(e) {}
        // v8.6-fix36：备份携带关系图右键高亮（graph_hl_<bookId> 动态键 → 收集为对象 {bookId: [...]}）
        let graphHighlights = {};
        try {
            for(let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if(k && k.startsWith('graph_hl_')) {
                    try { graphHighlights[k.slice('graph_hl_'.length)] = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
                }
            }
        } catch(e) {}
        const backupData = { version:"9.0", timestamp:Date.now(), books, currentBookId, apiConfig:api, polishApiCfg:polishApi, imageApiCfg:imageApiCfg, actApiCfg:actApi, globalCharacters, globalActions, globalCostumes, scratchpadPages, scratchpadContent: (scratchpadPages[0]||''), layoutPrefs: JSON.parse(JSON.stringify(layoutPrefs)), appLogs, costStats, customTags, graphHighlights, sbDraft: (function(){ try { return localStorage.getItem('sb_draft_v1') || ''; } catch(e) { return ''; } })(), dailyInputStats: (function(){ try { return localStorage.getItem('daily_input_stats_v1') || ''; } catch(e) { return ''; } })() }; // v8.7-L10：备份补起书草稿与每日输入统计（原漏导致手动备份→导入闭环丢这两项，与 EXE 快照口径不一致）
        const blob = new Blob([JSON.stringify(backupData,null,2)], {type:"application/json"});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `小说参数备份_${fmtStamp()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("备份已导出");
    }
    // 数组类型兜底：异常/手动修改的备份可能把数组字段写成对象，强制转回数组防初始化崩溃
