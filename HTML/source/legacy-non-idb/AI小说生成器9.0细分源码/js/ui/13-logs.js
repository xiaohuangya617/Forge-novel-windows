    // ===== v7.0：日志系统（记录全部 toast，持久化 localStorage，最多 30 条） =====
    let appLogs = [];
    try { const _l = JSON.parse(localStorage.getItem('app_logs_v1') || '[]'); if(Array.isArray(_l)) appLogs = _l.slice(-50); } catch(e) {} // v8.6-fix15：读取上限与 pushLog 保留 50 条一致（原 30/50 不一致；注释移行尾防吞 catch）
    function pushLog(msg) { appLogs.push({ t: Date.now(), msg }); if(appLogs.length > 50) appLogs = appLogs.slice(-50); try { localStorage.setItem('app_logs_v1', JSON.stringify(appLogs)); } catch(e) {} renderLogList(); } // v7.5：pushLog 实时刷新日志列表（不依赖切页签）
    function fmtLogTime(ts) { const d = new Date(ts), p = n => String(n).padStart(2,'0'); return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); }
    function renderLogList() {
        const list = $('logList'); if(!list) return;
        if(!appLogs.length) { list.innerHTML = '<div style="padding:12px;color:#6A627A;font-size:0.75rem;">暂无日志——每次提示都会记录在这里（最多保留 50 条）</div>'; return; }
        list.innerHTML = appLogs.slice().reverse().map(l => '<div class="log-item"><span class="log-time">' + fmtLogTime(l.t) + '</span><span class="log-msg">' + escapeHtml(l.msg) + '</span></div>').join('');
    }
