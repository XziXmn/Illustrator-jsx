using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace YunLi.Core
{
    // PDF 转曲：先丢掉 Illustrator 私有数据（预览层已是曲线/嵌图的文件），
    // 内容流里仍有活字且字形已嵌入时，再用随工具附带的 Ghostscript 按字形转成曲线。
    // 没有嵌入字形的活字直接失败，避免用本机替换字体转出错误轮廓。
    // 全程不经过 Illustrator，也不修改原文件。
    public static class PdfCurve
    {
        // 单次 JSON 请求的对象数。内容流 base64 后体积会膨胀，分块避免超过 Json 上限。
        private const int FetchChunk = 6;

        public static Dictionary<string, object> Convert(string input, string folder, string assets)
        {
            if (string.IsNullOrEmpty(input) || !File.Exists(input))
                throw new Exception("找不到文件。");
            input = Path.GetFullPath(input);
            string extension = Path.GetExtension(input).ToLowerInvariant();
            if (extension != ".pdf" && extension != ".ai")
                throw new Exception("只支持 PDF 和 PDF 兼容的 .ai 文件。");
            if (!HasPdfHeader(input))
                throw new Exception(extension == ".ai"
                    ? "这个 .ai 不是 PDF 兼容格式（文件里没有 PDF 层），无法按预览转曲。请在 Illustrator 里另存时勾选「创建 PDF 兼容文件」后再试。"
                    : "这个文件不是有效的 PDF。");
            folder = string.IsNullOrEmpty(folder)
                ? Path.GetDirectoryName(input)
                : Path.GetFullPath(folder);
            Directory.CreateDirectory(folder);
            string qpdf = FindQpdf(assets);
            if (qpdf == null)
                throw new Exception("未找到 qpdf。请重新构建工具，让 assets\\tools\\qpdf 与核心放在一起。");

            string output = UniqueOutput(folder,
                Path.GetFileNameWithoutExtension(input) + "-转曲" + (extension == ".ai" ? ".ai" : ".pdf"));
            string work = Path.Combine(Path.GetTempPath(), "yunli-pdf-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(work);
            try
            {
                bool stripped = false;
                string current = input;
                string strippedPath = Path.Combine(work, "stripped.pdf");
                if (StripPrivateData(qpdf, input, strippedPath, work))
                {
                    current = strippedPath;
                    stripped = true;
                }

                bool outlined = false;
                if (HasLiveText(qpdf, current))
                {
                    bool? embedded = HasEmbeddedFont(qpdf, current);
                    if (embedded == false)
                        throw new Exception("这份 PDF 的文字没有嵌入字形，预览里的字是本机字体替出来的，不能按预览转曲。");
                    if (embedded == null)
                        throw new Exception("无法确认这份 PDF 的字形是否嵌入，已停止转曲。");
                    string gs = FindGhostscript(assets);
                    if (gs == null)
                        throw new Exception("未找到随工具附带的 Ghostscript，不能把活字按预览转成曲线。");
                    string outlinedPath = Path.Combine(work, "outlined.pdf");
                    OutlineWithGhostscript(gs, current, outlinedPath);
                    if (HasLiveText(qpdf, outlinedPath))
                        throw new Exception("转曲后文件里仍有活字，已停止，未写出结果。");
                    File.Copy(outlinedPath, output, true);
                    outlined = true;
                }
                else
                {
                    File.Copy(current, output, true);
                }

                string note = stripped && outlined
                    ? "已去掉 Illustrator 私有数据，并按嵌入字形转曲。"
                    : stripped
                        ? "预览已是曲线或图片，已去掉 Illustrator 私有数据。"
                        : outlined
                            ? "已按嵌入字形转成曲线。"
                            : "没有私有数据，也没有活字，已原样复制。";
                if (extension == ".ai")
                    note += " AI 文件按 PDF 兼容层处理。";
                return new Dictionary<string, object> {
                    { "ok", true },
                    { "input", input },
                    { "output", output },
                    { "stripped", stripped },
                    { "outlined", outlined },
                    { "note", note }
                };
            }
            finally
            {
                try { Directory.Delete(work, true); } catch (Exception) { }
            }
        }

        // ---- 私有数据 ----

        // 只认结构：页面或目录字典里实际挂着 /PieceInfo，避免正文里出现同名字符串时误判。
        static bool StripPrivateData(string qpdf, string input, string output, string work)
        {
            List<int> ids = PageIds(qpdf, input);
            int catalog;
            if (CatalogId(qpdf, input, out catalog)) ids.Add(catalog);
            Dictionary<string, object> objects = FetchObjects(qpdf, input, ids);

            Dictionary<string, object> edits = new Dictionary<string, object>();
            foreach (KeyValuePair<string, object> pair in objects)
            {
                Dictionary<string, object> value = ObjectValue(pair.Value);
                if (value == null || !value.ContainsKey("/PieceInfo")) continue;
                value.Remove("/PieceInfo");
                edits[pair.Key] = new Dictionary<string, object> { { "value", value } };
            }
            if (edits.Count == 0) return false;

            string editPath = Path.Combine(work, "edit.json");
            var update = new Dictionary<string, object> {
                { "qpdf", new object[] {
                    new Dictionary<string, object> { { "jsonversion", 2 } },
                    edits
                } }
            };
            File.WriteAllText(editPath, Json.Encode(update), new UTF8Encoding(false));
            Qpdf(qpdf, "--update-from-json=\"" + editPath + "\" \"" + input + "\" \"" + output + "\"");
            if (!File.Exists(output))
                throw new Exception("qpdf 没有写出文件。");
            if (HasPrivateData(qpdf, output))
                throw new Exception("Illustrator 私有数据没有去干净，已停止。");
            return true;
        }

        // .ai 只有在保存时勾选「创建 PDF 兼容文件」才带 PDF 层,否则 qpdf 无从处理。
        static bool HasPdfHeader(string path)
        {
            using (FileStream stream = File.OpenRead(path))
            {
                byte[] buffer = new byte[1024];
                int read = stream.Read(buffer, 0, buffer.Length);
                byte[] marker = Encoding.ASCII.GetBytes("%PDF");
                for (int i = 0; i + marker.Length <= read; i++)
                {
                    int k = 0;
                    while (k < marker.Length && buffer[i + k] == marker[k]) k++;
                    if (k == marker.Length) return true;
                }
                return false;
            }
        }

        static bool HasPrivateData(string qpdf, string path)
        {
            List<int> ids = PageIds(qpdf, path);
            int catalog;
            if (CatalogId(qpdf, path, out catalog)) ids.Add(catalog);
            foreach (KeyValuePair<string, object> pair in FetchObjects(qpdf, path, ids))
            {
                Dictionary<string, object> value = ObjectValue(pair.Value);
                if (value != null && value.ContainsKey("/PieceInfo")) return true;
            }
            return false;
        }

        static bool CatalogId(string qpdf, string path, out int id)
        {
            id = 0;
            Dictionary<string, object> doc = Json.Object(Qpdf(qpdf,
                "--json --json-key=qpdf --json-object=trailer \"" + path + "\""));
            object listObj;
            if (!doc.TryGetValue("qpdf", out listObj)) return false;
            Dictionary<string, object> objects = ObjectMap(listObj);
            object trailerObj;
            if (objects == null || !objects.TryGetValue("trailer", out trailerObj)) return false;
            Dictionary<string, object> trailer = ObjectValue(trailerObj);
            object root;
            return trailer != null
                && trailer.TryGetValue("/Root", out root)
                && ObjectId(root as string, out id);
        }

        // ---- 活字与字形 ----

        static bool HasLiveText(string qpdf, string path)
        {
            List<int> contentIds = new List<int>();
            foreach (Dictionary<string, object> page in Pages(qpdf, path))
            {
                object contents;
                if (!page.TryGetValue("contents", out contents) || !(contents is IEnumerable)) continue;
                foreach (object item in (IEnumerable)contents)
                {
                    int id;
                    if (ObjectId(item as string, out id) && !contentIds.Contains(id)) contentIds.Add(id);
                }
            }

            for (int start = 0; start < contentIds.Count; start += FetchChunk)
            {
                List<int> chunk = contentIds.GetRange(start, Math.Min(FetchChunk, contentIds.Count - start));
                Dictionary<string, object> streams = null;
                try { streams = FetchObjects(qpdf, path, chunk); }
                catch (Exception) { streams = null; }
                if (streams != null)
                {
                    foreach (KeyValuePair<string, object> pair in streams)
                    {
                        byte[] data = StreamBytes(pair.Value);
                        if (data != null && HasTextOperators(data)) return true;
                    }
                    continue;
                }
                // JSON 取不动(流太大)时退回逐流扫描。
                foreach (int id in chunk)
                {
                    string text = Qpdf(qpdf, "--show-object=" + id + " --filtered-stream-data \"" + path + "\"");
                    if (HasTextOperators(Encoding.UTF8.GetBytes(text))) return true;
                }
            }
            return false;
        }

        // 返回 null 表示结构无法确认；确认没有嵌入字形时返回 false。
        static bool? HasEmbeddedFont(string qpdf, string path)
        {
            List<object> resourceValues = new List<object>();
            foreach (KeyValuePair<string, object> pair in FetchObjects(qpdf, path, PageIds(qpdf, path)))
            {
                Dictionary<string, object> page = ObjectValue(pair.Value);
                object resourceValue;
                if (page != null && page.TryGetValue("/Resources", out resourceValue)) resourceValues.Add(resourceValue);
            }
            List<Dictionary<string, object>> resources = ResolveDicts(qpdf, path, resourceValues);
            if (resources == null) return null;

            List<object> fontDictValues = new List<object>();
            foreach (Dictionary<string, object> resource in resources)
            {
                object fontValue;
                if (resource.TryGetValue("/Font", out fontValue)) fontDictValues.Add(fontValue);
            }
            List<Dictionary<string, object>> fontDicts = ResolveDicts(qpdf, path, fontDictValues);
            if (fontDicts == null) return null;

            List<object> fontRefs = new List<object>();
            foreach (Dictionary<string, object> fontDict in fontDicts)
                foreach (KeyValuePair<string, object> font in fontDict) fontRefs.Add(font.Value);
            List<Dictionary<string, object>> fonts = ResolveDicts(qpdf, path, fontRefs);
            if (fonts == null) return null;

            List<object> descriptorValues = new List<object>();
            List<object> descendantValues = new List<object>();
            foreach (Dictionary<string, object> font in fonts)
            {
                object descriptor;
                if (font.TryGetValue("/FontDescriptor", out descriptor)) descriptorValues.Add(descriptor);
                object descendants;
                if (font.TryGetValue("/DescendantFonts", out descendants) && descendants is IEnumerable)
                    foreach (object item in (IEnumerable)descendants) descendantValues.Add(item);
            }
            if (descendantValues.Count > 0)
            {
                List<Dictionary<string, object>> descendants = ResolveDicts(qpdf, path, descendantValues);
                if (descendants == null) return null;
                foreach (Dictionary<string, object> descendant in descendants)
                {
                    object descriptor;
                    if (descendant.TryGetValue("/FontDescriptor", out descriptor)) descriptorValues.Add(descriptor);
                }
            }

            List<Dictionary<string, object>> descriptors = ResolveDicts(qpdf, path, descriptorValues);
            if (descriptors == null) return null;
            foreach (Dictionary<string, object> descriptor in descriptors)
                foreach (KeyValuePair<string, object> entry in descriptor)
                    if (entry.Key.StartsWith("/FontFile", StringComparison.Ordinal)) return true;
            return false;
        }

        // 文本操作符扫描：跳过注释、字面字符串、十六进制字符串和内联图像。
        static bool HasTextOperators(byte[] data)
        {
            int i = 0, n = data.Length;
            while (i < n)
            {
                byte c = data[i];
                if (c == (byte)'%')
                {
                    while (i < n && data[i] != 10 && data[i] != 13) i++;
                    continue;
                }
                if (c == (byte)'(')
                {
                    i = SkipLiteral(data, i);
                    continue;
                }
                if (c == (byte)'<')
                {
                    if (i + 1 < n && data[i + 1] == (byte)'<') { i += 2; continue; }
                    i++;
                    while (i < n && data[i] != (byte)'>') i++;
                    if (i < n) i++;
                    continue;
                }
                if (c == (byte)'>')
                {
                    i += (i + 1 < n && data[i + 1] == (byte)'>') ? 2 : 1;
                    continue;
                }
                if (IsSpace(c) || IsDelimiter(c)) { i++; continue; }
                int start = i;
                while (i < n && !IsSpace(data[i]) && !IsDelimiter(data[i])) i++;
                int length = i - start;
                if (IsToken(data, start, length, "Tf") || IsToken(data, start, length, "Tj")
                    || IsToken(data, start, length, "TJ") || IsToken(data, start, length, "BT")
                    || (length == 1 && (data[start] == (byte)'\'' || data[start] == (byte)'"')))
                    return true;
                if (IsToken(data, start, length, "BI"))
                {
                    int end = FindToken(data, i, "EI");
                    if (end < 0) return false;
                    i = end + 2;
                }
            }
            return false;
        }

        static int SkipLiteral(byte[] data, int i)
        {
            int depth = 0, n = data.Length;
            while (i < n)
            {
                byte c = data[i];
                if (c == (byte)'\\') { i += 2; continue; }
                if (c == (byte)'(') { depth++; i++; continue; }
                if (c == (byte)')')
                {
                    depth--;
                    i++;
                    if (depth == 0) return i;
                    continue;
                }
                i++;
            }
            return n;
        }

        static int FindToken(byte[] data, int from, string token)
        {
            byte[] needle = Encoding.ASCII.GetBytes(token);
            for (int i = from; i + needle.Length <= data.Length; i++)
            {
                bool before = i == 0 || IsSpace(data[i - 1]) || IsDelimiter(data[i - 1]);
                if (!before) continue;
                int k = 0;
                while (k < needle.Length && data[i + k] == needle[k]) k++;
                if (k != needle.Length) continue;
                int after = i + needle.Length;
                if (after == data.Length || IsSpace(data[after]) || IsDelimiter(data[after])) return i;
            }
            return -1;
        }

        static bool IsToken(byte[] data, int start, int length, string token)
        {
            if (length != token.Length) return false;
            for (int i = 0; i < length; i++)
                if (data[start + i] != (byte)token[i]) return false;
            return true;
        }

        static bool IsSpace(byte c)
        {
            return c == 0 || c == 9 || c == 10 || c == 12 || c == 13 || c == 32;
        }

        static bool IsDelimiter(byte c)
        {
            return c == (byte)'(' || c == (byte)')' || c == (byte)'<' || c == (byte)'>'
                || c == (byte)'[' || c == (byte)']' || c == (byte)'{' || c == (byte)'}'
                || c == (byte)'/' || c == (byte)'%';
        }

        // ---- qpdf 结构读取 ----

        static List<Dictionary<string, object>> Pages(string qpdf, string path)
        {
            List<Dictionary<string, object>> pages = new List<Dictionary<string, object>>();
            Dictionary<string, object> doc = Json.Object(Qpdf(qpdf, "--json --json-key=pages \"" + path + "\""));
            object pagesObj;
            if (!doc.TryGetValue("pages", out pagesObj) || !(pagesObj is IEnumerable)) return pages;
            foreach (object item in (IEnumerable)pagesObj)
            {
                Dictionary<string, object> page = item as Dictionary<string, object>;
                if (page != null) pages.Add(page);
            }
            return pages;
        }

        static List<int> PageIds(string qpdf, string path)
        {
            List<int> ids = new List<int>();
            foreach (Dictionary<string, object> page in Pages(qpdf, path))
            {
                object reference;
                int id;
                if (page.TryGetValue("object", out reference) && ObjectId(reference as string, out id) && !ids.Contains(id))
                    ids.Add(id);
            }
            return ids;
        }

        static Dictionary<string, object> FetchObjects(string qpdf, string path, List<int> ids)
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            if (ids.Count == 0) return result;
            StringBuilder args = new StringBuilder("--json --json-key=qpdf --json-stream-data=inline");
            foreach (int id in ids) args.Append(" --json-object=").Append(id).Append(",0");
            args.Append(" \"").Append(path).Append('"');
            Dictionary<string, object> doc = Json.Object(Qpdf(qpdf, args.ToString()));
            object listObj;
            if (!doc.TryGetValue("qpdf", out listObj)) return result;
            Dictionary<string, object> objects = ObjectMap(listObj);
            return objects ?? result;
        }

        // 把字典或引用值统一解析成字典；任一值无法解析时返回 null。
        static List<Dictionary<string, object>> ResolveDicts(string qpdf, string path, List<object> values)
        {
            if (values.Count == 0) return new List<Dictionary<string, object>>();
            List<Dictionary<string, object>> dicts = new List<Dictionary<string, object>>();
            List<int> refIds = new List<int>();
            foreach (object value in values)
            {
                Dictionary<string, object> dict = value as Dictionary<string, object>;
                if (dict != null) { dicts.Add(dict); continue; }
                int id;
                if (!ObjectId(value as string, out id)) return null;
                refIds.Add(id);
            }
            if (refIds.Count == 0) return dicts;
            Dictionary<string, object> fetched = FetchObjects(qpdf, path, refIds);
            foreach (int id in refIds)
            {
                Dictionary<string, object> dict = null;
                foreach (KeyValuePair<string, object> pair in fetched)
                {
                    int fetchedId;
                    if (ObjectId(pair.Key.StartsWith("obj:", StringComparison.Ordinal) ? pair.Key.Substring(4) : pair.Key, out fetchedId)
                        && fetchedId == id)
                    {
                        dict = ObjectValue(pair.Value);
                        break;
                    }
                }
                if (dict == null) return null;
                dicts.Add(dict);
            }
            return dicts;
        }

        // ---- 进程 ----

        static void OutlineWithGhostscript(string gs, string input, string output)
        {
            string args = "-q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=pdfwrite -dNoOutputFonts"
                + " -dCompatibilityLevel=1.6 -sOutputFile=\"" + output + "\" \"" + input + "\"";
            string bin = Path.GetDirectoryName(gs);
            string root = Directory.GetParent(bin).FullName;
            List<string> libs = new List<string>();
            foreach (string name in new string[] { Path.Combine("Resource", "Init"), "lib", "iccprofiles" })
            {
                string dir = Path.Combine(root, name);
                if (Directory.Exists(dir)) libs.Add(dir);
            }
            string error = Run(gs, args, bin, libs.Count == 0 ? null : string.Join(";", libs.ToArray()));
            if (!File.Exists(output) || new FileInfo(output).Length == 0)
                throw new Exception("Ghostscript 没有写出转曲 PDF。" + Tail(error));
        }

        static string Qpdf(string qpdf, string args)
        {
            return Run(qpdf, args, Path.GetDirectoryName(qpdf), null);
        }

        // 返回标准输出；进程失败时抛出带尾部错误信息的异常。
        // 两路输出并发读取，避免一路缓冲区写满、另一路还在等待造成死锁。
        static string Run(string exe, string args, string workDir, string gsLib)
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = exe;
            info.Arguments = args;
            info.WorkingDirectory = string.IsNullOrEmpty(workDir) ? Environment.CurrentDirectory : workDir;
            info.UseShellExecute = false;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.CreateNoWindow = true;
            info.StandardOutputEncoding = Encoding.UTF8;
            info.StandardErrorEncoding = Encoding.UTF8;
            if (!string.IsNullOrEmpty(gsLib)) info.EnvironmentVariables["GS_LIB"] = gsLib;
            using (Process process = Process.Start(info))
            {
                System.Threading.Tasks.Task<string> stdout = process.StandardOutput.ReadToEndAsync();
                System.Threading.Tasks.Task<string> stderr = process.StandardError.ReadToEndAsync();
                process.WaitForExit();
                string outText = stdout.Result;
                string errText = stderr.Result;
                if (process.ExitCode != 0)
                    throw new Exception(Path.GetFileName(exe) + " 失败：" + Tail(errText.Length > 0 ? errText : outText));
                return outText.Length > 0 ? outText : errText;
            }
        }

        static string BaselineAssets()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "YunLi", "assets");
        }

        static string FindQpdf(string assets)
        {
            string bundled = Path.Combine(assets ?? "", "tools", "qpdf", "qpdf.exe");
            if (File.Exists(bundled)) return bundled;
            string baseline = Path.Combine(BaselineAssets(), "tools", "qpdf", "qpdf.exe");
            return File.Exists(baseline) ? baseline : null;
        }

        static string FindGhostscript(string assets)
        {
            string env = Environment.GetEnvironmentVariable("YUNLI_GS");
            if (!string.IsNullOrEmpty(env) && File.Exists(env)) return env;
            string bundled = Path.Combine(assets ?? "", "tools", "gs", "bin", "gswin64c.exe");
            if (File.Exists(bundled)) return bundled;
            string baseline = Path.Combine(BaselineAssets(), "tools", "gs", "bin", "gswin64c.exe");
            if (File.Exists(baseline)) return baseline;
            string gsRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "gs");
            if (Directory.Exists(gsRoot))
            {
                string[] bins = Directory.GetFiles(gsRoot, "gswin64c.exe", SearchOption.AllDirectories);
                if (bins.Length > 0) return bins[bins.Length - 1];
            }
            return null;
        }

        // ---- 杂项 ----

        static byte[] StreamBytes(object wrapper)
        {
            Dictionary<string, object> map = wrapper as Dictionary<string, object>;
            object streamObj;
            if (map == null || !map.TryGetValue("stream", out streamObj)) return null;
            Dictionary<string, object> stream = streamObj as Dictionary<string, object>;
            object dataObj;
            if (stream == null || !stream.TryGetValue("data", out dataObj)) return null;
            string data = dataObj as string;
            if (data == null) return null;
            try { return System.Convert.FromBase64String(data); }
            catch (FormatException) { return Encoding.UTF8.GetBytes(data); }
        }

        static Dictionary<string, object> ObjectValue(object wrapper)
        {
            Dictionary<string, object> map = wrapper as Dictionary<string, object>;
            object value;
            if (map == null || !map.TryGetValue("value", out value)) return null;
            return value as Dictionary<string, object>;
        }

        static Dictionary<string, object> ObjectMap(object listObj)
        {
            object[] items = ToArray(listObj);
            if (items.Length < 2) return null;
            return items[1] as Dictionary<string, object>;
        }

        static object[] ToArray(object value)
        {
            if (value is object[]) return (object[])value;
            List<object> list = new List<object>();
            IEnumerable enumerable = value as IEnumerable;
            if (enumerable == null || value is string) return list.ToArray();
            foreach (object item in enumerable) list.Add(item);
            return list.ToArray();
        }

        static bool ObjectId(string reference, out int id)
        {
            id = 0;
            if (string.IsNullOrEmpty(reference)) return false;
            string[] parts = reference.Split(' ');
            return parts.Length >= 1 && int.TryParse(parts[0], out id);
        }

        static string UniqueOutput(string folder, string name)
        {
            string path = Path.Combine(folder, name);
            if (!File.Exists(path)) return path;
            string stem = Path.GetFileNameWithoutExtension(name);
            for (int i = 2; i < 100; i++)
            {
                path = Path.Combine(folder, stem + "-" + i + ".pdf");
                if (!File.Exists(path)) return path;
            }
            throw new Exception("输出文件名已用尽。");
        }

        static string Tail(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            text = text.Trim();
            return text.Length <= 400 ? text : text.Substring(text.Length - 400);
        }
    }
}
