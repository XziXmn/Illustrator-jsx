# YunLi工具箱

自研 Illustrator 插件平台(阶段1:壳 + 核心 + 面板链路已通)。
架构对齐参考插件「字醒」:`.aip` 壳(菜单/停靠/进程管理)+ 独立 .NET 核心进程
(WinForms + WebView2 面板)。参考资料见 `../../references/字醒/`,
SDK 头文件在 `../../references/SDK/`。

## 目录

```
shell/    C++ 壳 → YunLiTools.aip(MinGW gcc 编译)
  src/main.c        PluginMain 消息分发、套件获取、菜单、面板停靠、载荷启动
  src/plugin.def    导出 PluginMain
  rc/resource.rc    PIPL 资源(官方 create_pipl.py 生成)+ 发布期载荷嵌入
  rc/plugin.pipl    构建时自动生成
core/     C# 核心 → YunLiCore.exe(.NET FW 4.8 WinForms,内置 csc 编译)
  src/Program.cs    启动契约校验、互斥体、资源定位、WebView2 面板 + JS 桥
  libs/             WebView2 控件库(取自字醒包,版本 1.0.4314.35)
panel/    面板前端(纯 HTML/JS,阶段1 无构建步骤)
dist/     构建产物(git 忽略)
build.ps1 一键构建
```

## 构建

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1              # 壳 + 核心
powershell -ExecutionPolicy Bypass -File build.ps1 -Pack        # 额外打包发布版 .aip(载荷嵌入)
powershell -ExecutionPolicy Bypass -File build.ps1 -RunStandalone   # 构建并独立运行核心
```

依赖:MinGW64(gcc/windres)、Python 3、.NET Framework 4.8(系统内置 csc)。

本仓库仅提交插件源码，不包含 SDK、参考插件、第三方运行库与模型；全新克隆不能直接构建。执行前需按 `build.ps1` 中的路径准备：

- `references/SDK/Adobe Illustrator 2027 SDK/tools/pipl/create_pipl.py`，用于生成 PIPL 资源。
- `references/字醒/web/index.html`、`web/js/{core,paddle-ocr,native-runtime,panel}.js` 与 `host/{main,guard}.jsx`，作为字体模块的构建输入。
- `core/libs/` 下的 `Microsoft.Web.WebView2.Core.dll`、`Microsoft.Web.WebView2.WinForms.dll`、`WebView2Loader.dll`；当前使用版本为 1.0.4314.35。
- OCR 运行资源按需放在 `references/字醒/web/ocr/`、`core/libs/ocr/` 和 `core/ocr/server/`。模型不随源码分发。
- PDF 转曲所需的 qpdf 12.4.2 与 Ghostscript 10.08 由 `tools/fetch-deps.ps1` 下载到 `core/tools/`(不入库)；构建时缺失会自动拉取。

当前构建脚本使用本机工具路径；换机时先核对 `$gcc`、`$windres` 和 `$csc`。

## 面板与快捷键

- 插件启动时创建面板，并按上次状态恢复；关闭 Illustrator 前面板可见，下次启动会自动回到停靠位置。
- 收起面板后的停靠图标由 `.aip` 内嵌的 SVG 资源提供。
- 快捷键 **Ctrl+Alt+Shift+Y**（仅在 Illustrator 前台时响应）显示/展开面板。
- 显示状态记录在 `%LOCALAPPDATA%\YunLi\panel-visible`。

## 在线更新

`update.json` 是版本清单(版本、Tag、资产名、SHA-256、说明)，位于仓库根目录。面板首页连接行提供「检查更新」：

- 清单按 `gh-proxy` → `ghfast` → `ghproxy` → jsDelivr → raw.githubusercontent 依次回退，国内网络可直接使用。
- 发布包从 GitHub Release 下载，同样按镜像回退；下载后校验 SHA-256，再交给后台脚本，在 Illustrator 退出后替换 `.aip` 并重新打开。
- 设置 `YUNLI_UPDATE_MANIFEST` / `YUNLI_UPDATE_ASSET` 可指向自建镜像或本地文件做测试。

发布新版本：

```powershell
powershell -ExecutionPolicy Bypass -File tools/release.ps1 -Notes "更新说明" -Publish
```

脚本读取 `core/src/Program.cs` 的 `Version`，构建单文件版，创建/更新 `yunli-v<版本>` Release，并重写 `update.json`；提交推送该文件后面板即可检查到新版本。

## 定向验证

在本目录构建后执行：

```powershell
node tools/uitest/preview-host-test.cjs
node tools/uitest/font-layout-test.cjs
node tools/uitest/shared-bridge-test.cjs
```

界面规范见 [DESIGN.md](DESIGN.md)。`tools/uitest/design-audit.cjs` 提供模拟桥的浏览器回归入口，依赖本机 `%APPDATA%/npm/node_modules/playwright` 及其 Chromium。模拟测试不能代替 Illustrator 实机验证。

## 运行链路

```
Illustrator 加载 YunLiTools.aip
  → PluginMain("SP Interface","Startup"):取套件、注册「窗口→Tool Palettes→YunLi工具箱」
  → 用户点菜单 → PluginMain("AI Menu","AI Go")
      → 创建 AI Panel(GetPlatformWindow 为停靠父窗口)
      → 载荷:开发 <aip>\payload\YunLiCore.exe 直启 / 发布:资源 10/101
        解包 %LOCALAPPDATA%\YunLi\<sha256>\ 再启动
      → CreateProcessW "\"...\" --parent <pid> --host \"<Illustrator.exe>\""
      → EnumWindows 按标题前缀 YunLiPanel + PID 找到子窗口 → SetParent 嵌入
  → YunLiCore.exe:校验父进程 → 互斥体 → WebView2 加载 assets\web\index.html
  → JS 桥:window.chrome.webview.postMessage(JSON) ↔ PostWebMessageAsString
```

开发便利:
- 环境变量 `YUNMAN_PAYLOAD_DIR` 指定载荷目录,免复制。
- `--standalone` 参数让核心脱离 Illustrator 独立运行(本机已验证:
  WebView2 就绪、桥握手成功)。

## 日志

- 壳:`%LOCALAPPDATA%\YunLi\startup.log`
- 核心:`%LOCALAPPDATA%\YunLi\panel.log`

## Illustrator 上安装测试(在有 AI 的机器)

1. 复制 `dist\payload\` 整个目录到 `.aip` 同目录(开发布局),或 `-Pack` 后单发 `.aip`。
2. Illustrator → 首选项 → 插件增效工具 → 附加插件目录指向测试目录(或直接放入 Plug-ins)。
3. 重启 AI → 窗口菜单底部「YunLi工具箱」→ 面板停靠出现即链路成功。
4. 排障看两个日志文件;菜单不出现通常是 PIPL 或附加目录设置问题。

## 已知与待办

- [x] 阶段1:壳/核心/桥全链路(本机验证至桥握手;AI 侧待真机)
- [x] 标记与工艺导出面板、脚本参数适配、共用画板图片查看器已实现；真实 Illustrator 操作待验证。
- [x] 字体与文字已并入主页面，OCR 资源惰性加载并复用消息桥；真实识别与重建待验证。
- [ ] 阶段4:发布版打包器 + CI
- 字醒版 WebView2 事件名与公开 SDK 不同(`CoreWebView2InitializationCompleted`),
  若换成官方 NuGet 包需改回 `CoreWebView2Ready`
