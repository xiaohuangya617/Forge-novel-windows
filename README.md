# Forge-novel-windows

Windows 与 Web 双端 AI 小说创作工具。模型负责生成文本，应用负责书籍与章节管理、创作资料组装、上下文整理、摘要与角色成长、编辑、备份和恢复。

HTML 与 Windows EXE 共用同一套 9.0 renderer 源码。网页版使用浏览器 IndexedDB 保存创作数据，EXE 在 Electron 窗口中运行同一套业务逻辑，并额外提供桌面文件选择、单实例和快照恢复能力。

当前版本：`9.0`（Windows EXE 构建变体：`9.0-IDB 独立版`） · 支持现代桌面浏览器和 Windows

[在线打开网页版](https://xiaohuangya617.github.io/Forge-novel-windows/) · [下载 Windows 完整包](https://github.com/xiaohuangya617/Forge-novel-windows/releases/download/v9.0.0/AI-novel-generator-9.0-IDB-Windows-x64.zip) · [查看 Release](https://github.com/xiaohuangya617/Forge-novel-windows/releases/latest)

## 快速开始

### 网页版

1. 打开 [在线网页版](https://xiaohuangya617.github.io/Forge-novel-windows/)。
2. 打开 API 设置，填写 API 地址、API Key 和模型名称，先测试连接。
3. 新建书籍，填写世界观、主线大纲、全局提示词和行文规范，再开始创作。
4. 章节正文会自动保存到当前浏览器的 IndexedDB；换设备前先导出项目存档。

### Windows EXE

1. 下载 [Windows 完整 ZIP](https://github.com/xiaohuangya617/Forge-novel-windows/releases/download/v9.0.0/AI-novel-generator-9.0-IDB-Windows-x64.zip)。
2. 解压整个目录，不要只提取 `.exe` 文件。
3. 双击目录内的 `AI小说生成器9.0-IDB独立版.exe`，然后按网页版相同的步骤配置 API。

ZIP 必须保留 Electron 运行库、`resources`、DLL 和 `locales` 等文件。普通用户不需要安装 Node.js、Electron 或 Playwright。

## 创作链

### 一键起书

从模板和创作目标开始，生成书名、世界观、专有名词、主线大纲、第一章正文和本章摘要，再进入正常章节编辑流程。

### 正文创作

固定设定、全局提示词、写作风格、近期摘要、角色成长和本次指令按顺序组装进请求。正文完成后可以继续生成章节摘要，并把角色成长资料回写到本书角色库。

### 续写与走向

续写可以先生成三条剧情走向，选择并编辑其中一条后再决定是否生成正文。支持基于最后章节续写，也支持一次连续生成 2～10 个章节；连续生成会把前一章结果传递给下一章。

### 重写、润色与检测

重写前自动保存快照，可在生成后回滚。润色使用独立审稿 API，提供原句、新句和修改理由的预览，确认后再应用。冲突检测为手动操作，不会在每章生成后额外自动消耗一次 API 请求。

### 角色试演与辅助工具

角色试演使用单独的扮演 API，可注入本书背景和双方角色设定。应用还提供吐槽、精准资料注入、查找替换、Markdown 阅读、统计、关系图和快捷键等辅助功能。

## 主要功能

- **书籍与章节**：多本书书架、章节列表、草稿恢复、章节摘要和消息历史。
- **单本书资料**：世界观、主线大纲、全局提示词、行文规范、本书角色库和角色成长。
- **全局素材库**：角色、动作、服装、标签和禁用词，可按书籍需要导入或导出。
- **生成操作**：一键起书、新写、续写、重写、润色、摘要、剧情走向、连续多章和角色试演。
- **精细控制**：温度、Top-p、重复惩罚、频率惩罚、存在惩罚、最大输出、引用章节数、思考模式和精准注入。
- **编辑与阅读**：正文编辑、Markdown 预览、连续阅读、查找替换、章节统计、关系图和 TXT/JSON 导出。
- **桌面能力**：EXE 原生文件对话框、窗口生命周期、单实例和快照兜底；HTML 与 EXE 使用相同的创作逻辑。
- **跨端恢复**：HTML/EXE 项目存档可以互相恢复；Android HTML 项目存档可以导入 HTML/EXE，并跟随恢复世界观、主线大纲、全局提示词、行文规范、消息历史、章节正文和本书角色资料。

## 存档与数据

### 数据保存位置

- **网页版创作数据**：保存在当前站点的 IndexedDB，数据库名为 `ai_novel_generator_v1`。
- **EXE 创作数据**：保存在 Electron 的本地用户数据目录，不写入 GitHub，也不会自动上传到服务器。
- **API 配置**：保存在本机配置中；API 请求直接发送到用户填写的服务商端点。

IndexedDB 比旧版 `localStorage` 更适合保存长篇正文、多本书、消息历史和角色成长，但它仍受浏览器配额、磁盘空间和站点数据清理策略限制。重要作品请定期导出完整项目存档。

### 存档互通

- HTML 和 EXE 使用同一套项目存档结构，导出的书籍、章节正文、角色、消息历史和创作资料可以在两端恢复。
- Android HTML 项目存档导入 PC 时，会恢复单本书相关资料；PC 端专用的全局素材、草稿本、统计和部分运行设置不会被带入本书运行态。
- 章节按 ID 去重追加，角色按 ID 或姓名去重追加，并保留原作参考章节标记。
- HTML/EXE 当前没有正式的 PC → Android 回流通道；Android 项目继续在独立仓库维护。
- HTML、EXE 和 Android 不会自动实时同步，跨端传递需要手动导出和恢复。

完整 JSON 备份可能包含 API Key 明文。不要把个人存档、API Key 或用户小说上传到 GitHub、网盘或公开聊天。

## 平台和 API

- **网页版**：近期版本的 Chromium、Edge 或 Firefox；需要支持 IndexedDB、Fetch 和文件下载。
- **Windows EXE**：面向 Windows 桌面环境，Release ZIP 已包含运行库。
- **接口形式**：默认按 DeepSeek 聊天补全接口配置，也支持其他兼容 OpenAI Chat Completions 的服务商端点。
- **浏览器跨域**：网页版的 API 请求受服务商 CORS 策略影响；当前版本没有内置后端代理。
- **费用和限流**：API 费用、限流、模型可用性和服务商隐私政策由用户与服务商负责确认。

## 仓库结构

```text
HTML/
  source/current-idb/       # 9.0 HTML 与共享 renderer 的细分源码
  product/current-idb/      # IndexedDB 网页成品
  source/legacy-non-idb/    # 旧存储链，仅作历史对照
EXE/
  source/web-source/        # EXE 使用的 9.0 共享网页源码
  source/electron/          # Electron 主进程、preload 和运行配置
  source/tests/             # 构建、存储、恢复、IPC、UI 和功能对比测试
  source/docs/              # 开发计划、项目记忆和审查记录
  product/                  # 本地完整 EXE 运行目录
docs/
  GITHUB发布方案.md
VERSION
CHANGELOG.md
THIRD_PARTY_NOTICES.md
LICENSE
```

旧 8.9 EXE 包体不在本仓库中。`EXE/source/baseline/old-exe/` 是功能对比用的只读参考副本，不是新版运行入口。

## 从源码构建

### 构建网页版

在 HTML 细分源码目录执行：

```powershell
node .\build.mjs
node .\verify.mjs
```

构建脚本会按 `build-manifest.json` 拼接 70 个职责模块，并检查来源映射、JavaScript 语法和最终产物一致性。

### 构建 EXE renderer 和运行目录

在 `EXE/source` 目录执行：

```powershell
node .\build-exe-renderer.mjs
node .\tests\validate-build.mjs
node .\build-exe-runtime.mjs
```

完整 Electron runtime 不随源码仓库提供。需要重建完整 EXE 时，先准备兼容的 Electron 运行时目录，并设置：

```powershell
$env:AI_NOVEL_SOURCE_EXE = '<path-to-compatible-electron-runtime>'
node .\build-exe-runtime.mjs
```

renderer 构建和源码校验不会修改原始 8.9 项目；普通用户应直接使用 Release ZIP，不需要准备上述构建环境。

### 已执行的离线验证

当前 9.0 发布副本已通过构建校验、IndexedDB 重载与约 100 MiB 数据写入、HTML/EXE 快照恢复、Electron IPC、EXE UI、Android 存档恢复、多余数据过滤、旧 EXE 功能入口对比，以及生成中断和重发竞态测试。

真实供应商 API、不同 Windows 环境、长时间连续创作和 Android 真机仍需要使用者按自己的 API 配置进行人工验收。

## 更新记录

### 9.0.0 · 2026-10-16

- HTML 主线切换到 IndexedDB，支持多本书、长正文、消息历史和角色成长资料。
- HTML 与 Electron EXE 共用 70 个 renderer 模块，EXE 保留桌面文件和窗口能力。
- 完成 HTML/EXE 项目存档恢复和 Android HTML 存档导入。
- 完成 EXE 旧功能入口、IPC bridge、UI、快照和大数据回归。
- 发布在线 Pages、Windows 完整 ZIP、网页版单文件和 SHA-256 校验文件。

## 已知限制

- 离线 mock API 测试不能替代真实供应商 API 验收；API 限流、费用、超时和网络中断仍取决于服务商和本机环境。
- IndexedDB 不是无限容量；浏览器清除站点数据、EXE 删除用户数据或误删存档都可能造成数据丢失。
- HTML 与 EXE 不共享实时数据；不同浏览器、Windows 用户账户和设备之间需要通过存档文件传递。
- Android 目前只有 Android HTML 存档导入 PC 的兼容路径，没有正式的 PC 回流 Android 路径。
- 当前源码已经按职责拆分，但仍运行在共享的 DOMContentLoaded 作用域内，不是完全隔离的 ES Module 架构。
- 完整 EXE runtime 构建依赖外部兼容 Electron 运行时；Release ZIP 不受此限制。

## 许可证和第三方组件

作者原创代码和文档采用 [MIT License](LICENSE)。Electron、Chromium、Font Awesome、markdown-it 及其他第三方组件继续遵循各自许可证，不能由本项目的 MIT 许可覆盖；组件说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和随 EXE 运行目录附带的许可文件。

本仓库和 Release 不携带 API Key、用户小说、EXE `userData`、签名材料或私有配置。
