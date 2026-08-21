# Illustrator JSX 脚本

这个仓库集中保存 Illustrator ExtendScript（JSX）项目、常用工具和参考脚本。

## 主要自写项目

### 云漫标记集

- 项目目录：`projects/云漫标记集/`
- 当前源码：`projects/云漫标记集/云漫标记集.jsx`（当前版本 v0.7.4.4）
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

## 云漫标记集自动编译发布

GitHub Actions 工作流位于 `.github/workflows/release-yunman.yml`，使用 Node.js 22 和锁定版本的 `jsxbin` 在 GitHub 托管的 Windows Runner 上生成标准 JSXBIN。

- 在 Actions 页面手动运行时，`release_tag` 留空只生成可下载的测试 Artifact；输入框只需填写与源码版本对应的 Tag 值（例如 `v0.7.4.1`），即可向该 Release 补传缺失资产。工作流也兼容误填成 `release_tag: v0.7.4.1` 的形式。
- 推送 `v*` Tag 时，Tag 必须与源码窗口标题中的版本完全一致，例如源码为 `Ver 0.7.4.1` 时必须使用 `v0.7.4.1`。
- Tag 构建成功后，工作流自动创建或更新同名 GitHub Release，并上传 `YunManMarks-v<版本>.jsx` 及 SHA256 校验文件；使用 ASCII 文件名避免 GitHub 清理中文后只剩版本号。文件内容是标准 JSXBIN，使用 `.jsx` 后缀以便 Illustrator 直接运行。
- 自动产物未经 JsxBlind 二次混淆。需要更强混淆时，下载 `.jsx`，在本地运行 `tools/Adobe ExtendScript Toolkit CC/JsxBlindRun.jsx`，再把最终文件上传到对应 Release。
- 工作流重新运行时只补传缺失资产，不覆盖 Release 中已有的同名文件，避免覆盖你手工上传的 JsxBlind 最终版本。

本地也可以使用相同构建器：

```powershell
npm ci
node tools/build-jsxbin.mjs `
  --input "projects/云漫标记集/云漫标记集.jsx" `
  --output "release/YunManMarks-v0.7.4.4.jsx"
```
