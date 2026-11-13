// =========================================================================
// 识别兜底档:Qwen2.5-VL-3B(llama.cpp Vulkan 子进程,OpenAI 兼容接口)。
// 只接 server 模型低置信的行;结果置信压到 0.88,强制人工校对,交给字形匹配复核。
// 目录约定:
//   llama-server.exe   %LOCALAPPDATA%\YunLi\bin\
//   模型               %LOCALAPPDATA%\YunLi\models\qwen2.5-vl-3b\
// =========================================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace ZiXing
{
	public static class AiEngine
	{
		private const int Port = 8731;
		private const int GpuMinMib = 6000;   // Q4 3B + f16 mmproj 至少 6GB 显存
		private const int SlowThresholdMs = 25000;
		private static readonly object Gate = new object();
		private static Process server;
		private static bool probeDone;
		private static bool probeOk;
		private static bool disabledThisSession;
		private static readonly JavaScriptSerializer JsonSer = new JavaScriptSerializer { MaxJsonLength = 33554432 };

		private static string BinDir
		{
			get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YunLi", "bin"); }
		}

		private static string ModelDir
		{
			get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YunLi", "models", "qwen2.5-vl-3b"); }
		}

		// 文件 + NVIDIA GPU(>=6GB)都在才算可用;实际速度在首次调用时再验
		public static bool Probe()
		{
			lock (Gate)
			{
				if (probeDone) return probeOk && !disabledThisSession;
				probeDone = true;
				try
				{
					string exe = Path.Combine(BinDir, "llama-server.exe");
					string model = Path.Combine(ModelDir, "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf");
					string mmproj = Path.Combine(ModelDir, "mmproj-f16.gguf");
					probeOk = File.Exists(exe) && File.Exists(model) && File.Exists(mmproj) && GpuOk();
					if (!probeOk) YunLi.Core.Program.Log("ai-probe off: exe=" + File.Exists(exe) + " model=" + File.Exists(model) + " gpu=" + GpuNameMib().Item1);
				}
				catch (Exception ex)
				{
					probeOk = false;
					YunLi.Core.Program.Log("ai-probe error " + ex.Message);
				}
				return probeOk && !disabledThisSession;
			}
		}

		private static Tuple<string, long> GpuNameMib()
		{
			try
			{
				ProcessStartInfo start = new ProcessStartInfo
				{
					FileName = "nvidia-smi",
					Arguments = "--query-gpu=name,memory.total --format=csv,noheader,nounits",
					UseShellExecute = false,
					RedirectStandardOutput = true,
					CreateNoWindow = true
				};
				using (Process p = Process.Start(start))
				{
					string outText = p.StandardOutput.ReadToEnd();
					p.WaitForExit(4000);
					string[] fields = outText.Split(',');
					long mib;
					if (fields.Length >= 2 && long.TryParse(fields[1].Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out mib))
						return Tuple.Create(fields[0].Trim(), mib);
				}
			}
			catch (Exception) { }
			return Tuple.Create("", 0L);
		}

		private static bool GpuOk()
		{
			return GpuNameMib().Item2 >= GpuMinMib;
		}

		// 确认 llama-server 在跑;没有就拉起并等 /health
		private static bool EnsureServer()
		{
			lock (Gate)
			{
				if (server != null && !server.HasExited) return HealthOk();
				if (HealthOk()) return true;   // 别的实例已在跑,直接复用
				try
				{
					ProcessStartInfo start = new ProcessStartInfo
					{
						FileName = Path.Combine(BinDir, "llama-server.exe"),
						Arguments = "-m \"" + Path.Combine(ModelDir, "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf") +
							"\" --mmproj \"" + Path.Combine(ModelDir, "mmproj-f16.gguf") +
							"\" --host 127.0.0.1 --port " + Port.ToString(CultureInfo.InvariantCulture) +
							" -ngl 999 -c 4096 --no-webui",
						UseShellExecute = false,
						CreateNoWindow = true,
						WindowStyle = ProcessWindowStyle.Hidden
					};
					server = Process.Start(start);
				}
				catch (Exception ex)
				{
					YunLi.Core.Program.Log("ai-server start failed " + ex.Message);
					return false;
				}
				for (int i = 0; i < 120; i++)
				{
					Thread.Sleep(1000);
					if (server.HasExited) { YunLi.Core.Program.Log("ai-server exited early"); return false; }
					if (HealthOk()) { YunLi.Core.Program.Log("ai-server ready"); return true; }
				}
				YunLi.Core.Program.Log("ai-server health timeout");
				return false;
			}
		}

		private static bool HealthOk()
		{
			try
			{
				HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + Port.ToString(CultureInfo.InvariantCulture) + "/health");
				req.Timeout = 1500;
				req.Method = "GET";
				using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
				{
					return (int)resp.StatusCode == 200;
				}
			}
			catch (WebException)
			{
				return false;
			}
			catch (Exception)
			{
				return false;
			}
		}

		public static void Shutdown()
		{
			lock (Gate)
			{
				try
				{
					if (server != null && !server.HasExited) server.Kill();
				}
				catch (Exception) { }
				server = null;
			}
		}

		// 行裁片 → 文字。AI 只兜底,不设置信;调用方决定怎么用。
		public static string RecognizeCrop(Bitmap bitmap, Rectangle crop, out long elapsedMs)
		{
			elapsedMs = -1;
			if (!EnsureServer()) return null;
			Stopwatch watch = Stopwatch.StartNew();
			string text = Chat(EncodeCrop(bitmap, crop));
			watch.Stop();
			elapsedMs = watch.ElapsedMilliseconds;
			if (elapsedMs > SlowThresholdMs)
			{
				disabledThisSession = true;
				YunLi.Core.Program.Log("ai disabled this session: " + elapsedMs + "ms");
			}
			return text;
		}

		private static string EncodeCrop(Bitmap bitmap, Rectangle crop)
		{
			crop.X = Math.Max(0, crop.X - 2);
			crop.Y = Math.Max(0, crop.Y - 2);
			crop.Width = Math.Min(bitmap.Width - crop.X, crop.Width + 4);
			crop.Height = Math.Min(bitmap.Height - crop.Y, crop.Height + 4);
			if (crop.Width < 8 || crop.Height < 8) return null;
			using (Bitmap piece = bitmap.Clone(crop, PixelFormat.Format32bppArgb))
			using (MemoryStream ms = new MemoryStream())
			{
				piece.Save(ms, ImageFormat.Png);
				return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
			}
		}

		private static string Chat(string dataUri)
		{
			if (dataUri == null) return null;
			StringBuilder body = new StringBuilder();
			body.Append("{\"messages\":[{\"role\":\"user\",\"content\":[");
			body.Append("{\"type\":\"image_url\",\"image_url\":{\"url\":");
			body.Append(JsonSer.Serialize(dataUri));
			body.Append("}},{\"type\":\"text\",\"text\":");
			body.Append(JsonSer.Serialize("识别这张图片里的所有文字，按原样输出文字本身，不要解释，不要漏字或改字。"));
			body.Append("}}],\"temperature\":0,\"max_tokens\":300}");
			HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + Port.ToString(CultureInfo.InvariantCulture) + "/v1/chat/completions");
			req.Timeout = 120000;
			req.ReadWriteTimeout = 120000;
			req.Method = "POST";
			req.ContentType = "application/json";
			byte[] payload = Encoding.UTF8.GetBytes(body.ToString());
			req.ContentLength = payload.Length;
			using (Stream s = req.GetRequestStream()) s.Write(payload, 0, payload.Length);
			using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
			using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
			{
				Dictionary<string, object> root = JsonSer.DeserializeObject(reader.ReadToEnd()) as Dictionary<string, object>;
				if (root == null) return null;
				object choicesObj;
				if (!root.TryGetValue("choices", out choicesObj)) return null;
				object[] choices = choicesObj as object[];
				if (choices == null || choices.Length == 0) return null;
				Dictionary<string, object> choice = choices[0] as Dictionary<string, object>;
				if (choice == null) return null;
				object messageObj;
				if (!choice.TryGetValue("message", out messageObj)) return null;
				Dictionary<string, object> message = messageObj as Dictionary<string, object>;
				if (message == null) return null;
				object contentObj;
				if (!message.TryGetValue("content", out contentObj)) return null;
				string content = contentObj as string;
				if (content == null)
				{
					object[] parts = contentObj as object[];
					if (parts == null) return null;
					StringBuilder joined = new StringBuilder();
					foreach (object part in parts)
					{
						Dictionary<string, object> piece = part as Dictionary<string, object>;
						if (piece == null) continue;
						object textObj;
						if (piece.TryGetValue("text", out textObj) && textObj is string) joined.Append((string)textObj);
					}
					content = joined.ToString();
				}
				return content.Trim();
			}
		}
	}
}
