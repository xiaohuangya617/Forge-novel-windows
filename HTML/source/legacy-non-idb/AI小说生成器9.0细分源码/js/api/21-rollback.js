    // 回滚快照
    const rollbackBtn = $('rollbackBtn');
    function enableRollbackButton(enable) {
        if(rollbackBtn) {
            rollbackBtn.disabled = !enable;
            rollbackBtn.style.background = enable ? "#2A8A4A" : "#2A5A3A";
        }
    }
    function saveRollbackSnapshot(force=false, silent=false) {
        const book = getCurrentBook();
        if(book && book.currentChapterId) {
            const chap = book.chapters.find(c=>c.id===book.currentChapterId);
            if(chap) {
                if(!force && rollbackSnapshot && rollbackSnapshot.chapterId === chap.id && rollbackSnapshot.content === chap.content) return;
                // 完整快照：正文/标题/摘要/提示词/章节类型/冲突状态 全部记录，
                // 回滚后正文与摘要、冲突结果保持一致（防上下文错配）
                rollbackSnapshot = {
                    chapterId: chap.id,
                    content: chap.content,
                    title: chap.title,
                    summary: chap.summary || '',
                    prompt: chap.prompt || '',
                    isContinuation: !!chap.isContinuation,
                    isInterlude: !!chap.isInterlude,
                    checkResult: JSON.parse(JSON.stringify(chap.checkResult || [])),
                    checkState: chap.checkState || 'never',
                    checkReport: chap.checkReport ? JSON.parse(JSON.stringify(chap.checkReport)) : null // v8.6-r12：快照补 checkReport——防回滚后冲突面板评级/hits 与新正文错配
                };
                // v7.2：silent=true 只存快照不亮按钮——重写发起时存快照，但回滚按钮
                // 必须在重写真正生成文字后才亮起（由 doRegenerateWithInstr 成功回调启用）
                if(!silent) enableRollbackButton(true);
            }
        }
    }
    function clearRollbackSnapshot() { rollbackSnapshot = null; enableRollbackButton(false); }
    function performRollback() {
        // v5.9：生成期间禁止回滚（回滚直接改写章节数据，AI 返回后重写结果会覆盖用户刚回滚的内容）
        if(isGenerating) { toast('AI 生成中，回滚已锁定'); return; }
        if(!rollbackSnapshot) { toast("没有可回滚的快照"); return; }
        const book = getCurrentBook();
        if(book && book.currentChapterId === rollbackSnapshot.chapterId) {
            const chap = book.chapters.find(c=>c.id===book.currentChapterId);
            if(chap) {
                if(chap.content === rollbackSnapshot.content) { toast("当前内容与快照相同，无需回滚"); clearRollbackSnapshot(); return; }
                chap.content = rollbackSnapshot.content;
                if(rollbackSnapshot.title !== undefined) chap.title = rollbackSnapshot.title;
                if(rollbackSnapshot.summary !== undefined) chap.summary = rollbackSnapshot.summary;
                if(rollbackSnapshot.prompt !== undefined) chap.prompt = rollbackSnapshot.prompt;
                if(rollbackSnapshot.isContinuation !== undefined) chap.isContinuation = rollbackSnapshot.isContinuation;
                if(rollbackSnapshot.isInterlude !== undefined) chap.isInterlude = rollbackSnapshot.isInterlude;
                if(rollbackSnapshot.checkResult !== undefined) chap.checkResult = JSON.parse(JSON.stringify(rollbackSnapshot.checkResult));
                if(rollbackSnapshot.checkState !== undefined) chap.checkState = rollbackSnapshot.checkState;
                if(rollbackSnapshot.checkReport !== undefined) chap.checkReport = rollbackSnapshot.checkReport ? JSON.parse(JSON.stringify(rollbackSnapshot.checkReport)) : null; // v8.6-r12
                saveAll(); loadCurChapter(); renderChapters(); clearRollbackSnapshot(); // v8.6-r12：renderChapters 刷新侧栏标题（回滚后标题残留修复）
                toast("已回滚");
            }
        } else { toast("快照已失效（章节已改变）"); clearRollbackSnapshot(); }
    }

