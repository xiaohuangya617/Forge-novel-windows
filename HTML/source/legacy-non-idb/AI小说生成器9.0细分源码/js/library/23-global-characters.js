    function renderGlobalCharList() {
        const container = $('globalCharList'); if(!container) return;
        container.innerHTML = '';
        if(globalCharacters.length===0) { container.innerHTML='<div style="padding:12px;color:#6A627A;">暂无素材角色</div>'; return; }
        globalCharacters.forEach(char => {
            const div = document.createElement('div');
            div.className = `item-card ${currentEditingGlobalCharId===char.id?'active':''}`;
            div.dataset.name = char.name;
            div.dataset.tags = (char.tags || []).join(","); // v7.7 标签检索
            div.innerHTML = `<div class="item-name">${escapeHtml(char.name)}</div><div class="item-preview">${escapeHtml(char.appearance||'').slice(0,20)}</div><div class="item-actions"><button class="small-btn edit-global-char" data-id="${escapeHtml(char.id)}">编辑</button><button class="small-btn del-global-char" data-id="${escapeHtml(char.id)}" style="background:#4A2A2A;">删除</button></div>`;
            div.querySelector('.edit-global-char').addEventListener('click',()=> editGlobalCharacter(char.id));
            div.querySelector('.del-global-char').addEventListener('click',()=> { if(confirm(`删除素材角色「${char.name}」？`)) deleteGlobalCharacter(char.id); });
            container.appendChild(div);
        });
        applyLibFilter('globalChar');
    }
    function editGlobalCharacter(id) {
        const char = globalCharacters.find(c=>c.id==id);
        if(char) {
            currentEditingGlobalCharId = id;
            ['globalCharName','globalCharAppearance','globalCharPersonality','globalCharSpecial','globalCharRelation'].forEach((elId,i) => {
                let el = $(elId); if(el) el.value = [char.name,char.appearance,char.personality,char.special,char.relationship][i] || '';
            });
            tagState.globalChar = normTags(char.tags); renderTagRow('globalChar'); // v7.7 标签回显
            renderGlobalCharList();
        } else toast("未找到该素材角色");
    }
    function saveGlobalCharacter() {
        const nameVal = $('globalCharName')?.value.trim(); if(!nameVal) { toast("请输入角色名"); return; }
        // v7.5：名称唯一校验（各自库内）
        if(globalCharacters.some(c => c.name.trim() === nameVal && tagsEqual(c.tags, tagState.globalChar) && c.id !== (currentEditingGlobalCharId || ''))) { toast("⚠️ 名称已存在（同名称且标签相同），无法新增"); return; }
        const newChar = { id: currentEditingGlobalCharId || uuid(), name: nameVal,
            appearance: $('globalCharAppearance')?.value || '', personality: $('globalCharPersonality')?.value || '',
            special: $('globalCharSpecial')?.value || '', relationship: $('globalCharRelation')?.value || '', tags: normTags(tagState.globalChar) };
        if(currentEditingGlobalCharId) {
            const idx = globalCharacters.findIndex(c=>c.id==currentEditingGlobalCharId);
            if(idx!==-1) { const oldChar = globalCharacters[idx]; newChar.relationships = Array.isArray(oldChar.relationships) ? oldChar.relationships : []; globalCharacters[idx] = newChar; } // v6.6：编辑素材角色保留旧 relationships（与 saveCurrentCharacter 同款修复）
            else { globalCharacters.push(newChar); toast("原素材角色已被删除，已保存为新角色"); }
        } else { globalCharacters.push(newChar); }
        currentEditingGlobalCharId = null; clearGlobalCharForm(); if(!persistOrWarn()) return; renderGlobalCharList();
        toast("素材角色已保存");
    }
    function deleteGlobalCharacter(id) { // v8.6-r21：仿 deleteCharacter 清理其他角色指向它的悬空 relationships（防导出/导入扩散无主边）
        globalCharacters = globalCharacters.filter(c=>c.id!=id);
        const sid = String(id);
        globalCharacters.forEach(c => { if(Array.isArray(c.relationships)) c.relationships = c.relationships.filter(r => String(r && r.targetId) !== sid); });
        if(currentEditingGlobalCharId==id) clearGlobalCharForm(); if(!persistOrWarn()) return; renderGlobalCharList(); toast("素材角色已删除"); }
    function clearGlobalCharForm() {
        ['globalCharName','globalCharAppearance','globalCharPersonality','globalCharSpecial','globalCharRelation'].forEach(id => { let el=$(id); if(el) el.value=''; });
        tagState.globalChar = []; renderTagRow('globalChar'); // v7.7 清空标签
        currentEditingGlobalCharId = null; renderGlobalCharList();
    }
    function addGlobalCharacter() { clearGlobalCharForm(); currentEditingGlobalCharId=null; $('globalCharName')?.focus(); }
    function exportGlobalCharsToJson() { if(!globalCharacters.length) { toast("素材角色库为空"); return; } const blob = new Blob([JSON.stringify(globalCharacters,null,2)], {type:"application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `material_characters_${fmtStamp()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("已导出"); }
    function importGlobalCharsFromJson(file) { const reader = new FileReader(); reader.onload = e => { try { const parsed = JSON.parse(e.target.result); let imported = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.characters) ? parsed.characters : null); if(!imported) throw new Error('无有效角色数组'); let added=0; const idMap = new Map(); const copies = []; imported.forEach(item => { if(item && item.name && typeof item.name==='string') { const copy = JSON.parse(JSON.stringify(item)); const oldId = String(copy.id || ''); const newId = uuid(); if(oldId) idMap.set(oldId, newId); copy.id = newId; copy.relationships = Array.isArray(copy.relationships) ? copy.relationships : []; copies.push(copy); added++; } }); copies.forEach(copy => { // v7.3 用户拍板：关系无脑带走——targetId 在本次导入/导出集合内则重映射到新 ID，不在则保留原值（不因目标角色未选中而过滤删除）
                copy.relationships = Array.isArray(copy.relationships) ? copy.relationships.map(r => (r && idMap.has(String(r.targetId))) ? ({ ...r, targetId: idMap.get(String(r.targetId)) }) : r).filter(Boolean) : []; }); copies.forEach(c => globalCharacters.push(c)); if(added) { saveAll(); renderGlobalCharList(); toast(`已导入 ${added} 个角色`); } else toast("无有效角色"); } catch(err) { toast("解析失败"); } }; reader.readAsText(file); }

