    function openStatsModal() {
        // 默认打开当前编辑书的页签（无书则全局）
        curStatsTab = (currentBookId && books && books.find(b => b.id === currentBookId)) ? currentBookId : 'global';
        renderStatsTabs();
        renderStatsBody(); // v7.6 修复：打开即渲染卡片（无数据也渲染完整卡片布局，时间类缺失不影响字数/排行）
        const m = $('statsModal'); if(m) m.style.display = 'flex';
    }
