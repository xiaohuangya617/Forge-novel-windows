    function renderCostumeList() {
        const container = $('costumeList'); if(!container) return;
        container.innerHTML = '';
        if(globalCostumes.length===0) { container.innerHTML='<div style="padding:12px;color:#6A627A;">暂无服装</div>'; return; }
        globalCostumes.forEach(costume => {
            const div = document.createElement('div');
            div.className = `item-card ${currentEditingGlobalCostumeId===costume.id?'active':''}`;
            div.dataset.name = costume.name;
            div.dataset.tags = (costume.tags || []).join(","); // v7.7 标签检索
            div.innerHTML = `<div class="item-name">${escapeHtml(costume.name)}</div><div class="item-preview">${escapeHtml(costume.styleDetail||'').slice(0,20)}</div><div class="item-actions"><button class="small-btn edit-global-costume" data-id="${escapeHtml(costume.id)}">编辑</button><button class="small-btn del-global-costume" data-id="${escapeHtml(costume.id)}" style="background:#4A2A2A;">删除</button></div>`;
            div.querySelector('.edit-global-costume').addEventListener('click',()=> editGlobalCostume(costume.id));
            div.querySelector('.del-global-costume').addEventListener('click',async ()=> { if(await appConfirmAsync(`删除服装「${costume.name}」？`)) deleteGlobalCostume(costume.id); });
            container.appendChild(div);
        });
        applyLibFilter('costume');
    }
    function editGlobalCostume(id) {
        const costume = globalCostumes.find(a=>a.id==id);
        if(costume) {
            currentEditingGlobalCostumeId = id;
            ['globalCostumeName','globalCostumeStyle','globalCostumeDescTips'].forEach((elId,i) => {
                let el = $(elId); if(el) el.value = [costume.name,costume.styleDetail,costume.descriptionTips][i] || '';
            });
            tagState.costume = normTags(costume.tags); renderTagRow('costume'); // v7.7 标签回显
            renderCostumeList();
        } else toast("未找到服装");
    }
    function saveGlobalCostume() {
        const nameVal = $('globalCostumeName')?.value.trim(); if(!nameVal) { toast("请输入服装名称"); return; }
        // v7.5：名称唯一校验（各自库内）
        if(globalCostumes.some(a => a.name.trim() === nameVal && tagsEqual(a.tags, tagState.costume) && a.id !== (currentEditingGlobalCostumeId || ''))) { toast("⚠️ 名称已存在（同名称且标签相同），无法新增"); return; }
        const newCostume = { id: currentEditingGlobalCostumeId || uuid(), name: nameVal,
            styleDetail: $('globalCostumeStyle')?.value || '', descriptionTips: $('globalCostumeDescTips')?.value || '', tags: normTags(tagState.costume) };
        if(currentEditingGlobalCostumeId) {
            const idx = globalCostumes.findIndex(a=>a.id==currentEditingGlobalCostumeId);
            if(idx!==-1) globalCostumes[idx] = newCostume;
            else { globalCostumes.push(newCostume); toast("原服装已被删除，已保存为新服装"); }
        } else { globalCostumes.push(newCostume); }
        currentEditingGlobalCostumeId = null; clearGlobalCostumeForm(); if(!persistOrWarn()) return; renderCostumeList();
        toast("服装已保存");
    }
    function deleteGlobalCostume(id) { globalCostumes = globalCostumes.filter(a=>a.id!=id); if(currentEditingGlobalCostumeId==id) clearGlobalCostumeForm();
        // v6.5：删除全局服装时清理所有书精准模式中的旧 ID（防界面计数与实际注入不一致）
        books.forEach(b => { if(b.precisionCostumes) b.precisionCostumes = b.precisionCostumes.filter(pid => String(pid) !== String(id)); });
        if(!persistOrWarn()) return; renderCostumeList(); updatePrecisionButton(); // v6.7：删除后立即刷新精准按钮（所有书 precisionCostumes 已清，当前书按钮同步）
        toast("服装已删除"); }
    function clearGlobalCostumeForm() {
        ['globalCostumeName','globalCostumeStyle','globalCostumeDescTips'].forEach(id => { let el=$(id); if(el) el.value=''; });
        tagState.costume = []; renderTagRow('costume'); // v7.7 清空标签
        currentEditingGlobalCostumeId = null; renderCostumeList();
    }
    function addGlobalCostume() { clearGlobalCostumeForm(); currentEditingGlobalCostumeId=null; $('globalCostumeName')?.focus(); }
    function exportGlobalCostumesToJson() { if(!globalCostumes.length) { toast("服装库为空"); return; } const blob = new Blob([JSON.stringify(globalCostumes,null,2)], {type:"application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `global_costumes_${fmtStamp()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("已导出"); }
    function importGlobalCostumesFromJson(file) { const reader = new FileReader(); reader.onload = e => { try { const imported = JSON.parse(e.target.result); if(!Array.isArray(imported)) throw new Error(); let added=0; imported.forEach(item => { if(item.name && typeof item.name==='string') { globalCostumes.push({ id:uuid(), name:item.name, styleDetail:item.styleDetail||'', descriptionTips:item.descriptionTips||'' }); added++; } }); if(added) { saveAll(); renderCostumeList(); toast(`已导入 ${added} 个服装`); } else toast("无有效服装"); } catch(err) { toast("解析失败"); } }; reader.readAsText(file); }

    function batchImport() { if(!globalCharacters.length) { toast("素材角色库为空"); return; } const modalDiv = document.createElement('div'); modalDiv.className='modal'; modalDiv.style.display='flex'; modalDiv.innerHTML = `<div class="modal-card batch-import-modal"><h3>从素材库导入角色</h3><div class="precision-search"><i class="fas fa-search"></i><input type="text" id="batchImportSearch" placeholder="搜索角色…"><i class="fas fa-times precision-clear" id="batchImportSearchClear"></i></div><div class="batch-import-list" id="importListContainer"></div><div class="modal-buttons"><button id="confirmBatchImport" class="glass-btn">确认导入</button><button id="cancelBatchImport" class="glass-btn">取消</button></div></div>`; document.body.appendChild(modalDiv); const container = modalDiv.querySelector('#importListContainer'); globalCharacters.forEach(item => { const label = document.createElement('label'); const safeId = escapeHtml(item.id); /* v8.7-F01：完整转义属性 ID（原先仅 .replace(/"/g,'&quot;') 不防 &/< 逃逸）；getAttribute 读取时实体解码回原文 */
            label.innerHTML = `<input type="checkbox" data-id="${safeId}"> <span class="item-name">${escapeHtml(item.name)}</span>`; container.appendChild(label); }); // v7.4：弹窗搜索（CSS 过滤，选中状态保留）
        const impSearch = modalDiv.querySelector('#batchImportSearch'); const impClear = modalDiv.querySelector('#batchImportSearchClear');
        if(impSearch) impSearch.addEventListener('input', () => { const kw = impSearch.value.trim(); const items = container.querySelectorAll('label'); let shown = 0; items.forEach(l => { const nm = l.querySelector('.item-name'); const hit = !kw || (nm ? nm.textContent.includes(kw) : false); l.style.display = hit ? '' : 'none'; if(hit) shown++; }); let tip = container.querySelector('.batch-empty-tip'); if(!shown) { if(!tip) { tip = document.createElement('div'); tip.className='batch-empty-tip'; tip.style.cssText='padding:12px;color:#6A627A;font-size:0.7rem;'; tip.textContent='无匹配角色'; container.appendChild(tip); } } else if(tip) tip.remove(); });
        if(impClear) impClear.onclick = () => { if(impSearch) { impSearch.value=''; impSearch.dispatchEvent(new Event('input')); } }; modalDiv.querySelector('#confirmBatchImport').onclick = () => { const book = getCurrentBook(); if(!book) { toast("请先选择小说"); modalDiv.remove(); return; } let imported=0; const idMap = new Map(); const copies = []; modalDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => { const id = cb.getAttribute('data-id'); const original = globalCharacters.find(s => String(s.id) === String(id)); if(original) { const copy = JSON.parse(JSON.stringify(original)); const oldId = copy.id; const newId = uuid(); idMap.set(String(oldId), newId); copy.id = newId; copy.relationships = Array.isArray(copy.relationships) ? copy.relationships : []; copies.push(copy); } }); copies.forEach(copy => { // v7.3 用户拍板：关系无脑带走——targetId 在本次导入/导出集合内则重映射到新 ID，不在则保留原值（不因目标角色未选中而过滤删除）
                copy.relationships = Array.isArray(copy.relationships) ? copy.relationships.map(r => (r && idMap.has(String(r.targetId))) ? ({ ...r, targetId: idMap.get(String(r.targetId)) }) : r).filter(Boolean) : []; }); if(copies.length) { initCharactersIfNeeded(book); copies.forEach(c => book.characters.push(c)); imported = copies.length; } if(imported) { saveAll(); renderCharacterList(); toast(`已导入 ${imported} 个角色`); } else toast("未选择任何项"); modalDiv.remove(); }; modalDiv.querySelector('#cancelBatchImport').onclick = () => modalDiv.remove(); }
    function batchExport() { const book = getCurrentBook(); if(!book || !book.characters.length) { toast("当前小说无角色可导出"); return; } const modalDiv = document.createElement('div'); modalDiv.className='modal'; modalDiv.style.display='flex'; modalDiv.innerHTML = `<div class="modal-card batch-import-modal"><h3>导出到素材角色库</h3><div class="precision-search"><i class="fas fa-search"></i><input type="text" id="batchExportSearch" placeholder="搜索角色…"><i class="fas fa-times precision-clear" id="batchExportSearchClear"></i></div><div class="batch-import-list" id="exportListContainer"></div><div class="modal-buttons"><button id="confirmBatchExport" class="glass-btn">确认导出</button><button id="cancelBatchExport" class="glass-btn">取消</button></div></div>`; document.body.appendChild(modalDiv); const container = modalDiv.querySelector('#exportListContainer'); book.characters.forEach(item => { const label = document.createElement('label'); const safeId = escapeHtml(item.id); /* v8.7-F01：完整转义属性 ID（原先仅 .replace(/"/g,'&quot;') 不防 &/< 逃逸）；getAttribute 读取时实体解码回原文 */
            label.innerHTML = `<input type="checkbox" data-id="${safeId}"> <span class="item-name">${escapeHtml(item.name)}</span>`; container.appendChild(label); }); // v7.4：弹窗搜索（CSS 过滤，选中状态保留）
        const expSearch = modalDiv.querySelector('#batchExportSearch'); const expClear = modalDiv.querySelector('#batchExportSearchClear');
        if(expSearch) expSearch.addEventListener('input', () => { const kw = expSearch.value.trim(); const items = container.querySelectorAll('label'); let shown = 0; items.forEach(l => { const nm = l.querySelector('.item-name'); const hit = !kw || (nm ? nm.textContent.includes(kw) : false); l.style.display = hit ? '' : 'none'; if(hit) shown++; }); let tip = container.querySelector('.batch-empty-tip'); if(!shown) { if(!tip) { tip = document.createElement('div'); tip.className='batch-empty-tip'; tip.style.cssText='padding:12px;color:#6A627A;font-size:0.7rem;'; tip.textContent='无匹配角色'; container.appendChild(tip); } } else if(tip) tip.remove(); });
        if(expClear) expClear.onclick = () => { if(expSearch) { expSearch.value=''; expSearch.dispatchEvent(new Event('input')); } }; modalDiv.querySelector('#confirmBatchExport').onclick = () => { let exported=0; const idMap = new Map(); const copies = []; modalDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => { const id = cb.getAttribute('data-id'); const original = book.characters.find(s => String(s.id) === String(id)); if(original) { const copy = JSON.parse(JSON.stringify(original)); const oldId = String(copy.id); const newId = uuid(); idMap.set(oldId, newId); copy.id = newId; copy.relationships = Array.isArray(copy.relationships) ? copy.relationships : []; copies.push(copy); } }); copies.forEach(copy => { // v7.3 用户拍板：关系无脑带走——targetId 在本次导入/导出集合内则重映射到新 ID，不在则保留原值（不因目标角色未选中而过滤删除）
                copy.relationships = Array.isArray(copy.relationships) ? copy.relationships.map(r => (r && idMap.has(String(r.targetId))) ? ({ ...r, targetId: idMap.get(String(r.targetId)) }) : r).filter(Boolean) : []; }); copies.forEach(c => { globalCharacters.push(c); exported++; }); if(exported) { saveAll(); renderGlobalCharList(); toast(`已导出 ${exported} 个角色到素材库`); } else toast("未选择任何项"); modalDiv.remove(); }; modalDiv.querySelector('#cancelBatchExport').onclick = () => modalDiv.remove(); }

