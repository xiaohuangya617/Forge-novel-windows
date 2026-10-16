    function hidePolishBar() { const bar = $('polishActionBar'); if(bar) bar.style.display = 'none'; }
    function restoreEditorButtons() {
        ['saveChapBtn','regenerateBtn','continueBtn','polishBtn'].forEach(id => { const b = $(id); if(b) b.disabled = false; });
        const rb = $('rollbackBtn'); if(rb) enableRollbackButton(!!(rollbackSnapshot && rollbackSnapshot.chapterId));
    }
    async function onRegenerate() {
        let book = getCurrentBook();
        if(!book || !book.currentChapterId) { toast("请先选择章节"); return; }
        if(isGenerating) { toast("已有生成任务进行中，请等待或点击停止"); return; }
        if(pendingPolish || polishMode) { toast(pendingPolish ? "润色进行中，请先等待完成" : "润色预览中，请先应用或取消"); return; }
        if(pendingBranch) { toast("走向生成中，请稍候再重写"); return; }
        if(banterBusy) { toast("吐槽生成中，请等待完成后再重写"); return; } // v8.7 EXE-87-R3-F01 收口：吐槽在途禁止发起重写（自动重写直达 doRegenerateWithInstr 不经 onSend；重写替换同章正文后，迟到吐槽按新正文重算指纹键错绑显示）
        if(pendingRewrite) { toast("已有待发送的重写，先发送或切换章节取消"); return; }
        // v7.2：发起重写即清除走向待发态（消息栏将被原始指令覆盖，走向态作废）
        branchContinuePending = false; branchBookId = null;
        let chap = book.chapters.find(c=>c.id===book.currentChapterId); if(!chap) return;
        if(!ensureCurrentChapterSaved()) return; // 先保存编辑器实时内容（失败则取消重写）
        if(pendingGeneration) cancelPendingGeneration('⚠️ 已被新的生成任务覆盖');
        saveRollbackSnapshot(false, true); // v7.2：静默存快照（回滚按钮待重写真正生成后才亮起）
        // v7.2：回填本章原始指令到消息栏（可见可编辑），无原始指令则清空提示
        const hasValidPrompt = chap.prompt && chap.prompt.trim().length > 3 && chap.prompt !== '续写指令';
        const inp = $('chatInp'); if(inp) inp.value = hasValidPrompt ? chap.prompt : '';
        if(!hasValidPrompt) toast("本章无原始指令，已清空消息栏，请手动输入");
        // v7.2：还原精准勾选 = 当前勾选（v7.1 已保留勾选；生成后 precisionMode 自动关闭，
        // 重写发起时若有勾选则重新开启——用户拍板"重写真实精准注入非全量"）
        const hasPrecisionSelections = !!(book.precisionChars?.length || book.precisionActions?.length || (book.precisionCostumes||[])?.length);
        if(hasPrecisionSelections) {
            book.precisionMode = true;
            if(!persistOrWarn()) return;
            updatePrecisionButton();
        } else {
            toast("本章无精准勾选记录，重写将使用全量设定");
        }
        // v7.2：进入重写态——发送按钮样式变更标识"发送=重写本章"（pendingRewrite 防误新建）
        setRewriteMode(true, chap.id);
        // v7.2：重写自动发送开关——回填后自动执行（自动模式不弹精准窗，直接执行）
        if(api.rewriteAutoSend) {
            const autoInstr = $('chatInp')?.value.trim();
            if(autoInstr) { setRewriteMode(false, null); await doRegenerateWithInstr(autoInstr, chap.id); }
            // v7.3 C4 修复：自动发送但消息栏为空（章节无原始指令）→ 明确提示，保持重写态待手动输入
            else { toast("消息栏为空（本章无原始指令），请手动输入后发送重写"); }
        } else if(hasPrecisionSelections) {
            // 手动模式：打开精准弹窗供用户确认/修改勾选（用户拍板"还原当前勾选"）
            openPrecisionModal();
            toast("已回填原始指令，发送即重写本章（可编辑后发送，切章节可取消）");
        } else {
            toast("已回填原始指令，发送即重写本章（可编辑后发送，切章节可取消）");
        }
    }
    // v7.2：重写态状态机——发送按钮样式切换
    function setRewriteMode(on, chapterId) {
        const book = getCurrentBook();
        if(on) {
            pendingRewrite = { bookId: book ? book.id : currentBookId, chapterId };
            const btn = $('sendMsgBtn'); if(btn) {
                btn.classList.add('rewrite-mode');
                btn.title = '发送重写本章（切章节可取消）';
                const ic = btn.querySelector('i'); if(ic) ic.className = 'fas fa-redo-alt';
            }
        } else {
            pendingRewrite = null;
            const btn = $('sendMsgBtn'); if(btn) {
                btn.classList.remove('rewrite-mode');
                btn.title = '发送指令';
                const ic = btn.querySelector('i'); if(ic) ic.className = 'fas fa-paper-plane';
            }
        }
    }
    // v7.2：实际执行重写（发送按钮重写态 / 重写自动发送 共用）
    async function doRegenerateWithInstr(instr, chapterId) {
        if(banterBusy) { toast("吐槽生成中，请等待完成后再重写"); return; } // v8.7 EXE-87-R3-F01 收口（共享权威入口纵深）：自动重写（onRegenerate 内）与精准重写（onSend pendingRewrite 分支）均直达本函数——正文改写共享入口与吐槽互斥
        let book = getCurrentBook();
        if(!book) return;
        if(instr) { addChat('user', instr); }
        if($('chatInp')) $('chatInp').value = '';
        let lid = addChat('assistant', '🔄 重写中...', true);
        const startTime = Date.now();
        await executeGeneration(instr, true, chapterId, false, lid, (chap, cost, aborted, saveFailed, abortReason) => {
            if(chap) {
                // v7.2：重写真正生成文字后才启用回滚按钮（发起时只静默存快照）
                enableRollbackButton(true);
                const elapsed = formatTime(Date.now() - startTime);
                let tail = cost > 0 ? ` (正文 $${cost.toFixed(2)}USD) (耗时：${elapsed})` : ` (耗时：${elapsed})`;
                lastGenCostRef = { bookId: book.id, chapId: chap.id, cost: cost }; // v8.4-P2.1：重写完成后同步成本快照，防旧快照与摘要配对错位
                if(saveFailed) {
                    replaceChatMessage(lid, `⚠️ 重写完成 新标题：《${chap.title}》但本地保存失败！请立即导出或复制正文，刷新可能丢失`, book);
                    toast('⚠️ 重写完成但保存失败，请立即导出备份或复制正文');
                } else {
                    replaceChatMessage(lid, `✨ 重写完成 新标题：《${chap.title}》${tail}`, book);
                    startTabBlink(`✅ 重写完成：《${chap.title}》`);
                }
                renderChapters(); loadCurChapter();
            } else { if(!aborted) startTabBlink('❌ 重写失败'); replaceChatMessage(lid, aborted ? (abortReason === 'timeout' ? '⏹ 重写超时（10分钟）已取消' : '⏹ 已停止') : '重写失败', book); } // v8.7-M3：超时与主动停止文案分开
        });
    }

