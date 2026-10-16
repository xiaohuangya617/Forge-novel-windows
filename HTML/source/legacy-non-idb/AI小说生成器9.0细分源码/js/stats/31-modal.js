    function renderStatsBody() {
        const body = $('statsBody'); if(!body) return;
        const isGlobal = curStatsTab === 'global';
        const resetTs = isGlobal ? (parseInt(localStorage.getItem('stats_global_reset_v1') || '0') || 0) : 0;
        const bookArr = isGlobal ? (books || []) : (books || []).filter(b => b.id === curStatsTab);
        // v7.6 性能：摘要缓存——数据未变化时打开/切页签直接复用结果，不重算
        const key = statsKey(bookArr) + ':r' + resetTs + ':c' + (localStorage.getItem('cost_stats_v1') || '');
        let s;
        if(statsCacheKey === key && statsCacheResult) s = statsCacheResult;
        else { s = computeStats(bookArr, resetTs, isGlobal); statsCacheKey = key; statsCacheResult = s; }
        // 清空按钮：仅全局
        const clearBtn = $('statsClearBtn');
        if(clearBtn) { clearBtn.style.display = isGlobal ? '' : 'none'; clearBtn.onclick = () => { if(confirm('重置全局统计基线？每日平均字数等时间类数据将从此刻重新积累（累计消耗金额不重置）。')) { try { localStorage.setItem('stats_global_reset_v1', String(Date.now())); } catch(e) {} toast('全局统计基线已重置'); renderStatsBody(); } }; }
        // 数据卡片（v7.6 布局：连续更新天数第3、每日输入第4、每章输入第5）
        const card = (label, value, sub) => '<div class="stats-card"><div class="sc-label">' + label + '</div><div class="sc-value">' + value + '</div>' + (sub ? '<div class="sc-sub">' + sub + '</div>' : '') + '</div>';
        const fmt = n => n.toLocaleString('zh-CN');
        body.innerHTML =
            '<div class="stats-grid">' +
            card('每日平均字数', fmt(s.dailyAvg), '共 ' + s.dayCount + ' 个写作日') +
            card('每章平均字数', fmt(s.perChapAvg), '共 ' + s.chapterCount + ' 章') +
            card('累计消耗金额', '$' + (s.costTotal||0).toFixed(2), isGlobal ? '全部书籍累计' : '本书累计') +
            card('每日用户输入消息字数', fmt(s.dailyMsgAvg), '共 ' + s.msgDayCount + ' 个输入日') +
            card('每章用户输入消息字数', fmt(s.perChapMsgAvg), '每日输入字数 ÷ 每日保存章数') +
            card('最勤码字时点', s.slotLabel, '每 2 小时一时段') +
            '</div>' +
            '<div class="stats-ranks">' +
            rankCard('👥 角色引用 TOP10', s.charTop) +
            rankCard('🥋 动作引用 TOP10', s.actionTop) +
            rankCard('👗 服装引用 TOP10', s.costumeTop) +
            '</div>';
        const hint = $('statsHint'); if(hint) { let ht = '统计范围：' + s.label; if(resetTs) ht += '（已按重置基线：仅统计重置后的时间类数据）'; if(s.chapterCount > 0 && s.dayCount === 0) ht += '（旧章节无保存时间戳：每日平均/连续更新/码字时点暂不可用）'; if(s.chapterCount > 0 && !s.charTop.length && !s.actionTop.length && !s.costumeTop.length) ht += '（三库引用暂无数据：精准模式生成文章后自动累计）'; hint.textContent = ht; } // v7.6：旧书部分数据 + 三库引用说明
    }
    function rankCard(title, list) {
        // v7.6：TOP10 序号占位提前占好——始终渲染 10 行，不足的用「—」占位（序号由 ol 自动编号）
        const items = list || [];
        let inner = '<ol>';
        for(let i = 0; i < 10; i++) {
            if(i < items.length) {
                const row = items[i];
                inner += '<li>' + escapeHtml(String(row[0])) + '<b>' + row[1] + '</b></li>';
            } else {
                inner += '<li class="rank-empty">—</li>';
            }
        }
        inner += '</ol>';
        return '<div class="stats-rank"><div class="sr-title">' + title + '</div>' + inner + '</div>';
    }
