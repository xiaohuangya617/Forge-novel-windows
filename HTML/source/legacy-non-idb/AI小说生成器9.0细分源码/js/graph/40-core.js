// ======================== 人物关系图 ========================
    let relationNodePositions = {};
    let graphDragging = null, graphDragOx=0, graphDragOy=0;
    let graphSuppressClickUntil = 0; // v6.5：时间戳抑制（此前布尔标志依赖"下一次 click 消耗"，拖动中 renderRelationGraph 重建节点后 click 不触发导致标志残留，下一次正常点击被吞）
    // v6.4：布局恒为方形（取消环形布局，默认方形，重置也是方形）
    let graphLayoutMode = 'square';
    let graphCanvasH = 0;
    let graphCanvasW = 0; // v6.9 窗口自适应：画布宽固化，不随容器实时漂移
    let graphSnapGrid = false; // v6.2：方形布局网格吸附开关（仅方形生效，持久化到书）
    const NODE_W = 80, NODE_H = 50;
    const RELATION_PALETTE = ['#3B8ED4','#7F77DD','#1D9E75','#378ADD','#D85A30','#D4537E','#EF9F27','#639922','#BA7517','#993556','#185FA5','#0F6E56','#534AB7','#854F0B','#72243E','#3C3489'];
    let relationColorMap = {};
    function getRelationColor(type) { if(!relationColorMap[type]) { const keys = Object.keys(relationColorMap); relationColorMap[type] = RELATION_PALETTE[keys.length % RELATION_PALETTE.length]; } return relationColorMap[type]; }

    function edgeIntersect(cx, cy, tx, ty) {
        const dx = tx - cx, dy = ty - cy;
        if(Math.abs(dx)<0.001 && Math.abs(dy)<0.001) return {x:cx, y:cy};
        const hw = NODE_W/2, hh = NODE_H/2; let tMin = Infinity;
        if(dx > 0) tMin = Math.min(tMin, hw/dx); if(dx < 0) tMin = Math.min(tMin, -hw/dx);
        if(dy > 0) tMin = Math.min(tMin, hh/dy); if(dy < 0) tMin = Math.min(tMin, -hh/dy);
        return { x: cx + dx*tMin, y: cy + dy*tMin };
    }

    function loadRelationPositions(book) { if(!book.relationPositions) book.relationPositions = {}; relationNodePositions = JSON.parse(JSON.stringify(book.relationPositions)); }
    function saveRelationPositions(book) { book.relationPositions = JSON.parse(JSON.stringify(relationNodePositions)); }

    function openRelationGraph() {
        const book = getCurrentBook(); if(!book) { toast("请先选择小说"); return; }
        initCharactersIfNeeded(book); initCharRelations(book);
        const relationBookName = $('relationBookName'); if(relationBookName) relationBookName.innerText = book.name;
        const modal = $('relationGraphModal'); if(modal) modal.style.display='flex';
        relationColorMap = {}; loadRelationPositions(book);
        // v6.4：布局恒为方形（兼容存量 relationLayoutMode:'ring' 存档，统一按 square 处理）
        graphLayoutMode = 'square';
        // v6.5：旧环形存档自动迁移——ring 标记的旧坐标仍是环形排布，打开时清空位置让方形重新排布
        if(book.relationLayoutMode && book.relationLayoutMode !== 'square') {
            relationNodePositions = {}; book.relationPositions = {}; book.relationLayoutMode = 'square'; book.relationCanvasH = 0;
        }
        graphCanvasH = (book.relationCanvasH && book.relationCanvasH > 0) ? book.relationCanvasH : 0;
        graphCanvasW = (book.relationCanvasW && book.relationCanvasW > 0) ? book.relationCanvasW : 0;
        // v6.9 窗口自适应：画布宽首开取容器宽并持久化，此后 viewBox 宽不随窗口漂移
        // （节点/区域坐标是绝对 viewBox 坐标，旧逻辑每次重绘取实时容器宽，窗口调小后重绘会裁掉右侧内容）
        if(graphCanvasW <= 0) { const c0 = $('graphContainer'); graphCanvasW = (c0 && c0.clientWidth) ? c0.clientWidth : 880; book.relationCanvasW = graphCanvasW; }
        // v6.2：恢复网格吸附开关状态（存书）
        graphSnapGrid = book.graphSnapGrid === true;
        updateGraphSnapBtn();
        // v6.4：加载区域数据 + 默认激活页签 0 + 渲染页签
        loadGraphRegions(book);
        graphActiveTab = 0;
        renderRegionTabs();
        fitCanvasToContent(); saveAll();
        renderRelationGraph();
    }

    // v6.2：方形布局网格吸附——开关切换 + 持久化到书 + 按钮高亮
    function toggleGraphSnap() {
        const book = getCurrentBook(); if(!book) return;
        graphSnapGrid = !graphSnapGrid;
        book.graphSnapGrid = graphSnapGrid;
        saveAll();
        updateGraphSnapBtn();
        toast(graphSnapGrid ? '网格吸附已开启（方形布局，间隔 0.5 单位）' : '网格吸附已关闭');
    }
    function updateGraphSnapBtn() {
        const btn = $('graphSnapBtn');
        if(!btn) return;
        if(graphSnapGrid) { btn.classList.add('active'); btn.title = '网格吸附开启（方形布局生效）'; }
        else { btn.classList.remove('active'); btn.title = '网格吸附（方形布局生效）'; }
    }

