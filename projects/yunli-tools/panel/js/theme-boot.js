// 首帧前恢复主题。外链文件以满足 CSP(页面不允许内联脚本)。
try {
  var saved = localStorage.getItem("yunli-theme");
  document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
} catch (e) {
  document.documentElement.setAttribute("data-theme", "light");
}
