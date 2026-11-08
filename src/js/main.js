import { Project, setUI } from './project.js';
import { UI } from './ui/core.js';
import { toast, confirmModal, compressImageFile } from './utils.js';
import { UI_THEMES } from './defs.js';

setUI(UI);

/* 工具主题：下拉选择 + localStorage 持久化（key 沿用旧版，老存值直接兼容） */
const THEME_KEY='openingPageGen_theme';
(function initTheme(){
  const sel=document.getElementById('themeSelect');
  if(sel){
    sel.innerHTML=UI_THEMES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
    sel.addEventListener('change',()=>{
      /* bronze 是 :root 默认值：不挂 data-theme 属性（与初始化逻辑一致） */
      if(sel.value==='bronze')delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme=sel.value;
      try{localStorage.setItem(THEME_KEY,sel.value)}catch(e){}
      toast('已切换：'+(UI_THEMES.find(t=>t.id===sel.value)?.name||sel.value)+'主题');
    });
  }
  let saved=null;
  try{saved=localStorage.getItem(THEME_KEY)}catch(e){}
  const id=UI_THEMES.some(t=>t.id===saved)?saved:'bronze';
  /* bronze 为 :root 默认值，无需挂 data-theme 属性 */
  if(id!=='bronze')document.documentElement.dataset.theme=id;
  if(sel)sel.value=id;
})();

/* 顶栏按钮统一事件委托（替代 HTML 内联 onclick，不再依赖 window 全局） */
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-action]');
  if(!btn)return;
  switch(btn.dataset.action){
    case 'project-new':Project.newProject();break;
    case 'project-dup':Project.duplicateProject();break;
    case 'project-tpl':Project.saveAsTemplate();break;
    case 'project-rename':Project.renameProject();break;
    case 'project-del':Project.deleteProject();break;
    case 'project-save':Project.save();toast('已保存');break;
    case 'project-export':Project.exportProject();break;
    case 'project-import':document.getElementById('importFile').click();break;
    case 'project-snapshots':Project.openSnapshots();break;

    case 'factory-reset':{
      /* 清空所有本地数据并恢复初始状态：三次递进确认。
         key 扫描放到确认之后，并先阻断防抖保存定时器——否则确认期间
         pending 的 saveDebounced 会在清空后把旧数据写回（重置假失败）。
         清空到 reload 之间还有 600ms 空窗：期间任何触发保存的操作会把
         内存里的旧数据整体写回，故置阻断标志让 save/saveDebounced 直接短路 */
      if(!await confirmModal('⚠️ 即将清空本地数据并恢复初始状态。\n将删除：全部工程、我的模板、主题偏好。\n（顶栏「📸 快照」存的 IndexedDB 快照不在清理范围，重置后仍可从快照恢复。）\n\n确定继续？','重置本地数据 1/3'))return;
      if(!await confirmModal('第二次确认：以上数据删除后无法恢复。\n建议先「导出工程」备份需要保留的内容。\n\n确定继续？','重置本地数据 2/3'))return;
      if(!await confirmModal('最后一次确认：真的要清空全部本地数据吗？\n此操作不可撤销！','重置本地数据 3/3'))return;
      Project._resetting=true;
      clearTimeout(Project._svT);
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&k.startsWith('openingPageGen'))keys.push(k);
      }
      keys.forEach(k=>localStorage.removeItem(k));
      toast('已清空，正在恢复初始状态…');
      location.reload();
      break;
    }
  }
});

/* 工程导入文件选择 */
document.getElementById('importFile').addEventListener('change',e=>{
  Project.importProject(e.target);
});

/* ---------- 粘贴图片本地压缩（v1.32）----------
   「纯图片剪贴板」（截图 / 复制图片，无 text/plain 位）粘进输入框时拦截：canvas 限宽 +
   WebP/JPEG 压到阈值内再入库，别让原始 base64 直接进 localStorage。
   带文本位的剪贴板（复制文字/HTML/图片地址）不拦截，维持浏览器默认粘贴 */
document.addEventListener('paste',e=>{
  const t=e.target;
  if(!t||(t.tagName!=='INPUT'&&t.tagName!=='TEXTAREA')||t.readOnly||t.disabled)return;
  const cd=e.clipboardData;if(!cd)return;
  const items=[...(cd.items||[])];
  if(items.some(x=>x.kind==='string'&&x.type==='text/plain'))return;
  const it=items.find(x=>x.kind==='file'&&/^image\//.test(x.type));
  if(!it)return;
  const f=it.getAsFile();if(!f)return;
  e.preventDefault();
  toast('⏳ 正在压缩粘贴的图片…');
  compressImageFile(f).then(r=>{
    const s=t.selectionStart==null?t.value.length:t.selectionStart;
    const en=t.selectionEnd==null?s:t.selectionEnd;
    t.value=t.value.slice(0,s)+r.dataUrl+t.value.slice(en);
    t.dispatchEvent(new Event('input',{bubbles:true})); /* data-bkey 绑定走 input 事件 */
    try{t.focus();t.setSelectionRange(s+r.dataUrl.length,s+r.dataUrl.length)}catch(_e){}
    toast(`已${r.recompressed?'压缩':''}粘贴图片（base64 约 ${Math.round(r.dataUrl.length/1024)} KB）`);
  }).catch(err=>toast('图片粘贴失败：'+(err&&err.message||err)));
});

/* ---------- 多标签页并发提示（v1.32）----------
   另一标签页写入了当前工程：_written 缓存自愈能救数据一致性，但用户不知道两边在互相
   覆盖。不自动重载（会冲掉本页未保存的编辑），只提醒 */
window.addEventListener('storage',e=>{
  try{
    if(!e.key||!Project.cur||e.key!==Project.LS_PROJ+Project.cur.id)return;
    const other=JSON.parse(e.newValue||'null');
    if(other&&other.updatedAt&&Project.cur.updatedAt&&other.updatedAt!==Project.cur.updatedAt)
      toast('⚠️ 检测到另一标签页修改了当前工程——两边继续编辑会互相覆盖，建议先「导出工程」备份',6000);
  }catch(err){}
});


