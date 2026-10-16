    function openForbiddenWordsModal() { const book = getCurrentBook(); if(!book) { toast("请先选择小说"); return; } const forbiddenBookName = $('forbiddenBookName'); if(forbiddenBookName) forbiddenBookName.innerText = book.name; renderForbiddenList(); clearForbiddenForm(); const forbiddenWordsModal = $('forbiddenWordsModal'); if(forbiddenWordsModal) forbiddenWordsModal.style.display='flex'; }

    