/* 开场页工坊——SillyTavern 扩展入口。
   职责仅两件事：① 扩展抽屉加「打开工坊」按钮 → 全屏 overlay 内嵌 tool.html（本仓库构建产物）；
   ② 注入 window.__OPG_EXT__ 桥（listCards / writeToCard），供工具 iframe 内的
   「导出页 → 写入角色卡」调用（见 src/js/ui/extBridge.js）。
   全程走 SillyTavern.getContext() 全局入口，不做 ST 内部模块相对导入（官方明示随时可能变）。 */

const EXT_ID = 'opening-page-generator';
const BRIDGE_VERSION = '1.12.0';

function ctx() {
  try { return window.SillyTavern && typeof window.SillyTavern.getContext === 'function' ? window.SillyTavern.getContext() : null; }
  catch (e) { return null; }
}

/* ---------- 桥：角色卡列表与写入（/api/characters/merge-attributes，数组整体替换故追加须先读后写） ---------- */
function listCards() {
  const c = ctx();
  const list = (c && Array.isArray(c.characters)) ? c.characters : [];
  return list.map(ch => ({
    name: String(ch.name || ch.data?.name || ch.avatar || ''),
    avatar: String(ch.avatar || ''),
    alternateGreetings: (ch.data?.alternate_greetings) || ch.alternate_greetings || [],
  })).filter(x => x.avatar);
}

async function writeToCard(avatar, mode, content) {
  const c = ctx();
  if (!c || typeof c.getRequestHeaders !== 'function') return { ok: false, message: '未获取到酒馆上下文（getRequestHeaders），无法写入' };
  const payload = { avatar, data: {} };
  if (mode === 'first_mes') {
    payload.data.first_mes = content;
  } else if (mode === 'append_greeting') {
    const cur = (c.characters || []).find(x => x.avatar === avatar);
    const alts = (cur?.data?.alternate_greetings) || cur?.alternate_greetings || [];
    payload.data.alternate_greetings = [...alts, content];
  } else {
    return { ok: false, message: '未知写入目标：' + mode };
  }
  const response = await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: c.getRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let msg = 'HTTP ' + response.status;
    try { const err = await response.json(); if (err && err.message) msg += '：' + err.message; } catch (e) { /* 忽略非 JSON 响应体 */ }
    return { ok: false, message: msg };
  }
  /* 写后刷新角色列表缓存（getContext().getCharacters 非全版本都有，守卫调用） */
  try { if (typeof c.getCharacters === 'function') await c.getCharacters(); } catch (e) { console.warn('[开场页工坊] 刷新角色列表失败', e); }
  return { ok: true, message: mode === 'first_mes' ? '已覆盖主开场白（新聊天生效）' : '已追加为新开场白' };
}

window.__OPG_EXT__ = { version: BRIDGE_VERSION, listCards, writeToCard };

/* ---------- UI：扩展抽屉面板 + 全屏 overlay ---------- */
function openWorkshop() {
  if (document.getElementById('opg-ext-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'opg-ext-overlay';
  /* 模块加载下 document.currentScript 为 null，以 import.meta.url 定位：
     本文件在 ext/ 子目录，工具产物 tool.html 在仓库根（= 扩展目录），故取 ../tool.html
     （catch 仅兜 URL 构造异常，回落标准挂载路径） */
  let toolUrl;
  try { toolUrl = new URL('../tool.html', import.meta.url).href; }
  catch (e) { toolUrl = `/scripts/extensions/third-party/${EXT_ID}/tool.html`; }
  ov.innerHTML = `<div class="opg-ext-bar">
      <span class="opg-ext-title">📜 开场页工坊</span>
      <span class="opg-ext-hint">在酒馆内直接编排开场页，导出页可一键写入角色卡</span>
      <button type="button" class="menu_button opg-ext-close" title="关闭（Esc）">✕ 关闭</button>
    </div>
    <iframe class="opg-ext-frame" src="${toolUrl}"></iframe>`;
  document.body.appendChild(ov);
  document.body.classList.add('opg-ext-lock');
  ov.querySelector('.opg-ext-close').addEventListener('click', closeWorkshop);
  document.addEventListener('keydown', onEsc);
}

function closeWorkshop() {
  const ov = document.getElementById('opg-ext-overlay');
  if (ov) ov.remove();
  document.body.classList.remove('opg-ext-lock');
  document.removeEventListener('keydown', onEsc);
}

function onEsc(e) { if (e.key === 'Escape') closeWorkshop(); }

function mountPanel() {
  const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
  if (!host || document.getElementById('opg-ext-panel')) return false;
  const panel = document.createElement('div');
  panel.className = 'inline-drawer';
  panel.id = 'opg-ext-panel';
  panel.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header">
      <b>📜 开场页工坊</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <div class="opg-ext-desc">可视化编排 SillyTavern 开场页（24 种区块 / 6 套主题 / 12 套模板），生成酒馆助手可渲染的自包含 HTML。工坊内「导出 → 写入角色卡」可直写当前酒馆的角色卡。</div>
      <button type="button" id="opg-ext-open" class="menu_button">📜 打开开场页工坊</button>
    </div>`;
  host.appendChild(panel);
  panel.querySelector('#opg-ext-open').addEventListener('click', openWorkshop);
  return true;
}

/* 扩展抽屉 DOM 就绪时机不定（扩展加载早于抽屉渲染）：轮询等待挂载点 */
(function waitHost() {
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (mountPanel() || tries > 100) clearInterval(timer);
  }, 200);
})();
