# AI 小说生成器 9.0 EXE + IndexedDB 独立开发项目

这是从 9.0 网页版源码出发、重新构建 Electron EXE 的独立项目。

## 目录

- `web-source/AI小说生成器9.0源码/`：9.0 共享 renderer 源码；
- `electron/resources/app/`：待改造的 Electron 主进程、preload 和运行配置；
- `baseline/old-exe/`：旧 EXE renderer 和能力层只读参考副本；
- `docs/`：开发计划、项目记忆和经验教训；
- `tests/`：迁移、存储和构建验证脚本。

## 重要边界

原始 9.0 源码、原始 EXE 和原始 `userData` 不属于本项目的写入目标。本项目不携带用户小说和 API Key。

## 当前阶段

9.0 独立 EXE 已构建并完成收尾审查：9.0 renderer 已接入 IndexedDB，旧 EXE DOM/按钮/IPC/preload bridge 逐项对比无缺失，深色应用内弹窗、关键保存等待边界和独立 Electron UI 已补齐，并通过 Chromium、真实 Electron IPC/UI、旧快照兼容和约 100 MiB 数据回归。版本升级为 9.0，旧 8.9 包体保持不动。

## 构建

```powershell
node .\build-exe-renderer.mjs
node .\tests\validate-build.mjs
node .\build-exe-runtime.mjs
```

`build-exe-renderer.mjs` 只写入本项目的 `electron/resources/app/index.html`，不会修改原始 EXE。
`build-exe-runtime.mjs` 从旧 Electron 运行时复制程序壳和公开静态资源，覆盖独立目录中的 `resources/app`，并明确排除原始 `userData`。当前生成物位于 `dist/AI小说生成器9.0-IDB独立版/`。

构建清单位于 `dist/AI小说生成器9.0-IDB独立版/build-manifest.json`，记录 renderer/EXE SHA-256 和 `userData` 排除项。当前 EXE SHA-256：`c25809d0e15a5ff38a273b2c4e007dc0e8df0e2d1318f5e846fda863dc471b46`。

真实 Electron 验证（需要本机 Chrome/Playwright 运行时）：

```powershell
$env:NODE_PATH = '<path-to-verified-node_modules>'
node .\tests\headless-smoke.cjs
node .\tests\snapshot-restore-smoke.cjs
node .\tests\electron-ipc-smoke.cjs
node .\tests\large-idb-smoke.cjs
node .\tests\feature-compare.mjs
node .\tests\electron-ui-smoke.cjs
```

`electron-ipc-smoke.cjs` 和 `electron-ui-smoke.cjs` 使用 Electron 单实例锁，必须串行执行；`electron-ui-smoke.cjs` 会把主界面、prompt、confirm 截图写入 `tests/_tmp/ui/`。

本阶段没有连接真实 API 做线上生成验收；后续发布前应在有 API Key 的环境人工验证生成、续写、重写和导出。

