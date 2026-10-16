    function captureImportState() {
        const storage = {};
        try { for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) storage[k]=localStorage.getItem(k); } } catch(_) {}
        return { books:JSON.parse(JSON.stringify(books)), currentBookId, globalCharacters:JSON.parse(JSON.stringify(globalCharacters)), globalActions:JSON.parse(JSON.stringify(globalActions)), globalCostumes:JSON.parse(JSON.stringify(globalCostumes)), scratchpadPages:JSON.parse(JSON.stringify(scratchpadPages || [])), scratchpadContent, layoutPrefs:JSON.parse(JSON.stringify(layoutPrefs)), storage };
    }
    function restoreImportState(state) {
        if(!state) return;
        books=state.books; currentBookId=state.currentBookId; globalCharacters=state.globalCharacters; globalActions=state.globalActions; globalCostumes=state.globalCostumes; scratchpadPages=state.scratchpadPages; scratchpadContent=state.scratchpadContent; layoutPrefs=state.layoutPrefs;
        try {
            const now=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) now.push(k); }
            now.forEach(k=>{ if(!(k in state.storage)) localStorage.removeItem(k); });
            Object.entries(state.storage).forEach(([k,v])=>localStorage.setItem(k,v));
        } catch(_) {}
        try { renderBookshelf(); if(currentBookId && books.some(b=>String(b.id)===String(currentBookId))) switchBook(currentBookId, true); else loadCurChapter(); } catch(_) {}
    }
    async 