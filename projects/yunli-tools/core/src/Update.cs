using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace YunLi.Core
{
    // 在线更新：
    //   1. 从仓库 update.json 读取最新版本（国内镜像优先，GitHub 兜底）；
    //   2. 新版壳（shellVersion >= minShell 且 IPC 可用）优先走轻量热更新包 YunLiHot-<ver>.zip，
    //      解压到 %LOCALAPPDATA%\YunLi\hot\<ver>\ 并切换指针，通知 C 壳免重启热重载；
    //   3. 旧版壳或涉及 C 壳变更的版本自动走全量 .aip 下载并在退出 Illustrator 后替换。
    public static class Update
    {
        private const string Repo = "XziXmn/Illustrator-jsx";
        private const string AssetName = "YunLiTools.aip";
        private const string RawBase = "https://raw.githubusercontent.com/" + Repo + "/main/update.json";
        private const string CdnBase = "https://cdn.jsdelivr.net/gh/" + Repo + "@main/update.json";

        public static Dictionary<string, object> Check(string current)
        {
            return Check(current, 1, false);
        }

        public static Dictionary<string, object> Check(string current, int shellVersion, bool ipcAvailable)
        {
            string raw = null;
            string source = null;
            string lastError = null;
            foreach (string url in ManifestSources())
            {
                try
                {
                    raw = Http.Text(url, 12000);
                    source = url;
                    break;
                }
                catch (Exception ex) { lastError = ex.Message; }
            }
            if (raw == null)
                throw new Exception("检查更新失败：GitHub 与镜像都不可用。" + Short(lastError));

            Dictionary<string, object> manifest;
            try { manifest = Json.Object(raw); }
            catch (Exception) { throw new Exception("更新信息格式无效：" + Host(source)); }

            string latest = Json.String(manifest, "version");
            if (string.IsNullOrEmpty(latest))
                throw new Exception("更新信息缺少版本号：" + Host(source));
            string tag = Json.String(manifest, "tag");
            if (string.IsNullOrEmpty(tag)) tag = "yunli-v" + latest;
            string asset = Json.String(manifest, "asset");
            if (string.IsNullOrEmpty(asset)) asset = AssetName;

            string hotAsset = "";
            string hotSha256 = "";
            string hotUrl = "";
            int hotMinShell = 2;
            object hotObj;
            if (manifest.TryGetValue("hot", out hotObj) && hotObj is Dictionary<string, object>)
            {
                Dictionary<string, object> hot = (Dictionary<string, object>)hotObj;
                hotAsset = Json.String(hot, "asset") ?? "";
                hotSha256 = Json.String(hot, "sha256") ?? "";
                hotUrl = Json.String(hot, "url") ?? "";
                object minShellObj;
                if (hot.TryGetValue("minShell", out minShellObj) && minShellObj != null)
                {
                    try { hotMinShell = Convert.ToInt32(minShellObj, CultureInfo.InvariantCulture); }
                    catch (Exception) { hotMinShell = 2; }
                }
            }
            bool canHot = ipcAvailable && !string.IsNullOrEmpty(hotAsset) && shellVersion >= hotMinShell;

            return new Dictionary<string, object> {
                { "currentVersion", current },
                { "latestVersion", latest },
                { "newer", Compare(latest, current) > 0 },
                { "tag", tag },
                { "asset", asset },
                { "sha256", Json.String(manifest, "sha256") ?? "" },
                { "url", Json.String(manifest, "url") ?? "" },
                { "canHot", canHot },
                { "shellVersion", shellVersion },
                { "hotAsset", hotAsset },
                { "hotSha256", hotSha256 },
                { "hotUrl", hotUrl },
                { "hotMinShell", hotMinShell },
                { "notes", Json.String(manifest, "notes") ?? "" },
                { "published", Json.String(manifest, "published") ?? "" },
                { "source", Host(source) }
            };
        }

        public static Dictionary<string, object> Download(string version, string tag, string asset,
            string sha256, string explicitUrl, Action<long, long> progress)
        {
            if (string.IsNullOrEmpty(asset)) asset = AssetName;
            return DownloadCore(version, tag, asset, sha256, explicitUrl,
                "YunLiTools-" + version + ".aip", false, progress);
        }

        public static Dictionary<string, object> DownloadHot(string version, string tag, string asset,
            string sha256, string explicitUrl, Action<long, long> progress)
        {
            if (string.IsNullOrEmpty(asset)) asset = "YunLiHot-" + version + ".zip";
            return DownloadCore(version, tag, asset, sha256, explicitUrl,
                "YunLiHot-" + version + ".zip", true, progress);
        }

        static Dictionary<string, object> DownloadCore(string version, string tag, string asset,
            string sha256, string explicitUrl, string localName, bool isHot, Action<long, long> progress)
        {
            if (!Safe(version)) throw new Exception("版本号无效。");
            if (!Safe(asset)) throw new Exception("文件名无效。");
            if (string.IsNullOrEmpty(tag) && string.IsNullOrEmpty(explicitUrl)) throw new Exception("缺少发布标记。");

            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "YunLi", "updates");
            Directory.CreateDirectory(dir);
            string file = Path.Combine(dir, localName);
            if (File.Exists(file) && (string.IsNullOrEmpty(sha256) || Hash(file) == sha256.ToLowerInvariant()))
                return Result(file, "", new FileInfo(file).Length, sha256 ?? "");

            string lastError = null;
            foreach (string url in AssetSources(tag, asset, explicitUrl, isHot))
            {
                string part = file + ".part";
                try { if (File.Exists(part)) File.Delete(part); }
                catch (Exception) { }
                try
                {
                    Http.File(url, part, isHot ? 180000 : 600000, progress);
                    string actual = Hash(part);
                    if (!string.IsNullOrEmpty(sha256) && actual != sha256.ToLowerInvariant())
                    {
                        lastError = "校验不一致：" + Host(url);
                        File.Delete(part);
                        continue;
                    }
                    if (File.Exists(file)) File.Delete(file);
                    File.Move(part, file);
                    return Result(file, url, new FileInfo(file).Length, actual);
                }
                catch (Exception ex)
                {
                    lastError = Host(url) + " " + ex.Message;
                    try { if (File.Exists(part)) File.Delete(part); } catch (Exception) { }
                }
            }
            throw new Exception("下载失败：所有更新源都不可用。" + Short(lastError));
        }

        // 轻量热更新安装:
        //   1. 解压 YunLiHot-<ver>.zip 到 %LOCALAPPDATA%\YunLi\hot\<ver>.staging\
        //   2. 复用基线 WebView2/ONNX 运行时 DLL 与 WASM OCR 模型目录(junction/复制)
        //   3. 原子切换 hot\current.txt 并备份 hot\previous.txt 供异常自动回滚
        public static Dictionary<string, object> InstallHot(string zipPath, string version, string currentAssetsDir)
        {
            if (string.IsNullOrEmpty(zipPath) || !File.Exists(zipPath))
                throw new Exception("热更新包不存在，请重新下载。");
            if (!Safe(version))
                throw new Exception("热更新版本号无效。");

            string yunliRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YunLi");
            string hotRoot = Path.Combine(yunliRoot, "hot");
            Directory.CreateDirectory(hotRoot);

            string targetDir = Path.Combine(hotRoot, version);
            string baseFull = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string targetFull = Path.GetFullPath(targetDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (string.Equals(baseFull, targetFull, StringComparison.OrdinalIgnoreCase))
                throw new Exception("当前已在运行 v" + version + "，无需重复热更新。");

            string staging = Path.Combine(hotRoot, version + ".staging-" + Guid.NewGuid().ToString("N").Substring(0, 8));
            Directory.CreateDirectory(staging);
            try
            {
                string fullStaging = Path.GetFullPath(staging) + Path.DirectorySeparatorChar;
                using (ZipArchive archive = new ZipArchive(File.OpenRead(zipPath), ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (entry.Name.Length == 0
                            || entry.FullName.EndsWith("/")
                            || entry.FullName.EndsWith("\\")) continue;
                        string dest = Path.GetFullPath(Path.Combine(staging, entry.FullName));
                        if (!dest.StartsWith(fullStaging, StringComparison.OrdinalIgnoreCase))
                            throw new Exception("热更新包路径无效。");
                        string d = Path.GetDirectoryName(dest);
                        if (!Directory.Exists(d)) Directory.CreateDirectory(d);
                        using (Stream s = entry.Open())
                        using (FileStream fs = File.Create(dest))
                            s.CopyTo(fs);
                    }
                }

                if (!File.Exists(Path.Combine(staging, "YunLiCore.exe")) ||
                    !File.Exists(Path.Combine(staging, "assets", "web", "index.html")))
                {
                    throw new Exception("热更新包缺少核心文件（YunLiCore.exe 或面板页面）。");
                }

                // 补齐运行时托管/原生 DLL（WebView2、ONNX Runtime 等），不覆盖热更包自带的新 DLL
                string baselineAssets = Path.Combine(yunliRoot, "assets");
                CopyMissingRuntimeDlls(AppDomain.CurrentDomain.BaseDirectory, staging);
                CopyMissingRuntimeDlls(baselineAssets, staging);

                // 复用基线的字体 WASM OCR 模型（~30MB），避免每个热更包重复下载
                string dstFontOcr = Path.Combine(staging, "assets", "web", "font", "ocr");
                if (!Directory.Exists(dstFontOcr))
                {
                    string srcFontOcr = null;
                    string cand1 = string.IsNullOrEmpty(currentAssetsDir) ? null
                        : Path.Combine(currentAssetsDir, "web", "font", "ocr");
                    string cand2 = Path.Combine(baselineAssets, "web", "font", "ocr");
                    if (!string.IsNullOrEmpty(cand1) && Directory.Exists(cand1)) srcFontOcr = cand1;
                    else if (Directory.Exists(cand2)) srcFontOcr = cand2;
                    if (!string.IsNullOrEmpty(srcFontOcr))
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(dstFontOcr));
                        LinkOrCopyDirectory(srcFontOcr, dstFontOcr);
                    }
                }

                if (Directory.Exists(targetDir)) SafeDeleteDir(targetDir);
                Directory.Move(staging, targetDir);
                staging = null;

                string currentFile = Path.Combine(hotRoot, "current.txt");
                string prevFile = Path.Combine(hotRoot, "previous.txt");
                string oldVer = "";
                if (File.Exists(currentFile))
                {
                    try { oldVer = File.ReadAllText(currentFile, Encoding.UTF8).Trim(); }
                    catch (Exception) { oldVer = ""; }
                }
                if (!string.IsNullOrEmpty(oldVer) && !string.Equals(oldVer, version, StringComparison.OrdinalIgnoreCase))
                {
                    WriteTextAtomic(prevFile, oldVer);
                }
                WriteTextAtomic(currentFile, version);

                PruneOldHotDirs(hotRoot, version, oldVer);

                return new Dictionary<string, object> {
                    { "version", version },
                    { "dir", targetDir },
                    { "reloading", true },
                    { "note", "热更新已就绪，正在重载面板（无需重启 Illustrator）。" }
                };
            }
            finally
            {
                if (!string.IsNullOrEmpty(staging) && Directory.Exists(staging))
                    SafeDeleteDir(staging);
            }
        }

        public static Dictionary<string, object> Install(string file, string aipPath, string hostExe, int parentPid)
        {
            if (string.IsNullOrEmpty(file) || !File.Exists(file))
                throw new Exception("更新包不存在，请重新下载。");
            if (string.IsNullOrEmpty(aipPath) || !File.Exists(aipPath))
                throw new Exception("无法定位已安装的 .aip，请手动用下载的文件替换。");
            if (string.IsNullOrEmpty(hostExe) || !File.Exists(hostExe))
                throw new Exception("无法定位 Illustrator，请手动替换后重新打开。");

            string dir = Path.GetDirectoryName(file);
            string script = Path.Combine(dir, "install-yunli.ps1");
            StringBuilder text = new StringBuilder();
            text.AppendLine("$ErrorActionPreference = 'SilentlyContinue'");
            text.AppendLine("$new = " + Ps(file));
            text.AppendLine("$old = " + Ps(aipPath));
            text.AppendLine("$app = " + Ps(hostExe));
            text.AppendLine("while (Get-Process -Id " + parentPid + " -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 700 }");
            text.AppendLine("Start-Sleep -Milliseconds 500");
            text.AppendLine("$copied = $false");
            text.AppendLine("for ($i = 0; $i -lt 40 -and -not $copied; $i++) {");
            text.AppendLine("  Copy-Item -LiteralPath $new -Destination $old -Force -ErrorAction SilentlyContinue");
            text.AppendLine("  if ($?) { $copied = $true } else { Start-Sleep -Milliseconds 500 }");
            text.AppendLine("}");
            text.AppendLine("if (-not $copied) {");
            text.AppendLine("  $cmd = 'Copy-Item -LiteralPath ''' + $new.Replace(\"'\", \"''\") + ''' -Destination ''' + $old.Replace(\"'\", \"''\") + ''' -Force'");
            text.AppendLine("  try { Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command',$cmd; $copied = $true } catch { }");
            text.AppendLine("}");
            text.AppendLine("if ($copied) { Start-Process -FilePath $app }");
            text.AppendLine("Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue");
            File.WriteAllText(script, text.ToString(), new UTF8Encoding(true));

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = "powershell.exe";
            info.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"";
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            Process.Start(info);

            return new Dictionary<string, object> {
                { "script", script },
                { "file", file },
                { "aip", aipPath },
                { "note", "退出 Illustrator 后会自动替换并重新打开。" }
            };
        }

        // ---- 热更新目录辅助 ----

        static void CopyMissingRuntimeDlls(string sourceDir, string targetDir)
        {
            if (string.IsNullOrEmpty(sourceDir) || !Directory.Exists(sourceDir)) return;
            foreach (string dll in Directory.GetFiles(sourceDir, "*.dll"))
            {
                string name = Path.GetFileName(dll);
                if (string.Equals(name, "YunLiNative.dll", StringComparison.OrdinalIgnoreCase)) continue;
                string dest = Path.Combine(targetDir, name);
                if (!File.Exists(dest))
                {
                    try { File.Copy(dll, dest, false); }
                    catch (Exception) { }
                }
            }
        }

        static void LinkOrCopyDirectory(string sourceDir, string destDir)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c mklink /J \"" + destDir + "\" \"" + sourceDir + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(5000);
                    if (p.ExitCode == 0 && Directory.Exists(destDir)) return;
                }
            }
            catch (Exception) { }
            CopyDirectoryRecursive(sourceDir, destDir);
        }

        static void CopyDirectoryRecursive(string src, string dst)
        {
            Directory.CreateDirectory(dst);
            foreach (string file in Directory.GetFiles(src))
                File.Copy(file, Path.Combine(dst, Path.GetFileName(file)), true);
            foreach (string sub in Directory.GetDirectories(src))
                CopyDirectoryRecursive(sub, Path.Combine(dst, Path.GetFileName(sub)));
        }

        static void WriteTextAtomic(string path, string content)
        {
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, content, new UTF8Encoding(false));
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        static void SafeDeleteDir(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) return;
                // 先卸载内部 junction，防止递归删除误触基线目录
                string ocrLink = Path.Combine(dir, "assets", "web", "font", "ocr");
                if (Directory.Exists(ocrLink))
                {
                    FileAttributes attr = File.GetAttributes(ocrLink);
                    if ((attr & FileAttributes.ReparsePoint) != 0)
                        Directory.Delete(ocrLink, false);
                }
                Directory.Delete(dir, true);
            }
            catch (Exception) { }
        }

        static void PruneOldHotDirs(string hotRoot, string keep1, string keep2)
        {
            try
            {
                string currentBase = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
                    .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                foreach (string sub in Directory.GetDirectories(hotRoot))
                {
                    string name = Path.GetFileName(sub);
                    if (string.Equals(name, keep1, StringComparison.OrdinalIgnoreCase)) continue;
                    if (!string.IsNullOrEmpty(keep2) && string.Equals(name, keep2, StringComparison.OrdinalIgnoreCase)) continue;
                    string full = Path.GetFullPath(sub).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    if (string.Equals(full, currentBase, StringComparison.OrdinalIgnoreCase)) continue;
                    SafeDeleteDir(sub);
                }
            }
            catch (Exception) { }
        }

        // ---- 更新源 ----

        static string[] ManifestSources()
        {
            string custom = Environment.GetEnvironmentVariable("YUNLI_UPDATE_MANIFEST");
            if (!string.IsNullOrEmpty(custom)) return new string[] { custom };
            string bust = "?t=" + ((long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds).ToString(CultureInfo.InvariantCulture);
            return new string[] {
                // 实时镜像优先并附带防缓存参数, 避免刚发版时命中边缘旧清单。
                "https://ghfast.top/" + RawBase + bust,
                "https://gh-proxy.com/" + RawBase + bust,
                RawBase + bust,
                CdnBase + bust,
                "https://ghproxy.net/" + RawBase + bust
            };
        }

        static string[] AssetSources(string tag, string asset, string explicitUrl, bool isHot)
        {
            if (isHot)
            {
                string customHot = Environment.GetEnvironmentVariable("YUNLI_UPDATE_HOT_ASSET");
                if (!string.IsNullOrEmpty(customHot)) return new string[] { customHot };
            }
            else
            {
                string custom = Environment.GetEnvironmentVariable("YUNLI_UPDATE_ASSET");
                if (!string.IsNullOrEmpty(custom)) return new string[] { custom };
            }
            if (!string.IsNullOrEmpty(explicitUrl)) return new string[] { explicitUrl };
            string gh = "https://github.com/" + Repo + "/releases/download/" + tag + "/" + asset;
            return new string[] {
                "https://gh-proxy.com/" + gh,
                "https://ghfast.top/" + gh,
                "https://ghproxy.net/" + gh,
                gh
            };
        }

        // ---- 工具 ----

        static Dictionary<string, object> Result(string file, string source, long bytes, string sha256)
        {
            return new Dictionary<string, object> {
                { "file", file },
                { "source", string.IsNullOrEmpty(source) ? "本地缓存" : Host(source) },
                { "bytes", bytes },
                { "sha256", sha256 ?? "" }
            };
        }

        static bool Safe(string value)
        {
            if (string.IsNullOrEmpty(value)) return false;
            foreach (char c in value)
            {
                bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                    || c == '.' || c == '-' || c == '_';
                if (!ok) return false;
            }
            return true;
        }

        static string Ps(string value)
        {
            return "'" + value.Replace("'", "''") + "'";
        }

        static int Compare(string left, string right)
        {
            string[] a = left.Split('.');
            string[] b = right.Split('.');
            int length = Math.Max(a.Length, b.Length);
            for (int i = 0; i < length; i++)
            {
                int x = i < a.Length ? Int(a[i]) : 0;
                int y = i < b.Length ? Int(b[i]) : 0;
                if (x != y) return x < y ? -1 : 1;
            }
            return 0;
        }

        static int Int(string value)
        {
            int result = 0;
            for (int i = 0; i < value.Length && value[i] >= '0' && value[i] <= '9'; i++)
                result = result * 10 + (value[i] - '0');
            return result;
        }

        static string Hash(string path)
        {
            using (SHA256 sha = SHA256.Create())
            using (FileStream stream = File.OpenRead(path))
                return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }

        static string Host(string url)
        {
            try { return new Uri(url).Host; } catch (Exception) { return url; }
        }

        static string Short(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            text = text.Trim();
            return text.Length <= 120 ? text : text.Substring(0, 120) + "…";
        }
    }

    // 更新检查需要 TLS 1.2;Framework 4.8 默认协议不一定包含它。
    static class Http
    {
        static Http()
        {
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                ServicePointManager.Expect100Continue = false;
            }
            catch (Exception) { }
        }

        public static string Text(string url, int timeout)
        {
            HttpWebRequest request = Request(url, timeout);
            using (WebResponse response = request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                return reader.ReadToEnd();
        }

        public static void File(string url, string path, int timeout, Action<long, long> progress)
        {
            HttpWebRequest request = Request(url, timeout);
            using (WebResponse response = request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (FileStream target = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                long total = response.ContentLength;
                byte[] buffer = new byte[81920];
                long received = 0;
                long reported = 0;
                while (true)
                {
                    int read = stream.Read(buffer, 0, buffer.Length);
                    if (read <= 0) break;
                    target.Write(buffer, 0, read);
                    received += read;
                    if (progress != null && (received - reported >= 131072 || received == total))
                    {
                        reported = received;
                        progress(received, total);
                    }
                }
                if (progress != null) progress(received, total > 0 ? total : received);
            }
        }

        static HttpWebRequest Request(string url, int timeout)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.UserAgent = "YunLi-Updater";
            request.Timeout = timeout;
            request.ReadWriteTimeout = timeout;
            request.AllowAutoRedirect = true;
            request.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
            return request;
        }
    }
}
