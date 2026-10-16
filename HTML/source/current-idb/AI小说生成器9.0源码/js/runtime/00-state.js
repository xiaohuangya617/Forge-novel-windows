// ======================== AI小说生成器 v8.9 — 运行时脚本 ========================
document.addEventListener('DOMContentLoaded', function() {
    // 全局数据
    let books = [], currentBookId = null;
    let globalCharacters = [], globalActions = [], globalCostumes = [];
    let api = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', contextWindow:1000000, temp:1.0, top_p:0.92, repetition_penalty:1.15, maxTokens:60000, freqPenalty:0.4, presPenalty:0.5, ctxChapters:5, stopWords:'', thinking: false, reasoningEffort: 'high', notify: false, dualMode: false, multiChap: false, multiChapCount: 3, branchAutoSend: false, rewriteAutoSend: false };
    let polishApi = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', maxTokens:50000, reasoning:'max', ratio:50, paramMode:false, temp:0.5, topP:0.87, presPenalty:0, freqPenalty:0.1, repPenalty:1 }; // v7.3 审稿 API（DeepSeek：默认思考模式，推理强度 low/high/max 默认 max，修改幅度阈值 20-90% 默认 50%；v8.6-⑤ 参数模式：开启后思考失效+温度0.5/Top-p0.87/存在0/频率0.1/重复1）
    let actApi = { url:'https://api.deepseek.com/chat/completions', key:'', model:'deepseek-flash', temp:0.7, maxTokens:800, rounds:10, persona:true, tone:true }; // v7.9 扮演 API（默认 deepseek-flash；maxTokens 800 防长台词截断；摘要请求复用同 API 800/0.4）
    let imageApiCfg = { url:'', key:'', model:'', size:'1:1', style:'二次元插画风' }; // v7.1 生图占位（仅 EXE 实装）
    // v7.2：重写态状态机——回填原始指令到消息栏后锁定"发送=重写本章"（防误新建章节）；切换章节/发送完成/发起新生成时清除
    let pendingRewrite = null;
    // v7.2：走向卡片加载态——续写入口锁定（防重复点击），请求完成/失败后解锁
    let pendingBranch = false;
    let banterBusy = false; // v8.7-F06：吐槽进行中标志——防吐槽期间切书导致结果/缓存/费用错绑到新书（原 generateBanter 无独立 pending 状态）
    // v7.2：走向已填入消息栏待发送——Ctrl+Enter 走续写而非新建（用户拍板：填入后手动发送）
    let branchContinuePending = false;
    let branchBookId = null; // v7.3 C1 修复：走向所属书（防走向生成中切书后，用旧书走向续写新书）
    // v7.3：润色状态机——pendingPolish=请求进行中（锁定编辑入口）；polishDiffs=待应用 diff；polishMode=预览态；polishTargetId=预览目标章节；polishBeforeText=润色前正文快照（取消时整体还原）
    let pendingPolish = false;
    let polishDiffs = [];
    let polishMode = false;
    let polishBeforeText = null; // v7.3：renderPolishDiff 前存的润色前正文，取消时还原（预览期手动删改全部作废）
    let polishTargetId = null; // v7.3：润色预览目标章节，应用/放弃时校验（防预览态切章后误作用到新章）
    let polishLid = null;
    let isGenerating = false;
    let dualAbortControllers = [];
    let dualPendingChapA = null, dualPendingChapB = null;
    let dualOriginBookId = null;
    let dualChatId = null;
    let dualStartTime = 0, dualWasPrecision = false, dualCosts = {A:0, B:0};
    let dualStopRequested = false;
    let currentAbortController = null;
    // 任务会话号（v5.8）：每次启动任务递增，旧任务的 finally/停止清理前校验会话号——
    // 若已被新任务取代（会话号过期）则放弃清理，防旧任务清空新任务状态（停止后立刻发新任务的场景）
    let generationSessionId = 0;
    // 连发/摘要的独立所有权令牌：停止后立即重发时，迟到的旧请求只能收尾自身，
    // 不能清理新任务的共享锁或覆盖新任务的摘要状态。
    let multiChapRunToken = 0;
    let summaryGenerationToken = 0;
    // 双版活跃会话号（v5.8）：供 finalizeDualSelection/选版校验——停止后新任务启动会使
    // 旧双版的选版/定稿失效（防旧双版结果写入新任务流程）
    let dualActiveSessionId = 0;
    let rollbackSnapshot = null;
    let currentEditingCharId = null, currentEditingGlobalCharId = null, currentEditingGlobalActionId = null, currentEditingGlobalCostumeId = null, currentEditingForbiddenId = null;
    let uuidCounter = 0;
    let autoSaveInterval = null;
    let pendingGeneration = null;
    // v5.8：取消待生成任务——清空 pendingGeneration 并更新对应聊天消息为取消态，
    // 防止用户关闭 API 弹窗后聊天仍停留在"请配置 API Key，保存后将自动重试"的错误等待态
    function cancelPendingGeneration(reason) {
        if(!pendingGeneration) return;
        const gen = pendingGeneration;
        pendingGeneration = null;
        const sourceBook = gen.sourceBookId ? books.find(b => b.id === gen.sourceBookId) : getCurrentBook();
        if(sourceBook && gen.chatId) replaceChatMessage(gen.chatId, reason || '⏹ 已取消待生成任务', sourceBook);
    }
    let currentFontSize = 16;
    let isImporting = false;
    let importPending = false; // v8.9-F011：备份导入排他锁——确认获准→读取/解析/提交全生命周期置位；load/error/abort 统一收尾复位。防双 FileReader 并发（慢 A 晚回覆盖快 B）与读取期间删除/重置被迟到回调复活（项目零 v4 复审 F-011 残余/EXE-V8-F04）

