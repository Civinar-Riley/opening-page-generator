/* 构建脚本：src/ 多文件 → dist/ 单文件 HTML */
const fs = require('fs');
const pkg = require('./package.json');

let esbuild;
try { esbuild = require('esbuild'); }
catch (e) { console.error('缺少 esbuild，请先运行: npm install'); process.exit(1); }

/* 构建脚本：src/ 多文件 → dist/ 单文件 HTML */
function build() {
  const html0 = fs.readFileSync('src/index.html', 'utf8');
  /* 版本号注入：src/index.html 中的 __OPG_VERSION__ 占位替换为 package.json 的 version */
  const html = html0.replace(/__OPG_VERSION__/g, pkg.version);
  const css = fs.readFileSync('src/css/tool.css', 'utf8');
  /* watch 模式不压缩，便于断点调试；正式构建压缩 JS 与 CSS */
  const minify = !process.argv.includes('--watch');
  const r = esbuild.buildSync({
    entryPoints: ['src/js/main.js'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2018',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    minify,
  });
  /* 内联进 <script> 前，把字符串里的 </script> 转义，避免提前闭合 */
  let js = r.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
  /* HTML5 script 双转义闸门：bundle 内 '<!--'（进 script 转义态）之后若再出现 '<script'
     （进双转义态）且无 '-->' 弹出，文件末尾唯一的 </script> 只会把双转义退回转义态而
     无法真正闭合脚本——整个 bundle 被浏览器当文本吞掉且零报错（v1.13.0 工具白屏根因）。
     结束态仍为双转义即构建失败，逼源码消除 '<!--' 字面序列 */
  {
    let st = 0; /* 0 normal 1 escaped 2 double-escaped */
    for (let i = 0; i < js.length - 8; i++) {
      if (st === 0) { if (js.startsWith('<!--', i)) { st = 1; i += 3; } }
      else if (st === 1) {
        if (/^<script[ \t\n\f\r/>]/.test(js.slice(i, i + 8))) { st = 2; i += 6; }
        else if (js.startsWith('-->', i)) { st = 0; i += 2; }
      } else {
        if (/^<\/script[ \t\n\f\r/>]/.test(js.slice(i, i + 9))) { st = 1; i += 8; }
      }
    }
    if (st === 2) throw new Error('bundle 触发 HTML script 双转义：\'<!--\' 之后出现 \'<script\' 且无 \'-->\' 弹出，末尾 </script> 会被浏览器吞掉导致整包静默不执行——请消除源码中的 \'<!--\' 字面量（用 \'\u003c\' 转义或字符串拆接）');
  }
  /* CSS 同样经 esbuild 压缩（tool.css 无本地 url() 引用，可安全 bundle） */
  const cssR = esbuild.buildSync({
    entryPoints: ['src/css/tool.css'],
    bundle: true,
    write: false,
    minify,
    charset: 'utf8',
    logLevel: 'silent',
  });
  const cssOut = cssR.outputFiles[0].text;
  /* 用函数形式替换：bundle 代码里含 $& 等序列，字符串形式会被误展开 */
  const out = html
    .replace('<link rel="stylesheet" href="./css/tool.css">', () => '<style>\n' + cssOut + '\n</style>')
    .replace('<script type="module" src="./js/main.js"></script>', () => '<script>\n' + js + '\n</script>');
  if (out.includes('./css/tool.css') || out.includes('type="module"')) {
    throw new Error('index.html 中未找到开发引用占位，请检查标签是否被改动');
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', out);
  console.log('构建完成 → dist/index.html (' + (out.length / 1024).toFixed(1) + ' KB)');
}

build();

if (process.argv.includes('--watch')) {
  let t;
  fs.watch('src', { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { try { build(); } catch (e) { console.error('构建失败:', e.message); } }, 200);
  });
  console.log('正在监视 src/ 变更，改动会自动重新构建…');
}
