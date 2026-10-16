# 第三方组件声明（发布前复核稿）

本文件用于区分作者原创内容与随程序分发的第三方组件。它不是作者原创代码的许可证，也不能替代组件包内已有的完整许可证文件。

## Electron / Chromium

Windows EXE 使用 Electron 运行时，运行目录内保留了 Chromium 相关运行库和 `LICENSES.chromium.html`。发布 EXE ZIP 时必须保留：

- `LICENSE`
- `LICENSES.chromium.html`
- 运行目录中随 Electron 提供的其他许可文件

这些文件的具体授权以对应运行时版本携带的文本为准。

## Font Awesome

网页和 EXE renderer 中包含 Font Awesome 样式和字体资源。发布前应确认对应版本的 Font Awesome Free 许可证文件，并在正式 Release 中保留或链接到相应许可说明。不能把字体文件和图标资源声明为本项目原创。

## 其他依赖

发布前需要根据最终 `package.json`、构建产物和 `resources/app/assets` 再核对一次依赖清单，至少确认：

- 运行时依赖的许可证文件没有被 `.gitignore` 或打包脚本排除；
- README 中没有把第三方组件写成作者原创；
- Release ZIP 与源码仓库的第三方组件版本和许可证说明一致。

## 作者原创内容

本项目的业务页面、renderer 业务逻辑、Electron 适配代码、构建脚本和测试脚本，在作者确认范围内按根目录 `LICENSE` 的 MIT 条款授权。MIT 不覆盖上面列出的第三方组件、字体、图标和 Electron/Chromium 运行库。
