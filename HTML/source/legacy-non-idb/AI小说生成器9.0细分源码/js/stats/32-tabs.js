    function renderStatsTabs() {
        const tabs = $('statsTabs'); if(!tabs) return;
        let html = '<div class="stats-tab' + (curStatsTab === 'global' ? ' active' : '') + '" data-stats="global">🌐 全局</div>';
        (books || []).forEach(b => { html += '<div class="stats-tab' + (curStatsTab === b.id ? ' active' : '') + '" data-stats="' + escapeHtml(b.id) + '">📖 ' + escapeHtml(b.name) + '</div>'; }); // v8.7-F01b：data-stats 属性插值转义（复审 F-01：书 ID 可被备份控制）
        tabs.innerHTML = html;
        tabs.querySelectorAll('.stats-tab').forEach(t => t.addEventListener('click', () => { curStatsTab = t.dataset.stats; renderStatsTabs(); renderStatsBody(); })); // v7.6 修复：切页签即刷新数据
    }
