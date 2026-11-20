using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace ZiXing
{
    // 在线更新：从仓库版本清单读取最新版本，按国内镜像优先的顺序下载发布包，
    // 校验 SHA-256 后交给后台脚本，在 Illustrator 退出后替换 .aip 并重新打开。
    public static class Update
    {
        private const string Repo = "XziXmn/Illustrator-jsx";
        private const string AssetName = "YunLiTools.aip";
        private const string RawBase = "https://raw.githubusercontent.com/" + Repo + "/main/update.json";
        private const string CdnBase = "https://cdn.jsdelivr.net/gh/" + Repo + "@main/update.json";

        public static Dictionary<string, object> Check(string current)
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

            return new Dictionary<string, object> {
                { "currentVersion", current },
                { "latestVersion", latest },
                { "newer", Compare(latest, current) > 0 },
                { "tag", tag },
                { "asset", asset },
                { "sha256", Json.String(manifest, "sha256") ?? "" },
                { "url", Json.String(manifest, "url") ?? "" },
                { "notes", Json.String(manifest, "notes") ?? "" },
                { "published", Json.String(manifest, "published") ?? "" },
                { "source", Host(source) }
            };
        }

        public static Dictionary<string, object> Download(string version, string tag, string asset,
            string sha256, string explicitUrl, Action<long, long> progress)
        {
            if (!Safe(version)) throw new Exception("版本号无效。");
            if (string.IsNullOrEmpty(asset)) asset = AssetName;
            if (!Safe(asset)) throw new Exception("文件名无效。");
            if (string.IsNullOrEmpty(tag) && string.IsNullOrEmpty(explicitUrl)) throw new Exception("缺少发布标记。");

            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "YunLi", "updates");
            Directory.CreateDirectory(dir);
            string file = Path.Combine(dir, "YunLiTools-" + version + ".aip");
            if (File.Exists(file) && (string.IsNullOrEmpty(sha256) || Hash(file) == sha256.ToLowerInvariant()))
                return Result(file, "", new FileInfo(file).Length, sha256 ?? "");

            string lastError = null;
            foreach (string url in AssetSources(tag, asset, explicitUrl))
            {
                string part = file + ".part";
                try { if (File.Exists(part)) File.Delete(part); }
                catch (Exception) { }
                try
                {
                    Http.File(url, part, 600000, progress);
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

            System.Diagnostics.ProcessStartInfo info = new System.Diagnostics.ProcessStartInfo();
            info.FileName = "powershell.exe";
            info.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"";
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            System.Diagnostics.Process.Start(info);

            return new Dictionary<string, object> {
                { "script", script },
                { "file", file },
                { "aip", aipPath },
                { "note", "退出 Illustrator 后会自动替换并重新打开。" }
            };
        }

        // ---- 更新源 ----

        static string[] ManifestSources()
        {
            string custom = Environment.GetEnvironmentVariable("YUNLI_UPDATE_MANIFEST");
            if (!string.IsNullOrEmpty(custom)) return new string[] { custom };
            return new string[] {
                // 镜像优先;jsDelivr 会缓存分支内容,放后面避免读到旧清单。
                "https://gh-proxy.com/" + RawBase,
                "https://ghfast.top/" + RawBase,
                "https://ghproxy.net/" + RawBase,
                CdnBase,
                RawBase
            };
        }

        static string[] AssetSources(string tag, string asset, string explicitUrl)
        {
            string custom = Environment.GetEnvironmentVariable("YUNLI_UPDATE_ASSET");
            if (!string.IsNullOrEmpty(custom)) return new string[] { custom };
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
                    if (progress != null && (received - reported >= 262144 || received == total))
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
