# Forge-novel-windows GitHub 发布方案

仓库名：`Forge-novel-windows`

规划范围：当前 9.0 IndexedDB HTML、9.0-IDB Windows EXE、共享 renderer 源码和构建测试。Android 1.47 不放进本仓库，继续在独立 Android 项目中维护。

本文档是发布准备方案，不代表已经创建 GitHub 仓库、推送代码或发布 Release。

## 一、发布目标

发布后提供两种使用方式：

1. GitHub Pages 在线打开网页版，用户不需要安装程序。
2. GitHub Release 下载完整 Windows EXE 压缩包，用户解压后直接运行。

源码、构建脚本和测试放在同一个仓库，保证 HTML 与 EXE 的共享 renderer 不再分叉。EXE 的完整运行目录作为 Release 资产上传，不把大体积运行库全部塞进 Git 提交历史。

## 二、推荐仓库布局

当前 `发布专用` 目录按存档方式保存。正式仓库建议整理为：

```text
Forge-novel-windows/
├─ docs/
│  └─ GITHUB发布方案.md
├─ web-source/
│  ├─ AI小说生成器9.0.html
│  └─ AI小说生成器9.0源码/
├─ electron/
├─ tests/
├─ tools/
├─ build-exe-renderer.mjs
├─ build-exe-runtime.mjs
├─ package.json
├─ index.html                 # 从当前 IndexedDB HTML 生成或复制
├─ VERSION
├─ CHANGELOG.md
├─ THIRD_PARTY_NOTICES.md
├─ README.md
└─ LICENSE                    # 作者原创代码使用 MIT
```

建议把当前 `HTML/product/current-idb/AI小说生成器9.0-IDB网页版.html` 复制为仓库根目录的 `index.html`，或使用 GitHub Actions 在构建时复制并重命名。不要把旧的非 IndexedDB HTML 作为 Pages 首页。

`EXE/product` 只作为本地打包和 Release 准备目录；正式提交时默认不提交完整 Electron 运行目录，Release 中上传 ZIP。

源码仓库不携带用于重组完整 EXE 的旧 Electron runtime。只克隆仓库可以构建 renderer 和执行源码校验；要重建完整 EXE，发布者需要另行准备兼容运行时目录，并设置 `AI_NOVEL_SOURCE_EXE`。这不会影响普通用户直接下载 Release ZIP 使用。

## 三、发布前必须处理的文件

### 保留并发布

- 当前 IndexedDB HTML 成品或其构建来源
- `web-source` 共享 renderer 源码
- `electron` 主进程、preload 和运行配置
- 构建脚本、必要的测试脚本和项目文档
- README、版本文件、变更记录和第三方组件声明
- `LICENSE`：作者原创代码和文档使用 MIT
- Release 用的完整 Windows 运行目录 ZIP

### 不应推送

- `EXE/product` 中未压缩的完整运行目录
- `EXE/source/tests/_tmp/`
- `EXE/source/tests/_electron-ui-data*/`
- `EXE/source/docs/01-project-memory.md`、`02-lessons-and-pitfalls.md`、`03-code-audit-*.md`
- `GitHub发布技能与经验教训.md` 等仅供本地工作的发布过程文档
- `err.log`、`stdout.txt`、`stderr.txt`、`ps_run*.txt` 等运行残留
- `node_modules`、构建缓存、临时截图和本机测试数据
- Electron `userData`、浏览器站点数据、用户小说和 API Key
- `local.properties`、签名材料、令牌、密码和私有配置
- 旧 8.9 EXE 包体

`.gitignore` 已提供第一层保护，但不能替代人工检查。发布前必须用 `git status`、文件清单和关键词扫描再次确认。

`EXE/source/baseline/` 暂时保留，因为 `tests/feature-compare.mjs` 需要旧 EXE 的只读入口做功能对比。若未来不再公开该对比测试，可以在单独的公开构建分支中移除 baseline，但不能在未更新测试的情况下直接删除。

## 四、版本和 Release 命名

当前建议：

```text
VERSION: 9.0.0
Git tag: v9.0.0
Release title: AI 小说生成器 9.0
```

Release 资产建议：

```text
AI小说生成器-9.0-IDB-Windows-x64.zip
AI小说生成器-9.0-IDB-Web.html
SHA256SUMS.txt
```

ZIP 必须包含完整目录，而不是只包含 `AI小说生成器9.0-IDB独立版.exe`。若实际构建架构或文件名与这里不同，应以构建产物为准同步修改 README、资产名和校验文件。

后续修复版本使用 `v9.0.1`、`v9.0.2`；产品界面仍可显示 9.0，Release tag 用补丁号区分可追溯构建。

## 五、GitHub Pages 发布方式

推荐使用 GitHub Actions 发布静态站点：

1. 把当前 IndexedDB HTML 作为 `index.html` 放到仓库根目录，或在 Actions 中复制到发布目录。
2. 在仓库 Settings → Pages 中选择 GitHub Actions。
3. 使用官方静态站点部署流程，将包含 `index.html` 的目录上传到 Pages。
4. 发布后打开 `https://YOUR_GITHUB_USERNAME.github.io/Forge-novel-windows/`，检查 IndexedDB 初始化、设置保存、创建书籍、章节保存和 JSON 备份下载。

网页版是纯静态页面，不需要把 API Key 放进仓库。用户首次使用时在页面中填写自己的 API 配置。

如果供应商不允许浏览器跨域请求，Pages 页面可能打不开 API 请求；这不是 GitHub Pages 的存储故障，需要用户更换允许跨域的端点或后续增加后端代理。当前版本没有内置后端代理。

## 六、EXE 发布方式

1. 在干净环境重新构建 renderer 和 runtime。
2. 执行构建验证和离线回归。
3. 将 `EXE/product/AI小说生成器9.0-IDB独立版/` 复制到临时发布目录。
4. 生成完整 ZIP，保留目录层级、`resources`、`locales`、DLL 和 Electron 运行文件。
5. 在新的隔离目录解压 ZIP。
6. 从解压目录双击 EXE，确认窗口正常出现、单实例和关闭处理正常。
7. 再用用户样本或人工样本验证创建书籍、保存章节、备份恢复和安卓存档恢复。
8. 计算 ZIP 的 SHA-256，写入 `SHA256SUMS.txt` 并附在同一个 Release。

完整 runtime 构建示例：

```powershell
$env:AI_NOVEL_SOURCE_EXE = '<path-to-compatible-electron-runtime>'
node .\build-exe-runtime.mjs
```

“解压后能启动”只证明启动路径和运行库完整，不能代替真实 API 和长时间创作验收。两类结果要分开记录。

## 七、建议的发布前验证命令

在 EXE 源码目录执行：

```powershell
node .\build-exe-renderer.mjs
node .\tests\validate-build.mjs
node .\tests\android-restore-smoke.mjs
node .\tests\headless-smoke.cjs
node .\tests\snapshot-restore-smoke.cjs
node .\tests\electron-ipc-smoke.cjs
node .\tests\electron-android-restore-smoke.cjs
node .\tests\large-idb-smoke.cjs
node .\tests\feature-compare.mjs
node .\tests\generation-summary-stop-resend-smoke.cjs
node .\tests\generation-multi-stop-resend-smoke.cjs
node .\tests\electron-ui-smoke.cjs
```

真实 API 验收必须另行进行，不能用测试中的 mock API 结果代替。当前已完成的离线验证包括 70 个 renderer 模块、IndexedDB、大数据、快照、IPC、UI、安卓恢复、多余数据过滤和生成中断竞态。

## 八、Git 操作流程

以下命令是正式发布时执行的模板，目前不在本次任务中运行：

```powershell
git init
git branch -M main
git add README.md VERSION CHANGELOG.md THIRD_PARTY_NOTICES.md LICENSE docs web-source electron tests tools package.json site
git diff --cached --stat
git diff --cached --name-only
git commit -m "Release AI novel generator 9.0"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/Forge-novel-windows.git
git push -u origin main
git tag -a v9.0.0 -m "AI 小说生成器 9.0"
git push origin v9.0.0
```

创建 Release 后上传完整 ZIP、HTML 可下载文件和 `SHA256SUMS.txt`。README 中的下载链接只能在资产真实存在并完成远程核验后替换为正式地址。

## 九、远程核验清单

- 仓库名确实为 `Forge-novel-windows`。
- `main` 分支包含 README、源码、构建脚本、测试和许可证。
- Pages 首页打开的是 IndexedDB 9.0 HTML，不是旧的非 IndexedDB HTML。
- `v9.0.0` tag 指向本次发布提交。
- Release 为正式发布状态，不是草稿或预发布状态。
- Windows ZIP 存在、大小非零、下载 HTTP 状态正常。
- 下载后的 ZIP SHA-256 与 `SHA256SUMS.txt` 一致。
- ZIP 解压后 EXE 可启动，完整 `resources` 目录存在。
- GitHub 搜索不到 API Key、令牌、私有路径和用户数据。
- README 的功能、限制、版本和许可证说明与实际产物一致。

## 十、当前必须向用户说明的限制

- 当前 HTML 和 EXE 共享 renderer，但本地数据不自动同步，跨端需要存档文件。
- HTML/EXE → Android 当前没有正式导入通道。
- 真实 API、Android 真机、不同 Windows 环境和长时间运行仍需要发布者人工验收。
- IndexedDB 比旧 `localStorage` 更适合长正文和多本书，但仍受浏览器配额和用户清理影响。
- 导出的完整备份可能含 API Key 明文，不能作为公开 Release 资产上传。

只有完成许可证确认、敏感信息扫描、Release ZIP 隔离启动、真实 API 人工验收和远程内容核验后，才适合把仓库标为稳定版公开发布。
