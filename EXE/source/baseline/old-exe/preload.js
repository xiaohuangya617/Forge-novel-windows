// AI小说生成器 - preload 桥接
// 通过 contextBridge 暴露文件持久层 API 给渲染进程（window.novelData）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novelData', {
  // 保存快照（异步，fire-and-forget）
  save: (payload) => ipcRenderer.invoke('novel-data:save', payload),
  // v8.6-fix19：同步落盘（渲染层 beforeunload 用）——异步 invoke 在窗口销毁/退出时消息可能丢失，sendSync 阻塞等待主进程写盘完成
  saveSync: (payload) => ipcRenderer.sendSync('novel-data:save-sync', payload),
  // 读取快照（无文件返回 null）
  load: () => ipcRenderer.invoke('novel-data:load'),
  // 删除快照（初始化时用，防回填旧数据）
  clear: () => ipcRenderer.invoke('novel-data:clear'),
  // 全局系统通知（主进程 Notification → Windows 横幅 + 任务栏闪烁）
  notify: (title, body) => ipcRenderer.invoke('notify:show', title, body),
  // 请求主进程恢复窗口焦点（文件对话框关闭后 textarea 聚焦失败时用）
  focus: () => ipcRenderer.invoke('win:focus'),
  // 任务栏图标闪烁（win.flashFrame，生成完成提醒，窗口聚焦自动停止）
  flash: (on) => ipcRenderer.invoke('win:flash', on),
  // 主进程打开备份文件对话框并读取内容（替代 <input type=file>，关闭后自动恢复焦点）
  openJson: () => ipcRenderer.invoke('dialog:open-json'),
  // v8.7-N1-a：主进程保存对话框（备份导出默认 userData 目录，数据跟文件夹走）
  saveBackup: (suggestedName, content) => ipcRenderer.invoke('dialog:save-backup', suggestedName, content),
  // ==================== v7.7 托盘自定义深色菜单小窗 ====================
  // 菜单小窗内调用：window.trayPick('show'|'toggle-stay'|'quit') → 主进程执行
  trayPick: (action) => ipcRenderer.send('app:tray-action', action),
  // ==================== v7.7 单实例提示（深色弹窗） ====================
  // 第二个实例启动 → 主进程通知 → 渲染层弹深色提示
  onSecondInstance: (cb) => {
    ipcRenderer.on('app:second-instance', () => { try { cb(); } catch(e) {} });
  }
});
