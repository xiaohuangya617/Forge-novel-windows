# 更新记录

## 9.0.0 - 2026-10-16

### 新增

- HTML 主线使用 IndexedDB 保存书籍、章节、角色和消息历史。
- HTML 与 Electron EXE 共用 70 个 renderer 源码模块。
- EXE 增加 Electron 快照兜底、原生文件选择器、单实例和桌面运行能力。
- HTML/EXE 支持 Android HTML 项目存档恢复，包括世界观、主线大纲、全局提示词、行文规范和消息历史。

### 验证

- 构建、IndexedDB、大数据、快照、IPC、UI、安卓恢复、功能入口和生成中断离线回归已通过。
- 真实供应商 API、不同 Windows 环境和 Android 真机仍需发布前人工验收。

### 已知限制

- HTML/EXE 不自动实时同步，跨端通过存档文件传递。
- HTML/EXE → Android 当前没有正式回流通道。
- 完整备份可能含 API Key 明文，不能上传到公开仓库或 Release。
