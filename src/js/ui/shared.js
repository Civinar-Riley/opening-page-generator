/* UI 通用辅助（跨页面模块复用）：列表编辑器 / 字体检测 / 导入弹窗 / 行拖拽 */
import { confirmModal } from '../utils.js';
import { detectAvailableFonts } from '../fontdetect.js';

/* ================================================================
 * 通用列表编辑器：统一「添加 / 删除（带确认）/ 字段输入」事件委托，
 * 供 角色列表 / 图片列表 / 曲目列表 等单层可编辑列表复用
 * ================================================================ */
/**
 * @param {HTMLElement} container - 列表容器（事件委托挂载点）
 * @param {Array<object>} items - 绑定的数据数组（原地修改）
 * @param {object} opts
 * @param {string} opts.delAttr - 删除按钮 dataset 键，值为条目索引（如 chardel → data-chardel）
 * @param {string} opts.addAttr - 添加按钮 dataset 键（如 charadd → data-charadd）
 * @param {string} opts.fieldAttr - 字段输入 dataset 键，值格式 "索引.字段名"（如 charf → data-charf）
 * @param {Function} opts.build - 重建容器 HTML（增删后调用）
 * @param {string} [opts.confirmMsg] - 删除确认文案；缺省则不弹确认
 * @param {Function} opts.createItem - 新条目工厂函数
 * @param {Function} [opts.afterDel] - 删除后回调（build 之后）
 * @param {Function} [opts.afterAdd] - 添加后回调（build 之后）
 * @param {Function} [opts.afterInput] - 字段输入后回调
 */
export function bindListEditor(container,items,{delAttr,addAttr,fieldAttr,build,confirmMsg,createItem,afterDel,afterAdd,afterInput}){
  container.addEventListener('click',async e=>{
    const d=e.target.dataset[delAttr];
    if(d!==undefined){
      if(confirmMsg&&!await confirmModal(confirmMsg))return;
      items.splice(+d,1);
      build();
      if(afterDel)afterDel();
      return;
    }
    if(e.target.dataset[addAttr]){
      items.push(createItem());
      build();
      if(afterAdd)afterAdd();
    }
  });
  container.addEventListener('input',e=>{
    const f=e.target.dataset[fieldAttr];
    if(f===undefined)return;
    const[idx,k]=f.split('.');
    if(!items[+idx])return;
    items[+idx][k]=e.target.value;
    if(afterInput)afterInput();
  });
}

/* 会话级字体检测缓存：字体环境不变，避免每次 renderConfig 重复 66 次 measureText */
let _detectedFonts=null;
export function detectFonts(){
  if(_detectedFonts)return _detectedFonts;
  /* 纯逻辑在 fontdetect.js（可测）；这里仅在边界做 DOM 创建 + 会话缓存 */
  const ctx=document.createElement('canvas').getContext('2d');
  _detectedFonts=detectAvailableFonts(ctx);
  return _detectedFonts;
}

/* 状态栏示例文本导入弹窗：返回粘贴的文本或 null（取消） */
export function sbImportModal(){
  return new Promise(resolve=>{
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(560px,92vw)';
    box.innerHTML=`<div style="font-weight:700;margin-bottom:8px">📥 从示例文本导入字段</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:8px">粘贴一段现成的纯文字状态栏（「字段：值」逐行，或 &lt;标签&gt; 包裹块，兼容 YAML 缩进/列表）。自动识别模式并解析出字段与示例值，导入后可继续编辑。</div>
      <textarea id="sbImportText" style="width:100%;min-height:200px;box-sizing:border-box;font-family:Consolas,monospace;font-size:12px" placeholder="角色名称：林晚晴　当前时间：周五傍晚　……（每行一个字段）"></textarea>
      <div style="text-align:right;margin-top:10px;display:flex;justify-content:flex-end;gap:8px">
        <button type="button" class="btn ghost small" data-sbimp-close>取消</button>
        <button type="button" class="btn small" data-sbimp-ok>导入</button>
      </div>`;
    ov.appendChild(box);document.body.appendChild(ov);
    box.addEventListener('click',e=>{
      if(e.target.dataset.sbimpClose!==undefined){ov.remove();resolve(null)}
      if(e.target.dataset.sbimpOk!==undefined){
        const v=box.querySelector('#sbImportText').value;
        ov.remove();resolve(v);
      }
    });
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();resolve(null)}});
  });
}

/* 通用行拖拽排序：桌面把手拖拽（mousedown 启用 draggable 防误触）+ 触屏长按，
 * 交互逻辑从开场页区块拖拽移植 */
export function bindListDrag(list,{itemSel,handleSel,onSwap}){
  let dragIdx=-1;
  /* 桌面：把手按下才临时开启 draggable（HTML5 拖拽必需），松手/拖完即清除；
     没有这一步 dragstart 永远不触发，桌面拖拽整体失效 */
  list.addEventListener('mousedown',e=>{
    const h=e.target.closest(handleSel);if(!h)return;
    const row=h.closest(itemSel);if(row)row.setAttribute('draggable','true');
  });
  const clearMarks=()=>{
    list.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    list.querySelectorAll('[draggable]').forEach(el=>{el.removeAttribute('draggable');if(!el.style.opacity||el.style.opacity==='.45')el.style.opacity=''});
  };
  list.addEventListener('dragstart',e=>{
    const t=e.target.closest(itemSel);if(!t)return;
    dragIdx=[...list.children].indexOf(t);
    t.style.opacity='.45';
    try{e.dataTransfer.setData('text/plain','')}catch(_){}
    e.dataTransfer.effectAllowed='move';
  });
  list.addEventListener('dragover',e=>{
    if(dragIdx<0)return;e.preventDefault();
    list.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    const t=e.target.closest(itemSel);
    if(t&&[...list.children].indexOf(t)!==dragIdx)t.classList.add('drag-over');
  });
  list.addEventListener('drop',e=>{
    if(dragIdx<0)return;e.preventDefault();
    clearMarks();
    const t=e.target.closest(itemSel);
    if(t){const to=[...list.children].indexOf(t);if(to>-1&&to!==dragIdx)onSwap(dragIdx,to)}
    dragIdx=-1;
  });
  list.addEventListener('dragend',()=>{clearMarks();dragIdx=-1});
  list.addEventListener('mouseup',e=>{
    const row=e.target.closest(itemSel);if(row)row.removeAttribute('draggable');
  });
  /* 触屏长按把手 */
  let tIdx=-1,tTimer=null,tActive=false,sx=0,sy=0;
  list.addEventListener('touchstart',e=>{
    const h=e.target.closest(handleSel);if(!h)return;
    const row=h.closest(itemSel);if(!row)return;
    const t=e.touches[0];sx=t.clientX;sy=t.clientY;
    tIdx=[...list.children].indexOf(row);tActive=false;
    clearTimeout(tTimer);
    tTimer=setTimeout(()=>{tActive=true;row.style.opacity='.45';if(navigator.vibrate)navigator.vibrate(30)},350);
  },{passive:true});
  list.addEventListener('touchmove',e=>{
    if(!tActive){
      const t=e.touches[0];
      if(Math.abs(t.clientX-sx)>12||Math.abs(t.clientY-sy)>12)clearTimeout(tTimer);
      return;
    }
    e.preventDefault();
    const el=document.elementFromPoint(e.touches[0].clientX,e.touches[0].clientY);
    const t=el&&el.closest?el.closest(itemSel):null;
    list.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    if(t&&[...list.children].indexOf(t)!==tIdx)t.classList.add('drag-over');
  },{passive:false});
  list.addEventListener('touchend',e=>{
    clearTimeout(tTimer);
    if(!tActive){tIdx=-1;return}
    if(e.cancelable)e.preventDefault();
    const over=list.querySelector('.drag-over');
    list.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    list.querySelectorAll(itemSel).forEach(x=>{x.style.opacity=''});
    if(over){const to=[...list.children].indexOf(over);if(to>-1&&to!==tIdx)onSwap(tIdx,to)}
    tIdx=-1;tActive=false;
  },{passive:false});
  list.addEventListener('touchcancel',()=>{clearTimeout(tTimer);clearMarks();tIdx=-1;tActive=false});
}
