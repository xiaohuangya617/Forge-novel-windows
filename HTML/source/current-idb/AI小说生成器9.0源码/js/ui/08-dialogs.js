// ======================== 8.9 统一应用内弹窗 ========================
// Electron 中不再调用白色原生 prompt/confirm；网页端仍保留同步原生回退。
// 业务调用请使用 appPromptAsync/appConfirmAsync，避免异步弹窗被误当成同步布尔值。
let novelPromptCallback = null;
let novelConfirmCallback = null;

function appPrompt(title, placeholder, defVal, cb) {
    if(!window.novelData) {
        let result = null;
        try { result = window.prompt(title, defVal == null ? '' : defVal); } catch(_) { result = null; }
        if(typeof cb === 'function') cb(result);
        return result;
    }
    const modal = document.getElementById('promptModal');
    if(!modal) { if(typeof cb === 'function') cb(null); return; }
    if(modal.style.display === 'flex') { if(typeof toast === 'function') toast('请先完成当前输入'); if(typeof cb === 'function') cb(null); return; }
    novelPromptCallback = typeof cb === 'function' ? cb : null;
    const titleEl = document.getElementById('promptTitle');
    const input = document.getElementById('promptInput');
    if(titleEl) titleEl.textContent = title || '输入';
    if(input) { input.value = defVal == null ? '' : String(defVal); input.placeholder = placeholder || '请输入'; }
    modal.style.display = 'flex';
    setTimeout(() => { if(input) { input.focus(); input.select(); } }, 0);
}

function closePrompt(result) {
    const modal = document.getElementById('promptModal');
    if(modal) modal.style.display = 'none';
    const cb = novelPromptCallback; novelPromptCallback = null;
    if(typeof cb === 'function') cb(result == null ? null : String(result));
    restoreWindowFocusAfterDialog();
}

function appPromptAsync(title, placeholder, defVal) {
    return new Promise(resolve => appPrompt(title, placeholder, defVal, resolve));
}

function appConfirm(message, cb) {
    if(!window.novelData) {
        let result = false;
        try { result = window.confirm(message); } catch(_) { result = false; }
        if(typeof cb === 'function') cb(result);
        return result;
    }
    const modal = document.getElementById('confirmModal');
    if(!modal) { if(typeof cb === 'function') cb(false); return false; }
    if(modal.style.display === 'flex') { if(typeof toast === 'function') toast('请先完成当前确认'); if(typeof cb === 'function') cb(false); return false; }
    novelConfirmCallback = typeof cb === 'function' ? cb : null;
    const msgEl = document.getElementById('confirmMsg');
    if(msgEl) msgEl.textContent = message == null ? '' : String(message);
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('confirmOk')?.focus(), 0);
    return undefined;
}

function closeConfirm(result) {
    const modal = document.getElementById('confirmModal');
    if(modal) modal.style.display = 'none';
    const cb = novelConfirmCallback; novelConfirmCallback = null;
    if(typeof cb === 'function') cb(!!result);
    restoreWindowFocusAfterDialog();
}

function appConfirmAsync(message) {
    return new Promise(resolve => appConfirm(message, resolve));
}

function restoreWindowFocusAfterDialog() {
    try { if(window.novelData && typeof window.novelData.focus === 'function') Promise.resolve(window.novelData.focus()).catch(() => {}); } catch(_) {}
    try { window.focus(); } catch(_) {}
}

function bindNovelDialogs() {
    const promptOk = document.getElementById('promptOk');
    const promptCancel = document.getElementById('promptCancel');
    const promptInput = document.getElementById('promptInput');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    const secondOk = document.getElementById('secondInstanceOk');
    promptOk?.addEventListener('click', () => closePrompt(promptInput?.value || ''));
    promptCancel?.addEventListener('click', () => closePrompt(null));
    confirmOk?.addEventListener('click', () => closeConfirm(true));
    confirmCancel?.addEventListener('click', () => closeConfirm(false));
    secondOk?.addEventListener('click', () => { const m = document.getElementById('secondInstanceModal'); if(m) m.style.display = 'none'; restoreWindowFocusAfterDialog(); });
    promptInput?.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); closePrompt(promptInput.value); } if(e.key === 'Escape') closePrompt(null); });
    document.getElementById('promptModal')?.addEventListener('keydown', e => { if(e.key === 'Escape') closePrompt(null); });
    document.getElementById('confirmModal')?.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); closeConfirm(true); } else if(e.key === 'Escape') closeConfirm(false); });
    if(window.novelData && typeof window.novelData.onSecondInstance === 'function') {
        window.novelData.onSecondInstance(() => {
            const m = document.getElementById('secondInstanceModal');
            if(m) { m.style.display = 'flex'; setTimeout(() => secondOk?.focus(), 0); }
        });
    }
}
