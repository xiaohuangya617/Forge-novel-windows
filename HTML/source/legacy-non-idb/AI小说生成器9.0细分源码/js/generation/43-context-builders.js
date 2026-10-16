    function buildActionText(precisionIds) { if(globalActions.length===0) return ''; const selected = precisionIds ? new Set(precisionIds.map(String)) : null; let filtered = selected ? globalActions.filter(a => selected.has(String(a.id))) : globalActions; if(!filtered.length) return ''; let txt = precisionIds ? '【当前场景动作规范】\n' : '【必须严格遵守的动作描写规则】\n'; filtered.forEach(a => { txt += `- 动作"${a.name}"：`; if(a.keyPoints) txt += `动作要领：${a.keyPoints}；`; if(a.linesUsage) txt += `台词运用：${a.linesUsage}；`; if(a.descriptionTips) txt += `描写建议：${a.descriptionTips}；`; txt += '\n'; }); return txt; }
    function buildCostumeText(precisionIds) { if(globalCostumes.length===0) return ''; const selected = precisionIds ? new Set(precisionIds.map(String)) : null; let filtered = selected ? globalCostumes.filter(a => selected.has(String(a.id))) : globalCostumes; if(!filtered.length) return ''; let txt = precisionIds ? '【当前场景服装规范】\n' : '【必须严格遵守的服装描写规则】\n'; filtered.forEach(a => { txt += `- 服装"${a.name}"：`; if(a.styleDetail) txt += `详细款式：${a.styleDetail}；`; if(a.descriptionTips) txt += `描写建议：${a.descriptionTips}；`; txt += '\n'; }); return txt; }
    function buildRelationText(book) { if(!book.characters || book.characters.length===0) return ''; const edges = []; const seen = new Set(); book.characters.forEach(c => { (c.relationships||[]).forEach(r => { const t=book.characters.find(tc=>String(tc.id)===String(r.targetId)); if(!t) return; const key = c.id + '\u0000' + r.targetId + '\u0000' + r.type; if(!seen.has(key)){ seen.add(key); edges.push(`${c.name} → ${r.type} → ${t.name}`); } }); }); if(!edges.length) return ''; return '【角色关系图】\n'+edges.map(e=>'- '+e).join('\n')+'\n'; }
    function buildCharacterText(book, precisionIds) { if(!book.characters || book.characters.length===0) return ''; const selected = precisionIds ? new Set(precisionIds.map(String)) : null; let filtered = selected ? book.characters.filter(c => selected.has(String(c.id))) : book.characters; if(!filtered.length) return ''; let txt = precisionIds ? '【当前出场角色】\n' : '【重要·本书角色库】\n'; filtered.forEach(c => { txt += `- ${c.name}：`; if(c.appearance) txt += `外貌体征：${c.appearance}；`; if(c.personality) txt += `性格：${c.personality}；`; if(c.special) txt += `服装及其他设定：${c.special}；`; if(c.relationship) txt += `身份关联：${c.relationship}；`; txt += '\n'; }); return txt; }
    function buildForbiddenWarning(book) { if(!book.forbiddenWords || book.forbiddenWords.length===0) return ''; let warning = '【严格禁止以下词语】\n'; book.forbiddenWords.forEach(({word}) => { warning += `- 绝对禁止出现"${word}"。\n`; }); return warning; }
    function buildSys(book, usePrecision = false) { let precisionChars = null, precisionActions = null, precisionCostumes = null; if(usePrecision && book.precisionMode && book.precisionChars && book.precisionActions && (book.precisionChars.length || book.precisionActions.length || (book.precisionCostumes||[]).length)) { precisionChars = book.precisionChars; precisionActions = book.precisionActions; precisionCostumes = book.precisionCostumes; } let relationLib = buildRelationText(book); let actionLib = buildActionText(precisionActions); let costumeLib = buildCostumeText(precisionCostumes); let charLib = buildCharacterText(book, precisionChars); let forbiddenWarning = buildForbiddenWarning(book); const parts = []; if(book.globalPrompt && book.globalPrompt.trim()) parts.push(book.globalPrompt.trim()); if(book.writingStyle && book.writingStyle.trim()) parts.push('【行文】'+book.writingStyle.trim()); if(relationLib) parts.push(relationLib.replace(/\n$/,'')); if(charLib) parts.push(charLib.replace(/\n$/,'')); if(actionLib) parts.push(actionLib.replace(/\n$/,'')); if(costumeLib) parts.push(costumeLib.replace(/\n$/,'')); if(forbiddenWarning) parts.push(forbiddenWarning.replace(/\n$/,'')); if(book.worldview && book.worldview.trim()) parts.push('【世界观】'+book.worldview.trim()); if(book.plotSet && book.plotSet.trim()) parts.push('【情节】'+book.plotSet.trim());
        const growthLib = buildGrowthText(book, precisionChars, 10); // v8.5-9：生文成长取最近 10 条（原全量）；精准模式开→仅勾选角色，未开→全部角色
        if(growthLib) parts.push(growthLib.replace(/\n$/,'')); // v7.9缓存优化：成长段挪至末尾，避免带崩其后稳定段（动作/服装/世界观/情节）
        return parts.join('\n') + '\n输出Markdown正文。'; } // v7.6：专有名词已并入世界观名词（termSet 移除）
    function getPrev(book, idx) {
        let start = Math.max(0, idx - api.ctxChapters);
        let prev = book.chapters.slice(start, idx);
        if(!prev.length) return "开篇。";
        const MAX_TOTAL = 5000, MAX_SINGLE = 2000, MAX_SUMMARY = 300; // v8.5-8：生文前文总量 30000→5000、无摘要单章节选 5000→2000（防单章节选吃满预算）
        // v7.1 权重修正：优先保留最近的章节——从后往前挑选能装入预算的章节，
        // 超限丢弃的是最早章节（旧逻辑从前往后注入、超限 break，反而丢掉离当前最近的章节）
        const picked = [];
        let budget = MAX_TOTAL;
        for(let i = prev.length - 1; i >= 0; i--) {
            const ch = prev[i];
            const len = (ch.summary && ch.summary.trim()) ? Math.min(ch.summary.trim().length, MAX_SUMMARY) : Math.min((ch.content || '').length, MAX_SINGLE);
            if(len > budget) break;
            budget -= len;
            picked.unshift(i);
        }
        let txt = "【前文完整内容】\n";
        // v7.1：章号按书内真实位置计算（跳过旧章后不能用累加计数，否则标签错乱）
        for(const i of picked) {
            const ch = prev[i];
            const realIdx = book.chapters.indexOf(ch);
            const regularNo = book.chapters.slice(0, realIdx).filter(c => !c.isInterlude).length + 1;
            if(ch.summary && ch.summary.trim()) {
                const summary = ch.summary.trim().slice(0, MAX_SUMMARY);
                txt += (ch.isInterlude ? '间章' : '第'+regularNo+'章') + ' ' + ch.title + '（摘要）：' + summary + '\n';
            } else {
                let body = ch.content || '';
                if(body.length > MAX_SINGLE) body = body.slice(0, MAX_SINGLE) + '\n…（前文单章过长已截断）';
                txt += (ch.isInterlude ? '间章' : '第'+regularNo+'章') + ' ' + ch.title + '\n' + body + '\n\n';
            }
        }
        if(picked.length < prev.length) txt += '\n…（前文较早章节因总长限制已省略，最近章节已完整保留）';
        return txt;
    }
    function extractTitle(content, fallbackTitle) {
        let lines = content.split('\n');
        for(let line of lines) { let t=line.trim(); if(t.startsWith('#') && t.length>1) return t.replace(/^#+\s*/,'').trim(); }
        // v7.1 增强：AI 长文可能不输出 # 标题，回退取第一个非空短行（优先"第X章"格式，排除以句末标点结尾的正文句）
        for(let line of lines) { let t=line.trim(); if(!t || t.length>40) continue; if(/^第[0-9一二三四五六七八九十百千]+章/.test(t) || (t.length<=30 && !/[。！？.!]$/.test(t))) return t; }
        return fallbackTitle;
    }

    // v8.5-8：前 3 章人物经历参考——有摘要用摘要（≤300字），无摘要回退正文节选（前 500 字），总量 ≤1000，超限丢弃最旧（从后往前保留最新）
    function buildCheckPrev(book, chapter) {
        const idx = book.chapters.findIndex(c=>c.id===chapter.id);
        const start = Math.max(0, idx - 3); // v8.5-8：前文参考由前 5 章改前 3 章（对齐润色/吐槽）
        const prevChaps = book.chapters.slice(start, idx);
        if(!prevChaps.length) return '（开篇，无前文）';
        const picked = [];
        let total = 0;
        for(let i = prevChaps.length - 1; i >= 0; i--) {
            const ch = prevChaps[i];
            const regularNo = book.chapters.slice(0, book.chapters.indexOf(ch)).filter(x => !x.isInterlude).length + 1;
            const label = `${ch.isInterlude ? '间章' : '第' + regularNo + '章'} ${ch.title || ''}`;
            let seg;
            if(ch.summary && ch.summary.trim()) seg = `${label}（摘要）：${ch.summary.trim().slice(0,300)}`;
            else seg = `${label}（正文节选）：${(ch.content || '').slice(0,500)}`;
            if(total + seg.length > 1000 && picked.length) break; // v8.5-8：超 1000 丢弃最旧
            total += seg.length;
            picked.unshift(seg);
        }
        if(!picked.length) return '（无前文）';
        let txt = picked.join('\n');
        if(picked.length < prevChaps.length) txt += '\n…（前文人设参考已截断）';
        return txt;
    }
    function validateConflictReport(report, content, legacyArray) {
        const hits = legacyArray ? report : (report && report.hits);
        if(!Array.isArray(hits)) return { ok:false, error:'冲突检测返回格式无效：hits 必须是数组' };
        for(const hit of hits) {
            if(!hit || typeof hit !== 'object' || Array.isArray(hit)) return { ok:false, error:'冲突检测返回格式无效：命中项必须是对象' };
            if(typeof hit.quote !== 'string' || !hit.quote.trim() || hit.quote.length > 30 || !String(content || '').includes(hit.quote)) return { ok:false, error:'冲突检测返回格式无效：quote 不在当前正文中' };
            if(!['high','mid','low'].includes(hit.severity)) return { ok:false, error:'冲突检测返回格式无效：severity 不合法' };
            if(typeof hit.reason !== 'string' || typeof hit.suggestion !== 'string') return { ok:false, error:'冲突检测返回格式无效：reason/suggestion 类型错误' };
            if(hit.reason.length > 100 || hit.suggestion.length > 80) return { ok:false, error:'冲突检测返回格式无效：说明文字超长' };
        }
        if(legacyArray) return { ok:true, hits };
        if(!report || typeof report !== 'object' || Array.isArray(report)) return { ok:false, error:'冲突检测返回格式无效：报告必须是对象' };
        if(!['PASS','REVISE','REJECT'].includes(report.decision) || !['S','A','B','C','D'].includes(report.overall_grade)) return { ok:false, error:'冲突检测返回格式无效：评级字段缺失或错误' };
        const dg = report.dimension_grades;
        if(!dg || typeof dg !== 'object' || Array.isArray(dg)) return { ok:false, error:'冲突检测返回格式无效：dimension_grades 缺失' };
        for(const k of ['设定一致性','逻辑连贯','AI味','结构节奏']) if(!['S','A','B','C','D'].includes(dg[k])) return { ok:false, error:'冲突检测返回格式无效：维度评级错误' };
        return { ok:true, hits };
    }
    async function runChapterCheck(book, chapter, showToastOnError=false) { // v8.5.2-P3-2：删 prevContent 死参数（前文由 buildCheckPrev 内部构造，20000 预算构造段已移除）
        if(!api.key) return { ok:false, error:"请先配置 API Key" };
        if(!apiUrlValid(api.url)) return { ok:false, error:"API 地址无效（需以 http:// 或 https:// 开头）" };
        // v6.3：检测内容重定义——本章正文 + 前 3 章摘要人物经历 + 精准勾选角色（v8.5-1：未开精准不注入角色）+ 勾选角色成长（v8.5-9：最近3条）
        const prevTxt = buildCheckPrev(book, chapter);
        // v8.7-C-友1/C1：规则层扫描（AI 味双通道基础）+ 未开精准时按正文出场频率注入 top 8 角色（原不注入致设定一致性维度空转）
        const contentNow = (chapter.content || '');
        const checkPrecisionIds = (book.precisionMode && book.precisionChars && book.precisionChars.length) ? book.precisionChars : null;
        const aiScan = scanAiTaste(contentNow);
        const aiHitsTxt = aiTasteHitsText(aiScan);
        let charsTxt = checkPrecisionIds ? buildCharacterText(book, checkPrecisionIds) : '';
        let checkGrowthTxt = checkPrecisionIds ? buildGrowthText(book, checkPrecisionIds, 3) : ''; // v8.5.1-P1：检测成长仅精准模式注入
        if(!checkPrecisionIds) { // v8.7-C1：正文出场频率 top 8；v8.8-F-020 改为最长匹配非重叠计数——子串角色不再虚假计次（"林峰"文本不再同时给"林"计次）
            const aliasOwner = new Map(); // 别名 -> 角色；同别名多角色 = 无法消歧 → null 跳过
            (book.characters || []).forEach(c => { if(!c || !c.name) return; buildCharAliases(c.name).forEach(al => { if(!al) return; const own = aliasOwner.get(al); if (own === undefined) aliasOwner.set(al, c); else if (own !== c) aliasOwner.set(al, null); }); });
            const candidates = [];
            aliasOwner.forEach((owner, al) => { if (owner) candidates.push({ al, owner }); });
            candidates.sort((a, b) => b.al.length - a.al.length); // 长别名优先（贪心最长匹配）
            const byFirst = new Map();
            candidates.forEach(cd => { const ch = cd.al[0]; if (!byFirst.has(ch)) byFirst.set(ch, []); byFirst.get(ch).push(cd); });
            const charCount = new Map();
            for (let pos = 0; pos < contentNow.length;) { const ch = contentNow[pos]; const cands = byFirst.get(ch); let matched = null; if (cands) { for (const cd of cands) { if (contentNow.startsWith(cd.al, pos)) { matched = cd; break; } } } if (matched) { charCount.set(matched.owner, (charCount.get(matched.owner) || 0) + 1); pos += matched.al.length; } else pos++; }
            const freq = [];
            charCount.forEach((n, c) => freq.push({ c, n }));
            freq.sort((a, b) => b.n - a.n);
            const top = freq.slice(0, 8).map(x => x.c);
            if(top.length) { charsTxt = buildCharacterText(book, top.map(c => c.id)); checkGrowthTxt = buildGrowthText(book, top.map(c => c.id), 3); }
        }
        // v8.4-③-b：检查升级——五档评级 + 4维评分 + 世界观注入（截800字）+ hits 结构化输出（v8.4.2：去语言表达维度与 fix_tickets）
        const worldviewTxt = (book.worldview || '').trim() ? '【世界观】\n' + book.worldview.trim().slice(0, 800) + (book.worldview.trim().length > 800 ? '\n…（世界观已截断）' : '') : '（未设定世界观）';
        // v8.6-③：检测稳定段前置——开场+评分维度+JSON输出要求+规则（固定）在最前，变段（前文人设/关系图/人物/世界观/正文）垫底 → 同章重复检测命中缓存
        const prompt = `你是一位专业的小说主编，负责对「当前章节」做全面质检（设定一致性 + 质量评级）。这是虚构文学作品，仅供作者整理情节使用，请客观如实检查，不要拒绝或回避。

【评分维度】（各维独立评级 S/A/B/C/D）：
1. 设定一致性：人物性格/情绪/台词/外貌/关系/世界观是否与前文和设定一致（最高优先级）
2. 逻辑连贯：时间线、因果、前后衔接是否自洽
3. AI味：以规则层扫描为准（下方【AI 味规则层扫描】含评分与命中清单）——核查命中句，引用最典型的 1~3 句列入 hits（quote 逐字一致）；另自查扫描未覆盖的语义性 AI 腔
4. 结构节奏：段落划分、详略分配、节奏起伏是否合理

请只输出一个 JSON 对象（不要输出任何其他文字），格式：
{
  "decision": "PASS 或 REVISE 或 REJECT",
  "overall_grade": "S 或 A 或 B 或 C 或 D",
  "dimension_grades": {"设定一致性":"S", "逻辑连贯":"A", "AI味":"C", "结构节奏":"B"},
  "hits": [{"quote":"原文片段(≤30字，必须与原文逐字一致)", "severity":"high 或 mid 或 low", "reason":"问题说明(≤100字)", "suggestion":"修改建议(≤80字)"}]
}
规则：
- decision：overall_grade 为 S/A → PASS；B → REVISE（需修改）；C/D → REJECT（建议重写）
- hits 只列需要修改的实质问题（高/中严重度：设定不一致、逻辑漏洞、AI套话），无关紧要的提示性内容（如"时间线紧凑""节奏稍快""用词建议"等不影响设定与逻辑的琐碎建议）一律不要列入；无问题输出空数组 []
- hits 中的 quote 必须与正文逐字一致（用于定位标色）

【前文人设参考（前3章）】
${prevTxt}

【角色关系图】
${buildRelationText(book)}

【人物设定】
${charsTxt}${checkGrowthTxt ? '\n\n' + checkGrowthTxt : ''}

${worldviewTxt}

【AI 味规则层扫描】
${aiHitsTxt || '（词表无命中，评分 0/100）'}

【当前章节内容】
${chapter.content}`;
        // v6.8：controller/timeout 提升到 try 外——finally 无法访问 try 块内 const（v6.7 引入 ReferenceError 使冲突检测失效）
        const controller = new AbortController();
        let timeout = null;
        try {
            timeout = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(api.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${api.key}`},
                body:JSON.stringify({ model:api.model, messages:[{role:"system",content:"你是一个严谨的编辑，只输出JSON。"},{role:"user",content:prompt}], temperature:0.3, max_tokens:Math.min(30000, api.maxTokens || 30000), thinking:{ type:'disabled' } }), // v8.5.1：检测输出封顶 3w（原跟正文 6w），用户调低 maxTokens 时跟随；输出仅需几百 token，防异常超长烧钱
                signal: controller.signal
            });
            if(!res.ok) return { ok:false, error:"冲突检测请求失败 (" + await extractApiError(res) + ")" };
            const data = await res.json();            let content = data.choices[0]?.message?.content;
            const usage = data && data.usage; // v7.8：检查计费用
            setCtxBudgetFromUsage(usage && usage.prompt_tokens, usage && usage.completion_tokens); // v8.5.2-A：检测真实 usage 覆盖预算条
            if(!content) {
                // v6.3：空内容诊断——带出 finish_reason 与 message 字段，便于定位（length=截断/思考结构/API 异常）
                const ch = data.choices && data.choices[0];
                let diag = '无 choices';
                if(ch) {
                    const msgKeys = ch.message ? Object.keys(ch.message).join(',') : '无 message';
                    diag = 'finish=' + (ch.finish_reason || '?') + ' msg=[' + msgKeys + ']';
                    if(!ch.message && data.error) diag += ' apiError=' + String(data.error.message || data.error).slice(0, 80);
                }
                return { ok:false, error:"冲突检测返回内容为空（" + diag + "）" };
            }
            // v8.4-③-b：解析升级——先匹配对象（新格式 {decision,overall_grade,...}），再兼容数组（旧格式）
            let jsonMatch = content.match(/\{[\s\S]*\}/);
            if(jsonMatch) {
                try {
                    const obj = JSON.parse(jsonMatch[0]);
                    if(obj && !Array.isArray(obj)) {
                        const valid = validateConflictReport(obj, chapter.content, false);
                        if(!valid.ok) return { ok:false, error:valid.error };
                        return { ok:true, conflicts: valid.hits, checkReport: obj, cost: calcCost(api.model, usage) };
                    }
                } catch(e) {}
            }
            jsonMatch = content.match(/\[[\s\S]*\]/);
            if(jsonMatch) { const legacy = JSON.parse(jsonMatch[0]); const valid = validateConflictReport(legacy, chapter.content, true); if(!valid.ok) return { ok:false, error:valid.error }; return { ok:true, conflicts:valid.hits, cost:calcCost(api.model, usage) }; } // v8.8-B06：旧格式也校验 hits
            let cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
            if(cleaned.startsWith('{')) { try { const obj = JSON.parse(cleaned); const valid = validateConflictReport(obj, chapter.content, false); if(!valid.ok) return { ok:false, error:valid.error }; return { ok:true, conflicts:valid.hits, checkReport:obj, cost:calcCost(api.model, usage) }; } catch(e) {} }
            if(cleaned.startsWith('[')) { const legacy = JSON.parse(cleaned); const valid = validateConflictReport(legacy, chapter.content, true); if(!valid.ok) return { ok:false, error:valid.error }; return { ok:true, conflicts:valid.hits, cost:calcCost(api.model, usage) }; }
            return { ok:false, error:"冲突检测返回内容无法解析" }; // v8.7-M1：解析全失败的兜底改失败路径——原 ok:true+空列表会误报"无冲突"并清空上一轮有效结果（recheck 成功分支 checkResult=[]），与 v8.6-r13"失败保留旧结果"冲突
        } catch(e) {
            if(e && e.name === 'AbortError') { return { ok:false, error:"冲突检测超时（30秒）" }; } // v6.8：超时专属提示（此前一律显示"解析失败"误导）
            if(showToastOnError) toast("冲突检测解析失败，请稍后重试");
            console.warn("冲突检测解析失败",e);
            return { ok:false, error:"冲突检测解析失败" };
        } finally { if(timeout) clearTimeout(timeout); } // v6.8：判空防重复清理 // v6.7：超时覆盖完整请求链路（fetch 响应头 + 响应正文 + JSON 解析），防 res.json() 悬挂时永久卡"检查中"
    }
    // 冲突检测状态栏计数器：自动/手动检测并行时，先结束的不得提前隐藏"检查中"提示
    let conflictCheckingCount = 0;
    function setConflictChecking(active) {
        conflictCheckingCount += active ? 1 : -1;
        conflictCheckingCount = Math.max(0, conflictCheckingCount);
        const el = $('conflictCheckStatus');
        if(el) el.style.display = conflictCheckingCount > 0 ? 'inline' : 'none';
    }

