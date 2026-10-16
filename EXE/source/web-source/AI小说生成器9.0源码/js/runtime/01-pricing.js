    // v8.9-F01：按 DeepSeek 官方当前价目表更新。单位为 USD / 1M token。
    // deepseek-v4-pro 自 2026-09-14 起路由到 V4.1-Flash，并按 Flash 价格计费；旧 Flash 名称继续兼容。
    const PRICING_TABLE = {
        'deepseek-flash': { label:'DeepSeek V4.1 Flash', off:{hit:0.003, miss:0.15, out:0.60}, peak:{hit:0.006, miss:0.30, out:1.20} },
        'deepseek-v4-flash': { alias:'deepseek-flash' },
        'deepseek-v4-flash-vision-exp': { alias:'deepseek-flash' },
        'deepseek-v4-pro': { alias:'deepseek-flash' },
        'deepseek-pro': { alias:'deepseek-flash' }
    };
    const PRICING_VERSION = '2026-09-14'; // 价格单位：USD / 1M token；界面金额均按 USD 估算
    // DeepSeek 官方 /models 当前给 V4.1-Flash 及 V4-Pro 路由模型 1M 上下文、384K 最大输出。
    const MODEL_CONTEXT_WINDOWS = {
        'deepseek-flash': 1000000, 'deepseek-v4-flash': 1000000, 'deepseek-v4-flash-vision-exp': 1000000,
        'deepseek-v4-pro': 1000000, 'deepseek-pro': 1000000, 'deepseek-chat': 64000, 'deepseek-reasoner': 64000
    };
    // 官方规则：工作日 UTC 01:00-04:00、06:00-10:00 为峰时；中国法定节假日全天按非峰时。
    const DEEPSEEK_PUBLIC_HOLIDAYS = new Set([
        '2026-01-01','2026-01-02','2026-01-03',
        '2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23',
        '2026-04-04','2026-04-05','2026-04-06',
        '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
        '2026-06-19','2026-06-20','2026-06-21',
        '2026-09-25','2026-09-26','2026-09-27',
        '2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07'
    ]);
    function pricingModel(model) {
        const key = String(model || '').trim().toLowerCase();
        const row = PRICING_TABLE[key];
        if(!row) return { key, price:null };
        if(row.alias) return pricingModel(row.alias);
        return { key, price:row };
    }
    function getContextWindow(model) {
        const key = String(model || (api && api.model) || '').trim().toLowerCase();
        const mapped = MODEL_CONTEXT_WINDOWS[key];
        const n = Number(api && api.contextWindow);
        // 1000000 是 8.9 默认值，不应遮住已知 64K 模型的官方窗口；其他合法值仍可作为自定义模型覆盖。
        if(mapped) return (Number.isFinite(n) && n >= 16000 && n <= 1000000 && n !== 1000000) ? Math.round(n) : mapped;
        return Number.isFinite(n) && n >= 16000 && n <= 1000000 ? Math.round(n) : 64000;
    }
    function isPeakHour(now = new Date()) {
        const day = now.getUTCDay();
        const h = now.getUTCHours();
        const key = now.toISOString().slice(0, 10);
        if(DEEPSEEK_PUBLIC_HOLIDAYS.has(key)) return false;
        return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
    }
