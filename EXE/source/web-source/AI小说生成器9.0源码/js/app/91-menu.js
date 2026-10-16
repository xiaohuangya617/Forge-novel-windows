    function initTopMenuScrollHint() {
        const wrap = $('topActionsWrap');
        const menu = $('topActions');
        if(!wrap || !menu) return;
        const update = () => {
            const max = Math.max(0, menu.scrollWidth - menu.clientWidth);
            const hasOverflow = max > 1;
            const atStart = menu.scrollLeft <= 1;
            const atEnd = menu.scrollLeft >= max - 1;
            wrap.classList.toggle('has-overflow', hasOverflow);
            wrap.classList.toggle('can-scroll-left', hasOverflow && !atStart);
            wrap.classList.toggle('can-scroll-right', hasOverflow && !atEnd);
        };
        menu.addEventListener('scroll', update, { passive: true });
        // 隐藏原生横向滚动条后，普通鼠标滚轮仍可在顶部菜单上横向浏览。
        menu.addEventListener('wheel', (e) => {
            if(Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            const max = Math.max(0, menu.scrollWidth - menu.clientWidth);
            if(max <= 0) return;
            const next = Math.max(0, Math.min(max, menu.scrollLeft + e.deltaY));
            if(next === menu.scrollLeft) return;
            e.preventDefault();
            menu.scrollLeft = next;
        }, { passive: false });
        window.addEventListener('resize', update, { passive: true });
        if(window.ResizeObserver) new ResizeObserver(update).observe(menu);
        requestAnimationFrame(update);
    }

    async 