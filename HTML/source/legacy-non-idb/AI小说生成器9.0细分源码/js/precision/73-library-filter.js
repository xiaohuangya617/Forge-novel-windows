    // 四库管理弹窗模糊搜索（v6.1）：复用精准搜索模式——仅匹配名称、DOM 显隐不重建、
    // 编辑/选中状态天然保留。char=本书角色 / globalChar=素材角色 / action=全局动作 / costume=全局服装
    function applyLibFilter(type) {
        const cfg = {
            char:       { inp: 'libCharSearch',       list: 'charList',       clear: 'libCharSearchClear' },
            globalChar: { inp: 'libGlobalCharSearch', list: 'globalCharList', clear: 'libGlobalCharSearchClear' },
            action:     { inp: 'libActionSearch',     list: 'actionList',     clear: 'libActionSearchClear' },
            costume:    { inp: 'libCostumeSearch',    list: 'costumeList',    clear: 'libCostumeSearchClear' }
        }[type];
        if(!cfg) return;
        const inp = $(cfg.inp), list = $(cfg.list), clearBtn = $(cfg.clear);
        const kw = (inp && inp.value || '').trim().toLowerCase();
        if(clearBtn) clearBtn.style.display = kw ? 'block' : 'none';
        if(!list) return;
        let visible = 0;
        list.querySelectorAll('.item-card').forEach(card => {
            const hit = !kw || (card.dataset.name || '').toLowerCase().includes(kw) || (card.dataset.tags || '').toLowerCase().includes(kw); // v7.7 名称+标签模糊匹配
            card.style.display = hit ? '' : 'none';
            if(hit) visible++;
        });
        let empty = list.querySelector('.precision-empty');
        if(!kw) { if(empty) empty.remove(); return; }
        if(visible === 0) {
            if(!empty) { empty = document.createElement('div'); empty.className = 'precision-empty'; empty.innerText = '无匹配项'; list.appendChild(empty); }
        } else if(empty) { empty.remove(); }
    }
    