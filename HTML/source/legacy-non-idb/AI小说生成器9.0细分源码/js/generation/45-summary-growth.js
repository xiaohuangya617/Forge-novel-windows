    // ===== v7.1 角色成长：解析 / 写入 / 清理 / 注入 =====
    // v7.1：从角色全名拆别名集（如 冥雪（小雪）【综漫设定】→ [冥雪（小雪）【综漫设定】, 冥雪（小雪）, 冥雪, 小雪, 冥雪小雪综漫设定]）
    function buildCharAliases(name) {
        const src = String(name || '').trim();
        if(!src) return [];
        const set = new Set([src]);
        const noBrackets = src.replace(/【[^】]*】/g, '').trim();
        if(noBrackets && noBrackets !== src) set.add(noBrackets);
        const noParen = src.replace(/[（(][^（）()]*[）)]/g, '').trim();
        if(noParen && noParen !== src) set.add(noParen);
        const noParenClean = noParen.replace(/【[^】]*】/g, '').trim();
        if(noParenClean && !set.has(noParenClean)) set.add(noParenClean);
        const noBracketClean = noBrackets.replace(/[（(][^（）()]*[）)]/g, '').trim();
        if(noBracketClean && !set.has(noBracketClean)) set.add(noBracketClean);
        const bracketInner = src.match(/【([^】]*)】/);
        if(bracketInner && bracketInner[1] && bracketInner[1].trim() && !set.has(bracketInner[1].trim())) set.add(bracketInner[1].trim());
        const parenM = src.match(/[（(]([^（）()]*)[）)]/);
        if(parenM && parenM[1] && parenM[1].trim()) set.add(parenM[1].trim());
        const cleaned = src.replace(/[【】（）()]/g, '').trim();
        if(cleaned && !set.has(cleaned)) set.add(cleaned);
        return [...set].filter(n => n && n.replace(/[\s【】[\]（）()]/g, '').length >= 1);
    }
    // v7.1：注入首选别名——括号内别名优先（冥雪（小雪）→ 小雪），无括号则去【】后主体，否则全名
    // ==================== v7.8 摘要与经历合并请求（正文生成后独立调用） ====================
    // v7.8 链路改造：正文请求不再输出摘要/成长——正文完成后保持锁定，由本函数一次请求生成【摘要】+【成长】
    // 并注入对应位置，完成后解锁。触发：单版正文完成自动 / 双版选中版本后自动 / 摘要区手动按钮。
    let summaryGrowthPending = false; // 自动阶段锁定标记（正文完成→合并请求期间保持锁定，防止 finally 提前解锁）
    function setWritingLockTip(text) {
        const tip = $('writingLockTip'); if(!tip) return;
        tip.innerHTML = text ? '<i class="fas fa-lock"></i> ' + text : '<i class="fas fa-lock"></i> ✍️ AI 正在生成中，当前章节已锁定，避免生成结果覆盖你输入的内容';
    }
    function releaseAutoSummaryLock() {
        summaryGrowthPending = false;
        if(!multiChapRunning) { isGenerating = false; setWritingLockTip(''); setWritingLock(false); const b = $('stopGenBtn'); if(b) b.disabled = true; }
    }
    async function generateSummaryGrowth(book, chap, chatId, opts) {
        const manual = !!(opts && opts.manual);
        const sgContentAtRequest = chap && chap.content || ''; // v8.6-r11：正文快照（字符串值拷贝）——请求期间用户编辑/重写，写入时比对丢弃旧摘要
        if(!api.key || !apiUrlValid(api.url)) { if(manual) toast('请先配置 API Key'); else releaseAutoSummaryLock(); return; }
        if(!chap || !(chap.content || '').trim()) { if(manual) toast('章节正文为空，无法生成摘要和经历'); else releaseAutoSummaryLock(); return; }
        if(summaryGenerating) {
            if(manual) toast('摘要与经历生成中，请稍候');
            else {
                pushLog('⚠️ 上一章摘要仍在生成，本章摘要已跳过（可手动重新生成）'); // v8.5.2-P2-1：非手动跳过也给日志留痕（原静默丢弃）
                if(multiChapRunning) summarySkippedChaps.push(chap.title || ('第' + ((book.chapters || []).findIndex(c => c.id === chap.id) + 1) + '章')); // v8.6-②：仅连发场景记录跳过章节（单章跳过只留痕）
                // v8.5.3-P2：本次自动摘要被跳过——若本章正文已完成（summaryGrowthPending 挂起），
                // 需释放挂起标志与锁，防"手动摘要在途 + 发正文"路径下写作锁永久卡死（原 v7.8 遗留，仅刷新可恢复）
                summaryGrowthPending = false; // v8.6-fix25：无条件清挂起标志（原仅非连发清理）——手动摘要 finally 不清自动标志，连发跳过后残留导致后续失败生成时 isGenerating 永久卡死
                if(!multiChapRunning) {
                    isGenerating = false;
                    setWritingLockTip('');
                    setWritingLock(false);
                }
            }
            return;
        }
        summaryGenerating = true;
        const sgSession = generationSessionId; // v8.6-P2-2：会话快照——finally 中会话已变（停止后新任务）则跳过锁清理
        if(!manual) { isGenerating = true; setWritingLockTip('📝 正文已生成，摘要与经历生成中…'); const sb2 = $('stopGenBtn'); if(sb2) sb2.disabled = false; } // v8.5.3-P2-2：摘要阶段恢复停止按钮（正文完成后原被禁用）
        pushLog('📝 摘要与经历生成中…');
        const controller = new AbortController();
        if(!manual) currentSummaryController = controller; // v8.5.3-P2-2：暴露给 stopGeneration 中止
        const timeout = setTimeout(() => controller.abort(), 60000); // 用户拍板：60s 超时自动解锁
        try {
            // v8.4-⑤摘要降本：正文三分法（前1000+中1000+后1000，≤3000字短章全量）+ 任务段前置（缓存前缀稳定）+ 角色仅精准模式注入 + 成长全局取尾10条
            const precisionIds = (book.precisionMode && book.precisionChars && book.precisionChars.length) ? book.precisionChars : null;
            const rolesTxt = precisionIds ? buildCharacterText(book, precisionIds) : '';
            const growthTxt = buildGrowthText(book, precisionIds, 10);
            const cBody = chap.content || '';
            let bodyText = cBody;
            if(cBody.trim().length > 3000) {
                const mid = Math.floor(cBody.length / 2);
                bodyText = cBody.slice(0, 1000) + '\n……（中略）……\n' + cBody.slice(mid - 500, mid + 500) + '\n……（中略）……\n' + cBody.slice(-1000);
            }
            const sys = '你是小说编辑助手，负责提炼章节摘要与整理角色经历。这是虚构文学作品的创作场景，请正常创作，不要拒绝或回避。';
            // v8.4：任务段前置（固定长段），正文/角色/成长作变段垫后——同章重复摘要时任务段可命中缓存
            let user = '【任务】\n1. 输出【摘要】标记，后接本章 200 字以内的摘要（必须明确指出：出场人物、时间、地点，并包含：事件、关键细节，不分段，直接输出摘要正文）。\n';
            user += '2. 输出【成长】标记，后接本章角色的经历变化（每行一条，格式：角色名——经历文本）。输出规则（必须遵守）：仅当角色发生以下显著变化才输出：①身体状态（受伤/康复/疾病/中毒等）②心理状态（性格转变/剧烈情绪/心理创伤/心结等）③人际关系重大变化（爱上/恨上/信任/背叛/结盟等）④能力与身份（学会新能力/失去能力/获得重要道具/身份地位变化）；吃饭、睡觉、日常对话、普通出行等日常行为一律不输出；纯出场不写；仅当本章所有角色都无上述变化时才允许省略此段；只输出本章新增的变化，不得重复上述历史经历；角色名优先使用完整姓名，也允许使用角色库中的别名/昵称，但必须保证唯一识别（同名角色必须用完整姓名区分）；若创作指令要求补充某章经历，请一并写入并在行首标注章号（格式：第X章：角色名——经历文本）。\n\n';
            user += '【本章正文】\n' + bodyText + '\n\n';
            if(rolesTxt) user += rolesTxt + '\n';
            if(growthTxt) user += growthTxt + '\n';
            const res = await fetch(api.url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${api.key}`},
                body: JSON.stringify({
                    model: api.model,
                    messages:[{role:'system',content:sys},{role:'user',content:user}],
                    max_tokens: Math.min(10000, api.maxTokens || 10000), // v8.4-⑤：摘要输出仅需几百 token，封顶 10000；用户调低 maxTokens 时跟随（兼容限 8k 端点）
                    temperature: 0.3,
                    thinking: { type:'disabled' }
                }),
                signal: controller.signal
            });
            if(!res.ok) throw new Error(await extractApiError(res));
            const data = await res.json();
            const sgCost = calcCost(api.model, data.usage); // v7.8：摘要+经历计费（正文 API）
            setCtxBudgetFromUsage(data.usage && data.usage.prompt_tokens, data.usage && data.usage.completion_tokens); // v8.5.2-A：摘要真实 usage 覆盖预算条
            if(sgCost > 0) recordCost(sgCost); // v7.8.1：累计消耗金额
            const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            if(!text.trim()) throw new Error('返回内容为空');
            // 解析：lastIndexOf + 段界隔离（【摘要】/【成长】顺序无关）
            let summaryText = '';
            const sumIdx = text.lastIndexOf('【摘要】');
            const grIdx = text.lastIndexOf('【成长】');
            if(sumIdx !== -1) {
                const sumEnd = (grIdx > sumIdx) ? grIdx : text.length;
                const candidate = text.substring(sumIdx + '【摘要】'.length, sumEnd).trim();
                if(candidate.length <= 300) summaryText = candidate;
            }
            let growthParsed = [];
            let hasValidGrowthSection = false;
            if(grIdx !== -1) {
                const grEnd = (sumIdx > grIdx) ? sumIdx : text.length;
                const gCand = text.substring(grIdx + '【成长】'.length, grEnd).trim();
                if(gCand.length <= 5000) { growthParsed = parseGrowthText(gCand, book); hasValidGrowthSection = !gCand || growthParsed.length > 0 || /^(?:（无|无变化|无）|无明显变化)$/i.test(gCand); }
            }
            const current = book.chapters.find(c => c.id === chap.id);
            if(!current) return;
            // v8.6-r11：写入前 content 快照校验——请求期间用户编辑/重写正文则丢弃本次摘要（防旧正文摘要覆盖新正文、成长按旧文本写入角色库）
            if(current.content !== sgContentAtRequest) {
                pushLog('⚠️ 摘要生成期间正文已变更，本次摘要与成长已丢弃（请重新生成）');
                return;
            }
            if(summaryText) current.summary = summaryText;
            if(hasValidGrowthSection) { removeChapterGrowthFromAll(book, current.id); if(growthParsed.length) applyGrowthToBook(book, current, growthParsed); }
            saveAll();
            if(currentBookId === book.id && book.currentChapterId === current.id) {
                const sumEl = $('summaryArea'); if(sumEl) sumEl.value = current.summary || '';
            }
            if(manual) toast('摘要与经历已生成' + (sgCost ? `（消费 $${sgCost.toFixed(2)} USD）` : ''));
            // v8.4-④：自动摘要补成本提示——与正文成本合并展示（对上实时面板）
            else if(sgCost > 0) {
                let costTail = `摘要经历 $${sgCost.toFixed(2)}`;
                if(lastGenCostRef && lastGenCostRef.bookId === book.id && lastGenCostRef.chapId === chap.id) {
                    const x = lastGenCostRef.cost;
                    costTail = `正文 $${x.toFixed(2)}，摘要经历 $${sgCost.toFixed(2)}，共 $${(x + sgCost).toFixed(2)}`;
                    lastGenCostRef = null;
                }
                toast('✅ ' + costTail);
            }
            pushLog('✅ 摘要与经历生成完成' + (summaryText ? '（含摘要）' : '（未提取到摘要段）') + '，成长 ' + growthParsed.length + ' 条' + (sgCost ? '，消费 $' + sgCost.toFixed(2) + ' USD' : ''));
        } catch(e) {
            if(e.name === 'AbortError') { toast('摘要与经历生成已取消（超时或被停止），可稍后手动重新生成'); pushLog('❌ 摘要与经历生成已取消（超时或被停止）'); } // v8.5.3-P2-2：区分主动停止语义
            else { toast('摘要与经历生成失败：' + e.message); pushLog('❌ 摘要与经历生成失败：' + e.message); }
        } finally {
            clearTimeout(timeout);
            currentSummaryController = null; // v8.5.3-P2-2
            summaryGenerating = false;
            const stopBtn3 = $('stopGenBtn'); if(stopBtn3 && !multiChapRunning) stopBtn3.disabled = true; // v8.5.3-P3：摘要完成恢复停止按钮禁用（连发期间保持可用供整轮停止）
            if(!manual) {
                summaryGrowthPending = false;
                // v8.6-P2-2：会话已变（停止后新任务启动）则跳过全局锁清理——防旧摘要 finally 误清新任务锁（防御性加固）
                if(!multiChapRunning && generationSessionId === sgSession) {
                    isGenerating = false;
                    setWritingLockTip('');
                    setWritingLock(false);
                }
            }
        }
    }
    function pickPrimaryAlias(name) {
        const src = String(name || '').trim();
        if(!src) return src;
        const isDesc = t => /设定$/.test(t);
        const bi = src.match(/【([^】]*)】/);
        if(bi && bi[1] && bi[1].trim() && !isDesc(bi[1].trim())) return bi[1].trim();
        const pm = src.match(/[（(]([^（）()]{1,8})[）)]/);
        if(pm && pm[1] && pm[1].trim() && !isDesc(pm[1].trim())) return pm[1].trim();
        const noBrackets = src.replace(/【[^】]*】/g, '').replace(/[（(][^（）()]*[）)]/g, '').trim();
        if(noBrackets) return noBrackets;
        return src;
    }
    function chineseChapterNo(raw) { const map={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,百:100,千:1000,万:10000}; const t=String(raw||''); if(!t) return 0; if(t==='十') return 10; let total=0, section=0; for(const ch of t){ const n=map[ch]; if(n===10||n===100||n===1000||n===10000){ if(section===0) section=1; total += section*n; section=0; } else if(n) section=n; } return total+section; }
    function parseGrowthText(raw, book) {
        const entries = [];
        const lines = String(raw || '').split(/\n+/).map(l => l.trim()).filter(l => l);
        if(!lines.length) return entries;
        // v7.1：角色表预构建别名集（全名→候选别名），匹配文中称呼
        const charList = (book.characters || []).map(c => ({ id: c.id, aliases: buildCharAliases(c && c.name) })).filter(x => x.aliases.length);
        lines.forEach(line => {
            let targetChap = null;
            const cm = line.match(/第\s*(\d+)\s*章/) || line.match(/第([一二三四五六七八九十百千万]+)章/);
            if(cm) {
                const cn = cm[1]; const n = /^\d+$/.test(cn) ? parseInt(cn) : chineseChapterNo(cn);
                const chaps = (book.chapters || []).filter(c => !c.isInterlude);
                targetChap = chaps[n - 1] || null;
            }
            let cleanLine = line.replace(/第\s*\d+\s*章[：:]?\s*/, ''); cleanLine = cleanLine.replace(/^\s*(?:\d+[.、．,，:：]\s*|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*)+/, '');
            // 别名匹配：行首（+——/：/-）用全部别名；includes 仅用于 ≥2 字别名防单字误伤
            let hit = null;
            for(const ci of charList) {
                for(const al of ci.aliases) {
                    if(cleanLine.startsWith(al + '——') || cleanLine.startsWith(al + '：') || cleanLine.startsWith(al + '-')) { hit = { id: ci.id, name: al }; break; }
                }
                if(hit) break;
            }
            if(!hit) {
                for(const ci of charList) {
                    for(const al of ci.aliases) {
                        if(al.length >= 2 && cleanLine.includes(al)) { hit = { id: ci.id, name: al }; break; }
                    }
                    if(hit) break;
                }
            }
            if(!hit) return;
            const text = cleanLine.replace(/^[^——：:\-]*[——：:\-]+\s*/, '').trim();
            if(!text || text.length < 2 || text.length > 500) return;
            entries.push({ charId: hit.id, charName: hit.name, targetChapId: targetChap ? targetChap.id : null, text });
        });
        return entries;
    }
    function extractChapNo(book, chapterId) {
        const chapters = book && Array.isArray(book.chapters) ? book.chapters : [];
        const idx = chapters.findIndex(x => String(x && x.id) === String(chapterId));
        if(idx < 0) return 0;
        const c = chapters[idx];
        if(c && c.isInterlude) return 0;
        return chapters.slice(0, idx + 1).filter(x => x && !x.isInterlude).length;
    }
    function removeChapterGrowthFromAll(book, chapterId) {
        (book.characters || []).forEach(c => { if(c.growth) c.growth = c.growth.filter(g => String(g.chapterId) !== String(chapterId)); });
    }
    function applyGrowthToBook(book, chap, parsed) {
        if(!parsed || !parsed.length) return 0;
        let added = 0;
        (book.characters || []).forEach(c => {
            const name = String(c.name || '').trim();
            if(!name) return;
            const cid = String(c.id || '');
            parsed.forEach(p => {
                // v7.1：charId 优先（别名匹配已定位）；兼容旧解析/补录数据按名字匹配
                const match = p.charId ? (String(p.charId) === cid) : (p.charName === name);
                if(!match) return;
                const bindId = p.targetChapId || chap.id;
                if(!c.growth) c.growth = [];
                if(c.growth.some(g => String(g.chapterId) === String(bindId) && g.text === p.text)) return;
                c.growth.push({ chapterId: bindId, chapNo: p.targetChapId ? extractChapNo(book, p.targetChapId) : extractChapNo(book, chap.id), text: p.text });
                added++;
            });
        });
        (book.characters || []).forEach(c => { if(c.growth && c.growth.length > 30) c.growth = c.growth.slice(-30); });
        return added;
    }
    function buildGrowthText(book, precisionCharIds, maxTotal) {
        const chars = (book.characters || []).filter(c => c && c.growth && c.growth.length);
        if(!chars.length) return '';
        const selectedIds = precisionCharIds ? new Set(precisionCharIds.map(String)) : null; const selected = chars.filter(c => !selectedIds || selectedIds.has(String(c.id)));
        if(!selected.length) return '';
        // v8.4：收集后按章号全局排序；maxTotal 时只保留最近 N 条（摘要场景瘦身），⭐ 在截断后按角色重标
        let items = [];
        selected.forEach(c => {
            const gs = c.growth.slice().sort((a,b) => extractChapNo(book, a.chapterId) - extractChapNo(book, b.chapterId));
            gs.forEach(g => {
                const orderNo = extractChapNo(book, g.chapterId) || g.chapNo || 0;
                items.push({ chapNo: orderNo, charId: c.id, line: '第' + (g.chapNo || '?') + '章：' + pickPrimaryAlias(c.name) + '——' + g.text });
            });
        });
        if(!items.length) return '';
        // v8.4：仅摘要场景（maxTotal）全局按章号排序取最近 N 条；生文场景不传 maxTotal 保持 v8.3 按角色分组顺序
        if(maxTotal) {
            items.sort((a,b) => a.chapNo - b.chapNo);
            if(items.length > maxTotal) items = items.slice(-maxTotal);
        }
        const lastIdxByChar = {};
        items.forEach((it, i) => { lastIdxByChar[it.charId] = i; });
        const lines = items.map((it, i) => it.line + (lastIdxByChar[it.charId] === i ? ' ⭐当前状态' : ''));
        return '【角色成长经历（按章号排列，⭐当前状态为最新一条；生成时角色状态以⭐当前状态为准，若与角色库人设冲突以成长经历为准；用户消息中的新变化优先于一切）】\n' + lines.join('\n');
    }
