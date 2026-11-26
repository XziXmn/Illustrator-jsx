// =========================================================================
// YunLi工具箱核心进程 (YunLiCore.exe)
//
// .NET Framework 4.8 WinForms(C#5,系统内置 csc.exe 可编译)。
// 启动契约(与壳约定):
//   YunLiCore.exe --parent <AI的PID> --host "<Illustrator.exe路径>"
//   YunLiCore.exe --standalone            (开发: 跳过父进程校验)
// 行为:
//   1. 校验父进程确为 Illustrator.exe(--standalone 跳过)
//   2. 互斥体 Local\YunLiPanel-<pid> 防多开
//   3. 资源定位: 清单资源 "YunLi.Payload"(ZIP)优先,其次 exe 旁 assets\
//   4. 窗体标题 "YunLiPanel"(壳按前缀+PID 找窗口停靠)
//   5. WebView2(懒加载,缺失回退提示): 加载 assets\web\index.html,JS 桥互通
// =========================================================================
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace YunLi.Core
{
    internal static class Program
    {
        public const string Version = "0.4.3";

        internal static string AipPath;
        internal static string HostPath;
        internal static int HostPid;
        internal static IntPtr IpcHwnd;
        internal static int ShellVersion = 1;

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("shcore.dll")]
        private static extern int SetProcessDpiAwareness(int awareness);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetProcessDPIAware();

        // 与 Illustrator.exe 对齐为 Per-Monitor V2 DPI 感知，
        // 避免 Windows 把核心进程当成 DPI Unaware 导致嵌入面板右/底边被裁剪。
        private static void EnableDpiAwareness()
        {
            try
            {
                if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return;
            }
            catch (Exception) { }
            try
            {
                if (SetProcessDpiAwareness(2) == 0) return;
            }
            catch (Exception) { }
            try { SetProcessDPIAware(); }
            catch (Exception) { }
        }

        [STAThread]
        private static int Main(string[] args)
        {
            EnableDpiAwareness();
            Log("start " + string.Join(" ", args));
            try
            {
                return Run(args);
            }
            catch (Exception ex)
            {
                Log("fatal " + ex);
                MessageBox.Show(ex.Message, "YunLi工具箱",
                    MessageBoxButtons.OK, MessageBoxIcon.Hand);
                return 1;
            }
        }

        private static int Run(string[] args)
        {
            int parentPid = 0;
            string hostExe = null;
            string aipDir = null;
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--parent")
                    int.TryParse(args[i + 1], out parentPid);
                if (args[i] == "--host")
                    hostExe = args[i + 1];
                if (args[i] == "--aidir")
                    aipDir = args[i + 1];
                if (args[i] == "--aip")
                    AipPath = args[i + 1];
                if (args[i] == "--ipc")
                {
                    long rawHwnd;
                    if (long.TryParse(args[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out rawHwnd) && rawHwnd != 0)
                        IpcHwnd = new IntPtr(rawHwnd);
                }
                if (args[i] == "--shell-ver")
                {
                    int sv;
                    if (int.TryParse(args[i + 1], out sv) && sv > 0)
                        ShellVersion = sv;
                }
            }
            HostPath = hostExe;
            HostPid = parentPid;
            bool standalone = Array.IndexOf(args, "--standalone") >= 0;

            // 识别引擎自测: YunLiCore.exe --selftest-ocr <png> → 结果写 <png>.ocr.json
            // AI 兜底自测: YunLiCore.exe --selftest-ai <png> → 全部行强制走 Qwen 复识
            int selfTest = Array.IndexOf(args, "--selftest-ocr");
            int selfAi = Array.IndexOf(args, "--selftest-ai");
            int testIdx = selfAi >= 0 ? selfAi : selfTest;
            if (testIdx >= 0 && testIdx + 1 < args.Length)
            {
                string image = args[testIdx + 1];
                string outPath = image + ".ocr.json";
                bool vertical = args.Length > testIdx + 2 && args[testIdx + 2] == "vertical";
                try
                {
                    object result = OcrEngine.Recognize(image, ResolveAssets(), "zh", vertical);
                    if (selfAi >= 0) result = AiRescueSelftest(image, result);
                    File.WriteAllText(outPath, Json.Encode(result), new UTF8Encoding(false));
                    Log("selftest-ok " + outPath);
                }
                catch (Exception ex)
                {
                    File.WriteAllText(outPath, "{\"error\":\"" +
                        ex.Message.Replace("\\", "\\\\").Replace("\"", "'") + "\"}", new UTF8Encoding(false));
                    Log("selftest-fail " + ex);
                }
                return 0;
            }
            int assetsTest = Array.IndexOf(args, "--selftest-assets");
            if (assetsTest >= 0)
            {
                System.Diagnostics.Stopwatch watch = System.Diagnostics.Stopwatch.StartNew();
                string assetsPath = ResolveAssets();
                watch.Stop();
                Log("assets-selftest " + watch.ElapsedMilliseconds + "ms " + assetsPath);
                return 0;
            }
            int updateTest = Array.IndexOf(args, "--selftest-update");
            if (updateTest >= 0 && updateTest + 2 < args.Length)
            {
                string outFile = args[updateTest + 1];
                string simCurrent = args[updateTest + 2];
                int simShell = ShellVersion;
                bool simIpc = args.Length > updateTest + 3 && args[updateTest + 3] == "ipc";
                try
                {
                    object result = Update.Check(simCurrent, simShell, simIpc);
                    File.WriteAllText(outFile, Json.Encode(result), new UTF8Encoding(false));
                }
                catch (Exception ex)
                {
                    File.WriteAllText(outFile, "{\"error\":\"" +
                        ex.Message.Replace("\\", "\\\\").Replace("\"", "'") + "\"}", new UTF8Encoding(false));
                }
                return 0;
            }
            int pdfTest = Array.IndexOf(args, "--selftest-pdf");
            if (pdfTest >= 0 && pdfTest + 2 < args.Length)
            {
                string pdf = args[pdfTest + 1];
                string folder = args[pdfTest + 2];
                string curvePath = Path.Combine(folder, Path.GetFileName(pdf) + ".curve.json");
                try
                {
                    object result = PdfCurve.Convert(pdf, folder, ResolveAssets());
                    File.WriteAllText(curvePath, Json.Encode(result), new UTF8Encoding(false));
                    Log("pdf-selftest-ok " + curvePath);
                }
                catch (Exception ex)
                {
                    File.WriteAllText(curvePath, "{\"error\":\"" +
                        ex.Message.Replace("\\", "\\\\").Replace("\"", "'") + "\"}", new UTF8Encoding(false));
                    Log("pdf-selftest-fail " + ex.Message);
                }
                return 0;
            }

            if (!standalone)
            {
                if (parentPid <= 0)
                    throw new Exception("请从 Illustrator 的「窗口 → YunLi工具箱」打开面板。");
                bool isAi = false;
                try
                {
                    Process parent = Process.GetProcessById(parentPid);
                    string exe = parent.MainModule.FileName;
                    isAi = string.Equals(Path.GetFileName(exe), "Illustrator.exe",
                        StringComparison.OrdinalIgnoreCase);
                }
                catch (Exception) { }
                if (!isAi) throw new Exception("Illustrator 启动信息无效。");
            }

            string mutexName = "Local\\YunLiPanel-" +
                (parentPid > 0 ? parentPid.ToString() : "dev");
            bool createdNew;
            using (Mutex mutex = new Mutex(true, mutexName, out createdNew))
            {
                bool acquired = createdNew;
                if (!acquired)
                {
                    // 热重载瞬间旧核心可能尚未完全释放句柄，短暂等待 2.5 秒再判定多开。
                    try { acquired = mutex.WaitOne(2500, false); }
                    catch (AbandonedMutexException) { acquired = true; }
                }
                if (!acquired)
                {
                    Log("already-running");
                    return 0;
                }
                try
                {
                    string assets = ResolveAssets();
                    StartAiPackExtract(aipDir, standalone);
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    using (PanelForm form = new PanelForm(assets, standalone, hostExe, parentPid))
                    {
                        Application.Run(form);
                    }
                    Log("exit");
                    return 0;
                }
                finally
                {
                    try { mutex.ReleaseMutex(); }
                    catch (Exception) { }
                }
            }
        }

        // AI 兜底档自解压: .aip 旁的 YunLiAi.zip → %LOCALAPPDATA%\YunLi\bin|models。
        // 已有模型(标记文件存在)就跳过;解压在后台线程,不阻塞面板;中断后下次启动续做。
        private static void StartAiPackExtract(string aipDir, bool standalone)
        {
            if (string.IsNullOrEmpty(aipDir)) return;
            string zip = Path.Combine(aipDir, "YunLiAi.zip");
            string root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YunLi");
            string marker = Path.Combine(root, "models", "qwen2.5-vl-3b", "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf");
            if (!File.Exists(zip) || File.Exists(marker)) return;
            Thread worker = new Thread((ThreadStart)delegate
            {
                try
                {
                    Log("ai-pack extract start " + zip);
                    string fullRoot = Path.GetFullPath(root) + Path.DirectorySeparatorChar;
                    using (ZipArchive archive = new ZipArchive(File.OpenRead(zip), ZipArchiveMode.Read))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\")) continue;
                            string target = Path.GetFullPath(Path.Combine(root, entry.FullName));
                            if (!target.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
                                throw new Exception("AI 包路径无效。");
                            string dir = Path.GetDirectoryName(target);
                            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                            using (Stream s = entry.Open())
                            using (FileStream fs = File.Create(target))
                                s.CopyTo(fs);
                        }
                    }
                    Log("ai-pack extract done");
                }
                catch (Exception ex)
                {
                    Log("ai-pack extract failed " + ex.Message);
                }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        // 资源定位: 清单资源 "YunLi.Payload"(ZIP)优先,其次 exe 旁 assets\
        private static string ResolveAssets()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string adjacent = Path.Combine(baseDir, "assets");
            if (Directory.Exists(adjacent)) return adjacent;

            Stream zipStream = null;
            try
            {
                zipStream = Assembly.GetExecutingAssembly()
                    .GetManifestResourceStream("YunLi.Payload");
            }
            catch (Exception) { }
            if (zipStream == null)
            {
                Directory.CreateDirectory(adjacent);
                return adjacent;
            }

            string store = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "YunLi", "assets");
            string hashFile = Path.Combine(store, ".payload-hash");
            string marker = Path.Combine(store, "web", "index.html");
            // 指纹用 exe 的版本/大小/时间,避免每次启动重读 250MB 内嵌包。
            string fingerprint = PayloadFingerprint();
            if (File.Exists(marker) && File.Exists(hashFile)
                && File.ReadAllText(hashFile).Trim() == fingerprint)
            {
                Log("payload-cached " + store);
                zipStream.Dispose();
                return store;
            }

            try
            {
                Directory.CreateDirectory(store);
                string root = Path.GetFullPath(store) + Path.DirectorySeparatorChar;
                using (ZipArchive zip = new ZipArchive(zipStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in zip.Entries)
                    {
                        // ZIP 里的目录条目(如 tools/gs/Resource/)没有文件名,
                        // 直接 File.Create 会落到 "...\Resource\" 上并抛“找不到路径的一部分”。
                        if (entry.Name.Length == 0
                            || entry.FullName.EndsWith("/")
                            || entry.FullName.EndsWith("\\")) continue;
                        string target = Path.GetFullPath(Path.Combine(store, entry.FullName));
                        if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                            throw new Exception("插件包路径无效。");
                        string dir = Path.GetDirectoryName(target);
                        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                        using (Stream s = entry.Open())
                        using (FileStream fs = File.Create(target))
                            s.CopyTo(fs);
                    }
                }
                // 发布模式: 把 WebView2 DLL 复制到 exe 目录,保证程序集与原生加载器可解析
                foreach (string dll in Directory.GetFiles(store, "*.dll"))
                {
                    string dest = Path.Combine(baseDir, Path.GetFileName(dll));
                    File.Copy(dll, dest, true);
                }
                File.WriteAllText(hashFile, fingerprint);
                Log("payload-extracted " + store);
                return store;
            }
            catch (Exception ex)
            {
                // 解压失败不要挡住整个插件:有可用面板就继续,具体工具缺资源时自行报错。
                Log("payload-extract-failed " + ex.Message);
                try { if (File.Exists(hashFile)) File.Delete(hashFile); }
                catch (Exception) { }
                if (File.Exists(marker)) return store;
                Directory.CreateDirectory(adjacent);
                return adjacent;
            }
            finally
            {
                zipStream.Dispose();
            }
        }

        // 内嵌载荷随 exe 编译,exe 的版本/大小/修改时间足以判断是否需要重新解压。
        private static string PayloadFingerprint()
        {
            try
            {
                FileInfo info = new FileInfo(Assembly.GetExecutingAssembly().Location);
                return Program.Version + "|" + info.Length + "|" + info.LastWriteTimeUtc.Ticks;
            }
            catch (Exception)
            {
                return Program.Version;
            }
        }

        public static void Log(string line)
        {
            try
            {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "YunLi");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "panel.log");
                FileInfo fi = new FileInfo(path);
                if (fi.Exists && fi.Length > 262144) File.Delete(path);
                File.AppendAllText(path,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + Version + " " + line + "\r\n");
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        // Qwen 兜底:server 模型低置信的行交给 VL 复识,换文字后置信压到 0.88 强制人工校对。
        // 每次识别最多 5 行,防止异常稿子拖死等待。
        internal static object AiRescueSelftest(string image, object result)
        {
            Dictionary<string, object> data = (Dictionary<string, object>)result;
            List<object> lines = (List<object>)data["lines"];
            foreach (object lineObj in lines)
            {
                Dictionary<string, object> line = (Dictionary<string, object>)lineObj;
                line["confidence"] = 0.0;   // 自测:全部行强制走 AI 复识
            }
            Log("selftest-ai probe=" + AiEngine.Probe());
            return AiRescueStatic(image, data, 0.5);
        }

        internal static object AiRescueStatic(string image, Dictionary<string, object> data, double threshold)
        {
            if (!AiEngine.Probe()) return data;
            List<object> lines = (List<object>)data["lines"];
            if (lines == null || lines.Count == 0) return data;
            int width = Convert.ToInt32(Convert.ToDouble(data["width"], CultureInfo.InvariantCulture));
            int height = Convert.ToInt32(Convert.ToDouble(data["height"], CultureInfo.InvariantCulture));
            int calls = 0;
            using (Bitmap bitmap = new Bitmap(image))
            {
                foreach (object lineObj in lines)
                {
                    Dictionary<string, object> line = (Dictionary<string, object>)lineObj;
                    double conf = Convert.ToDouble(line["confidence"], CultureInfo.InvariantCulture);
                    if (conf >= threshold || calls >= 5) continue;
                    Rectangle crop = new Rectangle(
                        (int)(Convert.ToDouble(line["x"], CultureInfo.InvariantCulture) * width),
                        (int)((1.0 - Convert.ToDouble(line["y"], CultureInfo.InvariantCulture) - Convert.ToDouble(line["height"], CultureInfo.InvariantCulture)) * height),
                        (int)Math.Ceiling(Convert.ToDouble(line["width"], CultureInfo.InvariantCulture) * width),
                        (int)Math.Ceiling(Convert.ToDouble(line["height"], CultureInfo.InvariantCulture) * height));
                    long elapsed;
                    string paddle = (string)line["text"];
                    string ai = AiEngine.RecognizeCrop(bitmap, crop, out elapsed);
                    calls++;
                    if (string.IsNullOrEmpty(ai) || ai == paddle) continue;
                    line["text"] = ai;
                    line["confidence"] = 0.88;
                    line["stable"] = false;
                    line["method"] = "qwen2.5-vl-rescue";
                    line["chars"] = new List<object>();
                    line["paddleText"] = paddle;
                    Log("ai-rescue '" + paddle + "' -> '" + ai + "' (" + elapsed + "ms)");
                }
            }
            return data;
        }
    }

    // =====================================================================
    // 主窗体: 标题 = YunLiPanel(壳停靠协议)
    // WebView2 类型在此类中使用 → 只有走到相关方法时才加载 DLL,
    // 缺失/超时回退到纯 WinForms 提示界面(停靠链路仍可验证)
    // =====================================================================
    internal class PanelForm : Form
    {
        private readonly string assets;
        private readonly bool standalone;
        private readonly string hostExe;
        private readonly int parentPid;
        private WebView2 webView;
        private HostBridge bridge;
        private FontMatcher matcher;
        private readonly Dictionary<string, string> works = new Dictionary<string, string>();
        private bool fontBusy;

        public PanelForm(string assetsDir, bool standaloneMode, string hostPath, int parent)
        {
            assets = assetsDir;
            standalone = standaloneMode;
            hostExe = hostPath;
            parentPid = parent;
            Text = "YunLiPanel";
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new System.Drawing.Size(360, 560);
            BackColor = System.Drawing.Color.White;
            if (!standaloneMode)
            {
                // 停靠模式:去掉系统边框,窗体铺满停靠格,客户区不再被标题条裁掉。
                FormBorderStyle = FormBorderStyle.None;
                ControlBox = false;
                MaximizeBox = false;
                MinimizeBox = false;
                ShowInTaskbar = false;
            }

            Label label = new Label
            {
                Text = "YunLi工具箱 " + Program.Version +
                       (standalone ? "（开发模式）" : "") + "\r\n正在初始化面板…",
                Dock = DockStyle.Fill,
                TextAlign = System.Drawing.ContentAlignment.MiddleCenter,
                Name = "statusLabel"
            };
            Controls.Add(label);
            Load += new EventHandler(OnFormLoad);
            FormClosed += new FormClosedEventHandler(delegate(object s, FormClosedEventArgs e2)
            {
                AiEngine.Shutdown();   // 兜底档子进程随核心退出
            });
        }

        private const int WM_YUNLI_SEL_CHANGED = 0x8000 + 10; /* WM_APP + 10 */

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_YUNLI_SEL_CHANGED)
            {
                Deliver(new Dictionary<string, object> { { "eventType", "selectionChanged" } });
                return;
            }
            base.WndProc(ref m);
        }

        private void OnFormLoad(object sender, EventArgs e)
        {
            try
            {
                InitWebView2();   // 本方法用到 WebView2 类型: DLL 缺失时在此抛出
            }
            catch (Exception ex)
            {
                Program.Log("webview2-missing " + ex.Message);
                ShowFallback("未找到 WebView2 组件或运行时。");
            }
        }

        private void InitWebView2()
        {
            string indexHtml = Path.Combine(assets, "web", "index.html");
            if (!File.Exists(indexHtml))
            {
                ShowFallback("缺少面板页面（assets\\web\\index.html）。");
                return;
            }
            string userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "YunLi", "WebView2");
            Directory.CreateDirectory(userData);

            webView = new WebView2 { Dock = DockStyle.Fill };
            webView.CoreWebView2InitializationCompleted += OnInitialized;
            Controls.Add(webView);
            webView.BringToFront();

            // 不阻塞 UI 线程(C#5 无 await): 环境创建完成后回 UI 线程继续
            CoreWebView2Environment.CreateAsync(null, userData, null)
                .ContinueWith(delegate(Task<CoreWebView2Environment> t)
                {
                    if (t.IsFaulted)
                    {
                        Program.Log("webview2-env-error " + t.Exception);
                        ShowFallback("WebView2 环境创建失败。");
                        return;
                    }
                    webView.EnsureCoreWebView2Async(t.Result);
                }, TaskScheduler.FromCurrentSynchronizationContext());
        }

        private void OnInitialized(object sender,
            CoreWebView2InitializationCompletedEventArgs e)
        {
            try
            {
                string webRoot = Path.GetFullPath(Path.Combine(assets, "web"));
                // file:// 的 origin 是 null，识别用的 Worker / wasm 会被浏览器拒绝。
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "yunli.local", webRoot, CoreWebView2HostResourceAccessKind.Allow);
                webView.CoreWebView2.WebMessageReceived += OnWebMessage;
                webView.CoreWebView2.Navigate("https://yunli.local/index.html");
                Program.Log("webview2-ready");
            }
            catch (Exception ex)
            {
                Program.Log("webview2-navigate-error " + ex);
                ShowFallback("面板页面加载失败。");
            }
        }

        // 主界面 postMessage 的是 JSON 文本；字体页 postMessage 的是对象。
        // 对象消息调用 TryGetWebMessageAsString 会抛异常，不能因此丢掉整条消息。
        private void OnWebMessage(object sender,
            CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string asString = null;
                try { asString = e.TryGetWebMessageAsString(); }
                catch (Exception) { }

                if (!string.IsNullOrEmpty(asString))
                {
                    if (IsFontMessage(asString))
                    {
                        HandleFontMessage(asString);
                        return;
                    }
                    string reply = HandleAction(asString);
                    webView.CoreWebView2.PostWebMessageAsString(reply ?? "{}");
                    return;
                }

                string json = e.WebMessageAsJson;
                if (string.IsNullOrEmpty(json)) return;
                Program.Log("font-msg " + (json.Length > 100 ? json.Substring(0, 100) : json));
                if (json[0] == '"')
                {
                    object boxed = new System.Web.Script.Serialization.JavaScriptSerializer()
                        .DeserializeObject(json);
                    string inner = boxed as string;
                    if (inner != null)
                    {
                        if (IsFontMessage(inner)) HandleFontMessage(inner);
                        else webView.CoreWebView2.PostWebMessageAsString(HandleAction(inner) ?? "{}");
                        return;
                    }
                }
                HandleFontMessage(json);
            }
            catch (Exception ex)
            {
                Program.Log("bridge-error " + ex);
            }
        }

        private static bool IsFontMessage(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            string trimmed = text.TrimStart();
            return trimmed.StartsWith("{") &&
                trimmed.IndexOf("\"method\"", StringComparison.Ordinal) >= 0;
        }

        private void Deliver(object body)
        {
            string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(Json.Encode(body)));
            string script = "window.__yunliDeliver&&window.__yunliDeliver('" + encoded + "')";
            Action run = delegate
            {
                try
                {
                    if (webView != null && webView.CoreWebView2 != null)
                        webView.CoreWebView2.ExecuteScriptAsync(script);
                }
                catch (Exception ex) { Program.Log("deliver " + ex.Message); }
            };
            if (InvokeRequired) BeginInvoke(run);
            else run();
        }

        private HostBridge Bridge()
        {
            if (bridge == null)
            {
                if (string.IsNullOrEmpty(hostExe))
                    throw new Exception("请从 Illustrator 的「窗口 → YunLi工具箱」打开。");
                bridge = new HostBridge(assets, hostExe, parentPid);
            }
            return bridge;
        }

        private void HandleFontMessage(string json)
        {
            Dictionary<string, object> msg = Json.Object(json);
            object idObj;
            msg.TryGetValue("id", out idObj);
            string id = idObj as string;
            object methodObj;
            msg.TryGetValue("method", out methodObj);
            string method = methodObj as string;
            object payloadObj;
            Dictionary<string, object> payload = (msg.TryGetValue("payload", out payloadObj) && payloadObj is Dictionary<string, object>)
                ? (Dictionary<string, object>)payloadObj
                : new Dictionary<string, object>();
            string session = Json.String(payload, "session") == "overlay" ? "overlay" : "restore";
            try
            {
                if (method == "cleanup")
                {
                    CleanWorks(payload.ContainsKey("all") && object.Equals(payload["all"], true) ? null : session);
                    Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", new Dictionary<string, object>() } });
                    return;
                }
                if (method == "tool")
                {
                    string toolAction = Json.String(payload, "action");
                    Program.Log("tool " + toolAction);
                    object toolInnerObj;
                    Dictionary<string, object> toolInner = (payload.TryGetValue("payload", out toolInnerObj) && toolInnerObj is Dictionary<string, object>)
                        ? (Dictionary<string, object>)toolInnerObj
                        : new Dictionary<string, object>();
                    if (toolAction == "updateCheck")
                    {
                        Task.Run(delegate { return (object)YunLi.Core.Update.Check(Program.Version, Program.ShellVersion, NativeShellBridge.Available); })
                            .ContinueWith(delegate(Task<object> task)
                            {
                                if (task.IsFaulted)
                                {
                                    string err = task.Exception.GetBaseException().Message;
                                    Program.Log("update-error " + err);
                                    Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                                }
                                else Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                            });
                        return;
                    }
                    if (toolAction == "updateDownload" || toolAction == "updateDownloadHot")
                    {
                        bool isHot = toolAction == "updateDownloadHot";
                        string version = Json.String(toolInner, "version");
                        string tag = Json.String(toolInner, "tag");
                        string asset = Json.String(toolInner, "asset");
                        string sha256 = Json.String(toolInner, "sha256");
                        string url = Json.String(toolInner, "url");
                        string messageId = id;
                        Task.Run(delegate
                        {
                            Action<long, long> onProg = delegate(long received, long total)
                            {
                                Deliver(new Dictionary<string, object> {
                                    { "id", messageId }, { "eventType", "progress" },
                                    { "data", new Dictionary<string, object> { { "received", received }, { "total", total } } }
                                });
                            };
                            return isHot
                                ? (object)YunLi.Core.Update.DownloadHot(version, tag, asset, sha256, url, onProg)
                                : (object)YunLi.Core.Update.Download(version, tag, asset, sha256, url, onProg);
                        }).ContinueWith(delegate(Task<object> task)
                        {
                            if (task.IsFaulted)
                            {
                                string err = task.Exception.GetBaseException().Message;
                                Program.Log("update-download-error " + err);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                            }
                            else
                            {
                                Program.Log(isHot ? "update-hot-download-ok" : "update-download-ok");
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                            }
                        });
                        return;
                    }
                    if (toolAction == "updateHotInstall")
                    {
                        string file = Json.String(toolInner, "file");
                        string version = Json.String(toolInner, "version");
                        string assetsDir = assets;
                        Task.Run(delegate
                        {
                            return (object)YunLi.Core.Update.InstallHot(file, version, assetsDir);
                        }).ContinueWith(delegate(Task<object> task)
                        {
                            if (task.IsFaulted)
                            {
                                string err = task.Exception.GetBaseException().Message;
                                Program.Log("update-hot-install-error " + err);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                            }
                            else
                            {
                                Program.Log("update-hot-install-ok " + version);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                                ScheduleHotReload();
                            }
                        });
                        return;
                    }
                    if (toolAction == "updateInstall")
                    {
                        string file = Json.String(toolInner, "file");
                        Deliver(new Dictionary<string, object> {
                            { "id", id }, { "ok", true },
                            { "data", YunLi.Core.Update.Install(file, Program.AipPath, Program.HostPath, Program.HostPid) }
                        });
                        return;
                    }
                    if (toolAction == "pickFiles")
                    {
                        string[] picked = new string[0];
                        Action choose = delegate
                        {
                            using (OpenFileDialog dlg = new OpenFileDialog())
                            {
                                dlg.Title = "选择要转曲的 PDF / AI";
                                dlg.Filter = "PDF 与 Illustrator|*.pdf;*.ai|所有文件|*.*";
                                dlg.Multiselect = !object.Equals(toolInner.ContainsKey("single") ? toolInner["single"] : null, true);
                                if (dlg.ShowDialog(this) == DialogResult.OK && dlg.FileNames != null)
                                    picked = dlg.FileNames;
                            }
                        };
                        if (InvokeRequired) Invoke(choose);
                        else choose();
                        Deliver(new Dictionary<string, object> {
                            { "id", id }, { "ok", true },
                            { "data", new Dictionary<string, object> { { "files", picked } } }
                        });
                        return;
                    }
                    if (toolAction == "pdfOutline")
                    {
                        object[] files;
                        try { files = Json.Array(toolInner, "files"); }
                        catch (Exception) { files = new object[0]; }
                        string folder = Json.String(toolInner, "folder");
                        string assetsDir = assets;
                        Task.Run(delegate
                        {
                            List<object> results = new List<object>();
                            for (int n = 0; n < files.Length; n++)
                            {
                                string file = files[n] as string;
                                Deliver(new Dictionary<string, object> {
                                    { "id", id }, { "eventType", "progress" },
                                    { "data", new Dictionary<string, object> { { "file", file }, { "index", n + 1 }, { "count", files.Length } } }
                                });
                                try
                                {
                                    results.Add(PdfCurve.Convert(file, folder, assetsDir));
                                }
                                catch (Exception ex)
                                {
                                    results.Add(new Dictionary<string, object> {
                                        { "ok", false }, { "input", file }, { "error", ex.Message }
                                    });
                                }
                            }
                            return (object)new Dictionary<string, object> { { "files", results.ToArray() } };
                        }).ContinueWith(delegate(Task<object> task)
                        {
                            if (task.IsFaulted)
                            {
                                string err = task.Exception.GetBaseException().Message;
                                Program.Log("pdf-error " + err);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                            }
                            else
                            {
                                Program.Log("pdf-ok");
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                            }
                        });
                        return;
                    }
                    if (toolAction == "pickFolder")
                    {
                        string picked = "";
                        Action choose = delegate
                        {
                            using (FolderBrowserDialog dlg = new FolderBrowserDialog())
                            {
                                dlg.Description = "选择导出文件夹";
                                dlg.ShowNewFolderButton = true;
                                if (dlg.ShowDialog(this) == DialogResult.OK && dlg.SelectedPath != null)
                                    picked = dlg.SelectedPath;
                            }
                        };
                        if (InvokeRequired) Invoke(choose);
                        else choose();
                        Deliver(new Dictionary<string, object> {
                            { "id", id }, { "ok", true },
                            { "data", new Dictionary<string, object> { { "path", picked } } }
                        });
                        return;
                    }
                    if (toolAction == "splitInspect" || toolAction == "splitRun"
                        || toolAction == "spotSelectInspect" || toolAction == "spotSelectRun")
                    {
                        bool needNativeOnly = (toolAction == "splitInspect" || toolAction == "splitRun");
                        Task<object> nativeOrFallback;
                        if (NativeShellBridge.Available)
                        {
                            nativeOrFallback = NativeShellBridge.Execute(toolAction, toolInner);
                        }
                        else if (needNativeOnly)
                        {
                            TaskCompletionSource<object> tcs = new TaskCompletionSource<object>();
                            tcs.SetException(new Exception("未连接到新版插件的原生无损裁切接口，请重启 Illustrator 加载最新 YunLiTools.aip 后重试。"));
                            nativeOrFallback = tcs.Task;
                        }
                        else
                        {
                            nativeOrFallback = Bridge().ExecuteTool(toolAction, toolInner);
                        }
                        nativeOrFallback.ContinueWith(delegate(Task<object> task)
                        {
                            if (task.IsFaulted)
                            {
                                string err = task.Exception.GetBaseException().Message;
                                Program.Log("tool-error " + toolAction + " " + err);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                            }
                            else
                            {
                                Program.Log("tool-ok " + toolAction);
                                Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                            }
                        });
                        return;
                    }
                    Task<object> toolTask = toolAction == "preview" ? CreateToolPreview(toolInner) : Bridge().ExecuteTool(toolAction, toolInner);
                    toolTask.ContinueWith(delegate(Task<object> task)
                    {
                        if (task.IsFaulted)
                        {
                            string err = task.Exception.GetBaseException().Message;
                            Program.Log("tool-error " + toolAction + " " + err);
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                        }
                        else
                        {
                            Program.Log("tool-ok " + toolAction);
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                        }
                    });
                    return;
                }
                if (method == "ocr")
                {
                    // 识别档位路由:C# server 模型(横竖排)→ 低置信行 Qwen 复识;不可用则交还页面走 wasm 降档
                    if (!OcrEngine.Available(assets))
                    {
                        Deliver(new Dictionary<string, object> {
                            { "id", id }, { "ok", true },
                            { "data", new Dictionary<string, object> { { "native", false } } }
                        });
                        return;
                    }
                    string dir;
                    if (!works.TryGetValue(session, out dir))
                        throw new Exception("识别记录已失效。");
                    string image = Path.Combine(dir, "selection.png");
                    string lang = Json.String(payload, "language") ?? "zh";
                    bool vertical = payload.ContainsKey("vertical") && object.Equals(payload["vertical"], true);
                    bool forceAi = payload.ContainsKey("forceAi") && object.Equals(payload["forceAi"], true);
                    Task.Run(delegate
                    {
                        System.Diagnostics.Stopwatch watch = System.Diagnostics.Stopwatch.StartNew();
                        object result = OcrEngine.Recognize(image, assets, lang, vertical);
                        watch.Stop();
                        Program.Log("ocr-done " + watch.ElapsedMilliseconds + "ms vertical=" + (vertical ? "1" : "0"));
                        return AiRescueInstance(image, result, forceAi ? 0.0 : 0.85);
                    }).ContinueWith(delegate(Task<object> task)
                    {
                        if (task.IsFaulted)
                        {
                            Program.Log("ocr-error " + task.Exception.GetBaseException().Message);
                            Deliver(new Dictionary<string, object> {
                                { "id", id }, { "ok", true },
                                { "data", new Dictionary<string, object> { { "native", false } } }
                            });
                        }
                        else
                        {
                            Program.Log("ocr-ok native-server");
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                        }
                    });
                    return;
                }
                if (method == "host")
                {
                    string action = Json.String(payload, "action");
                    Program.Log("host " + action);
                    object innerObj;
                    Dictionary<string, object> inner = (payload.TryGetValue("payload", out innerObj) && innerObj is Dictionary<string, object>)
                        ? (Dictionary<string, object>)innerObj
                        : new Dictionary<string, object>();
                    if (action == "capture")
                    {
                        CleanWorks(session);
                        string dir = Path.Combine(Path.GetTempPath(), "yunli-" + Guid.NewGuid().ToString("N"));
                        Directory.CreateDirectory(dir);
                        works[session] = dir;
                        inner["mode"] = session;
                        inner["path"] = Path.Combine(dir, "selection.png");
                    }
                    Bridge().Execute(action, inner).ContinueWith(delegate(Task<object> task)
                    {
                        if (task.IsFaulted)
                        {
                            string err = task.Exception.GetBaseException().Message;
                            Program.Log("host-error " + action + " " + err);
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", err } });
                        }
                        else
                        {
                            Program.Log("host-ok " + action);
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                        }
                    });
                    return;
                }
                if (method == "image")
                {
                    string dir;
                    if (!works.TryGetValue(session, out dir))
                        throw new Exception("识别记录已失效。");
                    byte[] bytes = File.ReadAllBytes(Path.Combine(dir, "selection.png"));
                    Deliver(new Dictionary<string, object> {
                        { "id", id }, { "ok", true },
                        { "data", new Dictionary<string, object> { { "image", "data:image/png;base64," + Convert.ToBase64String(bytes) } } }
                    });
                    return;
                }
                if (method == "match")
                {
                    string dir;
                    if (!works.TryGetValue(session, out dir))
                        throw new Exception("识别记录已失效。");
                    string image = Path.Combine(dir, "selection.png");
                    if (matcher == null) matcher = new FontMatcher(hostExe);
                    Task.Run(delegate
                    {
                        return matcher.Match(image, payload, delegate(object data)
                        {
                            Deliver(new Dictionary<string, object> { { "id", id }, { "eventType", "progress" }, { "data", data } });
                        });
                    }).ContinueWith(delegate(Task<object> task)
                    {
                        if (task.IsFaulted)
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", task.Exception.InnerException.Message } });
                        else
                            Deliver(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "data", task.Result } });
                    });
                    return;
                }
                throw new Exception("不支持的操作。");
            }
            catch (Exception ex)
            {
                if (id != null)
                    Deliver(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", ex.Message } });
            }
        }

        // 页面只接收图像数据，临时路径由核心生成，不接受前端指定的读写路径。
        private async Task<object> CreateToolPreview(Dictionary<string, object> payload)
        {
            string dir = Path.Combine(Path.GetTempPath(), "yunli-preview-" + Guid.NewGuid().ToString("N"));
            string file = Path.Combine(dir, "preview.png");
            Directory.CreateDirectory(dir);
            try
            {
                var args = new Dictionary<string, object>(payload);
                args["file"] = file;
                var data = await Bridge().ExecuteTool("preview", args) as Dictionary<string, object>;
                if (data == null || !File.Exists(file)) throw new Exception("画板预览未生成，请重试。");
                if (new FileInfo(file).Length > 8 * 1024 * 1024) throw new Exception("画板预览过大，请重试。");
                data["image"] = "data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(file));
                return data;
            }
            finally
            {
                try { File.Delete(file); Directory.Delete(dir); }
                catch (Exception ex) { Program.Log("preview-cleanup " + ex.Message); }
            }
        }

        // Qwen 兜底:server 模型低置信的行交给 VL 复识,换文字后置信压到 0.88 强制人工校对
        private object AiRescueInstance(string image, object result, double threshold)
        {
            return Program.AiRescueStatic(image, (Dictionary<string, object>)result, threshold);
        }

        private void CleanWorks(string session)
        {
            if (session == null)
            {
                foreach (string dir in new List<string>(works.Values))
                    TryDelete(dir);
                works.Clear();
                return;
            }
            string one;
            if (works.TryGetValue(session, out one))
            {
                TryDelete(one);
                works.Remove(session);
            }
        }

        private static void TryDelete(string dir)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, true); }
            catch (Exception) { }
        }

        // 消息路由(C#5 最小实现;阶段2 扩展为模块路由)
        private string HandleAction(string json)
        {
            Program.Log("bridge " + json);
            if (json == null) json = "";
            string v = "\"" + Program.Version + "\"";
            if (json.IndexOf("ping", StringComparison.Ordinal) >= 0)
                return "{\"ok\":true,\"action\":\"pong\",\"version\":" + v + "}";
            if (json.IndexOf("hello", StringComparison.Ordinal) >= 0)
                return "{\"ok\":true,\"action\":\"hello\",\"version\":" + v +
                       ",\"standalone\":" + (standalone ? "true" : "false") + "}";
            return "{\"ok\":false,\"error\":\"unknown-action\"}";
        }

        private void ScheduleHotReload()
        {
            Action trigger = delegate
            {
                System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
                timer.Interval = 220;
                timer.Tick += delegate
                {
                    timer.Stop();
                    timer.Dispose();
                    NativeShellBridge.RequestReload();
                    Application.Exit();
                };
                timer.Start();
            };
            if (InvokeRequired) BeginInvoke(trigger);
            else trigger();
        }

        private void ShowFallback(string reason)
        {
            foreach (Control c in Controls)
            {
                Label lbl = c as Label;
                if (lbl != null)
                {
                    lbl.Text = "YunLi工具箱 " + Program.Version +
                               (standalone ? "（开发模式）" : "") +
                               "\r\n" + reason +
                               "\r\n\r\n面板链路（菜单 → 进程 → 停靠）不受影响。";
                    lbl.BringToFront();
                    return;
                }
            }
        }
    }

    // =====================================================================
    // 原生 C 壳 IPC 通道(WM_COPYDATA → YunLiTools.aip 主线程 HiddenWndProc)
    // 用于像素级无损图片分切与高速专色百分比选择。
    // =====================================================================
    internal static class NativeShellBridge
    {
        private const uint WM_COPYDATA = 0x004A;
        private const uint WM_YUNLI_RELOAD = 0x8000 + 11; /* WM_APP + 11 */
        private const uint SMTO_ABORTIFHUNG = 0x0002;
        private static readonly IntPtr Magic = new IntPtr(0x594C4950); /* 'YLIP' */

        [StructLayout(LayoutKind.Sequential)]
        private struct COPYDATASTRUCT
        {
            public IntPtr dwData;
            public int cbData;
            public IntPtr lpData;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool PostMessageW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr SendMessageTimeoutW(
            IntPtr hWnd, uint msg, IntPtr wParam, ref COPYDATASTRUCT lParam,
            uint flags, uint timeoutMs, out IntPtr result);

        public static bool Available
        {
            get { return Program.IpcHwnd != IntPtr.Zero && IsWindow(Program.IpcHwnd); }
        }

        public static bool RequestReload()
        {
            if (!Available) return false;
            return PostMessageW(Program.IpcHwnd, WM_YUNLI_RELOAD, IntPtr.Zero, IntPtr.Zero);
        }

        public static Task<object> Execute(string action, Dictionary<string, object> payload)
        {
            return Task.Run(delegate
            {
                if (!Available) throw new Exception("原生插件接口不可用，请重启 Illustrator。");
                string dir = Path.Combine(Path.GetTempPath(), "yunli-ipc");
                Directory.CreateDirectory(dir);
                string token = Guid.NewGuid().ToString("N");
                string reqPath = Path.Combine(dir, token + ".req.json");
                string resPath = Path.Combine(dir, token + ".res.json");
                try
                {
                    Dictionary<string, object> req = new Dictionary<string, object>();
                    if (payload != null)
                    {
                        foreach (KeyValuePair<string, object> kv in payload) req[kv.Key] = kv.Value;
                    }
                    req["action"] = action;
                    File.WriteAllText(reqPath, Json.Encode(req), new UTF8Encoding(false));

                    string wire = reqPath + "|" + resPath;
                    byte[] bytes = Encoding.Unicode.GetBytes(wire + "\0");
                    IntPtr mem = Marshal.AllocHGlobal(bytes.Length);
                    IntPtr msgResult;
                    IntPtr ok;
                    try
                    {
                        Marshal.Copy(bytes, 0, mem, bytes.Length);
                        COPYDATASTRUCT cds = new COPYDATASTRUCT
                        {
                            dwData = Magic,
                            cbData = bytes.Length,
                            lpData = mem
                        };
                        ok = SendMessageTimeoutW(Program.IpcHwnd, WM_COPYDATA, IntPtr.Zero, ref cds,
                            SMTO_ABORTIFHUNG, 120000, out msgResult);
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(mem);
                    }

                    if (ok == IntPtr.Zero || msgResult == IntPtr.Zero)
                        throw new Exception("Illustrator 原生插件无响应，请确认没有未关闭的模态弹窗后重试。");
                    if (!File.Exists(resPath))
                        throw new Exception("原生插件未返回结果。");

                    string raw = File.ReadAllText(resPath, Encoding.UTF8);
                    Dictionary<string, object> dict = Json.Object(raw);
                    if (!dict.ContainsKey("ok") || !(dict["ok"] is bool) || !(bool)dict["ok"])
                        throw new Exception(Json.String(dict, "error") ?? "原生操作未完成。");
                    return dict.ContainsKey("data") ? dict["data"] : (object)new Dictionary<string, object>();
                }
                finally
                {
                    try { if (File.Exists(reqPath)) File.Delete(reqPath); } catch (Exception) { }
                    try { if (File.Exists(resPath)) File.Delete(resPath); } catch (Exception) { }
                }
            });
        }
    }
}
