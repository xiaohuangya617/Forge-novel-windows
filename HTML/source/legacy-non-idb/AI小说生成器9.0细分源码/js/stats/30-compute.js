// ======================== v7.6 写作统计看板 ========================
    let curStatsTab = 'global';
    let statsCacheKey = '', statsCacheResult = null;
    function statsKey(bookArr) {
        let total = 0;
        bookArr.forEach(b => { (b.chapters || []).forEach(ch => { total += (ch.content || '').length; }); });
        return bookArr.map(b => b.id + ':' + (b.chapters||[]).length + ':' + (b.characters||[]).length + ':' + (b.chatHistory||[]).length).join('|') + ':g' + globalActions.length + ':' + globalCostumes.length + ':len' + total;
    }
    function computeStats(bookArr, resetTs, isGlobal) {
        const chapters = [], userMsgs = [];
        let totalChars = 0;
        bookArr.forEach(b => {
            (b.chapters || []).forEach(ch => { const content = ch.content || ''; chapters.push({ content, savedAt: ch.savedAt || 0 }); totalChars += content.length; });
            (b.chatHistory || []).forEach(m => { if(m && m.role === 'user') userMsgs.push({ ts: m.ts || 0, content: (m.content || '') }); });
        });
        const chapterCount = chapters.length || 1;
        // 时间类：只统计 resetTs 之后（全局重置基线用）
        const effCh = resetTs ? chapters.filter(c => c.savedAt >= resetTs) : chapters.filter(c => c.savedAt > 0);
        const effMsgs = resetTs ? userMsgs.filter(m => m.ts >= resetTs) : userMsgs.filter(m => m.ts > 0);
        // 1 每日平均字数（按有章节的天数平均）
        const dayChars = {};
        effCh.forEach(c => { const d = new Date(c.savedAt).toDateString(); dayChars[d] = (dayChars[d] || 0) + c.content.length; });
        const dayKeys = Object.keys(dayChars);
        const dailyAvg = dayKeys.length ? Math.round(dayKeys.reduce((s,d)=>s+dayChars[d],0) / dayKeys.length) : 0;
        // 2 每章平均字数
        const perChapAvg = Math.round(totalChars / chapterCount);
        // 3 每日用户输入消息字数（v8.1：独立存储 daily_input_stats_v1 优先 + chatHistory 回退兜底）
        const dayMsg = {};
        let msgTotal = 0;
        let dailyStatsUsed = false;
        try {
            const dsMap = JSON.parse(localStorage.getItem('daily_input_stats_v1') || '{}');
            const dsKeys = Object.keys(dsMap);
            if(dsKeys.length) {
                dsKeys.forEach(k => { if(!resetTs || new Date(k + 'T00:00:00').getTime() >= resetTs) { dayMsg[new Date(k + 'T00:00:00').toDateString()] = (dayMsg[new Date(k + 'T00:00:00').toDateString()] || 0) + (dsMap[k] || 0); msgTotal += (dsMap[k] || 0); } });
                dailyStatsUsed = true;
            }
        } catch(e) {}
        if(!dailyStatsUsed) { effMsgs.forEach(m => { const d = new Date(m.ts).toDateString(); dayMsg[d] = (dayMsg[d] || 0) + m.content.length; msgTotal += m.content.length; }); }
        const msgDayKeys = Object.keys(dayMsg);
        const dailyMsgAvg = msgDayKeys.length ? Math.round(msgDayKeys.reduce((s,d)=>s+dayMsg[d],0) / msgDayKeys.length) : 0;
        // 4 每章用户输入消息字数
        // v7.8.1：每章用户输入消息字数 = 每日用户输入字数 ÷ 每日保存章数（按写作日口径）
        const dailyChapterAvg = dayKeys.length ? (effCh.length / dayKeys.length) : 0;
        const perChapMsgAvg = (dailyMsgAvg && dailyChapterAvg) ? Math.round(dailyMsgAvg / dailyChapterAvg) : 0;
        // 5 连续更新天数（历史最长连续）
        let longestStreak = 0;
        if(effCh.length) {
            const dates = [...new Set(effCh.map(c => new Date(c.savedAt).toDateString()))].sort((a,b) => new Date(a) - new Date(b)); // v7.6 修复：toDateString 字符串字典序会乱序，按时间戳排序
            let streak = 1;
            for(let i = 1; i < dates.length; i++) {
                const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
                if(diff === 1) { streak++; if(streak > longestStreak) longestStreak = streak; }
                else streak = 1;
            }
            if(longestStreak === 0) longestStreak = 1;
        }
        // 6 最勤码字时点（每 2h 时段，保存章节次数最多）
        const hourSlots = {};
        effCh.forEach(c => { const h = new Date(c.savedAt).getHours(); const slot = Math.floor(h / 2); hourSlots[slot] = (hourSlots[slot] || 0) + 1; });
        let bestSlot = -1, bestCount = 0;
        Object.keys(hourSlots).forEach(sl => { if(hourSlots[sl] > bestCount) { bestCount = hourSlots[sl]; bestSlot = parseInt(sl); } });
        const slotLabel = bestSlot === -1 ? '暂无' : String(bestSlot*2).padStart(2,'0') + ':00~' + String(bestSlot*2+2).padStart(2,'0') + ':00';
        // v7.8.1：累计消耗金额（本书=该书金额；全局=所有书金额之和；不随重置基线清零）
        let costTotal = 0;
        try {
            const cStats = JSON.parse(localStorage.getItem('cost_stats_v1') || '{}');
            if(isGlobal) { Object.keys(cStats).forEach(k => { costTotal += (cStats[k] || 0); }); }
            else if(bookArr[0]) { costTotal = cStats[bookArr[0].id] || 0; }
        } catch(e) {}
        // v7.6 排行：来源于精准模式累计次数（book.precisionStats），非正文扫描——旧书无历史数据为空排行
        const charCnt = {}, actCnt = {}, cosCnt = {};
        bookArr.forEach(b => {
            const ps = b.precisionStats || {};
            (b.characters || []).forEach(c => { if(c && c.name) { const n = (ps.chars || {})[String(c.id)] || 0; if(n > 0) charCnt[c.name] = (charCnt[c.name] || 0) + n; } });
            globalActions.forEach(a => { if(a && a.name) { const n = (ps.actions || {})[String(a.id)] || 0; if(n > 0) actCnt[a.name] = (actCnt[a.name] || 0) + n; } });
            globalCostumes.forEach(c => { if(c && c.name) { const n = (ps.costumes || {})[String(c.id)] || 0; if(n > 0) cosCnt[c.name] = (cosCnt[c.name] || 0) + n; } });
        });
        const toTop = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, 10);
        return { label: isGlobal ? '全部书籍' : (bookArr[0] ? bookArr[0].name : ''), dailyAvg, perChapAvg, dailyMsgAvg, perChapMsgAvg, longestStreak, slotLabel, charTop: toTop(charCnt), actionTop: toTop(actCnt), costumeTop: toTop(cosCnt), chapterCount, dayCount: dayKeys.length, msgDayCount: msgDayKeys.length, costTotal };
    }
