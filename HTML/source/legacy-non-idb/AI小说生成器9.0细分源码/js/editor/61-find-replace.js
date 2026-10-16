    // ======================== 查找替换 ========================
    let findQuery = '', findIndex = 0, findTotal = 0;
    function showFindBar(replaceMode) {
        // v5.9：生成期间禁止打开查找替换（正文锁定的一部分——Ctrl+F/H 快捷键不走 findBtn 按钮，
        // 必须在此拦截，防替换绕过 contentEditable=false 修改正文）
        if(isGenerating) { toast('AI 生成中，查找替换已锁定'); return; }
        const bar = $('findBar'); if(!bar) return; bar.style.display = 'flex'; const repInp = $('replaceInput'); if(repInp) repInp.style.display = replaceMode ? '' : 'none'; const repBtns = document.querySelectorAll('#replaceOneBtn,#replaceAllBtn'); repBtns.forEach(b=>b.style.display=replaceMode?'':'none'); const fi = $('findInput'); if(fi) { fi.focus(); fi.select(); } resetFindState(); }
    function hideFindBar() { const bar = $('findBar'); if(bar) bar.style.display = 'none'; resetFindState(); }
    function unwrapHighlights() { const el = $('novelContent'); if(!el) return; el.querySelectorAll('.find-highlight').forEach(s=>{ s.parentNode.replaceChild(document.createTextNode(s.textContent), s); }); el.normalize(); }
    function resetFindState() { unwrapHighlights(); findQuery = ''; findIndex = 0; findTotal = 0; const countEl = $('findCount'); if(countEl) countEl.textContent = ''; }
    function doFind() {
        const el = $('novelContent'), inp = $('findInput'); if(!el || !inp) return;
        const q = inp.value; if(!q) { resetFindState(); return; }
        unwrapHighlights(); findQuery = q;
        // v8.6-r15：跨节点匹配——冲突标色 <mark> 把文本切成多段，跨段词匹配不到；先剥离合并文本，查找完成后再按需重标
        const marks = el.querySelectorAll('mark.check-mark');
        if(marks.length) { marks.forEach(mk => mk.replaceWith(document.createTextNode(mk.textContent))); el.normalize(); }
        const parts = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        while(walker.nextNode()) { const node = walker.currentNode, text = node.textContent; let pos = 0, idx = text.indexOf(q, pos); while(idx !== -1) { parts.push({node, start:idx, end:idx+q.length}); pos = idx + q.length; idx = text.indexOf(q, pos); } } // v8.7-F13：非重叠匹配（原 pos=idx+1 产生重叠匹配，如 'aaa' 查 'aa' 得 2 处），后续基于旧节点偏移包裹 Range 时偏移失效抛 IndexSizeError
        findTotal = parts.length;
        if(findTotal===0) { const c=$('findCount'); if(c)c.textContent='无结果'; const cur0 = getCurrentBook(); const ch0 = cur0 && cur0.currentChapterId ? cur0.chapters.find(x=>x.id===cur0.currentChapterId) : null; if(conflictVisible && ch0 && ch0.checkResult && ch0.checkResult.length) applyCheckMarks(ch0); return; } // v8.6-r15：无结果也恢复冲突标色
        if(findIndex>=findTotal) findIndex=0;
        // 从尾部循环包裹（避免前置节点位置失效）；surroundContents 可能失败（跨节点/结构），
        // 成功后重新编号（弃用原始 i），保证 data-idx 连续、findTotal 与实际高亮一致
        const highlights = [];
        for(let i=parts.length-1;i>=0;i--) { const p=parts[i]; try { const r=document.createRange(); r.setStart(p.node,p.start); r.setEnd(p.node,p.end); const s=document.createElement('span'); s.className='find-highlight'; r.surroundContents(s); highlights.push(s); } catch(_) {} } // v8.7-F13：Range 创建/设置/环绕全部包 try——偏移失效时跳过该匹配而非抛未捕获 IndexSizeError（原 setStart/setEnd 在 try 外）
        highlights.reverse().forEach((node, idx) => { node.dataset.idx = idx; });
        findTotal = highlights.length;
        if(findIndex>=findTotal && findTotal>0) findIndex=findTotal-1;
        const c=$('findCount'); if(c)c.textContent=`${findIndex+1}/${findTotal}`; scrollToMatch();
        // v8.6-r15：查找完成恢复冲突标色（若面板开着且剥离过）
        const cur2 = getCurrentBook(); const chap2 = cur2 && cur2.currentChapterId ? cur2.chapters.find(x=>x.id===cur2.currentChapterId) : null;
        if(conflictVisible && chap2 && chap2.checkResult && chap2.checkResult.length) applyCheckMarks(chap2);
    }
    function scrollToMatch() { const el=$('novelContent'); if(!el)return; const all=el.querySelectorAll('.find-highlight'); all.forEach(s=>s.classList.remove('active')); const cur=el.querySelector(`.find-highlight[data-idx="${findIndex}"]`); if(cur){ cur.classList.add('active'); cur.scrollIntoView({block:'center',behavior:'smooth'}); } }
    function findNext() { if(!findTotal) { doFind(); return; } findIndex=(findIndex+1)%findTotal; scrollToMatch(); const c=$('findCount'); if(c)c.textContent=`${findIndex+1}/${findTotal}`; }
    function findPrev() { if(!findTotal) { doFind(); return; } findIndex=(findIndex-1+findTotal)%findTotal; scrollToMatch(); const c=$('findCount'); if(c)c.textContent=`${findIndex+1}/${findTotal}`; }
    function replaceOne() { if(isGenerating || polishMode) { if(polishMode) toast('润色预览中，请先应用或取消'); return; } const repInp=$('replaceInput'); if(!repInp||!findTotal||!findQuery) return; const replacement=repInp.value; if(!replacement && !confirm('替换为空串将删除匹配内容，确定继续？')) return; unwrapHighlights(); const el=$('novelContent'); if(!el)return; const marks = el.querySelectorAll('mark.check-mark'); if(marks.length) { marks.forEach(mk => mk.replaceWith(document.createTextNode(mk.textContent))); el.normalize(); } // v8.6-补15'：替换前剥离冲突标色 mark 合并文本（防跨节点漏替换），替换完成后 doFind 会重新标色
        let count=0; const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false); while(walker.nextNode()) { const node=walker.currentNode, text=node.textContent; let pos=0, idx=text.indexOf(findQuery,pos); while(idx!==-1) { if(count===findIndex) { node.textContent=text.slice(0,idx)+replacement+text.slice(idx+findQuery.length); markContentDirty(); banterPanelInvalidate(false); findIndex = count; if(findQuery === replacement) { findIndex++; } doFind(); return; } count++; pos=idx+findQuery.length; idx=text.indexOf(findQuery,pos); } } }
    function replaceAll() { if(isGenerating || polishMode) { if(polishMode) toast('润色预览中，请先应用或取消'); return; } const repInp=$('replaceInput'); if(!repInp||!findTotal||!findQuery) return; const replacement=repInp.value; if(!replacement && !confirm('替换为空串将删除全部匹配内容，确定继续？')) return; unwrapHighlights(); const el=$('novelContent'); if(!el)return; const marks = el.querySelectorAll('mark.check-mark'); if(marks.length) { marks.forEach(mk => mk.replaceWith(document.createTextNode(mk.textContent))); el.normalize(); } // v8.6-补15'：替换前剥离冲突标色 mark 合并文本（防跨节点漏替换），替换完成后 doFind 会重新标色
        let total=0; const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false); while(walker.nextNode()) { const node=walker.currentNode, text=node.textContent; let count=0, pos=0, idx=text.indexOf(findQuery,pos); while(idx!==-1) { count++; pos=idx+1; idx=text.indexOf(findQuery,pos); } if(count>0) { node.textContent=text.split(findQuery).join(replacement); total+=count; } } markContentDirty(); banterPanelInvalidate(false); findIndex=0; doFind(); toast(`已替换 ${total} 处`); }
    function initFindKeys() {
        document.addEventListener('keydown', (e) => {
            const ae = document.activeElement;
            // 只排除表单输入（INPUT/TEXTAREA），正文 contenteditable 不排除——
            // 查找替换本就是正文功能，正文聚焦时 Ctrl+F/H 应打开应用查找栏而非浏览器原生查找
            const inInput = ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA');
            if((e.ctrlKey||e.metaKey) && e.key==='f' && !inInput) { e.preventDefault(); showFindBar(false); }
            if((e.ctrlKey||e.metaKey) && e.key==='h' && !inInput) { e.preventDefault(); showFindBar(true); }
        });
        const el = $('novelContent'); if(!el) return;
        el.addEventListener('keydown', (e) => { if(e.key==='Escape') { hideFindBar(); } });
        const fi = $('findInput'); if(fi) { fi.addEventListener('keydown', (e) => { if(e.key==='Enter') { e.preventDefault(); findNext(); } }); let findDebounce = null; fi.addEventListener('input', () => { if(findDebounce) clearTimeout(findDebounce); findDebounce = setTimeout(doFind, 150); }); } // v7.4 E3 修复：查找输入 150ms 防抖
        const ri = $('replaceInput'); if(ri) ri.addEventListener('keydown', (e) => { if(e.key==='Enter') { e.preventDefault(); replaceOne(); } });
        const findBtn = $('findBtn'); if(findBtn) findBtn.onclick = ()=>showFindBar(false);
        ['findPrevBtn','findNextBtn','replaceOneBtn','replaceAllBtn','closeFindBtn'].forEach(id => { const btn = $(id); if(!btn) return; const fn = { findPrevBtn: findPrev, findNextBtn: findNext, replaceOneBtn: replaceOne, replaceAllBtn: replaceAll, closeFindBtn: hideFindBar }[id]; if(fn) btn.onclick = fn; });
    }

