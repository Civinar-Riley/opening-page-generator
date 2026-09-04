/* UI 核心壳：UI 对象定义 + renderAll + 预览四件套 + 状态栏预览三方法 + 启动代码 */
import { $, $$, esc, toast } from '../utils.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';
import { Macros } from '../macros.js';
/* 页面模块在模块顶层只做「导出方法定义」，不读 UI 值——挂载由本文件在 UI 初始化后统一执行，
 * 从而规避 ES 循环 import 的 TDZ 问题 */
import { renderConfig, renderBlockBody } from './renderConfig.js';
import { renderStatus, applySbStageBg, refreshStatusPreview, debouncedSbPreview, refreshStatusExportCard } from './renderStatus.js';
import { renderExport } from './renderExport.js';
import { renderAI } from './renderAI.js';
import { renderHelp } from './renderHelp.js';

const UI={
  previewDebounce:null,
  _lastPreviewKey:'',
  /* 状态栏预览内存态（renderStatus 页签内共享） */
  _sbPreviewMode:'mobile',
  _sbPreviewBg:'dark',
  _lastSbPreviewKey:'',
  sbPreviewDebounce:null,
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
    try{this.renderStatus()}catch(e){console.error('[状态栏页] 渲染失败',e);toast('状态栏页渲染失败：'+e.message)}
    try{this.renderAI()}catch(e){console.error('[AI页] 渲染失败',e);toast('AI 页渲染失败：'+e.message)}
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

  mountPreview(slot){
    if(!slot||slot.dataset.mounted)return;
    slot.dataset.mounted='1';
    slot.innerHTML=`<div id="previewWrap" class="preview-wrap">
      <div id="previewToolbar" class="preview-toolbar">
        <div class="seg" id="segDevice">
          <button data-v="mobile">📱 手机</button><button data-v="pc">🖥 PC</button>
        </div>
        <div class="seg" id="segTheme">
          <button data-v="dark">🌙 暗色</button><button data-v="light">☀️ 亮色</button>
        </div>
        <span style="flex:1"></span>
        <button class="btn ghost small" id="btnRefresh">↻ 刷新（重掷随机宏）</button>
      </div>
      <div id="previewStage" class="preview-stage"><iframe id="previewFrame" sandbox="allow-scripts allow-same-origin"></iframe></div>
    </div>`;
    $('#segDevice',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.mode=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#segTheme',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.theme=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#btnRefresh',slot).addEventListener('click',()=>{this._lastPreviewKey='';Macros.resetCache();this.refreshPreview()});
    $('#previewFrame',slot).addEventListener('load',()=>this.fitPreviewHeight($('#previewFrame',slot)));
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
       * 若取两者最大值会导致高度「只增不减」 */
      frame.style.height=(doc.body.scrollHeight+2)+'px';
    };
    frame._previewRO=new ResizeObserver(measure);
    frame._previewRO.observe(doc.body);
    measure();
  },

  refreshPreview(){
    const p=Project.cur;if(!p)return;
    /* 只刷新当前活动页的预览，避免不可见 iframe 的重复重建开销 */
    const pg=$('.page.active');if(!pg)return;
    const frame=$('#previewFrame',pg);if(!frame)return;
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
      ?'--SmartThemeBodyColor:#eee;--SmartThemeQuoteColor:#ccc'
      :'--SmartThemeBodyColor:#2a2a35;--SmartThemeQuoteColor:#666';
    frame.srcdoc=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        :root{${tavernVars}}
        body{margin:0;padding:0;background:${p.preview.theme==='light'?'#f2f2f5':'#14161c'};min-height:100vh}
        .${Gen.prefix(p)}-root{padding:6px}
      </style></head><body>${comp}</body></html>`;
  },
  debouncedPreview(){clearTimeout(this.previewDebounce);this.previewDebounce=setTimeout(()=>this.refreshPreview(),300)},
};

/* 页面方法挂载（UI 初始化后执行，页面模块顶层不触碰 UI 值，循环 import 安全） */
Object.assign(UI,{renderConfig,renderBlockBody,renderStatus,applySbStageBg,refreshStatusPreview,debouncedSbPreview,refreshStatusExportCard,renderExport,renderAI,renderHelp});

/* ================================================================
 * 页签切换 + 启动
 * ================================================================ */
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
      f.replaceWith(n);
      /* 新 iframe 无 srcdoc，必须清空增量 key，否则下方 refreshPreview 会因内容未变而跳过 → 预览页空白 */
      UI._lastPreviewKey='';
    }
  }
  /* 预览只刷活动页，切换页签后统一刷新当前页 */
  UI.refreshPreview();
  /* 状态栏页预览走独立 iframe，页签切入时强制刷新 */
  if(t.dataset.page==='pageStatus')UI.refreshStatusPreview(true);
  /* 导出页产物随主题/区块实时变化，页签切入时重渲染，防止复制到过期内容 */
  if(t.dataset.page==='pageExport'){try{UI.renderExport()}catch(e){toast('导出页渲染失败：'+e.message)}}
}));

Project.load();
UI.renderAll();

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
      UI.refreshPreview();UI.renderExport();UI.refreshStatusExportCard();
    }
    return;
  }
  /* Ctrl+Z → 撤销（输入框内不拦截，保留浏览器原生文本撤销） */
  if(e.ctrlKey&&!e.shiftKey&&key==='z'){
    if(!inInput&&Project.undo()){
      UI.refreshPreview();UI.renderExport();UI.refreshStatusExportCard();
    }
    return;
  }
  /* Ctrl+Shift+Z → 重做 */
  if(e.ctrlKey&&e.shiftKey&&key==='z'){
    if(!inInput&&Project.redo()){
      UI.refreshPreview();UI.renderExport();UI.refreshStatusExportCard();
    }
    return;
  }
});

export {UI};