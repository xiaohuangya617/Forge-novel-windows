    let writingLockPrev = {};
    function setWritingLock(locked) {
        const content = $('novelContent'); if(content) content.contentEditable = locked ? 'false' : 'true';
        const summary = $('summaryArea'); if(summary) summary.disabled = locked;
        // v5.9：查找/替换/回滚纳入锁定——replaceOne/replaceAll 直接改 DOM、performRollback 直接改章节数据，
        // contentEditable=false 拦不住它们；生成期间放行则 AI 返回后用户操作会被覆盖丢失
        ['saveChapBtn','regenerateBtn','continueBtn','checkConflictBtn','banterBtn','findBtn','rollbackBtn','replaceOneBtn','replaceAllBtn'].forEach(id => {
            const el = $(id); if(!el) return;
            // v8.6-fix24：锁定只保存首次快照（防连发每章重复锁定覆盖为"已禁用"），解锁后删除快照——原逻辑连发结束后 8 个按钮永久灰死
            if(locked) { if(!(id in writingLockPrev)) writingLockPrev[id] = el.disabled; el.disabled = true; }
            else if(id in writingLockPrev) {
                el.disabled = writingLockPrev[id]; delete writingLockPrev[id];
                // v8.6-fix34（Bug1）：rollbackBtn 状态由 enableRollbackButton 独立管理（重写成功回调点亮/清快照熄灭/回滚后清理），
                // 写锁解锁不得用"加锁瞬间"的旧快照覆盖其最新状态——否则重写生文成功后回滚按钮被解锁重新禁用（点击无反应）
                if(id === 'rollbackBtn') enableRollbackButton(!!(rollbackSnapshot && rollbackSnapshot.chapterId));
            }
        });
        const tip = $('writingLockTip'); if(tip) tip.style.display = locked ? 'block' : 'none';
    }
    function getCurrentBook() { return books.find(b=>b.id===currentBookId); }
    function initCharactersIfNeeded(book) { if(!Array.isArray(book.characters)) book.characters=[]; }
    function initForbiddenWordsIfNeeded(book) { if(!Array.isArray(book.forbiddenWords)) book.forbiddenWords=[]; }
    function initCharRelations(book) { if(!Array.isArray(book.characters)) book.characters=[]; book.characters.forEach(c=>{if(!c.relationships)c.relationships=[];}); if(!book.relationPositions) book.relationPositions={}; }
    function escapeHtml(s) { if(s == null) return ''; s = String(s); return s.replace(/[&<>"'`]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m])); } // v8.6-r19：String 兜底——数字 id（存量数据）无 .replace 会 TypeError 崩弹窗
    function uuid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'id-'+Date.now()+'-'+Math.random().toString(36).substring(2,8)+'-'+(uuidCounter++);
    }
    function formatTime(ms) { const s=Math.floor(ms/1000); if(ms < 500) return '不到1秒'; if(s<60) return s+'秒'; const m=Math.floor(s/60); if(m<60) { const sec=s%60; return m+'分'+sec+'秒'; } const h=Math.floor(m/60); const rm=m%60; const sec=s%60; return h+'小时'+rm+'分'+sec+'秒'; }

    function migrateChapter(book) {
        if(!Array.isArray(book.chapters)) book.chapters = [];
        book.chapters.forEach(ch => {
            if(!ch.id) ch.id = uuid();
            if(!ch.title) ch.title = '未命名章节';
            if(ch.content === undefined) ch.content = '';
            if(ch.prompt === undefined) ch.prompt = '';
            if(ch.isInterlude === undefined) ch.isInterlude = false;
            if(ch.summary === undefined) ch.summary = '';
            if(ch.isContinuation === undefined) {
                ch.isContinuation = (!ch.prompt || ch.prompt.length < 3 || ch.prompt === '续写指令');
            }
            if(!ch.checkResult) ch.checkResult = [];
            if(ch.checkState === undefined) ch.checkState = ch.checkResult.length ? 'done' : 'never';
        });
        if(book.chatHistory && book.chatHistory.length > 50) {
            book.chatHistory = book.chatHistory.slice(-50);
        }
        initCharRelations(book);
        if(book.forbiddenWords) book.forbiddenWords.forEach(f => { if(!f.id) f.id = uuid(); });
        if(typeof book.precisionMode !== 'boolean') book.precisionMode = false;
        if(!Array.isArray(book.precisionChars)) book.precisionChars = [];
        if(!Array.isArray(book.precisionActions)) book.precisionActions = [];
        if(!Array.isArray(book.precisionCostumes)) book.precisionCostumes = [];
    }

    