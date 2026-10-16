# Forge-novel-windows

AI 小说生成器 9.0 的 Windows EXE 与网页版发布仓库。

当前主线使用 IndexedDB 保存书籍、章节正文、角色、消息历史和其他创作资料。HTML 与 EXE 共用同一套 renderer 业务源码，EXE 额外提供桌面窗口、原生文件选择器和 Electron 快照恢复能力。

## 下载和使用

发布后的入口如下：

- 在线网页版：<https://xiaohuangya617.github.io/Forge-novel-windows/>
- Windows 版：<https://github.com/xiaohuangya617/Forge-novel-windows/releases/latest>

网页版：打开在线链接，填写你自己的 API 配置即可使用。数据保存在当前浏览器的 IndexedDB 中。

Windows 版：下载 Release 中的完整 ZIP，解压整个目录，然后双击目录内的 `AI小说生成器9.0-IDB独立版.exe`。不能只提取或单独分发 `.exe` 文件，Electron 运行库和 `resources` 目录必须保留。

## 当前版本

- 产品版本：`9.0`
- EXE 构建变体：`9.0-IDB 独立版`
- 主存储：IndexedDB，数据库名为 `ai_novel_generator_v1`
- Android App：不在本仓库中，当前版本为 1.47，单独维护

旧的非 IndexedDB 网页版仅作为历史兼容和对照版本保留，不是本仓库的维护主线。

## 平台和运行条件

- 网页版：现代桌面浏览器，推荐使用近期版本的 Chromium、Edge 或 Firefox；需要浏览器支持 IndexedDB、Fetch 和文件下载。
- EXE：当前发布准备包面向 Windows 桌面环境；普通用户不需要另行安装 Node.js、Electron 或 Playwright。
- 构建环境：需要 Node.js、项目依赖和 Windows 构建工具；具体命令见 [GitHub 发布方案](docs/GITHUB发布方案.md)。
- 实际磁盘需求以 Release ZIP 大小和解压后的完整目录为准，不能只按 EXE 文件大小判断。

## 已确认的功能

- 多本书和章节管理
- 正文创作、续写、重写、润色、摘要和走向生成
- 角色库、世界观、主线大纲、全局提示词和行文规范
- 消息历史、章节摘要和角色成长资料
- IndexedDB 大数据保存和浏览器重载恢复
- HTML/EXE 完整备份与恢复
- Android HTML 项目存档恢复到 HTML/EXE
- EXE 的原生文件对话框、窗口生命周期处理、单实例和快照兜底

当前源码和离线回归已覆盖构建校验、IndexedDB 写入与重载、快照恢复、IPC、EXE UI、安卓存档恢复、多余数据过滤和生成中断竞态。

## 数据和隐私

- 书籍数据默认保存在本机浏览器或 EXE 的本地用户数据目录，不会自动上传到本仓库。
- API 请求直接发送到用户配置的服务商端点；服务商的跨域策略、限流、费用和隐私条款由用户自行确认。
- API Key 保存在本地配置中。导出的完整 JSON 备份可能包含 API Key 明文，导出后不要上传到 GitHub、网盘或公开聊天。
- 清除浏览器站点数据、删除 EXE 用户数据或误删存档，都可能导致本地数据丢失。请定期导出备份。
- HTML 和 EXE 不会自动实时同步，跨端传递需要导出存档后手动恢复。

## 仓库结构

```text
HTML/
  source/current-idb/       # 当前 9.0 HTML 与 70 个共享源码模块
  product/current-idb/      # 网页成品，发布 Pages 时作为 index.html
  source/legacy-non-idb/    # 旧网页源码，仅作历史对照
EXE/
  source/                   # renderer、Electron 主进程、preload、测试和构建脚本
  product/                  # 本地发布准备目录，正式发布时打成完整 ZIP
docs/
  GITHUB发布方案.md
VERSION
CHANGELOG.md
```

## 从源码构建

在 `EXE/source` 目录执行：

```powershell
node .\build-exe-renderer.mjs
node .\tests\validate-build.mjs
node .\build-exe-runtime.mjs
```

renderer 构建和源码校验不需要旧运行时；完整 EXE runtime 构建还需要一个兼容的 Electron 运行时目录，并通过 `AI_NOVEL_SOURCE_EXE` 指定。该运行时不包含在源码仓库中，官方可运行包以 Release ZIP 为准。普通用户不需要安装 Node.js。构建和测试所需的 Electron、Playwright、Node.js 及 Windows 工具链，详见 [GitHub 发布方案](docs/GITHUB发布方案.md)。

## 已知限制

- 真实供应商 API 的限流、费用、长时间生成和网络中断需要在发布前用实际 API Key 继续验收；离线模拟测试不能替代线上验收。
- 浏览器 IndexedDB 不是无限容量，容量由浏览器、磁盘空间和站点策略决定；仍应定期导出备份。
- HTML/EXE → Android 当前没有正式回流通道。Android 端需要使用自己的项目存档格式，Android App 单独维护。
- 不同浏览器、Windows 账户和设备之间不会共享本地数据。
- 当前稳定版源码仍有共享运行时作用域；文件级拆分已经完成，但不是完全隔离的 ES Module 架构。

## 许可证和第三方组件

作者原创代码和文档采用 MIT，许可证见 [LICENSE](LICENSE)。Electron、Chromium、Font Awesome 等第三方组件继续遵循各自随包许可证，不能被本项目许可证覆盖。组件说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

当前发布准备目录不携带 API Key、用户小说或 EXE 用户数据。正式推送前请按 [GitHub 发布方案](docs/GITHUB发布方案.md) 完成敏感信息扫描、许可证确认、Release ZIP 隔离启动验收和远程内容核验。
