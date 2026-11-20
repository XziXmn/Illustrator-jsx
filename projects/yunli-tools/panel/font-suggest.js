// 字体输入联想:按「族名 + 内部名」实时过滤。
// 原生 datalist 只按 value(内部名,多为 ASCII)匹配,输入中文族名永远搜不到,这里接管。
// 作用于「全部统一为…」和每行的手动字体搜索框;候选取自 #fontList。
(function () {
  "use strict";
  var fonts = null;

  function loadFonts() {
    var list = document.getElementById("fontList");
    if (!list) return [];
    var out = [];
    for (var i = 0; i < list.options.length; i++) {
      var o = list.options[i];
      out.push({ name: o.value, label: o.textContent || o.value });
    }
    return out;
  }

  function attach(input) {
    if (input.getAttribute("data-suggest")) return;
    input.setAttribute("data-suggest", "1");
    input.removeAttribute("list");   // 关掉原生下拉,避免和联想层叠在一起
    var pop = document.createElement("div");
    pop.className = "suggest font-suggest";
    pop.style.display = "none";
    document.body.appendChild(pop);
    var current = -1;
    var hits = [];

    function close() { pop.style.display = "none"; current = -1; }
    function paint() {
      var items = pop.querySelectorAll(".suggest-item");
      for (var i = 0; i < items.length; i++) items[i].className = "suggest-item" + (i === current ? " on" : "");
      if (items[current]) items[current].scrollIntoView({ block: "nearest" });
    }
    function pick(i) {
      if (!hits[i]) return;
      input.value = hits[i].name;
      close();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function render() {
      if (fonts === null) fonts = loadFonts();
      var kw = input.value.replace(/^\s+|\s+$/g, "").toLowerCase();
      hits = [];
      if (kw) {
        for (var i = 0; i < fonts.length && hits.length < 20; i++) {
          var f = fonts[i];
          if ((f.name + " " + f.label).toLowerCase().indexOf(kw) >= 0) hits.push(f);
        }
      }
      if (!hits.length) { close(); return; }
      pop.innerHTML = "";
      for (var j = 0; j < hits.length; j++) {
        (function (idx) {
          var item = document.createElement("div");
          item.className = "suggest-item" + (idx === current ? " on" : "");
          item.textContent = hits[idx].label;
          item.addEventListener("mousedown", function (e) {
            e.preventDefault();
            e.stopPropagation();
            pick(idx);
          });
          pop.appendChild(item);
        })(j);
      }
      var r = input.getBoundingClientRect();
      pop.style.left = r.left + "px";
      pop.style.top = (r.bottom + 2) + "px";
      pop.style.width = Math.max(r.width, 200) + "px";
      pop.style.display = "block";
    }
    input.addEventListener("input", function () { current = -1; render(); });
    input.addEventListener("focus", render);
    input.addEventListener("blur", function () { setTimeout(close, 180); });
    // 捕获阶段拦截方向键/回车,避免面板把回车直接当「统一」提交
    input.addEventListener("keydown", function (e) {
      if (pop.style.display !== "block") return;
      var items = pop.querySelectorAll(".suggest-item");
      if (!items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        current = Math.min(current + 1, items.length - 1);
        paint();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        current = Math.max(current - 1, 0);
        paint();
      } else if (e.key === "Enter" && current >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(current);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }, true);
    document.addEventListener("scroll", close, true);
  }

  function scan() {
    var inputs = document.querySelectorAll('input[list="fontList"]');
    for (var i = 0; i < inputs.length; i++) attach(inputs[i]);
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
