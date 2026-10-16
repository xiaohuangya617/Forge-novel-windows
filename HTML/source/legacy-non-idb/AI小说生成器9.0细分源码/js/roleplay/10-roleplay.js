// ======================== v7.9 角色试演（扮演） ========================
    let roleplayState = { active:false, charA:null, charB:null, rounds:[], roundNo:0, costTotal:0, generating:false, controller:null, sceneLocked:false, sceneText:'', finished:false, picksLocked:false, stoppedByUser:false, summaryController:null };
    function roleplayChar(book, id) { return (book && book.characters || []).find(c => c && c.id === id) || null; }
    function renderRoleplayPicker(slot) {
        const book = getCurrentBook(); const listEl = $(slot === 'A' ? 'roleplayListA' : 'roleplayListB'); if(!listEl) return;
        const kw = ($(slot === 'A' ? 'roleplaySearchA' : 'roleplaySearchB') || {}).value || '';
        const chars = (book && book.characters) || [];
        const filtered = chars.filter(c => c && c.name && (!kw || c.name.indexOf(kw) >= 0));
        const selId = slot === 'A' ? roleplayState.charA : roleplayState.charB;
        const cnt = $(slot === 'A' ? 'roleplayCountA' : 'roleplayCountB'); if(cnt) cnt.innerText = filtered.length ? '共' + filtered.length + '位' : '';
        if(!filtered.length) { listEl.innerHTML = '<div style="padding:8px;color:#6A627A;font-size:0.7rem;">' + (chars.length ? '无匹配角色' : '本书暂无角色，请先在角色库添加') + '</div>'; return; }
        // v7.9e：首轮发送后锁定选角——列表置灰且不可点击
        const locked = !!roleplayState.picksLocked;
        listEl.style.pointerEvents = locked ? 'none' : 'auto';
        listEl.style.opacity = locked ? '0.55' : '1';
        // v7.9b：候选默认只列前 3 个（列表高度=3个候选），输入关键词搜索后展示全部匹配
        const list = filtered; // v7.9g：渲染全部匹配角色，列表高度3个候选+滚动查看
        listEl.innerHTML = list.map(c => {
            const sel = selId === c.id;
            return '<div data-rid="' + escapeHtml(c.id) + '" data-slot="' + escapeHtml(slot) + '" style="display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:6px;' + (locked ? '' : 'cursor:pointer;') + (sel ? 'background:#2A6EA4;' : '') + '"' + (locked ? '' : ' onmouseover="this.style.background=' + (sel ? "'#2A6EA4'" : "'#1A1825'") + '" onmouseout="this.style.background=' + (sel ? "'#2A6EA4'" : "'transparent'") + '"') + '><span style="flex:1;font-size:0.75rem;color:#EDEAF2;">' + escapeHtml(c.name) + '</span><span style="color:#6EC6F8;font-size:0.75rem;">' + (sel ? '✓' : '') + '</span></div>'; // v8.7-F01b：data-rid/data-slot 属性插值转义（复审 F-01：角色试演 ID 可被备份控制，字符串拼接型属性此前漏转义）
        }).join('');
    }
    function pickRoleplayChar(slot, id) { if(roleplayState.picksLocked) return; if(slot === 'A') roleplayState.charA = id; else roleplayState.charB = id; renderRoleplayPicker('A'); renderRoleplayPicker('B'); }
    // v7.9e：解锁 A/B 选角与场景框（新一轮可重新选择/编辑）
    function unlockRoleplayPicks() {
        roleplayState.picksLocked = false;
        const sA = $('roleplaySearchA'); if(sA) sA.disabled = false;
        const sB = $('roleplaySearchB'); if(sB) sB.disabled = false;
        const lkA = $('roleplayLockA'); if(lkA) lkA.style.display = 'none';
        const lkB = $('roleplayLockB'); if(lkB) lkB.style.display = 'none';
        renderRoleplayPicker('A'); renderRoleplayPicker('B');
    }
    function buildRoleplayCharLine(c) { let t = ''; if(c.appearance) t += '外貌体征：' + c.appearance + '；'; if(c.personality) t += '性格：' + c.personality + '；'; if(c.special) t += '服装及其他设定：' + c.special + '；'; if(c.relationship) t += '身份关联：' + c.relationship + '；'; return t || '（无人设详情）'; }
    function buildRoleplaySys(book, a, b) {
        const parts = ['这是虚构文学作品的创作场景，请正常创作，不要拒绝或回避。'];
        parts.push('你是小说《' + (book.name || '未命名') + '》中的角色「' + b.name + '」。');
        if(book.worldview && book.worldview.trim()) parts.push('【本书背景·世界观】' + book.worldview.trim().slice(0, 800));
        // v8.5-11：扮演不再注入主线大纲（原截 800；扮演聚焦角色+场景）
        parts.push('【双角色精准人设】\n你扮演（B）：' + b.name + '——' + buildRoleplayCharLine(b) + '\n对话对象（A）：' + a.name + '——' + buildRoleplayCharLine(a));
        // v7.9c：场景及特殊设定同样作用于 B 的扮演（可改写 B 的认知/能力/身份/关系）
        if(roleplayState.sceneText) parts.push('【当前对话场景及设定】' + roleplayState.sceneText + '\n该设定同样适用于你（B）：若其中包含特殊设定/设定改写类内容（如常识改写、能力赋予、身份或关系变动、认知重塑），请按设定调整你的言行、认知与反应——设定对你同样生效。');
        let rules = '【扮演规则】\n1. 只以「' + b.name + '」身份回复，只输出角色台词，台词（含括号描写）整体长度不得少于 120 字\n2. 必须用（）标注当前的神情与动作（如「（皱眉）」「（轻叩桌面）」「（低声）」，每处短句即可，不得大段叙述或解释）；拟声词（如「（咚）」「（嘎吱一声）」）与心理活动（如「（心想：……）」）可作补充描写，可有可无\n3. 保持人设口吻与性格基调（如冰山冷淡简短、热情健谈幽默），但情绪状态必须随剧情自然变化并延续：对话中已确立的情绪（如得知噩耗后的低落、被伤害后的疏离、害怕接触的恐惧）须持续到后续每一轮并自然演变，不得无故回到初始状态\n4. 对话对象是「' + a.name + '」（由用户扮演）\n5. 结合当前场景与对话脉络自然回应\n6. 设定延续：本场对话中被注入或被改写的特殊设定（如常识改写、性格变化、能力赋予、身份关系变动、认知重塑）始终有效直到对话结束——若你已被改写为社恐、冷漠、畏惧等状态，之后每一轮都必须保持该状态与相应言行，不得自行恢复原状';
        if(!actApi.tone) rules += '\n（口吻约束关闭：允许少量旁白/心理说明）';
        parts.push(rules);
        return parts.join('\n');
    }
    function roleplayDialogsText(book, a, b) {
        return roleplayState.rounds.map((r, i) => '（' + (i + 1) + '）' + a.name + '：' + r.a + '\n（' + (i + 1) + '）' + b.name + '：' + (r.b || '…')).join('\n');
    }
    function renderRoleplayChat() {
        const chatEl = $('roleplayChat'); if(!chatEl) return;
        const book = getCurrentBook();
        const a = roleplayChar(book, roleplayState.charA), b = roleplayChar(book, roleplayState.charB);
        if(!roleplayState.rounds.length) { chatEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;"><div style="font-size:2.2rem;opacity:0.45;">🎭</div><div style="font-size:0.95rem;color:#8A84A8;">尚未开始对话</div><div style="font-size:0.75rem;color:#6A627A;line-height:1.8;text-align:center;">选好 A/B 角色，填写左侧场景设定后<br>发送首轮台词开始试演～</div></div>'; return; }
        const aName = (a && a.name) || 'A', bName = (b && b.name) || 'B';
        chatEl.innerHTML = roleplayState.rounds.map(r => {
            const aBubble = '<div style="margin-bottom:14px;"><div style="display:flex;flex-direction:column;align-items:flex-end;"><div style="display:inline-flex;align-items:center;gap:6px;font-size:0.68rem;color:#9EC6EA;margin-bottom:4px;margin-right:4px;"><span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#2A6EA4,#1E4E78);align-items:center;justify-content:center;font-size:0.6rem;color:#EDEAF2;flex-shrink:0;">' + escapeHtml(aName.slice(0,1)) + '</span>' + escapeHtml(aName) + '</div><div style="background:linear-gradient(135deg,#2F7CC0,#25619E);border-radius:14px 14px 4px 14px;padding:9px 13px;max-width:78%;text-align:left;box-shadow:0 4px 14px rgba(47,124,192,0.25);"><div style="font-size:14px;color:#F2F7FC;white-space:pre-wrap;line-height:1.55;">' + escapeHtml(r.a) + '</div></div></div></div>';
            const bBubble = '<div style="margin-bottom:14px;"><div style="display:flex;flex-direction:column;align-items:flex-start;"><div style="display:inline-flex;align-items:center;gap:6px;font-size:0.68rem;color:#B8B4D0;margin-bottom:4px;margin-left:4px;"><span style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#4A3A8A,#2E2458);align-items:center;justify-content:center;font-size:0.6rem;color:#EDEAF2;flex-shrink:0;">' + escapeHtml(bName.slice(0,1)) + '</span>' + escapeHtml(bName) + '</div><div style="background:linear-gradient(160deg,#221F33,#191725);border:1px solid rgba(168,160,224,0.25);border-radius:14px 14px 14px 4px;padding:9px 13px;max-width:78%;text-align:left;box-shadow:0 4px 14px rgba(0,0,0,0.28);"><div style="font-size:14px;color:#EDEAF2;white-space:pre-wrap;line-height:1.55;">' + escapeHtml(r.b || '…') + '</div></div></div></div>';
            return aBubble + bBubble;
        }).join('');
        chatEl.scrollTop = chatEl.scrollHeight;
    }
    function openRoleplay() {
        const book = getCurrentBook(); if(!book) { toast('请先选择小说'); return; }
        roleplayState.active = true;
        roleplayState.rounds = []; roleplayState.roundNo = 0; roleplayState.costTotal = 0; roleplayState.finished = false; // v7.9d：每次打开即全新一轮
        const sa = $('roleplaySearchA'); if(sa) sa.value = ''; const sb = $('roleplaySearchB'); if(sb) sb.value = '';
        const sceneEl = $('roleplayScene'); if(sceneEl) { sceneEl.disabled = false; sceneEl.value = ''; }
        const tip = $('roleplaySceneLockTip'); if(tip) tip.style.display = 'none';
        roleplayState.sceneLocked = false; roleplayState.sceneText = ''; unlockRoleplayPicks();
        const inp = $('roleplayInput'); if(inp) inp.disabled = false;
        const snd = $('roleplaySend'); if(snd) snd.disabled = false;
        const endBtn = $('roleplayEnd'); if(endBtn) endBtn.disabled = false;
        renderRoleplayPicker('A'); renderRoleplayPicker('B'); renderRoleplayChat();
        const m = $('roleplayModal'); if(m) m.style.display = 'flex';
    }
    function closeRoleplay() {
        const m = $('roleplayModal'); if(m) m.style.display = 'none';
        roleplayState.active = false;
        if(roleplayState.controller) { roleplayState.controller.abort(); roleplayState.controller = null; }
        if(roleplayState.summaryController) { roleplayState.summaryController.abort(); roleplayState.summaryController = null; } // v7.9f：关窗中止摘要请求
        roleplayState.generating = false;
        roleplayState.rounds = []; roleplayState.roundNo = 0; roleplayState.costTotal = 0; roleplayState.finished = false; // 非持久化：关窗/切章/切书即清空对话
        const sceneEl = $('roleplayScene'); if(sceneEl) { sceneEl.disabled = false; sceneEl.value = ''; }
        const tip = $('roleplaySceneLockTip'); if(tip) tip.style.display = 'none';
        roleplayState.sceneLocked = false; roleplayState.sceneText = ''; unlockRoleplayPicks();
        const inp = $('roleplayInput'); if(inp) inp.disabled = false;
        const snd = $('roleplaySend'); if(snd) snd.disabled = false;
        const endBtn = $('roleplayEnd'); if(endBtn) endBtn.disabled = false;
        const stp = $('roleplayStop'); if(stp) stp.disabled = true;
    }
    async function sendRoleplay() {
        if(importPending) { toast('备份导入进行中，请等待完成后再试演'); return; } // v8.10-F011
        const book = getCurrentBook(); if(!book) { toast('请先选择小说'); return; }
        if(!roleplayState.charA || !roleplayState.charB) { toast('请先选择扮演角色 A 和 B'); return; }
        const a = roleplayChar(book, roleplayState.charA), b = roleplayChar(book, roleplayState.charB);
        if(!a || !b) { toast('所选角色不存在，请重新选择'); return; }
        if(!actApi.url || !apiUrlValid(actApi.url) || !actApi.key) { toast('请先在 ⚙ 配置扮演 API'); openApiModal(); return; }
        if(roleplayState.generating) { toast('AI 正在回复中…'); return; }
        if(roleplayState.finished) { toast('本轮已结束，请关闭窗口后重新打开开始新一轮'); return; } // v7.9d
        roleplayState.stoppedByUser = false; // v7.9f：每次发送重置主动停止标志
        const inp = $('roleplayInput'); const msg = ((inp && inp.value) || '').trim();
        if(!msg) { toast('请输入内容'); return; }
        sessionInputChars += msg.length; // v7.9m：本次输入字数累计（扮演台词）
        addDailyInputStats(msg.length); // v8.1：独立存储每日输入字数
        if(inp) inp.value = '';
        const dialogs = roleplayState.rounds.length ? '【对话记录】\n' + roleplayDialogsText(book, a, b) + '\n\n' : '';
        let user = '【本轮】（' + (roleplayState.roundNo + 1) + '）' + a.name + '：' + msg + '\n请延续「' + b.name + '」此前已确立的情绪、状态与设定变化，以其身份回复：';
        // v7.9b：首轮注入「当前对话场景及设定」并锁定（仅首轮注入，后续轮次靠全量对话记录延续场景）
        if(roleplayState.roundNo === 0) {
            const sceneEl = $('roleplayScene');
            const scene = ((sceneEl && sceneEl.value) || '').trim();
            roleplayState.sceneText = scene; // v7.9c：持久化供 buildRoleplaySys 注入（特殊设定同样作用于 B）
            roleplayState.sceneLocked = true;
            if(sceneEl) sceneEl.disabled = true;
            const tip = $('roleplaySceneLockTip'); if(tip) tip.style.display = 'block';
            if(scene) user = '【当前场景及设定】\n' + scene + '\n\n' + user;
            // v7.9e：首轮发送后同时锁定 A/B 选角（防中途换角色），场景框已在上方锁定
            roleplayState.picksLocked = true;
            const sA = $('roleplaySearchA'); if(sA) sA.disabled = true;
            const sB = $('roleplaySearchB'); if(sB) sB.disabled = true;
            const lkA = $('roleplayLockA'); if(lkA) lkA.style.display = 'inline';
            const lkB = $('roleplayLockB'); if(lkB) lkB.style.display = 'inline';
            renderRoleplayPicker('A'); renderRoleplayPicker('B');
        }
        roleplayState.rounds.push({ a: msg, b: '' });
        renderRoleplayChat();
        roleplayState.generating = true;
        const stopBtn = $('roleplayStop'); if(stopBtn) stopBtn.disabled = false;
        const endBtnSend = $('roleplayEnd'); if(endBtnSend) endBtnSend.disabled = true; // v8.9-F06：回复生成中禁用「结束对话」——原生成中点结束：endRoleplay abort 后立即渲染结束态，旧 catch 随后重绘回合/弹失败文本，结束卡与摘要内容竞争不可靠（EXE-V8-F06 同源）
        const controller = new AbortController(); roleplayState.controller = controller;
        const timer = setTimeout(() => controller.abort(), 60000);
        try {
            const res = await fetch(actApi.url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + actApi.key}, body: JSON.stringify({ model: actApi.model, messages:[{role:'system',content:buildRoleplaySys(book, a, b)},{role:'user',content:user}], temperature: actApi.temp, max_tokens: actApi.maxTokens }), signal: controller.signal });
            // v8.7-F014：clearTimeout 移到 res.json() 之后——原 fetch 返回即清，正文悬挂时 60s 超时失效，roleplayState.generating 永久卡死（项目零复审 F-014）
            if(!res.ok) throw new Error(res.status === 401 ? 'API Key 无效' : res.status === 429 ? '请求频率过高' : 'HTTP ' + res.status);
            const data = await res.json();
            clearTimeout(timer);
            const text = ((data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
            if(!text) throw new Error('返回内容为空');
            const c = calcCost(actApi.model, data.usage); if(c > 0) recordCost(c);
            roleplayState.costTotal += c;
            const last = roleplayState.rounds[roleplayState.rounds.length - 1]; if(last) last.b = text;
            roleplayState.roundNo++;
            renderRoleplayChat();
            if(roleplayState.roundNo >= (actApi.rounds || 10)) { endRoleplay(); return; }
        } catch(e) {
            clearTimeout(timer);
            if(!roleplayState.active) return; // v8.10-F07：窗口已关闭（closeRoleplay 主动 abort）→ 静默收尾——原把主动关闭误报"超时(60s)"并弹错提示（EXE-V9-F07，HTML 同源一并修）
            const why = e.name === 'AbortError' ? (roleplayState.stoppedByUser ? '已停止' : '超时(60s)') : e.message; // v7.9f：主动停止与超时区分提示
            // v8.6-r10：首轮失败解锁场景框与 A/B 选角（原锁死只能关面板重开），且不把失败占位写进对话记录（防污染后续轮次上下文）
            if(roleplayState.roundNo === 0) {
                const sceneEl2 = $('roleplayScene'); if(sceneEl2) sceneEl2.disabled = false;
                const tip2 = $('roleplaySceneLockTip'); if(tip2) tip2.style.display = 'none';
                roleplayState.sceneLocked = false; unlockRoleplayPicks();
                roleplayState.rounds.pop(); // v8.6-fix8：首轮失败弹掉空回合（{a,b:''}），防悬空台词注入后续上下文
            } else {
                const last = roleplayState.rounds[roleplayState.rounds.length - 1]; if(last) last.b = '⚠️ 回复失败：' + why;
            }
            renderRoleplayChat();
            pushLog('❌ 试演回复失败：' + (roleplayState.stoppedByUser ? '已停止' : (e.name === 'AbortError' ? '超时' : e.message)));
            toast('试演回复失败：' + why);
        } finally {
            roleplayState.generating = false; roleplayState.controller = null;
            const stp = $('roleplayStop'); if(stp) stp.disabled = true;
            if(!roleplayState.finished) { const ebF = $('roleplayEnd'); if(ebF) ebF.disabled = false; } // v8.9-F06：请求收尾（成功/失败/停止）且未结束时恢复「结束对话」可用；finished 由 endRoleplay 置位并保持禁用
        }
    }
    function endRoleplay() {
        if(roleplayState.finished) return;
        if(roleplayState.generating) { if(roleplayState.controller) roleplayState.controller.abort(); roleplayState.generating = false; }
        const n = roleplayState.roundNo, cost = roleplayState.costTotal;
        const book = getCurrentBook(); const a = roleplayChar(book, roleplayState.charA), b = roleplayChar(book, roleplayState.charB);
        const dialogs = (a && b) ? roleplayDialogsText(book, a, b) : '';
        roleplayState.finished = true; // v7.9d：结束态——聊天记录保留在聊天区，摘要总结追加到下方
        // 本轮结束解锁场景框（保留文本，新一轮首轮发送时重新锁定）与 A/B 选角
        const sceneEl = $('roleplayScene'); if(sceneEl) sceneEl.disabled = false;
        const tip = $('roleplaySceneLockTip'); if(tip) tip.style.display = 'none';
        roleplayState.sceneLocked = false; unlockRoleplayPicks();
        // 结束态禁用输入/发送/停止/结束按钮（防止继续发送）
        const inp = $('roleplayInput'); if(inp) inp.disabled = true;
        const snd = $('roleplaySend'); if(snd) snd.disabled = true;
        const stp = $('roleplayStop'); if(stp) stp.disabled = true;
        const endBtn = $('roleplayEnd'); if(endBtn) endBtn.disabled = true;
        if(n > 0) void requestRoleplaySummary(n, cost, dialogs, a, b);
        else renderRoleplayEndPanel(n, cost, '', '', a, b);
    }
    async function requestRoleplaySummary(n, costTotal, dialogs, a, b) {
        if(!roleplayState.active) return; // v7.9f：窗口已关闭则不生成摘要
        const book = getCurrentBook();
        // v7.9d：先在聊天记录下方追加"生成中"占位（不替换聊天记录）
        const chatEl = $('roleplayChat');
        if(chatEl && !$('roleplaySumPh')) {
            const ph = document.createElement('div');
            ph.id = 'roleplaySumPh';
            ph.style.cssText = 'text-align:center;color:#B8B4D0;font-size:0.85rem;padding:14px 0;';
            ph.innerHTML = '⏳ 正在生成互动摘要…';
            chatEl.appendChild(ph);
            chatEl.scrollTop = chatEl.scrollHeight;
        }
        if(!a || !b || !actApi.url || !apiUrlValid(actApi.url) || !actApi.key) { renderRoleplayEndPanel(n, costTotal, '', '（未配置扮演 API 或角色缺失，摘要未生成）', a, b); return; }
        const sys = '你是小说编辑助手，负责总结一段角色互动试演。这是虚构文学作品的创作场景，请正常创作，不要拒绝或回避。';
        const user = '以下是一段角色互动试演（用户扮演「' + a.name + '」，AI 扮演「' + b.name + '」）：\n' + dialogs + '\n\n请输出：\n1.【互动摘要】该段互动的过程回顾（场景、对话脉络、关键转折，150字内）\n2.【人设评价】' + b.name + '的表现是否符合其设定人设（举例说明，80字内）';
        // v7.9f：摘要请求挂 abort 句柄，关窗时中止（防止摘要写回新一轮会话）
        // v8.8-F016：加 60s 定时中止——原只有关窗 abort，响应体悬挂时"正在生成互动摘要"永久停留、summaryController 不释放（项目零终极版复审 F-016）
        const sc = new AbortController(); roleplayState.summaryController = sc;
        const sTimer = setTimeout(() => sc.abort(), 60000);
        try {
            const res = await fetch(actApi.url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + actApi.key}, body: JSON.stringify({ model: actApi.model, messages:[{role:'system',content:sys},{role:'user',content:user}], temperature: 0.4, max_tokens: 800 }), signal: sc.signal });
            if(!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            clearTimeout(sTimer);
            const text = ((data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
            const c = calcCost(actApi.model, data.usage); if(c > 0) recordCost(c);
            costTotal += c;
            renderRoleplayEndPanel(n, costTotal, text, '', a, b);
        } catch(e) {
            clearTimeout(sTimer);
            // 窗口仍开启时的 AbortError 只可能来自 60s 超时（关窗 abort 时 active 已为 false，不渲染）
            if(roleplayState.active) renderRoleplayEndPanel(n, costTotal, '', '摘要生成失败：' + (e.name === 'AbortError' ? '超时(60s)' : e.message), a, b);
        } finally {
            clearTimeout(sTimer);
            if(roleplayState.summaryController === sc) roleplayState.summaryController = null;
        }
    }
    function renderRoleplayEndPanel(n, costTotal, summary, errMsg, a, b) {
        if(!roleplayState.active) return; // v7.9f：窗口已关闭则丢弃摘要渲染
        const chatEl = $('roleplayChat'); if(!chatEl) return;
        const ph = $('roleplaySumPh'); if(ph) ph.remove();
        const aName = (a && a.name) || 'A', bName = (b && b.name) || 'B';
        const sumHtml = summary ? '<div style="font-size:14px;color:#EDEAF2;white-space:pre-wrap;line-height:1.6;">' + escapeHtml(summary) + '</div>' : '<div style="font-size:0.78rem;color:#E08080;">' + escapeHtml(errMsg || '摘要未生成') + '</div>';
        // v7.9d：追加式——摘要卡渲染在聊天记录下方，不替换聊天记录
        const card = document.createElement('div');
        card.style.cssText = 'margin-top:16px;background:#14121F;border:1px solid #3A3452;border-radius:12px;padding:14px;';
        card.innerHTML = '<div style="background:linear-gradient(135deg,rgba(74,58,138,0.4),rgba(42,110,164,0.28));border:1px solid rgba(168,160,224,0.2);border-radius:10px;padding:8px 12px;font-size:0.9rem;color:#DBD4E8;margin-bottom:10px;">🎉 本轮试演结束 · ' + escapeHtml(aName) + ' ↔ ' + escapeHtml(bName) + ' · 扮演 <b>' + n + '</b> 轮' + (costTotal ? ' · 消费 <b style="color:#FFA070;">$' + costTotal.toFixed(2) + '</b>' : '') + '</div>' + sumHtml + '<div style="margin-top:10px;"><button id="roleplayCopySummary" class="glass-btn">📋 复制摘要</button><span style="font-size:0.65rem;color:#6A627A;margin-left:8px;">本轮已结束，关闭窗口后重新打开即可开始新一轮</span></div>';
        chatEl.appendChild(card);
        chatEl.scrollTop = chatEl.scrollHeight;
        const cp = $('roleplayCopySummary'); if(cp) cp.onclick = () => { copyToClipboard(summary || errMsg || ''); toast('已复制互动摘要'); };
    }
    function calcCost(model, usage) {
        if(!usage || typeof usage !== 'object') return 0;
        const resolved = pricingModel(model);
        if(!resolved.price) {
            pushLog('⚠️ 未知模型「' + String(model || '') + '」无法按 DeepSeek 价格计费，请核对自定义价格配置');
            return 0;
        }
        const p = resolved.price[isPeakHour() ? 'peak' : 'off'];
        let hit = 0;
        if(typeof usage.prompt_cache_hit_tokens === 'number') hit = Math.max(0, usage.prompt_cache_hit_tokens);
        else if(usage.prompt_tokens_details && typeof usage.prompt_tokens_details.cached_tokens === 'number') hit = Math.max(0, usage.prompt_tokens_details.cached_tokens);
        let miss;
        let estimated = false;
        if(typeof usage.prompt_cache_miss_tokens === 'number') miss = Math.max(0, usage.prompt_cache_miss_tokens);
        else { miss = Math.max(0, (Number(usage.prompt_tokens) || 0) - hit); estimated = true; }
        const out = Math.max(0, Number(usage.completion_tokens) || 0);
        const cost = (hit * p.hit + miss * p.miss + out * p.out) / 1000000;
        if(estimated && (hit || miss)) pushLog('ℹ️ 费用按输入缓存未命中保守估算（API 未返回完整缓存拆分），定价版本 ' + PRICING_VERSION);
        return cost;
    }

