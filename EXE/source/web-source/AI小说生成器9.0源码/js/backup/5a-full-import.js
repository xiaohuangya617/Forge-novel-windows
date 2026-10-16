function importBackup(file) {
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast("生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再导入"); return; } // v8.8-F011：拦截表补 summaryGenerating/conflictCheckingCount——原摘要在途恢复含相同书/章 ID 的备份后，旧摘要/检测结果按恢复后的"当前书"记费/写回，污染恢复数据（项目零终极版复审 F-011）；v8.7-F011 补拦 pendingBranch/banterBusy 同理
        if(importPending) { toast("上一次备份导入尚未完成，请稍候再试"); return; } // v8.9-F011：排他——读取生命周期内拒绝第二个导入（原双 FileReader 并发，最终状态由 I/O 完成顺序而非用户最后选择决定）
        if(!await appConfirmAsync("导入备份将覆盖当前全部数据（所有小说、设定、API 配置、素材库、草稿本等），且不可恢复！\n\n建议先点击「备份」导出当前数据。\n\n是否继续导入？")) return;
        importPending = true; // v8.9-F011：获准即锁（覆盖 readAsText 读取窗口到 onload 提交）
        const reader = new FileReader();
        reader.onload = async function(e) {
            const importBefore = captureImportState();
            try {
                const data = JSON.parse(e.target.result);
                validateBackupData(data); var compatVersions = ["2.6","2.7","2.8","2.9","3.0","3.1","3.2","3.3","3.4","3.6","3.7","3.8","3.9","4.0","4.1","4.2","4.3","4.4","4.5","4.6","4.7","4.8","4.9","5.0","5.1","5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","6.0","6.1","6.2","6.3","6.4","6.5","6.6","6.7","6.8","6.9","7.0","7.1","7.2","7.3","7.4","7.5","7.6","7.7","7.8","7.9","8.8","8.9","9.0"]; if(data.version && !compatVersions.includes(data.version)) { if(!await appConfirmAsync("备份版本("+data.version+")与当前版本(9.0)不匹配，可能存在兼容性问题。\n\n是否继续导入？")) { throw new Error("用户取消导入"); } }
                // v8.7-F02：事务化重构——先构建临时对象并深度校验（throw 在任何全局替换之前拦截），全部通过后才统一提交运行时状态。
                // 原先立即 `books = data.books.filter(...)`，章节/角色结构非法时在随后的遍历中抛错进入 catch，books 已被替换成半成品（界面提示"恢复失败"但内存已污染、后续自动保存覆盖原存储）。
                const importedBooks = JSON.parse(JSON.stringify(data.books));
                importedBooks.forEach(book => { book.id = String(book.id); book.characters = ensureArray(book.characters); book.chatHistory = ensureArray(book.chatHistory); book.chapters = ensureArray(book.chapters); book.forbiddenWords = ensureArray(book.forbiddenWords); book.characters.forEach(c=>{ if(c.id!=null)c.id=String(c.id); }); book.chapters.forEach(ch=>{ ch.id=String(ch.id); if(!Array.isArray(ch.checkResult)) ch.checkResult=[]; }); migrateChapter(book); });
                const ibChars = data.globalCharacters ? JSON.parse(JSON.stringify(data.globalCharacters)) : globalCharacters;
                const ibActs  = data.globalActions ? JSON.parse(JSON.stringify(data.globalActions)) : globalActions;
                const ibCost  = data.globalCostumes ? JSON.parse(JSON.stringify(data.globalCostumes)) : globalCostumes;
                ibChars.forEach(x=>{if(x.id!=null)x.id=String(x.id);}); ibActs.forEach(x=>{if(x.id!=null)x.id=String(x.id);}); ibCost.forEach(x=>{if(x.id!=null)x.id=String(x.id);});
                // 校验全部通过，提交前二次检查（v8.8-F011：读取文件期间可能已发起新 AI 任务——检查-提交竞态；忙则中止且不替换 books/不落盘，防半提交后 switchBook 才拒绝）
                if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) throw new Error("检测到 AI 任务进行中，导入已取消（未改动任何数据）");
                books = importedBooks; globalCharacters = ibChars; globalActions = ibActs; globalCostumes = ibCost;
                importedBooks.forEach(book => { normalizePrecisionSelections(book); }); // v6.8：normalize 在全局库已替换后执行——读取备份库而非旧库，避免用空库清空备份中的动作/服装精准选择（P0-2 数据破坏）
                if(data.scratchpadPages && Array.isArray(data.scratchpadPages) && data.scratchpadPages.length === 5) {
                    scratchpadPages = data.scratchpadPages.map(x => typeof x === 'string' ? x : '');
                } else if(data.scratchpadContent !== undefined) {
                    scratchpadPages = ['','','','',''];
                    scratchpadPages[0] = typeof data.scratchpadContent === 'string' ? data.scratchpadContent : '';
                }
                scratchpadContent = scratchpadPages[0] || '';
                try { localStorage.setItem('scratchpad_pages_v1', JSON.stringify(scratchpadPages)); } catch(e) {}
                if(data.apiConfig) Object.assign(api, data.apiConfig);
                if(data.polishApiCfg) Object.assign(polishApi, data.polishApiCfg);
                if(data.imageApiCfg) Object.assign(imageApiCfg, data.imageApiCfg);
                if(data.actApiCfg) Object.assign(actApi, data.actApiCfg); // v7.9：扮演 API 随备份恢复
                if(data.layoutPrefs && data.layoutPrefs.libEditorW) {
                    layoutPrefs = { libEditorW: { role: 0, globalRole: 0, action: 0, costume: 0 }, textarea: {} };
                    for(const k of ['role','globalRole','action','costume']) {
                        if(typeof data.layoutPrefs.libEditorW[k] === 'number' && data.layoutPrefs.libEditorW[k] > 240) {
                            layoutPrefs.libEditorW[k] = data.layoutPrefs.libEditorW[k];
                            try { localStorage.setItem('lib_editor_w_' + k, String(data.layoutPrefs.libEditorW[k])); } catch(e) {}
                        }
                    }
                }
                // v7.4：恢复 textarea 宽高（备份含 layoutPrefs.textarea 时）
                if(data.layoutPrefs && data.layoutPrefs.textarea && typeof data.layoutPrefs.textarea === 'object') {
                    layoutPrefs.textarea = {};
                    for(const [tid, wh] of Object.entries(data.layoutPrefs.textarea)) {
                        if(wh && typeof wh.w === 'number' && wh.w > 100 && typeof wh.h === 'number' && wh.h > 40) {
                            layoutPrefs.textarea[tid] = { w: wh.w, h: wh.h };
                            try { localStorage.setItem('lib_ta_w_' + tid, String(wh.w)); localStorage.setItem('lib_ta_h_' + tid, String(wh.h)); } catch(e) {}
                        }
                    }
                }
                currentBookId = data.currentBookId || (books[0]?.id||null);
                const savedOk = await persistNovelRuntimeCritical(); if(!savedOk) throw new Error('本地存储失败，导入已回滚'); renderBookshelf();
                isImporting = true;
                if(currentBookId && books.find(b=>b.id===currentBookId)) switchBook(currentBookId);
                else if(books.length) switchBook(books[0].id);
                else { const curBookName = $('curBookName'); if(curBookName) curBookName.innerText='未选择'; const novelContent = $('novelContent'); if(novelContent) novelContent.innerText='✨ 左侧按钮，一键起书，创作你的第一本小说吧！'; }
                isImporting = false;
                applyLibEditorWidth(); // v8.6-fix32：导入后立即应用库编辑栏宽（原仅下次打开弹窗时恢复）
                // 导入的 API 配置需走 loadApi 统一兜底与刷新（数值校验/dualMode/notify 按钮高亮），
                // 否则异常备份的数值直接生效、按钮状态与功能脱节
                loadApi();
                // v7.0：恢复日志（兼容旧备份无 appLogs 字段）
                if(Array.isArray(data.appLogs)) { appLogs = data.appLogs.slice(-50); try { localStorage.setItem('app_logs_v1', JSON.stringify(appLogs)); } catch(e) {} }
                // v8.1：恢复累计消耗金额（按存档金额覆盖；老备份无该字段时保持现值不动）
                if(data.costStats && typeof data.costStats === 'object') { try { localStorage.setItem('cost_stats_v1', JSON.stringify(data.costStats)); } catch(e) {} }
                // v8.2：恢复自定义标签库（数组时覆盖；老备份无该字段时保持现值不动）
                if(Array.isArray(data.customTags)) { try { localStorage.setItem('custom_tags_v1', JSON.stringify(data.customTags)); } catch(e) {} }
                // v8.7-L10：恢复起书草稿与每日输入统计（与导出侧对称；老备份无字段时保持现值不动，空值视为清除）
                if(data.sbDraft !== undefined) { try { if(data.sbDraft) localStorage.setItem('sb_draft_v1', data.sbDraft); else localStorage.removeItem('sb_draft_v1'); } catch(e) {} }
                if(data.dailyInputStats !== undefined) { try { if(data.dailyInputStats) localStorage.setItem('daily_input_stats_v1', data.dailyInputStats); else localStorage.removeItem('daily_input_stats_v1'); } catch(e) {} }
                // v8.6-fix36：恢复关系图右键高亮（graph_hl_<bookId>；先清旧键防残留，再按备份写入）
                if(data.graphHighlights && typeof data.graphHighlights === 'object') {
                    try {
                        const gone = [];
                        for(let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if(k && k.startsWith('graph_hl_')) gone.push(k); }
                        gone.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
                        Object.entries(data.graphHighlights).forEach(([bid, hl]) => { if(bid && Array.isArray(hl)) { try { localStorage.setItem('graph_hl_' + bid, JSON.stringify(hl)); } catch(e) {} } });
                    } catch(e) {}
                }
                if(savedOk) toast("恢复成功");
                else toast("备份已载入当前会话但未能保存到本地");
                importPending = false; // v8.9-F011：成功收尾释放排他锁
            } catch(err) { isImporting = false; restoreImportState(importBefore); importPending = false; toast("恢复失败: "+err.message); } // v8.9-F011：异常/中止路径同样释放（防锁永久卡死）
        };
        reader.onerror = () => { importPending = false; toast("备份文件读取失败，导入已取消"); }; // v8.9-F011：读取错误收尾
        reader.onabort = () => { importPending = false; toast("备份导入已取消"); }; // v8.9-F011：取消收尾
        reader.readAsText(file);
    }


    // v8.9-F02：安卓恢复只导入书籍正文与本书角色库，不触碰全局库、API、草稿和其他设置。

