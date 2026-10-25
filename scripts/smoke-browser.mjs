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
    const active = await page.evaluate(n => {
      const tab = [...document.querySelectorAll('#tabs .tab')].find(x => x.textContent.trim() === n);
      return !!tab?.classList.contains('active') && document.getElementById(tab.dataset.page)?.classList.contains('active');
    }, name);
    assert(`页签「${name}」可切`, active);
  }

  /* 只检查活动预览帧，避免隐藏的配置页预览掩盖当前页空白。 */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '预览');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const previewLen = await page.evaluate(() => (document.querySelector('#pagePreview.active iframe')?.contentDocument?.body?.innerHTML || '').length);
  assert('活动预览 iframe 内容非空', previewLen > 1000);

  /* 明暗切换后返回配置页，两帧的实际底色须与共享设置一致。 */
  await page.locator('#pagePreview [data-v="light"]').click();
  await page.waitForFunction(() => {
    const f = document.querySelector('#pagePreview iframe');
    return f?.contentDocument?.body && f.contentWindow.getComputedStyle(f.contentDocument.body).backgroundColor === 'rgb(242, 242, 245)';
  });
  await page.locator('#tabs [data-page="pageConfig"]').click();
  await page.waitForFunction(() => {
    const f = document.querySelector('#previewFrameLive');
    return f?.contentDocument?.body && f.contentWindow.getComputedStyle(f.contentDocument.body).backgroundColor === 'rgb(242, 242, 245)';
  });
  assert('返回配置页后预览底色同步', true);

  const themes = await page.locator('#themeSelect option').evaluateAll(opts => opts.map(o => ({ id: o.value, name: o.textContent })));
  assert('工具主题包含七套', themes.length === 7 && themes.some(t => t.id === 'velvet') && themes.some(t => t.id === 'moonstone'));
  for (const { id, name } of themes) {
    await page.locator('#themeSelect').selectOption(id);
    const state = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('openingPageGen_theme') }));
    assert(`工具主题「${name}」切换并保存`, state.theme === (id === 'bronze' ? null : id) && state.saved === id);
  }
  for (const id of ['velvet', 'moonstone']) {
    await page.locator('#themeSelect').selectOption(id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#themeSelect option[value="moonstone"]', { state: 'attached' });
    const restored = await page.evaluate(id => document.documentElement.dataset.theme === id && document.querySelector('#themeSelect').value === id, id);
    assert(`工具主题 ${id} 刷新后恢复`, restored);
    await page.setViewportSize({ width: 430, height: 932 });
    const layout = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement), tabs = document.querySelector('#tabs');
      const strip = getComputedStyle(tabs), text = getComputedStyle(tabs.querySelector('.tab'));
      return { dark: root.colorScheme === 'dark', noOverflow: document.documentElement.scrollWidth <= innerWidth, singleLine: text.whiteSpace === 'nowrap', scrollable: strip.overflowX === 'auto' };
    });
    assert(`工具主题 ${id} 窄屏深色与单行页签`, layout.dark && layout.noOverflow && layout.singleLine && layout.scrollable);
    await page.locator('[data-action="project-rename"]').click();
    await page.locator('.opg-modal-root.show').waitFor();
    const modal = await page.locator('.opg-modal-box').evaluate(el => {
      const root = getComputedStyle(document.documentElement), style = getComputedStyle(el), rect = el.getBoundingClientRect();
      const expected = root.getPropertyValue('--panel').trim().slice(1).match(/../g).map(v => parseInt(v, 16));
      return { themed: style.backgroundColor === `rgb(${expected.join(', ')})`, fits: rect.left >= 0 && rect.right <= innerWidth, onTop: el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    });
    assert(`工具主题 ${id} 弹窗随主题且无纹理遮挡`, modal.themed && modal.fits && modal.onTop);
    await page.locator('.opg-modal-cancel').click();
    await page.locator('#themeSelect').focus();
    await page.keyboard.press('Tab');
    /* 按钮 transition:all 会渐变 outline，须等待最终焦点样式再断言。 */
    await page.waitForFunction(() => {
      const el = document.activeElement, style = getComputedStyle(el);
      return el.matches(':focus-visible') && style.outlineWidth === '2px' && style.outlineStyle === 'solid';
    });
    assert(`工具主题 ${id} 键盘焦点清晰`, true);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await page.evaluate(() => localStorage.setItem('openingPageGen_theme', 'unknown-theme'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#themeSelect option[value="bronze"]', { state: 'attached' });
  assert('无效工具主题回落暖铜金', await page.evaluate(() => !document.documentElement.hasAttribute('data-theme') && document.querySelector('#themeSelect').value === 'bronze'));

  /* —— v1.24 主题风格卡：试穿/套用/自定义标识/撤销/对比度警示 —— */
  await page.locator('#tabs [data-page="pageConfig"]').click();
  await page.waitForTimeout(300);
  assert('预设试穿卡渲染 6 张', await page.locator('.thpg .thp').count() === 6);
  /* 悬停试穿：预览切到荆棘王室背景，但工程数据不落盘（试穿只动预览覆写） */
  await page.locator('.thpg .thp').nth(1).hover();
  await page.waitForFunction(() => (document.querySelector('#previewFrameLive')?.srcdoc || '').includes('#1e0b12'), null, { timeout: 5000 }).catch(() => {});
  assert('悬停试穿：预览切到荆棘王室背景', await page.evaluate(() => (document.querySelector('#previewFrameLive')?.srcdoc || '').includes('#1e0b12')));
  assert('悬停试穿：工程数据未落盘', await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('openingPageGen_v1_projects') || '[]');
    return (p[0]?.theme?.primary || '') === '#7c6cf0';
  }));
  /* 移出还原 */
  await page.mouse.move(10, 420);
  await page.waitForFunction(() => (document.querySelector('#previewFrameLive')?.srcdoc || '').includes('#1a1a2e'), null, { timeout: 5000 }).catch(() => {});
  assert('移出试穿卡：预览还原默认背景', await page.evaluate(() => (document.querySelector('#previewFrameLive')?.srcdoc || '').includes('#1a1a2e')));
  /* 点击套用：落盘 + 选中态标识 */
  await page.locator('.thpg .thp').nth(1).click();
  await page.waitForTimeout(400);
  assert('点击套用：数据落盘且 presetRef 记录', await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('openingPageGen_v1_projects') || '[]');
    return p[0]?.theme?.primary === '#8c1f3f' && p[0]?.theme?.bg?.color === '#1e0b12' && p[0]?.theme?.presetRef === '荆棘王室';
  }));
  assert('套用后显示当前预设选中态', await page.evaluate(() => (document.querySelector('.thstat')?.textContent || '').includes('当前预设：荆棘王室') && !!document.querySelector('.thp-sel')));
  /* 微调偏离 → 「已自定义（基于 X）」标识 */
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.primary"]');
    inp.value = '#123456';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  assert('偏离预设后标「已自定义（基于 X）」', await page.evaluate(() => (document.querySelector('.thstat-mod')?.textContent || '').includes('已自定义（基于 荆棘王室）')));
  /* 主题输入入撤销栈：Ctrl+Z 回退主色（undo 后 renderConfig 重渲染，读输入框值） */
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })));
  await page.waitForTimeout(400);
  assert('Ctrl+Z 撤销主题微调回预设色', await page.evaluate(() => document.querySelector('[data-bind="theme.primary"]')?.value === '#8c1f3f'));
  /* 对比度警示：文字色调到深色即时出现警示条，调回近白消失 */
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.textColor"]');
    inp.value = '#222226';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const warnShown = await page.evaluate(() => (document.querySelector('.thwarn')?.textContent || '').includes('4.5'));
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.textColor"]');
    inp.value = '#f0f0f5';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const warnGone = await page.evaluate(() => !document.querySelector('.thwarn'));
  assert('对比度警示即时出现与消失', warnShown && warnGone);

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
