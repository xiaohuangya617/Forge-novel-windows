// ======================== API 配置 ========================
    // v6.3：API URL 合法性校验（http/https 开头）——所有 fetch 前置拦截，防脏值触发 file:// 同源报错
    function apiUrlValid(u) { /*
        v8.7-F09：远程端点强制 HTTPS——原先 /^https?:\/\//i 同时放行 http://，Bearer Key 与小说正文可在局域网/代理/被劫持节点明文传输。
        现仅本机（localhost/127.0.0.1/[::1]）放行 HTTP（本机开发例外），其余必须 HTTPS。
        v8.8-F015/16：HTTPS/HTTP 统一先 new URL 完整解析——原 HTTPS 分支只测前缀即返回 true，
        'https://'、'https:///path' 等无主机值被当合法（保存成功但 fetch 解析失败，项目零终极版复审 F-015/F-016、EXE-V7-F04）。
        v8.9-F10：拒绝内嵌凭据（user:pass@）——Fetch/Request 对含 userinfo 的 URL 抛 TypeError，保存成功必调用失败（EXE 复审 EXE-V8-F10，HTML 同源一并修）。 */
        let s = String(u || '').trim();
        if (!/^https?:\/\//i.test(s)) return false;
        try {
            const url = new URL(s);
            const host = url.hostname;
            if (!host) return false;
            if (url.username || url.password) return false;
            if (url.protocol === 'https:') return true;
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;
        } catch(e) { return false; }
        return false;
    }
    // v6.5：从失败的 API 响应中提取后端错误信息（HTTP 状态 + 具体原因），替代只显示状态码（res.body 只能消费一次，用 clone 读取）
    async function extractApiError(res) {
        let detail = '';
        try { const d = await res.clone().json(); detail = (d && (d.error?.message || d.message)) || JSON.stringify(d); }
        catch(e) { try { detail = await res.clone().text(); } catch(e2) {} }
        return 'HTTP ' + res.status + (detail ? '：' + String(detail).slice(0, 200) : '');
    }
    // v7.9 参数按步长四舍五入吸附（1.28 → 1.3；十进制字符串算法保证数学正确，避免浮点误差）
    function snapDecimal(v, digits) {
        let s = String(v);
        if(!/^-?\d+(\.\d+)?$/.test(s)) return Number(v.toFixed(digits));
        const neg = s[0] === '-'; if(neg) s = s.slice(1);
        let [int, frac] = s.split('.'); frac = frac || '';
        if(frac.length <= digits) return v;
        let keep = frac.slice(0, digits);
        if(frac[digits] >= '5') {
            const arr = keep.split('');
            let carry = 1;
            for(let i = arr.length - 1; i >= 0 && carry; i--) {
                if(arr[i] === '9') arr[i] = '0';
                else { arr[i] = String(Number(arr[i]) + 1); carry = 0; }
            }
            keep = arr.join('');
            if(carry) int = String(parseInt(int, 10) + 1);
        }
        return parseFloat((neg ? '-' : '') + int + (keep.length ? '.' + keep : ''));
    }
    function snapToStep(v, step) {
        if(!Number.isFinite(v)) return v;
        if(step === 0.05) return Math.round(v * 20) / 20;
        if(step === 1) return Math.round(v);
        const digits = Math.round(-Math.log10(step));
        return snapDecimal(v, digits);
    }
    // v7.9 按步长决定显示小数位（0.1→1位、0.01/0.05→2位、整数→0位），用于输入框固定精度显示（输入 1 → 显示 1.0）
    function stepDigits(step) {
        if(step >= 1) return 0;
        if(step === 0.05) return 2;
        return Math.round(-Math.log10(step));
    }
    function formatStep(v, step) {
        return Number.isFinite(v) ? v.toFixed(stepDigits(step)) : v;
    }
    // v8.6-⑤：审稿参数模式面板联动——开启后显示参数网格、推理强度变灰（两模式互斥）
    function updatePolishParamUI() {
        const ppc = $('polishParamCheck'); const pg = $('polishParamGrid'); const pr = $('polishReasoningRange');
        const on = !!(ppc && ppc.checked);
        if(pg) pg.style.display = on ? '' : 'none';
        if(pr) pr.disabled = on;
    }
    function loadApi() {
        try {
            let saved = localStorage.getItem('api_config_v3');
            if(saved) {
                const cfg = JSON.parse(saved);
                if(cfg && typeof cfg === 'object') {
                    if(cfg.main) Object.assign(api, cfg.main);
                    if(cfg.polish) Object.assign(polishApi, cfg.polish);
                    if(cfg.image) Object.assign(imageApiCfg, cfg.image);
                    if(cfg.act) Object.assign(actApi, cfg.act); // v7.9 扮演 API
                }
            } else {
                // v7.1 兼容迁移：老 v2 备份自动迁移为 main 配置
                let saved2 = localStorage.getItem('api_config_v2');
                if(saved2) Object.assign(api, JSON.parse(saved2));
            }
        } catch(e) { console.warn("API配置解析失败，已重置", e); }
        // url 兜底（v8.8-F015：载入契约与保存/调用统一——空值/历史远程 HTTP/错型 HTTPS 均回默认，并清空原 Key 防错投到 DeepSeek 默认端点；v6.3 旧正则放行远程 http 会"显示已保存、调用被拒"，项目零终极版复审 F-015）
        if(!api.url || !apiUrlValid(api.url)) { if(api.key) { api.key = ''; toast('⚠️ 检测到 API 地址不符合安全规则（远程须 HTTPS），已重置为 DeepSeek 默认并清空 Key，请重新配置'); } api.url = 'https://api.deepseek.com/chat/completions'; }
        if(typeof api.model !== 'string' || !api.model.trim()) api.model = 'deepseek-flash';
        const pricingHint = $('pricingHint'); if(pricingHint) { const pm = pricingModel(api.model); pricingHint.textContent = pm.price ? ('已识别 ' + (pm.price.label || api.model) + '：官方 USD / 1M token，峰时按官方 UTC 规则计费，法定节假日按非峰时') : '未知模型：不会静默套用价格，请核对模型名或自定义端点账单'; } // v8.7 EXE-87-R3-F02：typeof 前置——错型配置（数字/布尔/对象/数组）不再 .trim 抛错中断 loadApi/init，统一恢复默认
        if(api.top_p===undefined) api.top_p=0.92;
        if(api.repetition_penalty===undefined) api.repetition_penalty=1.15;
        if(api.stopWords===undefined) api.stopWords='';
        if(api.thinking===undefined) api.thinking=false;
        if(!api.reasoningEffort) api.reasoningEffort='high';
        if(api.notify===undefined) api.notify=false;
        if(api.dualMode===undefined) api.dualMode=false;
        if(api.multiChap===undefined) api.multiChap=false; // v8.0.34 连发多章
        if(!api.multiChapCount) api.multiChapCount=3; // v8.0.34 连发章数默认 3
        if(api.branchAutoSend===undefined) api.branchAutoSend=false; // v7.2 走向自动发送
        if(api.rewriteAutoSend===undefined) api.rewriteAutoSend=false; // v7.2 重写自动发送
        // 数值范围兜底（防异常备份/旧配置越界）
        // v7.9 数值范围兜底（新规格：温度0.1~2.0默认1.0 / Top-p 0.75~1.25默认0.92 / 重复1~1.25默认1.15 / 频率0~1默认0.4 / 存在0~1.5默认0.5）
        if(!Number.isFinite(api.temp) || api.temp<0.1 || api.temp>2) api.temp=1.0;
        if(!Number.isFinite(api.top_p) || api.top_p<0.75 || api.top_p>1.25) api.top_p=0.92;
        if(!Number.isFinite(api.repetition_penalty) || api.repetition_penalty<1 || api.repetition_penalty>1.25) api.repetition_penalty=1.15;
        if(!Number.isInteger(api.maxTokens) || api.maxTokens<3000 || api.maxTokens>90000) api.maxTokens=60000;
        if(!Number.isFinite(api.freqPenalty) || api.freqPenalty<0 || api.freqPenalty>1) api.freqPenalty=0.4;
        if(!Number.isFinite(api.presPenalty) || api.presPenalty<0 || api.presPenalty>1.5) api.presPenalty=0.5;
        if(!Number.isInteger(api.ctxChapters) || api.ctxChapters<1 || api.ctxChapters>50) api.ctxChapters=5;
        // v7.9 读取后按步长吸附（旧存档/异常值对齐到 0.1/0.01/0.05 网格）
        api.temp = snapToStep(api.temp, 0.1);
        api.top_p = snapToStep(api.top_p, 0.01);
        api.repetition_penalty = snapToStep(api.repetition_penalty, 0.05);
        api.freqPenalty = snapToStep(api.freqPenalty, 0.1);
        api.presPenalty = snapToStep(api.presPenalty, 0.1);
        const elMap = { apiUrlInp: api.url, apiKeyInp: api.key, modelInp: api.model, stopWordsInp: api.stopWords, // v8.6-fix18：停止词回填
            tempRange: api.temp, topPRange: api.top_p,
            repPenaltyRange: api.repetition_penalty,
            maxTokensInp: api.maxTokens, freqRange: api.freqPenalty,
            presRange: api.presPenalty, ctxRange: api.ctxChapters };
        // v7.9 浮点参数按步长显示固定小数位（温度/存在/频率 1 位，Top-p/重复 2 位）
        const fmtStep = { tempRange: 0.1, topPRange: 0.01, repPenaltyRange: 0.05, freqRange: 0.1, presRange: 0.1 };
        for (let [id, val] of Object.entries(elMap)) {
            let el = $(id);
            if (!el) continue;
            if (el.tagName === 'SPAN') el.innerText = val;
            else if (fmtStep[id]) el.value = formatStep(val, fmtStep[id]);
            else el.value = val;
        }
        // v7.3 审稿 API 兜底与控件填充（Gemini 3.x 推理模式：无温度，仅推理强度）
        if(polishApi.maxTokens===undefined || !Number.isInteger(polishApi.maxTokens) || polishApi.maxTokens<3000 || polishApi.maxTokens>90000) polishApi.maxTokens=50000;
        if(polishApi.reasoning===undefined || ['low','high','max'].indexOf(polishApi.reasoning)<0) polishApi.reasoning='max';
        if(typeof polishApi.model !== 'string' || !polishApi.model.trim()) polishApi.model='deepseek-flash'; // v7.3：模型默认值兜底（DeepSeek 审稿）；v8.7 EXE-87-R2-F02/R3-F02 收口：载入契约与正文/扮演统一——trim 判空 + typeof 前置（旧存档纯空白自愈；错型配置不再 .trim 抛错中断 init）
        if(!polishApi.url || !apiUrlValid(polishApi.url)) { if(polishApi.key) { polishApi.key=''; toast('⚠️ 审稿 API 地址不符合安全规则（远程须 HTTPS），已重置为默认并清空 Key，请重新配置'); } polishApi.url='https://api.deepseek.com/chat/completions'; } // v8.8-F015：审稿地址载入统一 apiUrlValid + Key 联动清空（原只查空，历史远程 http 直接生效）
        if(polishApi.ratio===undefined || !Number.isFinite(polishApi.ratio) || polishApi.ratio<20 || polishApi.ratio>90) polishApi.ratio=50; // v7.3：修改幅度阈值兜底 20-90%
        const reasoningRaw = { low:0, high:1, max:2 }[polishApi.reasoning];
        const reasoningIdx = reasoningRaw === undefined ? 2 : reasoningRaw;
        const reasoningLabel = ['low','high','max'][reasoningIdx];
        const polMap = { polishUrlInp: polishApi.url, polishKeyInp: polishApi.key, polishModelInp: polishApi.model,
            polishReasoningRange: reasoningIdx, polishReasoningVal: reasoningLabel, polishMaxTokensInp: polishApi.maxTokens,
            polishRatioRange: polishApi.ratio, polishRatioVal: polishApi.ratio + '%',
            polishTempRange: polishApi.temp, polishTopPRange: polishApi.topP, polishPresRange: polishApi.presPenalty, polishFreqRange: polishApi.freqPenalty, polishRepRange: polishApi.repPenalty }; // v8.6-⑤ 参数模式字段
        for (let [id, val] of Object.entries(polMap)) {
            let el = $(id);
            if (el) { if (el.tagName === 'SPAN') el.innerText = val; else el.value = val; }
        }
        const ppc = $('polishParamCheck'); if(ppc) ppc.checked = !!polishApi.paramMode; // v8.6-⑤
        updatePolishParamUI(); // v8.6-⑤ 参数模式面板联动
        const thinkingEl = $('thinkingCheck'); if(thinkingEl) thinkingEl.checked = api.thinking !== false;
        const branchAuto = $('branchAutoSendCheck'); if(branchAuto) branchAuto.checked = !!api.branchAutoSend; // v7.2
        const rewriteAuto = $('rewriteAutoSendCheck'); if(rewriteAuto) rewriteAuto.checked = !!api.rewriteAutoSend; // v7.2
        const mcc = $('multiChapCountInp'); if(mcc) mcc.value = api.multiChapCount || 3; // v8.0.34
        // v7.9 扮演 API 兜底与控件填充
        if(!actApi.url || !apiUrlValid(actApi.url)) { if(actApi.key) { actApi.key=''; toast('⚠️ 扮演 API 地址不符合安全规则（远程须 HTTPS），已重置为默认并清空 Key，请重新配置'); } actApi.url='https://api.deepseek.com/chat/completions'; } // v8.8-F015：扮演地址载入统一 apiUrlValid + Key 联动清空（原旧正则放行历史远程 http）
        if(typeof actApi.model !== 'string' || !actApi.model.trim()) actApi.model='deepseek-flash'; // v8.7 EXE-87-R3-F02：typeof 前置——错型配置（数字/布尔/对象/数组）不再 .trim 抛错中断 loadApi/init，统一恢复默认
        if(!Number.isFinite(actApi.temp) || actApi.temp<0.1 || actApi.temp>2) actApi.temp=0.7;
        if(!Number.isInteger(actApi.maxTokens) || actApi.maxTokens<500 || actApi.maxTokens>1500) actApi.maxTokens=800;
        if(!Number.isInteger(actApi.rounds) || actApi.rounds<5 || actApi.rounds>30) actApi.rounds=10;
        if(actApi.persona===undefined) actApi.persona=true;
        if(actApi.tone===undefined) actApi.tone=true;
        const actMap = { actUrlInp: actApi.url, actKeyInp: actApi.key, actModelInp: actApi.model,
            actTempRange: actApi.temp, actMaxTokensInp: actApi.maxTokens, actRoundsInp: actApi.rounds };
        for (let [id, val] of Object.entries(actMap)) {
            let el = $(id);
            if (!el) continue;
            if (el.tagName === 'SPAN') el.innerText = val;
            else if (id === 'actTempRange') el.value = formatStep(val, 0.1);
            else el.value = val;
        }
        const actPer = $('actPersonaCheck'); if(actPer) actPer.checked = actApi.persona !== false;
        const actTon = $('actToneCheck'); if(actTon) actTon.checked = actApi.tone !== false;
        const reasoningRange = $('reasoningRange'); const reasoningVal = $('reasoningVal');
        if(reasoningRange && reasoningVal) {
            const levels = ['low','high','max'];
            reasoningRange.value = levels.indexOf(api.reasoningEffort||'high');
            reasoningVal.innerText = api.reasoningEffort||'high';
            reasoningRange.disabled = !api.thinking;
        }
        const notifyBtn = $('notifyBtn'); if(notifyBtn) {
            if(api.notify) notifyBtn.classList.add('guide-highlight');
            else notifyBtn.classList.remove('guide-highlight');
        }
        updateDualModeButton();
    }

    // v7.3 审稿 API 测试（Gemini 3.x 推理模式最小请求；加 15s 超时防无响应——此前无超时，慢网络/挂起时按钮点了没反馈）
    async function testPolishConnection() {
        const u = ($('polishUrlInp')||{}).value || polishApi.url;
        const k = ($('polishKeyInp')||{}).value || polishApi.key;
        const m = ($('polishModelInp')||{}).value || polishApi.model;
        if(!u || !apiUrlValid(u)) { toast('请填写审稿 API 地址（远程须 HTTPS，HTTP 仅允许本机 localhost/127.0.0.1）'); return; } // v8.7-F09b：统一走 apiUrlValid——原只查 /^https?:\/\// 放行远程 HTTP，测试连接会把审稿 Key 明文发到未加密端点（复审 F-09 实测复现）
        if(!k) { toast('请先填写审稿 API Key'); return; }
        if(!m || !m.trim()) { toast('请先填写审稿模型名称'); return; }
        toast('正在测试审稿连接...');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(u, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${k}`},
                body: JSON.stringify({ model: m, messages:[{role:'user',content:'ping'}], max_tokens: 8 }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if(res.ok) toast('审稿连接成功 ✓（正式审查仍取决于模型兼容性）');
            else toast('审稿连接失败 (HTTP ' + res.status + ')' + (res.status === 401 ? '，检查 Key' : res.status === 404 ? '，检查地址/模型名' : ''));
        } catch(e) {
            clearTimeout(timeout);
            toast('审稿连接失败：' + (e.name === 'AbortError' ? '超时(15s)，请检查网络或地址' : e.message));
        }
    }
    // v7.3 C5 修复：删除下方重复的 testPolishConnection 定义（原 955-973 行，后定义覆盖前定义，冗余）
    async function testActConnection() {
        const draftUrl = ($('actUrlInp') || {}).value?.trim() || actApi.url;
        const draftKey = ($('actKeyInp') || {}).value?.trim() || '';
        if(!apiUrlValid(draftUrl)) { toast("扮演 API 地址无效（需以 http:// 或 https:// 开头）"); return false; }
        const draftModel = ($('actModelInp') || {}).value?.trim() || actApi.model;
        if(!draftKey) { toast("请先填写扮演 API Key"); return false; }
        toast("正在测试扮演连接...");
        // v8.9-F016：controller/timeout 提升 try 外——原 try 内 const 在 catch 不可见，异常被 ReferenceError: timeout is not defined 覆盖（v8.8 引入回归，项目零 v4 复审 F-016/EXE-V8-F07）；超时覆盖 fetch+响应体，finally 判空统一清理
        let controller = null, timeout = null;
        try {
            controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(draftUrl, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer ' + draftKey},
                body: JSON.stringify({ model: draftModel, messages:[{role:'user',content:'你好' }], max_tokens: 5, temperature: 0.7 }),
                signal: controller.signal
            });
            if(!res.ok) { toast("扮演连接失败：HTTP " + res.status); return false; }
            const data = await res.json();
            const ok = data && data.choices && data.choices[0] && data.choices[0].message;
            toast(ok ? "✅ 扮演连接成功" : "扮演连接返回格式异常");
            return !!ok;
        } catch(e) {
            toast("扮演连接失败：" + (e.name === 'AbortError' ? '超时' : e.message));
            return false;
        } finally {
            if(timeout) clearTimeout(timeout);
        }
    }
    async function testApiConnection() {
        const draftUrl = $('apiUrlInp')?.value?.trim() || api.url;
        const draftKey = $('apiKeyInp')?.value?.trim() || '';
        if(!apiUrlValid(draftUrl)) { toast("API 地址无效（需以 http:// 或 https:// 开头）"); return false; }
        const draftModel = $('modelInp')?.value?.trim() || api.model;
        if(!draftKey) { toast("请先填写 API Key"); return false; }
        toast("正在测试连接...");
        const testBody = { model: draftModel, messages: [{role:"user",content:"Hi"}], max_tokens: 5 };
        const draftThinking = $('thinkingCheck')?.checked;
        if(draftThinking) {
            const rv = $('reasoningRange')?.value;
            testBody.thinking = { type: 'enabled' };
            testBody.reasoning_effort = ['low','high','max'][parseInt(rv)] || 'high';
        }
        // v8.9-F016：controller/timeout 提升 try 外 + finally 判空清理（异常路径原残留 15s 定时器）
        let controller = null, timeout = null;
        try {
            controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(draftUrl, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${draftKey}`},
                body:JSON.stringify(testBody),
                signal: controller.signal
            });
            if(res.ok) { toast("基础连接成功 ✓（正式生成仍取决于模型与参数兼容性）"); return true; }
            if(res.status === 401) { toast("API Key 无效，请检查"); }
            else if(res.status === 429) { toast("API 请求频率过高，请稍后重试"); }
            else if(res.status === 402) { toast("API 余额不足，请充值"); }
            else { toast(`API 错误: ${res.status}`); }
            return false;
        } catch(e) {
            if(e.name === 'AbortError') { toast("连接超时，请检查网络或API地址"); }
            else { toast(`连接失败: ${e.message}`); }
            return false;
        } finally {
            if(timeout) clearTimeout(timeout);
        }
    }

    function saveApi(keepOpen, skipAutoRetry) { // v8.6-fix26：skipAutoRetry——失焦自动保存不触发挂起任务重试（防 Key 未配好误启动、401 后任务被消费丢失）
        // v8.10-F018：空地址明确拒绝——原 `输入 || 旧地址` 借旧值通过校验、提交却写输入框空串（"校验 A 提交 B"，HTML v5 复审 F-018 残余/EXE-V9-F06）；现候选值即提交值：非空才校验、校验通过原样落盘，语义一致
        const preU = {
            main:   (($('apiUrlInp')   || {}).value || '').trim(),
            polish: (($('polishUrlInp')|| {}).value || '').trim(),
            act:    (($('actUrlInp')   || {}).value || '').trim()
        };
        if(!preU.main) { toast("API 地址不能为空（远程须 HTTPS；可填写 https://api.deepseek.com/chat/completions），已取消保存（配置未改动）"); return; }
        if(!apiUrlValid(preU.main)) { toast("API 地址无效（远程须 HTTPS；HTTP 仅允许本机 localhost/127.0.0.1），已取消保存（配置未改动）"); return; }
        if(!preU.polish) { toast("审稿 API 地址不能为空，已取消保存（配置未改动）"); return; }
        if(!apiUrlValid(preU.polish)) { toast("审稿 API 地址无效（远程须 HTTPS；HTTP 仅允许本机 localhost/127.0.0.1），已取消保存（配置未改动）"); return; }
        if(!preU.act) { toast("扮演 API 地址不能为空，已取消保存（配置未改动）"); return; }
        if(!apiUrlValid(preU.act)) { toast("扮演 API 地址无效（远程须 HTTPS；HTTP 仅允许本机 localhost/127.0.0.1），已取消保存（配置未改动）"); return; }
        const elMap = { apiUrlInp: 'url', apiKeyInp: 'key', modelInp: 'model', stopWordsInp: 'stopWords', // v8.6-fix18：停止词保存
            tempRange: 'temp', topPRange: 'top_p', repPenaltyRange: 'repetition_penalty',
            maxTokensInp: 'maxTokens', freqRange: 'freqPenalty', presRange: 'presPenalty',
            ctxRange: 'ctxChapters' };
        for (let [id, key] of Object.entries(elMap)) {
            let el = $(id);
            if (el) api[key] = id.includes('Range') ? parseFloat(el.value) : (key==='ctxChapters'||key==='maxTokens' ? parseInt(el.value) : el.value);
        }
        // v7.9 保存前按各自步长吸附（输入 1.28 → 1.3；Top-p 0.01 / 重复 0.05 / 其余 0.1），并回填输入框让用户立即看到对齐结果
        api.temp = snapToStep(api.temp, 0.1);
        api.top_p = snapToStep(api.top_p, 0.01);
        api.repetition_penalty = snapToStep(api.repetition_penalty, 0.05);
        api.freqPenalty = snapToStep(api.freqPenalty, 0.1);
        api.presPenalty = snapToStep(api.presPenalty, 0.1);
        const snapBack = { tempRange: 0.1, topPRange: 0.01, repPenaltyRange: 0.05, freqRange: 0.1, presRange: 0.1 };
        const snapVals = { tempRange: api.temp, topPRange: api.top_p, repPenaltyRange: api.repetition_penalty, freqRange: api.freqPenalty, presRange: api.presPenalty };
        for (let [id, step] of Object.entries(snapBack)) { const el = $(id); if(el) el.value = formatStep(snapVals[id], step); }
        if(!api.model || !api.model.trim()) { toast("模型名称不能为空，已恢复默认"); api.model = 'deepseek-flash'; const m = $('modelInp'); if(m) m.value = api.model; }
        // v7.9 五个浮点参数校验（与 UI 规格一致；非法输入明确提示并回默认）
        if(!Number.isFinite(api.temp) || api.temp < 0.1 || api.temp > 2) { toast("温度请输入 0.1~2.0"); api.temp = 1.0; const t = $('tempRange'); if(t) t.value = 1.0; }
        if(!Number.isFinite(api.top_p) || api.top_p < 0.75 || api.top_p > 1.25) { toast("核采样 Top-p 请输入 0.75~1.25"); api.top_p = 0.92; const t = $('topPRange'); if(t) t.value = 0.92; }
        if(!Number.isFinite(api.repetition_penalty) || api.repetition_penalty < 1 || api.repetition_penalty > 1.25) { toast("重复惩罚请输入 1.00~1.25"); api.repetition_penalty = 1.15; const t = $('repPenaltyRange'); if(t) t.value = 1.15; }
        if(!Number.isFinite(api.freqPenalty) || api.freqPenalty < 0 || api.freqPenalty > 1) { toast("频率惩罚请输入 0.0~1.0"); api.freqPenalty = 0.4; const t = $('freqRange'); if(t) t.value = 0.4; }
        if(!Number.isFinite(api.presPenalty) || api.presPenalty < 0 || api.presPenalty > 1.5) { toast("存在惩罚请输入 0.0~1.5"); api.presPenalty = 0.5; const t = $('presRange'); if(t) t.value = 0.5; }
        if(!Number.isInteger(api.maxTokens) || api.maxTokens < 3000 || api.maxTokens > 90000) { toast("Maxtokens 请输入 3000~90000 的整数"); api.maxTokens = 60000; const mi = $('maxTokensInp'); if(mi) mi.value = 60000; }
        if(!Number.isInteger(api.ctxChapters) || api.ctxChapters < 1 || api.ctxChapters > 50) { toast("前文引用章节数请输入 1~50 的整数"); api.ctxChapters = 5; const ci = $('ctxRange'); if(ci) ci.value = 5; }
        const thinkingEl2 = $('thinkingCheck'); if(thinkingEl2) api.thinking = thinkingEl2.checked;
        const branchAuto2 = $('branchAutoSendCheck'); if(branchAuto2) api.branchAutoSend = branchAuto2.checked; // v7.2
        const rewriteAuto2 = $('rewriteAutoSendCheck'); if(rewriteAuto2) api.rewriteAutoSend = rewriteAuto2.checked; // v7.2
        const mcc2 = $('multiChapCountInp'); if(mcc2) { let n = parseInt(mcc2.value); if(n >= 2 && n <= 10) api.multiChapCount = n; } // v8.0.34
        // v7.3 审稿 API 字段读取（Gemini 3.x：无温度，读推理强度）
        const polMap2 = { polishUrlInp: 'url', polishKeyInp: 'key', polishModelInp: 'model',
            polishMaxTokensInp: 'maxTokens' };
        for (let [id, key] of Object.entries(polMap2)) {
            let el = $(id);
            if (el) polishApi[key] = id === 'polishMaxTokensInp' ? parseInt(el.value) : el.value;
        }
        const polReason2 = $('polishReasoningRange'); if(polReason2) {
            const levels = ['low','high','max'];
            polishApi.reasoning = levels[parseInt(polReason2.value)] || 'max';
        }
        const polRatio2 = $('polishRatioRange'); if(polRatio2) polishApi.ratio = parseInt(polRatio2.value) || 50;
        // v8.6-⑤ 参数模式字段保存（checkbox + 5 个数字参数）
        const ppc2 = $('polishParamCheck'); if(ppc2) polishApi.paramMode = ppc2.checked;
        const pnumMap = { polishTempRange: 'temp', polishTopPRange: 'topP', polishPresRange: 'presPenalty', polishFreqRange: 'freqPenalty', polishRepRange: 'repPenalty' };
        for (let [id, key] of Object.entries(pnumMap)) { const el = $(id); if(el) { const v = parseFloat(el.value); if(Number.isFinite(v)) polishApi[key] = v; } }
        // v7.9 扮演 API 字段读写
        const actMap2 = { actUrlInp: 'url', actKeyInp: 'key', actModelInp: 'model' };
        for (let [id, key] of Object.entries(actMap2)) { let el = $(id); if (el) actApi[key] = el.value; }
        const actTp = $('actTempRange'); if(actTp) { actApi.temp = snapToStep(parseFloat(actTp.value), 0.1); actTp.value = formatStep(actApi.temp, 0.1); }
        const actMt = $('actMaxTokensInp'); if(actMt) actApi.maxTokens = Math.round(parseFloat(actMt.value)) || 800;
        const actRd = $('actRoundsInp'); if(actRd) actApi.rounds = Math.round(parseFloat(actRd.value)) || 10;
        // v7.9 扮演参数校验（非法输入明确提示并回默认）
        if(!Number.isFinite(actApi.temp) || actApi.temp < 0.1 || actApi.temp > 2) { toast("扮演温度请输入 0.1~2.0"); actApi.temp = 0.7; const t = $('actTempRange'); if(t) t.value = 0.7; }
        if(!Number.isInteger(actApi.maxTokens) || actApi.maxTokens < 500 || actApi.maxTokens > 1500) { toast("台词长度请输入 500~1500 的整数"); actApi.maxTokens = 800; const t = $('actMaxTokensInp'); if(t) t.value = 800; }
        if(!Number.isInteger(actApi.rounds) || actApi.rounds < 5 || actApi.rounds > 30) { toast("对话轮数请输入 5~30 的整数"); actApi.rounds = 10; const t = $('actRoundsInp'); if(t) t.value = 10; }
        const actPer2 = $('actPersonaCheck'); if(actPer2) actApi.persona = actPer2.checked;
        const actTon2 = $('actToneCheck'); if(actTon2) actApi.tone = actTon2.checked;
        if(polishApi.maxTokens===undefined || !Number.isInteger(polishApi.maxTokens) || polishApi.maxTokens<3000 || polishApi.maxTokens>90000) polishApi.maxTokens=50000;
        if(polishApi.reasoning===undefined || ['low','high','max'].indexOf(polishApi.reasoning)<0) polishApi.reasoning='max';
        if(polishApi.ratio===undefined || !Number.isFinite(polishApi.ratio) || polishApi.ratio<20 || polishApi.ratio>90) polishApi.ratio=50;
        // v8.7 EXE-87-F02 同步修复：审稿/扮演模型名空值兜底——对齐正文模型口径（原空模型可保存成功，同会话请求携带 model:'' 不可用）
        if(!polishApi.model || !String(polishApi.model).trim()) { toast("审稿模型名称不能为空，已恢复默认"); polishApi.model = 'deepseek-flash'; const pmEl2 = $('polishModelInp'); if(pmEl2) pmEl2.value = polishApi.model; }
        if(!actApi.model || !String(actApi.model).trim()) { toast("扮演模型名称不能为空，已恢复默认"); actApi.model = 'deepseek-flash'; const amEl2 = $('actModelInp'); if(amEl2) amEl2.value = actApi.model; }
        const reasoningRange2 = $('reasoningRange'); if(reasoningRange2) {
            const levels = ['low','high','max'];
            api.reasoningEffort = levels[parseInt(reasoningRange2.value)] || 'high';
        }
        
        const ctxNum = $('ctxNum'); if(ctxNum) ctxNum.innerText = api.ctxChapters;
        // v5.8：检查持久化结果——空间不足时 API 配置本次会话仍生效，但刷新会丢失，
        // 必须明确告知（否则"已保存"提示 + 刷新丢失会误导用户）
        const persistOk = saveAll();
        const apiModal = $('apiModal'); if(!keepOpen && apiModal) apiModal.style.display='none';
        if(!persistOk) {
            toast("API 配置未能持久保存（存储空间不足），本次会话仍可使用，刷新后将丢失");
            lastSaveErrorShown = true;
            // v5.8：更新待生成任务的聊天为真实状态——Key 已配置（内存生效）但任务已暂存未执行，
            // 两个出路明确：腾出空间后重新保存自动重试 / 重新发送指令覆盖（消除"请配置 Key"的过时提示）
            if(pendingGeneration) {
                const pg = pendingGeneration;
                const pgBook = pg.sourceBookId ? books.find(b => b.id === pg.sourceBookId) : getCurrentBook();
                if(pgBook && pg.chatId) replaceChatMessage(pg.chatId, '⚠️ API 配置本次会话可用但未持久保存；待生成任务已暂存，腾出空间后重新保存将自动重试，或重新发送指令覆盖', pgBook);
            }
            return; // 保留 pendingGeneration，空间腾出后重新保存会自动重试
        }
        toast("API 配置已保存");
        if (pendingGeneration && !skipAutoRetry) { // v8.6-fix26：自动保存（失焦）不消费挂起任务；显式「保存」按钮才重试
            const gen = pendingGeneration;
            pendingGeneration = null;
            // 按来源书籍恢复：用户配置 API 期间可能已切换小说，重试必须生成回原书
            const sourceBook = gen.sourceBookId ? books.find(b => b.id === gen.sourceBookId) : getCurrentBook();
            if(!sourceBook) { toast("原小说已不存在，已取消待生成任务"); if(gen.chatId) replaceChatMessage(gen.chatId, '❌ 原小说已不存在，已取消生成', getCurrentBook()); return; }
            // v5.8：自动切回原书再重试——数据写入原书的同时 UI（章节/正文/聊天）也回到原书，
            // 否则生成结果在后台原书里，当前界面看不到反馈（用户误以为结果丢失）
            if(currentBookId !== sourceBook.id) {
                const switched = switchBook(sourceBook.id);
                // v5.8：切换失败（保存当前书失败等）必须取消任务，杜绝"数据写原书、界面留新书"错位
                if(!switched || currentBookId !== sourceBook.id) {
                    toast("无法切换回原小说，已取消待生成任务");
                    if(gen.chatId) replaceChatMessage(gen.chatId, '❌ 原小说切换失败，已取消生成', sourceBook);
                    return;
                }
            }
            if(gen.isDual) {
                toast("检测到待生成的双版任务，自动重试...");
                void runDualGeneration(gen.instr, sourceBook, gen.chatId);
            } else {
                toast("检测到待生成任务，自动重试...");
                executeGeneration(gen.instr, gen.isRegen, gen.targetId, gen.isCont, gen.chatId, gen.onSuccess, false, null, sourceBook.id);
            }
        }
    }

    function openApiModal() {
        loadApi();
        // v7.1 页签切换（生图页签禁点）
        document.querySelectorAll('.api-tab').forEach(btn => {
            btn.onclick = () => {
                const t = btn.getAttribute('data-apitab');
                if(t === 'image') { toast('🎨 生图功能规划中（仅 EXE 版实装）'); return; }
                document.querySelectorAll('.api-tab').forEach(b => { b.classList.remove('active'); b.style.background = ''; });
                btn.classList.add('active');
                ['main','polish','image','act'].forEach(pt => { const p = $('apiPane-' + pt); if(p) p.style.display = (pt === t) ? '' : 'none'; });
            };
        });
        // v7.3 审稿控件绑定（推理强度滑块实时显示 low/high/max）
        const polRr = $('polishReasoningRange'); if(polRr) polRr.oninput = () => { const levels=['low','high','max']; const pv = $('polishReasoningVal'); if(pv) pv.innerText = levels[parseInt(polRr.value)] || 'max'; };
        const ppc3 = $('polishParamCheck'); if(ppc3) ppc3.onchange = updatePolishParamUI; // v8.6-⑤：参数模式开关联动（推理强度变灰）
        const polRar = $('polishRatioRange'); if(polRar) polRar.oninput = () => { const pv = $('polishRatioVal'); if(pv) pv.innerText = polRar.value + '%'; };
        const tc = $('thinkingCheck'); if(tc) tc.onchange = () => { const rr = $('reasoningRange'); if(rr) rr.disabled = !tc.checked; };
        const rr = $('reasoningRange'); if(rr) rr.oninput = () => { const levels=['low','high','max']; const rv = $('reasoningVal'); if(rv) rv.innerText = levels[parseInt(rr.value)]; };
        // v7.9 参数输入框：失焦/回车即自动保存（手动输入与上下增减均生效，无需再点保存按钮）
        // v8.6-fix14：URL/Key/Model 文本字段一并纳入失焦自动保存（原只改文本后直接关面板/Esc 会静默丢弃）
        ['tempRange','topPRange','repPenaltyRange','freqRange','presRange','ctxRange','maxTokensInp','polishMaxTokensInp','actTempRange','actMaxTokensInp','actRoundsInp','apiUrlInp','apiKeyInp','modelInp','polishUrlInp','polishKeyInp','polishModelInp','actUrlInp','actKeyInp','actModelInp'].forEach(id => {
            const pe = $(id); if(pe) pe.onchange = () => saveApi(true, true); // v8.6-fix26：自动保存不触发挂起任务重试
        });
        const apiModal = $('apiModal');
        if(apiModal) apiModal.style.display = 'flex';
    }

