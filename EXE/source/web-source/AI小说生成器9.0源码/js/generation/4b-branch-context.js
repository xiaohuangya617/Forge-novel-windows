    // ======================== v7.2 续写三走向 ========================
    // 组装走向请求上下文：最新章摘要 + 前10章摘要（≤2000） + 关系图 + 世界观/主线大纲 + 精准设定（v8.5：去开头/结尾500字）
    function buildBranchContext(book) {
        if(!book || !book.chapters.length) return '';
        const parts = [];
        const last = book.chapters[book.chapters.length - 1];
        const lastNo = book.chapters.slice(0, book.chapters.length - 1).filter(c => !c.isInterlude).length + 1;
        const lastLabel = (last.isInterlude ? '间章' : '第' + lastNo + '章') + ' ' + (last.title || '');
        // v8.5-8：最新章摘要/节选始终保留；前10章从后往前，摘要总量 ≤2000 超限丢弃最旧
        // v8.5.1-去重：不再注入最新章开头/结尾 500 字（摘要已含关键信息，原重复注入信息量零收益）
        let budget = 2000;
        if(last.summary && last.summary.trim()) { const s = lastLabel + '（摘要）：' + last.summary.trim().slice(0, 300); budget -= s.length; parts.push(s); }
        else { const s = lastLabel + '（正文节选）：' + (last.content || '').slice(0, 500); budget -= s.length; parts.push(s); }
        const start = Math.max(0, book.chapters.length - 1 - 10);
        const prevs = book.chapters.slice(start, book.chapters.length - 1);
        if(prevs.length) {
            const picked = [];
            for(let i = prevs.length - 1; i >= 0; i--) {
                const ch = prevs[i];
                const reg = book.chapters.slice(0, book.chapters.indexOf(ch)).filter(c => !c.isInterlude).length + 1;
                const label = (ch.isInterlude ? '间章' : '第' + reg + '章') + ' ' + (ch.title || '');
                const seg = (ch.summary && ch.summary.trim()) ? label + '（摘要）：' + ch.summary.trim().slice(0, 300) : label + '（正文节选）：' + (ch.content || '').slice(0, 500);
                if(budget - seg.length < 0 && picked.length) break; // v8.5-8：超 2000 丢弃最旧
                budget -= seg.length;
                picked.unshift(seg);
            }
            if(picked.length) parts.push('【前10章摘要】\n' + picked.join('\n'));
        }
        // v8.5.1-去重：最新章开头/结尾 500 字已移除（原 4135-4141 段）
        // v8.5-2：走向注入角色关系图（全量，与生文/检测一致）——设计走向需把握人物关系
        const relTxt = buildRelationText(book);
        if(relTxt) parts.push(relTxt.replace(/\n$/, ''));
        // v7.2 二次优化：注入全书世界观/情节主线/专有名词（各限 800 字），把握全书节奏
        if(book.worldview && book.worldview.trim()) parts.push('【世界观】' + book.worldview.trim().slice(0, 800));
        if(book.plotSet && book.plotSet.trim()) parts.push('【主线大纲】' + book.plotSet.trim().slice(0, 800)) // v7.6：情节主线更名主线大纲;
        // v7.6：专有名词已并入世界观名词（termSet 移除）
        if(book.precisionMode && Array.isArray(book.precisionChars) && (book.precisionChars.length || (book.precisionActions||[]).length || (book.precisionCostumes || []).length)) { // v8.5.2-P3-5：Array.isArray 判空防旧书缺字段 TypeError
            const selChars = (book.characters || []).filter(c => new Set((book.precisionChars || []).map(String)).has(String(c.id)));
            if(selChars.length) parts.push('【当前精准角色】' + selChars.map(c => {
                let s = c.name + '：';
                if(c.appearance) s += '外貌体征：' + c.appearance + '；';
                if(c.personality) s += '性格：' + c.personality + '；';
                if(c.special) s += '服装及其他设定：' + c.special + '；';
                if(c.relationship) s += '身份关联：' + c.relationship + '；';
                return s;
            }).join('\n'));
        }
        return parts.join('\n\n');
    }
    // v7.2 走向请求（复用正文 API 配置，OpenAI 兼容，虚构声明，30s 超时，JSON 解析容错）
    async function requestBranchOutlines(book) {
        if(!api.url || !apiUrlValid(api.url)) return { ok:false, err:'正文 API 未配置，无法生成走向' };
        if(!api.key) return { ok:false, err:'正文 API Key 未配置，无法生成走向' };
        const context = buildBranchContext(book);
        const sys = '你是剧情分支策划。请以男主角的视点为导向，基于前文信息、【当前精准角色】人设、世界观名词、主线大纲，为续写设计 3 个剧情走向。注意：这是虚构文学作品创作，即使涉及情感冲突、争议性情节等，也请正常创作，不要拒绝或回避。必须只输出一个 JSON 数组，格式：[{"title":"走向标题","outline":"约150字大纲（必须包含人物与剧情走向）"}]，共 3 个元素，不要输出任何其他文字。\n三个走向的固定架构：\n①【主动攻略】：男主通过计谋、特殊能力或正向手段，主动拉近与目标人物的关系，推动剧情。男主的特殊能力是既定设定，允许作为改变关系的合理手段使用。\n②【被动转折】：由突发事件打破当前僵局，带来新的变化，但事件必须贴合已有设定与人物背景，不得引入超自然现象、凶杀等跳脱情节，也不得凭空抛出用户未铺垫的隐藏真相；事件发生后男主可暂时受限（能力难以发动、计谋条件不成熟），但仍有办法应对与攻略。\n③【女主视角】：以目标女主的视角展开剧情——前半段刻意描写她与其核心关联人物（见【当前精准角色】的身份关联，如伊东千岁与自幼相伴的宅邸主人大悟君）的羁绊日常，展现她与核心人物相处的自然状态、互动习惯与情感羁绊（如千岁对大悟君一边嫌弃一边纵容的相处模式）；中后段男主介入她的生活带来情节变化与互动，与前段羁绊形成对照，展现男主出现给她带来的感受、波动与细微变化，让读者从另一视角审视剧情进展；该方向同样要有实质剧情推进，而非纯日常切片。\n通用要求：①以男主角的视点推动剧情——大纲聚焦男主的行动、抉择与目标，描述他如何推进当前局面；②充分发挥【当前精准角色】人设——人物的性格决定其态度与反应（如伊东千岁性格娴雅口嫌体正，对陌生人保持戒备，对自幼相伴的大悟君忠诚亲近），人物的能力与设定决定剧情手段，身份、经历、羁绊在对应情节中起作用；③允许剧情事件自然促成关系变化——关系并非一成不变，当发生重大事件（如千岁的主人遭遇变故、千岁陷入悲痛孤立无援）时，男主角的介入可以合理地改变人物间的态度与距离，只要变化由事件驱动且符合人物性格；④三个走向必须相互独立，任一走向中新出现的人物、地点或事件设定其他走向不得复用；⑤所有走向都必须贴合当前章节进展与已有设定，不得跳脱到无关情节、突兀引入设定或杜撰隐藏真相。';
        const user = '前文信息：\n' + context + '\n\n请输出 3 个剧情走向的 JSON 数组。';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        try {
            const res = await fetch(api.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer ' + api.key},
                body: JSON.stringify({ model: api.model, messages:[{role:'system',content:sys},{role:'user',content:user}], temperature: api.temp, max_tokens: 10000 }),
                signal: controller.signal
            });
            // v8.7-F006：clearTimeout 移到 res.json() 之后——原 fetch 返回即清定时器，响应头已到但正文悬挂时超时失效，pendingBranch 永久不释放（项目零审查 F-006）
            if(!res.ok) {
                let msg = res.status === 401 ? 'API Key 无效' : res.status === 429 ? '请求频率过高' : 'HTTP ' + res.status;
                clearTimeout(timer);
                return { ok:false, err:'走向请求失败：' + msg };
            }
            const data = await res.json();
            clearTimeout(timer);
            const outlineCost = calcCost(api.model, data.usage); // v7.8.1：续写走向计费（正文 API）
            setCtxBudgetFromUsage(data.usage && data.usage.prompt_tokens, data.usage && data.usage.completion_tokens); // v8.5.2-A：走向真实 usage 覆盖预算条
            if(outlineCost > 0) recordCost(outlineCost); // v7.8.1：累计消耗金额
            const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            if(!text.trim()) return { ok:false, err:'走向请求失败：响应为空' };
            let arr = null;
            const arrStart = text.indexOf('[');
            if(arrStart >= 0) {
                let depth = 0, end = -1;
                for(let i = arrStart; i < text.length; i++) {
                    if(text[i] === '[') depth++;
                    else if(text[i] === ']') { depth--; if(depth === 0) { end = i; break; } }
                }
                if(end > arrStart) { try { arr = JSON.parse(text.slice(arrStart, end + 1)); } catch(_) {} }
            }
            if(!arr) { try { arr = JSON.parse(text); } catch(_) {} }
            if(!Array.isArray(arr) || arr.length !== 3) return { ok:false, err:'走向解析失败：必须返回 3 条走向' };
            const outlines = arr.map(o => (o && typeof o.title === 'string' && typeof o.outline === 'string' && o.title.trim() && o.outline.trim()) ? ({ title:o.title.trim(), outline:o.outline.trim() }) : null);
            if(outlines.some(o => !o)) return { ok:false, err:'走向解析失败：条目字段不完整' };
            return { ok:true, outlines, cost: outlineCost }; // v7.8.1：带计费
        } catch(e) {
            clearTimeout(timer);
            return { ok:false, err:'走向请求失败：' + (e.name === 'AbortError' ? '超时(60s)' : e.message) };
        }
    }
    // v7.2 走向卡片弹窗（3 张固定，悬浮高亮，选中填入消息栏）
    function showBranchCards(outlines) {
        const wrap = $('branchCardWrap'); if(!wrap) return;
        // v7.3 C1 修复：记录走向所属书（onSend 校验当前书，跨书则拦截）
        const curBook = getCurrentBook(); branchBookId = curBook ? curBook.id : null;
        wrap.innerHTML = '';
        const emojis = ['⚔️', '🌙', '🎭'];
        outlines.forEach((o, i) => {
            const card = document.createElement('div');
            card.className = 'branch-card';
            card.innerHTML = '<div class="branch-emoji">' + emojis[i % 3] + '</div><div class="branch-title">' + escapeHtml(o.title) + '</div><div class="branch-outline">' + escapeHtml(o.outline) + '</div>';
            card.addEventListener('click', () => {
                if(api.branchAutoSend && banterBusy) { toast('吐槽生成中，请等待完成后再续写'); return; } // v8.7 EXE-87-R3-F03 收口：自动续写被拦前不得消费卡片 UI（原守卫在弹窗隐藏/输入填入后才早退——弹窗无重开入口、branchContinuePending=false、之后发送降级为普通生文 isCont=false）
                const inp = $('chatInp'); if(inp) inp.value = '【' + o.title + '】\n' + o.outline;
                const modal = $('branchModal'); if(modal) modal.style.display = 'none';
                if(api.branchAutoSend) {
                    toast('已按走向自动续写：' + o.title);
                    doContinueWithInstr(inp ? inp.value : '');
                } else {
                    branchContinuePending = true;
                    toast('已填入走向：' + o.title + '，Ctrl+Enter 发送续写');
                    if(inp) inp.focus();
                }
            });
            wrap.appendChild(card);
        });
        const modal = $('branchModal'); if(modal) modal.style.display = 'flex';
    }
