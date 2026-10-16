// ======================== v7.7 角色标签化 ========================
    const tagState = { char: [], globalChar: [], costume: [] };
    const TAG_KEY_MAP = {
        char:       { add: 'charTagAddBtn',       mgr: 'charTagMgrBtn',       pre: 'charTagPresets' },
        globalChar: { add: 'globalCharTagAddBtn', mgr: 'globalCharTagMgrBtn', pre: 'globalCharTagPresets' },
        costume:    { add: 'globalCostumeTagAddBtn', mgr: 'globalCostumeTagMgrBtn', pre: 'globalCostumeTagPresets' }
    };
    const TAG_BUILTIN = ['原设', '自设'];
    function getCustomTags() { try { return JSON.parse(localStorage.getItem('custom_tags_v1') || '[]'); } catch(e) { return []; } }
    function saveCustomTags(arr) { try { localStorage.setItem('custom_tags_v1', JSON.stringify(arr)); } catch(e) {} }
    function normTags(arr) { return [...new Set((arr || []).map(t => String(t).trim()).filter(Boolean))]; }
    // v7.7 查重联动：标签集合比较（顺序无关；含都为空视为相同）
    function tagsEqual(a, b) {
        const A = normTags(a).sort(), B = normTags(b).sort();
        return A.length === B.length && A.every((t, i) => t === B[i]);
    }
    function renderTagRow(key) {
        const cfg = TAG_KEY_MAP[key]; if(!cfg) return;
        const presets = $(cfg.pre); if(!presets) return;
        const tags = tagState[key];
        const custom = getCustomTags();
        // v7.7 高亮式：预设/自定义预设/自由标签均显示为高亮按钮（active=已打），hover 显示 ✕ 单独移除
        const allPreset = [...TAG_BUILTIN, ...custom];
        const freeTags = tags.filter(t => !allPreset.includes(t));
        const mkBtn = (t, isActive) => `<button type="button" class="tag-preset-btn${isActive ? ' active' : ''}" data-k="${key}" data-t="${escapeHtml(t)}">${escapeHtml(t)}${isActive ? '<i class="fas fa-times tag-del" data-k="' + key + '" data-t="' + escapeHtml(t) + '"></i>' : ''}</button>`;
        presets.innerHTML = allPreset.map(t => mkBtn(t, tags.includes(t))).join('') + freeTags.map(t => mkBtn(t, true)).join('');
    }
    function initTagEvents() {
        Object.entries(TAG_KEY_MAP).forEach(([key, cfg]) => {
            const addBtn = $(cfg.add);
            if(addBtn) addBtn.addEventListener('click', () => {
                const v = prompt('新增单次标签：输入标签名，将标记在当前编辑项上', '');
                if(v && v.trim()) { const t = v.trim(); if(!tagState[key].includes(t)) tagState[key].push(t); renderTagRow(key); }
            });
            const mgr = $(cfg.mgr);
            if(mgr) mgr.addEventListener('click', () => {
                const c = getCustomTags();
                const hint = c.length ? '当前预设：' + c.join('、') + '\n\n输入新预设直接回车添加；输入「-标签名」删除预设（如 -热血）' : '输入新预设标签（内置 原设/自设 固定不可删）';
                const v = prompt(hint, '');
                if(v && v.trim()) {
                    if(v.trim().startsWith('-')) { const t = v.trim().slice(1).trim(); saveCustomTags(c.filter(x => x !== t)); Object.keys(TAG_KEY_MAP).forEach(k => renderTagRow(k)); }
                    else if(!c.includes(v.trim())) { c.push(v.trim()); saveCustomTags(c); Object.keys(TAG_KEY_MAP).forEach(k => renderTagRow(k)); }
                }
            });
        });
        document.addEventListener('click', (e) => {
            const del = e.target.closest('.tag-del');
            if(del) {
                e.stopPropagation();
                const k = del.dataset.k, t = del.dataset.t;
                tagState[k] = tagState[k].filter(x => x !== t);
                renderTagRow(k);
                return;
            }
            const pbtn = e.target.closest('.tag-preset-btn');
            if(pbtn) {
                const k = pbtn.dataset.k, t = pbtn.dataset.t;
                // v7.9j：原设/自设互斥——点亮其一自动熄灭另一个（仅这两个内置标签互斥，自定义预设可共存）
                if(t === '原设' || t === '自设') {
                    if(tagState[k].includes(t)) tagState[k] = tagState[k].filter(x => x !== t);
                    else {
                        const peer = t === '原设' ? '自设' : '原设';
                        tagState[k] = tagState[k].filter(x => x !== peer);
                        tagState[k].push(t);
                    }
                } else {
                    tagState[k] = tagState[k].includes(t) ? tagState[k].filter(x => x !== t) : [...tagState[k], t];
                }
                renderTagRow(k);
            }
        });
    }

