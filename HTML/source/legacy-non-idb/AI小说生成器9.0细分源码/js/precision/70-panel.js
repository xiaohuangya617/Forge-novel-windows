// ======================== 精准模式 ========================
    let precisionTempChars = [], precisionTempActions = [], precisionTempCostumes = [];

    function renderPrecisionPanel(initFromBook = true) {
        const book = getCurrentBook(); if(!book) return;
        initCharactersIfNeeded(book);
        if(initFromBook) {
            precisionTempChars = [...(book.precisionChars||[])];
            precisionTempActions = [...(book.precisionActions||[])];
            precisionTempCostumes = [...(book.precisionCostumes||[])];
        }        // 角色列表
        const charList = $('precisionCharList'), actionList = $('precisionActionList'), costumeList = $('precisionCostumeList');
        const charTotal = $('precCharTotal'), actionTotal = $('precActionTotal'), costumeTotal = $('precCostumeTotal');
        if(charTotal) charTotal.innerText = `(${book.characters.length})`;
        if(actionTotal) actionTotal.innerText = `(${globalActions.length})`;
        if(costumeTotal) costumeTotal.innerText = `(${globalCostumes.length})`;
        if(!charList || !actionList || !costumeList) return;
        charList.innerHTML = ''; actionList.innerHTML = ''; costumeList.innerHTML = '';
        book.characters.forEach(c => {
            const div = document.createElement('div');
            const selected = precisionTempChars.includes(c.id);
            div.className = `precision-card ${selected ? 'selected' : ''}`;
            div.dataset.name = c.name;
            div.dataset.tags = (c.tags || []).join(','); // v7.7 标签检索
            div.innerHTML = `<input type="checkbox" data-id="${escapeHtml(c.id)}" ${selected ? 'checked' : ''}><div class="pc-info"><div class="pc-name">${escapeHtml(c.name)}</div><div class="pc-desc">${escapeHtml((c.appearance||'') + (c.personality ? ' · ' + c.personality : '')).slice(0,35)}</div></div><div class="pc-badge char">角色</div>`;
            div.addEventListener('click', (e) => { if(e.target.tagName !== 'INPUT') { const cb = div.querySelector('input'); cb.checked = !cb.checked; togglePrecisionItem(c.id, 'char', cb.checked); } });
            div.querySelector('input').addEventListener('change', (e) => { togglePrecisionItem(c.id, 'char', e.target.checked); });
            charList.appendChild(div);
        });
        globalActions.forEach(a => {
            const div = document.createElement('div');
            const selected = precisionTempActions.includes(a.id);
            div.className = `precision-card ${selected ? 'selected' : ''}`;
            div.dataset.name = a.name;
            div.dataset.tags = (a.tags || []).join(','); // v7.7 标签检索
            div.innerHTML = `<input type="checkbox" data-id="${escapeHtml(a.id)}" ${selected ? 'checked' : ''}><div class="pc-info"><div class="pc-name">${escapeHtml(a.name)}</div><div class="pc-desc">${escapeHtml((a.keyPoints||'').slice(0,35))}</div></div><div class="pc-badge action">动作</div>`;
            div.addEventListener('click', (e) => { if(e.target.tagName !== 'INPUT') { const cb = div.querySelector('input'); cb.checked = !cb.checked; togglePrecisionItem(a.id, 'action', cb.checked); } });
            div.querySelector('input').addEventListener('change', (e) => { togglePrecisionItem(a.id, 'action', e.target.checked); });
            actionList.appendChild(div);
        });
        globalCostumes.forEach(a => {
            const div = document.createElement('div');
            const selected = precisionTempCostumes.includes(a.id);
            div.className = `precision-card ${selected ? 'selected' : ''}`;
            div.dataset.name = a.name;
            div.dataset.tags = (a.tags || []).join(','); // v7.7 标签检索
            div.innerHTML = `<input type="checkbox" data-id="${escapeHtml(a.id)}" ${selected ? 'checked' : ''}><div class="pc-info"><div class="pc-name">${escapeHtml(a.name)}</div><div class="pc-desc">${escapeHtml((a.styleDetail||'').slice(0,35))}</div></div><div class="pc-badge costume">服装</div>`;
            div.addEventListener('click', (e) => { if(e.target.tagName !== 'INPUT') { const cb = div.querySelector('input'); cb.checked = !cb.checked; togglePrecisionItem(a.id, 'costume', cb.checked); } });
            div.querySelector('input').addEventListener('change', (e) => { togglePrecisionItem(a.id, 'costume', e.target.checked); });
            costumeList.appendChild(div);
        });
        updatePrecisionCounts();
        // 重建后重放当前搜索词（selectAll/取消等触发重建时搜索不丢）
        applyPrecisionFilter('char'); applyPrecisionFilter('action'); applyPrecisionFilter('costume');
    }

