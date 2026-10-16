    function initLibTextareaResize() {
        for(const [modalId, key] of Object.entries(LIB_EDITOR_MAP)) {
            const modal = $(modalId); if(!modal) continue;
            const editor = modal.querySelector('.lib-editor'); if(!editor) continue;
            editor.querySelectorAll('textarea').forEach(ta => {
                if(!ta.id || ta.__taWatched) return;
                ta.__taWatched = true;
                // ① 恢复已存宽高（layoutPrefs 优先，localStorage 兜底兼容旧数据）
                let w = 0, h = 0;
                if(layoutPrefs.textarea && layoutPrefs.textarea[ta.id]) { w = layoutPrefs.textarea[ta.id].w || 0; h = layoutPrefs.textarea[ta.id].h || 0; }
                if(!w) { const sw = localStorage.getItem('lib_ta_w_' + ta.id); w = sw ? parseInt(sw) : 0; }
                if(!h) { const sh = localStorage.getItem('lib_ta_h_' + ta.id); h = sh ? parseInt(sh) : 0; }
                if(w > 100) ta.style.width = w + 'px';
                if(h > 40) ta.style.height = h + 'px';
                // ② 监听尺寸变化→防抖保存
                try {
                    new ResizeObserver(() => {
                        if(libTextareaTimer) clearTimeout(libTextareaTimer);
                        libTextareaTimer = setTimeout(() => {
                            try {
                                if(!ta.isConnected) return;
                                const ow = ta.offsetWidth, oh = ta.offsetHeight;
                                if(ow > 100 && oh > 40) {
                                    layoutPrefs.textarea = layoutPrefs.textarea || {};
                                    layoutPrefs.textarea[ta.id] = { w: ow, h: oh };
                                    localStorage.setItem('lib_ta_w_' + ta.id, String(ow));
                                    localStorage.setItem('lib_ta_h_' + ta.id, String(oh));
                                }
                            } catch(e) {}
                        }, 300);
                    }).observe(ta);
                } catch(e) {}
            });
        }
    }

    