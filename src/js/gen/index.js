/* 生成引擎入口：组装 CSS / HTML / 脚本，产出可嵌入酒馆的组件代码 */
import { uid } from '../utils.js';
import { css } from './css.js';
import { body } from './body.js';
import { script, lightbox, bgmScript } from './scripts.js';

const Gen={
  /** 容器唯一前缀。同一工程导出的组件共用一个 id */
  prefix(p){return 'opg-'+(p.id||'page')},

  /** 兼容审查（纯函数，只读工程配置，不自动修复——修复另走常规改动流程）：
   *  核对工程是否踩已知坑清单（AGENTS.md 硬约束的可静态核对子集），返回 {items:[{level,msg}]}——全部提示级 */
  auditCompat(p){
    const items=[];
    const marker=(p.marker||'').trim();
    if(marker.includes('/'))items.push({level:'提示',msg:'标记含 /——findRegex 已按 /pattern/ 转义，导入酒馆不会被截断（确认无需修改）'});
    const sb=p.statusbar&&typeof p.statusbar==='object'?p.statusbar:null;
    if(sb){
      const fields=(Array.isArray(sb.fields)?sb.fields:[]).filter(f=>f&&f.name&&String(f.name).trim());
      const dup=fields.map(f=>String(f.name).trim()).filter((n,i,a)=>a.indexOf(n)!==i);
      if(dup.length)items.push({level:'提示',msg:`状态栏存在重名字段「${[...new Set(dup)].join('」「')}」——行式正则按字段名顺序捕获，重名可能捕获错位（effFields 编号一致依赖字段名唯一），建议改名`});
      if(sb.mode!=='block'&&fields.some(f=>/[：:]/.test(String(f.name))))items.push({level:'提示',msg:'状态栏字段名含冒号——与值分隔符混淆，酒馆端 AI 输出可能错位，建议改名'});
    }
    const free=(p.blocks||[]).filter(b=>b&&b.enabled&&b.type==='freehtml');
    if(free.length)items.push({level:'提示',msg:'自由 HTML 区块脚本以完整权限运行（预览 srcdoc + 酒馆导出均可读写 localStorage）——发卡前确认内容来源可信，文档与区块编辑器已注明「勿粘贴不可信来源的代码」'});
    return {items};
  },

  /** 导出自检（纯函数，只读产物文本，不改写）：核对酒馆助手渲染的已知必要条件。
   *  返回 {ok,problems:[{level:'阻断'|'提示',msg}]}——阻断级问题会使产物在酒馆不渲染 */
  auditFullDoc(doc){
    const problems=[];
    const count=(s)=>doc.split(s).length-1;
    if(!doc.includes('<body>')||!doc.includes('</body>'))problems.push({level:'阻断',msg:'缺少 <body></body> 标签（酒馆助手只渲染代码块内含 body 标签的代码）'});
    const open=count('<script'),close=count('</script>'),esc=count('<\\/script>');
    if(open>0&&open!==close+esc)problems.push({level:'阻断',msg:`<script>(${open})与闭合标签(${close}+转义${esc})数量不一致——存在 </script> 未转义逃逸或闭合缺失`});
    if(!doc.includes('id="opg-'))problems.push({level:'提示',msg:'未发现 opg- 容器前缀（容器隔离可能缺失）'});
    if(doc.includes('```'))problems.push({level:'提示',msg:'正文含 ``` 围栏——导出须用四反引号长围栏（fencedFullDoc 已自动处理，直贴 HTML 时注意）'});
    if(doc.length>200000)problems.push({level:'提示',msg:`产物体积 ${(doc.length/1000).toFixed(0)}KB 超长——粘贴可能被酒馆截断，建议精简区块`});
    if(count('getVariables(')>0||doc.includes('TavernHelper.'))problems.push({level:'提示',msg:'产物含酒馆 API 调用——预览通过≠真机通过，收尾须真机档验证'});
    return {ok:!problems.some(x=>x.level==='阻断'),problems};
  },

  /** 生成完整组件 HTML（含 style + script）。isPreview=true 时使用占位数据并禁用 API
   * @param {import('../project.js').ProjectData} p
   * @param {{isPreview?:boolean}} [opts]
   * @returns {string}
   */
  build(p,{isPreview=false}={}){
    const px=this.prefix(p);
    const blocks=p.blocks.filter(b=>b.enabled);
    const cssStr=css(p,px,blocks);
    const html=body(p,px,blocks,isPreview);
    const js=(isPreview?'':script(p,px))+lightbox(px)+bgmScript(px);
    return `<div id="${px}" class="${px}-root">\n<style>\n${cssStr}\n</style>\n${html}\n${js}\n</div>`;
  },

  /** 完整 HTML 文档（用于正则 replaceString：``` 包裹，由酒馆助手渲染为 iframe） */
  buildFullDoc(p){
    const comp=this.build(p,{isPreview:false});
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>开场页</title>
<style>html,body{margin:0;padding:0;background:transparent}</style>
</head>
<body>
${comp}
</body>
</html>`;
  },

  /** 带 ``` 代码围栏的完整文档：酒馆助手渲染楼层前端的必要条件是
   *  「代码在 ``` 代码块内 + 同时含 <body> 与 </body> 标签」，开场白版与正则版共用。
   *  正文含 ``` 时（自由 HTML 常见）会提前闭合围栏，升级为四反引号长围栏 */
  fencedFullDoc(p){
    const doc=this.buildFullDoc(p);
    if(doc.includes('```'))return '````\n'+doc+'\n````';
    return '```\n'+doc+'\n```';
  },

  /** 可直接导入酒馆的正则脚本 JSON（字段结构与 ST 正则扩展一致）
   * @param {import('../project.js').ProjectData} p
   * @param {{placement?:number[],runOnEdit?:boolean}} [opts] placement: 1=用户输入 2=AI 输出
   * @returns {{id:string,scriptName:string,findRegex:string,replaceString:string,trimStrings:Array,placement:number[],disabled:boolean,markdownOnly:boolean,promptOnly:boolean,runOnEdit:boolean,substituteRegex:number,minDepth:number|null,maxDepth:number|null}}
   */
  regexScript(p,{placement=[2],runOnEdit=true}={}){
    const marker=(p.marker||'【开场页】').trim()||'【开场页】';
    /* / 分隔符也需转义：findRegex 以 /pattern/ 形式交给酒馆，标记含 / 会截断模式 */
    const escRe=marker.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
    return {
      id:uid(),
      scriptName:'开场页-'+p.name,
      findRegex:'/'+escRe+'/',
      replaceString:this.fencedFullDoc(p),
      trimStrings:[],
      placement:[...placement],
      disabled:false,
      markdownOnly:true,
      promptOnly:false,
      runOnEdit,
      substituteRegex:0,
      minDepth:null,
      maxDepth:null,
    };
  },
};

export {Gen};
