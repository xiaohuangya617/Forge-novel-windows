    // ======================== 角色库 ========================
    function renderCharacterList() {
        const book = getCurrentBook(); if(!book) return;
        initCharactersIfNeeded(book);
        const container = $('charList'); if(!container) return;
        container.innerHTML = '';
        if(book.characters.length===0) { container.innerHTML='<div style="padding:12px;color:#6A627A;">暂无角色</div>'; return; }
        book.characters.forEach(char => {
            const div = document.createElement('div');
            div.className = `item-card ${currentEditingCharId===char.id?'active':''}`;
            div.dataset.name = char.name;
            div.dataset.tags = (char.tags || []).join(","); // v7.7 标签检索
            div.innerHTML = `<div class="item-name">${escapeHtml(char.name)}</div><div class="item-preview">${escapeHtml(char.appearance||'').slice(0,20)}</div><div class="item-actions"><button class="small-btn edit-char" data-id="${escapeHtml(char.id)}">编辑</button><button class="small-btn del-char" data-id="${escapeHtml(char.id)}" style="background:#4A2A2A;">删除</button></div>`;
            div.querySelector('.edit-char').addEventListener('click',()=> editCharacter(char.id));
            div.querySelector('.del-char').addEventListener('click',async ()=> { if(await appConfirmAsync(`删除角色「${char.name}」？`)) deleteCharacter(char.id); });
            container.appendChild(div);
        });
        applyLibFilter('char');
    }
    // 本书角色库导出 JSON（v5.8）：下载当前书的全部角色为 JSON 文件（可长期保存/迁移）
    function exportBookCharsJson() {
        const book = getCurrentBook();
        if(!book) { toast("请先选择小说"); return; }
        initCharactersIfNeeded(book);
        if(!book.characters.length) { toast("当前小说无角色可导出"); return; }
        const data = { bookName: book.name, exportedAt: new Date().toISOString(), characters: book.characters };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${sanitizeFilename(book.name)}_角色库_${fmtStamp()}.json`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(`已导出 ${book.characters.length} 个角色`);
    }
    function editCharacter(id) {
        const book = getCurrentBook(); const char = book.characters.find(c=>c.id==id);
        if(char) {
            currentEditingCharId = id;
            ['charName','charAppearance','charPersonality','charSpecial','charRelation'].forEach((elId,i) => {
                let el = $(elId); if(el) el.value = [char.name,char.appearance,char.personality,char.special,char.relationship][i] || '';
            });
            tagState.char = normTags(char.tags); renderTagRow('char'); // v7.7 标签回显
            // v7.1 成长经历只读展示
            const gBox = $('charGrowthBox'); const gList = $('charGrowthList');
            if(gBox && gList) {
                if(char.growth && char.growth.length) {
                    gBox.style.display = '';
                    const gSorted = char.growth.slice().sort((a,b) => (a.chapNo||0) - (b.chapNo||0));
                    gList.innerText = gSorted.map(g => '第' + (g.chapNo || '?') + '章：' + g.text).join('\n');
                } else { gBox.style.display = ''; gList.innerText = '暂无'; }
            }
            renderCharacterList();
        } else toast("未找到该角色");
    }
    function saveCurrentCharacter() {
        const book = getCurrentBook(); if(!book) return;
        initCharactersIfNeeded(book);
        const nameVal = $('charName')?.value.trim();
        if(!nameVal) { toast("请输入姓名"); return; }
        // v7.5：名称唯一校验（各自库内；新增+改名都拦；旧重复不提示）
        // v7.7 查重联动：同名 + 标签集合完全相同（含都为空）才拦；标签有任一不同视为不同项放行
        if(book.characters.some(c => c.name.trim() === nameVal && tagsEqual(c.tags, tagState.char) && c.id !== (currentEditingCharId || ''))) { toast("⚠️ 名称已存在（同名称且标签相同），无法新增"); return; }
        const newChar = { id: currentEditingCharId || uuid(), name: nameVal,
            appearance: $('charAppearance')?.value || '', personality: $('charPersonality')?.value || '',
            special: $('charSpecial')?.value || '', relationship: $('charRelation')?.value || '', tags: normTags(tagState.char) };
        // v6.5：编辑已有角色时保留旧 relationships（关系图数据）——此前整体覆盖导致该角色全部关系丢失
        if(currentEditingCharId) {
            const idx = book.characters.findIndex(c=>c.id==currentEditingCharId);
            if(idx!==-1) { const oldChar = book.characters[idx]; newChar.relationships = Array.isArray(oldChar.relationships) ? oldChar.relationships : []; newChar.growth = Array.isArray(oldChar.growth) ? oldChar.growth : []; book.characters[idx] = newChar; }
            else { book.characters.push(newChar); toast("原角色已被删除，已保存为新角色"); }
        } else { book.characters.push(newChar); }
        currentEditingCharId = null; clearCharForm(); if(!persistOrWarn()) return; renderCharacterList();
        toast("角色已保存");
    }
    function deleteCharacter(id) {
        const book = getCurrentBook();
        if(!book) return;
        // 清理所有角色中指向该角色的关系
        book.characters.forEach(c => {
            if(c.relationships) c.relationships = c.relationships.filter(r => String(r.targetId) !== String(id)); // v6.9：String 包装兼容 ID 类型（历史数据字符串/数字混存时脏关系清不掉）
        });
        // 清理关系图缓存：删除该角色的位置数据
        if(relationNodePositions[id]) delete relationNodePositions[id];
        if(book.relationPositions && book.relationPositions[id]) { delete book.relationPositions[id]; saveAll(); }
        // 清理不再被任何角色使用的关系颜色
        const remainingTypes = new Set();
        book.characters.forEach(c => { (c.relationships||[]).forEach(r => remainingTypes.add(r.type)); });
        Object.keys(relationColorMap).forEach(t => { if(!remainingTypes.has(t)) delete relationColorMap[t]; });
        // v6.5：删除角色时同步清理本书精准模式中的旧 ID（防界面计数与实际注入不一致）
        if(book.precisionChars) book.precisionChars = book.precisionChars.filter(pid => String(pid) !== String(id));
        book.characters = book.characters.filter(c=>c.id!=id);
        if(currentEditingCharId==id) clearCharForm();
        if(!persistOrWarn()) return; renderCharacterList(); updatePrecisionButton(); // v6.7：删除后立即刷新精准按钮（唯一选项被删时按钮状态与实际模式一致）
        toast("角色已删除");
    }
    function clearCharForm() {
        ['charName','charAppearance','charPersonality','charSpecial','charRelation'].forEach(id => { let el=$(id); if(el) el.value=''; });
        tagState.char = []; renderTagRow('char'); // v7.7 清空标签
        // v7.1：新增角色时成长栏展示空态（灰色只读）
        const gBox = $('charGrowthBox'); const gList = $('charGrowthList');
        if(gBox) gBox.style.display = '';
        if(gList) gList.innerText = '暂无';
        currentEditingCharId = null; renderCharacterList();
    }

