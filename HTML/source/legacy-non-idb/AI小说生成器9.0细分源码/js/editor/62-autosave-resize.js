    function startAutoSave() { if(autoSaveInterval) clearInterval(autoSaveInterval); autoSaveInterval = setInterval(() => { if(!isGenerating && !polishMode && currentBookId) { saveCurChapter(); updateStorageIndicator(); } }, 30000); }

    function initResize() {
        const leftStack = $('leftStack'), rightSide = $('rightSide'), chatContainer = $('chatContainer'), chatInpTA = $('chatInp');
        function makeResizable(resizerId, target, minW, maxW, storageKey) {
            const resizer = $(resizerId); let startX, startWidth;
            if(resizer && target) {
                resizer.addEventListener('mousedown', (e) => { startX=e.clientX; startWidth=target.offsetWidth; document.body.style.cursor='ew-resize'; const onMove = (ev) => { let newW = Math.min(maxW, Math.max(minW, target===rightSide ? startWidth-(ev.clientX-startX) : startWidth+(ev.clientX-startX))); const parentW = (target.parentElement ? target.parentElement.clientWidth : window.innerWidth) || window.innerWidth; const otherTotal = (leftStack===target?0:leftStack.offsetWidth)+(chatContainer===target?0:chatContainer.offsetWidth)+(rightSide===target?0:rightSide.offsetWidth); if(newW+otherTotal+200>parentW) newW=parentW-otherTotal-200; if(newW<minW) newW=minW; target.style.width = newW + 'px'; }; const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); document.body.style.cursor=''; try { localStorage.setItem(storageKey, target.offsetWidth); } catch(e) {} }; document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp); e.preventDefault(); });
            }
        }
        makeResizable('resizeLeft', leftStack, 180, 400, 'left_width');
        makeResizable('resizeRight', rightSide, 200, 400, 'right_width');
        makeResizable('resizeChat', chatContainer, 280, 550, 'chat_width');
        if(chatInpTA) { let savedHeight = localStorage.getItem('chat_input_height'); if(savedHeight) chatInpTA.style.height = /^\d+$/.test(savedHeight) ? savedHeight+'px' : savedHeight; chatInpTA.addEventListener('mouseup', () => { try { localStorage.setItem('chat_input_height', chatInpTA.style.height); } catch(e) {} }); }
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(id => { let ta = $(id); if(ta) { let saved = localStorage.getItem(`textarea_${id}`); if(saved) ta.style.height = /^\d+$/.test(saved) ? saved+'px' : saved; ta.addEventListener('mouseup', () => { try { localStorage.setItem(`textarea_${id}`, ta.style.height); } catch(e) {} }); } });
        ['leftStack','rightSide','chatContainer'].forEach(id => { let el = $(id); if(!el) return; let key = id==='leftStack'?'left_width':id==='rightSide'?'right_width':'chat_width'; let saved = localStorage.getItem(key); if(saved) el.style.width = /^\d+$/.test(saved) ? saved+'px' : saved; });
    }

