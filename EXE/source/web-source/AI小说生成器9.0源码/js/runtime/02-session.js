    // v7.9m：本次运行统计（内存变量，重启清零，供日志面板小面板展示）
    let sessionStartTime = Date.now();
    let sessionCost = 0;
    let sessionInputChars = 0;
    // v8.1：每日输入字数独立存储（清空聊天不影响统计）——key: daily_input_stats_v1 = {YYYY-MM-DD: n}
    function addDailyInputStats(n) {
        if(!n) return;
        try {
            const key = fmtDayDash(); // v8.7-N2 修正：每日统计用本地日期键（YYYY-MM-DD）——勿用秒级 fmtStamp（天粒度统计会碎成秒键）
            const map = JSON.parse(localStorage.getItem('daily_input_stats_v1') || '{}');
            map[key] = (map[key] || 0) + n;
            localStorage.setItem('daily_input_stats_v1', JSON.stringify(map));
        } catch(e) {}
    }
    let sessionGenChars = 0;
    // v7.9m：日志小面板实时统计
    function sysSet(id, txt) { const el = $(id); if(el) el.textContent = txt; }
    function renderSysPanel() {
        const bj = new Date(Date.now() + 8 * 3600 * 1000);
        const p2 = n => String(n).padStart(2, '0');
        sysSet('sysClock', (bj.getUTCMonth() + 1) + '月' + bj.getUTCDate() + '日' + bj.getUTCHours() + '时' + p2(bj.getUTCMinutes()) + '分');
        const tier = $('sysTier');
        if(tier) { const peak = isPeakHour(); tier.textContent = peak ? '高峰时段' : '空闲时段'; tier.style.color = peak ? '#FFA070' : '#6EC6F8'; }
        sysSet('sysCost', '$' + sessionCost.toFixed(2));
        const ms = Date.now() - sessionStartTime;
        sysSet('sysUptime', Math.floor(ms / 3600000) + '小时' + Math.floor(ms % 3600000 / 60000) + '分钟');
        sysSet('sysInput', String(sessionInputChars));
        sysSet('sysGen', String(sessionGenChars));
    }
    function startSysPanel() {
        if($('sysClock')) { renderSysPanel(); setInterval(renderSysPanel, 1000); }
    }
    // v7.8.1：累计消耗金额——每次计费行为（生文/双版/润色/吐槽/检查/摘要经历/扮演）记录到 localStorage（本书独立，全局=所有书之和；不随重置基线清零）
    function recordCost(cost, bookId) {
        if(!cost || cost <= 0) return;
        sessionCost += cost; // v7.9m：本次消费金额累计
        const b = bookId ? null : getCurrentBook();
        const id = bookId || (b && b.id);
        if(!id) return;
        try {
            const stats = JSON.parse(localStorage.getItem('cost_stats_v1') || '{}');
            stats[id] = (stats[id] || 0) + cost;
            localStorage.setItem('cost_stats_v1', JSON.stringify(stats));
        } catch(e) {}
    }
    