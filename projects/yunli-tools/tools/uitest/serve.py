import http.server, os, sys
root = sys.argv[1]
port = int(sys.argv[2])
mock_path = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else None
os.chdir(root)
class H(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def do_GET(self):
        # 可选模拟桥仅用于本地 UI 检查，不写入插件构建产物。
        if mock_path and self.path == "/__yunli_mock.js":
            with open(mock_path, "rb") as source:
                return self.send_preview(source.read(), "text/javascript; charset=utf-8")
        path = self.translate_path(self.path)
        if mock_path and path.endswith(".html") and os.path.isfile(path):
            with open(path, "r", encoding="utf-8-sig") as source:
                html = source.read().replace("</head>", '<script src="/__yunli_mock.js"></script></head>')
            return self.send_preview(html.encode("utf-8"), "text/html; charset=utf-8")
        super().do_GET()
    def send_preview(self, data, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
class S(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
with S(("127.0.0.1", port), H) as httpd:
    httpd.serve_forever()
