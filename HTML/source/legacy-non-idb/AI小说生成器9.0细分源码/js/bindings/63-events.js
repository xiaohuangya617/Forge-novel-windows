    function bindEvents() {
        const closeBranchBtn = $('closeBranchBtn'); if(closeBranchBtn) closeBranchBtn.onclick = () => { const m = $('branchModal'); if(m) m.style.display = 'none'; };
        const sendBtn = $('sendMsgBtn'); if(sendBtn) sendBtn.onclick = onSend;
        // v8.5.3-FIX：预算条函数已移至顶层（原在此闭包内定义，顶层请求函数调用 setCtxBudgetFromUsage 报 is not defined）
        const ctxInp2 = $('chatInp');
        if(ctxInp2) { ctxInp2.addEventListener('input', updateCtxBudgetBar); updateCtxBudgetBar(); }
        const contBtn = $('continueBtn'); if(contBtn) contBtn.onclick = onContinue;
        const regenBtn = $('regenerateBtn'); if(regenBtn) regenBtn.onclick = onRegenerate;
        // v7.3：润色按钮 + 应用/放弃 + 保存联动（保护态保存 = 清痕解锁生效）
        const polishBtn = $('polishBtn'); if(polishBtn) polishBtn.onclick = onPolish;
        const polishApplyBtn = $('polishApplyBtn'); if(polishApplyBtn) polishApplyBtn.onclick = applyPolish;
        const polishDiscardBtn = $('polishDiscardBtn'); if(polishDiscardBtn) polishDiscardBtn.onclick = discardPolish;
        const saveChapBtn = $('saveChapBtn'); if(saveChapBtn) saveChapBtn.onclick = () => { const ok = saveCurChapter(); toast(ok ? '已保存' : '❌ 保存失败，请检查存储空间'); };
        if(rollbackBtn) rollbackBtn.onclick = performRollback;
        const prevBtn = $('prevChap'); if(prevBtn) prevBtn.onclick = () => changeChap(-1);
        const nextBtn = $('nextChap'); if(nextBtn) nextBtn.onclick = () => changeChap(1);
        const addChapIcon = $('addChapIcon'); if(addChapIcon) addChapIcon.onclick = addNewChapter;
        // v8.3：编辑区标题点击改名
        const chapRenameIcon = $('chapRenameIcon'); if(chapRenameIcon) chapRenameIcon.onclick = renameCurrentChapter;
        // v6.4：导出按钮合并——点击弹窗选择「导出全书 / 导出本章」
        const exportBtn = $('exportBtn'); if(exportBtn) exportBtn.onclick = () => { const em = $('exportChoiceModal'); if(em) em.style.display = 'flex'; };
        const exportFullChoiceBtn = $('exportFullChoiceBtn'); if(exportFullChoiceBtn) exportFullChoiceBtn.onclick = () => { const em = $('exportChoiceModal'); if(em) em.style.display = 'none'; exportFull(); };
        const exportChapterChoiceBtn = $('exportChapterChoiceBtn'); if(exportChapterChoiceBtn) exportChapterChoiceBtn.onclick = () => { const em = $('exportChoiceModal'); if(em) em.style.display = 'none'; exportCurrentChapter(); };
        const closeExportChoiceBtn = $('closeExportChoiceBtn'); if(closeExportChoiceBtn) closeExportChoiceBtn.onclick = () => { const em = $('exportChoiceModal'); if(em) em.style.display = 'none'; };
        const newBookIcon = $('newBookIcon'); if(newBookIcon) newBookIcon.onclick = newBook;
        const newBookBtn = $('newBookBtn'); if(newBookBtn) newBookBtn.onclick = openStartBookModal; // v8.0：一键起书
        // v8.0 起书卡片控件绑定
        const sbTestBtn = $('sbTestBtn'); if(sbTestBtn) sbTestBtn.onclick = sbTestConnection;
        const sbSaveBtn = $('sbSaveBtn'); if(sbSaveBtn) sbSaveBtn.onclick = sbSaveConfig;
        const sbStartBtn = $('sbStartBtn'); if(sbStartBtn) sbStartBtn.onclick = startBook;
        const sbCloseBtn = $('sbCloseBtn'); if(sbCloseBtn) sbCloseBtn.onclick = () => { if(!sbBusy) { const m = $('startBookModal'); if(m) m.style.display = 'none'; resetSbProgress(); } };
        const sbResetBtn = $('sbResetBtn'); if(sbResetBtn) sbResetBtn.onclick = resetSbForm;
        // v8.0.16：失败自动重试下拉按钮（选中>0次才高亮启用）
        const sbRetryBtn = $('sbRetryBtn'); const sbRetryMenu = $('sbRetryMenu');
        if(sbRetryBtn && sbRetryMenu) {
            sbRetryBtn.onclick = () => { if(sbBusy) return; sbRetryMenu.style.display = (sbRetryMenu.style.display === 'none') ? 'block' : 'none'; };
            document.querySelectorAll('#sbRetryMenu .sb-retry-item').forEach(it => {
                it.onclick = () => {
                    sbRetryCount = parseInt(it.getAttribute('data-n') || '0', 10);
                    sbRetryBtn.innerHTML = '失败自动重试 ' + sbRetryCount + '次 <i class="fas fa-caret-down"></i>';
                    sbRetryBtn.classList.toggle('active', sbRetryCount > 0);
                    sbRetryMenu.style.display = 'none';
                };
            });
        }
        // v8.0：起书卡片内容变化即保存草稿（下次打开恢复，Key 也保存）
        ['sbApiKeyInp','sbModelInp','sbCharInp','sbSellInp','sbIdeaInp'].forEach(id => { const el = $(id); if(el) el.addEventListener('input', saveSbDraft); });
        const sbProgressCloseBtn = $('sbProgressCloseBtn'); if(sbProgressCloseBtn) sbProgressCloseBtn.onclick = () => { resetSbProgress(); }; // v8.0.16：只关进度窗口，不关起书面板
        document.querySelectorAll('#sbTabs .sb-tab').forEach(b => b.onclick = () => selectBookTpl(b.getAttribute('data-tpl')));
        document.querySelectorAll('#sbPlatRow .sb-plat').forEach(b => b.onclick = () => selectSbPlat(b.getAttribute('data-plat')));
        const apiBtnSidebar = $('apiBtnSidebar'); if(apiBtnSidebar) apiBtnSidebar.onclick = openApiModal;
        const testApiBtn = $('testApiBtn'); if(testApiBtn) testApiBtn.onclick = () => { const at = document.querySelector('.api-tab.active'); if(!at) return; const tab = at.getAttribute('data-apitab'); if(tab === 'polish') testPolishConnection(); else if(tab === 'act') testActConnection(); else testApiConnection(); };
        const saveApiBtn = $('saveApiBtn'); if(saveApiBtn) saveApiBtn.onclick = () => saveApi();
        const closeApiBtn = $('closeApiBtn'); if(closeApiBtn) closeApiBtn.onclick = () => { const apiModal = $('apiModal'); if(apiModal) apiModal.style.display='none'; cancelPendingGeneration('⏹ 已取消：未配置 API Key'); };
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(id => { let el = $(id); if(el) el.addEventListener('blur', saveBookSettings); });
        window.addEventListener('beforeunload', (e) => { saveCurChapter(); saveBookSettings(); const dualActive = dualAbortControllers.length > 0 || !!dualPendingChapA || !!dualPendingChapB; if(dualActive) { e.preventDefault(); e.returnValue = ''; } });
        window.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden') { saveCurChapter(); saveBookSettings(); } });
        const statsBtn = $('statsBtn'); if(statsBtn) statsBtn.onclick = openStatsModal;
        const statsCloseBtn = $('statsCloseBtn'); if(statsCloseBtn) statsCloseBtn.onclick = closeStatsModal;
        const statsModalEl = $('statsModal'); if(statsModalEl) statsModalEl.addEventListener('click', (e) => { if(e.target === statsModalEl) closeStatsModal(); }); // v7.6：点遮罩关闭
        const statsExportBtn = $('statsExportBtn'); if(statsExportBtn) statsExportBtn.onclick = exportStatsPNG;
        const backupExportBtn = $('backupExportBtn'); if(backupExportBtn) backupExportBtn.onclick = exportBackup;
        const backupImportBtn = $('backupImportBtn'); if(backupImportBtn) backupImportBtn.onclick = () => { const fileInput = $('backupFileInput'); if(fileInput) fileInput.click(); };
        const androidRestoreBtn = $('androidRestoreBtn'); if(androidRestoreBtn) androidRestoreBtn.onclick = () => { const input = $('androidRestoreFileInput'); if(input) input.click(); };
        const backupFileInput = $('backupFileInput'); if(backupFileInput) backupFileInput.onchange = (e) => { if(e.target.files.length) { importBackup(e.target.files[0]); e.target.value=''; } };
        const androidRestoreFileInput = $('androidRestoreFileInput'); if(androidRestoreFileInput) androidRestoreFileInput.onchange = (e) => { if(e.target.files.length) { importAndroidBookArchive(e.target.files[0]); e.target.value=''; } };
        const resetAllBtn = $('resetAllBtn'); if(resetAllBtn) resetAllBtn.onclick = resetAll;
        const roleLibraryBtn = $('roleLibraryBtn'); if(roleLibraryBtn) roleLibraryBtn.onclick = () => { if(getCurrentBook()) { const roleBookName = $('roleBookName'); if(roleBookName) roleBookName.innerText=getCurrentBook().name; renderCharacterList(); clearCharForm(); applyLibEditorWidth(); const roleModal = $('roleModal'); if(roleModal) roleModal.style.display='flex'; } else toast("请先选择小说"); };
        const actionLibraryBtn = $('actionLibraryBtn'); if(actionLibraryBtn) actionLibraryBtn.onclick = () => { renderActionList(); clearGlobalActionForm(); applyLibEditorWidth(); const actionModal = $('actionModal'); if(actionModal) actionModal.style.display='flex'; };
        const costumeLibraryBtn = $('costumeLibraryBtn'); if(costumeLibraryBtn) costumeLibraryBtn.onclick = () => { renderCostumeList(); clearGlobalCostumeForm(); applyLibEditorWidth(); const costumeModal = $('costumeModal'); if(costumeModal) costumeModal.style.display='flex'; };
        const globalRoleBtn = $('globalRoleBtn'); if(globalRoleBtn) globalRoleBtn.onclick = () => { renderGlobalCharList(); clearGlobalCharForm(); applyLibEditorWidth(); const globalRoleModal = $('globalRoleModal'); if(globalRoleModal) globalRoleModal.style.display='flex'; };
        const scratchpadBtn = $('scratchpadBtn'); if(scratchpadBtn) scratchpadBtn.onclick = openScratchpadModal;
        const saveScratchpadBtn = $('saveScratchpadBtn'); if(saveScratchpadBtn) saveScratchpadBtn.onclick = saveScratchpad;
        const closeScratchpadBtn = $('closeScratchpadBtn'); if(closeScratchpadBtn) closeScratchpadBtn.onclick = () => { saveScratchpad(false); $('scratchpadModal').style.display='none'; };
        const forbiddenWordsBtn = $('forbiddenWordsBtn'); if(forbiddenWordsBtn) forbiddenWordsBtn.onclick = openForbiddenWordsModal;
        const relationGraphBtn = $('relationGraphBtn'); if(relationGraphBtn) relationGraphBtn.onclick = openRelationGraph;
        const closeRoleModal = $('closeRoleModal'); if(closeRoleModal) closeRoleModal.onclick = () => { saveLibEditorWidth(); const roleModal = $('roleModal'); if(roleModal) roleModal.style.display='none'; };
        const closeActionModal = $('closeActionModal'); if(closeActionModal) closeActionModal.onclick = () => { saveLibEditorWidth(); const actionModal = $('actionModal'); if(actionModal) actionModal.style.display='none'; };
        const closeCostumeModal = $('closeCostumeModal'); if(closeCostumeModal) closeCostumeModal.onclick = () => { saveLibEditorWidth(); const costumeModal = $('costumeModal'); if(costumeModal) costumeModal.style.display='none'; };
        const closeGlobalRoleModal = $('closeGlobalRoleModal'); if(closeGlobalRoleModal) closeGlobalRoleModal.onclick = () => { saveLibEditorWidth(); const globalRoleModal = $('globalRoleModal'); if(globalRoleModal) globalRoleModal.style.display='none'; };
        const closeRelationModal = $('closeRelationModal'); if(closeRelationModal) closeRelationModal.onclick = () => { const relationGraphModal = $('relationGraphModal'); if(relationGraphModal) relationGraphModal.style.display='none'; };
        const addRelationBtn = $('addRelationBtn'); if(addRelationBtn) addRelationBtn.onclick = addRelationDirect;
        const relAddBtn = $('relAddBtn'); if(relAddBtn) relAddBtn.onclick = addRelationFromModal;
        const relCloseBtn = $('relCloseBtn'); if(relCloseBtn) relCloseBtn.onclick = closeRelationEdit;
        const resetGraphLayoutBtn = $('resetGraphLayoutBtn'); if(resetGraphLayoutBtn) resetGraphLayoutBtn.onclick = resetGraphLayout;
        // v6.4：区域按钮绑定（创建/取消）
        const graphRegionBtn = $('graphRegionBtn'); if(graphRegionBtn) graphRegionBtn.onclick = openRegionModal;
        const graphExportBtn = $('graphExportBtn'); if(graphExportBtn) graphExportBtn.onclick = exportRelationGraph;
        const saveRegionBtn = $('saveRegionBtn'); if(saveRegionBtn) saveRegionBtn.onclick = saveRegion;
        const closeRegionBtn = $('closeRegionBtn'); if(closeRegionBtn) closeRegionBtn.onclick = () => { const rm = $('regionModal'); if(rm) rm.style.display = 'none'; };
        const graphSnapBtn = $('graphSnapBtn'); if(graphSnapBtn) graphSnapBtn.onclick = toggleGraphSnap;
        const exportBookCharsBtn = $('exportBookCharsBtn'); if(exportBookCharsBtn) exportBookCharsBtn.onclick = exportBookCharsJson;
        const closeForbiddenModal = $('closeForbiddenModal'); if(closeForbiddenModal) closeForbiddenModal.onclick = () => { const forbiddenWordsModal = $('forbiddenWordsModal'); if(forbiddenWordsModal) forbiddenWordsModal.style.display='none'; };
        const clearLogBtn = $('clearLogBtn'); if(clearLogBtn) clearLogBtn.onclick = () => { appLogs = []; try { localStorage.removeItem('app_logs_v1'); } catch(e) {} renderLogList(); }; // v7.5：日志清空按钮
        const saveCharBtn = $('saveCharBtn'); if(saveCharBtn) saveCharBtn.onclick = saveCurrentCharacter;
        const cancelEditCharBtn = $('cancelEditCharBtn'); if(cancelEditCharBtn) cancelEditCharBtn.onclick = clearCharForm;
        const newCharBtn = $('newCharBtn'); if(newCharBtn) newCharBtn.onclick = () => { clearCharForm(); currentEditingCharId=null; };
        const importGlobalCharsBtn = $('importGlobalCharsBtn'); if(importGlobalCharsBtn) importGlobalCharsBtn.onclick = batchImport;
        const exportToGlobalCharBtn = $('exportToGlobalCharBtn'); if(exportToGlobalCharBtn) exportToGlobalCharBtn.onclick = batchExport;
        const addGlobalCharBtn = $('addGlobalCharBtn'); if(addGlobalCharBtn) addGlobalCharBtn.onclick = addGlobalCharacter;
        const saveGlobalCharBtn = $('saveGlobalCharBtn'); if(saveGlobalCharBtn) saveGlobalCharBtn.onclick = saveGlobalCharacter;
        const cancelGlobalCharBtn = $('cancelGlobalCharBtn'); if(cancelGlobalCharBtn) cancelGlobalCharBtn.onclick = clearGlobalCharForm;
        const exportGlobalCharsJsonBtn = $('exportGlobalCharsJsonBtn'); if(exportGlobalCharsJsonBtn) exportGlobalCharsJsonBtn.onclick = exportGlobalCharsToJson;
        const importGlobalCharsJsonBtn = $('importGlobalCharsJsonBtn'); if(importGlobalCharsJsonBtn) importGlobalCharsJsonBtn.onclick = () => { const fileInput = $('importGlobalCharsFileInput'); if(fileInput) fileInput.click(); };
        const importGlobalCharsFileInput = $('importGlobalCharsFileInput'); if(importGlobalCharsFileInput) importGlobalCharsFileInput.onchange = (e) => { if(e.target.files.length) { importGlobalCharsFromJson(e.target.files[0]); e.target.value=''; } };
        const addGlobalActionBtn = $('addGlobalActionBtn'); if(addGlobalActionBtn) addGlobalActionBtn.onclick = addGlobalAction;
        const saveGlobalActionBtn = $('saveGlobalActionBtn'); if(saveGlobalActionBtn) saveGlobalActionBtn.onclick = saveGlobalAction;
        const cancelGlobalActionBtn = $('cancelGlobalActionBtn'); if(cancelGlobalActionBtn) cancelGlobalActionBtn.onclick = clearGlobalActionForm;
        const exportGlobalActionsJsonBtn = $('exportGlobalActionsJsonBtn'); if(exportGlobalActionsJsonBtn) exportGlobalActionsJsonBtn.onclick = exportGlobalActionsToJson;
        const importGlobalActionsJsonBtn = $('importGlobalActionsJsonBtn'); if(importGlobalActionsJsonBtn) importGlobalActionsJsonBtn.onclick = () => { const fileInput = $('importGlobalActionsFileInput'); if(fileInput) fileInput.click(); };
        const importGlobalActionsFileInput = $('importGlobalActionsFileInput'); if(importGlobalActionsFileInput) importGlobalActionsFileInput.onchange = (e) => { if(e.target.files.length) { importGlobalActionsFromJson(e.target.files[0]); e.target.value=''; } };
        const addGlobalCostumeBtn = $('addGlobalCostumeBtn'); if(addGlobalCostumeBtn) addGlobalCostumeBtn.onclick = addGlobalCostume;
        const saveGlobalCostumeBtn = $('saveGlobalCostumeBtn'); if(saveGlobalCostumeBtn) saveGlobalCostumeBtn.onclick = saveGlobalCostume;
        const cancelGlobalCostumeBtn = $('cancelGlobalCostumeBtn'); if(cancelGlobalCostumeBtn) cancelGlobalCostumeBtn.onclick = clearGlobalCostumeForm;
        const exportGlobalCostumesJsonBtn = $('exportGlobalCostumesJsonBtn'); if(exportGlobalCostumesJsonBtn) exportGlobalCostumesJsonBtn.onclick = exportGlobalCostumesToJson;
        const importGlobalCostumesJsonBtn = $('importGlobalCostumesJsonBtn'); if(importGlobalCostumesJsonBtn) importGlobalCostumesJsonBtn.onclick = () => { const fileInput = $('importGlobalCostumesFileInput'); if(fileInput) fileInput.click(); };
        const importGlobalCostumesFileInput = $('importGlobalCostumesFileInput'); if(importGlobalCostumesFileInput) importGlobalCostumesFileInput.onchange = (e) => { if(e.target.files.length) { importGlobalCostumesFromJson(e.target.files[0]); e.target.value=''; } };
        const saveForbiddenWordBtn = $('saveForbiddenWordBtn'); if(saveForbiddenWordBtn) saveForbiddenWordBtn.onclick = saveForbiddenWord;
        const cancelForbiddenWordBtn = $('cancelForbiddenWordBtn'); if(cancelForbiddenWordBtn) cancelForbiddenWordBtn.onclick = clearForbiddenForm;
        const newForbiddenWordBtn = $('newForbiddenWordBtn'); if(newForbiddenWordBtn) newForbiddenWordBtn.onclick = () => { clearForbiddenForm(); currentEditingForbiddenId=null; };
        const checkConflictBtn = $('checkConflictBtn');
        // v6.3：检查按钮 = 纯开关（只开/关面板，永不发检测请求）；
        // 检测入口只有面板内「重新检测」按钮（recheckConflictBtn）
        if(checkConflictBtn) checkConflictBtn.onclick = () => {
            const book = getCurrentBook(); if(!book || !book.currentChapterId) { toast("请先选择章节"); return; }
            toggleConflictPanel();
        };
        const recheckConflictBtn = $('recheckConflictBtn'); if(recheckConflictBtn) recheckConflictBtn.onclick = async () => { await recheckCurrentChapter(); if(conflictVisible) { toggleConflictPanel(); toggleConflictPanel(); } };
        const closeConflictPanel = $('closeConflictPanel'); if(closeConflictPanel) closeConflictPanel.onclick = () => { const conflictPanel = $('conflictPanel'); if(conflictPanel) conflictPanel.style.display='none'; conflictVisible=false; clearCheckMarks(); }; // v8.4-P2.1：X 关闭同样剥离标色
        // v7.9 角色试演绑定
        const roleplayBtn = $('roleplayBtn'); if(roleplayBtn) roleplayBtn.onclick = openRoleplay;
        const roleplayClose = $('roleplayClose'); if(roleplayClose) roleplayClose.onclick = closeRoleplay;
        const roleplaySend = $('roleplaySend'); if(roleplaySend) roleplaySend.onclick = sendRoleplay;
        const roleplayStop = $('roleplayStop'); if(roleplayStop) roleplayStop.onclick = () => { roleplayState.stoppedByUser = true; if(roleplayState.controller) roleplayState.controller.abort(); };
        const roleplayEnd = $('roleplayEnd'); if(roleplayEnd) roleplayEnd.onclick = endRoleplay;
        const roleplayInput = $('roleplayInput'); if(roleplayInput) roleplayInput.addEventListener('keydown', (e) => { if((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendRoleplay(); } });
        const rpSearchA = $('roleplaySearchA'); if(rpSearchA) rpSearchA.addEventListener('input', () => renderRoleplayPicker('A'));
        const rpSearchB = $('roleplaySearchB'); if(rpSearchB) rpSearchB.addEventListener('input', () => renderRoleplayPicker('B'));
        ['roleplayListA','roleplayListB'].forEach(rpid => { const rpel = $(rpid); if(rpel) rpel.addEventListener('click', (e) => { const item = e.target.closest ? e.target.closest('[data-rid]') : null; if(item) pickRoleplayChar(item.getAttribute('data-slot'), item.getAttribute('data-rid')); }); });
        // v7.9c：角色试演仅能通过「关闭」按钮退出——不再注册遮罩点击关闭（点击其他位置/失焦不影响窗口）
        // v7.8 吐槽：按钮开面板 / 关闭 / 生成
        const banterBtn = $('banterBtn'); if(banterBtn) banterBtn.onclick = () => toggleBanterPanel();
        const closeBanterPanel = $('closeBanterPanel'); if(closeBanterPanel) closeBanterPanel.onclick = () => { const p = $('banterPanel'); if(p) p.style.display='none'; banterVisible=false; };
        const genBanterBtn = $('genBanterBtn'); if(genBanterBtn) genBanterBtn.onclick = () => generateBanter();
        const stopGenBtn = $('stopGenBtn'); if(stopGenBtn) stopGenBtn.onclick = stopGeneration;
        const clearChatBtn = $('clearChatBtn'); if(clearChatBtn) clearChatBtn.onclick = clearChatHistory;
        const chatInp = $('chatInp'); if(chatInp) { chatInp.addEventListener('keydown', (e) => { if((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onSend(); } if((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); onContinue(); } }); }
        // Ctrl+G 全局续写快捷键（即使焦点不在聊天框也生效）
        document.addEventListener('keydown', (e) => { const aeG = document.activeElement; const inInputG = aeG && (aeG.tagName==='INPUT' || aeG.tagName==='TEXTAREA' || aeG.isContentEditable); if((e.ctrlKey || e.metaKey) && e.key === 'g' && !inInputG) { const anyModalOpen = ['apiModal','roleModal','actionModal','costumeModal','globalRoleModal','forbiddenWordsModal','relationGraphModal','guideModal','fullGuideModal','precisionModal','scratchpadModal','branchModal','roleplayModal','genModeModal','exportChoiceModal','statsModal','batchTagModal','regionModal','startBookModal'].some(id => { const m = $(id); return m && m.style.display === 'flex'; }); if(anyModalOpen) return; e.preventDefault(); onContinue(); } }); // v8.6-fix16：守卫补全弹窗
        document.addEventListener('keydown', (e) => { if((e.ctrlKey || e.metaKey) && e.key === 's' && document.activeElement?.id !== 'chatInp' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); const ok = saveCurChapter(); toast(ok ? '已保存' : '❌ 保存失败'); } });
        document.addEventListener('mouseup', () => { if(!isGenerating) saveLibEditorWidth(); });
        document.addEventListener('keydown', (e) => { if(e.key === 'Escape') { if(privacyActive) { togglePrivacy(); return; } saveLibEditorWidth(); const findBar = $('findBar'); if(findBar && findBar.style.display !== 'none') { hideFindBar(); return; } ['precisionModal','scratchpadModal','exportChoiceModal','genModeModal','regionModal','branchModal','apiModal','roleModal','actionModal','costumeModal','globalRoleModal','forbiddenWordsModal','relationGraphModal','guideModal','fullGuideModal','statsModal','batchTagModal','startBookModal'].forEach(id => { let m = $(id); if(m && m.style.display === 'flex') { if(id === 'startBookModal' && sbBusy) { toast('起书进行中，请等待完成'); return; } m.style.display = 'none'; if(id === 'apiModal') cancelPendingGeneration('⏹ 已取消：未配置 API Key'); } }); const relationEditModal = $('relationEditModal'); if(relationEditModal && relationEditModal.style.display === 'flex') closeRelationEdit(); } }); // v8.6-fix16：Esc 列表补 startBookModal；起书生成中（sbBusy）禁止 Esc 关闭（注释移行尾防吞代码）
        const notifyBtn = $('notifyBtn'); if(notifyBtn) notifyBtn.onclick = () => {
            api.notify = !api.notify;
            if(api.notify) { notifyBtn.classList.add('guide-highlight'); toast('页签提醒已开启：生成完成时页签将闪烁 30 秒'); }
            else { notifyBtn.classList.remove('guide-highlight'); toast('页签提醒已关闭'); }
            saveAll();
        };
        // 摘要与经历手动生成按钮（v7.8：合并请求生成摘要+成长）
        const genSummaryBtn = $('genSummaryBtn'); if(genSummaryBtn) genSummaryBtn.onclick = () => {
            // v6.0：摘要生成进行中禁止重复发起（防重复点击浪费 API 费用）
            if(importPending) { toast('备份导入进行中，请等待完成后再生成摘要'); return; } // v8.10-F011
            if(summaryGenerating) { toast('摘要与经历生成中，请稍候'); return; }
            const book = getCurrentBook(); if(!book || !book.currentChapterId) { toast('请先选择章节'); return; }
            const chap = book.chapters.find(c=>c.id===book.currentChapterId); if(!chap) { toast('未找到章节'); return; }
            // v5.9：先同步编辑器中的未保存正文——摘要必须基于最新正文生成，
            // 否则摘要对应旧剧情，后续章节生成会把它注入上下文导致剧情错位
            saveCurChapter();
            if(!chap.content || !chap.content.trim()) { toast('章节正文为空，无法生成摘要和经历'); return; }
            if(isGenerating) { toast('生成进行中，请稍后'); return; }
            toast('摘要与经历生成中...');
            void generateSummaryGrowth(book, chap, null, { manual: true }).catch(()=>{});
        };
        // 摘要框失焦即保存（与正文一起持久化）；跳过"生成中"占位符；手动编辑使旧摘要请求失效
        const summaryTa = $('summaryArea'); if(summaryTa) {
            summaryTa.addEventListener('blur', () => {
                const b2 = getCurrentBook(); if(!b2 || !b2.currentChapterId) return;
                const c2 = b2.chapters.find(x=>x.id===b2.currentChapterId); if(!c2) return;
                if(summaryTa.value.trim() !== SUMMARY_PLACEHOLDER) {
                    const newSum = summaryTa.value.trim().slice(0, 300);
                    if(c2.summary !== newSum) {
                        c2.summary = newSum;
                        c2.summaryRequestVersion = (c2.summaryRequestVersion || 0) + 1; // 摘要内容实际变化才递增
                        saveAll();
                    }
                }
            });
            // 摘要编辑时：立即使在途旧摘要请求失效（未失焦也防旧请求覆盖输入）+ 同步"未保存"状态
            // 注意：代码自动设置占位符不触发 input 事件，不影响摘要请求本身
            summaryTa.addEventListener('input', () => {
                const b3 = getCurrentBook(); if(b3 && b3.currentChapterId) {
                    const c3 = b3.chapters.find(x=>x.id===b3.currentChapterId);
                    if(c3) c3.summaryRequestVersion = (c3.summaryRequestVersion || 0) + 1;
                }
                const sp = $('saveStatus'); if(sp) sp.innerText = '未保存';
            });
        }
        // v8.1：隐藏模式——双击「AI小说生成器」标题切换（覆盖主界面仅留顶栏），Esc 退出
        // v8.1.2：遮罩改为自由字符画，5 种风格随机，不表露工具用途
        const appTitle = document.querySelector('.logo h2');
        let privacyActive = false;
                const PRIVACY_ARTS = [
            // ── 风格① 绿 · 矩阵代码雨（画满幕布） ──
            { color: '#4ECB71', text:
              "                                                                                  \n"
            + "    ╔════════════════════════════════════════════════════════════════════════╗ \n"
            + "    ║      ▓▓▓▓▓  M A T R I X  //  S I G N A L  ▓▓▓▓▓                              ║ \n"
            + "    ╚════════════════════════════════════════════════════════════════════════╝ \n"
            + "                                                                                  \n"
            + "                  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "    01001000 01100101 01101100 01101100 01101111 01101111 01101100                       \n"
            + "    01110111 01101111 01110010 01101100 01100100 00100000 01110100                       \n"
            + "    01101000 01100101 00100000 01101101 01100001 01110100 01110010                       \n"
            + "    01101001 01111000 00100000 01110100 01101000 01100101 01101111                       \n"
            + "                                                                                  \n"
            + "                            ▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒               \n"
            + "                            ▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒               \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "        01101010 01101001 00101101 01100001                                          \n"
            + "        01110100 01110010 01101001 01111000                                          \n"
            + "                                                                                  \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "                                              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    \n"
            + "                                              ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    \n"
            + "                                                                                  \n"
            + "    > follow the white rabbit                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    \n"
            + "    > wake up, neo                             ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    \n"
            + "    > ██ blinking ...                                                                          \n"
            + "                                                                                  \n"
            + "                                              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    \n"
            + "                                              ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    \n"
            + "                                                                                  \n"
            + "                              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "    █▓▒░ 数据在血管里流动 ░▒▓█                                                          \n"
            + "                              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "    01100101 01110100 01101000 01101001 01100011 01100001 01101100                       \n"
            + "    00100000 01110011 01101001 01100111 01101110 01100001 01101100                       \n"
            + "    00100000 01110010 01100101 01100001 01101100 01101001 01110100                       \n"
            + "                                                                                  \n"
            + "        ▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓▒▒▓▓    \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        \n"
            + "                          ▓▓▓ 01001000 01100101 01101100 01101100 ▓▓▓                \n"
            + "                          ▓▓▓ 01110111 01101111 01110010 01101100 ▓▓▓                \n"
            + "                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        \n"
            },
            // ── 风格② 蓝 · 星海鲸歌（画满幕布） ──
            { color: '#6EC6F8', text:
              "                                                                                  \n"
            + "                              ✦  星 海 之 间 ， 有 鲸 歌 传 来  ✦                       \n"
            + "                                                                                  \n"
            + "    ·       *       .                  *      .   *                                   \n"
            + "              *         .     .   *       .        *                                \n"
            + "    *        .   *    ,        .   .     *    .   *    ,                            \n"
            + "            .     *    .   *      .         .   *     .   *                         \n"
            + "                       .        *    ,   *      .                                 \n"
            + "                                                                                  \n"
            + "    ·      ✦          *              ·            ✦            ·          ✦    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                              \n"
            + "                       ~  ✦  银 河  在  转  鲸  鱼  在  唱  ✦  ~                  \n"
            + "                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "           ✦                              *                          ·          \n"
            + "                ·         *            .    *                                     \n"
            + "      *            .   *     ·                ✦        ·        *                \n"
            + "                .        ✦              .       *                                 \n"
            + "                                                                                  \n"
            + "                                          ·                *              ✦        \n"
            + "         ✦        ·              *                          ·                   \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                              ✦  鲸歌缓缓回响于整个幕布  ✦                          \n"
            },
            // ── 风格③ 金 · 古老铭文（画满幕布） ──
            { color: '#F0C05A', text:
              "                                                                                  \n"
            + "        ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦          \n"
            + "                                                                                  \n"
            + "                  ◈ ◈ ◈  解 译 信 号 流  ◈ ◈ ◈                                     \n"
            + "                  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                              \n"
            + "                  Ｔ Ｈ Ｅ    Ａ Ｎ Ｃ Ｉ Ｅ Ｎ Ｔ    Ｓ Ｉ Ｇ Ｎ Ａ Ｌ          \n"
            + "                  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                              \n"
            + "                                                                                  \n"
            + "                            ··−−  ·−·  −−··  ·−−  ··−−                            \n"
            + "                  ✦   ▙▟  ▚▞  ▛▜  ▙▟  ▚▞   ✦                                          \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "        ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "    ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                       ▓▓░░░░░░▓▓                                                  \n"
            + "                     ▓▓░░░░░░░░░░▓▓                                                \n"
            + "                     ▓░░░░░░░░░░░░▓                                                \n"
            + "                      ▓▓░░░░░░░░▓▓                                                  \n"
            + "                        ▓▓▓▓▓▓▓▓                                                    \n"
            + "                                                                                  \n"
            + "    ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    \n"
            + "                                                                                  \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                  ◈ 频率锁定 ◈ 低语在墙内 ◈                                         \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                       ▓▓░░░░░░▓▓                                                  \n"
            + "                     ▓▓░░░░░░░░░░▓▓                                                \n"
            + "                     ▓░░░░░░░░░░░░▓                                                \n"
            + "                      ▓▓░░░░░░░░▓▓                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "        ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦    ✦          \n"
            + "                                                                                  \n"
            + "                          ✦ 一枚沉睡的金色齿轮 ✦                                    \n"
            },
            // ── 风格④ 白 · 纯白数据流（画满幕布） ──
            { color: '#EDEAF2', text:
              "                                                                                  \n"
            + "    PURE DATA // PURE DATA // PURE DATA // PURE DATA // PURE DATA                \n"
            + "                                                                                  \n"
            + "    10101010 01010101 10101010 01010101 10101010 01010101 10101010 01010101    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "              ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    11110000 00001111 11110000 00001111 11110000 00001111 11110000 00001111    \n"
            + "                                                                                  \n"
            + "                          ~ 雪花在屏幕上融化 ~                                       \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "              ▂▃▄▅▆▇█▇▆▅▄▃▂▁  ▂▃▄▅▆▇█▇▆▅▄▃▂▁  ▂▃▄▅▆▇█▇▆▅▄▃▂▁                \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    01011010 01101010 11001010 00101101 01011010 01101010 11001010 00101101    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ▏▎▍▌▋▊▉█  █▉▊▋▌▍▎▏  ▏▎▍▌▋▊▉█  █▉▊▋▌▍▎▏  ▏▎▍▌▋▊▉█                \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                          ~ 一切归于寂静 ~                                           \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    00110011 00110101 00110111 00111001 00110011 00110101 00110111 00111001    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    01001101 01100001 01110100 01110010 01101001 01111000 00100000 01110011    \n"
            + "    01110100 01100001 01111001 01110011 00100000 01110111 01101001 01110100    \n"
            + "    01101000 00100000 01101100 01101111 01101110 01100111 00100000 01100011    \n"
            + "    01101000 01100001 01101001 01101110 00100000 01101111 01100110 00100000    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                              ❄    ❅    ❆                                          \n"
            + "                          ❅    ❆    ❄    ❅                                          \n"
            + "                              ❆    ❅    ❄                                          \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                              ❄    ❅    ❆    ❄                                      \n"
            + "                          ❅    ❆    ❄    ❅    ❆                                      \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ~ 数据正在变得纯粹，最终化为静默的雪花 ~                                         \n"
            },
            // ── 风格⑤ 红 · 警报脉冲（画满幕布） ──
            { color: '#FF6B6B', text:
              "                                                                                  \n"
            + "    ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T      \n"
            + "    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔    \n"
            + "                                                                                  \n"
            + "    0xDEADBEEF   0xFEEDFACE   0xCAFEBABE   0xDEADBEEF   0xFEEDFACE                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ████████████░░░░░░  异常定位中  ░░░░░░                                          \n"
            + "                                                                                  \n"
            + "                  █▓▒░ 信 号 在 燃 烧 ░▒▓█                                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    !!!!  检测到异常波动  !!!!                                                      \n"
            + "                                                                                  \n"
            + "                  █▓▒░ 信 号 在 燃 烧 ░▒▓█                                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ████████████░░░░░░  异常定位中  ░░░░░░                                          \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    00110011 00110101 00110111 00111001                                              \n"
            + "    01000101 01010010 01010010 01001111                                              \n"
            + "    01010010 00110000 00110110 00110001                                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                  █▓▒░ 信 号 在 燃 烧 ░▒▓█                                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ⚠  建议立即关注  ⚠                                                            \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔    \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    0xDEADBEEF   0xFEEDFACE   0xCAFEBABE   0xDEADBEEF   0xFEEDFACE                  \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "                  █▓▒░ 信 号 在 燃 烧 ░▒▓█                                              \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ████████████░░░░░░  异常定位中  ░░░░░░                                          \n"
            + "                                                                                  \n"
            + "                                                                                  \n"
            + "    ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T ⚠ A L E R T      \n"
            }
        ];
        function togglePrivacy() {
            privacyActive = !privacyActive;
            const po = $('privacyOverlay');
            if(po) {
                po.style.display = privacyActive ? 'flex' : 'none';
                if(privacyActive) {
                    const pa = $('privacyArt');
                    if(pa) {
                        const art = PRIVACY_ARTS[Math.floor(Math.random() * PRIVACY_ARTS.length)];
                        pa.textContent = art.text;
                        pa.style.color = art.color;
                        pa.style.textShadow = '0 0 18px ' + art.color + '88';
                    }
                }
            }
        }
        if(appTitle) appTitle.addEventListener('dblclick', (e) => { e.preventDefault(); togglePrivacy(); });
        const guideBtn = $('guideBtn'); const guideModal = $('guideModal'); const fullGuideModal = $('fullGuideModal');
        const closeGuideBtn = $('closeGuideBtn'); const openFullGuideBtn = $('openFullGuideBtn'); const closeFullGuideBtn = $('closeFullGuideBtn');
        if(guideBtn && guideModal) { guideBtn.onclick = () => { guideModal.style.display = 'flex'; }; if(closeGuideBtn) closeGuideBtn.onclick = () => { guideModal.style.display = 'none'; }; if(openFullGuideBtn) openFullGuideBtn.onclick = () => { guideModal.style.display = 'none'; if(fullGuideModal) fullGuideModal.style.display = 'flex'; }; if(closeFullGuideBtn) closeFullGuideBtn.onclick = () => { if(fullGuideModal) fullGuideModal.style.display = 'none'; }; }
        let modalMouseDownTarget = null;
        document.addEventListener('mousedown', (e) => { modalMouseDownTarget = e.target; }, true);
        window.addEventListener('click', (e) => {
            if (modalMouseDownTarget !== e.target) { modalMouseDownTarget = null; return; }
            modalMouseDownTarget = null;
            ['apiModal','roleModal','actionModal','costumeModal','globalRoleModal','forbiddenWordsModal','relationGraphModal','guideModal','fullGuideModal','precisionModal','scratchpadModal','exportChoiceModal','genModeModal','regionModal'].forEach(id => { let m = $(id); if(e.target === m && m) { m.style.display='none'; if(id==='apiModal') cancelPendingGeneration('⏹ 已取消：未配置 API Key'); } });
            const relationEditModal = $('relationEditModal'); if(e.target === relationEditModal && relationEditModal) closeRelationEdit();
            // 动态创建的模态框（如批量导入/导出）：无id的.modal元素，点遮罩即关闭
            if (e.target.classList.contains('modal') && !e.target.id && e.target.parentNode === document.body) {
                e.target.remove();
            }
        });
        document.querySelectorAll('.tab').forEach(t => { t.onclick = () => { document.querySelectorAll('.tab').forEach(tt=>tt.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active')); t.classList.add('active'); const pane = $(`pane-${t.dataset.tab}`); if(pane) pane.classList.add('active'); if(t.dataset.tab === 'log') renderLogList(); }; });

        // 字体大小按钮
        const fontSizeDown = $('fontSizeDown'); const fontSizeUp = $('fontSizeUp');
        if(fontSizeDown) fontSizeDown.onclick = () => changeFontSize(-1);
        if(fontSizeUp) fontSizeUp.onclick = () => changeFontSize(1);
        // 精准模式
        const precisionBtn = $('precisionBtn'); if(precisionBtn) precisionBtn.onclick = openPrecisionModal;
        const precRandomCombo = $('precRandomCombo'); if(precRandomCombo) precRandomCombo.onclick = randomComboFromPrecision;
        const precOrganicCombo = $('precOrganicCombo'); if(precOrganicCombo) precOrganicCombo.onclick = organicComboFromPrecision;
        const precThisCombo = $('precThisCombo'); if(precThisCombo) precThisCombo.onclick = copyThisCombo;
        const savePrecisionBtn = $('savePrecisionBtn'); if(savePrecisionBtn) savePrecisionBtn.onclick = savePrecision;
        const closePrecisionBtn = $('closePrecisionBtn'); if(closePrecisionBtn) closePrecisionBtn.onclick = () => { $('precisionModal').style.display='none'; };
        const precDisableBtn = $('precDisableBtn'); if(precDisableBtn) precDisableBtn.onclick = disablePrecision;
        const precSelectAllChars = $('precSelectAllChars'); if(precSelectAllChars) precSelectAllChars.onclick = () => { selectAllPrecision('char'); };
        const precSelectAllActions = $('precSelectAllActions'); if(precSelectAllActions) precSelectAllActions.onclick = () => { selectAllPrecision('action'); };
        const precSelectAllCostumes = $('precSelectAllCostumes'); if(precSelectAllCostumes) precSelectAllCostumes.onclick = () => { selectAllPrecision('costume'); };
        const precDeselectAll = $('precDeselectAll'); if(precDeselectAll) precDeselectAll.onclick = () => { selectAllPrecision('none'); };
        // v8.0.35：点按钮弹居中卡片（仿导出卡片），二选一互斥 + 保存/关闭
        const dualModeBtn = $('dualModeBtn');
        let genModeTempDual = false, genModeTempMulti = false; // 卡片临时选择（保存才生效）
        function updateGenModeCard() {
            const bD = $('genModeDualBtn'), bM = $('genModeMultiBtn');
            if(bD) bD.classList.toggle('selected', genModeTempDual);
            if(bM) bM.classList.toggle('selected', genModeTempMulti);
        }
        function openGenModeCard() {
            genModeTempDual = !!api.dualMode;
            genModeTempMulti = !!api.multiChap;
            updateGenModeCard();
            const m = $('genModeModal'); if(m) m.style.display = 'flex';
        }
        if(dualModeBtn) dualModeBtn.onclick = () => { openGenModeCard(); };
        const gdBtn = $('genModeDualBtn'), gmBtn = $('genModeMultiBtn');
        if(gdBtn) gdBtn.onclick = () => { genModeTempDual = !genModeTempDual; if(genModeTempDual) genModeTempMulti = false; updateGenModeCard(); };
        if(gmBtn) gmBtn.onclick = () => { genModeTempMulti = !genModeTempMulti; if(genModeTempMulti) genModeTempDual = false; updateGenModeCard(); };
        const gsBtn = $('genModeSaveBtn');
        if(gsBtn) gsBtn.onclick = () => {
            const mm = $('genModeModal'); if(mm) mm.style.display = 'none';
            const dualChanged = (genModeTempDual !== !!api.dualMode), multiChanged = (genModeTempMulti !== !!api.multiChap);
            api.dualMode = genModeTempDual; api.multiChap = genModeTempMulti;
            if(api.dualMode && !api.multiChap) toast('并发双版已开启：下次全新生成将产出 A/B 两版（续写/重写/连发不生效），生成结束自动关闭');
            else if(api.multiChap && !api.dualMode) toast('连发多章已开启：下次发送将自动连续生成 ' + (api.multiChapCount || 3) + ' 章（第1章按指令，之后自动续写），生成结束自动关闭');
            else toast('生成模式已关闭');
            saveAll(); updateDualModeButton();
            if(!dualChanged && !multiChanged) return;
        };
        const gcBtn = $('genModeCloseBtn');
        if(gcBtn) gcBtn.onclick = () => { const mm = $('genModeModal'); if(mm) mm.style.display = 'none'; };
    }

    
