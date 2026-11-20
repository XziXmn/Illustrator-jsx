// 构建后执行：node tools/uitest/design-audit.cjs。默认使用模拟桥，不操作 Illustrator。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const root = path.resolve(__dirname, "../../dist/payload/assets/web");
const shots = path.join(__dirname, "shots");
const mock = fs.readFileSync(path.join(__dirname, "ui-preview.js"), "utf8");
const sizes = [[272,400],[348,648],[360,560],[460,640],[500,700],[640,400],[640,520],[1280,800]];
const surfaces = ["home","marks","export","pdf","restore","overlay","merge"];
const mime = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".png":"image/png", ".wasm":"application/wasm" };
async function measure(page) {
  return page.evaluate(() => {
    const main = [...document.querySelectorAll("main")].find(e => !e.hidden);
    const footer = main.querySelector(".page-foot");
    const fields = [...main.querySelectorAll("input:not([type=checkbox]),select")].filter(e => e.getClientRects().length);
    const markPanes = [...document.querySelectorAll(".mark-pane")].map(e => e.getBoundingClientRect());
    const channels = [...document.querySelectorAll(".export-channel")].map(e => e.getBoundingClientRect());
    const numericWidths = [...main.querySelectorAll("input[inputmode]")].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().width);
    const region = main.id === "view-home" ? main.querySelector("#home-groups") : main.id === "view-fonts" ? main.querySelector(".modes") : main.querySelector(".sheet");
    const regionRect = region.getBoundingClientRect();
    const headerRect = document.querySelector(".app-brand").getBoundingClientRect();
    const actions = footer && footer.querySelector(".page-actions,.font-actions:not([hidden])");
    const actionRect = actions && actions.getBoundingClientRect();
    const bodyStyles = [...main.querySelectorAll(".field,.check,.scope")].filter(e => e.getClientRects().length).map(e => getComputedStyle(e));
    const headingStyles = [...main.querySelectorAll("h2,.toolbar b")].filter(e => e.getClientRects().length).map(e => getComputedStyle(e));
    return {
      width: Math.round(main.getBoundingClientRect().width),
      viewport: innerWidth,
      directoryItems: document.querySelectorAll("#yunli-tools .tool-entry").length,
      expectedItems: 1 + YunLiNavData.groups.reduce((sum,group) => sum + group.items.length,0),
      heading: main.querySelector(".page-heading h1")?.firstChild.textContent,
      active: document.querySelector("#yunli-tools [aria-current]")?.getAttribute("data-feature"),
      overflow: [main,...main.querySelectorAll(".page-scroll,.zone,.modes,.board-list")].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map(e => e.id || e.className),
      badFields: fields.filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1 || r.height < 25; }).map(e => e.id),
      footerVisible: !footer || footer.getBoundingClientRect().bottom <= innerHeight + 1,
      markSideBySide: main.id !== "view-marks" || (Math.abs(markPanes[0].top - markPanes[1].top) < 1 && markPanes[1].left >= markPanes[0].right),
      exportLayout: main.id !== "view-export" || (innerWidth < 600 ? channels[1].top >= channels[0].bottom : Math.abs(channels[0].top - channels[1].top) < 1),
      numericWidths,
      markPositionWidth: main.id === "view-marks" ? document.getElementById("mk-side").getBoundingClientRect().width : null,
      repeatedUnits: main.id === "view-marks" && [...main.querySelectorAll(".input-unit > span")].some(e => e.textContent === "mm"),
      toolHeights: main.classList.contains("tool-page") ? fields.map(e => Math.round(e.getBoundingClientRect().height)) : [],
      balanced: Math.abs(regionRect.left - (innerWidth - regionRect.right)) < 1 && Math.abs(headerRect.left - (innerWidth - headerRect.right)) < 1,
      alignedActions: !actionRect || Math.abs(actionRect.left - regionRect.left) < 1 && Math.abs(actionRect.right - regionRect.right) < 1,
      bodyTypography: bodyStyles.every(s => s.fontSize === "12px" && s.lineHeight === "18px"),
      headingTypography: headingStyles.every(s => s.fontSize === "13px" && s.lineHeight === "20px" && s.fontWeight === "600")
    };
  });
}
async function routeAssets(page) {
  await page.route("http://local.test/**",route => {
    const file = path.resolve(root,"." + new URL(route.request().url()).pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({status:404,body:"Not found"});
    return route.fulfill({status:200,body:fs.readFileSync(file),contentType:mime[path.extname(file)] || "application/octet-stream"});
  });
}
(async () => {
  assert.ok(fs.existsSync(path.join(root,"font/index.html")), "请先运行 build.ps1");
  fs.mkdirSync(shots,{recursive:true});
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const [width,height] of sizes) for (const theme of ["light","dark"]) for (const surface of surfaces) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on("pageerror",e => errors.push(e.message));
      await routeAssets(page);
      await page.addInitScript(mock);
      await page.addInitScript(value => localStorage.setItem("yunli-theme",value),theme);
      const font = ["restore","overlay","merge"].includes(surface);
      await page.goto("http://local.test/index.html#" + (font ? "fonts" : surface));
      if (font) {
        await page.locator("#restore-capture").waitFor({state:"visible"});
        await page.waitForFunction(() => !document.getElementById("restore-capture").disabled);
        await page.locator("#tab-" + surface).click();
        if (surface === "restore") {
          await page.locator("#restore-capture").click();
          await page.locator("#restore-lines .row").first().waitFor();
          await page.waitForFunction(() => !document.getElementById("restore-matchFonts").disabled);
        }
      } else if (surface === "pdf") {
        await page.locator("#pdf-run").waitFor({state:"visible"});
      } else await page.waitForFunction(() => !document.getElementById("marks-run").disabled);
      const result = await measure(page);
      const label = surface + " " + width + "x" + height + " " + theme;
      assert.equal(result.width,result.viewport,label + " 主区域宽度");
      assert.equal(result.directoryItems,result.expectedItems,label + " 目录完整性");
      assert.equal(result.active,font ? "fonts" : surface,label + " 当前导航");
      assert.equal(result.heading,font ? "字体与文字" : {home:"工作台",marks:"印刷标记",export:"工艺导出",pdf:"PDF 转曲"}[surface],label + " 页面标题");
      assert.deepEqual(result.overflow,[],label + " 横向溢出");
      assert.deepEqual(result.badFields,[],label + " 控件裁剪或高度异常");
      assert.ok(result.footerVisible,label + " 操作栏可见");
      assert.ok(result.markSideBySide,label + " 标记必须保留左右分区");
      assert.ok(result.exportLayout,label + " 导出窄窗上下、宽窗左右");
      assert.ok(result.numericWidths.every(w => w >= 47 && w <= 53),label + " 数值框宽度应固定在 48–52px");
      if (surface === "marks") assert.ok(Math.abs(result.markPositionWidth - result.numericWidths[0]) < 1,label + " 位置选择器与数值框等宽");
      assert.equal(result.repeatedUnits,false,label + " 不重复标注 mm");
      assert.ok(result.toolHeights.every(h => h === 28),label + " 表单控件高度应统一为 28px");
      assert.ok(result.balanced,label + " 左右留白应对称");
      assert.ok(result.alignedActions,label + " 内容与操作栏边线应对齐");
      assert.ok(result.bodyTypography && result.headingTypography,label + " 同级文字应共用字号、行高和字重");
      assert.deepEqual(errors,[],label + " JS 错误");
      await page.screenshot({path:path.join(shots,"redesign-" + surface + "-" + width + "-" + theme + ".png")});
      console.log("pass",label);
      count++;
      await page.close();
    }
    // 调整窗口时只重排同一份控件，不应重建表单或丢失值。
    const state = await browser.newPage({viewport:{width:272,height:400}});
    await routeAssets(state);
    await state.addInitScript(mock);
    await state.goto("http://local.test/index.html#marks");
    await state.locator("#mk-size").fill("8");
    await state.locator("#mk-bisect").check();
    await state.locator("#mk-comment").fill("窗口切换测试");
    await state.setViewportSize({width:348,height:648});
    await state.locator("#mk-basic").waitFor({state:"visible"});
    await state.locator("#mk-additional").waitFor({state:"visible"});
    assert.equal(await state.locator("#mk-size").inputValue(),"8");
    assert.ok(await state.locator("#mk-bisect").isChecked());
    assert.equal(await state.locator("#mk-comment").inputValue(),"窗口切换测试");
    await state.close();
    // 没有桥和画板数据时，导出卡片应按内容收缩。
    const empty = await browser.newPage({viewport:{width:348,height:648}});
    await routeAssets(empty);
    await empty.goto("http://local.test/index.html#export");
    await empty.locator("#export-status.err").waitFor({state:"visible"});
    const emptyHeights = await empty.locator(".export-channel").evaluateAll(nodes => nodes.map(e => e.getBoundingClientRect().height));
    assert.ok(emptyHeights.every(h => h < 180),"空导出卡片不应撑满窗口");
    assert.ok(await empty.locator("#export-run").isDisabled());
    await empty.close();
    // 缩略图点击只查看图片，不改变画板勾选或导出参数。
    const picture = await browser.newPage({viewport:{width:272,height:400}});
    await routeAssets(picture);
    await picture.addInitScript(mock);
    await picture.goto("http://local.test/index.html#export");
    await picture.locator("#ex-cmyk-boards .board-preview img").first().waitFor({state:"visible"});
    await picture.locator("#ex-cmyk-boards input[type=checkbox]").first().check();
    await picture.locator("#ex-cmyk-ppi").selectOption("600");
    await picture.locator("#ex-cmyk-boards .board-preview").first().click();
    await picture.locator("#preview-image").waitFor({state:"visible"});
    const fit = await picture.locator("#preview-stage").evaluate(e => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1);
    assert.ok(fit,"小窗口中的适合窗口预览不得溢出");
    await picture.getByRole("button",{name:"原尺寸",exact:true}).click();
    assert.ok(await picture.locator("#preview-stage").evaluate(e => e.scrollHeight > e.clientHeight));
    await picture.keyboard.press("Escape");
    await picture.locator("#artboard-preview").waitFor({state:"hidden"});
    assert.ok(await picture.locator("#ex-cmyk-boards input[type=checkbox]").first().isChecked());
    assert.equal(await picture.locator("#ex-cmyk-ppi").inputValue(),"600");
    await picture.close();
    const brokenPicture = await browser.newPage({viewport:{width:272,height:400}});
    await routeAssets(brokenPicture);
    await brokenPicture.addInitScript(mock);
    await brokenPicture.goto("http://local.test/index.html?preview-error=1#export");
    await brokenPicture.locator(".board-preview[data-preview-error]").first().waitFor({state:"visible"});
    assert.ok(await brokenPicture.locator("#export-run").isEnabled(),"取图失败不应禁用导出");
    await brokenPicture.locator("#ex-cmyk-boards .board-preview").first().click();
    await brokenPicture.getByText("模拟取图失败，请刷新后重试。",{exact:true}).waitFor();
    await brokenPicture.keyboard.press("Escape");
    await brokenPicture.locator("#artboard-preview").waitFor({state:"hidden"});
    await brokenPicture.close();
    // 大目录验证：滚动、搜索、空结果、清空均使用真实组件。
    const stress = await browser.newPage({viewport:{width:272,height:400}});
    await routeAssets(stress);
    await stress.addInitScript(mock);
    await stress.goto("http://local.test/index.html?catalog-stress=1");
    await stress.getByRole("button",{name:"工具目录",exact:true}).click();
    assert.equal(await stress.locator("#yunli-tools .tool-entry").count(),103);
    assert.ok(await stress.locator("#directory-catalog .catalog-groups").evaluate(e => e.scrollHeight > e.clientHeight));
    const search = stress.getByRole("searchbox",{name:"搜索工具目录",exact:true});
    await search.fill("扩展工具 8-12");
    assert.equal(await stress.locator("#yunli-tools .tool-entry").count(),1);
    await search.fill("不存在的工具");
    assert.ok(await stress.locator("#directory-catalog .empty-state").isVisible());
    await search.fill("");
    assert.equal(await stress.locator("#yunli-tools .tool-entry").count(),103);
    await stress.keyboard.press("Escape");
    assert.equal(await stress.locator("#directory-toggle").getAttribute("aria-expanded"),"false");
    await stress.close();
    console.log(count + "/" + sizes.length * surfaces.length * 2 + " 布局检查通过，103 个工具目录检查通过（模拟桥）");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
