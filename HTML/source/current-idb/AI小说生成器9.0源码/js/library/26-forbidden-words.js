    function renderForbiddenList() { const book = getCurrentBook(); if(!book) return; initForbiddenWordsIfNeeded(book); const container = $('forbiddenList'); if(!container) return; container.innerHTML = ''; if(book.forbiddenWords.length===0) { container.innerHTML='<div style="padding:12px;color:#6A627A;">暂无禁用词</div>'; return; } book.forbiddenWords.forEach(item => { if(!item.id) item.id = uuid(); const div = document.createElement('div'); div.className = `item-card ${currentEditingForbiddenId===item.id?'active':''}`; div.innerHTML = `<div class="item-name">${escapeHtml(item.word)}</div><div class="item-actions"><button class="small-btn edit-forbidden" data-fid="${escapeHtml(item.id)}">编辑</button><button class="small-btn del-forbidden" data-fid="${escapeHtml(item.id)}" style="background:#4A2A2A;">删除</button></div>`; div.querySelector('.edit-forbidden').addEventListener('click',()=> editForbiddenWord(item.id)); div.querySelector('.del-forbidden').addEventListener('click',async ()=> { if(await appConfirmAsync(`删除禁用词「${item.word}」？`)) deleteForbiddenWord(item.id); }); container.appendChild(div); }); }
    function editForbiddenWord(fid) { const book = getCurrentBook(); const item = book?.forbiddenWords.find(f=>f.id===fid); if(item) { currentEditingForbiddenId = fid; const forbiddenWordInput = $('forbiddenWordInput'); if(forbiddenWordInput) forbiddenWordInput.value = item.word; renderForbiddenList(); } }
    function saveForbiddenWord() {
        const book = getCurrentBook(); if(!book) return; initForbiddenWordsIfNeeded(book);
        let word = $('forbiddenWordInput')?.value.trim(); if(!word) { toast("请输入要禁用的词"); return; }
        let isDuplicate = (currentEditingForbiddenId !== null && book.forbiddenWords.find(f=>f.id===currentEditingForbiddenId))
            ? book.forbiddenWords.some(f => f.id !== currentEditingForbiddenId && f.word === word)
            : book.forbiddenWords.some(f => f.word === word);
        if(isDuplicate) { toast("该禁用词已存在"); return; }
        const existing = book.forbiddenWords.find(f=>f.id===currentEditingForbiddenId);
        if(existing) { existing.word = word; }
        else { book.forbiddenWords.push({ id: uuid(), word }); if(currentEditingForbiddenId) toast("原禁用词已被删除，已保存为新词条"); }
        currentEditingForbiddenId = null; clearForbiddenForm(); if(!persistOrWarn()) return; renderForbiddenList();
        toast("禁用词已保存");
    }
    function deleteForbiddenWord(fid) { const book = getCurrentBook(); if(book) { book.forbiddenWords = book.forbiddenWords.filter(f=>f.id!==fid); if(currentEditingForbiddenId === fid) clearForbiddenForm(); if(!persistOrWarn()) return; renderForbiddenList(); toast("禁用词已删除"); } }
    function clearForbiddenForm() { const forbiddenWordInput = $('forbiddenWordInput'); if(forbiddenWordInput) forbiddenWordInput.value = ''; currentEditingForbiddenId = null; renderForbiddenList(); }
    