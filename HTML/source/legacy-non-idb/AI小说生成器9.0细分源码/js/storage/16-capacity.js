    const MAX_STORAGE_MB = 5;
    function updateStorageIndicator() {
        try {
            let totalSize = 0;
            const keys = ['books_v2', 'api_config_v2', 'api_config_v3', 'global_characters_v2', 'global_actions_v2', 'global_costumes_v2', 'scratchpad_v1', 'scratchpad_pages_v1', 'custom_tags_v1', 'sb_draft_v1', 'app_logs_v1', 'cost_stats_v1', 'daily_input_stats_v1', 'currentBookId_v2']; // v8.6-fix13：容量统计补全（原遗漏导致显示恒偏低、5MB 告警失真）
            for (let key of keys) {
                const val = localStorage.getItem(key);
                if (val) totalSize += val.length * 2;
            }
            // v8.7-L9：补动态键占用——关系图右键高亮（graph_hl_<bookId>，按书累积可能最大未计量项）与吐槽缓存（banter_cache_v1_*）；
            // 原只统计静态键，容量显示恒偏低、5MB 告警失真（L20 警告区依赖本口径）
            for(let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if(k && (k.startsWith('graph_hl_') || k.startsWith('banter_cache_v1_') || k === 'banter_cache_meta_v1')) {
                    const val = localStorage.getItem(k);
                    if(val) totalSize += val.length * 2;
                }
            }
            const usedMB = (totalSize / (1024 * 1024)).toFixed(2);
            const indicator = $('storageIndicator');
            if (indicator) {
                indicator.innerHTML = `💾 ${usedMB}MB / ${MAX_STORAGE_MB}MB`;
                if (totalSize / (1024 * 1024) > MAX_STORAGE_MB * 0.8) {
                    indicator.classList.add('storage-warning');
                } else {
                    indicator.classList.remove('storage-warning');
                }
            }
            // v8.7-L20：容量 ≥90% 右栏日志页签内常驻警告区（占满日志列表与统计面板间空档，<90% 自动隐藏零侵占）
            const warnBar = $('storageWarnBar');
            if (warnBar) {
                const pct = Math.round(totalSize / (1024 * 1024) / MAX_STORAGE_MB * 100);
                if (pct >= 90) {
                    const pctEl = $('swPct'); if(pctEl) pctEl.innerText = String(pct); // v8.7-L20：三行文案只展示百分比
                    if(warnBar.style.display !== 'flex') warnBar.style.display = 'flex';
                } else if(warnBar.style.display !== 'none') {
                    warnBar.style.display = 'none';
                }
            }
        } catch(e) { console.warn("容量检测失败", e); }
    }

