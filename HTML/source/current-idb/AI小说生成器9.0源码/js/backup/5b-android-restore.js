    function androidBookKey(name) { return String(name || '').trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase(); }
    function normalizeAndroidBook(raw) {
        const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? JSON.parse(JSON.stringify(raw)) : {};
        const chapters = ensureArray(src.chapters).filter(ch => ch && typeof ch === 'object' && !Array.isArray(ch)).map((ch, index) => {
            const out = { id: ch.id == null || ch.id === '' ? uuid() : String(ch.id), title: typeof ch.title === 'string' ? ch.title : ('第' + (index + 1) + '章'), content: typeof ch.content === 'string' ? ch.content : '', summary: typeof ch.summary === 'string' ? ch.summary : '', prompt: typeof ch.prompt === 'string' ? ch.prompt : '', savedAt: Number.isFinite(Number(ch.savedAt)) ? Number(ch.savedAt) : Date.now(), isContinuation: !!ch.isContinuation, isInterlude: !!ch.isInterlude, sourceChapter: !!ch.sourceChapter };
            if(Array.isArray(ch.checkResult)) out.checkResult = JSON.parse(JSON.stringify(ch.checkResult));
            if(ch.checkReport && typeof ch.checkReport === 'object' && !Array.isArray(ch.checkReport)) out.checkReport = JSON.parse(JSON.stringify(ch.checkReport));
            return out;
        });
        const characters = ensureArray(src.characters).filter(c => c && typeof c === 'object' && !Array.isArray(c)).map(c => {
            const out = { id: c.id == null || c.id === '' ? uuid() : String(c.id), name: typeof c.name === 'string' ? c.name.trim() : '', appearance: typeof c.appearance === 'string' ? c.appearance : '', personality: typeof c.personality === 'string' ? c.personality : '', special: typeof c.special === 'string' ? c.special : '', relationship: typeof c.relationship === 'string' ? c.relationship : '', aliases: Array.isArray(c.aliases) ? c.aliases.filter(x => typeof x === 'string') : [], tags: Array.isArray(c.tags) ? c.tags.filter(x => typeof x === 'string') : [], growth: Array.isArray(c.growth) ? JSON.parse(JSON.stringify(c.growth)) : [], relationships: Array.isArray(c.relationships) ? JSON.parse(JSON.stringify(c.relationships)) : [] };
            return out.name ? out : null;
        }).filter(Boolean);
        const chatHistory = Array.isArray(src.chatHistory) ? src.chatHistory.filter(message => message && typeof message === 'object' && !Array.isArray(message) && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string').map(message => { const out = { role: message.role, content: message.content }; ['id','timestamp','retry','costLabel'].forEach(key => { if(typeof message[key] === 'string') out[key] = message[key]; }); if(Number.isFinite(Number(message.ts))) out.ts = Number(message.ts); if(message.error === true) out.error = true; return out; }).slice(-50) : null;
        const id = src.id == null || src.id === '' ? uuid() : String(src.id);
        const out = { id, name: typeof src.name === 'string' && src.name.trim() ? src.name.trim() : ('安卓恢复书籍-' + id.slice(-6)), chapters, characters, currentChapterId: src.currentChapterId == null ? null : String(src.currentChapterId) };
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(key => { if(typeof src[key] === 'string') out[key] = src[key]; });
        if(chatHistory) out.chatHistory = chatHistory;
        return out;
    }
    function validateAndroidBookArchive(data) {
        if(!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.books)) throw new Error('安卓存档格式无效：缺少 books 数组');
        if(!data.books.length) throw new Error('安卓存档没有可导入的书籍');
        validateBackupData({ books: data.books });
        return true;
    }
    function mergeAndroidBook(existing, incoming) {
        existing.chapters = ensureArray(existing.chapters); existing.characters = ensureArray(existing.characters);
        ['worldview','plotSet','globalPrompt','writingStyle'].forEach(key => { if(Object.prototype.hasOwnProperty.call(incoming, key)) existing[key] = incoming[key]; });
        if(Object.prototype.hasOwnProperty.call(incoming, 'chatHistory')) existing.chatHistory = JSON.parse(JSON.stringify(incoming.chatHistory));
        let addedChapters = 0, addedCharacters = 0;
        const chapterIds = new Set((existing.chapters || []).map(ch => String(ch.id)));
        (incoming.chapters || []).forEach(ch => { if(!chapterIds.has(String(ch.id))) { existing.chapters.push(JSON.parse(JSON.stringify(ch))); chapterIds.add(String(ch.id)); addedChapters++; } });
        const existingById = new Map((existing.characters || []).map(c => [String(c.id), c]));
        const existingByName = new Map((existing.characters || []).map(c => [androidBookKey(c.name), c]));
        const idMap = new Map();
        const pending = [];
        (incoming.characters || []).forEach(raw => {
            const c = JSON.parse(JSON.stringify(raw));
            const oldId = String(c.id);
            const sameId = existingById.get(oldId);
            const sameName = existingByName.get(androidBookKey(c.name));
            if(sameId || sameName) { idMap.set(oldId, String((sameId || sameName).id)); return; }
            let nextId = oldId;
            if(existingById.has(nextId)) nextId = uuid();
            c.id = nextId; idMap.set(oldId, nextId); pending.push(c); existingById.set(nextId, c); existingByName.set(androidBookKey(c.name), c); addedCharacters++;
        });
        pending.forEach(c => { c.relationships = ensureArray(c.relationships).map(r => { if(!r || typeof r !== 'object') return null; const out = { ...r }; if(out.targetId != null && idMap.has(String(out.targetId))) out.targetId = idMap.get(String(out.targetId)); return out; }).filter(Boolean); existing.characters.push(c); });
        return { addedChapters, addedCharacters };
    }
    function createBookFromAndroid(incoming, usedIds) {
        let id = String(incoming.id); if(usedIds.has(id)) id = uuid(); usedIds.add(id);
        const chapters = JSON.parse(JSON.stringify(incoming.chapters || []));
        const chapterIds = new Set(chapters.map(ch => String(ch.id)));
        return { id, name: incoming.name, chapters, currentChapterId: chapterIds.has(String(incoming.currentChapterId)) ? String(incoming.currentChapterId) : (chapters[chapters.length - 1]?.id || null), chatHistory: Object.prototype.hasOwnProperty.call(incoming, 'chatHistory') ? JSON.parse(JSON.stringify(incoming.chatHistory)) : [], worldview: Object.prototype.hasOwnProperty.call(incoming, 'worldview') ? incoming.worldview : '', plotSet: Object.prototype.hasOwnProperty.call(incoming, 'plotSet') ? incoming.plotSet : '', globalPrompt: Object.prototype.hasOwnProperty.call(incoming, 'globalPrompt') ? incoming.globalPrompt : '你是一位擅长细腻情感的言情小说家。', writingStyle: Object.prototype.hasOwnProperty.call(incoming, 'writingStyle') ? incoming.writingStyle : '文风细腻，多用心理描写。', characters: JSON.parse(JSON.stringify(incoming.characters || [])), forbiddenWords: [], precisionMode: false, precisionChars: [], precisionActions: [], precisionCostumes: [] };
    }
    async function importAndroidBookArchive(file) {
        if(isGenerating || dualPendingChapA || dualPendingChapB || pendingPolish || polishMode || pendingBranch || banterBusy || summaryGenerating || conflictCheckingCount > 0) { toast('生成/走向/吐槽/审稿/摘要/冲突检测进行中，请等待完成或点击停止后再安卓恢复'); return; }
        if(importPending) { toast('上一次存档导入尚未完成，请稍候再试'); return; }
        if(!file) return;
        if(!await appConfirmAsync('安卓恢复会同步世界观、主线大纲、全局提示词、行文规范和消息历史；章节与本书角色库仍按 ID/姓名去重追加，不会覆盖已有章节和角色。不会导入 API、全局素材、草稿本、禁用词和统计。\n\n是否继续？')) return;
        importPending = true;
        const reader = new FileReader();
        reader.onload = async function(e) {
            const before = captureImportState();
            try {
                const data = JSON.parse(e.target.result);
                validateAndroidBookArchive(data);
                const incoming = data.books.map(normalizeAndroidBook);
                const usedBookIds = new Set(books.map(b => String(b.id)));
                let addedBooks = 0, addedChapters = 0, addedCharacters = 0;
                incoming.forEach(item => {
                    let target = books.find(b => String(b.id) === String(item.id));
                    if(!target) target = books.find(b => androidBookKey(b.name) === androidBookKey(item.name));
                    if(target) { const result = mergeAndroidBook(target, item); addedChapters += result.addedChapters; addedCharacters += result.addedCharacters; }
                    else { books.push(createBookFromAndroid(item, usedBookIds)); addedBooks++; addedChapters += item.chapters.length; addedCharacters += item.characters.length; }
                });
                if(!books.length) throw new Error('没有可导入的书籍');
                if(!currentBookId || !books.some(b => String(b.id) === String(currentBookId))) currentBookId = books[0].id;
                books.forEach(b => { b.id = String(b.id); b.chapters = ensureArray(b.chapters); b.characters = ensureArray(b.characters); migrateChapter(b); });
                if(!await persistNovelRuntimeCritical()) throw new Error('本地存储失败，安卓恢复已回滚');
                renderBookshelf();
                if(currentBookId) switchBook(currentBookId, true);
                const parts = [];
                if(addedBooks) parts.push('新增 ' + addedBooks + ' 本书');
                if(addedChapters) parts.push('补入 ' + addedChapters + ' 个章节');
                if(addedCharacters) parts.push('补入 ' + addedCharacters + ' 个角色');
                toast(parts.length ? '安卓恢复完成：' + parts.join('、') : '安卓存档中没有需要追加的新内容');
            } catch(err) { restoreImportState(before); toast('安卓恢复失败：' + (err.message || '存档格式错误')); }
            finally { importPending = false; }
        };
        reader.onerror = () => { importPending = false; toast('安卓存档读取失败，恢复已取消'); };
        reader.onabort = () => { importPending = false; toast('安卓恢复已取消'); };
        reader.readAsText(file);
    }


