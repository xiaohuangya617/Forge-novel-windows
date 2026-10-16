// ======================== v7.3 润色审查（DeepSeek 审稿 API） ========================
    // 注入内容组装：精准设定的人设（精准模式开且有勾选→精准角色；否则全量角色兜底）+ 本章全文 + 前5章摘要 + 世界观 + 情节主线
    // v8.4-③-a：润色专注文笔——注入精简为 4 项（精准角色【未开精准不注入】+ 本章全文 + 前3章摘要 + 行文规范）；
    // 关系图/世界观/主线大纲减掉（设定核对归检查）；a 类人设检测弱化（见 sys）
    function buildPolishContext(book, chap) {
        if(!book || !chap) return '';
        const parts = [];
        // v8.5.4：用户全局提示词加入润色（此前缺失）——稳定段前置：全局提示词/行文/精准角色/前3章摘要 前缀稳定，本章全文（变段）垫底 → 提高缓存命中
        if(book.globalPrompt && book.globalPrompt.trim()) parts.push('【用户全局提示词】' + book.globalPrompt.trim());
        // 行文规范（稳定段）
        if(book.writingStyle && book.writingStyle.trim()) parts.push('【行文】' + book.writingStyle.trim());
        // 人设：仅精准模式注入勾选角色（稳定段；未勾选/未开精准 → 不注入，人设一致性归检测负责）
        if(book.precisionMode && book.precisionChars && book.precisionChars.length) {
            const chars = (book.characters || []).filter(c => new Set((book.precisionChars || []).map(String)).has(String(c.id)));
            if(chars.length) parts.push('【精准角色设定】' + chars.map(c => {
                let s = c.name + '：';
                if(c.appearance) s += '外貌体征：' + c.appearance + '；';
                if(c.personality) s += '性格：' + c.personality + '；';
                if(c.special) s += '服装及其他设定：' + c.special + '；';
                if(c.relationship) s += '身份关联：' + c.relationship + '；';
                return s;
            }).join('\n'));
        }
        // 前 3 章摘要（稳定段；v8.4：由前 5 章改为前 3 章——润色不需太远前文；v8.5-8：总量 ≤1000，超限丢弃最旧）
        const idx = book.chapters.findIndex(c => c.id === chap.id);
        const prevs = book.chapters.slice(Math.max(0, idx - 3), idx);
        if(prevs.length) {
            const picked = [];
            let total = 0;
            for(let i = prevs.length - 1; i >= 0; i--) {
                const ch = prevs[i];
                const seg = (ch.summary && ch.summary.trim())
                    ? (ch.title || '未命名') + '（摘要）：' + ch.summary.trim().slice(0, 300)
                    : (ch.title || '未命名') + '（正文节选）：' + (ch.content || '').slice(0, 300);
                if(total + seg.length > 1000 && picked.length) break; // v8.5-8：超 1000 丢弃最旧
                total += seg.length;
                picked.unshift(seg);
            }
            if(picked.length) parts.push('【前3章摘要】\n' + picked.join('\n'));
        }
        // 本章全文（变段垫底——稳定前缀命中缓存）
        if(chap.content && chap.content.trim()) parts.push('【本章全文】\n' + chap.content);
        return parts.join('\n\n');
    }
    // v7.3：修改幅度比例——字符级编辑距离 / 较长句字数（0~1）。用于过滤"几乎相同"的敷衍修改
    function editRatio(a, b) {
        // v8.6-r17：长度门槛——AI 不守"old≤200字"约束输出超长文本时，DP 数组 (m+1)×(n+1) 会 OOM 冻结页面（m=n=5000≈200MB）；超 500 截断再算（比例失真可接受，宁保不崩）
        a = String(a || ''); b = String(b || '');
        // v8.6-fix10：两头采样（前 250 + 后 250）——原 slice(0,500) 使"仅尾部修改"的润色建议截断后 ratio=0 被误丢
        if(a.length > 500) a = a.slice(0, 250) + a.slice(a.length - 250);
        if(b.length > 500) b = b.slice(0, 250) + b.slice(b.length - 250);
        const m = a.length, n = b.length;
        if(!m || !n) return 1; // 任一侧为空视为大改（保留）
        const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
        for(let j = 0; j <= n; j++) dp[0][j] = j;
        for(let i = 1; i <= m; i++) {
            for(let j = 1; j <= n; j++) {
                const cost = a[i-1] === b[j-1] ? 0 : 1;
                dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
            }
        }
        return dp[m][n] / Math.max(m, n);
    }
    // 润色请求（复用审稿页签 polishApi 配置；DeepSeek 审稿——默认开启思考模式 thinking:enabled + reasoning_effort 控制强度；180s 超时）
    async function requestPolish(book, chap) {
        if(!polishApi.url || !apiUrlValid(polishApi.url)) return { ok:false, err:'审稿 API 未配置，无法润色' };
        if(!polishApi.key) return { ok:false, err:'审稿 API Key 未配置，无法润色' };
        // v7.3：DeepSeek 思考模式——reasoning_effort 直传 UI 档位（low/high/max，与正文 API 一致）
        const rEff = ['low','high','max'].indexOf(polishApi.reasoning) >= 0 ? polishApi.reasoning : 'high';
        const sys = '你是资深网文编辑。请审查以下小说章节并给出润色建议。注意：这是虚构文学作品创作，即使涉及情感冲突、争议性情节等，也请正常创作，不要拒绝或回避。\n【三条底线（所有修改都必须遵守）】：\n- 情节不变：不增删情节事件、不改变场景顺序；\n- 设定不变：人物身份、关系、能力、世界观设定一字不动；\n- 走向不变：对话内容与含义不改（可优化语气词与标点），行动逻辑不变。\n【大幅修改（问题严重，必须改，可大改）】：\na. 仅明显常识/逻辑错误：人物行为违背现实物理规律或明显常识（如从 10 米高楼跳下毫发无损）——除非前文已铺垫超能力或其他设定；**即使修改后可能影响后文的衔接，也必须改（后文由作者自行处理）**；人设一致性的深度核对由「检测」功能负责，此处不处理；\nb. 物理与常识：违背现实物理规律或常识（如从 10 米高楼跳下毫发无损）——除非前文已铺垫超能力或其他设定；**即使修改后可能影响后文的衔接，也必须改（后文由作者自行处理）**；\nc. 时空与逻辑：场景切换缺少过渡、时空混乱、时间线矛盾（如上一秒在家下一秒到学校）；\nd. 不合理比喻/体型/身体描写（如"大腿只有手指般粗"——除非前文设定该角色是袖珍体型/精灵等特殊体形）。\n【小幅修改（允许，改动小）】：\ne. 词语使用错误：用词不当或部位错误（如"太阳穴发麻"应为"头皮发麻"）；\nf. 逻辑小错位：人物称呼/顺序错误（如 A 是 B 的老师却称呼 B 为老师，应调换）、台词顺序或指代错位。\n【不要修改（必须过滤）】：\n- 信息量零变化的纯措辞替换（如"喉结滚动"改"喉头动了动"——词汇语义无变化、无任何提升，不得输出）；\n- 只增删"的/了/一/副/个"等虚词或只改标点的微调（除非同时修正了逻辑错误）。\n- 删句号改逗号、删"地/了/的"等虚词、删"入"字（如"走入了"改"走进"）等为求"利落/流畅/干脆"的措辞精简——信息量零变化，不得输出；\n- 强行加语气词（啧/得了吧/行行行/算了算了等）或硬塞"废话动作"（擦桌子/翻白眼/系鞋带等）——原句无问题不得硬套，此类改动视为无实质提升。\n【理由机制】：\n- **每一处修改都必须带 reason 字段**（一句话，≤30 字，说明改了什么、为什么更好，如"原句『呆呆的』重复啰嗦，『呆滞』更简洁传神"）——**无论修改幅度大小，大段更换和小幅修改都需要理由**；\n- **没有理由的修改不要输出**（宁可少改，不改无意义）。\n- 禁止"更流畅/更简洁/更自然/更通顺/更好"等空泛理由——reason 必须指出具体问题（重复啰嗦/用词不当/书面腔/动作与情绪不匹配/句式生硬等）。\n【优先级与分配】：修改数量 0~30 处，不设下限、不强制按位置分配——只修改真正需要修改的句子；先通读全文识别所有真正的问题（包括后半篇），再按严重度排序取舍；宁缺毋滥，绝不为了凑数强行修改；没有值得修改的句子就少改或不改，可输出空数组 []。\n【禁止输出无效项】：\n- 严禁输出 old 与 new 相同的条目（不得以"原句无问题，保留"等理由占位）；无值得修改的句子直接跳过，宁缺毋滥；\n- old 与 new 仅差"的/了/一/副/个"等虚词或仅标点不同的条目同样禁止输出（视为无实质提升）；\n- 输出前自查每一条：old 与 new 必须存在实质内容差异。\n【输出格式】：必须只输出一个 JSON 对象：{"edits":[{"old":"原文完整句子 或 连续小段（≤200字，可跨行）","new":"润色后内容","reason":"一句话≤30字（每处必填）"}]}，old 必须与原文逐字一致（含标点、换行），供前端精确替换；支持整段/跨行替换；一次最多输出 30 处；没有值得修改的则输出空数组 []。不要输出任何其他文字。\n\n【去AI味要求】（仅处理规则层命中的句子；正常句子一律不动）：\n1. 用户消息开头会附上【本章 AI 腔规则层扫描】（词表命中清单：类别、词、次数、示例句）。针对清单命中句：按命中词策略处理——可替换词→改具体动作或白描；建议删除词→删除；需改写词→整句改写为画面化表达。\n2. 心理活动改为动作/对话呈现（show 不 tell：把情绪写出来给读者看，而非直接告诉）（"他心中愤怒"→"他攥紧了拳，指节发白"）；长句拆短；避免排比堆砌；句末感叹号收敛。\n3. 清单未命中的句子一律不动（宁缺毋滥）。\n4. 修改后不得再出现清单内的高频词（用替换/改写彻底消除，勿敷衍）。';
        const context = buildPolishContext(book, chap);
        // v8.7-P-友1：润色前规则层扫描本章——命中清单注入 user（模型明确改什么；零成本零延迟）
        const aiScan = scanAiTaste(chap.content || '');
        const aiHitsTxt = aiTasteHitsText(aiScan);
        const user = (aiHitsTxt ? '【本章 AI 腔规则层扫描】' + aiHitsTxt + '\n\n' : '') + '待润色内容：\n' + context + '\n\n请输出润色 diff 的 JSON。';
        // v8.7-P-友5：按本章长度动态配额（≤2500字→10处 / 5000字→20处 / ≥7500字→30封顶），防超长章刷屏
        const dynCap = Math.min(30, Math.max(10, Math.round((chap.content || '').length / 250)));
        const t0 = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 180000);
        startSbStages([{pct:15,text:'正在分析原文…'},{pct:45,text:'正在生成润色建议…'},{pct:75,text:'正在整理修改项…'},{pct:90,text:'正在收尾…'}], 20000, '⚠️ 请勿关闭网页，等待AI润色中...'); // v8.0.14：润色进度 20s 一格
        try {
            const res = await fetch(polishApi.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer ' + polishApi.key},
                body: JSON.stringify({
                    model: polishApi.model,
                    messages:[{role:'system',content:sys},{role:'user',content:user}],
                    max_tokens: Math.min(30000, polishApi.maxTokens || 30000), // v8.5.1：润色输出封顶 3w（原 5w/6w），用户调低 polishMaxTokens 时跟随；30处edits 最坏 ~4k token，3w 富余充足
                    // v8.6-⑤：参数模式 → 思考失效 + 用户参数（随机性增加）；否则默认思考模式（推理更适合润色审查）
                    ...(polishApi.paramMode ? {
                        thinking: { type:'disabled' },
                        temperature: polishApi.temp,
                        top_p: polishApi.topP,
                        presence_penalty: polishApi.presPenalty,
                        frequency_penalty: polishApi.freqPenalty,
                        repetition_penalty: polishApi.repPenalty
                    } : {
                        thinking: { type:'enabled' },
                        reasoning_effort: rEff
                    })
                }),
                signal: controller.signal
            });
            // v8.7-F006：clearTimeout 移到 res.json() 之后（原 fetch 返回即清，正文悬挂时 180s 超时失效，pendingPolish 永久不释放）
            if(!res.ok) {
                let msg = res.status === 401 ? 'API Key 无效' : res.status === 429 ? '请求频率过高' : 'HTTP ' + res.status;
                clearTimeout(timer);
                stopSbStages(); resetSbProgress();
                return { ok:false, err:'润色请求失败：' + msg };
            }
            const data = await res.json();
            clearTimeout(timer);
            const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            const usage = data && data.usage; // v7.8：计费用
            setCtxBudgetFromUsage(usage && usage.prompt_tokens, usage && usage.completion_tokens); // v8.5.2-A：润色真实 usage 覆盖预算条
            // v7.3：识别 Gemini 安全拦截（PROHIBITED_CONTENT）——中转站错误透传进 content，不再误报"无需修改"
            if(/PROHIBITED_CONTENT|blockReason/i.test(text)) {
                stopSbStages(); resetSbProgress();
                return { ok:false, err:'内容被 Gemini 安全策略拦截（PROHIBITED_CONTENT）——同人/成人向内容触发审核，已尝试关闭安全拦截仍失败的话，请换用对内容更宽松的模型（如中转站的 DeepSeek）作为审稿 API' };
            }
            if(!text.trim()) { stopSbStages(); resetSbProgress(); return { ok:false, err:'润色请求失败：响应为空' }; }
            let obj = null;
            const bs = text.indexOf('{');
            if(bs >= 0) {
                let depth = 0, end = -1;
                for(let i = bs; i < text.length; i++) {
                    if(text[i] === '{') depth++;
                    else if(text[i] === '}') { depth--; if(depth === 0) { end = i; break; } }
                }
                if(end > bs) { try { obj = JSON.parse(text.slice(bs, end + 1)); } catch(_) {} }
            }
            if(!obj) { try { obj = JSON.parse(text); } catch(_) {} }
            if(!obj || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.edits)) {
                stopSbStages(); resetSbProgress();
                return { ok:false, err:'润色解析失败：响应必须是包含 edits 数组的 JSON 对象', raw:text.slice(0,200) };
            }
            const edits = obj.edits.filter(e => { if(!e || typeof e !== 'object' || typeof e.old !== 'string' || typeof e.new !== 'string') return false; const _o = e.old.trim(), _n = e.new.trim(); if(!_o || !_n || _o === _n || editRatio(_o, _n) * 100 < 3) return false; const VOIDRE = /[ 的了地得着过,，。.!！?？;；:：（）()]/g; return _o.replace(VOIDRE, '') !== _n.replace(VOIDRE, ''); });
            // v7.3：滑块从"过滤"改为"理由触发标记"——不再丢弃任何有效修改
            const mapped = edits.map(e => {
                const old = e.old.trim(), nw = e.new.trim();
                return {
                    old, new: nw,
                    ratio: editRatio(old, nw) * 100,
                    reason: e.reason ? String(e.reason).trim().slice(0, 30) : '',
                    aiHits: scanAiTaste(nw).hits
                };
            });
            // v8.8-B07：只有合法 edits=[] 才是“无需修改”，解析失败已经在上方返回失败
            stopSbStages(); resetSbProgress();
            return {
                ok:true,
                edits: mapped.slice(0, dynCap),
                ctxLen: context.length,
                ms: Date.now() - t0,
                raw: text.slice(0, 200),
                cost: calcCost(polishApi.model, usage), // v7.8：审稿 API 计费（pro 价）
                parseFail:false
            };
        } catch(e) {
            clearTimeout(timer);
            stopSbStages(); resetSbProgress();
            return { ok:false, err:'润色请求失败：' + (e.name === 'AbortError' ? '超时(3分钟)' : e.message) };
        }
    }
    // 润色主流程：聊天消息 + pendingPolish 锁定（编辑入口通通拦截）+ 请求 + diff 预览
    async function onPolish() {
        if(importPending) { toast("备份导入进行中，请等待完成后再润色"); return; } // v8.10-F011
        let book = getCurrentBook();
        if(!book || !book.currentChapterId) { toast("请先选择章节"); return; }
        if(polishMode) { toast("已有润色预览中，请先应用或取消"); return; }
        if(pendingPolish) { toast("润色进行中，请先等待完成"); return; } // v8.7-F008：防并发润色——原漏检 pendingPolish，二次点击产生并发请求、共享 polishLid/pendingPolish，先结束者提前解锁（项目零审查 F-008）
        if(isGenerating) { toast("已有生成任务进行中，请等待或点击停止"); return; }
        if(pendingBranch) { toast("走向生成中，请稍候再润色"); return; }
        if(banterBusy) { toast("吐槽生成中，请等待完成后再润色"); return; } // v8.7-严格自审：吐槽在途禁止发起润色（润色应用会改正文——错绑已由发起时固定键最终防线隔离，此处防并发付费与结果困惑）
        if(pendingRewrite) { toast("已有待发送的重写，先发送或切换章节取消"); return; }
        if(!polishApi.url || !polishApi.key) { toast("请先配置审稿 API（API 调参 → 审稿页签）"); openApiModal(); return; }
        let chap = book.chapters.find(c=>c.id===book.currentChapterId); if(!chap) return;
        if(!await ensureCurrentChapterSavedAndCommitted()) return; // 先保存当前正文并等待事务提交（润色基于最新内容）
        if(!await appConfirmAsync('确定对本章进行润色吗？将调用审稿 API 并产生费用，润色结果需预览后应用。')) return;
        if(pendingGeneration) cancelPendingGeneration('⚠️ 已被新的生成任务覆盖');
        polishLid = addChat('assistant', '⏳ 润色审查中...', true);
        pendingPolish = true;
        setWritingLock(true);
        try {
            const result = await requestPolish(book, chap);
            if(result.ok && result.cost > 0) recordCost(result.cost); // v7.8.1：累计消耗金额
            if(!result.ok) {
                toast(result.err);
                if(polishLid) replaceChatMessage(polishLid, '❌ ' + result.err, book);
                startTabBlink('❌ 润色失败');
                return;
            }
            if(!result.edits.length) {
                toast('未发现需要修改的内容');
                startTabBlink('✅ 润色完成（无需修改）');
                // v7.3 诊断：注入量/耗时/AI 原始响应/格式异常标记——定位"无需修改"是模型行为还是解析吞错
                const diag = `［诊断：注入 ${result.ctxLen || 0} 字，耗时 ${((result.ms||0)/1000).toFixed(1)}s${result.parseFail ? '，⚠️ AI 返回的 edits 格式异常' : ''}，AI 响应：${(result.raw || '(空)').slice(0, 120)}］`;
                if(polishLid) replaceChatMessage(polishLid, '✨ 润色完成（无需修改）' + diag + (result.cost ? `（消费 $${result.cost.toFixed(2)} USD）` : ''), book);
                return;
            }
            // 渲染 diff 预览（低幅度修改带黄色理由，用户自行判断是否采纳）
            const failed = renderPolishDiff(book, chap, result.edits);
            if(polishLid) replaceChatMessage(polishLid, `✨ 润色完成（${result.edits.length - failed} 处修改${failed ? `，${failed} 处无法匹配跳过` : ''}，黄色标注为低幅度修改的理由）${result.cost ? `（消费 $${result.cost.toFixed(2)} USD）` : ''}`, book);
            toast(`润色完成：${result.edits.length - failed} 处修改${failed ? `（${failed} 处跳过）` : ''}，请预览后应用或取消${result.cost ? `（消费 $${result.cost.toFixed(2)} USD）` : ''}`);
            startTabBlink('✅ 润色完成，请预览后应用');
        } finally {
            pendingPolish = false;
            setWritingLock(false);
            // v7.3 修复：预览态下正文保持可编辑（用户可自由删改红/绿标记），仅重新禁用出口外按钮
            // ——不再强制 contentEditable='false'（旧补丁把 renderPolishDiff 设置的可编辑状态覆盖，导致预览态无法编辑）
            if(polishMode) {
                ['saveChapBtn','regenerateBtn','continueBtn','polishBtn','rollbackBtn'].forEach(id => { const b = $(id); if(b) b.disabled = true; });
            }
        }
    }
    // diff 预览渲染：正文纯文本中定位 old → 替换为"红标 old + 绿标 new"，未命中计入失败
    function renderPolishDiff(book, chap, edits) {
        let text = chap.content || '';
        polishBeforeText = text; // v7.3：存润色前正文快照（取消 = 整体还原，预览期手动删改全部作废）
        let failed = 0;
        const applied = [];
        // v7.3 修复：匹配位置跳过已被占用的索引——同一 old 在文中多次出现（或 AI 返回重复 old）时，
        // 不再全部命中第一次出现，按出现顺序逐个分配，避免从后往前替换时错位
        const usedPos = new Set();
        const acceptedRanges = [];
        const posMap = new Map();
        for(const e of edits) {
            let i = text.indexOf(e.old);
            while(i >= 0) {
                const end = i + e.old.length;
                const overlap = acceptedRanges.some(r => i < r.end && end > r.start);
                if(!usedPos.has(i) && !overlap) break;
                i = text.indexOf(e.old, i + 1);
            }
            if(i < 0) { failed++; continue; }
            usedPos.add(i);
            acceptedRanges.push({start:i, end:i + e.old.length});
            posMap.set(e, i);
            applied.push(e);
        }
        polishDiffs = applied;
        if(!applied.length) return failed;
        polishTargetId = chap.id; // v7.3：记录预览目标章节（切章后应用/放弃被拦截）
        // 从后往前替换避免索引错乱（markers 位置基于原始 text，顺序分配不重复）
        let htmlText = text;
        const markers = [];
        for(const e of applied) {
            const i = posMap.get(e);
            markers.push({ i, old: e.old, nw: e.new, ratio: e.ratio, reason: e.reason, aiHits: e.aiHits }); // v8.8-F-019：透传二次扫描结果
        }
        markers.sort((a,b) => b.i - a.i);
        // v8.4.1-⑥-d：所有修改必须显示理由（AI 给了用 AI 的，没给显示警示占位）
        for(const m of markers) {
            let seg = '@@D@@' + m.old + '@@I@@' + m.nw;
            seg += '@@R@@' + (m.reason || 'AI 未说明理由，请谨慎') + (m.aiHits ? ' ⚠️润色后仍含AI腔词' : ''); // v8.8-F-019：残留命中显式标记（防敷衍闭环——原 aiHits 计算后无任何消费端）
            seg += '@@E@@';
            htmlText = htmlText.slice(0, m.i) + seg + htmlText.slice(m.i + m.old.length);
        }
        // 转义 + 替换占位为 mark
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const html = esc(htmlText)
            .split('@@D@@').join('<mark class="polish-del">')
            .split('@@I@@').join('</mark><mark class="polish-ins">')
            .split('@@R@@').join('</mark><mark class="polish-reason">📎 ')
            .split('@@E@@').join('</mark>')
            .split('\n').join('<br>');
        const el = $('novelContent'); if(el) { el.innerHTML = html; el.contentEditable = 'true'; }
        // 预览态：保存/重写/续写/润色/回滚禁用（应用/放弃是唯一出口）；正文可自由编辑（v7.3：可手动删除不想要的红/绿标记）
        ['saveChapBtn','regenerateBtn','continueBtn','polishBtn','rollbackBtn'].forEach(id => { const b = $(id); if(b) b.disabled = true; });
        const bar = $('polishActionBar'); if(bar) { bar.style.display = 'flex'; const cnt = $('polishActionCount'); if(cnt) cnt.innerText = `共 ${applied.length} 处修改（${failed} 处无法匹配已跳过${applied.some(x => x.aiHits > 0) ? '，' + applied.filter(x => x.aiHits > 0).length + ' 条润色后仍含 AI 腔词 ⚠️ 建议重跑或手动修' : ''}）——可自由编辑正文，删除不想要的红/绿标记后再应用/放弃`; } // v8.8-F-019：操作条残留统计
        polishMode = true;
        return failed;
    }
    // 应用修改（v7.3 用户拍板）：红绿配对 → 去红留绿；只剩红（用户删了绿）→ 留红；只剩绿（用户删了红）→ 留绿——用户逐条删改的选择优先。
    // 应用 = 直接保存 + 正文解锁可编辑（无保护态、无淡色标记，正文纯净）；聊天区提示本次生效的修改处数
    async function applyPolish() {
        if(!polishMode) return;
        let book = getCurrentBook(); if(!book || !book.currentChapterId) return;
        if(polishTargetId && book.currentChapterId !== polishTargetId) { toast('章节已切换，润色结果已丢弃'); hidePolishBar(); polishMode = false; polishDiffs = []; polishTargetId = null; polishBeforeText = null; restoreEditorButtons(); return; }
        const el = $('novelContent'); if(!el) return;
        // v7.3：理由标记仅预览辅助，应用时先删除（不进入正文）
        el.querySelectorAll('mark.polish-reason').forEach(m => m.remove());
        // 配对判定：del 的下一兄弟元素是 ins → 配对（去红留绿）；孤立 del（用户删了绿）→ 剥标签保留
        let appliedCount = 0;
        Array.from(el.querySelectorAll('mark.polish-del')).forEach(m => {
            const ns = m.nextElementSibling;
            const isPaired = ns && ns.classList && ns.classList.contains('polish-ins');
            if(isPaired) { m.remove(); appliedCount++; }
            else { const t = document.createTextNode(m.textContent); m.replaceWith(t); }
        });
        // 所有 ins 剥标签保留（配对的保留、孤立的也保留——用户删了红则留绿）
        el.querySelectorAll('mark.polish-ins').forEach(m => { const t = document.createTextNode(m.textContent); m.replaceWith(t); });
        const finalText = getEditorText(); // 转换后仅剩正文（无任何 mark）
        const chap = book.chapters.find(c => c.id === book.currentChapterId); if(!chap) return;
        chap.content = finalText;
        const ok = saveAll() && await awaitNovelPersistence();
        // v8.7-M4：保存失败也要完整收尾——原提前 return 导致 polishMode 残留、按钮禁用、红绿标记已剥却无出口；
        // 内存 chap.content 已是 finalText，30s 自动保存会重试落盘，此处仅退出润色态防界面半瘫痪
        if(!ok) {
            toast('❌ 保存失败，请检查存储空间');
            el.innerHTML = escapeHtml(finalText).split('\n').join('<br>');
            el.contentEditable = 'true';
            hidePolishBar();
            polishMode = false;
            polishDiffs = [];
            polishTargetId = null;
            polishBeforeText = null;
            restoreEditorButtons();
            updateWord();
            banterPanelInvalidate(true); // v8.7 EXE-87-R7-F01：保存失败但内存正文已变（chap.content=finalText）同样刷新面板
            if(polishLid) replaceChatMessage(polishLid, '⚠️ 修改幅度已应用但本地保存失败！正文在内存中，请立即导出或复制，30秒自动保存将重试', book);
            return;
        }
        el.innerHTML = escapeHtml(finalText).split('\n').join('<br>'); // 纯净正文重渲染
        el.contentEditable = 'true';
        hidePolishBar();
        polishMode = false;
        polishDiffs = [];
        polishTargetId = null;
        polishBeforeText = null;
        restoreEditorButtons();
        updateWord();
        banterPanelInvalidate(true); // v8.7 EXE-87-R7-F01：润色应用成功（内存正文已变）经统一失效入口刷新面板——旧 A 点评不再无警告显示在 B 旁
        if(polishLid) replaceChatMessage(polishLid, `✅ 已应用 ${appliedCount} 处修改，正文已保存并可继续编辑`, book);
        toast(`✅ 已应用 ${appliedCount} 处修改，正文已保存`);
    }
    // 取消润色（v7.3 用户拍板）：完全回到润色前正文，不保留任何润色、不做任何修改（预览期手动删改全部作废）
    async function discardPolish() {
        if(!polishMode) return;
        let book = getCurrentBook(); if(!book || !book.currentChapterId) return;
        if(polishTargetId && book.currentChapterId !== polishTargetId) { toast('章节已切换，润色结果已丢弃'); hidePolishBar(); polishMode = false; polishDiffs = []; polishTargetId = null; polishBeforeText = null; restoreEditorButtons(); return; }
        const el = $('novelContent'); if(!el) return;
        const chap = book.chapters.find(c => c.id === book.currentChapterId); if(!chap) return;
        const before = (polishBeforeText !== null && polishBeforeText !== undefined) ? polishBeforeText : chap.content;
        chap.content = before;
        const committed = saveAll() && await awaitNovelPersistence();
        if(!committed) toast('⚠️ 还原内容已在内存中，但持久化未提交，请稍后重试保存');
        el.innerHTML = escapeHtml(before).split('\n').join('<br>');
        el.contentEditable = 'true';
        hidePolishBar();
        polishMode = false;
        polishDiffs = [];
        polishTargetId = null;
        polishBeforeText = null;
        restoreEditorButtons();
        if(polishLid) replaceChatMessage(polishLid, '↩️ 已取消润色，已还原为润色前正文（预览期间修改已作废）', book);
        toast('已取消润色，已还原为润色前正文');
    }
