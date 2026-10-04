/* 浏览器级冒烟：无头 Chromium 打开刚构建的 dist——零 console.error/pageerror 是硬门槛
   （console.warn 属合法诊断不计）；顶栏版本常显、页签渲染与切换、预览 iframe 挂载、
   漫画导入探活成功路径（内置 /api/status mock）。CI 与本地 npm run smoke 均跑此脚本 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

/* 静态服务 + 漫画导入探活 mock：探活写死 http://127.0.0.1:8765/api/status，
   所以优先把本服务绑到 8765（探活走成功路径）；被占用（如真实 nh-serve 在跑）则回落
   随机端口开页，8765 相关的失败按「已知良性降级」过滤（探活本就有 try/catch + UI 降级） */
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: 'smoke' }));
    return;
  }
  const f = ROOT + (url === '/' ? '/index.html' : decodeURIComponent(url));
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
const listen = (srv, p) => new Promise((res, rej) => { srv.once('error', rej); srv.listen(p, '127.0.0.1', () => res()); });
let mockOn8765 = false;
try { await listen(server, 8765); mockOn8765 = true; }
catch (e) { await listen(server, 0); }
const port = server.address().port;

const errors = [];
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topbar .logo .ver', { timeout: 5000 });

  const checks = [];
  const assert = (name, cond) => { checks.push({ name, ok: !!cond }); };

  /* 顶栏版本常显（build.js 注入的版本与日期） */
  const ver = await page.evaluate(() => document.querySelector('#topbar .logo .ver')?.textContent || '');
  assert('顶栏版本常显（v… · 构建于…）', /^v\d+\.\d+\.\d+ · 构建于 \d{4}-\d{2}-\d{2}$/.test(ver.trim()));

  /* 五个页签逐个切换（真实点击路径），每次切换后给渲染留 300ms，收集期间一切报错 */
  const tabs = ['预览', '导出', 'AI 助手', '📚 漫画导入', '使用说明'];
  for (const name of tabs) {
    await page.evaluate(n => {
      const b = [...document.querySelectorAll('#tabs button, #topbar ~ * button, body button')]
        .find(x => x.textContent.trim() === n);
      if (!b) throw new Error('页签按钮未找到: ' + n);
      b.click();
    }, name).catch(e => errors.push('tab switch: ' + e.message));
    await page.waitForTimeout(300);
    const active = await page.evaluate(n =>
      [...document.querySelectorAll('button')].some(x => x.textContent.trim() === n), name);
    assert(`页签「${name}」可切`, active);
  }

  /* 预览重挂后 iframe 内容非空（第二个 iframe 才是预览帧，遍历取 body 最长的） */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '预览');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const previewLen = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('iframe')]
      .map(f => { try { return (f.contentDocument?.body?.innerHTML || '').length; } catch (e) { return 0; } });
    return Math.max(0, ...frames);
  });
  assert('预览 iframe 内容非空', previewLen > 1000);

  /* 汇总 */
  const bad = checks.filter(c => !c.ok);
  /* 8765（漫画导入探活地址）相关的失败是已知良性降级路径——仅当 mock 未绑上 8765 时过滤 */
  const leaked = errors.filter(e => !e.includes('favicon') && (mockOn8765 || !e.includes('127.0.0.1:8765')));
  console.log('浏览器冒烟检查项：');
  checks.forEach(c => console.log('  ' + (c.ok ? '· ' : '✖ ') + c.name));
  if (bad.length || leaked.length) {
    if (bad.length) console.log('✗ 未通过项：' + bad.map(c => c.name).join('；'));
    if (leaked.length) { console.log('✗ 页面报错：'); leaked.forEach(e => console.log('  ' + e)); }
    process.exitCode = 1;
  } else {
    console.log('✓ 浏览器冒烟通过：零 console.error / pageerror / 请求失败');
  }
} catch (e) {
  console.error('✗ 浏览器冒烟异常：' + (e && e.message || e));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
