    // 精准搜索框事件绑定（input 实时过滤 + ✕ 清除）
    function bindPrecisionSearch() {
        const bind = (inpId, clearId, type) => {
            const inp = $(inpId); if(!inp) return;
            inp.addEventListener('input', () => applyPrecisionFilter(type));
            const clearBtn = $(clearId);
            if(clearBtn) clearBtn.addEventListener('click', () => { inp.value = ''; applyPrecisionFilter(type); inp.focus(); });
        };
        bind('precCharSearch', 'precCharSearchClear', 'char');
        bind('precActionSearch', 'precActionSearchClear', 'action');
        bind('precCostumeSearch', 'precCostumeSearchClear', 'costume');
    }

