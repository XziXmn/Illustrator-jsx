// 在线更新:检查仓库版本清单 → 下载发布包(镜像回退、SHA-256 校验) → 退出 Illustrator 后替换。
(function () {
  "use strict";
  var check = document.getElementById("update-check");
  var state = document.getElementById("update-state");
  if (!check || !state) return;

  var release = null;
  var busy = false;

  function setState(text, kind) {
    state.textContent = text;
    state.className = "hint update-state" + (kind ? " " + kind : "");
  }
  function setBusy(on, label) {
    busy = on;
    check.disabled = on;
    if (label) check.textContent = label;
  }
  function mb(bytes) { return Math.round(bytes / 1048576) + " MB"; }

  check.addEventListener("click", function () {
    if (busy) return;
    if (release) { download(); return; }
    setBusy(true, "检查中…");
    setState("正在检查更新…", "");
    YunLiTool.request("updateCheck").then(function (data) {
      if (!data.newer) {
        release = null;
        setState("已是最新（v" + data.currentVersion + "）。", "");
        setBusy(false, "检查更新");
        return;
      }
      release = data;
      var notes = data.notes ? "：" + data.notes : "。";
      setState("发现 v" + data.latestVersion + notes, "ok");
      setBusy(false, "下载 v" + data.latestVersion);
    }).catch(function (e) {
      setState(e.message, "err");
      setBusy(false, "检查更新");
    });
  });

  function download() {
    setBusy(true, "下载中…");
    setState("正在下载 v" + release.latestVersion + "…", "");
    YunLiTool.requestNative("tool", {
      action: "updateDownload",
      payload: {
        version: release.latestVersion,
        tag: release.tag,
        asset: release.asset,
        sha256: release.sha256,
        url: release.url
      }
    }, function (progress) {
      if (!progress) return;
      if (progress.total > 0) {
        setState("正在下载 " + Math.round(progress.received / progress.total * 100) + "%（" + mb(progress.total) + "）", "");
      } else {
        setState("正在下载 " + mb(progress.received), "");
      }
    }).then(function (data) {
      setState("已下载并通过校验（来源：" + data.source + "）。", "ok");
      return YunLiTool.request("updateInstall", { file: data.file });
    }).then(function () {
      setState("退出 Illustrator 后会自动替换并重新打开。请先保存工作。", "ok");
      setBusy(false, "检查更新");
      release = null;
    }).catch(function (e) {
      setState(e.message, "err");
      setBusy(false, release ? "重新下载" : "检查更新");
    });
  }
})();
