# Illustrator JSX 脚本

这个仓库集中保存 Illustrator ExtendScript（JSX）项目、常用工具和参考脚本。

## 主要自写项目

### 云漫标记集

- 项目目录：`projects/云漫标记集/`
- 当前源码：`projects/云漫标记集/云漫标记集.jsx`（当前版本 v0.7.4.1）
- 变更记录：`projects/云漫标记集/CHANGELOG.md`
- 定向验证：`projects/云漫标记集/verify.ps1`
- `dist/` 保存 JSXBIN 编译产物，不作为当前源码编辑入口。

### 快速导出工艺 tif

- 项目目录：`projects/快速导出工艺tif/`
- 当前源码：`projects/快速导出工艺tif/快速导出工艺tiff.jsx`
- `legacy/` 保存旧版 `导出UV机tiff.jsx`，仅用于回溯和对比。

## 其他目录

- `tools/Adobe ExtendScript Toolkit CC/`：Adobe ExtendScript Toolkit 及配套 SDK、示例。
- `tools/scripts/`：可直接使用的通用 Illustrator 小工具脚本。
- `references/`：插件合集、界面原型和参考源码，不作为两个主要项目的当前入口。

## 维护约定

- 两个主要项目的源码修改均在各自的 `projects/` 子目录进行。
- 云漫标记集使用固定源码文件名，版本变化通过 Git 提交历史和 `CHANGELOG.md` 记录。
- 编译文件、旧版本和参考代码与当前源码分开保存，避免误改或误发布。
- 参考脚本的来源、许可和 Illustrator 版本兼容性需要在实际复用前单独确认。
