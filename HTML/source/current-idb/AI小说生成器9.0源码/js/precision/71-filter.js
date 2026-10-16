    // 精准模式三库模糊搜索（v6.0）：仅匹配名称，大小写不敏感 includes；DOM 显隐不重建，
    // 勾选状态/选中高亮天然保留。空关键词显示全部，无匹配时列表内提示。
    function applyPrecisionFilter(type) {
        const cfg = {
            char:   { inp: 'precCharSearch',   list: 'precisionCharList',   clear: 'precCharSearchClear' },
            action: { inp: 'precActionSearch', list: 'precisionActionList', clear: 'precActionSearchClear' },
            costume:{ inp: 'precCostumeSearch',list: 'precisionCostumeList',clear: 'precCostumeSearchClear' }
        }[type];
        if(!cfg) return;
        const inp = $(cfg.inp), list = $(cfg.list), clearBtn = $(cfg.clear);
        const kw = (inp && inp.value || '').trim().toLowerCase();
        if(clearBtn) clearBtn.style.display = kw ? 'block' : 'none';
        if(!list) return;
        let visible = 0;
        list.querySelectorAll('.precision-card').forEach(card => {
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

