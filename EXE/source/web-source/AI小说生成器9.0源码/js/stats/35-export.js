    function exportStatsPNG() {
        const body = $('statsBody'); if(!body || !body.children.length) { toast('暂无统计数据'); return; }
        try {
            let cssText = '';
            document.querySelectorAll('style').forEach(st => { if(st.textContent.indexOf('.stats-') !== -1) cssText += st.textContent + '\n'; });
            // v7.6 修复：克隆到弹窗外测量真实尺寸——弹窗 .modal-card 有 max-height:85vh + overflow，scrollHeight 读数不可靠导致导出缺下半部分
            const clone = document.createElement('div');
            clone.innerHTML = body.innerHTML;
            clone.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + body.offsetWidth + 'px;background:#0A0A0F;color:#EDEAF2;font-family:Inter,system-ui,sans-serif;padding:14px;box-sizing:border-box;';
            document.body.appendChild(clone);
            const width = clone.scrollWidth, height = clone.scrollHeight;
            const inner = '<style>' + cssText + '</style><div xmlns="http://www.w3.org/1999/xhtml" style="background:#0A0A0F;color:#EDEAF2;font-family:Inter,system-ui,sans-serif;padding:14px;box-sizing:border-box;width:' + width + 'px;">' + clone.innerHTML + '</div>';
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%">' + inner + '</foreignObject></svg>';
            document.body.removeChild(clone);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width * 2, height * 2);
                const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = '写作统计_' + fmtStamp() + '.png'; a.click();
                toast('统计图已导出 PNG');
            };
            img.onerror = () => toast('导出失败：图片渲染异常');
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        } catch(e) { toast('导出失败：' + e.message); }
    }
