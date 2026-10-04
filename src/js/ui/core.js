/* UI 核心壳：UI 对象定义 + renderAll + 预览四件套 + 启动代码 */
import { $, $$, esc, toast } from '../utils.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';
import { Macros } from '../macros.js';
/* 页面模块在模块顶层只做「导出方法定义」，不读 UI 值——挂载由本文件在 UI 初始化后统一执行，
 * 从而规避 ES 循环 import 的 TDZ 问题 */
import { renderConfig, renderBlockBody } from './renderConfig.js';
import { hasBridge } from './extBridge.js';
import { renderExport } from './renderExport.js';
import { renderAI } from './renderAI.js';
import { renderNh } from './renderNh.js';
import { renderHelp } from './renderHelp.js';

const UI={
  previewDebounce:null,
  _lastPreviewKey:'',
  _helpBuilt:false,
  _curGame:null,

  renderAll(){
    Macros.vars={};
    Macros.resetCache();
    /* 全入口隔离：任何一页崩了不拖垮其他页与预览 */
    try{this.renderProjectSelect()}catch(e){console.error('[工程下拉] 渲染失败',e);toast('工程下拉渲染失败：'+e.message)}
    try{this.renderConfig()}catch(e){console.error('[配置页] 渲染失败',e);toast('配置页渲染失败：'+e.message)}
    /* 各页隔离渲染：单页异常不影响其他页与预览 */
    try{this.renderExport()}catch(e){console.error('[导出页] 渲染失败',e);toast('导出页渲染失败：'+e.message)}
    try{this.renderAI()}catch(e){console.error('[AI页] 渲染失败',e);toast('AI 页渲染失败：'+e.message)}
    try{this.renderNh()}catch(e){console.error('[导入页] 渲染失败',e);toast('漫画导入页渲染失败：'+e.message)}
    try{this.renderHelp()}catch(e){console.error('[说明页] 渲染失败',e);toast('说明页渲染失败：'+e.message)}
    this.refreshPreview();
  },

  renderProjectSelect(){
    const sel=$('#projectSelect');sel.innerHTML='';
    Project.list.forEach(p=>{
      const o=document.createElement('option');o.value=p.id;o.textContent=p.name;
      if(p.id===Project.cur.id)o.selected=true;sel.appendChild(o);
    });
    sel.onchange=e=>Project.select(e.target.value);
  },

  /* slot 间 iframe id 必须唯一（配置页实时预览与预览页各挂一个）：
     同 id 违反 DOM 规范，全局 getElementById 永远命中第一个，排障与后续全局查询都会踩坑 */
  mountPreview(slot,id){
    if(!slot||slot.dataset.mounted)return;
    slot.dataset.mounted='1';
    slot.innerHTML=`<div id="previewWrap" class="preview-wrap">
      <div id="previewToolbar" class="preview-toolbar">
        <div class="seg" id="segDevice">
          <button type="button" data-v="mobile">📱 手机</button><button type="button" data-v="pc">🖥 PC</button>
        </div>
        <div class="seg" id="segTheme">
          <button type="button" data-v="dark">🌙 暗色</button><button type="button" data-v="light">☀️ 亮色</button>
        </div>
        <span style="flex:1"></span>
        <button type="button" class="btn ghost small" id="btnRefresh">↻ 刷新（重掷随机宏）</button>
      </div>
      <div id="previewStage" class="preview-stage"><iframe id="${id}" sandbox="allow-scripts allow-same-origin"></iframe></div>
    </div>`;
    $('#segDevice',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.mode=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#segTheme',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.theme=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#btnRefresh',slot).addEventListener('click',()=>{this._lastPreviewKey='';Macros.resetCache();this.refreshPreview()});
    $('#'+id,slot).addEventListener('load',()=>this.fitPreviewHeight($('#'+id,slot)));
  },

  fitPreviewHeight(frame,always){
    if(!frame)return;
    if(frame._previewRO){frame._previewRO.disconnect();frame._previewRO=null}
    if(!always&&!window.matchMedia('(max-width:900px)').matches){frame.style.height='';return}
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    const measure=()=>{
      if(!always&&!window.matchMedia('(max-width:900px)').matches){frame.style.height='';return}
      /* 只按内容高度（body）计算：documentElement.scrollHeight 至少等于 iframe 当前高度，
       * 若取两者最大值会导致高度「只增不减」。
       * srcdoc 模板的 body 带 min-height:100vh——iframe 长高会抬高内部视口、视口又抬高
       * body.scrollHeight，互相喂高（实测 4 轮后从 537px 涨到失控），故测量前摘掉它，
       * 读纯内容高度后立刻恢复（恢复只影响视觉底色的最小铺满，不参与后续测量） */
      const prevMinH=doc.body.style.minHeight;
      doc.body.style.minHeight='0';
      const h=doc.body.scrollHeight;
      doc.body.style.minHeight=prevMinH;
      frame.style.height=(h+2)+'px';
    };
    frame._previewRO=new ResizeObserver(measure);
    frame._previewRO.observe(doc.body);
    measure();
  },

  refreshPreview(){
    const p=Project.cur;if(!p)return;
    /* 只刷新当前活动页的预览，避免不可见 iframe 的重复重建开销 */
    const pg=$('.page.active');if(!pg)return;
    const frame=$('iframe[id^="previewFrame"]',pg);if(!frame)return;
    $$('#segDevice button',pg).forEach(b=>b.classList.toggle('active',b.dataset.v===p.preview.mode));
    $$('#segTheme button',pg).forEach(b=>b.classList.toggle('active',b.dataset.v===p.preview.theme));
    frame.style.width=p.preview.mode==='mobile'?'430px':'100%';
    this.fitPreviewHeight(frame);
    let comp;
    try{comp=Gen.build(p,{isPreview:true})}
    catch(e){
      console.error('[预览] 生成失败',e);
      frame.srcdoc=`<!DOCTYPE html><html><body style="background:#14161c;color:#e06c5c;font:13px/1.7 sans-serif;padding:16px;white-space:pre-wrap">⚠️ 预览生成失败：${esc(e.message)}</body></html>`;
      return;
    }
    /* 增量更新：内容+主题未变则跳过 iframe 重建（完整内容比对，避免长文本尾部改动被漏判） */
    const key=comp+'\u0000'+p.preview.theme;
    if(key===this._lastPreviewKey)return;
    this._lastPreviewKey=key;
    const tavernVars=p.preview.theme==='light'
      ?'--SmartThemeBodyColor:#eee;--SmartThemeQuoteColor:#ccc;--SmartThemeEmColor:#ffd280;--SmartThemeFont:\'Noto Sans SC\',sans-serif'
      :'--SmartThemeBodyColor:#2a2a35;--SmartThemeQuoteColor:#666;--SmartThemeEmColor:#8fa8ff;--SmartThemeFont:\'Noto Sans SC\',sans-serif';
    frame.srcdoc=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        :root{${tavernVars}}
        body{margin:0;padding:0;background:${p.preview.theme==='light'?'#f2f2f5':'#14161c'};min-height:100vh}
        .${Gen.prefix(p)}-root{padding:6px}
      </style></head><body>${comp}</body></html>`;
  },
  debouncedPreview(){clearTimeout(this.previewDebounce);this.previewDebounce=setTimeout(()=>this.refreshPreview(),300)},
};

/* 页面方法挂载（UI 初始化后执行，页面模块顶层不触碰 UI 值，循环 import 安全） */
Object.assign(UI,{renderConfig,renderBlockBody,renderExport,renderAI,renderNh,renderHelp});

/* ================================================================
 * 页签切换 + 拖拽排序 + 启动
 * ================================================================ */
/* 页签自定义顺序（localStorage 持久化；⟲ 重置随前缀清空恢复默认）。
   默认：模板配置第一、使用说明最后，其余保持声明顺序 */
const TAB_ORDER_KEY='openingPageGen_v1_tabOrder';
const TAB_DEFAULT_ORDER=['pageConfig','pagePreview','pageExport','pageAI','pageNh','pageHelp'];
function applyTabOrder(order){
  const bar=$('#tabs');
  const map={};
  $$('#tabs .tab').forEach(b=>{map[b.dataset.page]=b;b.draggable=true});
  /* 过滤未知 id + 追加缺失页签，保证每个页签恰好出现一次 */
  const valid=[...new Set((Array.isArray(order)?order:[]).filter(id=>map[id]))];
  Object.keys(map).forEach(id=>{if(!valid.includes(id))valid.push(id)});
  valid.forEach(id=>bar.appendChild(map[id]));
}
function initTabOrder(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(TAB_ORDER_KEY)||'null')}catch(e){}
  /* 无保存记录时应用默认顺序（角色卡第一、使用说明最后） */
  applyTabOrder(Array.isArray(saved)&&saved.length?saved:TAB_DEFAULT_ORDER);
  const bar=$('#tabs');
  let dragPage=null;
  bar.addEventListener('dragstart',e=>{
    const t=e.target.closest('.tab');
    if(!t)return;
    dragPage=t.dataset.page;
    t.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain',dragPage)}catch(_){}
  });
  bar.addEventListener('dragover',e=>{
    const t=e.target.closest('.tab');
    if(!t||!dragPage||t.dataset.page===dragPage)return;
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    const src=bar.querySelector(`[data-page="${dragPage}"]`);
    if(!src||src===t)return;
    /* 按拖动方向实时插入目标前/后，拖拽过程即时预览新顺序 */
    const kids=[...bar.children];
    bar.insertBefore(src,kids.indexOf(t)>kids.indexOf(src)?t.nextSibling:t);
  });
  bar.addEventListener('drop',e=>e.preventDefault());
  bar.addEventListener('dragend',()=>{
    const t=bar.querySelector('.tab.dragging');
    if(t)t.classList.remove('dragging');
    if(!dragPage)return;
    dragPage=null;
    try{localStorage.setItem(TAB_ORDER_KEY,JSON.stringify($$('#tabs .tab').map(b=>b.dataset.page)))}catch(err){}
  });
}
initTabOrder();

$$('#tabs .tab').forEach(t=>t.addEventListener('click',()=>{
  $$('#tabs .tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  $$('.page').forEach(p=>p.classList.remove('active'));
  $('#'+t.dataset.page).classList.add('active');
  if(t.dataset.page==='pagePreview'){
    /* 隐藏状态下 srcdoc 相同赋值不会触发重载，激活预览页签时换新 iframe 强制渲染 */
    const f=$('#previewFrame',$('#pagePreview'));
    if(f){
      /* 旧观察器持有已分离文档引用：换新 iframe 前先断开，防逐次切换累积泄漏 */
      if(f._previewRO){f._previewRO.disconnect();f._previewRO=null}
      const n=document.createElement('iframe');
      n.id='previewFrame';n.setAttribute('sandbox','allow-scripts allow-same-origin');
      /* 新 iframe 也要绑 load 测高：srcdoc 加载完成前 contentDocument 是 about:blank，
         ≤900px 视口下会按 0 高度钉死 2px，预览塌缩 */
      n.addEventListener('load',()=>UI.fitPreviewHeight(n));
      f.replaceWith(n);
      /* 新 iframe 无 srcdoc，必须清空增量 key，否则下方 refreshPreview 会因内容未变而跳过 → 预览页空白 */
      UI._lastPreviewKey='';
    }
  }
  /* 预览只刷活动页，切换页签后统一刷新当前页 */
  UI.refreshPreview();
  /* 导出页产物随主题/区块实时变化，页签切入时重渲染，防止复制到过期内容 */
  if(t.dataset.page==='pageExport'){try{UI.renderExport()}catch(e){toast('导出页渲染失败：'+e.message)}}
}));

Project.load();
UI.renderAll();

/* ---- 卸载兜底：saveDebounced 有 600ms 窗口，扩展内嵌的 iframe 被宿主拆毁（关 overlay/
   切聊天）或独立版关页时，窗口内输入会随上下文一起消失——pagehide 同步写一次 localStorage ---- */
window.addEventListener('pagehide',()=>{clearTimeout(Project._svT);Project.save()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')Project.save()});

/* ---- 扩展内嵌（extBridge 桥存在）时，Esc 请求宿主关闭工坊 overlay：
   iframe 获焦后宿主 document 收不到按键，只能由工具侧转发（无弹窗打开时才转发，
   避免和工具内 confirmModal/写卡弹窗的 Esc 语义打架） ---- */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  try{
    if(hasBridge()&&!document.querySelector('.opg-modal-root.show')&&!document.querySelector('#opgwc-card')){
      window.parent.postMessage({type:'opg-ext-close'},'*');
    }
  }catch(_){/* 跨域 parent 等异常静默 */}
});

/* ---- 全局键盘快捷键（key 统一小写比较：CapsLock 开启时 'S'→'s' 仍命中，且不会触发浏览器保存对话框） ---- */
document.addEventListener('keydown',e=>{
  const tag=document.activeElement?.tagName;
  const inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  const key=(e.key||'').toLowerCase();
  /* Ctrl+S → 保存 */
  if(e.ctrlKey&&key==='s'){
    e.preventDefault();
    Project.save();toast('已保存');
    return;
  }
  /* Ctrl+Y / Ctrl+Shift+Z → 重做 */
  if(e.ctrlKey&&key==='y'){
    if(!inInput&&Project.redo()){
      UI.refreshPreview();UI.renderExport();
    }
    return;
  }
  /* Ctrl+Z → 撤销（输入框内不拦截，保留浏览器原生文本撤销） */
  if(e.ctrlKey&&!e.shiftKey&&key==='z'){
    if(!inInput&&Project.undo()){
      UI.refreshPreview();UI.renderExport();
    }
    return;
  }
  /* Ctrl+Shift+Z → 重做 */
  if(e.ctrlKey&&e.shiftKey&&key==='z'){
    if(!inInput&&Project.redo()){
      UI.refreshPreview();UI.renderExport();
    }
    return;
  }
});

export {UI};