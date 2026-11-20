// 不启动 Illustrator，验证取图边界及成功/失败时的活动画板恢复。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const code = fs.readFileSync(path.resolve(__dirname, "../../host/dispatch.jsx"), "utf8");
let active = 1, exported = null, failExport = false;
const boards = [{name:"正面",artboardRect:[0,300,600,0]},{name:"背面",artboardRect:[0,600,300,0]}];
boards.getActiveArtboardIndex = () => active;
boards.setActiveArtboardIndex = index => { active = index; };
const doc = {
  name:"预览测试.ai", artboards:boards,
  exportFile(file,type,options) {
    exported = {file:file.path,type,options,active};
    if (failExport) throw Error("模拟导出失败");
  }
};
const context = {app:{documents:[doc],activeDocument:doc},File:function(file){this.path=file;},ExportOptionsPNG24:function(){},ExportType:{PNG24:"PNG24"}};
vm.runInNewContext(code,context);
const preview = context.YunLiTools.preview;
const payload = {document:doc.name,index:0,file:"preview.png",mode:"thumb"};
assert.equal(preview(payload).name,"正面");
assert.equal(exported.active,0);
assert.equal(active,1);
assert.equal(exported.options.horizontalScale,64 / 600 * 100);
assert.equal(exported.options.artBoardClipping,true);
assert.equal(exported.options.transparency,false);
preview({...payload,mode:"full"});
assert.equal(exported.options.horizontalScale,100);
failExport = true;
assert.throws(() => preview(payload),/模拟导出失败/);
assert.equal(active,1,"失败后也必须恢复原活动画板");
failExport = false;
for (const index of [-1,2,.5,NaN,null,"0"]) assert.throws(() => preview({...payload,index}),/画板编号无效/);
assert.throws(() => preview({...payload,document:"另一个文档.ai"}),/文档已切换/);
assert.throws(() => preview({...payload,file:""}),/临时文件/);
boards[0].artboardRect = [0,0,0,0];
assert.throws(() => preview(payload),/画板尺寸无效/);
context.app.documents = [];
assert.throws(() => preview(payload),/请先打开文档/);
console.log("画板预览边界与状态恢复检查通过");
