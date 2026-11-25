using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace YunLi.Core
{
	public sealed class FontMatcher
	{
		[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
		private struct LOGFONT
		{
			public int lfHeight;

			public int lfWidth;

			public int lfEscapement;

			public int lfOrientation;

			public int lfWeight;

			public byte lfItalic;

			public byte lfUnderline;

			public byte lfStrikeOut;

			public byte lfCharSet;

			public byte lfOutPrecision;

			public byte lfClipPrecision;

			public byte lfQuality;

			public byte lfPitchAndFamily;

			[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
			public string lfFaceName;
		}

		[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
		private struct ENUMLOGFONTEX
		{
			public LOGFONT elfLogFont;

			[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
			public string elfFullName;

			[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
			public string elfStyle;

			[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
			public string elfScript;
		}

		private struct POINT
		{
			public int X;

			public int Y;
		}

		private struct GLYPHMETRICS
		{
			public uint gmBlackBoxX;

			public uint gmBlackBoxY;

			public POINT gmptGlyphOrigin;

			public short gmCellIncX;

			public short gmCellIncY;
		}

		private struct FIXED
		{
			public ushort fract;

			public short value;
		}

		private struct MAT2
		{
			public FIXED eM11;

			public FIXED eM12;

			public FIXED eM21;

			public FIXED eM22;
		}

		private delegate int EnumProc(ref ENUMLOGFONTEX font, IntPtr metric, uint type, IntPtr data);

		private sealed class Face
		{
			public LOGFONT Font;

			public string Family;
		}

		private sealed class Drawn
		{
			public string Text;

			public GraphicsPath Path;

			public RectangleF Bounds;
		}

		private sealed class Best
		{
			public string Name;

			public double Score;

			public Mask Mask;
		}

		private sealed class Comparison
		{
			public List<Best> Best;

			public int Count;

			public Mask Original;

			public string Reading;
		}

		private const int Em = 1024;

		private readonly string hostPath;

		private Dictionary<string, Face> catalog;

		private List<KeyValuePair<string, Face>> styled;

		private static bool registered;

		private static readonly int[][] Lookalikes = new int[12][]
		{
			new int[8] { 183, 12539, 8226, 8231, 8729, 8901, 65381, 903 },
			new int[6] { 8212, 8213, 8211, 8210, 65293, 11834 },
			new int[3] { 126, 65374, 12316 },
			new int[2] { 58, 65306 },
			new int[2] { 44, 65292 },
			new int[2] { 59, 65307 },
			new int[2] { 33, 65281 },
			new int[2] { 63, 65311 },
			new int[2] { 40, 65288 },
			new int[2] { 41, 65289 },
			new int[2] { 37, 65285 },
			new int[2] { 43, 65291 }
		};

		// 常见形近字组:干净黑底图上 OCR 仍会读错的字,校验时只在这些组内找替换。
		private static readonly string[] ConfusionGroups = new string[]
		{
			"己已巳", "土士", "未末", "千干于", "午牛", "天夫", "太大犬", "木术本", "日曰", "目且",
			"石右", "田由甲申电", "毛手", "酒洒", "治冶", "拆折", "竞竟", "免兔", "乌鸟", "令今",
			"侯候", "崇祟", "失矢", "九丸", "义叉", "王玉", "刀刁", "人入八", "户尸", "母毋",
			"风凤", "冈网", "戊戌戍", "拨拔", "茶荼", "耍要", "羊半平", "垣恒", "佘余", "幸辛"
		};

		private static readonly Dictionary<char, string> Confusion = BuildConfusion();

		private static Dictionary<char, string> BuildConfusion()
		{
			Dictionary<char, StringBuilder> merged = new Dictionary<char, StringBuilder>();
			foreach (string group in ConfusionGroups)
			{
				foreach (char c in group)
				{
					StringBuilder list;
					if (!merged.TryGetValue(c, out list))
					{
						list = new StringBuilder();
						merged[c] = list;
					}
					foreach (char other in group)
					{
						if (other != c && list.ToString().IndexOf(other) < 0) list.Append(other);
					}
				}
			}
			Dictionary<char, string> map = new Dictionary<char, string>();
			foreach (KeyValuePair<char, StringBuilder> item in merged) map[item.Key] = item.Value.ToString();
			return map;
		}

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		private static extern int EnumFontFamiliesExW(IntPtr hdc, ref LOGFONT font, EnumProc proc, IntPtr data, uint flags);

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		private static extern IntPtr CreateFontIndirectW(ref LOGFONT font);

		[DllImport("gdi32.dll")]
		private static extern IntPtr SelectObject(IntPtr hdc, IntPtr value);

		[DllImport("gdi32.dll")]
		private static extern bool DeleteObject(IntPtr value);

		[DllImport("gdi32.dll")]
		private static extern uint GetFontData(IntPtr hdc, uint table, uint offset, byte[] data, uint size);

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		private static extern uint GetGlyphIndicesW(IntPtr hdc, string text, int length, ushort[] glyphs, uint flags);

		[DllImport("gdi32.dll", EntryPoint = "GetGlyphOutlineW")]
		private static extern uint GetGlyphMetrics(IntPtr hdc, uint glyph, uint format, out GLYPHMETRICS metrics, uint size, IntPtr buffer, ref MAT2 matrix);

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		private static extern int AddFontResourceExW(string file, uint flags, IntPtr reserved);

		[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
		private static extern int LCMapStringEx(string locale, uint flags, string source, int sourceLength, StringBuilder destination, int destinationLength, IntPtr version, IntPtr reserved, IntPtr sortHandle);

		public FontMatcher(string illustratorPath = null)
		{
			hostPath = illustratorPath;
		}

		private static int U16(byte[] b, int n)
		{
			return b[n] * 256 + b[n + 1];
		}

		private static string PostScript(IntPtr hdc)
		{
			uint table = 1701667182u;
			uint fontData = GetFontData(hdc, table, 0u, null, 0u);
			if (fontData == uint.MaxValue || fontData > 4194304 || fontData < 6)
			{
				return null;
			}
			byte[] array = new byte[fontData];
			if (GetFontData(hdc, table, 0u, array, fontData) == uint.MaxValue)
			{
				return null;
			}
			int num = U16(array, 2);
			int num2 = U16(array, 4);
			string result = null;
			for (int i = 0; i < num; i++)
			{
				int num3 = 6 + 12 * i;
				if (num3 + 12 > array.Length)
				{
					break;
				}
				if (U16(array, num3 + 6) != 6)
				{
					continue;
				}
				int num4 = U16(array, num3 + 8);
				int num5 = num2 + U16(array, num3 + 10);
				int num6 = U16(array, num3);
				if (num5 + num4 <= array.Length)
				{
					string text = ((num6 == 0 || num6 == 3) ? Encoding.BigEndianUnicode.GetString(array, num5, num4) : Encoding.ASCII.GetString(array, num5, num4));
					if (num6 == 3)
					{
						return text.TrimEnd(default(char));
					}
					result = text.TrimEnd(default(char));
				}
			}
			return result;
		}

		private static string StyleKey(string s)
		{
			return new string((from c in (s ?? "").ToLowerInvariant()
				where !char.IsWhiteSpace(c) && c != '-' && c != '_'
				select c).ToArray());
		}

		private void RegisterIllustratorFonts()
		{
			if (registered || string.IsNullOrEmpty(hostPath))
			{
				return;
			}
			registered = true;
			try
			{
				for (DirectoryInfo directoryInfo = new DirectoryInfo(Path.GetDirectoryName(hostPath)); directoryInfo != null; directoryInfo = directoryInfo.Parent)
				{
					string path = Path.Combine(directoryInfo.FullName, "Required", "Fonts");
					if (Directory.Exists(path))
					{
						string[] files = Directory.GetFiles(path);
						foreach (string text in files)
						{
							switch (Path.GetExtension(text).ToLowerInvariant())
							{
							case ".otf":
							case ".ttf":
							case ".ttc":
							case ".otc":
								AddFontResourceExW(text, 16u, IntPtr.Zero);
								break;
							}
						}
						break;
					}
				}
			}
			catch (IOException)
			{
			}
			catch (UnauthorizedAccessException)
			{
			}
		}

		private void EnsureCatalog(IntPtr hdc)
		{
			if (catalog != null)
			{
				return;
			}
			RegisterIllustratorFonts();
			catalog = new Dictionary<string, Face>(StringComparer.Ordinal);
			styled = new List<KeyValuePair<string, Face>>();
			List<string> families = new List<string>();
			LOGFONT font = new LOGFONT
			{
				lfCharSet = 1,
				lfFaceName = ""
			};
			EnumProc enumProc = delegate(ref ENUMLOGFONTEX f, IntPtr m, uint t, IntPtr d)
			{
				string lfFaceName = f.elfLogFont.lfFaceName;
				if ((t & 1) == 0 && !string.IsNullOrEmpty(lfFaceName) && lfFaceName[0] != '@' && !families.Contains(lfFaceName))
				{
					families.Add(lfFaceName);
				}
				return 1;
			};
			EnumFontFamiliesExW(hdc, ref font, enumProc, IntPtr.Zero, 0u);
			foreach (string item in families)
			{
				HashSet<string> seen = new HashSet<string>();
				LOGFONT font2 = new LOGFONT
				{
					lfCharSet = 1,
					lfFaceName = item
				};
				List<KeyValuePair<string, LOGFONT>> faces = new List<KeyValuePair<string, LOGFONT>>();
				EnumProc enumProc2 = delegate(ref ENUMLOGFONTEX f, IntPtr m, uint t, IntPtr d)
				{
					LOGFONT elfLogFont = f.elfLogFont;
					if (seen.Add(elfLogFont.lfWeight + "/" + elfLogFont.lfItalic + "/" + f.elfStyle))
					{
						faces.Add(new KeyValuePair<string, LOGFONT>(f.elfStyle, elfLogFont));
					}
					return 1;
				};
				EnumFontFamiliesExW(hdc, ref font2, enumProc2, IntPtr.Zero, 0u);
				GC.KeepAlive(enumProc2);
				foreach (KeyValuePair<string, LOGFONT> item2 in faces)
				{
					LOGFONT value = item2.Value;
					value.lfHeight = -1024;
					value.lfWidth = 0;
					value.lfFaceName = item;
					Face face = new Face
					{
						Font = value,
						Family = item
					};
					string text = WithFont(hdc, face, () => PostScript(hdc));
					if (!string.IsNullOrEmpty(text) && !catalog.ContainsKey(text))
					{
						catalog[text] = face;
					}
					styled.Add(new KeyValuePair<string, Face>(StyleKey(item) + "|" + StyleKey(item2.Key), face));
				}
			}
			GC.KeepAlive(enumProc);
		}

		private Face Lookup(string family, string style)
		{
			string text = StyleKey(family + style);
			string text2 = StyleKey(family);
			string text3 = StyleKey(style);
			foreach (KeyValuePair<string, Face> item in styled)
			{
				string[] array = item.Key.Split('|');
				if (array[0] == text2 && array[1] == text3)
				{
					return item.Value;
				}
			}
			foreach (KeyValuePair<string, Face> item2 in styled)
			{
				string[] array2 = item2.Key.Split('|');
				if (array2[0] == text && (array2[1] == "regular" || array2[1] == "normal" || array2[1] == ""))
				{
					return item2.Value;
				}
			}
			return null;
		}

		private static T WithFont<T>(IntPtr hdc, Face face, Func<T> body)
		{
			LOGFONT font = face.Font;
			IntPtr intPtr = CreateFontIndirectW(ref font);
			if (intPtr == IntPtr.Zero)
			{
				return default(T);
			}
			IntPtr value = SelectObject(hdc, intPtr);
			try
			{
				return body();
			}
			finally
			{
				SelectObject(hdc, value);
				DeleteObject(intPtr);
			}
		}

		private static ushort[] Glyphs(IntPtr hdc, string text)
		{
			ushort[] array = new ushort[text.Length];
			if (text.Length == 0)
			{
				return array;
			}
			if (GetGlyphIndicesW(hdc, text, text.Length, array, 1u) == uint.MaxValue)
			{
				return null;
			}
			return array;
		}

		private static bool HasGlyph(IntPtr hdc, int scalar)
		{
			if (scalar > 65535)
			{
				return false;
			}
			ushort[] array = Glyphs(hdc, ((char)scalar).ToString());
			if (array != null)
			{
				return array[0] != ushort.MaxValue;
			}
			return false;
		}

		private static ushort[] Renderable(IntPtr hdc, string text)
		{
			List<int> list = MatchCore.Scalars(text).ToList();
			int num = list.Count(MatchCore.IsHan);
			int num2 = 0;
			bool flag = false;
			List<ushort> list2 = new List<ushort>();
			ushort[] array = Glyphs(hdc, text);
			if (array == null)
			{
				return null;
			}
			int num3 = 0;
			foreach (int s in list)
			{
				int num4 = ((s <= 65535) ? 1 : 2);
				ushort num5 = ((num4 == 1) ? array[num3] : ushort.MaxValue);
				num3 += num4;
				if (num5 != ushort.MaxValue)
				{
					list2.Add(num5);
					if (!char.IsWhiteSpace((char)s))
					{
						flag = true;
					}
					continue;
				}
				int[] array2 = Lookalikes.FirstOrDefault((int[] g) => g.Contains(s));
				int num6 = (array2 == null ? (int?)null : array2.FirstOrDefault((int c) => HasGlyph(hdc, c))) ?? (-1);
				if (array2 != null && num6 > 0)
				{
					list2.Add(Glyphs(hdc, ((char)num6).ToString())[0]);
					flag = true;
				}
				else if (MatchCore.IsHan(s) && num >= 4 && num2 < Math.Max(1, num / 6) && HasGlyph(hdc, 12288))
				{
					num2++;
					list2.Add(Glyphs(hdc, "\u3000")[0]);
				}
				else if (MatchCore.LetterOrNumber(s))
				{
					return null;
				}
			}
			if (!flag)
			{
				return null;
			}
			return list2.ToArray();
		}

		private static Drawn Draw(IntPtr hdc, Face face, string text)
		{
			return WithFont(hdc, face, delegate
			{
				ushort[] array = Renderable(hdc, text);
				if (array == null || array.Length == 0)
				{
					return (Drawn)null;
				}
				GraphicsPath graphicsPath = GdiOutline.Read(hdc, array, 0f, 1024f);
				if (graphicsPath == null)
				{
					return (Drawn)null;
				}
				graphicsPath.Flatten(null, 1f);
				RectangleF bounds = graphicsPath.GetBounds();
				if (bounds.Width <= 0f || bounds.Height <= 0f)
				{
					graphicsPath.Dispose();
					return (Drawn)null;
				}
				return new Drawn
				{
					Text = text,
					Path = graphicsPath,
					Bounds = bounds
				};
			});
		}

		private static Mask Render(Drawn d, int width, int height)
		{
			using (Bitmap bitmap = new Bitmap(width, height, PixelFormat.Format24bppRgb))
			using (Graphics graphics = Graphics.FromImage(bitmap))
			using (Matrix transform = new Matrix((float)width / d.Bounds.Width, 0f, 0f, (float)height / d.Bounds.Height, (0f - d.Bounds.X) * (float)width / d.Bounds.Width, (0f - d.Bounds.Y) * (float)height / d.Bounds.Height))
			{
			graphics.Clear(Color.White);
			graphics.SmoothingMode = SmoothingMode.AntiAlias;
			graphics.PixelOffsetMode = PixelOffsetMode.Half;
			graphics.Transform = transform;
			graphics.FillPath(Brushes.Black, d.Path);
			return Read(bitmap);
			}
		}

		private static List<double[]> GlyphSpans(IntPtr hdc, Face face, string text)
		{
			return WithFont(hdc, face, delegate
			{
				List<double[]> list = new List<double[]>();
				ushort[] array = Glyphs(hdc, text);
				if (array == null)
				{
					return list;
				}
				MAT2 matrix = new MAT2
				{
					eM11 = new FIXED
					{
						value = 1
					},
					eM22 = new FIXED
					{
						value = 1
					}
				};
				double num = 0.0;
				for (int i = 0; i < text.Length; i++)
				{
					if (!char.IsLowSurrogate(text[i]))
					{
						bool flag = MatchCore.IsHan(text[i]);
						GLYPHMETRICS metrics;
						if (array[i] == ushort.MaxValue)
						{
							num += (double)(flag ? 1024 : 512);
						}
						else if (GetGlyphMetrics(hdc, array[i], 128u, out metrics, 0u, IntPtr.Zero, ref matrix) == uint.MaxValue)
						{
							num += (double)(flag ? 1024 : 512);
						}
						else
						{
							if (!char.IsWhiteSpace(text[i]) && metrics.gmBlackBoxX != 0)
							{
								list.Add(new double[3]
								{
									i,
									num + (double)metrics.gmptGlyphOrigin.X,
									num + (double)metrics.gmptGlyphOrigin.X + (double)metrics.gmBlackBoxX
								});
							}
							num += (double)metrics.gmCellIncX;
						}
					}
				}
				return list;
			}) ?? new List<double[]>();
		}

		// 字形校验纠错:OCR 读错的字,用选中字体把形近字渲染成掩码,与原稿该字的墨迹比较。
		// 只有明显更贴(高出 0.08 且绝对值 >= 0.55)才替换;替换是一比一的,行文字长度不变。
		private static Mask CharMask(Mask crop, int x0, int x1)
		{
			if (x0 < 0) x0 = 0;
			if (x1 > crop.Width) x1 = crop.Width;
			int w = x1 - x0;
			if (w < 4) return null;
			byte[] pixels = new byte[w * crop.Height];
			for (int y = 0; y < crop.Height; y++)
			{
				Buffer.BlockCopy(crop.Pixels, y * crop.Width + x0, pixels, y * w, w);
			}
			Mask part = new Mask(w, crop.Height, pixels);
			int[] tight = part.Tight();
			if (tight == null) return null;
			int nw = tight[2] * 48 / Math.Max(1, tight[3]);
			if (nw < 8) nw = 8;
			if (nw > 240) nw = 240;
			return part.Normalize(tight, nw, 48);
		}

		private static double CharSim(Mask original, Drawn drawn)
		{
			if (original == null || drawn == null || drawn.Bounds.Height <= 0f) return -1.0;
			int w = (int)((double)drawn.Bounds.Width / (double)drawn.Bounds.Height * 48.0);
			if (w < 8) w = 8;
			if (w > 240) w = 240;
			Mask rendered = Render(drawn, w, 48);
			return MatchCore.Overlap(original, rendered.Normalize(MatchCore.Whole(rendered), original.Width, 48));
		}

		private static string VerifyChars(IntPtr hdc, Face face, Mask crop, string text, Dictionary<int, int[]> boxes, out int fixedCount)
		{
			fixedCount = 0;
			if (crop == null || face == null || string.IsNullOrEmpty(text)) return text;
			Dictionary<int, double[]> spans = null;
			double emLeft = 0.0;
			double emRight = 1.0;
			int inkX = 0;
			int inkW = crop.Width;
			if (boxes == null)
			{
				List<double[]> raw = GlyphSpans(hdc, face, text);
				if (raw.Count > 0)
				{
					spans = new Dictionary<int, double[]>();
					foreach (double[] s in raw) spans[(int)s[0]] = s;
					emLeft = raw[0][1];
					emRight = raw[raw.Count - 1][2];
					if (emRight - emLeft < 1.0) return text;
					int[] tight = crop.Tight();
					if (tight == null) return text;
					inkX = tight[0];
					inkW = tight[2];
				}
			}
			StringBuilder result = new StringBuilder(text);
			for (int i = 0; i < text.Length; i++)
			{
				char ch = text[i];
				string alternates;
				if (ch < 0x2E80 || char.IsSurrogate(ch) || !Confusion.TryGetValue(ch, out alternates)) continue;
				int x0 = -1;
				int x1 = -1;
				if (boxes != null)
				{
					int[] span;
					if (boxes.TryGetValue(i, out span)) { x0 = span[0]; x1 = span[1]; }
				}
				else
				{
					double[] span;
					if (spans.TryGetValue(i, out span))
					{
						x0 = inkX + (int)((span[0] - emLeft) / (emRight - emLeft) * (double)inkW);
						x1 = inkX + (int)((span[1] - emLeft) / (emRight - emLeft) * (double)inkW);
					}
				}
				if (x1 - x0 < 4) continue;
				Mask charMask = CharMask(crop, x0, x1);
				if (charMask == null) continue;
				Drawn drawn = Draw(hdc, face, ch.ToString());
				if (drawn == null) continue;
				double baseSim;
				try { baseSim = CharSim(charMask, drawn); }
				finally { if (drawn.Path != null) drawn.Path.Dispose(); }
				if (baseSim >= 0.8) continue;
				char best = '\0';
				double bestSim = baseSim;
				foreach (char alt in alternates)
				{
					Drawn candidate = Draw(hdc, face, alt.ToString());
					if (candidate == null) continue;
					try
					{
						double sim = CharSim(charMask, candidate);
						if (sim > bestSim + 0.08 && sim >= 0.55) { bestSim = sim; best = alt; }
					}
					finally { if (candidate.Path != null) candidate.Path.Dispose(); }
				}
				if (best != '\0') { result[i] = best; fixedCount++; }
			}
			return result.ToString();
		}

		private static string Simplify(string text)
		{
			if (string.IsNullOrEmpty(text))
			{
				return text;
			}
			try
			{
				StringBuilder stringBuilder = new StringBuilder(text.Length + 8);
				int num = LCMapStringEx("zh-CN", 33554432u, text, text.Length, stringBuilder, stringBuilder.Capacity, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
				return (num > 0) ? stringBuilder.ToString(0, num) : null;
			}
			catch (EntryPointNotFoundException)
			{
				return null;
			}
		}

		private static byte[] Argb(Bitmap source)
		{
			using (Bitmap bitmap = source.Clone(new Rectangle(0, 0, source.Width, source.Height), PixelFormat.Format32bppArgb))
			{
			BitmapData bitmapData = bitmap.LockBits(new Rectangle(0, 0, bitmap.Width, bitmap.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
			try
			{
				byte[] array = new byte[bitmap.Width * bitmap.Height * 4];
				for (int i = 0; i < bitmap.Height; i++)
				{
					Marshal.Copy(IntPtr.Add(bitmapData.Scan0, i * bitmapData.Stride), array, i * bitmap.Width * 4, bitmap.Width * 4);
				}
				return array;
			}
			finally
			{
				bitmap.UnlockBits(bitmapData);
			}
			}
		}

		private static int OverWhite(byte value, byte alpha)
		{
			return (value * alpha + 255 * (255 - alpha)) / 255;
		}

		private static Mask Read(Bitmap source)
		{
			byte[] array = Argb(source);
			byte[] array2 = new byte[source.Width * source.Height];
			for (int i = 0; i < array2.Length; i++)
			{
				byte alpha = array[i * 4 + 3];
				array2[i] = (byte)((OverWhite(array[i * 4], alpha) + OverWhite(array[i * 4 + 1], alpha) + OverWhite(array[i * 4 + 2], alpha)) / 3);
			}
			return new Mask(source.Width, source.Height, array2);
		}

		private static byte[] ReadRgba(Bitmap source)
		{
			byte[] array = Argb(source);
			byte[] array2 = new byte[array.Length];
			for (int i = 0; i < array.Length; i += 4)
			{
				byte alpha = array[i + 3];
				array2[i] = (byte)OverWhite(array[i + 2], alpha);
				array2[i + 1] = (byte)OverWhite(array[i + 1], alpha);
				array2[i + 2] = (byte)OverWhite(array[i], alpha);
				array2[i + 3] = byte.MaxValue;
			}
			return array2;
		}

		private static string Png(Mask mask)
		{
			using (Bitmap bitmap = new Bitmap(mask.Width, mask.Height, PixelFormat.Format24bppRgb))
			{
			BitmapData bitmapData = bitmap.LockBits(new Rectangle(0, 0, mask.Width, mask.Height), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
			try
			{
				byte[] array = new byte[Math.Abs(bitmapData.Stride)];
				for (int i = 0; i < mask.Height; i++)
				{
					for (int j = 0; j < mask.Width; j++)
					{
						array[j * 3] = (array[j * 3 + 1] = (array[j * 3 + 2] = mask.Pixels[i * mask.Width + j]));
					}
					Marshal.Copy(array, 0, IntPtr.Add(bitmapData.Scan0, i * bitmapData.Stride), array.Length);
				}
			}
			finally
			{
				bitmap.UnlockBits(bitmapData);
			}
			using (MemoryStream memoryStream = new MemoryStream())
			{
			bitmap.Save(memoryStream, ImageFormat.Png);
			return Convert.ToBase64String(memoryStream.ToArray());
			}
			}
		}

		private static int Width(RectangleF b, int height, int limit, int least)
		{
			return Math.Max(least, Math.Min(limit, (int)(b.Width / b.Height * (float)height)));
		}

		private static int Width(int[] b, int height, int limit, int least)
		{
			return Math.Max(least, Math.Min(limit, (int)((double)b[2] / (double)b[3] * (double)height)));
		}

		public object Match(string imagePath, Dictionary<string, object> request, Action<object> progress)
		{
			string[] array = (from x in Json.Array(request, "fonts")
				select x as string).ToArray();
			object[] array2 = Json.Array(request, "lines");
			if (array2.Length < 1 || array2.Length > 20)
			{
				throw new Exception("每次最多匹配 20 行。");
			}
			object value;
			object[] array3 = ((request.TryGetValue("fontStyles", out value) && value != null && !(value is string)) ? Json.Array(request, "fontStyles") : new object[0]);
			if (array3.Length != array.Length)
			{
				array3 = new object[0];
			}
			using (Bitmap image = new Bitmap(1, 1))
			using (Graphics graphics = Graphics.FromImage(image))
			{
			IntPtr hdc = graphics.GetHdc();
			try
			{
				return Run(hdc, imagePath, array, array3, array2, progress, request.ContainsKey("photo") && request["photo"] is bool && (bool)request["photo"]);
			}
			finally
			{
				graphics.ReleaseHdc(hdc);
			}
			}
		}

		private object Run(IntPtr hdc, string imagePath, string[] requested, object[] styles, object[] lines, Action<object> progress, bool photo)
		{
			EnsureCatalog(hdc);
			List<KeyValuePair<string, Face>> resolved = new List<KeyValuePair<string, Face>>();
			HashSet<string> hashSet = new HashSet<string>();
			Dictionary<string, string> families = new Dictionary<string, string>();
			for (int i = 0; i < requested.Length; i++)
			{
				string text = requested[i];
				if (!string.IsNullOrEmpty(text) && hashSet.Add(text))
				{
					IEnumerable styleItems = (i >= styles.Length) ? null : styles[i] as IEnumerable;
					string[] array = styleItems == null ? null : (from object o in styleItems select o as string).ToArray();
					Face value = null;
					if (catalog.TryGetValue(text, out value))
					{
						resolved.Add(new KeyValuePair<string, Face>(text, value));
						families[text] = ((array != null && array.Length == 2 && !string.IsNullOrEmpty(array[0])) ? array[0] : value.Family);
					}
					else if (array != null && array.Length == 2 && (value = Lookup(array[0], array[1])) != null)
					{
						resolved.Add(new KeyValuePair<string, Face>(text, value));
						families[text] = array[0];
					}
				}
			}
			Dictionary<string, int> indexOf = new Dictionary<string, int>();
			for (int num = 0; num < resolved.Count; num++)
			{
				indexOf[resolved[num].Key] = num;
			}
			byte[] array2 = null;
			Mask mask;
			using (Bitmap bitmap = new Bitmap(imagePath))
			{
				if (bitmap.Width > 6000 || bitmap.Height > 6000)
				{
					throw new Exception("识别图片过大。");
				}
				mask = Read(bitmap);
				if (photo)
				{
					array2 = ReadRgba(bitmap);
				}
			}
			int width = mask.Width;
			int height = mask.Height;
			Func<Mask, string, int[], int, int, int, Comparison> compare = delegate(Mask mask4, string text8, int[] only, int line, int num25, int num26)
			{
				int[] array8 = mask4.Tight();
				if (array8 == null)
				{
					return (Comparison)null;
				}
				int num19 = Width(array8, 48, 960, 32);
				Mask mask5 = mask4.Normalize(array8, num19, 48);
				Func<Mask, Mask> func4 = (Mask m) => m.Normalize(MatchCore.Whole(m), Math.Max(16, m.Width * 48 / 96), 48);
				Mask mask6 = mask4.Normalize(array8, Width(array8, 96, 1920, 32), 96);
				List<int[]> list9 = MatchCore.InkRuns(mask6);
				Mask mask7 = func4(mask6);
				Mask mask8 = MatchCore.Compacted(mask6);
				if (mask8 != null)
				{
					mask8 = func4(mask8);
				}
				List<string> list10 = MatchCore.Variants(text8, Simplify);
				Mask mask9 = MatchCore.Compacted(mask4.Normalize(array8, Width(array8, 48, 960, 32), 48));
				List<Tuple<int, double>> list11 = new List<Tuple<int, double>>();
				int num20 = 0;
				int[] array9 = only ?? Enumerable.Range(0, resolved.Count).ToArray();
				foreach (int num22 in array9)
				{
					double num23 = -1.0;
					foreach (string item in list10)
					{
						Drawn drawn = null;
						try
						{
							drawn = Draw(hdc, resolved[num22].Value, item);
							if (drawn != null)
							{
								Mask mask10 = Render(drawn, Width(drawn.Bounds, 48, 960, 16), 48);
								double num24 = MatchCore.Overlap(mask5, mask10.Normalize(MatchCore.Whole(mask10), mask5.Width, 48));
								Mask mask11 = MatchCore.Compacted(mask10);
								if (mask9 != null && mask11 != null)
								{
									num24 = Math.Max(num24, MatchCore.Overlap(mask9, mask11.Normalize(MatchCore.Whole(mask11), mask9.Width, 48)));
								}
								if (num24 > num23)
								{
									num23 = num24;
								}
							}
						}
						catch (ArgumentException)
						{
						}
						catch (ExternalException)
						{
						}
						finally
						{
							if (drawn != null && drawn.Path != null) drawn.Path.Dispose();
						}
					}
					if (num23 >= 0.0)
					{
						num20++;
						list11.Add(Tuple.Create(num22, num23));
					}
					if (only == null && num22 % 100 == 0)
					{
						progress(new
						{
							type = "progress",
							line = line + 1,
							lines = lines.Length,
							done = num25 * resolved.Count + num22,
							total = num26 * resolved.Count
						});
					}
				}
				List<Best> list12 = new List<Best>();
				Dictionary<string, string> dictionary3 = new Dictionary<string, string>();
				foreach (Tuple<int, double> item2 in list11.OrderByDescending((Tuple<int, double> c) => c.Item2).Take(80))
				{
					string key = resolved[item2.Item1].Key;
					Best best2 = null;
					string value6 = null;
					foreach (string item3 in list10)
					{
						Drawn drawn2 = null;
						try
						{
							drawn2 = Draw(hdc, resolved[item2.Item1].Value, item3);
							if (drawn2 != null)
							{
								Mask mask12 = Render(drawn2, num19, 48);
								double num27 = Mask.Similarity(mask5, mask12);
								Mask mask13 = Render(drawn2, Width(drawn2.Bounds, 96, 1920, 32), 96);
								List<int[]> list13 = MatchCore.InkRuns(mask13);
								List<int[]> list14 = MatchCore.Merged(list13, list9.Count) ?? ((MatchCore.Merged(list9, list13.Count) != null) ? list13 : null);
								List<int[]> list15 = ((list14 == null) ? null : ((list14.Count == list9.Count) ? list9 : MatchCore.Merged(list9, list14.Count)));
								if (list14 != null && list15 != null)
								{
									Mask b = func4(MatchCore.Reflow(mask13, list14, mask6.Width, list15));
									num27 = Math.Max(num27, Mask.Similarity(mask7, b));
									double? num28 = MatchCore.Forgiving(mask7, b, list14, list15, (double)mask7.Width / (double)mask6.Width);
									if (num28.HasValue)
									{
										num27 = Math.Max(num27, num28.Value - 0.02);
									}
								}
								Mask mask14 = MatchCore.Compacted(mask13);
								if (mask8 != null && mask14 != null)
								{
									num27 = Math.Max(num27, Mask.Similarity(mask8, mask14.Normalize(MatchCore.Whole(mask14), mask8.Width, mask8.Height)) - 0.03);
								}
								if (best2 == null || num27 > best2.Score)
								{
									best2 = new Best
									{
										Name = key,
										Score = num27,
										Mask = mask12
									};
									value6 = item3;
								}
							}
						}
						catch (ArgumentException)
						{
						}
						catch (ExternalException)
						{
						}
						finally
						{
							if (drawn2 != null && drawn2.Path != null) drawn2.Path.Dispose();
						}
					}
					if (best2 != null && (list12.Count < 5 || best2.Score > list12[list12.Count - 1].Score))
					{
						dictionary3[key] = value6;
						list12.Add(best2);
						list12 = list12.OrderByDescending((Best best3) => best3.Score).Take(5).ToList();
					}
				}
				string family = null;
				if (list12.Count > 0 && families.TryGetValue(list12[0].Name, out family))
				{
					Best first = list12[0];
					List<Best> list16 = list12.Where((Best best3) => best3.Score >= first.Score - 0.03 && families.ContainsKey(best3.Name) && families[best3.Name] == family).ToList();
					if (list16.Count >= 2)
					{
						Mask mask15 = mask4.Normalize(array8, Width(array8, 160, 3840, 32), 160);
						List<int[]> list17 = MatchCore.InkRuns(mask15);
						List<Tuple<string, double>> list18 = new List<Tuple<string, double>>();
						foreach (Best item4 in list16)
						{
								int value7; string value8;
							if (indexOf.TryGetValue(item4.Name, out value7) && dictionary3.TryGetValue(item4.Name, out value8))
							{
								Drawn drawn3 = null;
								try
								{
									drawn3 = Draw(hdc, resolved[value7].Value, value8);
									if (drawn3 != null)
									{
										Mask mask16 = Render(drawn3, Width(drawn3.Bounds, 160, 3840, 32), 160);
										List<int[]> list19 = MatchCore.InkRuns(mask16);
										List<int[]> list20 = MatchCore.Merged(list19, list17.Count) ?? ((MatchCore.Merged(list17, list19.Count) != null) ? list19 : null);
										List<int[]> list21 = ((list20 == null) ? null : ((list20.Count == list17.Count) ? list17 : MatchCore.Merged(list17, list20.Count)));
										if (list20 != null && list21 != null)
										{
											list18.Add(Tuple.Create(item4.Name, (item4.Score + Mask.Similarity(mask15, MatchCore.Reflow(mask16, list20, mask15.Width, list21))) / 2.0));
										}
									}
								}
								catch (ArgumentException)
								{
								}
								catch (ExternalException)
								{
								}
								finally
								{
									if (drawn3 != null && drawn3.Path != null) drawn3.Path.Dispose();
								}
							}
						}
						if (list18.Count == list16.Count)
						{
							double num29 = list18.Max((Tuple<string, double> tuple2) => tuple2.Item2);
							double score = first.Score;
							foreach (Tuple<string, double> s in list18)
							{
								list12.First((Best x) => x.Name == s.Item1).Score = score - (num29 - s.Item2);
							}
							list12 = list12.OrderByDescending((Best best3) => best3.Score).ToList();
						}
					}
				}
				string value9;
				return new Comparison
				{
					Best = list12,
					Count = num20,
					Original = mask5,
					Reading = ((list12.Count > 0 && dictionary3.TryGetValue(list12[0].Name, out value9)) ? value9 : null)
				};
			};
			Func<List<Best>, object[]> func = (List<Best> source) => ((IEnumerable<Best>)source).Select((Func<Best, object>)((Best b) => new
			{
				name = b.Name,
				family = (families.ContainsKey(b.Name) ? families[b.Name] : ""),
				similarity = b.Score,
				preview = Png(b.Mask)
			})).ToArray();
			List<object> list = new List<object>();
			for (int index = 0; index < lines.Length; index++)
			{
				Dictionary<string, object> dictionary = (Dictionary<string, object>)lines[index];
				string text2 = Json.String(dictionary, "text") ?? "";
				double num2;
				double num3;
				double num4;
				double num5;
				try
				{
					num2 = Json.Number(dictionary, "x");
					num3 = Json.Number(dictionary, "y");
					num4 = Json.Number(dictionary, "width");
					num5 = Json.Number(dictionary, "height");
				}
				catch (Exception)
				{
					num2 = (num3 = (num4 = (num5 = 0.0)));
				}
				if (text2.Length == 0 || text2.Length > 120 || num4 <= 0.0 || num5 <= 0.0)
				{
					list.Add(new
					{
						index = index,
						candidates = new object[0],
						compared = 0,
						original = "",
						warning = "单行最多 120 字，请分段匹配。"
					});
					continue;
				}
				bool flag = dictionary.ContainsKey("vertical") && dictionary["vertical"] is bool && (bool)dictionary["vertical"];
				double num6 = (flag ? (num4 * (double)width) : (num5 * (double)height));
				int num7 = (int)(num6 * 0.2);
				int num8 = (int)(num6 * 0.1);
				int num9 = Math.Max(0, (int)(num2 * (double)width) - num8);
				int num10 = Math.Max(0, (int)((1.0 - num3 - num5) * (double)height) - num7);
				int num11 = Math.Min(width, (int)Math.Ceiling((num2 + num4) * (double)width) + num8);
				int num12 = Math.Min(height, (int)Math.Ceiling((1.0 - num3) * (double)height) + num7);
				if (num11 <= num9 || num12 <= num10)
				{
					throw new Exception("文字行坐标超出图片。");
				}
				Mask mask2;
				if (array2 != null)
				{
					mask2 = MatchCore.InkMask(array2, width, num9, num10, num11, num12);
				}
				else
				{
					byte[] array3 = new byte[(num11 - num9) * (num12 - num10)];
					for (int num13 = num10; num13 < num12; num13++)
					{
						Buffer.BlockCopy(mask.Pixels, num13 * width + num9, array3, (num13 - num10) * (num11 - num9), num11 - num9);
					}
					mask2 = new Mask(num11 - num9, num12 - num10, array3);
				}
				Mask crop = (flag ? MatchCore.Columnar(mask2) : MatchCore.IsolatedLine(mask2));
				List<MatchCore.Segment> list2 = MatchCore.Segments(text2);
				bool flag2 = MatchCore.IsMixed(list2);
				Dictionary<int, int[]> dictionary2 = null;
				object value2; if (dictionary.TryGetValue("chars", out value2) && value2 is IEnumerable && !(value2 is string))
				{
					dictionary2 = new Dictionary<int, int[]>();
					foreach (object item5 in (IEnumerable)value2)
					{
						object[] array4 = ((item5 as IEnumerable) == null ? null : (item5 as IEnumerable).Cast<object>().ToArray());
						if (array4 != null && array4.Length == 4 && !array4.Any((object v) => v == null || v is string || v is bool))
						{
							double[] array5 = array4.Select((object v) => Convert.ToDouble(v, CultureInfo.InvariantCulture)).ToArray();
							if (!array5.Any((double v) => double.IsNaN(v) || double.IsInfinity(v)))
							{
								dictionary2[(int)array5[0]] = new int[2]
								{
									(int)(array5[2] * (double)width) - num9,
									(int)(array5[3] * (double)width) - num9
								};
							}
						}
					}
					if (dictionary2.Count == 0)
					{
						dictionary2 = null;
					}
				}
				int stages = ((!flag2) ? 1 : (3 + ((list2.Count <= 8) ? (from sg in list2
					group sg by sg.Script into g
					select g.Count() into n
					where n >= 2
					select n).Sum() : 0)));
				Comparison comparison = compare(crop, text2, null, index, 0, stages);
				if (comparison == null)
				{
					list.Add(new
					{
						index = index,
						candidates = new object[0],
						compared = 0,
						original = "",
						warning = "没有找到可比较的字形。"
					});
					continue;
				}
				List<Best> best = comparison.Best;
				// 字形校验:整行比较选出字体后,对落在形近字组里的字做单字掩码复核(混排行/竖排不做)。
				string verified = null;
				int corrections = 0;
				if (!flag2 && best.Count > 0 && indexOf.ContainsKey(best[0].Name))
				{
					verified = VerifyChars(hdc, resolved[indexOf[best[0].Name]].Value, crop, text2, dictionary2, out corrections);
					if (corrections > 0 && verified != null && verified.Length == text2.Length) text2 = verified;
				}
				List<object> parts = null;
				string text3 = null;
				string text4 = null;
				MatchCore.Cut cut = null;
				int value3;
					if (flag2 && best.Count > 0 && indexOf.TryGetValue(best[0].Name, out value3))
				{
					cut = MatchCore.SegmentPieces(crop, list2, GlyphSpans(hdc, resolved[value3].Value, text2), dictionary2);
				}
				if (cut != null)
				{
					List<MatchCore.Piece> pieces = cut.Pieces;
					Func<List<MatchCore.Piece>, Mask> mask3 = (List<MatchCore.Piece> pieces2) => MatchCore.JoinedMask(crop, cut.Bounds, pieces2);
					Func<List<MatchCore.Piece>, string> joinedText = (List<MatchCore.Piece> source) => string.Join(" ", source.Select((MatchCore.Piece pc) => pc.Segment.Text));
					Func<List<Best>, int[]> func2 = (List<Best> bs) => (from b in bs
						where b.Score >= bs[0].Score - 0.01 && indexOf.ContainsKey(b.Name)
						select indexOf[b.Name]).ToArray();
					bool flag3 = pieces.Count <= 8;
					int stage = 1;
					Func<List<MatchCore.Piece>, Comparison> func3 = delegate(List<MatchCore.Piece> arg3)
					{
						Comparison result = compare(mask3(arg3), joinedText(arg3), null, index, Math.Min(stage, stages - 1), stages);
						stage++;
						return result;
					};
					List<Tuple<MatchCore.Script, List<MatchCore.Piece>, Comparison>> list3 = new List<Tuple<MatchCore.Script, List<MatchCore.Piece>, Comparison>>();
					bool flag4 = true;
					MatchCore.Script[] array6 = new MatchCore.Script[2]
					{
						MatchCore.Script.Han,
						MatchCore.Script.Latin
					};
					foreach (MatchCore.Script kind in array6)
					{
						List<MatchCore.Piece> list4 = pieces.Where((MatchCore.Piece pc) => pc.Segment.Script == kind).ToList();
						Comparison comparison2 = ((list4.Count == 0) ? null : func3(list4));
						if (comparison2 == null || comparison2.Best.Count == 0)
						{
							flag4 = false;
							break;
						}
						List<Tuple<MatchCore.Piece, Comparison>> list5 = new List<Tuple<MatchCore.Piece, Comparison>>();
						bool flag5 = false;
						if (flag3 && list4.Count >= 2)
						{
							int[] arg = func2(comparison2.Best);
							List<double> list6 = new List<double>();
							foreach (MatchCore.Piece item6 in list4)
							{
								Comparison comparison3 = func3(new List<MatchCore.Piece> { item6 });
								if (comparison3 == null || comparison3.Best.Count == 0)
								{
									continue;
								}
								list5.Add(Tuple.Create(item6, comparison3));
								if (MatchCore.Scalars(item6.Segment.Text).Count((int v) => v > 65535 || !char.IsWhiteSpace((char)v)) >= ((kind == MatchCore.Script.Han) ? 2 : 3))
								{
									list6.Add(comparison3.Best[0].Score);
									Comparison comparison4 = compare(mask3(new List<MatchCore.Piece> { item6 }), item6.Segment.Text, arg, index, 0, 1);
									double num15 = ((comparison4 != null && comparison4.Best.Count > 0) ? comparison4.Best[0].Score : 0.0);
									string value4; families.TryGetValue(comparison3.Best[0].Name, out value4);
									string value5; families.TryGetValue(comparison2.Best[0].Name, out value5);
									if (comparison3.Best[0].Score - num15 >= 0.05 && value4 != value5)
									{
										flag5 = true;
									}
								}
							}
							if (list6.Count >= 2 && list6.Sum() / (double)list6.Count - comparison2.Best[0].Score >= 0.05)
							{
								flag5 = true;
							}
						}
						if (flag5 && list5.Count == list4.Count)
						{
							foreach (Tuple<MatchCore.Piece, Comparison> item7 in list5)
							{
								list3.Add(Tuple.Create(kind, new List<MatchCore.Piece> { item7.Item1 }, item7.Item2));
							}
						}
						else
						{
							list3.Add(Tuple.Create(kind, list4, comparison2));
						}
					}
					if (flag4 && list3.Any((Tuple<MatchCore.Script, List<MatchCore.Piece>, Comparison> g) => g.Item1 == MatchCore.Script.Latin))
					{
						int num16 = -1;
						for (int num17 = 0; num17 < list3.Count; num17++)
						{
							if (list3[num17].Item1 == MatchCore.Script.Han && (num16 < 0 || list3[num17].Item2.Sum((MatchCore.Piece pc) => pc.Segment.Length) > list3[num16].Item2.Sum((MatchCore.Piece pc) => pc.Segment.Length)))
							{
								num16 = num17;
							}
						}
						if (num16 >= 0)
						{
							int[] arg2 = func2(list3[num16].Item3.Best);
							text3 = list3[num16].Item3.Reading;
							text4 = joinedText(list3[num16].Item2);
							List<Tuple<bool, int, object>> list7 = new List<Tuple<bool, int, object>>();
							for (int num18 = 0; num18 < list3.Count; num18++)
							{
								Tuple<MatchCore.Script, List<MatchCore.Piece>, Comparison> tuple = list3[num18];
								string text5 = joinedText(tuple.Item2);
								double? mainSimilarity = null;
								if (num18 != num16)
								{
									Comparison comparison5 = compare(mask3(tuple.Item2), text5, arg2, index, 0, 1);
									if (comparison5 != null && comparison5.Best.Count > 0)
									{
										mainSimilarity = comparison5.Best[0].Score;
									}
								}
								List<Best> list8 = tuple.Item3.Best;
								if (tuple.Item1 == MatchCore.Script.Latin)
								{
									Func<string, bool> latinOnly = (string n) => indexOf.ContainsKey(n) && !WithFont(hdc, resolved[indexOf[n]].Value, () => HasGlyph(hdc, 20013));
									list8 = list8.OrderByDescending((Best b) => b.Score + (latinOnly(b.Name) ? 0.002 : 0.0)).ToList();
								}
								int[][] array7 = tuple.Item2.Select((MatchCore.Piece pc) => new int[2]
								{
									pc.Segment.Start,
									pc.Segment.Length
								}).ToArray();
								list7.Add(Tuple.Create(num18 == num16, array7[0][0], (object)new
								{
									script = ((tuple.Item1 == MatchCore.Script.Han) ? "han" : "latin"),
									ranges = array7,
									text = text5,
									candidates = func(list8),
									original = Png(tuple.Item3.Original),
									mainSimilarity = mainSimilarity,
									main = (num18 == num16)
								}));
							}
							parts = (from f in list7
								orderby (!f.Item1) ? 1 : 0, f.Item2
								select f.Item3).ToList();
						}
					}
				}
				string text6 = null;
				string text7 = Simplify(text2) ?? text2;
				if (text7 != text2 && text7.Length == text2.Length && (comparison.Reading == text7 || (text4 != null && text3 == (Simplify(text4) ?? text4))))
				{
					text6 = text7;
				}
				list.Add(new
				{
					index = index,
					candidates = func(best),
					compared = comparison.Count,
					original = Png(comparison.Original),
					warning = ((best.Count == 0) ? null : ((best[0].Score < 0.7) ? "相似度偏低，可能缺少原字体、字距不同或原稿有变形；请人工比较。" : "候选按字形相似度排序，不能据此确认原字体。")),
					parts = parts,
					text = (text6 ?? ((corrections > 0) ? text2 : null)),
					corrected = corrections
				});
			}
			return new
			{
				type = "result",
				ok = true,
				rows = list,
				requestedFonts = requested.Length,
				resolvedFonts = resolved.Count
			};
		}
	}
	internal static class GdiOutline
	{
		private struct Point
		{
			public int X;

			public int Y;
		}

		[DllImport("gdi32.dll")]
		private static extern bool BeginPath(IntPtr hdc);

		[DllImport("gdi32.dll")]
		private static extern bool EndPath(IntPtr hdc);

		[DllImport("gdi32.dll")]
		private static extern bool AbortPath(IntPtr hdc);

		[DllImport("gdi32.dll")]
		private static extern uint SetTextAlign(IntPtr hdc, uint align);

		[DllImport("gdi32.dll")]
		private static extern int SetBkMode(IntPtr hdc, int mode);

		[DllImport("gdi32.dll")]
		private static extern int GetPath(IntPtr hdc, [Out] Point[] points, [Out] byte[] types, int count);

		[DllImport("gdi32.dll", ExactSpelling = true)]
		private static extern bool GetCharWidthI(IntPtr hdc, uint first, uint count, [In] ushort[] glyphs, [Out] int[] widths);

		[DllImport("gdi32.dll", ExactSpelling = true)]
		private static extern bool ExtTextOutW(IntPtr hdc, int x, int y, uint options, IntPtr rect, [In] ushort[] glyphs, uint count, [In] int[] advances);

		internal static GraphicsPath Read(IntPtr hdc, ushort[] glyphs, float tracking, float em)
		{
			int[] array = null;
			if (Math.Abs(tracking) > 1E-05f)
			{
				array = new int[glyphs.Length];
				if (!GetCharWidthI(hdc, 0u, (uint)glyphs.Length, glyphs, array))
				{
					return null;
				}
				for (int i = 0; i < array.Length - 1; i++)
				{
					array[i] += (int)Math.Round(tracking * em);
				}
			}
			SetTextAlign(hdc, 24u);
			SetBkMode(hdc, 1);
			if (!BeginPath(hdc))
			{
				return null;
			}
			if (!ExtTextOutW(hdc, 0, 0, 16u, IntPtr.Zero, glyphs, (uint)glyphs.Length, array) || !EndPath(hdc))
			{
				AbortPath(hdc);
				return null;
			}
			int path = GetPath(hdc, null, null, 0);
			if (path < 1 || path > 500000)
			{
				AbortPath(hdc);
				return null;
			}
			Point[] array2 = new Point[path];
			byte[] array3 = new byte[path];
			if (GetPath(hdc, array2, array3, path) != path)
			{
				AbortPath(hdc);
				return null;
			}
			AbortPath(hdc);
			GraphicsPath graphicsPath = new GraphicsPath(FillMode.Winding);
			PointF pt = PointF.Empty;
			for (int j = 0; j < path; j++)
			{
				PointF pointF = new PointF(array2[j].X, array2[j].Y);
				int num = array3[j] & 6;
				if (num == 6)
				{
					graphicsPath.StartFigure();
					pt = pointF;
				}
				else if (num == 2)
				{
					graphicsPath.AddLine(pt, pointF);
					pt = pointF;
				}
				else
				{
					if (num != 4 || j + 2 >= path || (array3[j + 1] & 6) != 4 || (array3[j + 2] & 6) != 4)
					{
						graphicsPath.Dispose();
						return null;
					}
					PointF pt2 = new PointF(array2[j + 1].X, array2[j + 1].Y);
					PointF pointF2 = new PointF(array2[j + 2].X, array2[j + 2].Y);
					graphicsPath.AddBezier(pt, pointF, pt2, pointF2);
					j += 2;
					pt = pointF2;
				}
				if ((array3[j] & 1) != 0)
				{
					graphicsPath.CloseFigure();
				}
			}
			if (graphicsPath.PointCount == 0)
			{
				graphicsPath.Dispose();
				return null;
			}
			return graphicsPath;
		}
	}
	public static class Json
	{
		private static readonly object Gate = new object();

		private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer
		{
			MaxJsonLength = 50331648,
			RecursionLimit = 80
		};

		public static string Encode(object value)
		{
			lock (Gate)
			{
				return Serializer.Serialize(value);
			}
		}

		public static Dictionary<string, object> Object(string s)
		{
			lock (Gate)
			{
				return Serializer.Deserialize<Dictionary<string, object>>(s);
			}
		}

		public static string String(Dictionary<string, object> o, string key)
		{
			object value; if (!o.TryGetValue(key, out value))
			{
				return null;
			}
			return value as string;
		}

		public static object[] Array(Dictionary<string, object> o, string key)
		{
			object value; if (!o.TryGetValue(key, out value) || value is string || !(value is IEnumerable))
			{
				throw new Exception("参数无效：" + key);
			}
			List<object> list = new List<object>();
			foreach (object item in (IEnumerable)value)
			{
				list.Add(item);
			}
			return list.ToArray();
		}

		public static double Number(Dictionary<string, object> o, string key)
		{
			object value; if (!o.TryGetValue(key, out value) || value is string || value is bool || value == null)
			{
				throw new Exception("坐标格式无效。");
			}
			double num = Convert.ToDouble(value, CultureInfo.InvariantCulture);
			if (double.IsInfinity(num) || double.IsNaN(num))
			{
				throw new Exception("坐标无效。");
			}
			return num;
		}
	}
	public sealed class HostBridge
	{
		private readonly string source;

		private readonly string guard;

		private readonly string hostExecutable;

			private readonly int major;

			private readonly int parent;

			private readonly string toolsDir;

			public HostBridge(string resources, string host, int parentPid)
			{
				toolsDir = Path.Combine(resources, "host");
				source = File.ReadAllText(Path.Combine(toolsDir, "main.jsx"));
				guard = File.ReadAllText(Path.Combine(toolsDir, "guard.jsx"));
				hostExecutable = Path.GetFullPath(host);
				major = FileVersionInfo.GetVersionInfo(host).FileMajorPart;
				parent = parentPid;
				if (major < 24)
				{
					throw new Exception("YunLi 支持 Illustrator 2020（24）及以上版本。");
				}
			}

		[DllImport("ole32.dll")]
		private static extern int GetRunningObjectTable(int reserved, out IRunningObjectTable table);

		[DllImport("ole32.dll")]
		private static extern int CreateBindCtx(int reserved, out IBindCtx context);

		private object Connect()
		{
			string[] array = new string[2]
			{
				"Illustrator.Application." + major,
				"Illustrator.Application"
			};
			foreach (string progID in array)
			{
				try
				{
					return Marshal.GetActiveObject(progID);
				}
				catch (COMException)
				{
				}
			}
			object obj = FromRunningObjects();
			if (obj != null)
			{
				return obj;
			}
			throw new Exception("无法连接 Illustrator（系统中找不到 Illustrator 的脚本接口）。请先关闭 Illustrator，右键「以管理员身份运行」打开一次后再重试；若仍不行，请用 Creative Cloud 修复或重新安装 Illustrator。");
		}

		private object FromRunningObjects()
		{
			IRunningObjectTable table; IBindCtx context; if (GetRunningObjectTable(0, out table) != 0 || CreateBindCtx(0, out context) != 0)
			{
				return null;
			}
			IEnumMoniker ppenumMoniker; table.EnumRunning(out ppenumMoniker);
			if (ppenumMoniker == null)
			{
				return null;
			}
			IMoniker[] array = new IMoniker[1];
			try
			{
				while (ppenumMoniker.Next(1, array, IntPtr.Zero) == 0)
				{
					IMoniker moniker = array[0];
					object ppunkObject = null;
					try
					{
						string ppszDisplayName; moniker.GetDisplayName(context, null, out ppszDisplayName);
						if (ppszDisplayName == null || !ppszDisplayName.StartsWith("!{") || table.GetObject(moniker, out ppunkObject) != 0 || ppunkObject == null || !IsThisIllustrator(ppunkObject))
						{
							continue;
						}
						object result = ppunkObject;
						ppunkObject = null;
						return result;
					}
					catch (Exception)
					{
					}
					finally
					{
						if (ppunkObject != null && Marshal.IsComObject(ppunkObject))
						{
							Marshal.ReleaseComObject(ppunkObject);
						}
						Marshal.ReleaseComObject(moniker);
					}
				}
			}
			finally
			{
				Marshal.ReleaseComObject(ppenumMoniker);
				Marshal.ReleaseComObject(context);
				Marshal.ReleaseComObject(table);
			}
			return null;
		}

		private bool IsThisIllustrator(object o)
		{
			try
			{
				Type type = o.GetType();
				string text = type.InvokeMember("Name", BindingFlags.GetProperty, null, o, null) as string;
				string text2 = type.InvokeMember("Version", BindingFlags.GetProperty, null, o, null) as string;
				return text != null && text.IndexOf("Illustrator", StringComparison.OrdinalIgnoreCase) >= 0 && text2 != null && text2.Split('.')[0] == major.ToString();
			}
			catch (Exception)
			{
				return false;
			}
		}

			public Task<object> Execute(string action, Dictionary<string, object> payload)
			{
				string text = Json.Encode(action);
				string text2 = Json.Encode(Uri.EscapeDataString(Json.Encode(payload)));
				string text3 = Json.Encode(hostExecutable);
				// 自有常驻引擎;标记跟随核心版本,改宿主脚本后自动重新注入。
				// ExtendScript 不允许引擎脚本顶层 return(Error 30),哨兵必须用 throw。
				string script = "#targetengine \"yunli-font\"\n" + guard + "\nYunLiCheckHost(" + major + "," + text3 + ");\nif(typeof YunLiFontBuild==='undefined'||YunLiFontBuild!=='" + Program.Version + "'){\n" + source + "\nvar YunLiFontBuild='" + Program.Version + "';}\nif(typeof TextRevive==='undefined'){throw new Error(\"字体桥未注入：yunli-font 引擎初始化失败，请重启 Illustrator\");}\nTextRevive.dispatch(" + text + "," + text2 + ");";
				return RunInIllustrator(script);
			}

			public Task<object> ExecuteTool(string action, Dictionary<string, object> payload)
			{
				string tools = File.ReadAllText(Path.Combine(toolsDir, "dispatch.jsx"));
				// 宿主脚本更新后也要重新注入，避免常驻引擎仍使用没有预览能力的旧代码。
				string toolsBuild;
				using (var hash = System.Security.Cryptography.SHA256.Create())
					toolsBuild = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(tools))).Replace("-", "");
				string script = "#targetengine \"yunli-tools\"\n" + guard + "\nYunLiCheckHost(" + major + "," + Json.Encode(hostExecutable) + ");\nvar YUNLI_HOST_DIR = " + Json.Encode(toolsDir) + ";\nif(typeof YunLiToolsBuild==='undefined'||YunLiToolsBuild!=='" + toolsBuild + "'){$.evalFile(new File(YUNLI_HOST_DIR+'/json2.jsx'));}\nif(typeof YunLiToolsBuild==='undefined'||YunLiToolsBuild!=='" + toolsBuild + "'){\n" + tools + "\nvar YunLiToolsBuild='" + toolsBuild + "';}\nif(typeof YunLiTools==='undefined'){throw new Error(\"工具桥未注入\");}\nYunLiTools.dispatch(" + Json.Encode(action) + "," + Json.Encode(Uri.EscapeDataString(Json.Encode(payload ?? new Dictionary<string, object>()))) + ");";
				return RunInIllustrator(script);
			}

			private Task<object> RunInIllustrator(string script)
			{
				string text4 = script.Replace("\u2028", "\\u2028").Replace("\u2029", "\\u2029");
				TaskCompletionSource<object> completion = new TaskCompletionSource<object>();
				Thread thread = new Thread((ThreadStart)delegate
				{
					object obj = null;
					try
					{
						if (Process.GetProcessById(parent).HasExited)
						{
							throw new Exception("Illustrator 已退出。");
						}
						obj = Connect();
						string text5 = null;
						Stopwatch watch = Stopwatch.StartNew();
						int num = 0;
						while (true)
						{
							try
							{
								text5 = (string)obj.GetType().InvokeMember("DoJavaScript", BindingFlags.InvokeMethod | BindingFlags.OptionalParamBinding, null, obj, new object[3]
								{
									text4,
									Type.Missing,
									Type.Missing
								});
							}
							catch (TargetInvocationException ex)
							{
								COMException ex2 = ex.InnerException as COMException; if (ex2 == null || (ex2.ErrorCode != -2147418111 && ex2.ErrorCode != -2147417846) || num >= 5)
								{
									YunLi.Core.Program.Log("doscript-fail " + watch.ElapsedMilliseconds + "ms " + (ex.InnerException != null ? ex.InnerException.Message : ex.Message));
									throw ex.InnerException ?? ex;
								}
								Thread.Sleep(300);
								goto IL_019f;
							}
							break;
							IL_019f:
							num++;
						}
						watch.Stop();
						YunLi.Core.Program.Log("doscript-ok " + watch.ElapsedMilliseconds + "ms reply=" + (text5 == null ? "null" : (text5.Length > 120 ? text5.Substring(0, 120) : text5)));
						Dictionary<string, object> dictionary = Json.Object(text5);
						if (!dictionary.ContainsKey("ok") || !(dictionary["ok"] is bool) || !(bool)dictionary["ok"])
						{
							throw new Exception(Json.String(dictionary, "error") ?? "Illustrator 文档操作未完成。");
						}
						completion.SetResult(dictionary.ContainsKey("data") ? dictionary["data"] : new object());
					}
					catch (Exception exception)
					{
						completion.SetException(exception);
					}
					finally
					{
						if (obj != null && Marshal.IsComObject(obj))
						{
							Marshal.ReleaseComObject(obj);
						}
					}
				});
				thread.IsBackground = true;
				thread.SetApartmentState(ApartmentState.STA);
				thread.Start();
				return completion.Task;
			}
		}
	public sealed class Mask
	{
		public readonly int Width;

		public readonly int Height;

		public readonly byte[] Pixels;

		public Mask(int w, int h, byte[] pixels)
		{
			if (w < 1 || h < 1 || pixels.Length != checked(w * h))
			{
				throw new ArgumentException("Invalid mask");
			}
			Width = w;
			Height = h;
			Pixels = pixels;
		}

		public int[] Tight()
		{
			int num = Width;
			int num2 = -1;
			int num3 = Height;
			int num4 = -1;
			for (int i = 0; i < Height; i++)
			{
				for (int j = 0; j < Width; j++)
				{
					if (Pixels[i * Width + j] < 170)
					{
						num = Math.Min(num, j);
						num2 = Math.Max(num2, j);
						num3 = Math.Min(num3, i);
						num4 = Math.Max(num4, i);
					}
				}
			}
			if (num2 >= num)
			{
				return new int[4]
				{
					num,
					num3,
					num2 - num + 1,
					num4 - num3 + 1
				};
			}
			return null;
		}

		public Mask Normalize(int[] rect, int w, int h)
		{
			byte[] array = new byte[checked(w * h)];
			int[] array2 = new int[w];
			int[] array3 = new int[w];
			for (int i = 0; i < w; i++)
			{
				array2[i] = Math.Max(0, Math.Min(Width - 1, (int)((double)rect[0] + ((double)i + 0.25) * (double)rect[2] / (double)w)));
				array3[i] = Math.Max(0, Math.Min(Width - 1, (int)((double)rect[0] + ((double)i + 0.75) * (double)rect[2] / (double)w)));
			}
			for (int j = 0; j < h; j++)
			{
				int num = Math.Max(0, Math.Min(Height - 1, (int)((double)rect[1] + ((double)j + 0.25) * (double)rect[3] / (double)h))) * Width;
				int num2 = Math.Max(0, Math.Min(Height - 1, (int)((double)rect[1] + ((double)j + 0.75) * (double)rect[3] / (double)h))) * Width;
				for (int k = 0; k < w; k++)
				{
					array[j * w + k] = (byte)((Pixels[num + array2[k]] + Pixels[num + array3[k]] + Pixels[num2 + array2[k]] + Pixels[num2 + array3[k]]) / 4);
				}
			}
			return new Mask(w, h, array);
		}

		public Mask[] SplitIdeographs(int count)
		{
			if (count < 2 || count > 40 || Width < count * 4)
			{
				return null;
			}
			int[] array = new int[Width];
			for (int i = 0; i < Width; i++)
			{
				for (int j = 0; j < Height; j++)
				{
					if (Pixels[j * Width + i] < 170)
					{
						array[i]++;
					}
				}
			}
			int[] array2 = new int[count + 1];
			array2[count] = Width;
			double num = (double)Width / (double)count;
			for (int k = 1; k < count; k++)
			{
				double num2 = (double)k * num;
				double num3 = double.MaxValue;
				int num4 = -1;
				for (int l = Math.Max(array2[k - 1] + 2, (int)(num2 - num * 0.27)); (double)l < Math.Min(Width - 1, num2 + num * 0.27); l++)
				{
					double num5 = (double)(array[l] + array[l - 1]) + Math.Abs((double)l - num2) * 0.035;
					if (num5 < num3)
					{
						num3 = num5;
						num4 = l;
					}
				}
				if (num4 < 0 || (double)(array[num4] + array[num4 - 1]) > (double)Height * 0.24)
				{
					return null;
				}
				array2[k] = num4;
			}
			Mask[] array3 = new Mask[count];
			for (int m = 0; m < count; m++)
			{
				int num6 = array2[m];
				int num7 = array2[m + 1] - 1;
				int num8 = Height;
				int num9 = -1;
				for (int n = 0; n < Height; n++)
				{
					for (int num10 = num6; num10 <= num7; num10++)
					{
						if (Pixels[n * Width + num10] < 170)
						{
							num8 = Math.Min(num8, n);
							num9 = Math.Max(num9, n);
						}
					}
				}
				if (num9 < num8)
				{
					return null;
				}
				int num11 = num7;
				int num12 = num6;
				for (int num13 = num6; num13 <= num7; num13++)
				{
					for (int num14 = num8; num14 <= num9; num14++)
					{
						if (Pixels[num14 * Width + num13] < 170)
						{
							num11 = Math.Min(num11, num13);
							num12 = Math.Max(num12, num13);
						}
					}
				}
				array3[m] = Normalize(new int[4]
				{
					num11,
					num8,
					num12 - num11 + 1,
					num9 - num8 + 1
				}, 32, 48);
			}
			return array3;
		}

		private float[] Distances()
		{
			float[] array = new float[Pixels.Length];
			for (int i = 0; i < array.Length; i++)
			{
				array[i] = ((Pixels[i] >= 170) ? 1000 : 0);
			}
			for (int j = 0; j < Height; j++)
			{
				for (int k = 0; k < Width; k++)
				{
					int num = j * Width + k;
					if (k > 0)
					{
						array[num] = Math.Min(array[num], array[num - 1] + 1f);
					}
					if (j > 0)
					{
						array[num] = Math.Min(array[num], array[num - Width] + 1f);
						if (k > 0)
						{
							array[num] = Math.Min(array[num], array[num - Width - 1] + 1.414f);
						}
						if (k + 1 < Width)
						{
							array[num] = Math.Min(array[num], array[num - Width + 1] + 1.414f);
						}
					}
				}
			}
			for (int num2 = Height - 1; num2 >= 0; num2--)
			{
				for (int num3 = Width - 1; num3 >= 0; num3--)
				{
					int num4 = num2 * Width + num3;
					if (num3 + 1 < Width)
					{
						array[num4] = Math.Min(array[num4], array[num4 + 1] + 1f);
					}
					if (num2 + 1 < Height)
					{
						array[num4] = Math.Min(array[num4], array[num4 + Width] + 1f);
						if (num3 > 0)
						{
							array[num4] = Math.Min(array[num4], array[num4 + Width - 1] + 1.414f);
						}
						if (num3 + 1 < Width)
						{
							array[num4] = Math.Min(array[num4], array[num4 + Width + 1] + 1.414f);
						}
					}
				}
			}
			return array;
		}

		public static double ShapeSimilarity(Mask a, Mask b)
		{
			double num = Similarity(a, b);
			float[] array = a.Distances();
			float[] array2 = b.Distances();
			double num2 = 0.0;
			double num3 = 0.0;
			double num4 = 0.0;
			double num5 = 0.0;
			for (int i = 0; i < a.Pixels.Length; i++)
			{
				double num6 = (double)(255 - a.Pixels[i]) / 255.0;
				double num7 = (double)(255 - b.Pixels[i]) / 255.0;
				num4 += num6;
				num5 += num7;
				num2 += num6 * (double)Math.Max(0f, 1f - array2[i] / 3f);
				num3 += num7 * (double)Math.Max(0f, 1f - array[i] / 3f);
			}
			if (num4 == 0.0 || num5 == 0.0)
			{
				return 0.0;
			}
			double num8 = Math.Sqrt(Math.Min(num4, num5) / Math.Max(num4, num5));
			return 0.8 * num + 0.1 * (num2 / num4 + num3 / num5) * num8;
		}

		public static double Similarity(Mask a, Mask b)
		{
			if (a.Width != b.Width || a.Height != b.Height)
			{
				throw new ArgumentException("Mask dimensions differ");
			}
			double num = 0.0;
			for (int i = -1; i <= 1; i++)
			{
				for (int j = -1; j <= 1; j++)
				{
					long num2 = 0L;
					long num3 = 0L;
					for (int k = 0; k < a.Height; k++)
					{
						for (int l = 0; l < a.Width; l++)
						{
							int val = 255 - a.Pixels[k * a.Width + l];
							int num4 = l + j;
							int num5 = k + i;
							int val2 = ((num4 >= 0 && num5 >= 0 && num4 < b.Width && num5 < b.Height) ? (255 - b.Pixels[num5 * b.Width + num4]) : 0);
							num2 += Math.Min(val, val2);
							num3 += Math.Max(val, val2);
						}
					}
					if (num3 > 0)
					{
						num = Math.Max(num, (double)num2 / (double)num3);
					}
				}
			}
			return num;
		}
	}
	public static class MatchCore
	{
		public enum Script
		{
			Han,
			Latin,
			Neutral
		}

		public sealed class Segment
		{
			public Script Script;

			public int Start;

			public int Length;

			public string Text;
		}

		public sealed class Piece
		{
			public Segment Segment;

			public int Left;

			public int Right;
		}

		public sealed class Cut
		{
			public int[] Bounds;

			public List<Piece> Pieces;
		}

		private static readonly int[] Dots = new int[7] { 183, 12539, 8226, 8231, 8729, 8901, 65381 };

		private static readonly int[] Dashes = new int[6] { 45, 8210, 8211, 8212, 8213, 65293 };

		public static int[] Whole(Mask m)
		{
			return new int[4] { 0, 0, m.Width, m.Height };
		}

		public static Mask InkMask(byte[] pixels, int stride, int x, int y, int right, int bottom)
		{
			int num = right - x;
			int num2 = bottom - y;
			List<int>[] edge = new List<int>[3]
			{
				new List<int>(),
				new List<int>(),
				new List<int>()
			};
			Action<int, int> action = delegate(int px, int py)
			{
				int num22 = (py * stride + px) * 4;
				for (int i = 0; i < 3; i++)
				{
					edge[i].Add(pixels[num22 + i]);
				}
			};
			for (int num3 = x; num3 < right; num3++)
			{
				action(num3, y);
				action(num3, bottom - 1);
			}
			for (int num4 = y; num4 < bottom; num4++)
			{
				action(x, num4);
				action(right - 1, num4);
			}
			int[] array = edge.Select(delegate(List<int> e)
			{
				List<int> list = e.OrderBy((int v) => v).ToList();
				return list[list.Count / 2];
			}).ToArray();
			byte[] array2 = new byte[num * num2];
			int[] array3 = new int[256];
			for (int num5 = 0; num5 < num2; num5++)
			{
				for (int num6 = 0; num6 < num; num6++)
				{
					int num7 = ((y + num5) * stride + x + num6) * 4;
					double num8 = pixels[num7] - array[0];
					double num9 = pixels[num7 + 1] - array[1];
					double num10 = pixels[num7 + 2] - array[2];
					array3[array2[num5 * num + num6] = (byte)Math.Min(255.0, Math.Sqrt(num8 * num8 + num9 * num9 + num10 * num10) * 255.0 / 441.7)]++;
				}
			}
			double num11 = num * num2;
			double num12 = 0.0;
			for (int num13 = 0; num13 < 256; num13++)
			{
				num12 += (double)(num13 * array3[num13]);
			}
			double num14 = 0.0;
			double num15 = 0.0;
			double num16 = 0.0;
			int val = 0;
			for (int num17 = 0; num17 < 256; num17++)
			{
				num14 += (double)array3[num17];
				if (num14 != 0.0 && num14 != num11)
				{
					num15 += (double)(num17 * array3[num17]);
					double num18 = num15 / num14;
					double num19 = (num12 - num15) / (num11 - num14);
					double num20 = num14 * (num11 - num14) * (num18 - num19) * (num18 - num19);
					if (num20 > num16)
					{
						num16 = num20;
						val = num17;
					}
				}
			}
			double num21 = Math.Max(val, 24);
			double lo = num21 * 0.6;
			double hi = Math.Min(255.0, num21 * 1.4 + 1.0);
			byte[] pixels2 = array2.Select(delegate(byte d)
			{
				double val2 = ((double)(int)d - lo) / (hi - lo);
				return (byte)(255.0 * (1.0 - Math.Min(1.0, Math.Max(0.0, val2))));
			}).ToArray();
			return new Mask(num, num2, pixels2);
		}

		public static Mask IsolatedLine(Mask mask)
		{
			int[] array = new int[mask.Height];
			for (int i = 0; i < mask.Height; i++)
			{
				for (int j = 0; j < mask.Width; j++)
				{
					if (mask.Pixels[i * mask.Width + j] < 170)
					{
						array[i]++;
					}
				}
			}
			int num = Math.Max(2, mask.Height / 20);
			List<int[]> list = new List<int[]>();
			int num2 = -1;
			int num3 = -1;
			int num4 = 0;
			for (int k = 0; k < array.Length; k++)
			{
				if (array[k] != 0)
				{
					if (num2 >= 0 && k - num3 > num)
					{
						list.Add(new int[3] { num2, num3, num4 });
						num2 = -1;
					}
					if (num2 < 0)
					{
						num2 = k;
						num4 = 0;
					}
					num3 = k;
					num4 += array[k];
				}
			}
			if (num2 >= 0)
			{
				list.Add(new int[3] { num2, num3, num4 });
			}
			if (list.Count < 2)
			{
				return mask;
			}
			int[] array2 = list[0];
			foreach (int[] item in list)
			{
				if (item[2] > array2[2])
				{
					array2 = item;
				}
			}
			if (array2[1] - array2[0] + 1 < mask.Height * 3 / 10)
			{
				return mask;
			}
			byte[] array3 = (byte[])mask.Pixels.Clone();
			for (int l = 0; l < mask.Height; l++)
			{
				if (l < array2[0] || l > array2[1])
				{
					for (int m = 0; m < mask.Width; m++)
					{
						array3[l * mask.Width + m] = byte.MaxValue;
					}
				}
			}
			return new Mask(mask.Width, mask.Height, array3);
		}

		public static Mask Columnar(Mask mask)
		{
			int width = mask.Width;
			int height = mask.Height;
			int[] array = new int[width];
			for (int i = 0; i < width; i++)
			{
				for (int j = 0; j < height; j++)
				{
					if (mask.Pixels[j * width + i] < 170)
					{
						array[i]++;
					}
				}
			}
			List<int[]> list = new List<int[]>();
			int num = -1;
			for (int k = 0; k <= width; k++)
			{
				if (k < width && array[k] > 0)
				{
					if (num < 0)
					{
						num = k;
					}
				}
				else if (num >= 0)
				{
					list.Add(new int[2]
					{
						num,
						k - 1
					});
					num = -1;
				}
			}
			List<int[]> list2 = new List<int[]>();
			foreach (int[] item in list)
			{
				int[] array2 = ((list2.Count > 0) ? list2[list2.Count - 1] : null);
				if (array2 != null && (double)(item[0] - array2[1] - 1) < 0.25 * (double)Math.Max(item[1] - item[0] + 1, array2[1] - array2[0] + 1))
				{
					array2[1] = item[1];
					continue;
				}
				list2.Add(new int[2]
				{
					item[0],
					item[1]
				});
			}
			if (list2.Count == 0)
			{
				return mask;
			}
			int[] array3 = list2[0];
			int num2 = -1;
			foreach (int[] item2 in list2)
			{
				int num3 = 0;
				for (int l = item2[0]; l <= item2[1]; l++)
				{
					num3 += array[l];
				}
				if (num3 > num2)
				{
					num2 = num3;
					array3 = item2;
				}
			}
			int num4 = array3[1] - array3[0] + 1;
			List<int[]> list3 = new List<int[]>();
			int num5 = -1;
			for (int m = 0; m <= height; m++)
			{
				bool flag = false;
				if (m < height)
				{
					for (int n = array3[0]; n <= array3[1]; n++)
					{
						if (mask.Pixels[m * width + n] < 170)
						{
							flag = true;
							break;
						}
					}
				}
				if (flag)
				{
					if (num5 < 0)
					{
						num5 = m;
					}
				}
				else if (num5 >= 0)
				{
					list3.Add(new int[2]
					{
						num5,
						m - 1
					});
					num5 = -1;
				}
			}
			List<int[]> list4 = new List<int[]>();
			foreach (int[] item3 in list3)
			{
				int[] array4 = ((list4.Count > 0) ? list4[list4.Count - 1] : null);
				if (array4 != null && (double)(item3[1] - array4[0] + 1) <= 1.15 * (double)num4)
				{
					array4[1] = item3[1];
					continue;
				}
				list4.Add(new int[2]
				{
					item3[0],
					item3[1]
				});
			}
			if (list4.Count == 0)
			{
				return mask;
			}
			int num6 = 0;
			foreach (int[] item4 in list4)
			{
				num6 = Math.Max(num6, item4[1] - item4[0] + 1);
			}
			int num7 = Math.Max(1, (int)((double)num4 * 0.15));
			int num8 = num7 + list4.Count * (num4 + num7);
			int num9 = num6 + 2 * num7;
			byte[] array5 = new byte[num8 * num9];
			for (int num10 = 0; num10 < array5.Length; num10++)
			{
				array5[num10] = byte.MaxValue;
			}
			int num11 = num7;
			foreach (int[] item5 in list4)
			{
				int num12 = item5[1] - item5[0] + 1;
				int num13 = num7 + (num6 - num12) / 2;
				for (int num14 = 0; num14 < num12; num14++)
				{
					for (int num15 = 0; num15 < num4; num15++)
					{
						array5[(num13 + num14) * num8 + num11 + num15] = mask.Pixels[(item5[0] + num14) * width + array3[0] + num15];
					}
				}
				num11 += num4 + num7;
			}
			return new Mask(num8, num9, array5);
		}

		private static bool InkColumn(Mask m, int x)
		{
			for (int i = 0; i < m.Height; i++)
			{
				if (m.Pixels[i * m.Width + x] < 215)
				{
					return true;
				}
			}
			return false;
		}

		public static Mask Compacted(Mask mask)
		{
			List<int> list = new List<int>();
			for (int i = 0; i < mask.Width; i++)
			{
				if (InkColumn(mask, i))
				{
					list.Add(i);
				}
			}
			if (list.Count < 4)
			{
				return null;
			}
			byte[] array = new byte[list.Count * mask.Height];
			int num = 0;
			for (int j = 0; j < mask.Height; j++)
			{
				foreach (int item in list)
				{
					array[num++] = mask.Pixels[j * mask.Width + item];
				}
			}
			return new Mask(list.Count, mask.Height, array);
		}

		public static List<int[]> InkRuns(Mask mask)
		{
			List<int[]> list = new List<int[]>();
			int num = -1;
			for (int i = 0; i <= mask.Width; i++)
			{
				bool flag = i < mask.Width && InkColumn(mask, i);
				if (flag && num < 0)
				{
					num = i;
				}
				else if (!flag && num >= 0)
				{
					list.Add(new int[2] { num, i });
					num = -1;
				}
			}
			return list;
		}

		public static List<int[]> Merged(List<int[]> runs, int count)
		{
			if (runs.Count < count || runs.Count - count > Math.Max(1, count / 8))
			{
				return null;
			}
			List<int[]> list = runs.Select((int[] r) => new int[2]
			{
				r[0],
				r[1]
			}).ToList();
			while (list.Count > count)
			{
				int num = 0;
				for (int num2 = 1; num2 < list.Count - 1; num2++)
				{
					if (list[num2 + 1][0] - list[num2][1] < list[num + 1][0] - list[num][1])
					{
						num = num2;
					}
				}
				list[num] = new int[2]
				{
					list[num][0],
					list[num + 1][1]
				};
				list.RemoveAt(num + 1);
			}
			return list;
		}

		public static Mask Reflow(Mask mask, List<int[]> runs, int width, List<int[]> targets)
		{
			byte[] array = new byte[width * mask.Height];
			for (int i = 0; i < array.Length; i++)
			{
				array[i] = byte.MaxValue;
			}
			for (int j = 0; j < Math.Min(runs.Count, targets.Count); j++)
			{
				int[] array2 = runs[j];
				int[] array3 = targets[j];
				int num = (array3[0] + array3[1]) / 2 - (array2[1] - array2[0]) / 2;
				for (int k = array2[0]; k < array2[1]; k++)
				{
					int num2 = num + k - array2[0];
					if (num2 < 0 || num2 >= width)
					{
						continue;
					}
					for (int l = 0; l < mask.Height; l++)
					{
						byte b = mask.Pixels[l * mask.Width + k];
						if (b < array[l * width + num2])
						{
							array[l * width + num2] = b;
						}
					}
				}
			}
			return new Mask(width, mask.Height, array);
		}

		public static double? Forgiving(Mask a, Mask b, List<int[]> runs, List<int[]> onto, double scale)
		{
			if (runs.Count != onto.Count || runs.Count < 5)
			{
				return null;
			}
			List<long[]> list = new List<long[]>();
			for (int i = 0; i < runs.Count; i++)
			{
				int[] array = runs[i];
				int[] array2 = onto[i];
				int num = (array2[0] + array2[1]) / 2 - (array[1] - array[0]) / 2;
				int num2 = Math.Max(0, (int)((double)Math.Min(array2[0], num) * scale) - 1);
				int val = Math.Min(a.Width, (int)Math.Ceiling((double)Math.Max(array2[1], num + array[1] - array[0]) * scale) + 1);
				long num3 = 0L;
				long num4 = 0L;
				for (int j = 0; j < a.Height; j++)
				{
					for (int k = num2; k < Math.Max(num2, val); k++)
					{
						int val2 = 255 - a.Pixels[j * a.Width + k];
						int val3 = 255 - b.Pixels[j * b.Width + k];
						num3 += Math.Min(val2, val3);
						num4 += Math.Max(val2, val3);
					}
				}
				list.Add(new long[2] { num3, num4 });
			}
			Func<long[], double> func = (long[] p) => (p[1] <= 0) ? 1.0 : ((double)p[0] / (double)p[1]);
			int num5 = 0;
			for (int num6 = 1; num6 < list.Count; num6++)
			{
				if (func(list[num6]) < func(list[num5]))
				{
					num5 = num6;
				}
			}
			long num7 = 0L;
			long num8 = 0L;
			for (int num9 = 0; num9 < list.Count; num9++)
			{
				if (num9 != num5)
				{
					num7 += list[num9][0];
					num8 += list[num9][1];
				}
			}
			if (num8 <= 0)
			{
				return null;
			}
			return (double)num7 / (double)num8;
		}

		private static string Mapped(string text, int dot, int dash)
		{
			StringBuilder stringBuilder = new StringBuilder();
			foreach (int item in Scalars(text))
			{
				int utf = item;
				if (dot > 0 && Array.IndexOf(Dots, item) >= 0)
				{
					utf = dot;
				}
				else if (dash > 0 && Array.IndexOf(Dashes, item) >= 0)
				{
					utf = dash;
				}
				stringBuilder.Append(char.ConvertFromUtf32(utf));
			}
			return stringBuilder.ToString();
		}

		public static List<string> Variants(string text, Func<string, string> simplify)
		{
			List<string> list = new List<string> { text };
			string text2 = simplify == null ? null : simplify.Invoke(text);
			if (text2 != null && text2 != text)
			{
				list.Add(text2);
			}
			string[] array = new string[5]
			{
				Mapped(text, 183, 0),
				Mapped(text, 8226, 0),
				Mapped(text, 0, 8212),
				Mapped(text, 0, 45),
				Mapped(text, 183, 8212)
			};
			foreach (string item in array)
			{
				if (!list.Contains(item))
				{
					list.Add(item);
				}
			}
			return list;
		}

		public static double Overlap(Mask a, Mask b)
		{
			long num = 0L;
			long num2 = 0L;
			for (int i = 0; i < a.Pixels.Length; i++)
			{
				int val = 255 - a.Pixels[i];
				int val2 = 255 - b.Pixels[i];
				num += Math.Min(val, val2);
				num2 += Math.Max(val, val2);
			}
			if (num2 <= 0)
			{
				return 0.0;
			}
			return (double)num / (double)num2;
		}

		public static IEnumerable<int> Scalars(string text)
		{
			for (int i = 0; i < text.Length; i++)
			{
				if (char.IsHighSurrogate(text[i]) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
				{
					yield return char.ConvertToUtf32(text[i], text[i + 1]);
					i++;
				}
				else
				{
					yield return text[i];
				}
			}
		}

		public static bool IsHan(int v)
		{
			if (v >= 13312)
			{
				return v <= 40959;
			}
			return false;
		}

		public static bool LetterOrNumber(int v)
		{
			if (v > 65535)
			{
				return true;
			}
			UnicodeCategory unicodeCategory = CharUnicodeInfo.GetUnicodeCategory((char)v);
			if (!char.IsLetter((char)v) && unicodeCategory != UnicodeCategory.DecimalDigitNumber && unicodeCategory != UnicodeCategory.LetterNumber)
			{
				return unicodeCategory == UnicodeCategory.OtherNumber;
			}
			return true;
		}

		public static Script ScriptOf(int v)
		{
			if ((v >= 13312 && v <= 40959) || (v >= 63744 && v <= 64255) || (v >= 131072 && v <= 262143) || (v >= 12352 && v <= 12543) || (v >= 44032 && v <= 55215) || (v >= 12289 && v <= 12351) || (v >= 65281 && v <= 65519))
			{
				return Script.Han;
			}
			if ((v >= 33 && v <= 126) || (v >= 192 && v <= 591))
			{
				return Script.Latin;
			}
			return Script.Neutral;
		}

		public static List<Segment> Segments(string text)
		{
			List<Segment> list = new List<Segment>();
			int num = 0;
			StringBuilder stringBuilder = new StringBuilder();
			Segment segment = null;
			int num2 = 0;
			StringBuilder stringBuilder2 = null;
			foreach (int item in Scalars(text))
			{
				Script script = ScriptOf(item);
				int num3 = ((item <= 65535) ? 1 : 2);
				if (script == Script.Neutral)
				{
					if (segment != null)
					{
						stringBuilder.Append(char.ConvertFromUtf32(item));
					}
					num += num3;
					continue;
				}
				if (segment != null && segment.Script == script)
				{
					stringBuilder2.Append(stringBuilder).Append(char.ConvertFromUtf32(item));
					num2 = num + num3;
					stringBuilder.Clear();
					num += num3;
					continue;
				}
				if (segment != null)
				{
					segment.Length = num2 - segment.Start;
					segment.Text = stringBuilder2.ToString();
					list.Add(segment);
				}
				segment = new Segment
				{
					Script = script,
					Start = num
				};
				num2 = num + num3;
				stringBuilder2 = new StringBuilder(char.ConvertFromUtf32(item));
				stringBuilder.Clear();
				num += num3;
			}
			if (segment != null)
			{
				segment.Length = num2 - segment.Start;
				segment.Text = stringBuilder2.ToString();
				list.Add(segment);
			}
			return list;
		}

		public static bool IsMixed(List<Segment> segs)
		{
			int num = segs.Where((Segment s) => s.Script == Script.Han).Sum((Segment s) => Scalars(s.Text).Count(IsHan));
			int num2 = segs.Where((Segment s) => s.Script == Script.Latin).Sum((Segment s) => Scalars(s.Text).Count(LetterOrNumber));
			if (num >= 2)
			{
				return num2 >= 3;
			}
			return false;
		}

		public static Cut SegmentPieces(Mask crop, List<Segment> segs, List<double[]> spans, Dictionary<int, int[]> located)
		{
			int[] bounds = crop.Tight();
			if (bounds == null || spans.Count == 0)
			{
				return null;
			}
			double lo = spans.Min((double[] array) => array[1]);
			double num = spans.Max((double[] array) => array[2]);
			if (!(num > lo))
			{
				return null;
			}
			double scale = (double)bounds[2] / (num - lo);
			Func<double, int> func = (double x) => (int)((double)bounds[0] + (x - lo) * scale);
			int num2 = bounds[1];
			int num3 = bounds[1] + bounds[3];
			bool[] blank = new bool[crop.Width];
			for (int num4 = 0; num4 < crop.Width; num4++)
			{
				bool flag = false;
				for (int num5 = num2; num5 < num3; num5++)
				{
					if (flag)
					{
						break;
					}
					if (crop.Pixels[num5 * crop.Width + num4] < 170)
					{
						flag = true;
					}
				}
				blank[num4] = !flag;
			}
			int window = Math.Max(2, bounds[3]);
			Func<int, int> func2 = delegate(int estimate)
			{
				int num10 = -1;
				int num11 = 0;
				int num12 = 0;
				int num13 = Math.Max(0, estimate - window);
				while (num13 <= Math.Min(crop.Width - 1, estimate + window))
				{
					if (!blank[num13])
					{
						num13++;
					}
					else
					{
						int i;
						for (i = num13; i + 1 < crop.Width && blank[i + 1]; i++)
						{
						}
						int num14 = num13;
						while (num14 > 0 && blank[num14 - 1])
						{
							num14--;
						}
						int num15 = (num14 + i) / 2;
						int num16 = i - num14 + 1;
						int num17 = Math.Abs(num15 - estimate);
						if (num10 < 0 || num16 > num10 || (num16 == num10 && num17 < num11))
						{
							num10 = num16;
							num11 = num17;
							num12 = num15;
						}
						num13 = i + 1;
					}
				}
				return (num10 < 0) ? Math.Max(0, Math.Min(crop.Width, estimate)) : num12;
			};
			Func<int, int> func3 = delegate(int estimate)
			{
				int num10 = Math.Max(2, (int)((double)bounds[3] * 0.3));
				int num11 = -1;
				int num12 = 0;
				int num13 = 0;
				int num14 = Math.Max(0, estimate - num10);
				while (num14 <= Math.Min(crop.Width - 1, estimate + num10))
				{
					if (!blank[num14])
					{
						num14++;
					}
					else
					{
						int i;
						for (i = num14; i + 1 < crop.Width && blank[i + 1]; i++)
						{
						}
						int num15 = num14;
						while (num15 > 0 && blank[num15 - 1])
						{
							num15--;
						}
						int num16 = ((estimate < num15) ? (num15 - estimate) : ((estimate > i) ? (estimate - i) : 0));
						int num17 = i - num15 + 1;
						if (num11 < 0 || num16 < num11 || (num16 == num11 && num17 > num12))
						{
							num11 = num16;
							num12 = num17;
							num13 = (num15 + i) / 2;
						}
						num14 = i + 1;
					}
				}
				return (num11 < 0) ? Math.Max(0, Math.Min(crop.Width, estimate)) : num13;
			};
			if (located != null)
			{
				List<List<int[]>> list = segs.Select((Segment segment) => (from i in Enumerable.Range(segment.Start, segment.Length).Where(located.ContainsKey)
					select located[i]).ToList()).ToList();
				if (list.All((List<int[]> b) => b.Count > 0))
				{
					List<int> list2 = new List<int> { 0 };
					for (int num6 = 1; num6 < list.Count; num6++)
					{
						int arg = (list[num6 - 1].Max((int[] b) => b[1]) + list[num6].Min((int[] b) => b[0])) / 2;
						list2.Add(Math.Max(list2[num6 - 1], func3(arg)));
					}
					list2.Add(crop.Width);
					List<Piece> list3 = new List<Piece>();
					for (int num7 = 0; num7 < segs.Count; num7++)
					{
						if (list2[num7 + 1] - list2[num7] >= 2)
						{
							list3.Add(new Piece
							{
								Segment = segs[num7],
								Left = list2[num7],
								Right = list2[num7 + 1]
							});
						}
					}
					return new Cut
					{
						Bounds = bounds,
						Pieces = list3
					};
				}
			}
			List<Tuple<Segment, int, int>> list4 = new List<Tuple<Segment, int, int>>();
			foreach (Segment s in segs)
			{
				List<double[]> list5 = spans.Where((double[] p) => p[0] >= (double)s.Start && p[0] < (double)(s.Start + s.Length)).ToList();
				if (list5.Count != 0)
				{
					list4.Add(Tuple.Create(s, func(list5.Min((double[] p) => p[1])), func(list5.Max((double[] p) => p[2]))));
				}
			}
			if (list4.Count < 2)
			{
				return null;
			}
			List<int> list6 = new List<int> { 0 };
			for (int num8 = 1; num8 < list4.Count; num8++)
			{
				list6.Add(Math.Max(list6[num8 - 1], func2((list4[num8 - 1].Item3 + list4[num8].Item2) / 2)));
			}
			list6.Add(crop.Width);
			List<Piece> list7 = new List<Piece>();
			for (int num9 = 0; num9 < list4.Count; num9++)
			{
				if (list6[num9 + 1] - list6[num9] >= 2)
				{
					list7.Add(new Piece
					{
						Segment = list4[num9].Item1,
						Left = list6[num9],
						Right = list6[num9 + 1]
					});
				}
			}
			return new Cut
			{
				Bounds = bounds,
				Pieces = list7
			};
		}

		public static Mask JoinedMask(Mask crop, int[] bounds, List<Piece> pieces)
		{
			int num = Math.Max(4, bounds[3] / 2);
			int num2 = pieces.Sum((Piece p) => p.Right - p.Left) + num * (pieces.Count - 1);
			int num3 = 0;
			byte[] array = new byte[num2 * crop.Height];
			for (int num4 = 0; num4 < array.Length; num4++)
			{
				array[num4] = byte.MaxValue;
			}
			foreach (Piece piece in pieces)
			{
				for (int num5 = 0; num5 < crop.Height; num5++)
				{
					for (int num6 = piece.Left; num6 < piece.Right; num6++)
					{
						array[num5 * num2 + num3 + num6 - piece.Left] = crop.Pixels[num5 * crop.Width + num6];
					}
				}
				num3 += piece.Right - piece.Left + num;
			}
			return new Mask(num2, crop.Height, array);
		}
	}
}
