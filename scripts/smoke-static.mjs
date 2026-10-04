/* 构建后静态冒烟（零依赖）：对 dist/index.html 做纯文本/语法级断言——
   拦截单测抓不住的「整包级」事故（v1.13.0 双转义白屏那类）。挂在 postbuild，每次 build 自动跑。
   浏览器级行为验证在 smoke-browser.mjs（npm run smoke 一并跑） */
import fs from 'node:fs';

const PATH = 'dist/index.html';
const fail = [];
const ok = [];
const check = (name, cond, detail = '') => {
  if (cond) ok.push(name);
  else fail.push(name + (detail ? '：' + detail : ''));
};

if (!fs.existsSync(PATH)) {
  console.error('✗ 未找到 dist/index.html——请先 npm run build');
  process.exit(1);
}
const html = fs.readFileSync(PATH, 'utf8');
const kb = html.length / 1024;

check('体积 > 100KB（防构建截断）', kb > 100, `当前 ${kb.toFixed(1)} KB`);

/* 真实闭合标签 ≥2（head 的 OPG_VERSION 注入 + body 的 bundle），
   且 bundle 闭合紧邻 </body></html>——被双转义吞包时这两个特征同时消失 */
const realClose = (html.match(/<\/script>/g) || []).length;
check('真实 script 闭合 ≥2', realClose >= 2, `仅 ${realClose} 个`);
check('bundle 闭合紧邻 </body></html> 收尾', /<\/script>\s*<\/body>\s*<\/html>\s*$/.test(html));

/* script 块内部禁止字面 <!--：HTML 解析器在 script 内容中遇 <!-- 进入转义态，
   之后 </script> 失效——build.js 的状态机在 bundle 层已设闸，这里对**最终文档**复核
   （壳 HTML 自己的分区注释在 script 之外，不在提取范围内，合法） */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
check('可提取 script 块 ≥1', scripts.length >= 1, `找到 ${scripts.length} 个`);
scripts.forEach((s, i) => {
  check(`script#${i + 1} 内无字面 <!--`, !s.includes('<!--'));
});

/* 文档级双转义终态检查（与 build.js 闸门同一状态机，跑在替换完占位、内联完 CSS 的最终文档上；
   结束态 2 = 双转义未弹出 = 末尾 </script> 被浏览器当文本吞掉） */
{
  let st = 0; /* 0 normal 1 escaped 2 double-escaped */
  for (let i = 0; i < html.length - 8; i++) {
    if (st === 0) { if (html.startsWith('<!--', i)) { st = 1; i += 3; } }
    else if (st === 1) {
      if (/^<script[ \t\n\f\r/>]/.test(html.slice(i, i + 8))) { st = 2; i += 6; }
      else if (html.startsWith('-->', i)) { st = 0; i += 2; }
    } else {
      if (/^<\/script[ \t\n\f\r/>]/.test(html.slice(i, i + 9))) { st = 1; i += 8; }
    }
  }
  check('HTML script 转义状态机正常收敛', st !== 2, `结束态 ${st}（2=双转义吞包）`);
}

/* 占位与版本一致性 */
check('无版本/日期占位残留', !html.includes('__OPG_VERSION__') && !html.includes('__OPG_BUILD_DATE__'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const m = /<script>window\.OPG_VERSION='([^']*)';?<\/script>/.exec(html);
check('OPG_VERSION === package.json version', !!m && m[1] === pkg.version,
  m ? `页面 ${m[1]} vs pkg ${pkg.version}` : '未找到 OPG_VERSION 注入');

/* bundle 语法可解析（不执行）：抓压缩/转义环节引入的语法破损 */
scripts.forEach((s, i) => {
  try { new Function(s); ok.push(`script#${i + 1} 语法可解析 (${(s.length / 1024).toFixed(1)} KB)`); }
  catch (e) { fail.push(`script#${i + 1} 语法错误：${e.message}`); }
});

if (fail.length) {
  console.log('✗ 静态冒烟未通过：');
  fail.forEach(x => console.log('  ✖ ' + x));
  process.exit(1);
}
console.log('✓ 静态冒烟通过：\n  ' + ok.map(x => '· ' + x).join('\n  '));
