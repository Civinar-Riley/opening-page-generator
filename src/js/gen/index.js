/* 生成引擎入口：组装 CSS / HTML / 脚本，产出可嵌入酒馆的组件代码 */
import { uid } from '../utils.js';
import { css } from './css.js';
import { body } from './body.js';
import { script, lightbox, comicReader, bgmScript, parseExcludedTags } from './scripts.js';

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

  /** 可直接导入酒馆助手的角色脚本 JSON：非首页（第0楼 swipe≥1）自动在第0楼正文末尾
   *  注入「返回开场页」按钮，点击 setChatMessages 切回第0张开场白（即开场页）。
   *  为什么必须是独立角色脚本：开场页 HTML 活在第0楼 swipe 0 的楼层 iframe 里，swipe
   *  切换时楼层整体重建——返回按钮无法做进产物自身，只能由不随楼层销毁的脚本从宿主
   *  文档注入（脚本 runner iframe 向上爬 window.parent 找 #chat，同 playGreetAudio 手法）。
   *  灵感来源 @wobushirenji「非首页自动返回」（作者允许二改、标明来源即可），实现自研，
   *  三处改良：getChatMessages Promise 兼容（契约规则4，原版漏了）／返回成功顺带清理
   *  开场白联动音轨（audio[data-opg-greet-audio]，回到开场页应停）／默认零外链文字按钮。
   *  content 为独立 JSON 内 JS 字符串，不嵌 HTML，无 <\/script> 约束；仍禁反引号与字面
   *  ${}（外层模板字面量约束，同运行环境规则7）。
   * @param {import('../project.js').ProjectData} p
   * @returns {{type:string,enabled:boolean,name:string,id:string,content:string,info:string,button:{enabled:boolean,buttons:Array},data:Object,export_with:{data:boolean,button:boolean}}}
   */
  backHomeScript(p){
    const bh=p.backHome||{};
    const img=String(bh.img||'').trim();
    /* 图片模式但 URL 为空时静默回退文字按钮，保证产物永远可用 */
    const mode=bh.mode==='img'&&img?'img':'text';
    const text=String(bh.text||'').trim()||'← 返回开场页';
    /* 主题色烘焙进按钮样式；非 hex 防御性回退（THEME_PRESETS 全为 6 位 hex，与 css.js 同假设） */
    const thm=p.theme||{};
    const pick=(v,fb)=>/^#[0-9a-fA-F]{6}$/.test(v||'')?v:fb;
    const primary=pick(thm.primary,'#7c6cf0');
    const accent=pick(thm.accent,'#e8c47c');
    const textColor=pick(thm.textColor,'#f0f0f5');
    const radius=(Number(thm.radius)>0?Number(thm.radius):12)+'px';
    const content=`(function(){
'use strict';
/* 返回开场页按钮——企鹅的酒馆开场页生成器生成
   灵感来源 @wobushirenji「非首页自动返回」脚本（作者允许二改，来源已标明）。
   只向第0楼的非0号 swipe 注入按钮：不改聊天文本、不碰其它楼层、开场页本身不出现。 */
var CFG={mode:'${mode}',text:${JSON.stringify(text)},img:${JSON.stringify(img)}};
var CLASS_NAME='opg-backhome',STYLE_ID='opg-backhome-style';
var scheduled=false,disposed=false,observedChat=null,observedFirst=null,chatObserver=null,firstObserver=null,lastDoc=null;
function hasFn(n){return typeof window[n]==='function'}
function getHostDocument(){
  var w=window,k;
  for(k=0;k<8;k++){
    try{
      if(!w.parent||w.parent===w)break;
      w=w.parent;
      if(w.document&&w.document.querySelector('#chat'))return w.document;
    }catch(e){break}
  }
  try{if(document.querySelector('#chat'))return document}catch(e){}
  return null;
}
async function getSwipeId(){
  if(hasFn('getChatMessages')){
    try{
      var r=getChatMessages(0);
      if(r&&typeof r.then==='function')r=await r;
      var first=Array.isArray(r)?r[0]:null;
      if(first){
        if(first.is_user===true||(first.role&&first.role!=='assistant'))return null;
        var n=Number(first.swipe_id==null?0:first.swipe_id);
        return Number.isInteger(n)&&n>=0?n:null;
      }
    }catch(e){}
  }
  try{
    if(typeof SillyTavern!=='undefined'&&SillyTavern&&typeof SillyTavern.getContext==='function'){
      var chat=SillyTavern.getContext().chat,row=chat?chat[0]:null;
      if(row&&!row.is_user){
        var m=Number(row.swipe_id==null?0:row.swipe_id);
        return Number.isInteger(m)&&m>=0?m:null;
      }
    }
  }catch(e){}
  return null;
}
function cssText(){
  /* 主题色已由生成器烘焙为字面量（${primary}59 等 hex8 透明度手法与 gen/css.js 一致） */
  if(CFG.mode==='img'){
    return '.'+CLASS_NAME+'{display:block;width:min(160px,88%);min-height:44px;margin:20px auto 10px;padding:0;border:0;background:transparent;box-shadow:none;cursor:pointer;line-height:0;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .15s ease}'
      +'.'+CLASS_NAME+' img{display:block;width:100%;height:auto;max-width:100%;border:none;border-radius:0;background:transparent;box-shadow:none}'
      +'.'+CLASS_NAME+':hover{transform:translateY(-1px)}'
      +'.'+CLASS_NAME+':active{transform:scale(.98)}'
      +'.'+CLASS_NAME+':focus-visible{outline:1px solid ${accent};outline-offset:3px}'
      +'@media (prefers-reduced-motion:reduce){.'+CLASS_NAME+'{transition:none}}';
  }
  return '.'+CLASS_NAME+'{display:block;width:min(240px,86%);min-height:44px;margin:20px auto 10px;padding:0 18px;'
    +'border:1px solid ${primary}59;box-shadow:inset 0 0 0 1px ${primary}14;border-radius:${radius};'
    +'background:linear-gradient(160deg,${primary}1a,${primary}08);color:${textColor};'
    +'font-family:inherit;font-size:13px;letter-spacing:3px;text-indent:3px;line-height:1.2;'
    +'cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;'
    +'transition:border-color .18s ease,background .18s ease,transform .15s ease}'
    +'.'+CLASS_NAME+':hover{border-color:${accent};background:linear-gradient(160deg,${primary}2e,${primary}12)}'
    +'.'+CLASS_NAME+':active{transform:scale(.97)}'
    +'.'+CLASS_NAME+':focus-visible{outline:1px solid ${accent};outline-offset:3px}'
    +'@media (prefers-reduced-motion:reduce){.'+CLASS_NAME+'{transition:none}}';
}
function ensureStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  var style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=cssText();
  (doc.head||doc.documentElement).appendChild(style);
}
function schedule(){
  if(scheduled||disposed)return;
  scheduled=true;
  setTimeout(function(){scheduled=false;if(!disposed)sync()},80);
}
function attachObservers(doc){
  var chat=doc.querySelector('#chat');
  if(chat!==observedChat){
    if(chatObserver)chatObserver.disconnect();
    observedChat=chat;
    if(chat){chatObserver=new MutationObserver(schedule);chatObserver.observe(chat,{childList:true})}
  }
  var first=chat?chat.querySelector('.mes[mesid="0"]'):null;
  if(first!==observedFirst){
    if(firstObserver)firstObserver.disconnect();
    observedFirst=first;
    if(first){firstObserver=new MutationObserver(schedule);firstObserver.observe(first,{childList:true,subtree:true})}
  }
  return first;
}
function stopGreetAudio(){
  /* 回到开场页视为重新开局：停掉并移除开场白联动音轨（本工具挂宿主文档的 data-opg-greet-audio） */
  try{
    var doc=getHostDocument()||document;
    var list=doc.querySelectorAll('audio[data-opg-greet-audio]');
    for(var i=0;i<list.length;i++){
      try{list[i].pause()}catch(e){}
      if(list[i].parentNode)list[i].parentNode.removeChild(list[i]);
    }
  }catch(e){}
}
function makeButton(doc){
  var button=doc.createElement('button');
  button.type='button';
  button.className=CLASS_NAME;
  button.title='返回第0张开场白';
  button.setAttribute('aria-label','返回开场白首页（第0张开场白）');
  if(CFG.mode==='img'){
    var pic=doc.createElement('img');
    pic.src=CFG.img;
    pic.alt=CFG.text;
    pic.loading='lazy';
    pic.decoding='async';
    button.appendChild(pic);
  }else{
    button.textContent=CFG.text;
  }
  button.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();
    if(button.disabled)return;
    button.disabled=true;
    if(!hasFn('setChatMessages')){
      console.warn('[返回开场页] 未检测到酒馆助手 setChatMessages API');
      button.disabled=false;
      return;
    }
    try{
      Promise.resolve(setChatMessages([{message_id:0,swipe_id:0}],{refresh:'affected'})).then(function(){
        stopGreetAudio();
        schedule();
      }).catch(function(err){
        console.warn('[返回开场页] 切换失败',err);
        button.disabled=false;
      });
    }catch(err){
      console.warn('[返回开场页] 切换失败',err);
      button.disabled=false;
    }
  });
  return button;
}
function sync(){
  if(disposed)return;
  var doc=getHostDocument();
  if(!doc)return;
  lastDoc=doc;
  var first=attachObservers(doc);
  if(!first)return;
  var existing=first.querySelector('.'+CLASS_NAME);
  getSwipeId().then(function(sw){
    if(disposed)return;
    if(sw===null||sw===0){if(existing)existing.remove();return}
    var text=first.querySelector('.mes_text')||first.querySelector('.mes_block');
    if(!text)return;
    if(existing&&text.contains(existing))return;
    if(existing)existing.remove();
    ensureStyle(doc);
    text.appendChild(makeButton(doc));
  }).catch(function(){});
}
function dispose(){
  disposed=true;
  if(chatObserver)chatObserver.disconnect();
  if(firstObserver)firstObserver.disconnect();
  try{
    if(lastDoc){
      var els=lastDoc.querySelectorAll('.'+CLASS_NAME);
      for(var i=0;i<els.length;i++)els[i].remove();
      var st=lastDoc.getElementById(STYLE_ID);
      if(st)st.remove();
    }
  }catch(e){}
}
if(hasFn('eventOn')&&typeof tavern_events!=='undefined'&&tavern_events){
  ['CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_UPDATED'].forEach(function(name){
    var ev=tavern_events[name];
    if(ev){try{eventOn(ev,schedule)}catch(e){}}
  });
}
var doc0=getHostDocument();
if(doc0){
  var onClick=function(e){
    if(e.target&&e.target.closest&&e.target.closest('#chat .mes[mesid="0"] .swipe_left,#chat .mes[mesid="0"] .swipe_right'))schedule();
  };
  doc0.addEventListener('click',onClick,true);
  window.addEventListener('pagehide',function(){
    doc0.removeEventListener('click',onClick,true);
    dispose();
  },{once:true});
}else{
  window.addEventListener('pagehide',dispose,{once:true});
}
schedule();
})();
`;
    return {
      type:'script',
      enabled:true,
      name:'返回开场页-'+(p.name||'未命名工程'),
      id:uid(),
      content,
      info:'角色专属；第0楼开场白 swipe 到第2张及以后时，正文末尾自动出现「返回开场页」按钮，点击切回第0张开场白（开场页）。不修改原文、不使用正则，开场页本身（第0张）不出现按钮。由企鹅的酒馆开场页生成器生成；灵感来源 @wobushirenji「非首页自动返回」。',
      button:{enabled:false,buttons:[]},
      data:{},
      export_with:{data:true,button:true},
    };
  },
};

export {Gen};
