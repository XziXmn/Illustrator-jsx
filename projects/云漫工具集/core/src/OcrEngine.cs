// =========================================================================
// 本地 CPU 识别档:PP-OCRv5 server(det DBNet + rec SVTR-CTC),ONNX Runtime。
// 作为识别档位 1;页面里 wasm 的 PP-OCRv5 mobile 与 Tesseract 依次降档。
// 模型: assets\ocr\server\det.onnx / rec.onnx / dict.txt
// 依赖: exe 旁 onnxruntime.dll + Microsoft.ML.OnnxRuntime.dll + System.Memory 等
// =========================================================================
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace ZiXing
{
	public static class OcrEngine
	{
		private static readonly object Gate = new object();
		private static InferenceSession detSession;
		private static InferenceSession recSession;
		private static string[] dict;
		private static string engineDir;

		// det 预处理:最长边收进 DetLimit(RGB + ImageNet 均值方差)
		private static readonly float[] DetMean = new float[] { 0.485f, 0.456f, 0.406f };
		private static readonly float[] DetStd = new float[] { 0.229f, 0.224f, 0.225f };
		private const int DetLimit = 960;
		private const float DetThreshold = 0.3f;
		private const float UnclipRatio = 1.6f;
		private const int RecHeight = 48;

		public static bool Available(string assets)
		{
			try
			{
				string dir = Path.Combine(assets, "ocr", "server");
				if (!File.Exists(Path.Combine(dir, "det.onnx")) ||
					!File.Exists(Path.Combine(dir, "rec.onnx")) ||
					!File.Exists(Path.Combine(dir, "dict.txt"))) return false;
				return File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "onnxruntime.dll"));
			}
			catch (IOException) { return false; }
			catch (UnauthorizedAccessException) { return false; }
		}

		private static void EnsureEngine(string assets)
		{
			lock (Gate)
			{
				if (detSession != null) return;
				string dir = Path.Combine(assets, "ocr", "server");
				detSession = new InferenceSession(Path.Combine(dir, "det.onnx"));
				recSession = new InferenceSession(Path.Combine(dir, "rec.onnx"));
				List<string> tokens = new List<string>();
				using (StreamReader reader = new StreamReader(Path.Combine(dir, "dict.txt"), Encoding.UTF8))
				{
					string line;
					while ((line = reader.ReadLine()) != null)
					{
						if (line.Length > 0) tokens.Add(line);
					}
				}
				tokens.Insert(0, "");   // CTC blank = 类目 0
				tokens.Add(" ");        // use_space_char
				dict = tokens.ToArray();
				engineDir = dir;
			}
		}

		// 返回面板契约的最终行集(JS 拿到后不再走 wasm 后处理)。
		// 性能要点:整图只解码一次(此前每行识别/每张预览都重读大 PNG,9 行吃掉近十秒);
		// 切片顺序执行,逐行识别并行(ORT 会话线程安全)。
		public static object Recognize(string imagePath, string assets, string language, bool vertical)
		{
			EnsureEngine(assets);
			if (vertical) return VerticalRecognize(imagePath);
			int width;
			int height;
			byte[] gray;
			List<Box> boxes;
			List<Bitmap> crops = new List<Bitmap>();
			List<Bitmap> thumbs = new List<Bitmap>();
			string[] texts;
			double[] confs;
			List<int[]>[] charMaps;
			using (Bitmap source = new Bitmap(imagePath))
			{
				width = source.Width;
				height = source.Height;
				gray = ToGray(source);
				boxes = Detect(source);
				foreach (Box box in boxes)
				{
					crops.Add(source.Clone(new Rectangle(box.X0, box.Y0, box.X1 - box.X0, box.Y1 - box.Y0), PixelFormat.Format32bppArgb));
					thumbs.Add(Thumb(source, box));
				}
			}
			int count = boxes.Count;
			texts = new string[count];
			confs = new double[count];
			charMaps = new List<int[]>[count];
			System.Threading.Tasks.Parallel.For(0, count, delegate(int i)
			{
				try
				{
					RecognizeBitmap(crops[i], out texts[i], out confs[i], out charMaps[i]);
					if (charMaps[i] != null)
					{
						foreach (int[] c in charMaps[i])
						{
							c[2] += boxes[i].X0;
							c[3] += boxes[i].X0;
						}
					}
				}
				catch (Exception) { texts[i] = null; }
			});
			List<object> lines = new List<object>();
			for (int i = 0; i < count; i++)
			{
				Box box = boxes[i];
				crops[i].Dispose();
				string text = texts[i];
				if (string.IsNullOrEmpty(text)) { thumbs[i].Dispose(); continue; }
				double confidence = confs[i];
				List<int[]> chars = charMaps[i] ?? new List<int[]>();
				Dictionary<string, object> line = new Dictionary<string, object>();
				line["text"] = text;
				line["confidence"] = confidence;
				line["x"] = box.X0 / (double)width;
				line["y"] = 1.0 - box.Y1 / (double)height;
				line["width"] = (box.X1 - box.X0) / (double)width;
				line["height"] = (box.Y1 - box.Y0) / (double)height;
				line["angle"] = 0.0;
				line["alternatives"] = new object[0];
				using (MemoryStream ms = new MemoryStream())
				{
					thumbs[i].Save(ms, ImageFormat.Png);
					line["preview"] = Convert.ToBase64String(ms.ToArray());
				}
				thumbs[i].Dispose();
				line["method"] = "paddle-ocr-v5-server-native";
				line["stable"] = confidence >= 0.9;
				line["ocrAgreed"] = false;
				line["languages"] = new object[] { "zh", "en" };
				int[] ink = InkRect(gray, width, height, box);
				if (ink != null)
				{
					line["inkX"] = ink[0] / (double)width;
					line["inkY"] = 1.0 - ink[3] / (double)height;
					line["inkWidth"] = (ink[2] - ink[0]) / (double)width;
					line["inkHeight"] = (ink[3] - ink[1]) / (double)height;
				}
				if (chars.Count > 0)
				{
					List<object> mapped = new List<object>();
					foreach (int[] c in chars)
					{
						mapped.Add(new object[] { c[0], c[1], c[2] / (double)width, c[3] / (double)width });
					}
					line["chars"] = mapped;
				}
				lines.Add(line);
			}
			List<object> sorted = lines
				.OrderByDescending(delegate(object o) { return Convert.ToDouble(((Dictionary<string, object>)o)["y"], CultureInfo.InvariantCulture); })
				.ThenBy(delegate(object o) { return Convert.ToDouble(((Dictionary<string, object>)o)["x"], CultureInfo.InvariantCulture); })
				.ToList();
			Dictionary<string, object> result = new Dictionary<string, object>();
			result["native"] = true;
			result["ok"] = true;
			result["width"] = width;
			result["height"] = height;
			result["languages"] = new object[] { "zh", "en" };
			result["lines"] = sorted;
			result["engine"] = engineDir;
			return result;
		}

		// ---------------- 竖排:整图切列 → 列内切字 → 逐列横向拼接识别 ----------------
		// 思路与字醒 wasm 版一致:竖排不走 det,直接按墨迹投影切列(从右到左),
		// 每列按行投影切出字格,横向拼成条带交给横向 rec,条带即列的预览图。

		private static object VerticalRecognize(string imagePath)
		{
			int width;
			int height;
			byte[] gray;
			byte[] ink;
			using (Bitmap source = new Bitmap(imagePath))
			{
				width = source.Width;
				height = source.Height;
				gray = ToGray(source);
			}
			List<byte> border = new List<byte>();
			for (int x = 0; x < width; x++)
			{
				border.Add(gray[x]);
				border.Add(gray[(height - 1) * width + x]);
			}
			for (int y = 0; y < height; y++)
			{
				border.Add(gray[y * width]);
				border.Add(gray[y * width + width - 1]);
			}
			border.Sort();
			byte bg = border[border.Count / 2];
			int contrast = 0;
			for (int i = 0; i < gray.Length; i++)
			{
				int d = Math.Abs(gray[i] - bg);
				if (d > contrast) contrast = d;
			}
			int threshold = Math.Max(40, contrast / 2);
			ink = new byte[width * height];
			int[] colCount = new int[width];
			for (int y = 0; y < height; y++)
			{
				for (int x = 0; x < width; x++)
				{
					if (Math.Abs(gray[y * width + x] - bg) > threshold)
					{
						ink[y * width + x] = 1;
						colCount[x]++;
					}
				}
			}
			// 墨迹列段;间隙小于较宽一侧 25% 的并成一列
			List<int[]> runs = new List<int[]>();
			int runStart = -1;
			for (int x = 0; x <= width; x++)
			{
				if (x < width && colCount[x] > 0)
				{
					if (runStart < 0) runStart = x;
				}
				else if (runStart >= 0)
				{
					runs.Add(new int[] { runStart, x - 1 });
					runStart = -1;
				}
			}
			List<int[]> merged = new List<int[]>();
			foreach (int[] r in runs)
			{
				int[] last = merged.Count > 0 ? merged[merged.Count - 1] : null;
				int gap = last != null ? r[0] - last[1] - 1 : int.MaxValue;
				double wider = last != null ? Math.Max(r[1] - r[0] + 1, last[1] - last[0] + 1) : 0;
				if (last != null && gap < 0.25 * wider)
				{
					last[1] = r[1];
				}
				else
				{
					merged.Add(new int[] { r[0], r[1] });
				}
			}
			int widest = 0;
			foreach (int[] r in merged) widest = Math.Max(widest, r[1] - r[0] + 1);
			List<object> lines = new List<object>();
			for (int m = merged.Count - 1; m >= 0; m--)   // 从右到左
			{
				int x0 = merged[m][0];
				int x1 = merged[m][1];
				int colW = x1 - x0 + 1;
				if (colW < Math.Max(4, 0.3 * widest)) continue;
				// 列内行投影 → 字格;相邻格高 ≤ 1.15 列宽的粘连合并
				List<int[]> cells = new List<int[]>();
				int bandStart = -1;
				for (int y = 0; y <= height; y++)
				{
					bool has = y < height;
					if (has)
					{
						int n = 0;
						for (int x = x0; x <= x1; x++) n += ink[y * width + x];
						has = n > 0;
					}
					if (has)
					{
						if (bandStart < 0) bandStart = y;
					}
					else if (bandStart >= 0)
					{
						int[] last = cells.Count > 0 ? cells[cells.Count - 1] : null;
						if (last != null && y - 1 - last[0] + 1 <= 1.15 * colW) last[1] = y - 1;
						else cells.Add(new int[] { bandStart, y - 1 });
						bandStart = -1;
					}
				}
				if (cells.Count == 0) continue;
				int top = cells[0][0];
				int bottom = cells[cells.Count - 1][1] + 1;
				string text;
				double confidence;
				List<int[]> chars;
				using (Bitmap source = new Bitmap(imagePath))
				using (Bitmap strip = StitchStrip(source, x0, x1, cells))
				{
					if (strip == null) continue;
					RecognizeBitmap(strip, out text, out confidence, out chars);
					if (string.IsNullOrEmpty(text) || confidence < 0.3) continue;
					string cleaned = text.Replace(" ", "");
					if (cleaned.Length == 0) continue;
					Dictionary<string, object> line = new Dictionary<string, object>();
					line["text"] = cleaned;
					line["confidence"] = confidence;
					line["vertical"] = true;
					line["x"] = x0 / (double)width;
					line["y"] = 1.0 - bottom / (double)height;
					line["width"] = (x1 - x0 + 1) / (double)width;
					line["height"] = (bottom - top) / (double)height;
					line["angle"] = 0.0;
					line["alternatives"] = new object[0];
					using (MemoryStream ms = new MemoryStream())
					{
						strip.Save(ms, ImageFormat.Png);
						line["preview"] = Convert.ToBase64String(ms.ToArray());
					}
					line["method"] = "paddle-ocr-v5-server-native-vertical";
					line["stable"] = confidence >= 0.9;
					line["ocrAgreed"] = false;
					line["languages"] = new object[] { "zh", "en" };
					line["inkX"] = x0 / (double)width;
					line["inkY"] = 1.0 - bottom / (double)height;
					line["inkWidth"] = (x1 - x0 + 1) / (double)width;
					line["inkHeight"] = (bottom - top) / (double)height;
					lines.Add(line);
				}
			}
			Dictionary<string, object> result = new Dictionary<string, object>();
			result["native"] = true;
			result["ok"] = true;
			result["width"] = width;
			result["height"] = height;
			result["languages"] = new object[] { "zh", "en" };
			result["lines"] = lines;
			result["engine"] = engineDir;
			return result;
		}

		// 列的字格横向拼成白底条带(识别顺序 = 阅读顺序,自上而下)
		private static Bitmap StitchStrip(Bitmap source, int x0, int x1, List<int[]> cells)
		{
			int colW = x1 - x0 + 1;
			int totalW = 4;
			int maxH = 0;
			List<Rectangle> pieces = new List<Rectangle>();
			foreach (int[] cell in cells)
			{
				int top = Math.Max(0, cell[0]);
				int h = Math.Min(source.Height, cell[1] + 1) - top;
				if (h < 4) continue;
				pieces.Add(new Rectangle(x0, top, colW, h));
				totalW += colW + 2;
				maxH = Math.Max(maxH, h);
			}
			if (pieces.Count == 0 || maxH < 4) return null;
			Bitmap strip = new Bitmap(totalW, maxH + 4, PixelFormat.Format32bppArgb);
			using (Graphics g = Graphics.FromImage(strip))
			{
				g.Clear(Color.White);
				int cursor = 2;
				foreach (Rectangle p in pieces)
				{
					using (Bitmap piece = source.Clone(p, PixelFormat.Format32bppArgb))
					{
						g.DrawImage(piece, cursor, 2);
					}
					cursor += colW + 2;
				}
			}
			return strip;
		}

		// ---------------- det: DBNet ----------------

		private sealed class Box
		{
			public int X0;
			public int Y0;
			public int X1;
			public int Y1;
		}

		private static List<Box> Detect(Bitmap source)
		{
			int srcW = source.Width;
			int srcH = source.Height;
			float[] prob;
			int pmW;
			int pmH;
			{
				double ratio = Math.Max((double)srcW / DetLimit, (double)srcH / DetLimit);
				int inW;
				int inH;
				if (ratio > 1.0)
				{
					inW = Math.Max(32, (int)((double)srcW / ratio) / 32 * 32);
					inH = Math.Max(32, (int)((double)srcH / ratio) / 32 * 32);
				}
				else
				{
					inW = Math.Max(32, srcW / 32 * 32);
					inH = Math.Max(32, srcH / 32 * 32);
				}
				float[] pixels;
				using (Bitmap resized = Resize(source, inW, inH)) { pixels = Pixels(resized); }
				float[] data = new float[3 * inH * inW];
				for (int i = 0; i < inH * inW; i++)
				{
					data[0 * inH * inW + i] = (pixels[i * 3] / 255f - DetMean[0]) / DetStd[0];
					data[1 * inH * inW + i] = (pixels[i * 3 + 1] / 255f - DetMean[1]) / DetStd[1];
					data[2 * inH * inW + i] = (pixels[i * 3 + 2] / 255f - DetMean[2]) / DetStd[2];
				}
				string inputName = detSession.InputMetadata.Keys.First();
				string outputName = detSession.OutputMetadata.Keys.First();
				DenseTensor<float> tensor = new DenseTensor<float>(data, new[] { 1, 3, inH, inW });
				List<NamedOnnxValue> inputs = new List<NamedOnnxValue>();
				inputs.Add(NamedOnnxValue.CreateFromTensor(inputName, tensor));
				prob = null;
				pmW = 0;
				pmH = 0;
				using (IDisposableReadOnlyCollection<DisposableNamedOnnxValue> results = detSession.Run(inputs))
				{
					foreach (DisposableNamedOnnxValue result in results)
					{
						if (result.Name != outputName) continue;
						DenseTensor<float> t = (DenseTensor<float>)result.Value;
						float[] flat = t.ToArray();
						pmH = inH / 4;   // DBNet 输出是输入的 1/4
						pmW = inW / 4;
						if (flat.Length != pmW * pmH)
						{
							pmH = (int)Math.Sqrt(flat.Length / ((double)inW / inH));
							pmW = flat.Length / pmH;
						}
						prob = flat;
						break;
					}
				}
			}
			if (prob == null || pmW == 0) return new List<Box>();
			// 来源块在这里结束;后处理直接使用参数里的 source 位图
			int components;
			int[] labels = Components(prob, pmW, pmH, DetThreshold, out components);
			double sx = (double)srcW / (double)pmW;
			double sy = (double)srcH / (double)pmH;
			List<Box> boxes = new List<Box>();
			for (int label = 1; label <= components; label++)
			{
				int minX = int.MaxValue;
				int minY = int.MaxValue;
				int maxX = -1;
				int maxY = -1;
				int count = 0;
				for (int y = 0; y < pmH; y++)
				{
					int row = y * pmW;
					for (int x = 0; x < pmW; x++)
					{
						if (labels[row + x] != label) continue;
						count++;
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
					}
				}
				if (maxX < 0 || count < 6) continue;
				double x0 = minX * sx;
				double y0 = minY * sy;
				double x1 = (maxX + 1) * sx;
				double y1 = (maxY + 1) * sy;
				double w = x1 - x0;
				double h = y1 - y0;
				double pad = w * h * UnclipRatio / (2.0 * (w + h));   // DB 矩形外扩
				Box box = new Box
				{
					X0 = Math.Max(0, (int)(x0 - pad)),
					Y0 = Math.Max(0, (int)(y0 - pad)),
					X1 = Math.Min(srcW, (int)Math.Ceiling(x1 + pad)),
					Y1 = Math.Min(srcH, (int)Math.Ceiling(y1 + pad))
				};
				if (box.X1 - box.X0 < 10 || box.Y1 - box.Y0 < 6) continue;
				boxes.Add(box);
			}
			return MergeLines(boxes);
		}

		private static int[] Components(float[] prob, int w, int h, float threshold, out int count)
		{
			int[] labels = new int[w * h];
			int[] stack = new int[w * h];
			count = 0;
			for (int start = 0; start < labels.Length; start++)
			{
				if (labels[start] != 0 || prob[start] <= threshold) continue;
				count++;
				int top = 0;
				stack[top++] = start;
				labels[start] = count;
				while (top > 0)
				{
					int cur = stack[--top];
					int cy = cur / w;
					int cx = cur % w;
					if (cx > 0 && labels[cur - 1] == 0 && prob[cur - 1] > threshold) { labels[cur - 1] = count; stack[top++] = cur - 1; }
					if (cx < w - 1 && labels[cur + 1] == 0 && prob[cur + 1] > threshold) { labels[cur + 1] = count; stack[top++] = cur + 1; }
					if (cy > 0 && labels[cur - w] == 0 && prob[cur - w] > threshold) { labels[cur - w] = count; stack[top++] = cur - w; }
					if (cy < h - 1 && labels[cur + w] == 0 && prob[cur + w] > threshold) { labels[cur + w] = count; stack[top++] = cur + w; }
				}
			}
			return labels;
		}

		// 同一行的碎块合并:纵向重叠够大、横向间隙小于行高,并成一个
		private static List<Box> MergeLines(List<Box> boxes)
		{
			List<Box> list = new List<Box>(boxes);
			bool merged = true;
			while (merged)
			{
				merged = false;
				for (int i = 0; i < list.Count; i++)
				{
					for (int j = i + 1; j < list.Count; j++)
					{
						Box a = list[i];
						Box b = list[j];
						int overlap = Math.Min(a.Y1, b.Y1) - Math.Max(a.Y0, b.Y0);
						int minH = Math.Min(a.Y1 - a.Y0, b.Y1 - b.Y0);
						int gap = Math.Max(a.X0, b.X0) - Math.Min(a.X1, b.X1);
						if (overlap > minH * 0.4 && gap < minH * 0.8)
						{
							Box m = new Box
							{
								X0 = Math.Min(a.X0, b.X0),
								Y0 = Math.Min(a.Y0, b.Y0),
								X1 = Math.Max(a.X1, b.X1),
								Y1 = Math.Max(a.Y1, b.Y1)
							};
							list[i] = m;
							list.RemoveAt(j);
							merged = true;
							j--;
						}
					}
				}
			}
			return list;
		}

		// ---------------- rec: SVTR + CTC 贪心 ----------------

		private static void RecognizeBitmap(Bitmap piece, out string text, out double confidence, out List<int[]> chars)
		{
			int cropW = piece.Width;
			int cropH = piece.Height;
			int inW = (int)Math.Ceiling((double)cropW * RecHeight / cropH / 8.0) * 8;
			if (inW < 16) inW = 16;
			if (inW > 1024) inW = 1024;
			float[] data = new float[3 * RecHeight * inW];
			using (Bitmap resized = Resize(piece, inW, RecHeight))
			{
				float[] rgb = Pixels(resized);
				for (int i = 0; i < RecHeight * inW; i++)
				{
					data[0 * RecHeight * inW + i] = (rgb[i * 3] / 255f - 0.5f) / 0.5f;
					data[1 * RecHeight * inW + i] = (rgb[i * 3 + 1] / 255f - 0.5f) / 0.5f;
					data[2 * RecHeight * inW + i] = (rgb[i * 3 + 2] / 255f - 0.5f) / 0.5f;
				}
			}
			string inputName = recSession.InputMetadata.Keys.First();
			string outputName = recSession.OutputMetadata.Keys.First();
			DenseTensor<float> tensor = new DenseTensor<float>(data, new[] { 1, 3, RecHeight, inW });
			List<NamedOnnxValue> inputs = new List<NamedOnnxValue>();
			inputs.Add(NamedOnnxValue.CreateFromTensor(inputName, tensor));
			StringBuilder decoded = new StringBuilder();
			List<int[]> found = new List<int[]>();
			double total = 0.0;
			int kept = 0;
			int lastIndex = 0;
			using (IDisposableReadOnlyCollection<DisposableNamedOnnxValue> results = recSession.Run(inputs))
			{
				foreach (DisposableNamedOnnxValue result in results)
				{
					if (result.Name != outputName) continue;
					DenseTensor<float> t = (DenseTensor<float>)result.Value;
					float[] flat = t.ToArray();
					int classes = dict.Length;       // 输出 [1, steps, classes],类目数就是字典长度
					if (classes == 0 || flat.Length % classes != 0) continue;
					int steps = flat.Length / classes;
					for (int step = 0; step < steps; step++)
					{
						int best = 0;
						float bestScore = -1f;
						int row = step * classes;
						for (int c = 0; c < classes; c++)
						{
							float v = flat[row + c];
							if (v > bestScore) { bestScore = v; best = c; }
						}
						if (best == 0 || best == lastIndex) { lastIndex = best; continue; }
						lastIndex = best;
						if (best >= dict.Length) continue;
						// 输出已是 softmax 概率(全在 0..1)就直接用;是原始 logits 才补 softmax
						double prob;
						if (bestScore >= 0f && bestScore <= 1.001f) prob = bestScore;
						else
						{
							double sum = 0.0;
							for (int c = 0; c < classes; c++) sum += Math.Exp(flat[row + c] - (double)bestScore);
							prob = 1.0 / sum;
						}
						decoded.Append(dict[best]);
						int x0 = step * cropW / steps;
						int x1 = (step + 1) * cropW / steps;
						found.Add(new int[] { decoded.Length - 1, 1, x0, x1 });
						total += prob;
						kept++;
					}
					break;
				}
			}
			for (int i = 0; i < found.Count; i++)
			{
				int[] cur = found[i];
				int[] next = i + 1 < found.Count ? found[i + 1] : null;
				int[] prev = i > 0 ? found[i - 1] : null;
				int lo = prev != null ? (prev[3] + cur[2]) / 2 : cur[2];
				int hi = next != null ? (cur[3] + next[2]) / 2 : cur[3];
				cur[2] = lo;
				cur[3] = hi;
			}
			text = decoded.ToString();
			confidence = kept > 0 ? total / kept : 0.0;
			chars = found;
		}

		// 全局坐标包装:RecognizeBitmap 输出的字框是条带内相对坐标,这里平移回原图
		private static void ShiftChars(List<int[]> chars, int offsetX)
		{
			if (chars == null) return;
			foreach (int[] c in chars)
			{
				c[2] += offsetX;
				c[3] += offsetX;
			}
		}

		// ---------------- 位图辅助 ----------------

		// 返回交错 RGB(0..255)
		private static float[] Pixels(Bitmap bitmap)
		{
			int w = bitmap.Width;
			int h = bitmap.Height;
			BitmapData bd = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
			try
			{
				byte[] raw = new byte[Math.Abs(bd.Stride) * h];
				Marshal.Copy(bd.Scan0, raw, 0, raw.Length);
				float[] rgb = new float[w * h * 3];
				for (int y = 0; y < h; y++)
				{
					int row = y * bd.Stride;
					for (int x = 0; x < w; x++)
					{
						int i = row + x * 4;
						int o = (y * w + x) * 3;
						rgb[o] = raw[i + 2];   // R
						rgb[o + 1] = raw[i + 1];   // G
						rgb[o + 2] = raw[i];   // B
					}
				}
				return rgb;
			}
			finally { bitmap.UnlockBits(bd); }
		}

		private static Bitmap Resize(Bitmap source, int width, int height)
		{
			Bitmap target = new Bitmap(width, height, PixelFormat.Format32bppArgb);
			using (Graphics g = Graphics.FromImage(target))
			{
				g.InterpolationMode = InterpolationMode.HighQualityBicubic;
				g.PixelOffsetMode = PixelOffsetMode.Half;
				g.DrawImage(source, new Rectangle(0, 0, width, height));
			}
			return target;
		}

		private static byte[] ToGray(Bitmap source)
		{
			int w = source.Width;
			int h = source.Height;
			BitmapData bd = source.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
			try
			{
				byte[] raw = new byte[Math.Abs(bd.Stride) * h];
				Marshal.Copy(bd.Scan0, raw, 0, raw.Length);
				byte[] gray = new byte[w * h];
				for (int y = 0; y < h; y++)
				{
					int row = y * bd.Stride;
					for (int x = 0; x < w; x++)
					{
						int i = row + x * 4;
						gray[y * w + x] = (byte)((raw[i] * 299 + raw[i + 1] * 587 + raw[i + 2] * 114) / 1000);
					}
				}
				return gray;
			}
			finally { source.UnlockBits(bd); }
		}

		// 行内墨迹框:边框中值当背景,阈值 70(JS inkBox 的简化版;det 框已隔离整行)
		private static int[] InkRect(byte[] gray, int width, int height, Box box)
		{
			List<byte> border = new List<byte>();
			int bx1 = Math.Min(width, box.X1) - 1;
			int by1 = Math.Min(height, box.Y1) - 1;
			for (int x = box.X0; x <= bx1; x++)
			{
				border.Add(gray[box.Y0 * width + x]);
				border.Add(gray[by1 * width + x]);
			}
			for (int y = box.Y0; y <= by1; y++)
			{
				border.Add(gray[y * width + box.X0]);
				border.Add(gray[y * width + bx1]);
			}
			border.Sort();
			byte bg = border[border.Count / 2];
			int minX = int.MaxValue;
			int minY = int.MaxValue;
			int maxX = -1;
			int maxY = -1;
			for (int y = box.Y0; y <= by1; y++)
			{
				for (int x = box.X0; x <= bx1; x++)
				{
					if (Math.Abs(gray[y * width + x] - bg) <= 70) continue;
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
			if (maxX < 0) return null;
			return new int[] { minX, minY, maxX + 1, maxY + 1 };
		}

		// 行预览图:整图已在外层解码,这里只裁剪缩放
		private static Bitmap Thumb(Bitmap source, Box box)
		{
			int w = box.X1 - box.X0;
			int h = box.Y1 - box.Y0;
			double scale = Math.Min(1.0, Math.Min(800.0 / w, 96.0 / h));
			int tw = Math.Max(1, (int)Math.Round(w * scale));
			int th = Math.Max(1, (int)Math.Round(h * scale));
			using (Bitmap piece = source.Clone(new Rectangle(box.X0, box.Y0, w, h), PixelFormat.Format32bppArgb))
			{
				return Resize(piece, tw, th);
			}
		}
	}
}
