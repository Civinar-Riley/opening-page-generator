import './ui.js';
import { Project, setUI } from './project.js';
import { UI } from './ui.js';
import { toast } from './utils.js';

setUI(UI);

/* 顶栏按钮统一事件委托（替代 HTML 内联 onclick，不再依赖 window 全局） */
document.addEventListener('click',e=>{
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
  }
});

/* 工程导入文件选择 */
document.getElementById('importFile').addEventListener('change',e=>{
  Project.importProject(e.target);
});
