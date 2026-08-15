import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import jsxbin from "jsxbin";

const JSXBIN_HEADER = "@JSXBIN@ES@2.0@";

function printUsage() {
  console.log("用法: node tools/build-jsxbin.mjs --input <源码.jsx> --output <产物.jsxbin|产物.jsx>");
}

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument !== "--input" && argument !== "--output") {
      throw new Error(`未知参数: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} 缺少参数值。`);
    }

    options[argument.slice(2)] = value;
    index += 1;
  }

  return options;
}

async function buildJsxbin(inputArgument, outputArgument) {
  const inputPath = path.resolve(inputArgument);
  const outputPath = path.resolve(outputArgument);

  if (inputPath === outputPath) {
    throw new Error("输入文件和输出文件不能相同。删除明文源码不属于构建步骤。");
  }

  const source = await readFile(inputPath, "utf8");
  if (source.startsWith(JSXBIN_HEADER)) {
    throw new Error(`输入文件已经是 JSXBIN: ${inputPath}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "illustrator-jsxbin-"));
  const temporaryOutput = path.join(temporaryDirectory, "output.jsxbin");

  try {
    await jsxbin(inputPath, temporaryOutput);

    let compiled;
    try {
      compiled = await readFile(temporaryOutput);
    } catch (error) {
      throw new Error(`编译器没有生成产物。${error.message}`);
    }

    if (compiled.length <= JSXBIN_HEADER.length) {
      throw new Error(`编译产物异常短，仅 ${compiled.length} 字节。`);
    }

    const header = compiled.subarray(0, JSXBIN_HEADER.length).toString("ascii");
    if (header !== JSXBIN_HEADER) {
      throw new Error(`编译产物头错误: ${JSON.stringify(header)}`);
    }

    await writeFile(outputPath, compiled);

    const sha256 = createHash("sha256").update(compiled).digest("hex").toUpperCase();
    const checksumPath = `${outputPath}.sha256`;
    await writeFile(checksumPath, `${sha256}  ${path.basename(outputPath)}\n`, "utf8");

    console.log(`JSXBIN 已生成: ${outputPath}`);
    console.log(`大小: ${compiled.length} 字节`);
    console.log(`SHA256: ${sha256}`);
    console.log(`校验文件: ${checksumPath}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.input || !options.output) {
    printUsage();
    throw new Error("必须同时提供 --input 和 --output。");
  }

  await buildJsxbin(options.input, options.output);
}

main().catch((error) => {
  console.error(`构建失败: ${error.message}`);
  process.exitCode = 1;
});
