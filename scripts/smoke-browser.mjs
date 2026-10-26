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
const checks = [];
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topbar .logo .ver', { timeout: 5000 });

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

  /* 页面主题：从真实卡片/输入操作驱动，不直写工程数据；落盘和 iframe 加载分别等待。 */
  const pageThemes = [
    { index: 0, name: '紫夜幻金', skin: 'nebula', primary: '#7c6cf0', bg: '#161228', headingFont: 'Noto Serif SC', radius: 12, texture: 'repeating-conic-gradient(from 0deg at 86% -6%' },
    { index: 1, name: '荆棘王室', skin: 'royal', primary: '#be6078', bg: '#190e16', headingFont: 'Noto Serif SC', radius: 3, texture: 'repeating-linear-gradient(45deg' },
    { index: 2, name: '狐火缘日', skin: 'festival', primary: '#e59065', bg: '#181b19', headingFont: 'KaiTi', radius: 8, texture: 'radial-gradient(ellipse at 100% 0' },
    { index: 3, name: '蓝电义体', skin: 'cyber', primary: '#62c9e5', bg: '#09131e', headingFont: 'Bahnschrift', radius: 2, texture: 'transparent 1px 28px' },
    { index: 4, name: '渊语回廊', skin: 'abyss', primary: '#72aaa5', bg: '#091a1d', headingFont: 'Noto Serif SC', radius: 22, texture: 'repeating-radial-gradient' },
    { index: 5, name: '档案机', skin: 'archive', primary: '#b6ab96', bg: '#191815', headingFont: 'Courier New', radius: 0, texture: 'transparent 0 27px' },
  ];
  const readSaved = () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('openingPageGen_v1_projects') || '[]');
    return projects.find(p => p.id === localStorage.getItem('openingPageGen_v1_current'));
  });
  const waitSaved = expected => page.waitForFunction(fields => {
    const projects = JSON.parse(localStorage.getItem('openingPageGen_v1_projects') || '[]');
    const p = projects.find(p => p.id === localStorage.getItem('openingPageGen_v1_current'));
    return p && Object.entries(fields).every(([key, value]) => p.theme[key] === value);
  }, expected, { timeout: 5000 });
  const readPreview = () => page.evaluate(() => {
    const frame = document.querySelector('#previewFrameLive'), doc = frame?.contentDocument;
    const root = doc?.querySelector('div[id^="opg-"]'), px = root?.id;
    const wrap = px && doc.querySelector('.' + px + '-wrap'), title = px && doc.querySelector('.' + px + '-title');
    return {
      css: root?.querySelector('style')?.textContent || '',
      background: wrap ? frame.contentWindow.getComputedStyle(wrap).backgroundImage : '',
      radius: wrap ? frame.contentWindow.getComputedStyle(wrap).borderRadius : '',
      headingFont: title ? frame.contentWindow.getComputedStyle(title).fontFamily : '',
      width: frame?.getBoundingClientRect().width || 0,
      noOverflow: !!wrap && doc.documentElement.scrollWidth <= frame.contentWindow.innerWidth && wrap.scrollWidth <= wrap.clientWidth + 1,
    };
  });
  const waitPreview = expected => page.waitForFunction(({ skin, bg, headingFont }) => {
    const doc = document.querySelector('#previewFrameLive')?.contentDocument;
    const css = doc?.querySelector('div[id^="opg-"] style')?.textContent || '';
    return css.includes(bg) && (skin === 'classic' ? !css.includes('theme-skin:') : css.includes('theme-skin:' + skin)) && (!headingFont || css.includes('font-family:"' + headingFont + '"'));
  }, expected, { timeout: 5000 });
  const leavePreset = () => page.locator('#configCol h3').first().hover();
  const applyPreset = async index => {
    await page.locator(`.thpg [data-preset="${index}"]`).click();
    await leavePreset();
  };
  const presetStatus = () => page.evaluate(() => ({
    text: document.querySelector('.thstat')?.textContent || '',
    modified: !!document.querySelector('.thstat-mod'),
    selected: [...document.querySelectorAll('.thp-sel')].map(el => +el.dataset.preset),
    pressed: [...document.querySelectorAll('.thp[aria-pressed="true"]')].map(el => +el.dataset.preset),
  }));
  const hasPreset = async index => {
    const state = await presetStatus();
    return !state.modified && state.selected.length === 1 && state.selected[0] === index && state.pressed.length === 1 && state.pressed[0] === index;
  };
  const isCustom = async name => {
    const state = await presetStatus();
    return state.modified && state.text.includes('已自定义（基于 ' + name + '）') && !state.selected.length && !state.pressed.length;
  };
  const historyKey = async key => {
    /* 输入框原生撤销不应被工具拦截；明确失焦后测试工程级快捷键。 */
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+' + key);
  };
  await page.locator('#tabs [data-page="pageConfig"]').click();
  assert('预设试穿卡渲染 6 张', await page.locator('.thpg .thp').count() === 6);
  const initialProject = await readSaved(), initialBlocks = JSON.stringify(initialProject.blocks);
  await page.locator('.thpg [data-preset="1"]').hover();
  await waitPreview(pageThemes[1]);
  assert('悬停试穿：荆棘新背景、材质与字体生效但工程不落盘', JSON.stringify(await readSaved()) === JSON.stringify(initialProject));
  await leavePreset();
  await waitPreview({ skin: 'classic', bg: '#1a1a2e' });
  assert('移出试穿卡：默认背景恢复且无新材质残留', !(await readPreview()).css.includes('theme-skin:'));

  await applyPreset(1);
  await waitPreview(pageThemes[1]);
  const royal = await readSaved();
  assert('点击套用：荆棘新配色落盘且 presetRef 记录', royal.theme.primary === '#be6078' && royal.theme.bg.color === '#190e16' && royal.theme.presetRef === '荆棘王室');
  assert('套用后显示当前预设选中态', await hasPreset(1));
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.primary"]');
    inp.value = '#123456';inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert('偏离配色即时标「已自定义（基于 X）」', await isCustom('荆棘王室'));
  await historyKey('z');
  await waitPreview(pageThemes[1]);
  assert('Ctrl+Z 撤销主题微调回新预设色', await page.locator('[data-bind="theme.primary"]').inputValue() === '#be6078');
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.textColor"]');
    inp.value = '#222226';inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const warnShown = await page.evaluate(() => (document.querySelector('.thwarn')?.textContent || '').includes('4.5'));
  await page.evaluate(() => {
    const inp = document.querySelector('[data-bind="theme.textColor"]');
    inp.value = '#f5ece6';inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert('对比度警示即时出现与消失', warnShown && await page.locator('.thwarn').count() === 0);

  const backgrounds = [];
  for (const t of pageThemes) {
    await applyPreset(t.index);
    await waitSaved({ skin: t.skin, headingFont: t.headingFont, fontName: '', presetRef: t.name });
    await waitPreview(t);
    const p = await readSaved(), preview = await readPreview();
    backgrounds.push(preview.background);
    assert(`页面主题「${t.name}」实际套用并保存皮肤/字体/配色`, p.theme.primary === t.primary && p.theme.bg.color === t.bg && p.theme.radius === t.radius && JSON.stringify(p.blocks) === initialBlocks && await hasPreset(t.index));
    assert(`页面主题「${t.name}」预览显示独立纹理与字体`, preview.css.includes(t.texture) && preview.headingFont.includes(t.headingFont) && preview.radius === t.radius + 'px');
    assert(`页面主题「${t.name}」430px 产物内部无横向溢出`, preview.width === 430 && preview.noOverflow);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.thpg [data-preset="5"]');
    await waitPreview(t);
    assert(`页面主题「${t.name}」刷新恢复皮肤与标题字体`, await page.locator('[data-bind="theme.skin"]').inputValue() === t.skin && await page.locator('[data-bind="theme.headingFont"]').inputValue() === t.headingFont && await hasPreset(t.index));
    await page.setViewportSize({ width: 430, height: 932 });
    const narrow = await page.evaluate(() => {
      const grid = document.querySelector('.thpg').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && grid.left >= 0 && grid.right <= innerWidth;
    });
    assert(`页面主题「${t.name}」430px 工具卡片及预览无横向溢出`, narrow && (await readPreview()).noOverflow);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  assert('六套页面主题的实际渲染背景均非空且互不相同', backgrounds.every(v => v && v !== 'none') && new Set(backgrounds).size === 6);

  await applyPreset(1);
  await waitPreview(pageThemes[1]);
  await page.locator('[data-bind="theme.skin"]').selectOption('classic');
  assert('材质自定义即时取消预设选中态', await isCustom('荆棘王室'));
  await waitPreview({ skin: 'classic', bg: '#190e16' });
  await waitSaved({ skin: 'classic' });
  assert('手动关闭材质保留字体但移除王室纹理', !(await readPreview()).css.includes(pageThemes[1].texture) && (await readSaved()).theme.headingFont === 'Noto Serif SC');
  await page.locator('[data-bind="theme.skin"]').selectOption('royal');
  assert('材质改回后即时恢复预设选中态', await hasPreset(1));
  await waitSaved({ skin: 'royal' });

  await page.locator('[data-bind="theme.headingFont"]').fill('Smoke Heading');
  assert('标题字体自定义即时取消预设选中态', await isCustom('荆棘王室'));
  await waitSaved({ headingFont: 'Smoke Heading' });
  await historyKey('z');
  await waitSaved({ headingFont: 'Noto Serif SC' });
  assert('撤销标题字体自定义恢复值和预设选中态', await page.locator('[data-bind="theme.headingFont"]').inputValue() === 'Noto Serif SC' && await hasPreset(1));
  const installedFont = await page.locator('#fontPicker option').evaluateAll(opts => opts.find(o => o.value && o.value !== '__custom__')?.value);
  if (!installedFont) throw new Error('正文字体下拉没有可选择的已检测字体');
  await page.locator('#fontPicker').selectOption(installedFont);
  assert('正文字体下拉切换即时取消预设选中态', await isCustom('荆棘王室'));
  await waitSaved({ fontName: installedFont });
  await page.locator('#fontPicker').selectOption('');
  assert('正文字体恢复系统默认即时匹配原预设', await hasPreset(1));
  await waitSaved({ fontName: '' });
  await page.locator('#fontPicker').selectOption('__custom__');
  await page.locator('#fontCustomInput').fill('Smoke Body');
  assert('手填正文字体即时取消预设选中态', await isCustom('荆棘王室'));
  await page.locator('[data-bind="theme.headingFont"]').fill('Smoke Heading');
  await waitSaved({ skin: 'royal', fontName: 'Smoke Body', headingFont: 'Smoke Heading' });
  await waitPreview({ ...pageThemes[1], headingFont: 'Smoke Heading' });
  const customProject = await readSaved(), customPreview = await readPreview();
  assert('自定义正文字体与标题字体进入预览', customPreview.css.includes('font-family:"Smoke Body"') && customPreview.headingFont.includes('Smoke Heading'));

  /* 紫夜试穿 patch 须复位材质与两类字体；不能只换配色而继承上一套材质/字体。 */
  await page.locator('.thpg [data-preset="0"]').hover();
  await waitPreview(pageThemes[0]);
  const purplePreview = await readPreview();
  assert('紫夜试穿无材质和自定义字体残留，工程仍为自定义荆棘', !purplePreview.css.includes('Smoke Body') && !purplePreview.css.includes('Smoke Heading') && !purplePreview.css.includes(pageThemes[1].texture) && purplePreview.css.includes(pageThemes[0].texture) && JSON.stringify(await readSaved()) === JSON.stringify(customProject));
  await leavePreset();
  await waitPreview({ ...pageThemes[1], headingFont: 'Smoke Heading' });
  assert('退出紫夜试穿恢复完整自定义样式', (await readPreview()).css === customPreview.css && await isCustom('荆棘王室'));
  await applyPreset(0);
  await waitSaved({ skin: 'nebula', fontName: '', headingFont: 'Noto Serif SC', presetRef: '紫夜幻金' });
  await waitPreview(pageThemes[0]);
  assert('切回紫夜恢复星穹材质与预设字体且与试穿样式一致', (await readPreview()).css === purplePreview.css && await hasPreset(0) && await page.locator('[data-bind="theme.skin"]').inputValue() === 'nebula' && await page.locator('[data-bind="theme.headingFont"]').inputValue() === 'Noto Serif SC' && await page.locator('#fontPicker').inputValue() === '');
  await historyKey('z');
  await waitSaved({ skin: 'royal', fontName: 'Smoke Body', headingFont: 'Smoke Heading' });
  await waitPreview({ ...pageThemes[1], headingFont: 'Smoke Heading' });
  assert('撤销切回紫夜恢复上套材质/字体/自定义状态', JSON.stringify((await readSaved()).theme) === JSON.stringify(customProject.theme) && (await readPreview()).css === customPreview.css && await isCustom('荆棘王室'));
  await historyKey('y');
  await waitSaved({ skin: 'nebula', fontName: '', headingFont: 'Noto Serif SC', presetRef: '紫夜幻金' });
  await waitPreview(pageThemes[0]);
  assert('重做切回紫夜没有材质残留且始终不改区块内容', (await readPreview()).css === purplePreview.css && JSON.stringify((await readSaved()).blocks) === initialBlocks && await hasPreset(0));

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
  /* 异常时也回放已完成项：否则只看到超时，无法定位是哪一步。 */
  if (checks.length) {
    console.log('浏览器冒烟已完成项（异常中断前）：');
    checks.forEach(c => console.log('  ' + (c.ok ? '· ' : '✖ ') + c.name));
  }
  console.error('✗ 浏览器冒烟异常：' + (e && e.message || e));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
