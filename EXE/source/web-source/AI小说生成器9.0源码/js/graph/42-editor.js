    let relationEditCharId = null;
    // v8.6-④：关系图角色右键高亮（白底黑字）——状态按书存 localStorage（刷新保持）
    function getGraphHighlights(bookId) { try { const v = localStorage.getItem('graph_hl_' + bookId); if(!v) return []; const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch(e) { return []; } } // v8.7-F16：高亮键只接受数组——JSON 为对象时返回 []（原原样返回对象，new Set(obj) 抛 "object is not iterable"）
    function toggleGraphHighlight(bookId, charId) {
        const hl = getGraphHighlights(bookId);
        const i = hl.indexOf(charId);
        if(i === -1) hl.push(charId); else hl.splice(i, 1);
        try { localStorage.setItem('graph_hl_' + bookId, JSON.stringify(hl)); } catch(e) {}
    }
    function graphNodeClick(charId) { if(Date.now() < graphSuppressClickUntil) return; const book = getCurrentBook(); if(!book) return; const char = book.characters.find(c=>c.id===charId); if(!char) return; initCharRelations(book); char.relationships = char.relationships || []; relationEditCharId = charId; const nameSpan = $('relEditCharName'); if(nameSpan) nameSpan.textContent = char.name; const select = $('relTargetSelect'); if(select) { select.innerHTML = '<option value="">选择目标角色...</option>'; book.characters.forEach(c=>{ if(c.id!==charId) { const opt=document.createElement('option'); opt.value=c.id; opt.textContent=c.name; select.appendChild(opt); } }); } renderRelationEditList(book, char); const inp = $('relTypeInput'); if(inp) inp.value = ''; const modal = $('relationEditModal'); if(modal) modal.style.display = 'flex'; }
    function renderRelationEditList(book, char) { const list = $('relExistingList'); if(!list) return; if(!char.relationships.length) { list.innerHTML = '<span style="color:#6A627A;">暂无关系</span>'; return; } let html = ''; char.relationships.forEach((r,i)=>{ const target = book.characters.find(c=>String(c.id)===String(r.targetId)); html += `<span style="display:inline-block;background:#1A1825;border-radius:12px;padding:2px 10px;margin:2px 4px;font-size:0.7rem;">${escapeHtml(r.type)} → ${escapeHtml(target?target.name:'?')} <i class="fas fa-times" style="cursor:pointer;opacity:0.6;margin-left:4px;" data-del="${i}" title="删除此关系"></i></span>`; }); list.innerHTML = html; list.querySelectorAll('[data-del]').forEach(icon=>{ icon.addEventListener('click',(e)=>{ e.stopPropagation(); const idx = parseInt(icon.getAttribute('data-del')); if(!isNaN(idx) && idx>=0 && idx<char.relationships.length) { const removed = char.relationships[idx]; char.relationships.splice(idx,1); cleanupRelationColor(removed.type); if(!persistOrWarn()) return; renderRelationGraph(); renderRelationEditList(book, char); toast('已删除：'+char.name+' → '+removed.type); } }); }); }
    function cleanupRelationColor(type) { const book = getCurrentBook(); if(!book) return; initCharRelations(book); const stillUsed = book.characters.some(c => (c.relationships||[]).some(r => r.type === type)); if(!stillUsed) delete relationColorMap[type]; }
    function addRelationFromModal() { const book = getCurrentBook(); if(!book) return; const char = book.characters.find(c=>c.id===relationEditCharId); if(!char) return; const select = $('relTargetSelect'); const inp = $('relTypeInput'); if(!select || !inp) return; const targetId = select.value; const relType = inp.value.trim(); if(!targetId) { toast('请选择目标角色'); return; } if(!relType) { toast('请输入关系名称'); return; } char.relationships = char.relationships || []; if(char.relationships.some(r=>r.targetId===targetId && r.type===relType)) { toast('此关系已存在'); return; } char.relationships.push({ targetId, type: relType }); if(!persistOrWarn()) return; renderRelationGraph(); renderRelationEditList(book, char); inp.value = ''; const target = book.characters.find(c=>c.id===targetId); toast('已添加：'+char.name+' → '+relType+' → '+(target?target.name:'?')); }
    function closeRelationEdit() { const modal = $('relationEditModal'); if(modal) modal.style.display = 'none'; relationEditCharId = null; }
    function resetGraphLayout() { const book = getCurrentBook(); relationNodePositions = {}; relationColorMap = {}; graphLayoutMode = 'square'; graphCanvasH = 0; graphCanvasW = 0; if(book) { book.relationPositions = {}; book.relationLayoutMode = 'square'; book.relationCanvasH = 0; book.relationCanvasW = 0; saveAll(); } fitCanvasToContent(); saveAll(); renderRelationGraph(); toast('布局已重置'); }

    // 方形棋盘布局（v5.8）：先还原环形基准（清空位置，顺序=角色数组顺序），
    // 再按棋盘式网格逐个排列；格距自动压缩保证一屏显示（SVG 等比缩放），
    // 节点间距 ≥12px，数学上永不重叠。
    function applySquareLayout() {
        const book = getCurrentBook(); if(!book) return;
        initCharactersIfNeeded(book);
        const container = $('graphContainer'); if(!container) return;
        const chars = book.characters;
        if(!chars.length) { toast('暂无角色'); return; }
        // v6.9 修正：网格宽度含区域占位——区域可能比容器/画布宽，若网格只按画布宽排，
        // fit 后画布变宽则节点整体偏左；取 max(画布, 区域右缘) 保证网格与最终画布一致
        let regionMaxX = 0;
        graphRegions.forEach(rg => { const rsz = calcRegionSize(rg.size); regionMaxX = Math.max(regionMaxX, rg.x + rsz.w/2); });
        const W = Math.max((graphCanvasW > 0) ? graphCanvasW : (container.clientWidth || 880), regionMaxX);
        relationNodePositions = {}; // ① 还原环形基准
        // ② 自适应格距：标准 92×62，超目标高度则等比压缩
        // 最小格距绑定节点尺寸（NODE_W+8 / NODE_H+6）→ 数学上永不重叠；
        // 再超出画布时由 viewBox 整体等比缩小（格距与节点同比例缩，仍不重叠，字略小）
        const GAP = 12, minCellW = NODE_W + 8, minCellH = NODE_H + 6;
        let cellW = NODE_W + GAP, cellH = NODE_H + GAP;
        const targetH = (container.clientHeight || 600) - 30;
        for(let iter = 0; iter < 20; iter++) {
            const cols = Math.max(1, Math.floor((W - 40) / cellW));
            const rows = Math.ceil(chars.length / cols);
            const needH = rows * cellH + 60;
            if(needH <= targetH || cellW <= minCellW || cellH <= minCellH) break;
            const scale = Math.max(0.85, Math.min(0.95, (targetH - 60) / (rows * cellH)));
            cellW = Math.max(minCellW, Math.floor(cellW * scale));
            cellH = Math.max(minCellH, Math.floor(cellH * scale));
        }
        const cols = Math.max(1, Math.floor((W - 40) / cellW));
        const rows = Math.ceil(chars.length / cols);
        const startX = (W - cols * cellW) / 2 + cellW / 2; // 水平居中
        const startY = 30 + cellH / 2;                      // 顶部留边
        // ③ 按角色数组顺序填棋盘格
        chars.forEach((c, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            relationNodePositions[c.id] = { x: startX + col * cellW, y: startY + row * cellH };
        });
        // ④ 画布尺寸统一由 fitCanvasToContent 按「节点+区域」包围盒决定——旧逻辑只按节点行数算
        // 画布高（rows*cellH+60），重置后区域超出画布被裁、viewBox 高度不足导致画布下沉/卡片大小变化
        graphLayoutMode = 'square';
        // ⑤ 持久化 + 重绘（fit 会把节点+区域包围盒写入 book.relationCanvasW/H）
        book.relationPositions = JSON.parse(JSON.stringify(relationNodePositions));
        book.relationLayoutMode = 'square';
        fitCanvasToContent();
        saveAll(); renderRelationGraph();
        toast(`方形布局：${chars.length} 个角色已按网格排列`);
    }
    function addRelationDirect() { const book = getCurrentBook(); if(!book) return; initCharactersIfNeeded(book); if(book.characters.length<2) { toast('至少需要两个角色'); return; } toast('请点击关系图中的角色节点来添加关系'); }

