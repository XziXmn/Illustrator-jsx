// 单一功能目录：首页、搜索与导航共用。新增功能无需修改顶栏布局。
(function () {
  "use strict";
  var base = new URL("../", document.currentScript.src);
  var paths = {
    home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    marks:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M12 8v8m-4-4h8"/>',
    export:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
    fonts:'<path d="M4 20 10 4h4l6 16M7 13h10"/>',
    check:'<path d="M9 12l2 2 4-4M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z"/>',
    barcode:'<path d="M3 5v14m4-14v14m3-14v14m4-14v14m3-14v14m4-14v14"/>',
    arrow:'<path d="m9 5 7 7-7 7"/>',
    menu:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 4 4 4-5 5 6"/>',
    refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
  };
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    var holder = el("span");
    holder.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.marks) + '</svg>';
    return holder.firstChild;
  }
  var data = { groups:[
    { id:"prepress", title:"印前制作", items:[
      { id:"marks", title:"印刷标记", desc:"角线、马克点、分色与文档信息", view:"marks" },
      { id:"export", title:"工艺导出", desc:"按画板批量导出四色与工艺 TIFF", view:"export" },
      { id:"check", title:"印前检查", desc:"上机前检查稿件", disabled:true }
    ] },
    { id:"design", title:"设计处理", items:[
      { id:"fonts", title:"字体与文字", desc:"转曲恢复、文字提取与合并拆分", view:"fonts" },
      { id:"barcode", title:"条码生成", desc:"创建印刷条码", disabled:true }
    ] }
  ] };
  var home = { id:"home", title:"工作台", desc:"浏览所有工具" };
  function allItems() {
    return data.groups.reduce(function (out, group) { return out.concat(group.items); }, [home]);
  }
  function href(item) {
    var url = new URL(item.href || ("index.html#" + (item.view || item.id)), base);
    if (url.origin === location.origin && url.pathname === location.pathname) url.search = location.search;
    return url.href;
  }
  function route() {
    var external = allItems().find(function (item) { return item.href && new URL(href(item)).pathname === location.pathname; });
    if (external) return external.id;
    var found = allItems().find(function (item) { return !item.disabled && item.view === location.hash.slice(1); });
    return found && document.getElementById("view-" + found.id) ? found.id : "home";
  }
  function toolEntry(item) {
    var entry = el(item.disabled ? "div" : "a", "tool-entry" + (item.disabled ? " unavailable" : ""));
    entry.title = item.desc;
    entry.setAttribute("data-feature", item.id);
    if (!item.disabled) entry.href = href(item);
    var symbol = el("span", "tool-icon");
    symbol.appendChild(icon(item.id));
    entry.appendChild(symbol);
    var copy = el("span", "tool-copy");
    copy.appendChild(el("strong", "", item.title));
    entry.appendChild(copy);
    if (item.disabled) entry.appendChild(el("span", "badge", "待开放"));
    else entry.appendChild(icon("arrow"));
    return entry;
  }
  function renderSelection() {
    var current = route();
    document.querySelectorAll("[data-feature]").forEach(function (node) {
      if (node.getAttribute("data-feature") === current) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
    var item = allItems().find(function (entry) { return entry.id === current; });
    document.getElementById("current-feature").textContent = item.title;
  }
  function mountCatalog(host, label, directory) {
    host.replaceChildren();
    host.classList.add("catalog");
    var search = el("input", "catalog-search");
    search.type = "search";
    search.placeholder = "搜索工具…";
    search.setAttribute("aria-label", label);
    if (directory) search.autofocus = true;
    host.appendChild(search);
    var groups = el("div", "catalog-groups");
    host.appendChild(groups);
    var empty = el("p", "empty-state", "没有找到工具，请换个关键词。");
    empty.setAttribute("role", "status");
    empty.hidden = true;
    host.appendChild(empty);
    function paint() {
      var query = search.value.trim().toLocaleLowerCase();
      groups.replaceChildren();
      var count = 0;
      var source = directory ? [{ title:"", items:[home] }].concat(data.groups) : data.groups;
      source.forEach(function (group) {
        var matches = group.items.filter(function (item) {
          return (directory || !item.disabled) && (group.title + " " + item.title + " " + item.desc).toLocaleLowerCase().indexOf(query) !== -1;
        });
        if (!matches.length) return;
        count += matches.length;
        var section = el("section", "home-group");
        if (group.title) section.appendChild(el("h2", "", group.title));
        var list = el("div", "tool-list");
        matches.forEach(function (item) { list.appendChild(toolEntry(item)); });
        section.appendChild(list);
        groups.appendChild(section);
      });
      empty.hidden = count !== 0;
      renderSelection();
    }
    search.addEventListener("input", paint);
    paint();
  }
  window.YunLiNavData = data;
  window.YunLiUI = { icon:icon, href:href, route:route, mountCatalog:mountCatalog };

  var header = el("header", "app-header");
  var bar = el("div", "app-brand");
  var menu = el("button", "icon-button directory-toggle");
  menu.type = "button";
  menu.id = "directory-toggle";
  menu.setAttribute("popovertarget", "yunli-tools");
  menu.setAttribute("aria-label", "工具目录");
  menu.setAttribute("aria-controls", "yunli-tools");
  menu.setAttribute("aria-expanded", "false");
  menu.appendChild(icon("menu"));
  bar.appendChild(menu);
  var brand = el("a", "brand-name", "YunLi");
  brand.href = href(home);
  brand.setAttribute("aria-label", "返回工作台");
  bar.appendChild(brand);
  var current = el("span", "current-feature");
  current.id = "current-feature";
  bar.appendChild(current);
  var theme = el("button", "icon-button theme-button");
  theme.type = "button";
  function paintTheme() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    theme.replaceChildren(icon(dark ? "sun" : "moon"));
    theme.setAttribute("aria-label", dark ? "切换到浅色主题" : "切换到深色主题");
    theme.title = theme.getAttribute("aria-label");
  }
  theme.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("yunli-theme", next); } catch (error) { console.warn("无法保存主题偏好", error); }
    paintTheme();
  });
  paintTheme();
  bar.appendChild(theme);
  header.appendChild(bar);
  document.body.insertBefore(header, document.body.firstChild);

  var directory = el("nav", "tool-directory");
  directory.id = "yunli-tools";
  directory.setAttribute("popover", "auto");
  directory.setAttribute("aria-label", "工具目录");
  var head = el("div", "directory-head");
  head.appendChild(el("strong", "", "工具目录"));
  var close = el("button", "icon-button");
  close.type = "button";
  close.setAttribute("aria-label", "关闭工具目录");
  close.appendChild(icon("close"));
  close.addEventListener("click", function () { directory.hidePopover(); menu.focus(); });
  head.appendChild(close);
  directory.appendChild(head);
  var catalog = el("div");
  catalog.id = "directory-catalog";
  directory.appendChild(catalog);
  document.body.appendChild(directory);
  mountCatalog(catalog, "搜索工具目录", true);
  directory.addEventListener("toggle", function (event) { menu.setAttribute("aria-expanded", String(event.newState === "open")); });
  directory.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      directory.hidePopover();
      menu.focus();
    }
  });
  window.YunLiRenderNav = renderSelection;
  window.addEventListener("hashchange", renderSelection);
  renderSelection();
})();
