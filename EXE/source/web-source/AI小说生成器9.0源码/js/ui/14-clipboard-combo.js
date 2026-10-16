    // ===== v7.0：剪贴板复制（navigator.clipboard + execCommand 降级，兼容 file:// 双击打开） =====
    function copyToClipboard(text) {
        if(navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(() => fallbackCopy(text)); }
        else fallbackCopy(text);
    }
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }
    // ===== v7.0：随机组合（v7.7 改 2 角色 + 3 动作 + 2 服装，移除高亮）——随机抽取并拼接复制到剪贴板 =====
    // v7.1：本次组合——复制已勾选的动作+服装名称（不含角色），按勾选顺序 动作在前、服装在后
    function copyThisCombo() {
        // v7.1：名称清洗——去掉【】（）全角括号（如【铁砂掌】→铁砂掌），清洗后为空则丢弃
        const clean = n => String(n || '').replace(/[【】（）]/g, '').trim();
        const actNames = (precisionTempActions||[]).map(id => { const a = globalActions.find(x => String(x.id) === String(id)); return a ? clean(a.name) : ''; }).filter(n => n);
        const cstNames = (precisionTempCostumes||[]).map(id => { const c = globalCostumes.find(x => String(x.id) === String(id)); return c ? clean(c.name) : ''; }).filter(n => n);
        const combo = [...actNames, ...cstNames].join('+');
        if(!combo) { toast('请先勾选动作或服装'); return; }
        copyToClipboard(combo);
        toast('已复制本次组合：' + combo);
    }
    function randomComboFromPrecision() {
        const book = getCurrentBook(); if(!book) { toast('请先选择小说'); return; }
        const chars = (book.characters||[]).filter(c => c && c.name && String(c.name).trim());
        if(!chars.length) { toast('角色库为空，无法随机组合'); return; }
        if(globalActions.length < 3) { toast('全局动作不足 3 个，无法随机组合'); return; }
        if(!globalCostumes.length) { toast('全局服装库为空，无法随机组合'); return; }
        const pick = (arr, n) => { const c = arr.slice(), out = []; while(out.length < n && c.length) out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); return out; };
        const acts = (globalActions||[]).filter(a => a && a.name && String(a.name).trim());
        const csts = (globalCostumes||[]).filter(c => c && c.name && String(c.name).trim());
        // v7.1：随机组合名称清洗——去【】（）全角括号 + 去"综漫""设定"两词（如 哲（综漫设定）→哲）
        const clean = n => String(n || '').replace(/[【】（）]/g, '').replace(/综漫|设定/g, '').trim();
        const chars2 = pick(chars, 2), acts3 = pick(acts, 3), csts2 = pick(csts, 2);
        if(chars2.length < 2 || acts3.length < 3 || csts2.length < 2) { toast('随机组合失败：需 2 角色 + 3 动作 + 2 服装，库中内容不足'); return; }
        const combo = [...chars2.map(c => clean(c.name)), ...acts3.map(a => clean(a.name)), ...csts2.map(c => clean(c.name))].filter(n => n).join('+');
        if(!combo) { toast('组合清洗后为空，请重试'); return; }
        copyToClipboard(combo);
        toast('已随机抽取组合：' + combo);
    }
    // v7.7：有机组合——按标签关联抽取 2 角色 + 3 动作 + 2 服装（严格不降格，任一项凑不齐即失败提示）
    function organicComboFromPrecision() {
        const book = getCurrentBook(); if(!book) { toast('请先选择小说'); return; }
        const FAIL = '有机组合抽取失败：库内标签不足，请补充标签或换库';
        const clean = n => String(n || '').replace(/[【】（）]/g, '').replace(/综漫|设定/g, '').trim();
        const pick = (arr, n) => { const c = arr.slice(), out = []; while(out.length < n && c.length) out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); return out; };
        // ① 角色：先找出现次数≥2的标签，多个时随机选一个；从该标签人物中抽 2 人
        const chars = (book.characters||[]).filter(c => c && c.name && String(c.name).trim());
        if(chars.length < 2) { toast(FAIL); return; }
        const tagCnt = {};
        chars.forEach(c => (c.tags||[]).forEach(t => { if(t && String(t).trim()) tagCnt[String(t).trim()] = (tagCnt[String(t).trim()]||0) + 1; }));
        const hotTags = Object.keys(tagCnt).filter(t => tagCnt[t] >= 2);
        if(!hotTags.length) { toast(FAIL); return; }
        const selTag = hotTags[Math.floor(Math.random()*hotTags.length)];
        const candidates = chars.filter(c => (c.tags||[]).map(t => String(t).trim()).includes(selTag));
        if(candidates.length < 2) { toast(FAIL); return; }
        const chars2 = pick(candidates, 2);
        // ② 动作：无标签，随机抽 3
        const acts = (globalActions||[]).filter(a => a && a.name && String(a.name).trim());
        if(acts.length < 3) { toast(FAIL); return; }
        const acts3 = pick(acts, 3);
        // ③ 服装：与任一被抽角色的标签至少吻合一个
        const charTags = new Set(chars2.flatMap(c => (c.tags||[]).map(t => String(t).trim()).filter(Boolean)));
        const csts = (globalCostumes||[]).filter(c => c && c.name && String(c.name).trim());
        const matched = csts.filter(c => (c.tags||[]).some(t => charTags.has(String(t).trim())));
        if(matched.length < 2) { toast(FAIL); return; }
        const csts2 = pick(matched, 2);
        // 严格 2+3+2，不降格
        if(chars2.length < 2 || acts3.length < 3 || csts2.length < 2) { toast(FAIL); return; }
        const combo = [...chars2.map(c => clean(c.name)), ...acts3.map(a => clean(a.name)), ...csts2.map(c => clean(c.name))].filter(n => n).join('+');
        if(!combo) { toast('组合清洗后为空，请重试'); return; }
        copyToClipboard(combo);
        toast('已有机抽取组合：' + combo);
    }
    function sendSystemNotification(title, body) {
        // ⚠️ 系统通知（Notification API）自 v5.8 起废弃，不再被调用。
        // 需安全上下文(https/localhost)且要权限，双击 HTML(file://) 无法使用，
        // 已由「页签闪烁提醒」(startTabBlink) 替代。代码保留以备将来恢复。
        if(!api.notify) return;
        if(!('Notification' in window)) return;
        if(Notification.permission === 'granted') {
            const n = new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📖</text></svg>', silent: true });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 8000);
        } else if(Notification.permission === 'denied') {
            // 权限被拒：关闭通知开关并反馈，避免"开了却从不弹"的假象
            api.notify = false; saveAll();
            const notifyBtn = $('notifyBtn'); if(notifyBtn) notifyBtn.classList.remove('guide-highlight');
            toast("系统通知权限已被浏览器拒绝，通知已自动关闭");
        } else {
            Notification.requestPermission().then(p => { if(p==='granted') sendSystemNotification(title,body); else if(p==='denied') { api.notify = false; saveAll(); const nb = $('notifyBtn'); if(nb) nb.classList.remove('guide-highlight'); toast("系统通知权限被拒绝，通知已自动关闭"); } });
        }
    }

