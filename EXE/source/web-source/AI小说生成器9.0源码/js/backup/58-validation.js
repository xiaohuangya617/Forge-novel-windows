    function ensureArray(v) { return Array.isArray(v) ? v : []; }
    function validateBackupData(data) {
        if(!data || typeof data !== 'object' || !Array.isArray(data.books)) throw new Error('备份文件格式无效：缺少 books 数组');
        const idOk = v => (typeof v === 'string' && v.length > 0) || (typeof v === 'number' && Number.isFinite(v));
        data.books.forEach((b, bi) => {
            if(!b || typeof b !== 'object' || Array.isArray(b) || !idOk(b.id)) throw new Error('备份书籍数据格式无效（第' + (bi+1) + '项）');
            if(b.name !== undefined && typeof b.name !== 'string') throw new Error('备份书名类型无效');
            for(const f of ['chapters','characters','chatHistory','forbiddenWords']) if(b[f] !== undefined && !Array.isArray(b[f])) throw new Error('备份字段 ' + f + ' 必须是数组');
            (b.chapters || []).forEach((ch, ci) => {
                if(!ch || typeof ch !== 'object' || Array.isArray(ch) || !idOk(ch.id)) throw new Error('备份章节数据格式无效（第' + (ci+1) + '项）');
                for(const f of ['title','content','prompt','summary']) if(ch[f] !== undefined && typeof ch[f] !== 'string') throw new Error('备份章节字段 ' + f + ' 类型无效');
                if(ch.checkResult !== undefined && !Array.isArray(ch.checkResult)) throw new Error('备份章节 checkResult 必须是数组');
                if(ch.checkReport !== undefined && ch.checkReport !== null && (typeof ch.checkReport !== 'object' || Array.isArray(ch.checkReport))) throw new Error('备份章节 checkReport 类型无效');
            });
            (b.characters || []).forEach(c => { if(!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('备份角色数据格式无效'); if(c.id !== undefined && !idOk(c.id)) throw new Error('备份角色 ID 类型无效'); if(c.name !== undefined && typeof c.name !== 'string') throw new Error('备份角色名称类型无效'); });
            (b.chatHistory || []).forEach(m => { if(!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('备份聊天记录格式无效'); if(m.content !== undefined && typeof m.content !== 'string') throw new Error('备份聊天内容类型无效'); });
            (b.forbiddenWords || []).forEach(f => { if(!f || typeof f !== 'object' || Array.isArray(f)) throw new Error('备份禁用词格式无效'); if(f.word !== undefined && typeof f.word !== 'string') throw new Error('备份禁用词类型无效'); });
            if(b.currentChapterId !== undefined && b.currentChapterId !== null && !idOk(b.currentChapterId)) throw new Error('备份当前章节 ID 类型无效');
        });
        for(const f of ['globalCharacters','globalActions','globalCostumes']) if(data[f] !== undefined && !Array.isArray(data[f])) throw new Error('备份全局库字段类型无效：' + f);
        for(const list of [data.globalCharacters || [], data.globalActions || [], data.globalCostumes || []]) list.forEach(x => { if(!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('备份全局库元素格式无效'); if(x.id !== undefined && !idOk(x.id)) throw new Error('备份全局库 ID 类型无效'); });
        if(data.currentBookId !== undefined && data.currentBookId !== null && !idOk(data.currentBookId)) throw new Error('备份当前书 ID 类型无效');
        if(data.scratchpadPages !== undefined && !Array.isArray(data.scratchpadPages)) throw new Error('备份草稿页必须是数组');
        if(data.apiConfig !== undefined && (typeof data.apiConfig !== 'object' || Array.isArray(data.apiConfig))) throw new Error('备份 API 配置格式无效');
        return true;
    }
