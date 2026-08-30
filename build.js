/* 构建脚本：src/ 多文件 → dist/ 单文件 HTML */
const fs = require('fs');
const pkg = require('./package.json');

let esbuild;
try { esbuild = require('esbuild'); }
catch (e) { console.error('缺少 esbuild，请先运行: npm install'); process.exit(1); }

function build() {
  const html = fs.readFileSync('src/index.html', 'utf8');
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
