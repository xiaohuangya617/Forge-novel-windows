# AI小说生成器 9.0 细分源码

这是从 `AI小说生成器8.9源码` 独立复制出的 9.0 更细粒度维护版本。它与原 8.9 源码目录分开维护，不会自动合并回原目录。

## 目录结构

- `runtime/`：运行状态、DeepSeek 定价、会话统计
- `roleplay/`、`rules/`：角色试演和 AI 味规则层
- `api/`、`library/`：API、回滚和四类素材库
- `graph/`、`generation/`：关系图、上下文、检测、生成、续写
- `editor/`、`backup/`：编辑器、备份、完整导入和安卓恢复
- `banter/`、`precision/`、`tags/`、`layout/`、`bindings/`、`app/`：其他界面功能和初始化

各片段仍运行在同一个 DOMContentLoaded 作用域内，因此不依赖 ES Module，也不影响双击打开单文件 HTML。文件边界只按职责和安全的顶层边界划分，构建顺序由 `build-manifest.json` 固定。

## HTML 适配修复

9.0 HTML 包含 HTML 版适配和版本元数据更新：吐槽入口改用 HTML 已有的同步保存函数 `ensureCurrentChapterSaved()`，移除了原源码中误调用的 EXE 专用函数 `ensureCurrentChapterSavedAndCommitted()`。这项修复只写入本目录，原 8.9 源码保持不变。

安卓恢复会同步单本书的世界观、主线大纲、全局提示词、行文规范和消息历史；章节按 ID 去重追加，角色按 ID/姓名去重追加，并保留原作参考章节标记。API、全局素材、草稿本、禁用词和统计不会随安卓恢复进入 PC 运行态。旧安卓存档缺少新增字段时，已有 PC 资料保持不变。

## 构建

在项目根目录执行：

~~~powershell
node .\AI小说生成器9.0细分源码\build.mjs
~~~

默认输出：`AI小说生成器9.0.html`。也可以指定输出路径：

~~~powershell
node .\AI小说生成器9.0细分源码\build.mjs .\AI小说生成器9.0.html
~~~

## 核对

重新拆分时执行：

~~~powershell
node .\AI小说生成器9.0细分源码\split-source.mjs
~~~

脚本会从现有 `AI小说生成器8.9源码\js` 重新生成本目录，并写入每个片段对应的源文件和行号范围。构建后应执行：

1. `node .\AI小说生成器9.0细分源码\verify.mjs`；
2. 确认 70 个模块的来源映射完整；
3. 确认拼接后的 JavaScript 通过 `node --check`；
4. 继续运行现有 HTML 测试夹具。

本项目当前不包含拆分脚本所需的 8.9 源码副本。运行 `split-source.mjs` 前必须先补齐该只读副本；脚本会在缺失时直接停止，避免清空现有 9.0 分块。HTML 现有构建使用 `build.mjs`，并由 `verify.mjs` 检查 70 个分块、拼接脚本语法和最终产物一致性。
