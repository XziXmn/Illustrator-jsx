// 验证字体与其他工具在同一文档中，布局及请求通道不会由运行时另起一套。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"../../dist/payload/assets/web");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
const legacy = fs.readFileSync(path.join(root,"font/index.html"),"utf8");
const runtime = fs.readFileSync(path.join(root,"font/js/native-runtime.js"),"utf8");
const view = html.match(/<main id="view-fonts"[^>]*>[\s\S]*?<\/main>/);
assert.ok(view,"主页面中必须包含字体视图");
assert.equal([...html.matchAll(/id="view-fonts"/g)].length,1);
assert.ok(view[0].includes('<div class="page-scroll">'));
const footer = view[0].indexOf('<div class="page-foot font-foot">');
assert.ok(footer > 0,"操作栏应静态生成");
for(const id of ["restore-capture","restore-rebuild","overlay-capture","overlay-rebuild","mergeText","splitText"]){
  const matches=[...html.matchAll(new RegExp('id="'+id+'"','g'))];
  assert.equal(matches.length,1,id+" 必须唯一");
  assert.ok(view[0].indexOf('id="'+id+'"')>footer,id+" 应位于共用操作栏");
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,"集成后不能产生重复控件 ID");
assert.ok(html.indexOf('src="js/font-loader.js')<html.indexOf('src="js/home.js'),"路由前应已注册惰性加载器");
assert.ok(!/<iframe/i.test(view[0]),"字体应为同一文档视图");
assert.ok(!/src="(?:font\/)?(?:js\/panel.js|ocr\/)/.test(html),"OCR 资源不能拖慢主页面初始化");
assert.ok(legacy.includes("../index.html#fonts"),"旧入口应跳回统一视图");
assert.ok(!runtime.includes("window.__zixingDeliver"),"字体模块不能覆盖共用消息处理器");
assert.ok(runtime.includes("window.YunLiTool.requestNative"),"字体应复用共用消息桥");
assert.ok(runtime.includes("document.currentScript.src"),"资源地址应相对模块脚本定位");
console.log("字体单页集成、控件唯一性和共享桥检查通过");
