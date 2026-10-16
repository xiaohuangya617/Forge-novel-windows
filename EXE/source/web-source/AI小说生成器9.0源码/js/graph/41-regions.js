    // ======================== 区域系统（v6.4） ========================
    // 区域：纯视觉分组参考（不参与创作逻辑链）。半透明框线 + 随机底色（区域间不重复）+ 名称双线框居中。
    // 页签隔离：页签0=拖人物；页签N=拖区域N；一次只激活一个，严格隔离。
    let graphRegions = [];          // [{id,name,shape,size,color,x,y}]  x/y=区域中心（viewBox 坐标）
    let graphActiveTab = 0;         // 0=人物，N=区域N
    const REGION_COLORS = ['#E05A5A','#E08A3C','#E0C03C','#7FC24E','#4EB87A','#3BA8A0','#3B8ED4','#5A6BD0','#8A5AD0','#C05AD0','#D4537E','#C07050','#9BA0A8','#E07A9A','#A0B84E','#4E9AD0','#D0A04E','#7A9AD0','#D07A8A','#5AC0A0','#B0B0D0','#D08A60','#6A8AD0','#C0C04E','#E07070','#F0A050','#D8D840','#90D050','#40C080','#30B0B8','#40A0F0','#7080E8','#A060E8','#E060A0','#F0A0A8','#B88848','#A8B0B8','#F090B0','#B0D060','#60B0F0','#E0B060','#90B0E0','#E0A0A0','#70D0B8','#C0C0E0','#E0A878','#8090E0','#D8D870','#80C8C0','#D09090'];
    const REGION_MAX = 50, REGION_SIZE_MAX = 50;
    // 最优网格拟合：N 个角色卡片（80×50）穷举列数 K，行 M=ceil(N/K)。
    // 间隔用 0.5 单位真实值（横 40px / 纵 25px，为关系线留白）；留白 0.1 单位（8px）。
    // 优先级：空位最少 → 形状接近卡片比例(80/50≈1.6) → 面积最小（避免"单行/单列"极端导致区域超宽/超高）
    function calcRegionSize(n) {
        // v8.7-F16b：无效 size 兜底——undefined/NaN/非数值一律按默认 3 处理（原 Math.min(NaN*2,100) 使循环不执行返回 null，调用处 rsz.w 崩，v4 复审实测）
        n = (typeof n === 'number' && isFinite(n)) ? Math.max(1, Math.min(50, Math.round(n))) : 3;
        n = Math.min(n * 2, 100); // v6.4 用户实测修正：区域按 2N 卡位计算包围盒——原算法只够"挤下 N 个卡片"，实际拖入角色+关系线/标签需翻倍空间（实测舒适容纳 ≈ 数值/2），故 ×2 补偿
        const CW = 80, CH = 50, GAP_X = 40, GAP_Y = 25, PAD = 8;
        let best = null;
        for(let k = 1; k <= n; k++) {
            const m = Math.ceil(n / k);
            const w = k*CW + (k-1)*GAP_X + 2*PAD;
            const h = m*CH + (m-1)*GAP_Y + 2*PAD;
            const empty = k*m - n;
            const ratioDiff = Math.abs(k/m - CW/CH);
            const area = w*h;
            if(!best || empty < best.empty || (empty === best.empty && ratioDiff < best.ratioDiff) || (empty === best.empty && ratioDiff === best.ratioDiff && area < best.area)) best = {k, m, w, h, area, empty, ratioDiff};
        }
        return best;
    }
    function loadGraphRegions(book) {
        // v8.7-F16b：区域字段级 schema 规范化——仅过滤 null/非对象不够：缺字段区域（{}/{bad:true}）会以 undefined size 进 calcRegionSize 返回 null，绘制处 rsz.w 崩（v4 复审实测）；
        // 就地校正（深拷贝上操作）：size 有限数值 1~50 默认 3、x/y 有限数值默认 100、shape 限定枚举、color 白名单（SVG fill/stroke 与页签同口径，F-14 SVG 残余一并消除）、name/id 字符串化
        graphRegions = Array.isArray(book.graphRegions) ? JSON.parse(JSON.stringify(book.graphRegions)).filter(r => r && typeof r === 'object').map(r => {
            if(typeof r.id === 'number') r.id = String(r.id);
            if(typeof r.name !== 'string') r.name = '';
            if(['rect','ellipse','hex'].indexOf(r.shape) < 0) r.shape = 'rect';
            if(!(typeof r.size === 'number' && isFinite(r.size))) r.size = 3; else r.size = Math.max(1, Math.min(50, Math.round(r.size)));
            if(!(typeof r.color === 'string' && REGION_COLORS.indexOf(r.color) >= 0)) r.color = '#3B8ED4';
            if(!(typeof r.x === 'number' && isFinite(r.x))) r.x = 100;
            if(!(typeof r.y === 'number' && isFinite(r.y))) r.y = 100;
            return r;
        }) : [];
    }
    function saveGraphRegions(book) { book.graphRegions = JSON.parse(JSON.stringify(graphRegions)); saveAll(); }
    // v7.4：关系图导出 PNG（2x 高清、暗色背景、含区域）
    function exportRelationGraph() {
        const book = getCurrentBook(); const svg = $('graphSvg');
        if(!book || !svg) return;
        if(!(book.characters || []).length) { toast("暂无角色，无法导出关系图"); return; }
        try {
            const clone = svg.cloneNode(true);
            const vb = (svg.getAttribute('viewBox') || '0 0 1200 800').split(/\s+/).map(Number);
            const vbW = Math.max(400, vb[2] || 1200), vbH = Math.max(300, vb[3] || 800);
            const ns = 'http://www.w3.org/2000/svg';
            const bg = document.createElementNS(ns, 'rect');
            bg.setAttribute('x','0'); bg.setAttribute('y','0'); bg.setAttribute('width', vbW); bg.setAttribute('height', vbH);
            bg.setAttribute('fill','#0E0D14'); // 暗色背景与 UI 一致
            clone.insertBefore(bg, clone.firstChild);
            clone.setAttribute('viewBox', '0 0 ' + vbW + ' ' + vbH);
            clone.setAttribute('width', vbW); clone.setAttribute('height', vbH);
            // v8.6-fix36：内嵌 .graph-* 相关 CSS（与 exportStatsPNG 同思路）——保证导出 SVG 与屏幕样式一致
            let graphCss = '';
            document.querySelectorAll('style').forEach(st => { if(st.textContent.indexOf('.graph-') !== -1) graphCss += st.textContent + '\n'; });
            const cloneBody = new XMLSerializer().serializeToString(clone).replace(/^<svg[^>]*>/, '');
            const xml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vbW + ' ' + vbH + '" width="' + vbW + '" height="' + vbH + '">' + (graphCss ? '<style>' + graphCss + '</style>' : '') + cloneBody;
            const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
            const img = new Image();
            img.onload = () => {
                const scale = 2; // 2x 保证清晰
                const canvas = document.createElement('canvas');
                canvas.width = vbW * scale; canvas.height = vbH * scale;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#0E0D14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = sanitizeFilename(book.name) + '_关系图_' + fmtStamp() + '.png';
                a.click();
                toast("关系图已导出为图片");
            };
            img.onerror = () => toast("导出失败：SVG 渲染异常");
            img.src = svg64;
        } catch(e) { toast("导出失败：" + e.message); }
    }

    function openRegionModal() {
        const book = getCurrentBook(); if(!book) { toast('请先选择小说'); return; }
        if(graphRegions.length >= REGION_MAX) { toast('区域数量已达上限（'+REGION_MAX+' 个）'); return; }
        const rm = $('regionModal'); if(rm) rm.style.display = 'flex';
        const inp = $('regionNameInp'); if(inp) inp.focus();
    }
    function saveRegion() {
        const book = getCurrentBook(); if(!book) return;
        const shape = $('regionShapeSel')?.value || 'rect';
        const size = parseInt($('regionSizeInp')?.value) || 0;
        const name = ($('regionNameInp')?.value || '').trim();
        if(size < 1 || size > REGION_SIZE_MAX) { toast('大小需在 1~'+REGION_SIZE_MAX+' 之间'); return; }
        if(!name) { toast('请输入区域名称'); return; }
        if(name.length > 20) { toast('名称不超过 20 字'); return; }
        if(graphRegions.length >= REGION_MAX) { toast('区域数量已达上限（'+REGION_MAX+' 个）'); return; }
        const used = new Set(graphRegions.map(r=>r.color));
        const avail = REGION_COLORS.filter(c=>!used.has(c));
        if(!avail.length) { toast('颜色池已用完，请先删除部分区域'); return; }
        const color = avail[Math.floor(Math.random()*avail.length)];
        const container = $('graphContainer');
        const svg = $('graphSvg');
        // v6.4 修正：区域初始位置用 viewBox 实际中心——方形布局 viewBox 高可能 > 容器（SVG 缩放），
        // 用 clientHeight/2 会偏上；viewBox 中心才是视觉中心
        const vb = svg && svg.viewBox && svg.viewBox.baseVal;
        const vh = vb && vb.height ? vb.height : (container ? container.clientHeight : 600);
        const cx = (graphCanvasW > 0 ? graphCanvasW : (container ? container.clientWidth : 880)) / 2, cy = vh / 2;
        graphRegions.push({ id: uuid(), name, shape, size, color, x: cx, y: cy });
        saveGraphRegions(book);
        const rm = $('regionModal'); if(rm) rm.style.display = 'none';
        const ni = $('regionNameInp'); if(ni) ni.value = '';
        renderRegionTabs(); fitCanvasToContent(); renderRelationGraph();
        toast('区域「'+name+'」已创建（'+shape+' / 容纳'+size+'角色）');
    }
    function deleteRegion(idx) {
        const book = getCurrentBook(); if(!book) return;
        // v6.4：删除当前激活页签的区域 → 自动切回页签 0（用户需求）
        if(graphActiveTab === idx + 1) graphActiveTab = 0;
        graphRegions.splice(idx, 1);
        // 删除后按新长度兜底：激活页签超出剩余区域数（页签 1~L 对应区域 1~L，tab 有效范围 0~L）→ 切回 0 防悬空
        if(graphActiveTab > graphRegions.length) graphActiveTab = 0;
        saveGraphRegions(book);
        renderRegionTabs(); fitCanvasToContent(); renderRelationGraph();
        toast('区域已删除');
    }
    // 页签渲染：0=人物，N=区域N（横向布局：名称靠左省略、✕ 放右侧；页签 0 显示"👤 人物"）
    function renderRegionTabs() {
        const tabs = $('graphRegionTabs'); if(!tabs) return;
        let html = '<div class="region-tab'+(graphActiveTab===0?' active':'')+'" data-tab="0" title="拖动人物关系"><span class="region-tab-icon">👤</span><span class="region-tab-label">人物</span></div>';
        graphRegions.forEach((r,i)=>{
            // v8.7-F14/F16：区域颜色白名单校验 + 字段守卫——r.color 原样拼入 style（备份可控制，引号逃逸生成额外属性=S0）；
            // 颜色仅接受 REGION_COLORS 色板值，非法回退默认色；name 非字符串时不再 .substring 崩溃（F-16 [{}] 实测）
            const rc = (r && typeof r.color === 'string' && REGION_COLORS.indexOf(r.color) >= 0) ? r.color : '#3B8ED4';
            const rn = (r && typeof r.name === 'string') ? r.name : '';
            html += '<div class="region-tab'+(graphActiveTab===i+1?' active':'')+'" data-tab="'+(i+1)+'" style="border-color:'+rc+';" title="'+escapeHtml(rn)+'"><span class="region-tab-name" style="color:'+rc+';">'+escapeHtml(rn.substring(0,3))+'</span><i class="fas fa-times region-tab-del" data-idx="'+i+'"></i></div>';
        });
        tabs.innerHTML = html;
        tabs.querySelectorAll('[data-tab]').forEach(el=>{
            el.addEventListener('click', (e)=>{
                if(e.target.classList.contains('region-tab-del')) return;
                graphActiveTab = parseInt(el.dataset.tab);
                renderRegionTabs();
            });
        });
        tabs.querySelectorAll('.region-tab-del').forEach(el=>{
            el.addEventListener('click', (e)=>{
                e.stopPropagation();
                deleteRegion(parseInt(el.dataset.idx));
            });
        });
    }
    // 区域拖动（仅激活页签可拖，严格隔离）
    function regionDragStart(e, region) {
        const idx = graphRegions.indexOf(region);
        if(graphActiveTab !== idx + 1) return;
        const svg = $('graphSvg'); if(!svg) return;
        const startPt = getSvgPoint(svg, e.clientX, e.clientY);
        if(!startPt) return;
        const ox = startPt.x - region.x, oy = startPt.y - region.y;
        let hasMoved = false;
        const onMove = (ev)=>{
            const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
            if(!hasMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            hasMoved = true;
            const pt = getSvgPoint(svg, ev.clientX, ev.clientY);
            if(!pt) return;
            const vb = svg.viewBox.baseVal;
            const W = vb && vb.width ? vb.width : (svg.clientWidth || 880);
            const H = vb && vb.height ? vb.height : (svg.clientHeight || 600);
            const sz = calcRegionSize(region.size);
            region.x = Math.max(sz.w/2, Math.min(W - sz.w/2, pt.x - ox));
            region.y = Math.max(sz.h/2, Math.min(H - sz.h/2, pt.y - oy));
            renderRelationGraph();
        };
        const onUp = ()=>{
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const book = getCurrentBook(); if(book) saveGraphRegions(book);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // v6.9 窗口自适应（修订版）：按内容包围盒（节点+区域含尺寸）校准画布宽高
    // 存量坐标基于旧窗口宽度布局（如 x 最大 1727 > 容器 1477），仅固化容器宽仍会被裁；
    // 改为按内容定画布：viewBox 一定包住全部节点与区域，窗口大小只影响 SVG 等比缩放
    function fitCanvasToContent() {
        const book = getCurrentBook(); const container = $('graphContainer');
        if(!book || !container) return;
        let maxX = 0, maxY = 0;
        (book.characters||[]).forEach(c => {
            const p = relationNodePositions[c.id];
            if(p) { maxX = Math.max(maxX, p.x + NODE_W/2); maxY = Math.max(maxY, p.y + NODE_H/2); }
        });
        graphRegions.forEach(r => {
            const sz = calcRegionSize(r.size);
            maxX = Math.max(maxX, r.x + sz.w/2);
            maxY = Math.max(maxY, r.y + sz.h/2);
        });
        // v6.9 修正：不加边距——画布仅扩展到内容边界，不主动加 PAD。
        // 原因：拖动 clamp 允许区域/节点贴到 viewBox 边缘（右缘=W），若此处再加 PAD，
        // 每次打开都会 +60 膨胀（拖到右下角保存后重开，区域位置右下漂移、反复膨胀）。
        // 内容贴边是用户拖出来的结果，画布保持内容刚好装下即可稳定恢复。
        const svg = $('graphSvg');
        const cw = (svg && svg.clientWidth) ? svg.clientWidth : (container.clientWidth || 880);
        const ch = container.clientHeight || 600;
        graphCanvasW = Math.max(cw, maxX);
        graphCanvasH = Math.max(ch, maxY);
        book.relationCanvasW = graphCanvasW;
        book.relationCanvasH = graphCanvasH;
    }
    // v7.0：为缺坐标角色补位——保留现有坐标，新角色从现有包围盒右下按网格追加（每行 6 个）
    function placeMissingChars(book) {
        const chars = book.characters || [];
        let maxX = 0, maxY = 0;
        chars.forEach(c => { const p = relationNodePositions[c.id]; if(p) { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); } });
        let placed = 0;
        chars.forEach(c => {
            if(relationNodePositions[c.id]) return;
            const col = placed % 6, row = Math.floor(placed / 6);
            relationNodePositions[c.id] = { x: maxX + 120 + col * (NODE_W + 30), y: Math.max(maxY, 60) + row * (NODE_H + 30) + 60 };
            placed++;
        });
        book.relationPositions = JSON.parse(JSON.stringify(relationNodePositions));
    }
    function renderRelationGraph() {
        const book = getCurrentBook(); const svg = $('graphSvg'); const container = $('graphContainer');
        if(!book || !svg || !container) return;
        initCharactersIfNeeded(book); initCharRelations(book);
        const chars = book.characters;
        // 方形模式缺坐标（新增角色无位置）：v7.0 改为补位——保留已排布局，新角色追加到现有包围盒右下方空位，
        // 旧逻辑直接 applySquareLayout 整局重排会清空手动拖拽布局
        if(graphLayoutMode === 'square' && chars.length && chars.some(c => !relationNodePositions[c.id])) {
            if(chars.some(c => relationNodePositions[c.id])) {
                // 部分缺坐标（新增角色）：补位保留已排布局
                placeMissingChars(book);
                fitCanvasToContent();
                saveAll();
            } else {
                // 全缺坐标（首次打开 / 重置布局）：整局网格重排
                applySquareLayout();
                return;
            }
        }
        // v6.9 修正：网格宽度含区域占位——区域可能比容器/画布宽，若网格只按画布宽排，
        // fit 后画布变宽则节点整体偏左；取 max(画布, 区域右缘) 保证网格与最终画布一致
        let regionMaxX = 0;
        graphRegions.forEach(rg => { const rsz = calcRegionSize(rg.size); regionMaxX = Math.max(regionMaxX, rg.x + rsz.w/2); });
        const W = Math.max((graphCanvasW > 0) ? graphCanvasW : (container.clientWidth || 880), regionMaxX);
        // 画布高：方形=内容所需高度（SVG 等比缩放实现一屏显示）；环形=容器实际高度。
        // v6.0 修复：方形且内容高度 < 容器时，viewBox 高度至少=容器高度——
        // 否则默认 xMidYMid meet 使内容垂直居中，viewBox 顶部对应 CSS 中上部，
        // 拖拽边界 clamp 后容器顶部变成死区（节点拖不到顶部区域）。
        let H = (graphLayoutMode === 'square' && graphCanvasH > 0) ? graphCanvasH : (container.clientHeight || 600);
        if(graphLayoutMode === 'square' && H < (container.clientHeight || 600)) H = container.clientHeight || 600;
        svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.innerHTML = '';
        // v6.4：空角色不 return——区域是纯视觉（允许空书创建），空角色也要渲染区域层
        if(chars.length===0) { const txt = document.createElementNS('http://www.w3.org/2000/svg','text'); txt.setAttribute('x',W/2); txt.setAttribute('y',H/2); txt.setAttribute('text-anchor','middle'); txt.setAttribute('fill','#6A627A'); txt.setAttribute('font-size','14'); txt.textContent='暂无角色，请先在角色库中添加'; svg.appendChild(txt); }
        chars.forEach((c,i)=>{ if(!relationNodePositions[c.id]) { const angle = (2*Math.PI*i)/chars.length - Math.PI/2; const rx = W/2-120, ry = H/2-100; relationNodePositions[c.id] = { x: W/2 + rx*Math.cos(angle), y: H/2 + ry*Math.sin(angle) }; } });
        const lineGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        // v8.6-fix35：高亮集循环外读一次（原每节点 JSON.parse 一次 localStorage，性能与一致性隐患）
        const hlSet = new Set(getGraphHighlights(book.id));
        const defs = document.createElementNS('http://www.w3.org/2000/svg','defs'); svg.appendChild(defs);
        const edges = []; chars.forEach(c=>{ (c.relationships||[]).forEach(r=>{ edges.push({from:c.id,to:r.targetId,type:r.type}); }); });
        const edgeMeta = edges.map(e=>{ const reverse = edges.find(r=>r.from===e.to && r.to===e.from); return {...e, isBidirectional: !!reverse, offsetSide: null}; });
        const seenPairs = new Set();
        edgeMeta.forEach(e=>{ if(!e.isBidirectional) return; const pairKey = [e.from, e.to].sort().join('|'); if(seenPairs.has(pairKey)) return; seenPairs.add(pairKey); const a = edgeMeta.find(m=>m.from===e.from && m.to===e.to); const b = edgeMeta.find(m=>m.from===e.to && m.to===e.from); if(a) a.offsetSide = 1; if(b) b.offsetSide = -1; });
        const colors = new Set(); edgeMeta.forEach(e=>{ const from = relationNodePositions[e.from], to = relationNodePositions[e.to]; if(!from||!to) return; colors.add(getRelationColor(e.type)); });
        colors.forEach(color=>{ const m = document.createElementNS('http://www.w3.org/2000/svg','marker'); m.setAttribute('id','arr-'+color.replace('#','')); m.setAttribute('viewBox','0 0 8 8'); m.setAttribute('refX','7'); m.setAttribute('refY','4'); m.setAttribute('markerWidth','5'); m.setAttribute('markerHeight','5'); m.setAttribute('orient','auto'); const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d','M0,0 L6,4 L0,8'); p.setAttribute('fill','none'); p.setAttribute('stroke',color); p.setAttribute('stroke-width','1.5'); p.setAttribute('stroke-linejoin','round'); m.appendChild(p); defs.appendChild(m); });
        const pairPerp = {};
        seenPairs.forEach(key=>{ const ids = key.split('|'); const refFrom = relationNodePositions[ids[0]], refTo = relationNodePositions[ids[1]]; if(!refFrom || !refTo) return; const rdx = refTo.x - refFrom.x, rdy = refTo.y - refFrom.y; const rlen = Math.sqrt(rdx*rdx+rdy*rdy) || 1; pairPerp[key] = { px: -rdy/rlen*14, py: rdx/rlen*14 }; });
        edgeMeta.forEach(e=>{ const from = relationNodePositions[e.from], to = relationNodePositions[e.to]; if(!from||!to) return; const color = getRelationColor(e.type); let fx = from.x, fy = from.y, tx = to.x, ty = to.y; if(e.offsetSide && e.isBidirectional) { const pairKey = [e.from, e.to].sort().join('|'); const pp = pairPerp[pairKey]; if(pp) { fx += pp.px * e.offsetSide; fy += pp.py * e.offsetSide; tx += pp.px * e.offsetSide; ty += pp.py * e.offsetSide; } } const ep1 = edgeIntersect(fx, fy, tx, ty); const ep2 = edgeIntersect(tx, ty, fx, fy); const g = document.createElementNS('http://www.w3.org/2000/svg','g'); const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',ep1.x); line.setAttribute('y1',ep1.y); line.setAttribute('x2',ep2.x); line.setAttribute('y2',ep2.y); line.setAttribute('stroke',color); line.setAttribute('stroke-width','3'); line.setAttribute('stroke-linecap','round'); line.setAttribute('marker-end','url(#arr-'+color.replace('#','')+')'); g.appendChild(line); const label = document.createElementNS('http://www.w3.org/2000/svg','text'); const midX = (fx+tx)/2, midY = (fy+ty)/2; label.setAttribute('x',midX); label.setAttribute('y',midY-10); label.setAttribute('class','graph-line-label'); label.setAttribute('fill',color); label.setAttribute('font-size','12'); label.setAttribute('text-anchor','middle'); label.setAttribute('font-weight','500'); label.textContent = e.type; g.appendChild(label); lineGroup.appendChild(g); });
        chars.forEach(c=>{ const pos = relationNodePositions[c.id]; if(!pos) return; const x = pos.x - NODE_W/2, y = pos.y - NODE_H/2; const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('data-id',c.id); g.style.cursor = 'pointer'; g.addEventListener('click',()=>{ graphNodeClick(c.id); }); g.addEventListener('contextmenu',(ev)=>{ ev.preventDefault(); toggleGraphHighlight(book.id, c.id); renderRelationGraph(); }); // v8.6-④：右键切换白底黑字高亮
        g.addEventListener('mousedown',(ev)=>{ graphNodeDragStart(ev,c.id); }); const isHl = hlSet.has(c.id); // v8.6-④：按高亮状态着色；v8.6-fix35：高亮集用 Set（循环外读取）
        const rect = document.createElementNS('http://www.w3.org/2000/svg','rect'); rect.setAttribute('x',x); rect.setAttribute('y',y); rect.setAttribute('width',NODE_W); rect.setAttribute('height',NODE_H); rect.setAttribute('rx','10'); rect.setAttribute('ry','10'); rect.setAttribute('fill', isHl ? '#FFFFFF' : '#1C1A28'); rect.setAttribute('stroke', isHl ? '#E0C85A' : '#3B8ED4'); rect.setAttribute('stroke-width','1.5'); g.appendChild(rect); const name = document.createElementNS('http://www.w3.org/2000/svg','text'); name.setAttribute('x',pos.x); name.setAttribute('y',pos.y-4); name.setAttribute('class','graph-node-text'); name.setAttribute('fill', isHl ? '#000000' : '#EDEAF2'); name.setAttribute('font-size','12'); name.setAttribute('text-anchor','middle'); name.setAttribute('pointer-events','none'); name.textContent = (c.name||'?').substring(0, 5); g.appendChild(name); const relCount = (c.relationships||[]).length; const sub = document.createElementNS('http://www.w3.org/2000/svg','text'); sub.setAttribute('x',pos.x); sub.setAttribute('y',pos.y+16); sub.setAttribute('class','graph-node-sub'); sub.setAttribute('fill', isHl ? '#333333' : '#8A84A8'); sub.setAttribute('font-size','9'); sub.setAttribute('text-anchor','middle'); sub.setAttribute('pointer-events','none'); sub.textContent = relCount ? relCount+'个关系' : '无关系'; g.appendChild(sub); nodeGroup.appendChild(g); });
        // v6.4：区域底层绘制（先于人物/关系，置于最底层；半透明底色 + 框线 + 名称双线框居中）
        if(graphRegions.length) {
            const regionGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
            graphRegions.forEach(r=>{
                const sz = calcRegionSize(r.size);
                const w = sz.w, h = sz.h;
                const rx = r.x - w/2, ry = r.y - h/2;
                const fill = r.color + '26'; // 15% 透明底色
                let shapeEl;
                if(r.shape === 'ellipse') {
                    shapeEl = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
                    shapeEl.setAttribute('cx',r.x); shapeEl.setAttribute('cy',r.y);
                    shapeEl.setAttribute('rx',w/2); shapeEl.setAttribute('ry',h/2);
                } else if(r.shape === 'hex') {
                    shapeEl = document.createElementNS('http://www.w3.org/2000/svg','polygon');
                    shapeEl.setAttribute('points', (rx+w/4)+','+ry+' '+(rx+3*w/4)+','+ry+' '+(rx+w)+','+(ry+h/2)+' '+(rx+3*w/4)+','+(ry+h)+' '+(rx+w/4)+','+(ry+h)+' '+rx+','+(ry+h/2));
                } else {
                    shapeEl = document.createElementNS('http://www.w3.org/2000/svg','rect');
                    shapeEl.setAttribute('x',rx); shapeEl.setAttribute('y',ry);
                    shapeEl.setAttribute('width',w); shapeEl.setAttribute('height',h);
                    shapeEl.setAttribute('rx',12); shapeEl.setAttribute('ry',12);
                }
                shapeEl.setAttribute('fill',fill);
                shapeEl.setAttribute('stroke',r.color);
                shapeEl.setAttribute('stroke-width','1.5');
                const g = document.createElementNS('http://www.w3.org/2000/svg','g');
                g.setAttribute('data-region',r.id);
                g.style.cursor = graphActiveTab === graphRegions.indexOf(r)+1 ? 'move' : 'default';
                g.addEventListener('mousedown',(ev)=>{ regionDragStart(ev,r); });
                g.appendChild(shapeEl);
                // 名称双线框（居中，与区域同色底色）
                const fontSize = 12, pad = 8;
                const textW = r.name.length * fontSize + pad*2;
                const textH = fontSize + 12;
                const nbx = r.x - textW/2, nby = r.y - textH/2;
                const outer = document.createElementNS('http://www.w3.org/2000/svg','rect');
                outer.setAttribute('x',nbx-2); outer.setAttribute('y',nby-2);
                outer.setAttribute('width',textW+4); outer.setAttribute('height',textH+4);
                outer.setAttribute('rx',6); outer.setAttribute('ry',6);
                outer.setAttribute('fill',r.color+'3D');
                outer.setAttribute('stroke',r.color); outer.setAttribute('stroke-width','2');
                const inner = document.createElementNS('http://www.w3.org/2000/svg','rect');
                inner.setAttribute('x',nbx); inner.setAttribute('y',nby);
                inner.setAttribute('width',textW); inner.setAttribute('height',textH);
                inner.setAttribute('rx',4); inner.setAttribute('ry',4);
                inner.setAttribute('fill','none'); inner.setAttribute('stroke',r.color); inner.setAttribute('stroke-width','1');
                const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
                txt.setAttribute('x',r.x); txt.setAttribute('y',r.y+4);
                txt.setAttribute('text-anchor','middle');
                txt.setAttribute('fill','#EDEAF2'); txt.setAttribute('font-size',fontSize);
                txt.textContent = r.name;
                g.appendChild(outer); g.appendChild(inner); g.appendChild(txt);
                regionGroup.appendChild(g);
            });
            svg.appendChild(regionGroup);
        }
        svg.appendChild(lineGroup); svg.appendChild(nodeGroup);
        // v8.6-fix35：强制重绘——Electron 软件渲染（disableHardwareAcceleration）下 SVG 全量重建后
        // 合成层可能陈旧（DOM 已更新屏幕不重绘/部分重绘），右键切换高亮、拖拽后出现"变色渲染不完整"；
        // toggle display 强制 layout+composite 刷屏（与标签高亮 v8.6-fix6 同款防御）
        try { svg.style.display = 'none'; void svg.getBoundingClientRect(); svg.style.display = ''; } catch(e) {}
    }

    // SVG 坐标转换：方形布局 viewBox 高度 > 容器时 SVG 等比缩放，CSS 像素 ≠ viewBox 坐标，
    // 拖拽必须用 createSVGPoint 逆变换，否则节点跳位
    function getSvgPoint(svg, clientX, clientY) {
        try {
            const pt = svg.createSVGPoint();
            pt.x = clientX; pt.y = clientY;
            const matrix = svg.getScreenCTM();
            if(!matrix) return null;
            const sp = pt.matrixTransform(matrix.inverse());
            return { x: sp.x, y: sp.y };
        } catch(e) { return null; }
    }
    function graphNodeDragStart(e, charId) {
        if(e.button !== 0) return; // v8.6-P3：仅左键拖拽（右键交给 contextmenu 高亮，不产生拖拽噪音）
        // v6.4：页签隔离——仅页签 0（人物）可拖人物
        if(graphActiveTab !== 0) { toast('当前为区域页签，请切回页签 0 再拖动人物'); return; }
        const svg = $('graphSvg'); if(!svg) return;
        const startPt = getSvgPoint(svg, e.clientX, e.clientY);
        if(!startPt) return;
        graphDragOx = startPt.x - relationNodePositions[charId].x;
        graphDragOy = startPt.y - relationNodePositions[charId].y;
        let hasMoved = false;
        const onMove = (ev)=>{
            const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
            if(!hasMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            hasMoved = true; graphDragging = charId;
            const pt = getSvgPoint(svg, ev.clientX, ev.clientY);
            if(!pt) return;
            // 边界限制：节点中心不超出画布
            const vb = svg.viewBox.baseVal;
            const W = vb && vb.width ? vb.width : (svg.clientWidth || 880);
            const H = vb && vb.height ? vb.height : (svg.clientHeight || 600);
            let x = Math.max(NODE_W/2, Math.min(W - NODE_W/2, pt.x - graphDragOx));
            let y = Math.max(NODE_H/2, Math.min(H - NODE_H/2, pt.y - graphDragOy));
            // v6.2：方形布局 + 网格吸附开启 → 坐标吸附到 120×75 网格（间隔 0.5 单位，
            // 方形 80×50 中心落网格点，方形间最小间距 40×25），吸附后重新 clamp 防越界
            if(graphLayoutMode === 'square' && graphSnapGrid) {
                x = Math.round(x / 120) * 120;
                y = Math.round(y / 75) * 75;
                x = Math.max(NODE_W/2, Math.min(W - NODE_W/2, x));
                y = Math.max(NODE_H/2, Math.min(H - NODE_H/2, y));
            }
            relationNodePositions[charId] = { x, y };
            renderRelationGraph();
        };
        const onUp = ()=>{ if(hasMoved) { graphDragging = null; graphSuppressClickUntil = Date.now() + 150; const book = getCurrentBook(); if(book) { saveRelationPositions(book); saveAll(); } } document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
        document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
    }

