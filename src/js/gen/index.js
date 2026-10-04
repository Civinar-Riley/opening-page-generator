/* 生成引擎入口：组装 CSS / HTML / 脚本，产出可嵌入酒馆的组件代码 */
import { uid } from '../utils.js';
import { css } from './css.js';
import { body } from './body.js';
import { script, lightbox, comicReader, bgmScript, parseExcludedTags } from './scripts.js';
import backHomeTpl from '../../../slots/back-home.json';

const Gen={
  /** 容器唯一前缀。同一工程导出的组件共用一个 id */
  prefix(p){return 'opg-'+(p.id||'page')},

  /** 兼容审查（纯函数，只读工程配置，不自动修复——修复另走常规改动流程）：
   *  核对工程是否踩已知坑清单（AGENTS.md 硬约束的可静态核对子集），返回 {items:[{level,msg}]}——全部提示级 */
  auditCompat(p){
    const items=[];
    const marker=(p.marker||'').trim();
    if(marker.includes('/'))items.push({level:'提示',msg:'标记含 /——findRegex 已按 /pattern/ 转义，导入酒馆不会被截断（确认无需修改）'});
    /* 自由 HTML 坑位扫描（提示级）：只查启用区块的 html 字段 */
    (p.blocks||[]).forEach((b,i)=>{
      if(!b||!b.enabled||b.type!=='freehtml')return;
      const html=String(b.html||'');
      const noMinH=html.replace(/min-height\s*:[^;}"']*/gi,''); /* min-height:*vh 会被渲染器自动转为视口基准，豁免 */
      const uv=noMinH.match(/[\d.]+(?:vh|vw)\b/);
      if(uv)items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 使用了 ${uv[0]}——vw/vh 以楼层 iframe 为基准而非浏览器视口（min-height 除外），全屏背景/宽度计算可能异常，建议改用 % 或 px`});
      if(/position\s*:\s*fixed/i.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 使用了 position:fixed——会盖住酒馆界面且移动端定位错乱，建议改用 relative/absolute 或 sticky`});
      if(/fonts\.googleapis\.com/i.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 引用了 Google Fonts——国内环境加载缓慢或失败，建议系统字体或国内 CDN`});
      /* 性能护栏：捕获组>15 改交 JS 解析；重复 id 多次插入互相干扰 */
      const capN=(html.match(/\((?!\?)/g)||[]).length; /* 捕获组约数（排除非捕获组 (?:） */
      if(capN>15)items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 正则捕获组约 ${capN} 个（>15）——捕获组过多易错位且性能差，建议改为整块输出交 JS 解析`});
      /* match 带全局旗标返回整段匹配（不含捕获组），必须用 matchAll 才能取到捕获组里的 id 名 */
      const dupIds=[...(html.matchAll(/id=\"([^\"]+)\"/g))].map(m=>m[1]);
      const dupId=dupIds.filter((v,idx)=>dupIds.indexOf(v)!==idx);
      if(dupId.length)items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 存在重复 id（${[...new Set(dupId)].join('、')}）——多次插入/渲染会互相干扰，建议改用类名或加唯一前缀`});
      /* 弯引号检测：正则捕获/JSON Patch 场景弯引号易与直引号混用导致匹配或解析失败 */
      if(/[“”‘’]/.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 含中文弯引号（“”‘’）——若用于正则捕获或 JSON 数据，弯直引号不一致会导致匹配/解析失败，建议统一为直引号`});
      if(/src=["']http:\/\//i.test(html)||/url\(["']?http:\/\//i.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 引用了 http:// 图片——https 部署的酒馆会因混合内容策略拦截不显示，建议换 https 图源`});
      /* 前端规范避坑（废弃做法清单）：二次格式化与楼层数据注入 HTML */
      if(/formatAsDisplayedMessage\s*\(/.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 调用了 formatAsDisplayedMessage——对原始楼层文本再处理会二次执行宏与正则导致重复渲染，直接使用 getChatMessages 读到的原文即可`});
      if(/\.innerHTML\s*=|insertAdjacentHTML|document\.write/i.test(html)&&/getChatMessages|getVariables|getAllVariables|getCurrentMessageId/.test(html))items.push({level:'提示',msg:`自由 HTML 区块 #${i+1} 把楼层数据写入 innerHTML/insertAdjacentHTML——楼层文本含未转义 HTML 时有注入与二次渲染风险，建议改用 textContent/createTextNode`});
    });
    /* 图库/头像 URL 的 http 检查 */
    (p.blocks||[]).forEach((b,i)=>{
      if(!b||!b.enabled)return;
      const urls=[];
      if(b.type==='gallery'&&Array.isArray(b.images))b.images.forEach(x=>{if(x&&x.url)urls.push(x.url)});
      if(b.type==='comic'){if(b.cover)urls.push(b.cover);if(Array.isArray(b.pages))b.pages.forEach(x=>{if(x&&x.url)urls.push(x.url)})}
      if(b.type==='profile'&&Array.isArray(b.characters))b.characters.forEach(c=>{if(c&&c.avatar)urls.push(c.avatar)});
      if(b.type==='decor'&&b.bgType==='image'&&b.bgImage)urls.push(b.bgImage);
      if(urls.some(u=>/^http:\/\//i.test(u)))items.push({level:'提示',msg:`区块 #${i+1}（${b.type}）使用了 http:// 图片——https 部署的酒馆会因混合内容策略拦截不显示，建议换 https 图源`});
    });
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
    const js=(isPreview?'':script(p,px))+lightbox(px)+comicReader(px)+bgmScript(px);
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

  /** 开场白原文快照 → 占位列表行（纯函数）：扩展版「写入角色卡」前把所选卡的真实开场白
   *  烘焙进静态列表，替代编辑器占位文本。每条取首行作标题、余行并作描述，截断口径与
   *  运行时 extractTitleDesc（gen/scripts.js）对齐——同步接管前静态列表与实时列表观感一致；
   *  跳过 HTML 注释行与代码围栏行；剥除作者配置的排除标签（同一 TAGS 口径）。
   *  人物名不烘焙（extractNames 逻辑过重，运行时 3 秒内同步补齐）。
   * @param {string[]} texts 开场白原文数组（[first_mes, ...alternate_greetings]）
   * @param {string} [excludedTags] 排除标签配置原文
   * @returns {string} placeholderList 格式文本（每行 `标题｜描述`），无可烘焙内容时为 ''
   */
  greetSnapshotLines(texts,excludedTags){
    const tags=parseExcludedTags(excludedTags);
    const strip=t=>{for(const tag of tags){
      t=t.replace(new RegExp('<'+tag+'(\\s[^<>]*)?>[\\s\\S]*?<\\/'+tag+'\\s*>','gi'),' ');
      t=t.replace(new RegExp('<'+tag+'(?:\\s[^<>]*)?\\/?>','gi'),' ');
      t=t.replace(new RegExp('<\\/'+tag+'\\s*>','gi'),' ');
    }return t};
    /* 占位列表按竖线切分字段：正文自带 ｜/| 会误切，换成近似字形 */
    const sepSan=s=>s.replace(/[｜|]/g,'│');
    return (Array.isArray(texts)?texts:[]).map(x=>strip(String(x??'')).replace(/\r/g,'')).map(t=>{
      /* '\u003c' 转义会被 esbuild minify 还原成字面 '<'，改用 join 拼接（minify 不折叠，产物与
         工具 bundle 均不出现 HTML 注释开启序列——避免 HTML script 双转义坑，惯例见 build.js 闸门） */
      const HCC=['<!','--'].join('');
      const ls=t.split('\n').map(s=>s.trim()).filter(s=>s&&s.indexOf(HCC)!==0&&s.indexOf('```')!==0);
      if(!ls.length)return '';
      let title=ls[0].replace(/^#+\s*/,'');if(title.length>20)title=title.slice(0,20)+'…';
      let desc=ls.slice(1).join(' ');if(desc.length>=48)desc=desc.slice(0,48)+'…';
      return sepSan(title)+(desc?'｜'+sepSan(desc):'');
    }).filter(Boolean).join('\n');
  },

  /** 可直接导入酒馆的正则脚本 JSON（字段结构与 ST 正则扩展一致）
   * @param {import('../project.js').ProjectData} p
   * @param {{placement?:number[],runOnEdit?:boolean}} [opts] placement: 1=用户输入 2=AI 输出
   * @returns {{id:string,scriptName:string,findRegex:string,replaceString:string,trimStrings:Array,placement:number[],disabled:boolean,markdownOnly:boolean,promptOnly:boolean,runOnEdit:boolean,substituteRegex:number,minDepth:number|null,maxDepth:number|null}}
   */
  regexScript(p,{placement=[2],runOnEdit=true,minDepth=null,maxDepth=null}={}){
    const marker=(p.marker||'【开场页】').trim()||'【开场页】';
    /* / 分隔符也需转义：findRegex 以 /pattern/ 形式交给酒馆，标记含 / 会截断模式 */
    const escRe=marker.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
    /* maxDepth：限制只渲染最近 N 楼（0=仅最后一楼），防止 AI 复读标记时旧楼重复渲染 */
    const clampD=v=>(v==null||v===''||!Number.isFinite(+v))?null:Math.max(0,Math.floor(+v));
    const mn=clampD(minDepth),mx=clampD(maxDepth);
    return {
      id:uid(),
      scriptName:'开场页-'+p.name+'（导入后启用）',
      findRegex:'/'+escRe+'/',
      replaceString:this.fencedFullDoc(p),
      trimStrings:[],
      placement:[...placement],
      disabled:false,
      markdownOnly:true,
      promptOnly:false,
      runOnEdit,
      substituteRegex:0,
      minDepth:mn,
      maxDepth:mx,
    };
  },

/** 「返回开场页」角色脚本：模板外置于仓库根 slots/back-home.json（插槽式，换文件重建即换，
 *  契约见 slots/README.md）。本函数只做规范化：id 每次导出重新生成（防脚本库撞 ID）、
 *  name 支持 {{工程名}} 占位、可选字段缺省回落。旧硬编码模板与主题烘焙已随 v1.22.0 移除
 *  （模板即真相，样式改 slots/back-home.json）。
 * @param {import('../project.js').ProjectData} p
 * @returns {{type:string,enabled:boolean,name:string,id:string,content:string,info:string,button:Object,data:Object,export_with:Object}}
 */
  backHomeScript(p,tpl=backHomeTpl){
    const t=tpl||{};
    if(t.type!=='script'||typeof t.content!=='string'||!t.content.trim())throw new Error('slots/back-home.json 插槽模板非法：需要 type:"script" 与非空 content 字符串（契约见 slots/README.md）');
    return {
      type:'script',
      enabled:t.enabled!==false,
      name:String(t.name||'返回开场页-{{工程名}}').replace('{{工程名}}',p.name||'未命名工程'),
      id:uid(),
      content:t.content,
      info:String(t.info??''),
      button:t.button||{enabled:false,buttons:[]},
      data:t.data||{},
      export_with:t.export_with||{data:true,button:true},
    };
  },
};

export {Gen};
