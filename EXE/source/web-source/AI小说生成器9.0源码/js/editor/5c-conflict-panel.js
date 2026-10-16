    let conflictVisible = false;
    async function toggleConflictPanel() {
        let book = getCurrentBook(); if(!book || !book.currentChapterId) return;
        let chap = book.chapters.find(c=>c.id===book.currentChapterId); if(!chap) return;
        const conflictPanel = $('conflictPanel');
        if(!conflictPanel) return;
        if(conflictVisible) { conflictPanel.style.display = 'none'; conflictVisible = false; clearCheckMarks(); } // v8.4-③-b：关闭剥离标色
        else {
            // v8.5.3-P2-4：打开前保存当前编辑——标色基于最新正文（原基于旧 checkResult 标旧内容，编辑未保存时大量灰显）
            if(!await ensureCurrentChapterSavedAndCommitted()) return;
            renderConflictPanel(chap); conflictPanel.style.display = 'flex'; conflictVisible = true;
        }
    }

    // v8.4-③-b：检查面板渲染（五档评级 + 4维评分 + hits + 条目点击定位 + 旧格式自动重测 + 全部标色）
    function renderConflictPanel(chap) {
        const conflictList = $('conflictList'); if(!conflictList) return;
        conflictList.innerHTML = '';
        if(!chap.checkState || chap.checkState === 'never' || chap.checkResult === undefined) { conflictList.innerHTML = '<div style="padding:12px;color:#6A627A;">本章尚未检测，点击「重新检测」发起检测</div>'; return; } // v8.5.2-P2-2：新生成/新建章节无 checkState 字段也走"尚未检测"（原误显示"未检测到明显冲突"）
        if(chap.checkState === 'error') { conflictList.innerHTML = '<div style="padding:12px;color:#FFA070;">检测失败，请点击「重新检测」重试</div>'; return; }
        // 旧格式兼容（方案A）：数组且无 checkReport → 提示升级并自动重测（_legacyRerun 防循环，单次会话仅自动重测一次）
        if(Array.isArray(chap.checkResult) && chap.checkReport === undefined && chap.checkResult.length && !chap._legacyRerun) {
            chap._legacyRerun = true;
            conflictList.innerHTML = '<div style="padding:12px;color:#F0C05A;">⚠️ 检测格式已升级，正在自动重新检测…</div>';
            setTimeout(() => { if(conflictVisible) recheckCurrentChapter(); }, 400); // v8.5.3-P3-2：面板已关闭则不发起（防后台白费一次 API）
            return;
        }
        const r = chap.checkReport || {};
        // 综合评级 + decision
        if(r.overall_grade) {
            const g = document.createElement('div'); g.className = 'conflict-grade';
            g.innerHTML = `综合评级：<b>${escapeHtml(r.overall_grade)}</b> <span style="color:#8A84A8;">${escapeHtml(r.decision||'')}</span>`;
            conflictList.appendChild(g);
        }
        // 维度评分（v8.4.2 起为 4 维：设定一致性/逻辑连贯/AI味/结构节奏）
        if(r.dimension_grades && typeof r.dimension_grades === 'object') {
            const d = document.createElement('div'); d.className = 'conflict-dims';
            let html = '';
            // v8.4.2：跳过「语言表达」维度（该维度已取消，语言问题由润色负责；兼容旧数据残留）
            for(const k in r.dimension_grades) { if(k === '语言表达') continue; html += `<span>${escapeHtml(k)}:${escapeHtml(r.dimension_grades[k])}</span>`; }
            d.innerHTML = html;
            conflictList.appendChild(d);
        }
        // v8.4.2：过滤 low 严重度提示性条目（"时间线紧凑"类琐碎建议不呈现），仅展示真正需要修改的问题
        const validConflicts = (chap.checkResult || []).filter(c => (c.severity || 'mid') !== 'low');
        if(!validConflicts.length) {
            const empty = document.createElement('div'); empty.style.cssText = 'padding:12px;color:#6A627A;';
            empty.textContent = '未检测到明显冲突';
            conflictList.appendChild(empty);
        } else {
            applyCheckMarks(chap); // v8.4-P2.3：先标色（写入 _miss），再渲染列表——首次打开灰显即生效
            validConflicts.forEach((conf, idx) => {
                const div = document.createElement('div');
                div.className = 'conflict-item' + (conf._miss ? ' miss' : '');
                div.dataset.idx = String(idx);
                const sev = conf.severity || 'mid';
                const sevColor = sev === 'high' ? '#FF6B6B' : (sev === 'low' ? '#8A84A8' : '#F0C05A');
                div.innerHTML = `<div class="conflict-type"><i class="fas fa-exclamation-triangle" style="color:${sevColor};"></i> <span style="color:${sevColor};font-size:0.6rem;">[${escapeHtml(sev)}]</span> ${escapeHtml(conf.reason || conf.type || '潜在矛盾')}${conf._miss ? ' <span style="color:#6A627A;">（原文已变更，无法定位）</span>' : ''}</div><div class="conflict-desc">${escapeHtml(conf.suggestion || conf.description || '')}</div><div class="conflict-loc">📍 ${escapeHtml(conf.quote || conf.location || '')}</div>`;
                // v8.4.2：点击条目滚动定位到正文对应标色（灰显 _miss 无法定位，提示即可）
                div.addEventListener('click', () => {
                    if(conf._miss) { toast('原文已变更，无法定位'); return; }
                    const m = $('novelContent')?.querySelector('mark.check-mark[data-check-idx="' + idx + '"]');
                    if(m) { m.scrollIntoView({block:'center', behavior:'smooth'}); m.classList.add('check-active'); setTimeout(() => m.classList.remove('check-active'), 1800); }
                    else toast('未找到对应位置');
                });
                conflictList.appendChild(div);
            });
        }
    }

    // v8.4.1-⑥-b：quote 模糊匹配——①精确 ②去首尾标点/空白 ③截前 20 字（解决 AI quote 与正文细微差异导致的大量灰显）
