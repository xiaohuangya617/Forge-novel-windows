// AI小说生成器 - Electron 主进程
// 加载本地 index.html，保持浏览器行为一致（localStorage / Notification 全部可用）
const { app, BrowserWindow, shell, ipcMain, Notification, dialog, Tray, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 禁用硬件加速：使用软件渲染，兼容虚拟机/远程桌面/无独显环境，避免 GPU 初始化失败闪退
app.disableHardwareAcceleration();

// Windows 系统通知必需：设置 AppUserModelID，否则通知不显示/任务栏图标异常
app.setAppUserModelId('com.novelwriter.ainovelgenerator');

// 便携化：数据（小说 + API Key 等 localStorage）存到 exe 旁的 userData 目录，
// 不写入系统 %APPDATA%（C 盘）。整个文件夹拷走 = 程序 + 数据 + Key 全部随身携带。
// __dirname = resources/app → 上两级 = exe 所在目录。
// 端到端测试可通过 AI_NOVEL_E2E_DATA_DIR 注入临时目录，默认行为保持便携目录不变。
const configuredDataDir = process.env.AI_NOVEL_E2E_DATA_DIR;
app.setPath('userData', configuredDataDir
  ? path.resolve(configuredDataDir)
  : path.join(__dirname, '..', '..', 'userData'));

// ==================== 文件持久层（方案B） ====================
// localStorage 当工作缓存，主进程把快照落盘到 userData\novel_data.json——
// 存储上限 = 磁盘空间（无配额），换机拷一个 JSON 即可迁移全部数据。
// 原子写：先写 .tmp 再 rename，崩溃不会留下半写损坏的文件。
// v8.9-EXE-V8-F01/F03：写入顺序与错误分层——
//   ① 异步 save 串行队列（完成顺序 = 到达顺序）；save-sync/clear 提交时推进代际，作废所有在途异步写
//     （在途旧写 rename 前发现过期即删除 tmp 丢弃，防"旧异步保存覆盖关窗新快照/清空后复活"，EXE-V8-F01）
//   ② clear 即墓碑：代际推进后旧写永不落盘（EXE-V8-F01 触发条件 B）
//   ③ load 返回三态 {missing:true}/{data}/{error}——读取/解析失败不再折叠为"不存在"（EXE-V8-F03）
const DATA_FILE = () => path.join(app.getPath('userData'), 'novel_data.json');

let saveGeneration = 0; // 代际：save-sync/clear 每次提交 +1，在途异步 save 发现代际变化即丢弃
let saveTail = Promise.resolve(); // 异步保存串行队列（防两个异步写乱序 rename，后写先完成覆盖先写）

ipcMain.handle('novel-data:save', async (e, payload) => {
  const myGen = saveGeneration;
  const task = saveTail.then(async () => {
    let tmp = '';
    try {
      const f = DATA_FILE();
      await fs.promises.mkdir(path.dirname(f), { recursive: true });
      // v8.6-fix4：tmp 加唯一后缀——原共用固定 .tmp，并发 save（在途 IPC + beforeunload 立即写）时
      // 可能 A 未写完、B 已 rename，落盘半写内容导致 load 解析失败；唯一后缀下各自 rename 原子覆盖，最多丢一次旧写
      tmp = f + '.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8) + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 0));
      // v8.10-EXE-V9-F01：代际检查与正式替换放入同一同步临界区（renameSync）——
      // 原 `check → await rename` 之间事件循环可插入 save-sync/clear（其同步写先完成、随后旧 rename I/O 覆盖，关窗最新快照被旧写倒退）；
      // renameSync 使"检查+替换"不可分割：save-sync/clear 要么插在检查前（作废本写），要么在其后（自身同步写最新），总是最后一次逻辑提交获胜
      if (myGen !== saveGeneration) {
        try { fs.unlinkSync(tmp); } catch (e2) {}
        return { ok: false, error: 'stale-write-discarded' };
      }
      fs.renameSync(tmp, f);
      return { ok: true };
    } catch (err) {
      console.error('novel-data:save 失败', err);
      if (tmp) { try { fs.unlinkSync(tmp); } catch (e3) {} } // 清理本次残留 tmp（写失败/rename 失败路径）
      return { ok: false, error: err.message };
    }
  });
  saveTail = task.catch(() => {}); // 队列不被单次失败阻断
  return task;
});

// v8.6-fix19：同步落盘（渲染层 beforeunload 用）——异步 invoke 在窗口销毁时消息可能丢失；
// sendSync 阻塞等待主进程写盘完成，关窗瞬间的最后修改可靠进入文件
// v8.9：save-sync 携带最终状态，推进代际使在途异步旧写作废（异步写完成于 sync 之后会覆盖关窗快照，EXE-V8-F01）
ipcMain.on('novel-data:save-sync', (e, payload) => {
  saveGeneration++;
  let tmp = ''; // v8.11-EXE-V10-F02：提升 try 外——v10 在 try 内 const，renameSync 失败时 catch 无法清理，明文快照 tmp 残留（EXE-V10-F02）
  try {
    const f = DATA_FILE();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    tmp = f + '.' + Date.now() + '.sync.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 0));
    fs.renameSync(tmp, f);
    e.returnValue = { ok: true };
  } catch (err) {
    console.error('novel-data:save-sync 失败', err);
    if (tmp) { try { fs.unlinkSync(tmp); } catch (e2) {} } // v8.11：失败分支受控清理本次 tmp（写失败/替换失败均不残留明文快照）
    e.returnValue = { ok: false, error: err.message };
  }
});

ipcMain.handle('novel-data:load', async () => {
  try {
    const f = DATA_FILE();
    if (!fs.existsSync(f)) return { missing: true };
    return { data: JSON.parse(await fs.promises.readFile(f, 'utf8')) };
  } catch (err) {
    // v8.9：读取/解析失败返回 error 三态——渲染层据此保持文件写保护并提示，不得按"不存在"处理（EXE-V8-F03）
    console.error('novel-data:load 失败', err);
    return { error: err.message };
  }
});

ipcMain.handle('novel-data:clear', async () => {
  saveGeneration++; // v8.9：墓碑——作废所有在途异步写（防清空后旧写复活文件，EXE-V8-F01 触发条件 B）
  // v8.10-EXE-V9-F01：unlinkSync 同步化——原异步 unlink 可与后到的新保存竞态（迟完成的 unlink 删除新保存）；
  // 同步删除使"清空"原子完成：之后的新保存（gen 已推进）正常落盘，不再被迟到清空误删
  // v8.11-EXE-V10-F02：清空同时枚举删除同前缀受控临时快照（novel_data.json.*.tmp / *.sync.tmp）——
  // 原只删正式文件，历史/失败残留的明文 tmp（含小说与 API Key）在"清除全部数据"后仍存在；任一删除失败返回 {ok:false}，页面不得承诺全部清除
  try {
    const f = DATA_FILE();
    const failures = [];
    const dir = path.dirname(f);
    const base = path.basename(f);
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { if (e && e.code === 'ENOENT') { names = []; } else { return { ok: false, error: '目录枚举失败：' + (e && e.message || e) }; } } // v8.12-EXE-V11-F01：仅目录不存在视为空；其余枚举错误（权限/占用/I-O）必须返回失败——原吞成空目录后误报"全部清除"，文件仍含小说与 Key（EXE-V11-F01）
    const targets = names.filter(n => n === base || (n.startsWith(base + '.') && n.endsWith('.tmp')));
    targets.forEach(n => {
      try { fs.unlinkSync(path.join(dir, n)); } catch (err) { failures.push(n + ': ' + err.message); }
    });
    if (failures.length) return { ok: false, error: '删除失败：' + failures.join('; ') };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ==================== 全局系统通知 ====================
// 渲染进程触发点 → IPC → 主进程 Notification → Windows 系统通知
// （右下角横幅 + 任务栏图标橙色闪烁——EXE 独有能力，浏览器 file:// 不可用）
ipcMain.handle('notify:show', (e, title, body) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || 'AI小说生成器'), body: String(body || ''), silent: false }).show();
      return { ok: true };
    }
    return { ok: false, error: '系统通知不受支持' };
  } catch (err) {
    console.error('notify:show 失败', err);
    return { ok: false, error: err.message };
  }
});

// ==================== 窗口焦点恢复 ====================
// 修复：<input type=file> 系统文件对话框关闭后，Electron 偶发丢失 webContents 焦点，
// 导致原生 textarea（聊天输入框）点击无光标、输入无字符（contenteditable 正文不受影响）。
// 渲染进程在文件读取完成后请求主进程强制恢复窗口与 webContents 焦点。
ipcMain.handle('win:focus', () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      // 重建激活链：先失焦再聚焦，强制 webContents 回到 active 状态。
      // 修复：文件对话框/confirm 后 webContents 进入 inactive（现象：textarea 无法聚焦、
      // 文本选中背景变灰而非蓝色、键盘输入全部失效、点击无光标），仅 focus() 不足以恢复。
      win.blur();
      win.focus();
      win.webContents.focus();
    }
    return { ok: true };
  } catch (err) {
    console.error('win:focus 失败', err);
    return { ok: false, error: err.message };
  }
});

// ==================== 任务栏闪烁（win.flashFrame） ====================
// 生成完成提醒：任务栏图标橙色闪烁（Windows 原生高亮效果，不依赖通知中心，便携版可用）。
// 与页签闪烁/系统通知构成 EXE 版"全局通知"三通道。窗口聚焦或 flashFrame(false) 自动停止。
ipcMain.handle('win:flash', (e, flash) => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.flashFrame(!!flash);
    return { ok: true };
  } catch (err) {
    console.error('win:flash 失败', err);
    return { ok: false, error: err.message };
  }
});


// ==================== 备份文件选择（主进程对话框） ====================
// 修复：<input type=file> 系统对话框关闭后 Electron 偶发丢失焦点，导致聊天 textarea
// 点击无光标、输入无字符。改用主进程 dialog.showOpenDialog + fs 读取：
// ① 对话框与文件读取都在主进程；② 关闭后主进程立即 win.focus()+webContents.focus()，
// 从根上消除"文件对话框后失焦"。渲染层通过 novelData.openJson() 调用。
ipcMain.handle('dialog:open-json', async () => {
  try {
    // 仅 E2E 测试注入文件路径，未设置时始终走真实系统对话框。
    if (process.env.AI_NOVEL_E2E_BACKUP_PATH) {
      const testPath = path.resolve(process.env.AI_NOVEL_E2E_BACKUP_PATH);
      return { canceled: false, content: fs.readFileSync(testPath, 'utf8') };
    }
    const win = BrowserWindow.getAllWindows()[0];
    const res = await dialog.showOpenDialog(win, {
      title: '选择备份文件（JSON）',
      defaultPath: app.getPath('userData'), // v8.7-N1-b：默认先看便携文件夹（userData）内的备份——数据跟文件夹走
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      properties: ['openFile']
    });
    // 对话框关闭后立即恢复焦点（关键：必须先于任何渲染层操作）
    if (win) { win.focus(); win.webContents.focus(); }
    if (res.canceled || !res.filePaths.length) return { canceled: true };
    const content = fs.readFileSync(res.filePaths[0], 'utf8');
    return { canceled: false, content };
  } catch (err) {
    console.error('dialog:open-json 失败', err);
    return { canceled: false, error: err.message };
  }
});

// v8.7-N1-a：备份保存对话框——默认 userData 目录（exe 旁便携文件夹），文件名预填本地时间戳；写盘成功后返回路径
ipcMain.handle('dialog:save-backup', async (e, suggestedName, content) => {
  try {
    // 仅 E2E 测试注入保存路径，未设置时始终走真实系统对话框。
    if (process.env.AI_NOVEL_E2E_BACKUP_PATH) {
      const testPath = path.resolve(process.env.AI_NOVEL_E2E_BACKUP_PATH);
      fs.mkdirSync(path.dirname(testPath), { recursive: true });
      fs.writeFileSync(testPath, String(content || ''), 'utf8');
      return { ok: true, path: testPath };
    }
    const win = BrowserWindow.getAllWindows()[0];
    const res = await dialog.showSaveDialog(win, {
      title: '保存备份文件（JSON）',
      defaultPath: path.join(app.getPath('userData'), String(suggestedName || ('小说参数备份_' + Date.now() + '.json'))),
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    });
    if (win) { win.focus(); win.webContents.focus(); }
    if (res.canceled || !res.filePath) return { canceled: true };
    fs.writeFileSync(res.filePath, String(content || ''), 'utf8');
    return { ok: true, path: res.filePath };
  } catch (err) {
    console.error('dialog:save-backup 失败', err);
    return { ok: false, error: err.message };
  }
});


// ==================== 单实例锁 ====================
// 双开 exe 会让两个实例同时写 novel_data.json 互相覆盖，数据丢失。
// 主窗口全局引用（单实例锁/托盘菜单需要，getAllWindows()[0] 可能取到 Splash/菜单窗）
let mainWindow = null;

// 加锁：第二个实例启动时自动聚焦已有窗口并退出，并弹深色提示。
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show(); // 驻留隐藏时也要恢复显示
      win.focus();
      // 深色提示（渲染层弹窗，与程序主题一致）
      try {
        if (!win.webContents.isDestroyed()) win.webContents.send('app:second-instance');
      } catch (e) { console.error('单实例提示发送失败:', e.message); }
    }
  });
}

function createWindow() {
  // v7.7 启动体验优化：独立深色启动画面（Splash）——双击立即反馈，主窗口后台加载。
  // 主窗口 show:false + ready-to-show（等首帧就绪再显示，无白屏黑屏）；
  // 首次冷启动 3-4s 期间用户看到的是 Splash，不再"无窗口干等"。
  // 注意：软件渲染（disableHardwareAcceleration）下 backgroundColor 不生效，
  // Splash 深色由页面内联 html/body style 保证（首帧即深色，不依赖 backgroundColor）。
  const SPLASH_HTML = '<!DOCTYPE html><html lang="zh-CN" style="background:#0A0A0F;"><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#0A0A0F;display:flex;align-items:center;justify-content:center;font-family:\'Microsoft YaHei\',sans-serif;color:#EDEAF2;overflow:hidden;user-select:none;} .wrap{text-align:center;} .logo{font-size:52px;margin-bottom:12px;animation:pulse 1.6s ease-in-out infinite;} .title{font-size:20px;letter-spacing:2px;font-weight:600;} .sub{font-size:12px;color:#8A84A8;margin-top:8px;letter-spacing:1px;} .bar{width:160px;height:3px;background:#2A2A3E;border-radius:2px;margin:18px auto 0;overflow:hidden;} .bar i{display:block;height:100%;width:40%;background:#6EC6F8;border-radius:2px;animation:slide 1.2s ease-in-out infinite;} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.6;}} @keyframes slide{0%{transform:translateX(-100%);}100%{transform:translateX(350%);}}</style></head><body><div class="wrap"><div class="logo">📖</div><div class="title">AI小说生成器</div><div class="sub">正在启动…</div><div class="bar"><i></i></div></div></body></html>';
  const splash = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    resizable: false,
    show: true,
    skipTaskbar: true, // 不占任务栏（主窗口出现即关闭）
    center: true,
    backgroundColor: '#0A0A0F',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML));

  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 680,
    title: 'AI小说生成器',
    autoHideMenuBar: true,
    backgroundColor: '#0A0A0F',
    show: false, // v7.7 启动修复：窗口先隐藏，等渲染进程完成首帧绘制（ready-to-show）再显示——
    // 首帧即品牌启动加载层（深色 bootLayer 动画），彻底消除"白屏→黑屏→加载动画"三段式启动
    //（Windows 下 backgroundColor 常被 GPU 合成忽略，show:true 时窗口显示早于首帧即漏白屏）
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow = win; // 记录主窗口引用（单实例切换用）

  win.loadFile(path.join(__dirname, 'index.html'));

  // v7.7 启动修复：渲染进程完成首帧绘制后显示窗口（Electron 官方防白屏做法）
  // 首帧即 bootLayer 深色加载动画，无白屏/黑屏过渡。
  // 衔接动画：小窗先淡出消失 → 销毁 → 主窗淡入（各约 250ms，避免"主窗覆盖小窗"的生硬感）
  win.once('ready-to-show', () => {
    let so = 1;
    const fadeOutSplash = setInterval(() => {
      so -= 0.12;
      if (so <= 0) {
        clearInterval(fadeOutSplash);
        if (!splash.isDestroyed()) splash.destroy();
        // 主窗淡入
        if (!win.isDestroyed()) {
          win.show();
          win.setOpacity(0);
          let wo = 0;
          const fadeInWin = setInterval(() => {
            wo += 0.12;
            if (wo >= 1) { wo = 1; clearInterval(fadeInWin); }
            if (!win.isDestroyed()) win.setOpacity(wo);
          }, 30); // ~250ms
        }
      } else if (!splash.isDestroyed()) {
        splash.setOpacity(so);
      }
    }, 25); // ~250ms 淡出
  });
  // 兜底：极端情况（页面 JS 异常/渲染进程卡死）4s 未触发 ready-to-show 则强制显示，
  // 避免窗口永不出现（backgroundColor + html/body 深色底保证即使强显也不是白屏；不做动画）
  setTimeout(() => {
    if (!splash.isDestroyed()) splash.destroy();
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, 4000);

  // 页面加载失败兜底：ERR_ABORTED(-3) 是导航中断属正常；其余失败重试一次
  let loadRetried = false;
  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    if (code === -3) return;
    console.error('页面加载失败 code=' + code + ' desc=' + desc + ' url=' + url);
    if (!loadRetried && url.includes('index.html')) {
      loadRetried = true;
      setTimeout(() => win.loadFile(path.join(__dirname, 'index.html')), 300);
    }
  });

  // 页面内目标=_blank 的外链交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 阻止页面导航离开本地应用（防误跳转导致数据丢失）
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    }
  });

  // ==================== v7.7 托盘最小化 + 自动驻留 ====================
  // X 行为由「自动驻留」开关决定（配置持久化到 userData\tray_config.json）：
  //   勾选 → 点 X 隐藏到托盘（后台运行，右下角小图标恢复）
  //   未勾选（默认）→ 点 X 直接退出
  // 彻底退出程序：托盘右键菜单「退出」。关闭拦截不再弹窗打扰。
  // 右键菜单：独立无边框深色小窗，弹在托盘图标附近（原生 Tray 菜单无法改色，自定义与程序主题一致）。
  const TRAY_CFG = path.join(app.getPath('userData'), 'tray_config.json');
  let trayAutoStay = false;
  try { if (fs.existsSync(TRAY_CFG)) trayAutoStay = !!JSON.parse(fs.readFileSync(TRAY_CFG, 'utf8')).autoStay; } catch (e) { trayAutoStay = false; }
  let allowClose = false; // 仅「退出」置 true 放行 close
  win.on('close', (e) => {
    if (allowClose) return; // 已确认退出，放行
    if (trayAutoStay) {
      e.preventDefault();
      win.hide(); // 自动驻留：隐藏到托盘，后台继续运行
    } else {
      // 未勾选驻留：直接退出——必须显式 app.quit()，
      // 否则隐藏的菜单小窗（失焦 hide 未 destroy）仍是活窗口，window-all-closed 不触发，进程残留（托盘图标在、窗口无法再显示）
      allowClose = true;
      app.quit();
    }
  });

  // 托盘图标：右下角小图标（左键=显示；右键=托盘旁弹深色菜单小窗）
  let tray = null;
  let trayMenuWin = null; // 复用菜单小窗（避免重复创建）
  try {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip('AI小说生成器');
    const showWin = () => {
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    };
    tray.on('click', showWin); // 左键单击显示窗口

    // 菜单小窗 HTML（深色 UI，与程序主题一致）
    // 菜单小窗 HTML（深色 UI，与程序主题一致）——函数化：每次打开动态生成，勾选态始终取最新 trayAutoStay
    const buildMenuHTML = () => '<!DOCTYPE html><html lang="zh-CN" style="background:transparent;"><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;font-family:\'Microsoft YaHei\',sans-serif;user-select:none;overflow:hidden;} .menu{background:#1A1825;border:1px solid #3A3452;border-radius:16px;padding:6px;min-width:190px;box-shadow:0 10px 34px rgba(0,0,0,0.6);} .mi{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:10px;cursor:pointer;font-size:13px;color:#DBD4E8;transition:background .15s;} .mi:hover{background:#2A2A3E;} .mi .ck{margin-left:auto;color:#6EC6F8;display:none;font-size:12px;} .mi.stay-on .ck{display:inline;} .sep{height:1px;background:#3A3452;margin:4px 8px;} .danger{color:#E08080;} .danger:hover{background:#3A2323;}</style></head><body><div class="menu"><div class="mi" id="miShow">显示</div><div class="mi" id="miStay">后台驻留<span class="ck">&#10003;</span></div><div class="sep"></div><div class="mi danger" id="miQuit">退出</div></div><script>' + (trayAutoStay ? 'document.getElementById("miStay").classList.add("stay-on");' : '') + 'var pick=function(a){if(window.novelData&&window.novelData.trayPick){window.novelData.trayPick(a);}};document.getElementById("miShow").onclick=function(){pick("show")};document.getElementById("miStay").onclick=function(){pick("toggle-stay")};document.getElementById("miQuit").onclick=function(){pick("quit")};</script></body></html>';
    const openTrayMenu = () => {
      try {
        const { x, y } = screen.getCursorScreenPoint();
        const menuW = 210, menuH = 150;
        // 定位：尽量在托盘附近（光标上方，屏幕内不越界）
        const display = screen.getDisplayNearestPoint({ x, y });
        const wx = Math.min(Math.max(x - menuW + 24, display.workArea.x + 4), display.workArea.x + display.workArea.width - menuW - 4);
        const wy = Math.max(y - menuH - 6, display.workArea.y + 4);
        if (trayMenuWin && !trayMenuWin.isDestroyed()) {
          // 复用小窗时重新加载 MENU_HTML：勾选态由 trayAutoStay 动态生成，
          // 不刷新则 DOM 停留在首次创建时的状态——用户点击「后台驻留」后看不到勾选变化
          trayMenuWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildMenuHTML()));
          trayMenuWin.setPosition(wx, wy);
          trayMenuWin.show();
          trayMenuWin.focus();
          return;
        }
        trayMenuWin = new BrowserWindow({
          width: menuW, height: menuH, frame: false, resizable: false, show: false,
          alwaysOnTop: true, skipTaskbar: true, focusable: true, backgroundColor: '#1A1825',
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
        });
        trayMenuWin.setPosition(wx, wy);
        trayMenuWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildMenuHTML()));
        trayMenuWin.once('ready-to-show', () => { if (!trayMenuWin.isDestroyed()) { trayMenuWin.show(); trayMenuWin.focus(); } });
        // 失焦自动关闭（像系统菜单）
        trayMenuWin.on('blur', () => { if (trayMenuWin && !trayMenuWin.isDestroyed()) trayMenuWin.hide(); });
      } catch (menuErr) { console.error('托盘菜单打开失败:', menuErr.message); }
    };
    tray.on('right-click', openTrayMenu); // 右键：托盘旁弹深色菜单小窗

    // 菜单小窗回传：'show' / 'toggle-stay' / 'quit'
    ipcMain.on('app:tray-action', (e, action) => {
      if (trayMenuWin && !trayMenuWin.isDestroyed()) trayMenuWin.hide();
      if (action === 'show') {
        showWin();
      } else if (action === 'toggle-stay') {
        trayAutoStay = !trayAutoStay;
        try { fs.writeFileSync(TRAY_CFG, JSON.stringify({ autoStay: trayAutoStay })); } catch (err) { console.error('自动驻留配置保存失败:', err.message); }
      } else if (action === 'quit') {
        allowClose = true;
        app.quit();
      }
    });
    // 退出时销毁托盘与菜单窗，避免残留
    app.on('will-quit', () => {
      if (tray && !tray.isDestroyed()) tray.destroy();
      if (trayMenuWin && !trayMenuWin.isDestroyed()) trayMenuWin.destroy();
    });
  } catch (trayErr) {
    console.error('托盘创建失败（不影响主程序）:', trayErr.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  // Windows toast 横幅必需：开始菜单快捷方式（带 AUMID）。异步执行不阻塞启动。
  ensureStartMenuShortcut();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ==================== 开始菜单快捷方式（Windows toast 横幅必需） ====================
// Windows 上系统通知要"弹横幅"，应用必须在开始菜单有带 AppUserModelID 的快捷方式。
// setAppUserModelId 只设进程 AUMID；没有快捷方式时，通知只进通知中心不弹横幅
//（现象：通知中心有记录，但 设置→系统→通知 里找不到应用条目）。
// 便携版无安装器，这里启动时自动创建用户级快捷方式（%APPDATA%\Start Menu\Programs，
// 不动系统目录、无需管理员权限）。已存在且指向当前 exe 则跳过，否则重建。
// 通过 PowerShell EncodedCommand（UTF-16LE Base64）执行，避免中文/转义问题。
const START_MENU_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$target = "EXE_PATH"
$lnkDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
$lnk = Join-Path $lnkDir 'AI小说生成器.lnk'
$needCreate = $true
try {
  if(Test-Path $lnk) {
    $wsChk = New-Object -ComObject WScript.Shell
    $scChk = $wsChk.CreateShortcut($lnk)
    if($scChk.TargetPath -eq $target) { $needCreate = $false }
  }
} catch { $needCreate = $true }
if($needCreate) {
  try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = $target
    $sc.WorkingDirectory = Split-Path $target
    $sc.IconLocation = "$target,0"
    $sc.Description = 'AI小说生成器'
    $sc.Save()
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class ShortcutUtil {
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    public interface IPropertyStore {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PROPERTYKEY pkey);
        void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        void Commit();
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Sequential)]
    public struct PROPVARIANT {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public IntPtr p;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern int SHGetPropertyStoreFromParsingName(string pszPath, IntPtr pbc, uint flags, ref Guid riid, out IntPtr ppv);
    [DllImport("ole32.dll")]
    public static extern void CoTaskMemFree(IntPtr pv);
    public static void SetAumid(string lnkPath, string aumid) {
        try {
            Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
            IntPtr store;
            int hr = SHGetPropertyStoreFromParsingName(lnkPath, IntPtr.Zero, 2, ref iid, out store);
            if (hr != 0) return;
            IPropertyStore ps = (IPropertyStore)Marshal.GetObjectForIUnknown(store);
            PROPERTYKEY key = new PROPERTYKEY();
            key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
            key.pid = 5;
            PROPVARIANT pv = new PROPVARIANT();
            pv.vt = 31;
            pv.p = Marshal.StringToCoTaskMemUni(aumid);
            ps.SetValue(ref key, ref pv);
            ps.Commit();
            Marshal.ReleaseComObject(ps);
            CoTaskMemFree(pv.p);
        } catch { }
    }
}
'@
    [ShortcutUtil]::SetAumid($lnk, 'com.novelwriter.ainovelgenerator')
  } catch { }
}
`;

function ensureStartMenuShortcut() {
  try {
    if (process.platform !== 'win32') return;
    const exePath = process.execPath;
    if (!exePath || !/\.exe$/i.test(exePath)) return;
    // 防御：路径含 $ 时 PowerShell 双引号会插值，反引号转义
    const safePath = exePath.replace(/\$/g, '`$');
    const script = START_MENU_PS.replace('EXE_PATH', safePath);
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { timeout: 20000, windowsHide: true }, (err) => {
      if (err) console.error('开始菜单快捷方式创建失败:', err.message);
    });
  } catch (e) {
    console.error('ensureStartMenuShortcut:', e.message);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
