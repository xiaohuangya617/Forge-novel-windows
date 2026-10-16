    // ======================== 页签闪烁提醒（v5.8，替代系统通知） ========================
    // 原理：交替修改 document.title + 页签 favicon 图标（📖 ↔ ✅/❌）实现双闪，
    // 无需任何系统权限，双击 HTML(file://) 也能生效。由 api.notify 开关控制，
    // 闪烁 30 秒自动停（后台晚点回来也看得到），切回页面立即恢复。
    // Chrome/Edge 对后台页 favicon/title 变化有原生橙色高亮响应——这就是"老版高亮闪烁"效果。
    let tabBlinkTimer = null, tabBlinkTimeout = null, tabBlinkOriginal = '', tabBlinkFavOriginal = null;
    const FAV_BOOK = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📖</text></svg>");
    const FAV_OK = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>");
    const FAV_ERR = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❌</text></svg>");
    function setFavicon(href) {
        let link = document.querySelector('link[rel="icon"]');
        if(!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = href;
    }
    function startTabBlink(text) {
        if(!api.notify) return;
        stopTabBlink();
        tabBlinkOriginal = document.title;
        const favLink = document.querySelector('link[rel="icon"]');
        tabBlinkFavOriginal = favLink ? favLink.href : FAV_BOOK;
        // 由闪烁文案自动判断成功/失败：✅ 开头=成功用 ✅ 图标，否则用 ❌ 图标
        const isOk = text.indexOf('✅') !== -1;
        const blinkFav = isOk ? FAV_OK : FAV_ERR;
        let toggle = false;
        tabBlinkTimer = setInterval(() => {
            toggle = !toggle;
            document.title = toggle ? text : tabBlinkOriginal;
            setFavicon(toggle ? blinkFav : tabBlinkFavOriginal);
        }, 800);
        tabBlinkTimeout = setTimeout(stopTabBlink, 30000);
    }
    function stopTabBlink() {
        if(tabBlinkTimer) { clearInterval(tabBlinkTimer); tabBlinkTimer = null; }
        if(tabBlinkTimeout) { clearTimeout(tabBlinkTimeout); tabBlinkTimeout = null; }
        if(tabBlinkOriginal) { document.title = tabBlinkOriginal; tabBlinkOriginal = ''; }
        if(tabBlinkFavOriginal) { setFavicon(tabBlinkFavOriginal); tabBlinkFavOriginal = null; }
    }
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') stopTabBlink(); });

