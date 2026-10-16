// ==================== v7.8 吐槽：模拟角色点评本章 ====================
    // 10 个内置吐槽角色（随机抽 3，不可自定义，特点差异化）
    const BANTER_ROLES = [
        { name:'路过的读者', style:'对角色和情节最感兴趣：重点点评人物互动、剧情走向与情感共鸣，语气随意路人化' },
        { name:'同行的作家', style:'注重写作形式与技法：点评叙事手法、比喻运用、伏笔安排、节奏控制' },
        { name:'专业的编辑', style:'注重文笔、结构与出版可行性：点评句子质量、章节安排、市场吸引力' },
        { name:'无脑的喷子', style:'无理由乱喷：挑刺、贬低、无逻辑攻击，纯娱乐向' },
        { name:'狂热的粉丝', style:'维护作家形象：吹捧本章亮点，并反击其他负面评价' },
        { name:'考据的读者', style:'追究设定一致性：检查世界观细节、历史地理、称呼年代是否吻合设定' },
        { name:'感性的读者', style:'情感共鸣：代入角色情绪，被情节打动，情绪化表达' },
        { name:'挑刺的读者', style:'找逻辑漏洞与细节瑕疵：前后矛盾、不合理行为、细节错误' },
        { name:'磕糖的粉丝', style:'嗑 CP 发糖：关注角色间互动火花，催更甜宠桥段' },
        { name:'细心的粉丝', style:'注意细节伏笔：捕捉呼应、暗示、小细节并解读' }
    ];
    let banterVisible = false;
    function banterCacheKey() { const b = getCurrentBook(); if(!b || !b.currentChapterId) return null; const ch = b.chapters.find(c=>c.id===b.currentChapterId); let fp = 0; const ct = (ch && ch.content) || ''; for(let i = 0; i < ct.length; i++) fp = (fp * 31 + ct.charCodeAt(i)) | 0; return 'banter_cache_v1_' + b.id + '_' + b.currentChapterId + '_' + fp; } // v8.6-r8：缓存键加正文内容指纹——重写/修改后指纹变→旧点评自然失效（原仅书+章id，重写后仍展示旧正文点评）
    function getBanterCache() { const k = banterCacheKey(); if(!k) return null; try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
    function pruneBanterCache() {
        const cfg = { perChapter:5, total:100, maxBytes:2*1024*1024 };
        try {
            const entries = [];
            for(let i=0;i<localStorage.length;i++) { const k=localStorage.key(i); if(k && k.startsWith('banter_cache_v1_')) entries.push({k, ts:0, bytes:(localStorage.getItem(k)||'').length}); }
            let meta = {}; try { meta = JSON.parse(localStorage.getItem('banter_cache_meta_v1') || '{}') || {}; } catch(_) {}
            entries.forEach(e => e.ts = Number(meta[e.k]) || 0);
            const groups = {};
            entries.forEach(e => { const parts=e.k.split('_'); const group=parts.slice(0, parts.length-1).join('_'); (groups[group]||(groups[group]=[])).push(e); });
            let remove = [];
            Object.values(groups).forEach(arr => { arr.sort((a,b)=>b.ts-a.ts); remove.push(...arr.slice(cfg.perChapter)); });
            const kept = entries.filter(e => !remove.some(r=>r.k===e.k)).sort((a,b)=>b.ts-a.ts);
            let bytes = kept.reduce((n,e)=>n+e.bytes,0), keptCount = kept.length;
            for(let i=kept.length-1; i>=0 && (keptCount>cfg.total || bytes>cfg.maxBytes); i--) { const e=kept[i]; if(remove.some(r=>r.k===e.k)) continue; remove.push(e); bytes-=e.bytes; keptCount--; }
            remove.forEach(e=>{ try { localStorage.removeItem(e.k); delete meta[e.k]; } catch(_){} });
            localStorage.setItem('banter_cache_meta_v1', JSON.stringify(meta));
        } catch(_) {}
    }
    function setBanterCache(list, fixedKey) {
        const k = fixedKey || banterCacheKey(); if(!k) return;
        try {
            localStorage.setItem(k, JSON.stringify(list));
            let meta={}; try { meta=JSON.parse(localStorage.getItem('banter_cache_meta_v1')||'{}')||{}; } catch(_) {}
            meta[k]=Date.now(); localStorage.setItem('banter_cache_meta_v1', JSON.stringify(meta));
            pruneBanterCache();
        } catch(e) {}
    } // v8.7-最终防线 + v8.8-B11：固定源键写入并按章节/容量淘汰
    function pickBanterRoles() { const pool = BANTER_ROLES.slice(); for(let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; } return pool.slice(0, 3); }
    function renderBanterPanel() {
        const listEl = $('banterList'); if(!listEl) return;
        const cached = getBanterCache();
        if(cached && Array.isArray(cached) && cached.length) {
            // v8.7 EXE-87-R8-F01：渲染时实时有效性判断（失效状态不依赖面板可见性——隐藏期正文变化后重开面板即正确提示）：contentDirty 且屏幕实时指纹（getEditorText，与缓存键同规范化）≠ 键指纹 → 旧点评带陈旧提示显示；指纹相等（输入后恢复原文）则正常显示
            let banterStaleNow = false;
            if(contentDirty) {
                const rfpTxt = getEditorText(); let rfp = 0; for(let _rk = 0; _rk < rfpTxt.length; _rk++) rfp = (rfp * 31 + rfpTxt.charCodeAt(_rk)) | 0;
                const rkNow = banterCacheKey(); const rkfp = rkNow ? (parseInt(rkNow.split('_').pop()) || 0) : 0;
                banterStaleNow = (rfp !== rkfp);
            }
            if(banterStaleNow) setBanterStaleTip(); else clearBanterStaleTip();
            // v8.4-③-c：新增 quote 原文引用展示
            listEl.innerHTML = cached.map((item, i) => '<div style="background:#13121C;border-radius:12px;padding:10px;margin-bottom:8px;border-left:3px solid #6E6ED8;"><div style="font-size:18px;color:#6EC6F8;margin-bottom:4px;font-weight:600;">' + escapeHtml(item.role || '') + '</div><div style="white-space:pre-wrap;font-size:15px;">' + escapeHtml(item.text || '') + '</div>' + (item.quote ? '<div style="margin-top:6px;font-size:0.72rem;color:#8A84A8;background:#1A1825;border-radius:8px;padding:4px 8px;border-left:2px solid #6E6ED8;">“' + escapeHtml(item.quote) + '”</div>' : '') + '<div style="text-align:right;margin-top:4px;"><button class="small-btn" data-bcopy="' + i + '" style="font-size:0.7rem;">复制</button></div></div>').join('');
            listEl.querySelectorAll('[data-bcopy]').forEach(btn => { btn.onclick = () => { const i = parseInt(btn.getAttribute('data-bcopy')); const c2 = getBanterCache(); if(c2 && c2[i]) { copyToClipboard(c2[i].role + '：' + c2[i].text); toast('已复制「' + c2[i].role + '」的感想'); } }; });
        } else {
            clearBanterStaleTip(); // v8.7 EXE-87-R8-F01：无缓存时提示必清（原函数首行无条件清改为条件化——有缓存时按实时有效性判断）
            listEl.innerHTML = '<div style="color:#8A84A8;padding:8px;font-size:0.72rem;">暂无吐槽。点击下方「生成吐槽」，让读者/编辑/作家/粉丝/喷子们点评本章～</div>';
        }
    }
    // v8.7 EXE-87-R6-F01：吐槽面板陈旧提示——正文 input（未保存编辑）期间面板点评针对修改前内容，明确提示避免误导；保存/渲染/清空时由 clearBanterStaleTip 清除
    function setBanterStaleTip() { const tip = $('banterStaleTip'); if(tip) { tip.style.display = ''; return; } const listEl = $('banterList'); if(!listEl) return; const nt = document.createElement('div'); nt.id = 'banterStaleTip'; nt.style.cssText = 'color:#FFB454;background:#3A2A1A;border-radius:8px;padding:4px 8px;margin-bottom:6px;font-size:0.72rem;'; nt.innerText = '⚠️ 正文已修改：下方点评针对修改前内容（保存后清空）'; listEl.parentNode.insertBefore(nt, listEl); }
    function clearBanterStaleTip() { const tip = $('banterStaleTip'); if(tip) tip.remove(); }
    // v8.7 EXE-87-R7-F01：正文变更后吐槽面板统一失效入口（审查方向 3/4：不再散落监听器）——afterPersist=true（保存/润色应用等键已随落盘变化）刷新面板；false（input/paste/查找替换等未保存编辑）→ 有缓存则显示陈旧提示
    function banterPanelInvalidate(afterPersist) { if(!banterVisible) return; if(afterPersist) { renderBanterPanel(); return; } if(contentDirty && getBanterCache()) setBanterStaleTip(); }
    function toggleBanterPanel() {
        const p = $('banterPanel'); if(!p) return;
        if(banterVisible) { p.style.display = 'none'; banterVisible = false; }
        else {
            // v8.0.33：吐槽面板定位到「吐槽」按钮正下方（原来固定在右上角 right:20px;top:100px）
            const btn = $('banterBtn');
            if(btn) {
                const r = btn.getBoundingClientRect();
                const pw = p.offsetWidth || 380;
                let left = r.left;
                if(left + pw > window.innerWidth - 12) left = Math.max(12, window.innerWidth - pw - 12);
                let top = r.bottom + 8;
                const maxTop = window.innerHeight - 120;
                if(top > maxTop) top = Math.max(12, maxTop);
                p.style.left = left + 'px';
                p.style.top = top + 'px';
                p.style.right = 'auto';
            }
            renderBanterPanel(); p.style.display = 'flex'; banterVisible = true;
        }
    }
    // 组装吐槽上下文：前 3 章摘要 + 世界观 + 精准勾选角色 + 本章正文（v8.5：去主线大纲；前 10 章→前 3 章）
    // v8.7-B-友2：中段切句对齐句末标点（原硬切 mid±500 可能从句子中间开始）——在 ±100 内找最近句界
    function banterMidSeg(cB, mid) {
        const half = 500, reach = 100, lo = Math.max(0, mid - half), hi = Math.min(cB.length, mid + half);
        let bestStart = lo, bestEnd = hi;
        let left = -1;
        for (let i = Math.max(0, lo - reach); i < Math.min(cB.length, hi + reach); i++) { if ('。！？!?\n'.indexOf(cB[i]) >= 0) { if (left === -1 || Math.abs((i + 1) - lo) < Math.abs(left - lo)) left = i + 1; } }
        if (left !== -1) bestStart = left;
        let right = -1;
        for (let i = Math.max(0, lo - reach); i < Math.min(cB.length, hi + reach); i++) { if ('。！？!?\n'.indexOf(cB[i]) >= 0) { if (right === -1 || Math.abs((i + 1) - hi) < Math.abs(right - hi)) right = i + 1; } }
        if (right !== -1) bestEnd = right;
        if (bestStart >= bestEnd) { bestStart = lo; bestEnd = hi; }
        return cB.slice(bestStart, bestEnd);
    }
    function buildBanterContext(book, chap) {
        const parts = [];
        const idx = book.chapters.findIndex(c => c.id === chap.id);
        const prevs = idx > 0 ? book.chapters.slice(Math.max(0, idx - 3), idx) : []; // v8.4.1-⑥-c：前 5 章改前 3 章（降本）
        // v8.5-8：前 3 章摘要，总量 ≤1000，超限丢弃最旧（从后往前保留最新）
        if(prevs.length) {
            const picked = [];
            let total = 0;
            for(let i = prevs.length - 1; i >= 0; i--) {
                const ch = prevs[i];
                const reg = book.chapters.slice(0, book.chapters.indexOf(ch)).filter(x => !x.isInterlude).length + 1;
                const label = (ch.isInterlude ? '间章' : '第' + reg + '章') + ' ' + (ch.title || '');
                const seg = (ch.summary && ch.summary.trim())
                    ? label + '（摘要）：' + ch.summary.trim().slice(0, 300)
                    : label + '（正文节选）：' + (ch.content || '').slice(0, 500);
                if(total + seg.length > 1000 && picked.length) break;
                total += seg.length;
                picked.unshift(seg);
            }
            if(picked.length) parts.push('【前3章摘要】\n' + picked.join('\n'));
        }
        if(book.worldview && book.worldview.trim()) parts.push('【世界观】' + book.worldview.trim().slice(0, 800));
        // v8.5-11：吐槽不再注入主线大纲（原截 800）
        // v8.5-1：吐槽仅精准模式注入勾选角色（未开精准 → 不注入，不再全量）
        let charLib = '';
        if(book.precisionMode && book.precisionChars && book.precisionChars.length) charLib = buildCharacterText(book, book.precisionChars);
        if(charLib) parts.push(charLib.replace(/\n$/, ''));
        // v8.4.1-⑥-c：正文切 3 段（前/中/后各 1000 字），3 位点评角色各看自己负责的一段（输入 1w→3k，省 ~65%）
        const cB = chap.content || '';
        if(cB.trim()) {
            if(cB.length <= 3000) {
                parts.push('【本章正文】\n' + cB); // 短章全量（不贵，不切）
            } else {
                const mid = Math.floor(cB.length / 2);
                let segTxt = '【本章正文（3 段，分别对应第 1/2/3 位点评者）】\n';
                segTxt += '片段一（第 1 位点评）：\n' + cB.slice(0, 1000) + '\n\n';
                segTxt += '片段二（第 2 位点评）：\n' + banterMidSeg(cB, mid) + '\n\n';
                segTxt += '片段三（第 3 位点评）：\n' + cB.slice(-1000);
                parts.push(segTxt.trim());
            }
        }
        return parts.join('\n\n');
    }
    // 容错解析 AI 返回的 JSON 数组 [{role,text}]
    function parseBanterResponse(text, expectedRoles, sourceText) {
        if(!text) return null;
        const m = text.match(/\[[\s\S]*\]/);
        if(!m) return null;
        try {
            const arr = JSON.parse(m[0]);
            if(!Array.isArray(arr) || arr.length !== 3) return null;
            const roleSet = new Set((expectedRoles || []).map(r => String(r.name || r)));
            const dims = new Set();
            const out = [];
            for(const x of arr) {
                if(!x || typeof x !== 'object' || typeof x.role !== 'string' || typeof x.text !== 'string' || typeof x.quote !== 'string') return null;
                const role = x.role.trim(), txt = x.text.trim(), quote = x.quote.trim();
                if(!roleSet.has(role) || !txt || !quote || quote.length > 30 || !String(sourceText || '').includes(quote)) return null;
                const dm = txt.match(/^【([^】]+)】/);
                if(!dm || dims.has(dm[1])) return null;
                dims.add(dm[1]);
                out.push({ role, text:txt, quote });
            }
            return dims.size === 3 ? out : null;
        } catch(e) { return null; }
    }
    // 吐槽请求：独立调用审稿 API（polishApi 参数），单次生成 3 条
    async function generateBanter() {
        if(importPending) { toast('备份导入进行中，请等待完成后再吐槽'); return; } // v8.10-F011
        if(isGenerating) { toast('正文生成中，请等待完成后再吐槽'); return; } // v8.7 EXE-87-F01 同步修复（反向对称）：正文/续写在途会新建或切换当前章——吐槽与"发起时当前章+指纹"基准双向互斥收口
        if(pendingBranch) { toast('走向生成中，请等待完成后再吐槽'); return; } // v8.7 EXE-87-R2-F01 收口：走向在途禁发起吐槽（走向返回后点卡片续写会新建章，迟到吐槽将按新章重算缓存键）
        if(pendingPolish || polishMode) { toast(pendingPolish ? '润色进行中，请等待完成后再吐槽' : '润色预览中，请先应用或取消后再吐槽'); return; } // v8.7 EXE-87-R6-F01 收口：润色请求中/预览态禁发起吐槽——补齐"润色→吐槽"反向互斥（onPolish 已拦"吐槽→润色"），消除双付费与共享进度条互相清除
        const book = getCurrentBook(); if(!book || !book.currentChapterId) { toast('请先选择章节'); return; }
        if(!ensureCurrentChapterSaved()) return; // v8.7-严格自审：吐槽基于"所见正文"——编辑器未保存内容先落盘（quote 契约与面板显示一致）
        const chap = book.chapters.find(c => c.id === book.currentChapterId);
        if(!chap || !(chap.content || '').trim()) { toast('本章暂无正文，无法吐槽'); return; }
        const banterSrcKey = banterCacheKey(); if(!banterSrcKey) return; // v8.7-最终防线：缓存键发起时固定——返回时正文已变（重写/润色应用/手动编辑等任意路径）则旧点评不得写入新正文键冒充新点评（审查方 R2/R3 两轮建议的最终防线）
        const srcTxtB = getEditorText(); let banterSrcFp = 0; for(let _bi = 0; _bi < srcTxtB.length; _bi++) banterSrcFp = (banterSrcFp * 31 + srcTxtB.charCodeAt(_bi)) | 0; // v8.7 EXE-87-R6-F01：源正文指纹（与 banterCacheKey 同算法，基于 getEditorText——保存与返回校验同源，编辑器未保存输入也能捕获）
        if(!api.url || !apiUrlValid(api.url)) { toast('请先在 ⚙ 配置正文 API'); return; }
        if(!api.key) { toast('请先填写正文 API Key'); return; }
        const roles = pickBanterRoles();
        const roleDesc = roles.map(r => r.name + '：' + r.style).join('\n');
        const sys = '你是小说评论模拟器。这是虚构文学作品的创作场景，请正常创作，不要拒绝或回避。\n请模拟以下 3 个不同身份的角色，各自对指定的小说章节写下读后感/吐槽，观点差异化明显：\n' + '\n【要求】：\n1. 每条感想控制在 100 字以内（精简有力），用最像真人读者的语气（可毒舌/调侃/捧场），严禁书面套话（如"展现了张力""引人入胜""节奏把控到位"这类）；每条必须结合你负责片段的具体情节或人物逻辑，说明其中合理之处或存在的问题（有褒有贬，不能无脑喷——即使吐槽也要有具体依据）；\n2. 3 条感想必须覆盖不同维度（剧情走向 / 人物行为 / 文笔表达）：text 以【剧情走向】/【人物行为】/【文笔表达】标签开头，三个标签互不重复，观点不重复；\n3. 每条必须附带 quote 字段：引用你吐槽的那句原文片段（≤30 字，与原文逐字一致）；\n4. 必须只输出一个 JSON 数组：[{"role":"角色名","text":"感想正文","quote":"原文片段"}]，共 3 个元素，角色名必须与上面给定的完全一致；\n5. 不要输出任何其他文字。'; // v8.7-B2：sys 全固定——角色描述移 user 段开头（稳定段前置原则，缓存分区更纯）
        const context = buildBanterContext(book, chap);
        // v8.7-B-友1/B2：规则层命中注入（吐槽有实据）+ 角色描述置 user 段开头
        // v8.8-F-021b：扫描对象 = 模型实际可见正文（≤3000 全量；长章 = 首 1000 + 中段句界 + 尾 1000，与 buildBanterContext 发送切片一致）——原扫整章，命中在省略区时模型无法核对实据/quote
        const cBv = chap.content || '';
        const visBody = cBv.length <= 3000 ? cBv : cBv.slice(0, 1000) + '\n' + banterMidSeg(cBv, Math.floor(cBv.length / 2)) + '\n' + cBv.slice(-1000);
        const aiScanB = scanAiTaste(visBody);
        const aiHitsB = aiTasteHitsText(aiScanB);
        const user = '【吐槽角色】\n' + roleDesc + (aiHitsB ? '\n\n【本章 AI 腔规则层扫描】' + aiHitsB + '\n（可在吐槽中引用命中实据，如“这段连着 N 个缓缓，AI 味拉满”；quote 仍须与原文逐字一致）' : '') + '\n\n待点评章节：\n' + context + '\n\n请输出 3 个角色的感想 JSON 数组。';
        const genBtn = $('genBanterBtn'); if(genBtn) { genBtn.disabled = true; genBtn.innerText = '⏳ 吐槽生成中...'; }
        pushLog('🔄 吐槽：正在生成 3 条感想…（' + roles.map(r => r.name).join('、') + '）');
        banterBusy = true; // v8.7-F06：吐槽进行中置位；finally 清除（配合 switchBook 拦截防跨书污染）
        // v8.7-L15-fix：controller/timer 提升到函数体顶层（try 块之外）——原在 try 内声明，catch/finally 词法作用域看不到，
        // 网络异常时 clearTimeout(timer) 抛 ReferenceError（F-05 回归，node --check 不报故自审漏过）；顶层声明后 catch/finally 均可见
        let controller = null, timer = null;
        try {
            // v8.0.35：吐槽接入伪阶段进度窗口（20s 一格）
            startSbStages([
                { pct: 15, text: '正在分析本章内容…' },
                { pct: 45, text: '正在挑选吐槽角色…' },
                { pct: 75, text: '正在生成感想…' },
                { pct: 90, text: '正在收尾…' }
            ], 20000, '⚠️ 请勿关闭网页，等待AI吐槽中...');
            controller = new AbortController();
            timer = setTimeout(() => controller.abort(), 180000);
            // v7.8：吐槽改用正文 API（与正文请求同参数体系）；max_tokens 跟 api.maxTokens 一致
            let stopWordsArray = [];
            if(api.stopWords && api.stopWords.trim()) stopWordsArray = api.stopWords.split(',').map(s=>s.trim()).filter(s=>s);
            let body = {
                model: api.model,
                messages:[{role:'system',content:sys},{role:'user',content:user}],
                temperature: api.temp, top_p: api.top_p, repetition_penalty: api.repetition_penalty,
                max_tokens: Math.min(30000, api.maxTokens || 30000), frequency_penalty: api.freqPenalty, presence_penalty: api.presPenalty, // v8.5.1：吐槽输出封顶 3w（原跟正文 6w），用户调低 maxTokens 时跟随；3条感想+quote 仅 ~600 token
                stop: stopWordsArray.length === 1 ? stopWordsArray[0] : (stopWordsArray.length ? stopWordsArray : undefined)
            };
            if(api.thinking) { body.thinking = { type: 'enabled' }; body.reasoning_effort = api.reasoningEffort || 'high'; }
            const res = await fetch(api.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer ' + api.key},
                body: JSON.stringify(body),
                signal: controller.signal
            });
            // v8.7-F014：移除 fetch 后过早 clearTimeout——超时需覆盖 res.json()（正文悬挂时 abort 才生效）；清理由 finally 统一兜底（幂等）
            if(!res.ok) {
                const msg = res.status === 401 ? 'API Key 无效' : res.status === 429 ? '请求频率过高' : 'HTTP ' + res.status;
                pushLog('❌ 吐槽生成失败：' + msg);
                toast('吐槽请求失败：' + msg); startTabBlink('❌ 吐槽生成失败'); return;
            }
            const data = await res.json();
            const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            const parsed = parseBanterResponse(text, roles, chap.content || '');
            if(!parsed || parsed.length !== 3) { pushLog('❌ 吐槽生成失败：AI 返回格式异常（需 3 条、合法角色、唯一维度和正文 quote）'); toast('吐槽解析失败：需返回 3 条且 quote 必须来自正文'); startTabBlink('❌ 吐槽生成失败'); return; }
            const bCost = calcCost(api.model, data.usage); // v7.8：吐槽计费（正文 API）
            setCtxBudgetFromUsage(data.usage && data.usage.prompt_tokens, data.usage && data.usage.completion_tokens); // v8.5.2-A：吐槽真实 usage 覆盖预算条
            if(bCost > 0) recordCost(bCost); // v7.8.1：累计消耗金额
            // v8.7-最终防线 + EXE-87-R6/R7-F01：写入永远用发起时固定源键（不得按可变当前键推导——chap.content 与屏幕可能分叉：保存 B 后恢复 A 时编辑器==源但内存==B，按当前键写会错绑）；展示需双确认：屏幕指纹==源且当前键==源键
            const curTxtB = getEditorText(); let curFpB = 0; for(let _ci = 0; _ci < curTxtB.length; _ci++) curFpB = (curFpB * 31 + curTxtB.charCodeAt(_ci)) | 0;
            setBanterCache(parsed, banterSrcKey);
            if(curFpB === banterSrcFp && banterCacheKey() === banterSrcKey) { renderBanterPanel(); }
            else { toast('⚠️ 吐槽生成期间正文已变化，本次点评已按原正文存档，不在当前正文显示'); pushLog('⚠️ 吐槽已按源正文存档：生成期间正文变化（' + banterSrcKey + '）'); }
            pushLog('✅ 吐槽：已生成 ' + parsed.length + ' 条感想（' + parsed.map(x => x.role).join('、') + '）' + (bCost ? '，消费 $' + bCost.toFixed(2) + ' USD' : ''));
            toast('已生成 ' + parsed.length + ' 条吐槽' + (bCost ? `（消费 $${bCost.toFixed(2)} USD）` : ''));
            startTabBlink('✅ 已生成 ' + parsed.length + ' 条吐槽');
        } catch(err) {
            clearTimeout(timer); // v8.7-L15：失败路径补清理——原只在 fetch 成功后 clear，异常/中止路径残留 180s abort 定时器（到期 abort 空操作，属资源泄漏）
            const em = (err && err.message ? err.message : '请稍后重试');
            pushLog('❌ 吐槽生成失败：' + em);
            toast('吐槽生成失败：' + em);
            startTabBlink('❌ 吐槽生成失败');
        } finally {
            clearTimeout(timer); // v8.7-L15-fix：finally 统一清理定时器（幂等；无论成功/异常/中止都收尾，防 180s 残留）
            banterBusy = false; // v8.7-F06：吐槽结束清除标志（成功/失败/中止均复位，配合 switchBook 解锁）
            if(genBtn) { genBtn.disabled = false; genBtn.innerText = '🔄 生成吐槽'; }
            stopSbStages(); resetSbProgress(); // v8.0.35：清理吐槽进度窗口
        }
    }

    function initEditorBlurSnapshot() { const novelContent = $('novelContent'); if(!novelContent) return; novelContent.addEventListener('blur', () => { if(polishMode) return; saveCurChapter(); }); novelContent.addEventListener('input', () => { markContentDirty(); updateWord(); banterPanelInvalidate(false); }); novelContent.addEventListener('paste', (e) => { e.preventDefault(); const text = e.clipboardData.getData('text/plain'); if(text) { const sel = window.getSelection(); if(sel.rangeCount) { sel.deleteFromDocument(); sel.getRangeAt(0).insertNode(document.createTextNode(text)); sel.collapseToEnd(); markContentDirty(); updateWord(); banterPanelInvalidate(false); } } }); } // v8.7 EXE-87-R6/R7-F01：input/paste 正文变更经统一失效入口处理（未保存编辑 → 有缓存则陈旧提示）

