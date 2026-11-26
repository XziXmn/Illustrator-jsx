// 在线更新:检查仓库版本清单 → 优先走轻量热更新(无需重启 Illustrator),旧壳或壳升级时自动回退完整 .aip 下载替换。
(function () {
  "use strict";
  var check = document.getElementById("update-check");
  var state = document.getElementById("update-state");
  if (!check || !state) return;

  var release = null;
  var busy = false;

  function setState(text, kind) {
    state.textContent = text;
    state.title = text;
    state.hidden = !text;
    state.className = "hint update-state" + (kind ? " " + kind : "");
  }
  function setBusy(on, label) {
    busy = on;
    check.disabled = on;
    if (label) check.textContent = label;
  }
  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    if (bytes < 10 * 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    return Math.round(bytes / 1048576) + " MB";
  }

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
      var notes = data.notes ? " · " + data.notes : "";
      setState("v" + data.latestVersion + notes, "ok");
      setBusy(false, data.canHot ? ("热更新 v" + data.latestVersion) : ("下载 v" + data.latestVersion));
    }).catch(function (e) {
      setState(e.message, "err");
      setBusy(false, "检查更新");
    });
  });

  function download() {
    var useHot = !!(release && release.canHot);
    setBusy(true, useHot ? "热更新中…" : "下载中…");
    setState((useHot ? "正在下载热更新 v" : "正在下载 v") + release.latestVersion + "…", "");
    YunLiTool.requestNative("tool", {
      action: useHot ? "updateDownloadHot" : "updateDownload",
      payload: {
        version: release.latestVersion,
        tag: release.tag,
        asset: useHot ? release.hotAsset : release.asset,
        sha256: useHot ? release.hotSha256 : release.sha256,
        url: useHot ? release.hotUrl : release.url
      }
    }, function (progress) {
      if (!progress) return;
      if (progress.total > 0) {
        setState("正在下载 " + Math.round(progress.received / progress.total * 100) + "%（" + formatSize(progress.total) + "）", "");
      } else {
        setState("正在下载 " + formatSize(progress.received), "");
      }
    }).then(function (data) {
      if (useHot) {
        setState("热更新包校验通过（来源：" + data.source + "），正在安装…", "ok");
        return YunLiTool.request("updateHotInstall", {
          file: data.file,
          version: release.latestVersion
        }).then(function () {
          setState("热更新已安装，正在重载面板（无需重启 Illustrator）…", "ok");
          setBusy(true, "重载中…");
          release = null;
        });
      }
      setState("已下载并通过校验（来源：" + data.source + "）。", "ok");
      return YunLiTool.request("updateInstall", { file: data.file }).then(function () {
        setState("退出 Illustrator 后会自动替换并重新打开。请先保存工作。", "ok");
        setBusy(false, "检查更新");
        release = null;
      });
    }).catch(function (e) {
      setState(e.message, "err");
      setBusy(false, release ? (useHot ? "重试热更新" : "重新下载") : "检查更新");
    });
  }
})();
