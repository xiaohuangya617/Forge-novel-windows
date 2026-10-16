    // ======================== v7.4 四库编辑栏宽度记忆 ========================
    let layoutPrefs = { libEditorW: { role: 0, globalRole: 0, action: 0, costume: 0 }, textarea: {} }; // 0=默认比例；textarea 存各编辑框宽高
    const LIB_EDITOR_MAP = { roleModal: 'role', globalRoleModal: 'globalRole', actionModal: 'action', costumeModal: 'costume' };
    let libEditorResizeTimer = null;
    // v7.4 修复：ResizeObserver 监听编辑栏宽度变化→防抖保存（CSS resize 手柄拖拽结束的 mouseup 浏览器常不派发，
    // 原实现只靠 document mouseup 保存，用户拖完直接关软件会丢最后宽度——这是"重启后恢复默认"的根因）
    function watchLibEditorResize(editor) {
        if(!editor || editor.__libWatched) return;
        editor.__libWatched = true;
        try {
            new ResizeObserver(() => {
                if(libEditorResizeTimer) clearTimeout(libEditorResizeTimer);
                libEditorResizeTimer = setTimeout(() => saveLibEditorWidth(), 200);
            }).observe(editor);
        } catch(e) {}
    }
    // v7.4 修复2：JS 拖拽分隔条 + 保存布局按钮（CSS resize 手柄在 flex 子项上不可靠——
    // 很多浏览器手柄不显示/拖不动，ResizeObserver 永远不触发。改为自实现 mousedown/mousemove/mouseup，
    // 拖完自动保存（v7.5 起移除保存布局按钮，ResizeObserver/拖拽/全局 mouseup/关闭按钮四重自动保存）
    function initLibEditorLayout() {
        for(const [modalId, key] of Object.entries(LIB_EDITOR_MAP)) {
            const modal = $(modalId); if(!modal) continue;
            const container = modal.querySelector('.lib-container'); if(!container || container.__libLayoutInit) continue;
            container.__libLayoutInit = true;
            const list = container.querySelector('.lib-list');
            const editor = container.querySelector('.lib-editor');
            if(!list || !editor) continue;
            // ① 拖拽分隔条（插在 list 与 editor 之间）
            const bar = document.createElement('div');
            bar.className = 'lib-resizer';
            bar.title = '拖动调整编辑栏宽度（自动保存）';
            container.insertBefore(bar, editor);
            bar.addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation();
                const startX = e.clientX;
                const startW = editor.offsetWidth;
                const maxW = Math.floor((container.clientWidth || 700) * 0.65);
                const onMove = (ev) => {
                    let w = startW + (ev.clientX - startX);
                    w = Math.max(240, Math.min(maxW, w));
                    editor.style.width = w + 'px';
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    saveLibEditorWidth(); // 拖完立即保存（mouseup 是我们自己监听的，可靠）
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            // ③ 应用已存宽度 + 挂 ResizeObserver（辅助）
            let w = layoutPrefs.libEditorW[key];
            if(!w || w <= 0) { const saved = localStorage.getItem('lib_editor_w_' + key); w = saved ? parseInt(saved) : 0; }
            if(w > 240) editor.style.width = w + 'px';
            watchLibEditorResize(editor);
        }
    }
    function applyLibEditorWidth() {
        for(const [modalId, key] of Object.entries(LIB_EDITOR_MAP)) {
            const modal = $(modalId); if(!modal) continue;
            const editor = modal.querySelector('.lib-editor'); if(!editor) continue;
            let w = layoutPrefs.libEditorW[key];
            if(!w || w <= 0) { const saved = localStorage.getItem('lib_editor_w_' + key); w = saved ? parseInt(saved) : 0; }
            if(w > 240) editor.style.width = w + 'px';
            watchLibEditorResize(editor);
        }
    }
    function saveLibEditorWidth() {
        for(const [modalId, key] of Object.entries(LIB_EDITOR_MAP)) {
            const modal = $(modalId); if(!modal || modal.style.display !== 'flex') continue;
            const editor = modal.querySelector('.lib-editor'); if(!editor) continue;
            const w = editor.offsetWidth;
            if(w > 240) { layoutPrefs.libEditorW[key] = w; try { localStorage.setItem('lib_editor_w_' + key, String(w)); } catch(e) {} }
        }
    }
    let libTextareaTimer = null;
    // v7.4 修复3：4 库编辑区 textarea 自身宽高记忆（用户需求：详细款式/描写建议等拖动右下角改变大小要长久保存）
    // —— textarea 原生 resize:both 手柄一直可用（非 flex 面板问题），缺的是"变化→保存→重启恢复"链路。
    // ResizeObserver 监听尺寸变化（含拖动手柄），防抖保存到 localStorage + layoutPrefs.textarea（EXE 文件层兜底）。
