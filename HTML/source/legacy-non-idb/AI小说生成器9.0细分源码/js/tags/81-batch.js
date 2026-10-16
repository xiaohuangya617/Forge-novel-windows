    // ======================== v7.9j 批量标签 ========================
    const batchTagCtx = { key: null, checkedSet: new Set() };
    const BATCH_TAG_LIB = { char: '本书角色库', globalChar: '素材角色库', costume: '全局服装库' };
    function batchTagItems(key) {
        if(key === 'char') { const b = getCurrentBook(); return (b && b.characters) || []; }
        if(key === 'globalChar') return globalCharacters || [];
        return globalCostumes || [];
    }
    function openBatchTag(key) {
        batchTagCtx.key = key;
        batchTagCtx.checkedSet = new Set(); // v7.9j 修复：打开时重置勾选
        const libEl = $('batchTagLibName'); if(libEl) libEl.innerText = BATCH_TAG_LIB[key] || key;
        const nameEl = $('batchTagName'); if(nameEl) nameEl.value = '';
        const srch = $('batchTagSearch'); if(srch) srch.value = '';
        renderBatchTagPresets(); renderBatchTagList();
        const m = $('batchTagModal'); if(m) m.style.display = 'flex';
    }
    function renderBatchTagPresets() {
        const box = $('batchTagPresets'); if(!box) return;
        const custom = getCustomTags();
        box.innerHTML = [...TAG_BUILTIN, ...custom].map(t => '<button type="button" data-bt="' + escapeHtml(t) + '" style="background:#1A1825;border:1px solid #3A3452;color:#DBD4E8;border-radius:20px;font-size:0.75rem;padding:3px 12px;cursor:pointer;">' + escapeHtml(t) + '</button>').join('');
    }
    function updateBatchTagCount() { // v7.9j 修复：已勾选计数
        const el = $('batchTagCount'); if(!el) return;
        el.innerText = '已勾选 ' + batchTagCtx.checkedSet.size + ' 项';
    }
    function renderBatchTagList() {
        const key = batchTagCtx.key; const listEl = $('batchTagList'); if(!listEl) return;
        const kw = (($('batchTagSearch') || {}).value || '').trim();
        const items = batchTagItems(key).filter(it => it && it.name && (!kw || it.name.indexOf(kw) >= 0));
        if(!items.length) { listEl.innerHTML = '<div style="padding:12px;color:#6A627A;font-size:0.72rem;text-align:center;">' + (kw ? '无匹配项' : '本库暂无数据') + '</div>'; updateBatchTagCount(); return; }
        // v7.9j 修复：搜索/重建时保留已勾选（checkedSet 驱动）
        listEl.innerHTML = items.map(it => '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;margin-bottom:2px;"><input type="checkbox" data-id="' + escapeHtml(it.id) + '"' + (batchTagCtx.checkedSet.has(String(it.id)) ? ' checked' : '') + ' style="width:auto;margin:0;accent-color:#3B8ED4;"> <span style="flex:1;font-size:0.75rem;color:#EDEAF2;">' + escapeHtml(it.name) + '</span><span style="font-size:0.62rem;color:#6A627A;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (((it.tags || []).length) ? '已有：' + escapeHtml(normTags(it.tags).join('、')) : '无标签') + '</span></label>').join(''); // v8.6-fix29：checkedSet.has(String(it.id))——存量数字 id 下勾选丢失
        updateBatchTagCount();
    }
    function batchTagApply() {
        const key = batchTagCtx.key;
        let t = (($('batchTagName') || {}).value || '').trim();
        const del = t.startsWith('-');
        if(del) t = t.slice(1).trim();
        if(!t) { toast('请输入标签名'); return; }
        const items = batchTagItems(key);
        let changed = 0;
        batchTagCtx.checkedSet.forEach(id => {
            const it = items.find(x => String(x.id) === String(id)); // v8.6-fix29：String 归一——存量数字 id 下严格 === 匹配不到，批量打标静默失效
            if(!it) return;
            const tags = normTags(it.tags);
            if(del) {
                const i2 = tags.indexOf(t);
                if(i2 >= 0) { tags.splice(i2, 1); changed++; }
            } else {
                if(!tags.includes(t)) { tags.push(t); changed++; }
                if(t === '原设') { const i2 = tags.indexOf('自设'); if(i2 >= 0) { tags.splice(i2, 1); } }
                if(t === '自设') { const i2 = tags.indexOf('原设'); if(i2 >= 0) { tags.splice(i2, 1); } }
            }
            it.tags = tags;
        });
        if(changed > 0) {
            saveAll();
            toast('已' + (del ? '取消' : '添加') + '「' + t + '」高亮 × ' + changed);
        } else {
            toast(del ? '所选项均无此标签' : '所选项均已带该标签');
        }
        renderBatchTagList();
        // 同步当前编辑项标签行（若在受影响库）——v8.6-r20：与 tagState 合并保留未保存点选（原整体覆盖，用户先点选未保存的标签会静默丢失）
        if(key === 'char' && currentEditingCharId) { const b = getCurrentBook(); const c = ((b && b.characters) || []).find(x => x.id === currentEditingCharId); if(c) { let m = normTags([...(tagState.char || []), ...c.tags]); if(m.includes('原设')) m = m.filter(x => x !== '自设'); if(m.includes('自设')) m = m.filter(x => x !== '原设'); tagState.char = m; renderTagRow('char'); } } // v8.6-fix9：合并后复跑互斥
        if(key === 'globalChar' && currentEditingGlobalCharId) { const c = (globalCharacters || []).find(x => x.id === currentEditingGlobalCharId); if(c) { let m = normTags([...(tagState.globalChar || []), ...c.tags]); if(m.includes('原设')) m = m.filter(x => x !== '自设'); if(m.includes('自设')) m = m.filter(x => x !== '原设'); tagState.globalChar = m; renderTagRow('globalChar'); } } // v8.6-fix9
        if(key === 'costume' && currentEditingGlobalCostumeId) { const c = (globalCostumes || []).find(x => x.id === currentEditingGlobalCostumeId); if(c) { let m = normTags([...(tagState.costume || []), ...c.tags]); if(m.includes('原设')) m = m.filter(x => x !== '自设'); if(m.includes('自设')) m = m.filter(x => x !== '原设'); tagState.costume = m; renderTagRow('costume'); } } // v8.6-fix9
    }
    function closeBatchTag() { const m = $('batchTagModal'); if(m) m.style.display = 'none'; }
    function bctBind() {
        const open = (key) => () => openBatchTag(key);
        const b1 = $('charBatchTagBtn'); if(b1) b1.onclick = open('char');
        const b2 = $('globalCharBatchTagBtn'); if(b2) b2.onclick = open('globalChar');
        const b3 = $('globalCostumeBatchTagBtn'); if(b3) b3.onclick = open('costume');
        const ap = $('batchTagApply'); if(ap) ap.onclick = batchTagApply;
        const cl = $('batchTagClose'); if(cl) cl.onclick = closeBatchTag;
        // v7.9j 修复：全选/全不选同步 checkedSet + 计数
        const al = $('batchTagAll'); if(al) al.onclick = () => { document.querySelectorAll('#batchTagList input[type=checkbox]').forEach(c => { c.checked = true; batchTagCtx.checkedSet.add(c.dataset.id); }); updateBatchTagCount(); };
        const no = $('batchTagNone'); if(no) no.onclick = () => { document.querySelectorAll('#batchTagList input[type=checkbox]').forEach(c => { c.checked = false; }); batchTagCtx.checkedSet.clear(); updateBatchTagCount(); };
        const sr = $('batchTagSearch'); if(sr) sr.oninput = renderBatchTagList;
        const lst = $('batchTagList'); if(lst) lst.addEventListener('change', (e) => { // v7.9j 修复：勾选状态实时记录（重建列表时保留）
            const cb = e.target.closest('input[type=checkbox]'); if(!cb) return;
            if(cb.checked) batchTagCtx.checkedSet.add(cb.dataset.id); else batchTagCtx.checkedSet.delete(cb.dataset.id);
            updateBatchTagCount();
        });
        const pBox = $('batchTagPresets'); if(pBox) pBox.addEventListener('click', (e) => { const b = e.target.closest('[data-bt]'); if(b) { const nm = $('batchTagName'); if(nm) { nm.value = b.dataset.bt; nm.focus(); } } });
        const nmEl = $('batchTagName'); if(nmEl) nmEl.addEventListener('keydown', (e) => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); batchTagApply(); } }); // v8.6-fix5：isComposing 守卫
    }
    function bindLibSearch() {
        const bind = (inpId, clearId, type) => {
            const inp = $(inpId); if(!inp) return;
            inp.addEventListener('input', () => applyLibFilter(type));
            const clearBtn = $(clearId);
            if(clearBtn) clearBtn.addEventListener('click', () => { inp.value = ''; applyLibFilter(type); inp.focus(); });
        };
        bind('libCharSearch', 'libCharSearchClear', 'char');
        bind('libGlobalCharSearch', 'libGlobalCharSearchClear', 'globalChar');
        bind('libActionSearch', 'libActionSearchClear', 'action');
        bind('libCostumeSearch', 'libCostumeSearchClear', 'costume');
    }

    function togglePrecisionItem(id, type, checked) {
        const arr = type === 'char' ? precisionTempChars : type === 'action' ? precisionTempActions : precisionTempCostumes;
        if(checked && !arr.includes(id)) arr.push(id);
        if(!checked) { const idx = arr.indexOf(id); if(idx !== -1) arr.splice(idx, 1); }
        updatePrecisionCounts();
        // 同步卡片高亮
        document.querySelectorAll('.precision-card').forEach(c => {
            const cb = c.querySelector('input');
            if(cb && String(cb.dataset.id) === String(id)) c.classList.toggle('selected', checked); // v8.6-fix17：String 比较——存量数字 id 下高亮失效
        });
    }

    function updatePrecisionCounts() {
        const cc = $('precCharCount'), ac = $('precActionCount'), coc = $('precCostumeCount');
        if(cc) cc.innerText = precisionTempChars.length;
        if(ac) ac.innerText = precisionTempActions.length;
        if(coc) coc.innerText = precisionTempCostumes.length;
    }

    function selectAllPrecision(mode) {
        const book = getCurrentBook(); if(!book) return;
        // v7.1：全选 toggle——全勾时再点全部取消
        if(mode === 'char') { const all = book.characters.map(c => c.id); const allSel = all.length > 0 && all.every(id => precisionTempChars.includes(id)); precisionTempChars = allSel ? [] : all;
        } else if(mode === 'action') { const all = globalActions.map(a => a.id); const allSel = all.length > 0 && all.every(id => precisionTempActions.includes(id)); precisionTempActions = allSel ? [] : all;
        } else if(mode === 'costume') { const all = globalCostumes.map(a => a.id); const allSel = all.length > 0 && all.every(id => precisionTempCostumes.includes(id)); precisionTempCostumes = allSel ? [] : all;
        } else { precisionTempChars = []; precisionTempActions = []; precisionTempCostumes = []; }
        renderPrecisionPanel(false);
    }

    function openPrecisionModal() {
        const book = getCurrentBook(); if(!book) { toast("请先选择小说"); return; }
        // 重新打开时清空搜索词（v6.0：无搜索词记忆）
        ['precCharSearch','precActionSearch','precCostumeSearch'].forEach(id => { const el = $(id); if(el) el.value = ''; });
        renderPrecisionPanel();
        const modal = $('precisionModal'); if(modal) modal.style.display = 'flex';
    }

    function savePrecision() {
        const book = getCurrentBook(); if(!book) return;
        if(!precisionTempChars.length && !precisionTempActions.length && !precisionTempCostumes.length) {
            toast("请至少选择一个角色、动作或服装，或点击「关闭精准模式」");
            return;
        }
        book.precisionMode = true;
        book.precisionChars = [...precisionTempChars];
        book.precisionActions = [...precisionTempActions];
        book.precisionCostumes = [...precisionTempCostumes];
        if(!persistOrWarn()) return; // v6.5：保存失败不提示"已启用"（防假成功）
        updatePrecisionButton();
        const modal = $('precisionModal'); if(modal) modal.style.display = 'none';
        const cc = precisionTempChars.length, ac = precisionTempActions.length;
        toast(`精准模式已启用：${cc}个角色 + ${ac}个动作 + ${precisionTempCostumes.length}个服装`);
    }

    function disablePrecision() {
        const book = getCurrentBook(); if(!book) return;
        book.precisionMode = false;
        // v7.1：关闭精准模式不得清空已选设定——保留数组，下次打开原样恢复勾选（清空仅"全部取消"时）
        // book.precisionChars = [];
        // book.precisionActions = []; book.precisionCostumes = [];
        if(!persistOrWarn()) return; // v6.5：保存失败不提示"已切换"（防假成功）
        updatePrecisionButton();
        const modal = $('precisionModal'); if(modal) modal.style.display = 'none';
        toast("已切换为非精准模式（全量注入）");
    }

    // v6.6：清理精准模式中指向已删除项目（角色/动作/服装）的旧 ID——存量脏数据修复（幂等，无脏数据零副作用）
    function normalizePrecisionSelections(book) {
        if(!book) return;
        const validCharIds = new Set((book.characters || []).map(c => String(c.id)));
        const validActionIds = new Set(globalActions.map(a => String(a.id)));
        const validCostumeIds = new Set(globalCostumes.map(c => String(c.id)));
        let changed = false;
        if(Array.isArray(book.precisionChars)) { const f = book.precisionChars.map(pid => String(pid)).filter(pid => validCharIds.has(pid)); if(JSON.stringify(f) !== JSON.stringify(book.precisionChars)) { book.precisionChars = f; changed = true; } }
        if(Array.isArray(book.precisionActions)) { const f = book.precisionActions.map(pid => String(pid)).filter(pid => validActionIds.has(pid)); if(JSON.stringify(f) !== JSON.stringify(book.precisionActions)) { book.precisionActions = f; changed = true; } }
        if(Array.isArray(book.precisionCostumes)) { const f = book.precisionCostumes.map(pid => String(pid)).filter(pid => validCostumeIds.has(pid)); if(JSON.stringify(f) !== JSON.stringify(book.precisionCostumes)) { book.precisionCostumes = f; changed = true; } }
        if(book.precisionMode && !book.precisionChars.length && !book.precisionActions.length && !book.precisionCostumes.length) { book.precisionMode = false; changed = true; }
        if(changed) saveAll();
    }
    function updatePrecisionButton() {
        const book = getCurrentBook();
        normalizePrecisionSelections(book); // v6.6：每次更新按钮时惰性清理存量无效 ID（覆盖切书/打开面板/导入备份后）
        const btn = $('precisionBtn');
        if(!btn) return;
        if(book && book.precisionMode && ((book.precisionChars||[]).length || (book.precisionActions||[]).length || (book.precisionCostumes||[]).length)) { // v8.5.2-P3-5：判空防旧书缺字段 TypeError
            btn.classList.add('active');
            btn.title = `精准模式开启：${(book.precisionChars||[]).length}角色 + ${(book.precisionActions||[]).length}动作 + ${(book.precisionCostumes||[]).length}服装`;
        } else {
            btn.classList.remove('active');
            btn.title = '精准模式';
        }
    }

    function updateDualModeButton() {
        const btn = $('dualModeBtn');
        if(!btn) return;
        if(api.dualMode) { btn.classList.add('active'); btn.title = '并发双版开启（单次生效）'; }
        else if(api.multiChap) { btn.classList.add('active'); btn.title = '连发多章开启（' + (api.multiChapCount || 3) + '章，单次生效）'; }
        else { btn.classList.remove('active'); btn.title = '生成模式（单次生效）'; }
        const gmD = $('genModeDualBtn'), gmM = $('genModeMultiBtn');
        if(gmD) gmD.classList.toggle('selected', !!api.dualMode);
        if(gmM) gmM.classList.toggle('selected', !!api.multiChap);
    }

