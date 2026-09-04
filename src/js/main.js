import { Project, setUI } from './project.js';
import { UI } from './ui/core.js';
import { toast, confirmModal } from './utils.js';
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

    case 'factory-reset':{
      /* 清空所有本地数据并恢复初始状态：三次递进确认。
         key 扫描放到确认之后，并先阻断防抖保存定时器——否则确认期间
         pending 的 saveDebounced 会在清空后把旧数据写回（重置假失败） */
      if(!await confirmModal('⚠️ 即将清空本地数据并恢复初始状态。\n将删除：全部工程、我的模板、字段预设、美化预设、主题偏好。\n\n确定继续？','重置本地数据 1/3'))return;
      if(!await confirmModal('第二次确认：以上数据删除后无法恢复。\n建议先「导出工程」备份需要保留的内容。\n\n确定继续？','重置本地数据 2/3'))return;
      if(!await confirmModal('最后一次确认：真的要清空全部本地数据吗？\n此操作不可撤销！','重置本地数据 3/3'))return;
      clearTimeout(Project._svT);
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&k.startsWith('openingPageGen'))keys.push(k);
      }
      keys.forEach(k=>localStorage.removeItem(k));
      toast('已清空，正在恢复初始状态…');
      setTimeout(()=>location.reload(),600);
      break;
    }
  }
});

/* 工程导入文件选择 */
document.getElementById('importFile').addEventListener('change',e=>{
  Project.importProject(e.target);
});


