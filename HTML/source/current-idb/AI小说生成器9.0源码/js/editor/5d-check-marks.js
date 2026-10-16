    function findQuoteInEditor(el, q) {
        const tryFind = (s) => {
            if(!s) return null;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            while(walker.nextNode()) {
                const node = walker.currentNode;
                const pos = node.textContent.indexOf(s);
                if(pos !== -1) return { node, pos, len: s.length };
            }
            return null;
        };
        let r = tryFind(q);
        if(r) return r;
        const trimQ = q.replace(/^[\s\u3000，。！？；：""''（）《》、—…·]+|[\s\u3000，。！？；：""''（）《》、—…·]+$/g, '');
        if(trimQ && trimQ !== q) { r = tryFind(trimQ); if(r) return r; }
        const shortQ = q.slice(0, 20);
        if(shortQ && shortQ !== q) { r = tryFind(shortQ); if(r) return r; }
        return null;
    }

    // v8.4.1-⑥-b：正文标色——按 quote 全部标出（统一标黄）；定位失败标 _miss（灰显）
    function applyCheckMarks(chap) {
        const el = $('novelContent'); if(!el || !chap || !chap.checkResult || !chap.checkResult.length) return;
        if(polishMode) return; // v8.5.2-P3-4：润色预览态禁止叠加检测标色（防 check-mark 嵌进 polish 红绿 mark 视觉错乱）
        clearCheckMarks();
        const color = '#F0C05A'; // v8.4.1-⑥-b：统一标黄（取消多色循环）
        let applied = 0;
        // v8.4.2：只标实质问题（high/mid），low 提示性条目不与面板同步标色；mark 带 data-check-idx 供面板条目点击定位
        (chap.checkResult || []).filter(c => (c.severity || 'mid') !== 'low').forEach((conf, idx) => {
            conf._miss = false;
            const q = conf.quote || conf.location || '';
            if(!q) { conf._miss = true; return; } // v8.4.2：无 quote 标灰显，点击提示无法定位
            const hit = findQuoteInEditor(el, q);
            if(hit) {
                try {
                    const rg = document.createRange();
                    rg.setStart(hit.node, hit.pos);
                    rg.setEnd(hit.node, hit.pos + hit.len);
                    const mark = document.createElement('mark');
                    mark.className = 'check-mark'; // v8.4-P1.1：专属类名，clearCheckMarks 只清检查标色，不误剥润色 mark
                    mark.dataset.checkIdx = String(idx); // v8.4.2：面板条目点击定位索引
                    mark.style.background = color + '33';
                    mark.style.color = '#EDEAF2';
                    mark.style.padding = '0 1px';
                    mark.style.borderRadius = '3px';
                    mark.style.borderBottom = '2px solid ' + color;
                    rg.surroundContents(mark);
                    applied++;
                } catch(e) { conf._miss = true; } // v8.5.3-P3-3：quote 跨节点包围失败也置灰显（原不标色不置 miss，点击显示"未找到"）
            } else {
                conf._miss = true;
            }
        });
        checkMarksActive = applied > 0;
    }

    // v8.4-③-b：剥离正文 <mark>（保存/切章/关面板时调用，防污染 chap.content）
    function clearCheckMarks() {
        const el = $('novelContent'); if(!el) return;
        // v8.4-P1.1：只剥离检查标色（.check-mark），润色预览的 mark 不受影响
        el.querySelectorAll('mark.check-mark').forEach(m => { const t = document.createTextNode(m.textContent); m.replaceWith(t); });
        checkMarksActive = false;
    }

    
