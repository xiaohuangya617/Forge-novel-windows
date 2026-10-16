    function $(id) { return document.getElementById(id); }
    let toastCount = 0;
    function toast(msg) { pushLog(msg); let t=document.createElement('div'); t.className='toast'; t.innerText=msg; t.style.bottom = `${20 + toastCount * 42}px`; toastCount++; document.body.appendChild(t); setTimeout(()=>{ t.remove(); toastCount = Math.max(0, toastCount-1); },2500); }

