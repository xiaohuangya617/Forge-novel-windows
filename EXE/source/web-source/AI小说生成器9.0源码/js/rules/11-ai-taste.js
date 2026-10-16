    // ======================== v8.7 规则层：AI 味词库 + 扫描器（8.7 清单 G1/G2/G4，友商 dsh-novel-writer 方案移植） ========================
    // 5 类 ~230 词：connector 转折/口头禅 / action 万能动作 / psychology 心理腔 / adjective 形容词堆砌 / tone 语气感叹
    // 每项 [词, 类, 策略, 建议替换?]；策略 replace=可替换 / delete=建议删除 / rewrite=需改写句子；三链（润色/检测/吐槽）共用同一份词表与扫描器（G4 词表统一）
    const AI_TASTE_DICT = [
        // ① connector 转折连接词/口头禅（delete）
        ['不禁','connector','delete'],['不由','connector','delete'],['不由得','connector','delete'],['于是','connector','delete'],['然而','connector','delete'],['不过','connector','delete'],['没想到','connector','delete'],['出乎意料','connector','delete'],['意料之外','connector','delete'],['总而言之','connector','delete'],['综上所述','connector','delete'],['众所周知','connector','delete'],['毋庸置疑','connector','delete'],['值得一提的是','connector','delete'],['不难发现','connector','delete'],['显而易见','connector','delete'],['事实上','connector','delete'],['实际上','connector','delete'],['换句话说','connector','delete'],['也就是说','connector','delete'],['与此同时','connector','delete'],['另一方面','connector','delete'],['总的来说','connector','delete'],['归根结底','connector','delete'],['说到底','connector','delete'],['毕竟','connector','delete'],['终究','connector','delete'],['最终','connector','delete'],['终于','connector','delete'],['总算','connector','delete'],['旋即','connector','delete'],['随即','connector','delete'],['顿时','connector','delete'],['骤然','connector','delete'],['猛然','connector','delete'],['忽然','connector','delete'],
        // ① rewrite（→具体动作/事件）
        ['忽然之间','connector','rewrite'],['突然之间','connector','rewrite'],['下一秒','connector','rewrite'],['下一刻','connector','rewrite'],['下一瞬','connector','rewrite'],['然而就在这时','connector','rewrite'],['可就在这时','connector','rewrite'],['但就在这时','connector','rewrite'],['恰在此时','connector','rewrite'],['正在此时','connector','rewrite'],['偏偏在这时','connector','rewrite'],['偏偏此时','connector','rewrite'],['万万没想到','connector','rewrite'],
        // ② action 万能动作（replace → 具体动作）
        ['缓缓','action','replace'],['微微','action','replace'],['轻轻','action','replace'],['慢慢','action','replace'],['深深','action','replace'],['淡淡','action','replace'],['静静','action','replace'],['默默','action','replace'],['悄悄','action','replace'],['渐渐','action','replace'],['逐渐','action','replace'],['隐隐','action','replace'],['幽幽','action','replace'],['嘴角上扬','action','replace'],['勾起嘴角','action','replace'],['点了点头','action','replace'],['摇了摇头','action','replace'],['皱了皱眉','action','replace'],['挑了挑眉','action','replace'],['深吸一口气','action','replace'],['呼出一口气','action','replace'],['闭上双眼','action','replace'],['睁开双眼','action','replace'],['抬起头来','action','replace'],['低下头去','action','replace'],['转过身来','action','replace'],['迈开步伐','action','replace'],['愣了一愣','action','replace'],['怔了怔','action','replace'],['回过神来','action','replace'],['回过神','action','replace'],['若有所思','action','replace'],['似笑非笑','action','replace'],['意味深长','action','replace'],['轻轻一笑','action','replace'],['微微一笑','action','replace'],
        // ② rewrite（说话方式）
        ['轻轻地说','action','rewrite'],['淡淡地说','action','rewrite'],['缓缓道','action','rewrite'],['悠悠道','action','rewrite'],['轻声道','action','rewrite'],['低声道','action','rewrite'],['沉声道','action','rewrite'],['冷声道','action','rewrite'],['柔声道','action','rewrite'],['呢喃','action','rewrite'],['喃喃自语','action','rewrite'],['语气平淡','action','rewrite'],['语气冷漠','action','rewrite'],['语带深意','action','rewrite'],['若有所思地说','action','rewrite'],
        // ② rewrite（起身/点头/开口）
        ['缓缓起身','action','rewrite'],['慢慢站起身','action','rewrite'],['轻轻放下','action','rewrite'],['微微颔首','action','rewrite'],['轻轻颔首','action','rewrite'],['微微点头','action','rewrite'],['轻轻点头','action','rewrite'],['淡淡开口','action','rewrite'],['缓缓开口','action','rewrite'],['轻声开口','action','rewrite'],
        // ② rewrite（沉默）
        ['沉默片刻','action','rewrite'],['沉默良久','action','rewrite'],['沉默半晌','action','rewrite'],['沉默了许久','action','rewrite'],['半晌无言','action','rewrite'],['良久无言','action','rewrite'],['一时无言','action','rewrite'],['无言以对','action','rewrite'],
        // ③ psychology 心理腔（rewrite → 动作/对话呈现）
        ['心底','psychology','rewrite'],['心中','psychology','rewrite'],['心里','psychology','rewrite'],['内心','psychology','rewrite'],['涌起','psychology','rewrite'],['升起','psychology','rewrite'],['泛起','psychology','rewrite'],['浮现','psychology','rewrite'],['掠过','psychology','rewrite'],['闪过','psychology','rewrite'],['滋生','psychology','rewrite'],['蔓延','psychology','rewrite'],['油然而生','psychology','rewrite'],['一股暖流','psychology','rewrite'],['一丝寒意','psychology','rewrite'],['莫名','psychology','rewrite'],['莫名其妙','psychology','rewrite'],['鬼使神差','psychology','rewrite'],['不由自主','psychology','rewrite'],['情不自禁','psychology','rewrite'],['下意识','psychology','rewrite'],['本能地','psychology','rewrite'],['不自觉','psychology','rewrite'],['暗自','psychology','rewrite'],['暗暗','psychology','rewrite'],['心底深处','psychology','rewrite'],['内心深处','psychology','rewrite'],['潜意识里','psychology','rewrite'],['暗自心惊','psychology','rewrite'],['心中暗想','psychology','rewrite'],['心想','psychology','rewrite'],['暗道','psychology','rewrite'],['暗暗想到','psychology','rewrite'],['不禁想到','psychology','rewrite'],['脑海中浮现','psychology','rewrite'],['眼前浮现','psychology','rewrite'],['耳边响起','psychology','rewrite'],['心中一动','psychology','rewrite'],['心头一紧','psychology','rewrite'],['心头一跳','psychology','rewrite'],['心中一震','psychology','rewrite'],['心底一沉','psychology','rewrite'],['心里咯噔','psychology','rewrite'],['内心挣扎','psychology','rewrite'],['思绪万千','psychology','rewrite'],['心念电转','psychology','rewrite'],['脑中灵光一闪','psychology','rewrite'],['一个念头浮现','psychology','rewrite'],
        // ④ adjective 形容词堆叠/万能句式（rewrite → 具体细节）
        ['深邃','adjective','rewrite'],['幽深','adjective','rewrite'],['清澈','adjective','rewrite'],['明亮','adjective','rewrite'],['修长','adjective','rewrite'],['纤细','adjective','rewrite'],['精致','adjective','rewrite'],['俊美','adjective','rewrite'],['英俊','adjective','rewrite'],['绝美','adjective','rewrite'],['绝色','adjective','rewrite'],['倾国倾城','adjective','rewrite'],['惊为天人','adjective','rewrite'],['宛如','adjective','rewrite'],['好似','adjective','rewrite'],['犹如','adjective','rewrite'],['仿佛','adjective','rewrite'],['像是','adjective','rewrite'],['透着','adjective','rewrite'],['泛着','adjective','rewrite'],['闪着','adjective','rewrite'],['带着一丝','adjective','rewrite'],['露出一抹','adjective','rewrite'],['划过一丝','adjective','rewrite'],['闪现一丝','adjective','rewrite'],['藏着一丝','adjective','rewrite'],['掩饰不住的','adjective','rewrite'],['难以掩饰的','adjective','rewrite'],['无法言喻','adjective','rewrite'],['难以言说','adjective','rewrite'],['妙不可言','adjective','rewrite'],['无可挑剔','adjective','rewrite'],['眼底闪过一丝','adjective','rewrite'],['眼中闪过一丝','adjective','rewrite'],['嘴角勾起一抹','adjective','rewrite'],['脸上露出一抹','adjective','rewrite'],['眼神中透着','adjective','rewrite'],['目光深邃','adjective','rewrite'],['气质出尘','adjective','rewrite'],['风采绝世','adjective','rewrite'],['气势如虹','adjective','rewrite'],['杀气凛然','adjective','rewrite'],['气势磅礴','adjective','rewrite'],['威压如山','adjective','rewrite'],['恐怖如斯','adjective','rewrite'],['竟恐怖如斯','adjective','rewrite'],
        // ⑤ tone 语气/句末（rewrite / delete）
        ['罢了','tone','rewrite'],['而已','tone','rewrite'],['呢喃着','tone','rewrite'],['轻叹一声','tone','rewrite'],['叹了口气','tone','rewrite'],['长叹一声','tone','rewrite'],['苦笑一声','tone','rewrite'],['冷笑一声','tone','rewrite'],['轻笑一声','tone','rewrite'],['低笑一声','tone','rewrite'],['哑然失笑','tone','rewrite'],['忍不住笑了','tone','rewrite'],['无奈地笑了笑','tone','rewrite'],['啊！','tone','delete'],['啊。','tone','delete'],['呢……','tone','delete'],['吧……','tone','delete'],['罢了罢了','tone','delete'],['算了算了','tone','delete'],['无妨无妨','tone','delete'],['无碍无碍','tone','delete']
    ].map(t => ({ w: t[0], c: t[1], s: t[2], ...(t[3] ? { r: t[3] } : {}) }));
    const AI_TASTE_CAT_LABEL = { connector: '转折/口头禅', action: '万能动作', psychology: '心理腔', adjective: '形容词堆砌', tone: '语气感叹' };
    const AI_TASTE_STRATEGY_LABEL = { replace: '可替换', delete: '建议删除', rewrite: '需改写' };
    // 扫描器：长词优先（防"微微"先命中"微微一笑"）；子串匹配累计（词中词也算命中，无语义——规则层定位）；切句按中英文句末标点+换行
    function aiTasteSplitSentences(text) {
        const out = [];
        let buffer = '', start = 0;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            buffer += ch;
            if (ch === '。' || ch === '！' || ch === '？' || ch === '!' || ch === '?' || ch === '\n') {
                const t = buffer.trim();
                if (t) out.push({ sentence: t, start });
                buffer = ''; start = i + 1;
            }
        }
        const tail = buffer.trim();
        if (tail) out.push({ sentence: tail, start });
        return out;
    }
    // 扫描正文 → {score(0-100), hits, cjkChars, byCategory, details[]}；密度评分：每千字命中数×10 封顶 100（每 100 中文字 1 处命中 ≈ 10 分）
    function scanAiTaste(text) {
        const dict = [...AI_TASTE_DICT].sort((a, b) => b.w.length - a.w.length);
        const details = [];
        const byCategory = { connector: 0, action: 0, psychology: 0, adjective: 0, tone: 0 };
        let cjkChars = 0;
        const src = String(text || '');
        for (const ch of src) if (/[\u4e00-\u9fff]/.test(ch)) cjkChars++;
        for (const { sentence, start } of aiTasteSplitSentences(src)) {
            for (const item of dict) {
                let from = 0;
                for (;;) {
                    const idx = sentence.indexOf(item.w, from);
                    if (idx === -1) break;
                    details.push({ w: item.w, c: item.c, s: item.s, ...(item.r ? { r: item.r } : {}), sentence: (sentence.length > 70 ? sentence.slice(Math.max(0, Math.min(idx - 20, sentence.length - 70)), Math.min(sentence.length, idx + item.w.length + 50)) : sentence), at: start + idx }); // v8.9-F023：存命中上下文窗口（词前 20 + 词后至多 50，最长 70）替代句首 60 截断——长句第 60 字后的命中不再丢失（原截断后例句不含命中词，F-023）
                    byCategory[item.c] += 1;
                    from = idx + item.w.length;
                }
            }
        }
        const perThousand = cjkChars > 0 ? (details.length / cjkChars) * 1000 : 0;
        const score = Math.min(100, Math.round(perThousand * 10));
        return { score, hits: details.length, cjkChars, byCategory, details };
    }
    // 命中清单文本化（注入 prompt 用）：按类别汇总"词×次数"，附示例句
    function aiTasteHitsText(report, maxLines) {
        if (!report || !report.hits) return '';
        const cap = maxLines || 12;
        const byWord = {};
        report.details.slice(0, 300).forEach(h => { byWord[h.w] = (byWord[h.w] || 0) + 1; });
        const words = Object.keys(byWord);
        // 类别分组排序：同类别聚拢，词频降序
        const catOrder = ['adjective', 'action', 'psychology', 'connector', 'tone'];
        const lines = [];
        catOrder.forEach(c => {
            const ws = words.filter(w => report.details.some(h => h.w === w && h.c === c)).sort((a, b) => byWord[b] - byWord[a]).slice(0, 12); // v8.9-自审：每类最多 12 词（按频次）——防极端全词库命中时单行注入爆长（实测万字 27 词注入 656 字，截断为防御上限）
            if (ws.length) lines.push(AI_TASTE_CAT_LABEL[c] + '：' + ws.map(w => {
                const d0 = report.details.find(h => h.w === w && h.c === c);
                const strat = (d0 && AI_TASTE_STRATEGY_LABEL[d0.s]) || (d0 && d0.s) || '';
                let exTxt = '';
                if (d0 && d0.sentence) { const ex = d0.sentence; const wi = ex.indexOf(w); if (wi >= 0) { const st = wi > 8 ? wi - 8 : 0; exTxt = '例：' + ex.slice(st, st + 24) + (ex.length > st + 24 ? '…' : ''); } } // v8.9-F023：窗口内找不到词时不伪装例句（原 wi=-1 时从句首截取、例句不含命中词，F-023）
                return w + '×' + byWord[w] + '（' + strat + '）' + (exTxt ? exTxt : '');
            }).join('；')); // v8.8-F-021：词级策略 + 含词代表句（原只给类别词频——润色 sys 要求按词级策略处理却拿不到策略与原句；F-021）
        });
        if (lines.length > cap) lines.length = cap;
        return lines.join('；') + '（每千字命中 ' + (Math.round(report.hits / Math.max(1, report.cjkChars) * 10000) / 10) + ' 处，评分 ' + report.score + '/100）'; // v8.8-F022：密度保留 1 位小数——与评分（round(密度×10)）同口径，不再出现"0 处但评分 2/100"自相矛盾
    }

