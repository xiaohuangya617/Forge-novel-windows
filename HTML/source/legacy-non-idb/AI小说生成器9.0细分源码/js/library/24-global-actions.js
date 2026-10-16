    function renderActionList() {
        const container = $('actionList'); if(!container) return;
        container.innerHTML = '';
        if(globalActions.length===0) { container.innerHTML='<div style="padding:12px;color:#6A627A;">暂无动作</div>'; return; }
        globalActions.forEach(action => {
            const div = document.createElement('div');
            div.className = `item-card ${currentEditingGlobalActionId===action.id?'active':''}`;
            div.dataset.name = action.name;
            div.innerHTML = `<div class="item-name">${escapeHtml(action.name)}</div><div class="item-preview">${escapeHtml(action.keyPoints||'').slice(0,20)}</div><div class="item-actions"><button class="small-btn edit-global-action" data-id="${escapeHtml(action.id)}">编辑</button><button class="small-btn del-global-action" data-id="${escapeHtml(action.id)}" style="background:#4A2A2A;">删除</button></div>`;
            div.querySelector('.edit-global-action').addEventListener('click',()=> editGlobalAction(action.id));
            div.querySelector('.del-global-action').addEventListener('click',()=> { if(confirm(`删除动作「${action.name}」？`)) deleteGlobalAction(action.id); });
            container.appendChild(div);
        });
        applyLibFilter('action');
    }
    function editGlobalAction(id) {
        const action = globalActions.find(a=>a.id==id);
        if(action) {
            currentEditingGlobalActionId = id;
            ['globalActionName','globalActionKeyPoints','globalActionLines','globalActionDescriptionTips'].forEach((elId,i) => {
                let el = $(elId); if(el) el.value = [action.name,action.keyPoints,action.linesUsage,action.descriptionTips][i] || '';
            });
            renderActionList();
        } else toast("未找到动作");
    }
    function saveGlobalAction() {
        const nameVal = $('globalActionName')?.value.trim(); if(!nameVal) { toast("请输入动作名称"); return; }
        // v7.5：名称唯一校验（各自库内）
        if(globalActions.some(a => a.name.trim() === nameVal && a.id !== (currentEditingGlobalActionId || ''))) { toast("⚠️ 名称已存在，无法新增"); return; }
        const newAction = { id: currentEditingGlobalActionId || uuid(), name: nameVal,
            keyPoints: $('globalActionKeyPoints')?.value || '', linesUsage: $('globalActionLines')?.value || '',
            descriptionTips: $('globalActionDescriptionTips')?.value || '' };
        if(currentEditingGlobalActionId) {
            const idx = globalActions.findIndex(a=>a.id==currentEditingGlobalActionId);
            if(idx!==-1) globalActions[idx] = newAction;
            else { globalActions.push(newAction); toast("原动作已被删除，已保存为新动作"); }
        } else { globalActions.push(newAction); }
        currentEditingGlobalActionId = null; clearGlobalActionForm(); if(!persistOrWarn()) return; renderActionList();
        toast("动作已保存");
    }
    function deleteGlobalAction(id) { globalActions = globalActions.filter(a=>a.id!=id); if(currentEditingGlobalActionId==id) clearGlobalActionForm();
        // v6.5：删除全局动作时清理所有书精准模式中的旧 ID（防界面计数与实际注入不一致）
        books.forEach(b => { if(b.precisionActions) b.precisionActions = b.precisionActions.filter(pid => String(pid) !== String(id)); });
        if(!persistOrWarn()) return; renderActionList(); updatePrecisionButton(); // v6.7：删除后立即刷新精准按钮（所有书 precisionActions 已清，当前书按钮同步）
        toast("动作已删除"); }
    function clearGlobalActionForm() {
        ['globalActionName','globalActionKeyPoints','globalActionLines','globalActionDescriptionTips'].forEach(id => { let el=$(id); if(el) el.value=''; });
        currentEditingGlobalActionId = null; renderActionList();
    }
    function addGlobalAction() { clearGlobalActionForm(); currentEditingGlobalActionId=null; $('globalActionName')?.focus(); }
    function exportGlobalActionsToJson() { if(!globalActions.length) { toast("动作库为空"); return; } const blob = new Blob([JSON.stringify(globalActions,null,2)], {type:"application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `global_actions_${fmtStamp()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("已导出"); }
    function importGlobalActionsFromJson(file) { const reader = new FileReader(); reader.onload = e => { try { const imported = JSON.parse(e.target.result); if(!Array.isArray(imported)) throw new Error(); let added=0; imported.forEach(item => { if(item.name && typeof item.name==='string') { globalActions.push({ id:uuid(), name:item.name, keyPoints:item.keyPoints||'', linesUsage:item.linesUsage||'', descriptionTips:item.descriptionTips||'' }); added++; } }); globalActions.forEach(a => { delete a.tags; }); if(added) { saveAll(); renderActionList(); toast(`已导入 ${added} 个动作`); } else toast("无有效动作"); } catch(err) { toast("解析失败"); } }; reader.readAsText(file); }

