/* 扩展产物构建：把 dist/index.html 复制为仓库根 tool.html（ST 安装本分支时以仓库根为扩展目录）。
   用法：npm run build:ext（= npm run build && node ext-build.js），产物 tool.html 须随分支提交。 */
const fs = require('fs');
fs.copyFileSync('dist/index.html', 'tool.html');
console.log('扩展产物已生成 → tool.html (' + Math.round(fs.statSync('tool.html').size / 1024) + ' KB)');
