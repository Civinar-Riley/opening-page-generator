/* 导出 HTML 反向解析（v1.30）：把本工具导出的开场页 HTML 认回一份「可恢复的工程草稿」。
   与 cardImport 同款三段式：parseExportDoc（纯解析）→ buildRestorePlan（勾选预览）→ applyRestorePlan（落位）。
   不追求完整还原——只认区块作用域层（.opg-{px}-bk{n}）里能识别的标记与文本；认不出的整段进
   自由 HTML 草稿并标注待认领。纯函数无 DOM——UI 接线在 project.js 的 openDocImport。 */
import { BLOCK_DEFS, BLOCK_ORDER } from './defs.js';

const EXPORT_VER=2; // 与 gen/index.js buildFullDoc 的 data-opg-ver 对应；v2 起产物内嵌配置快照

/* esc()（utils.js 五类转义）的逆运算；&amp; 必须最后还原，防 &amp;lt; 被二次解开 */
const unesc=s=>String(s??'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

/* 24 类有产物签名的区块。签名取自 gen/body.js 的产物类名片段（px=opg-{id} 容器前缀），
   不得为其他区块类名的前缀：changelog 用 -clrow 而非 -cl（后者是 -clock 的前缀会误吞时钟栏）；
   随机事件/更新日志/模糊揭示共用的 -revt 标题不作签名——仅凭标题认类型会误判，
   此类残段（如只配了标题没配行）走自由 HTML 兜底更诚实。decor 仅作用于背景样式，
   产物是空壳层，切块后按空白跳过 */
const SIGNATURES=[
  ['welcome',['-title']],['quote',['-quote']],['profile',['-profile','-profc','-pgrid']],
  ['gallery',['-gal']],['comic',['-cvbnr','-cvwrap','-reader']],['greetings',['-glist']],
  ['divider',['-hr']],['disclaimer',['-disc']],['author',['-auth']],['freehtml',['-free']],
  ['clockbar',['-clock']],['randomevent',['-rbox']],['dice',['-dice']],['countdown',['-cd']],
  ['timeline',['-tl-node']],['bgm',['-bgm']],['fx',['-fx']],['qa',['-qa-wrap']],
  ['changelog',['-clrow']],['gate',['-gate']],['decode',['-dec']],['gacha',['-gacha']],
  ['egg',['-egg']],['blurreveal',['-brv']],
];

/* 定位 key 之后首个 [ … ] 平衡区间并 JSON.parse——gacha 卡池/egg 彩蛋烘在内联脚本里（jssx 产物是合法 JSON）。
   内容含 ']' 时计数提前归零解析失败，返回 null 走「未恢复」兜底（尽力而为，不报错） */
function jsonArrAfter(s,key){
  const i=s.indexOf(key);if(i<0)return null;
  const j=s.indexOf('[',i+key.length);if(j<0)return null;
  let d=0;
  for(let k=j;k<s.length;k++){
    if(s[k]==='[')d++;
    else if(s[k]===']'){d--;if(!d){try{return JSON.parse(s.slice(j,k+1))}catch(e){return null}}}
  }
  return null;
}

/* 取 class 含 px+cls 片段的元素内文（esc 过的文本 unesc 还原；end 为闭合标签名）。
   age 徽标 logo 里的菱形装饰 span 一并剥掉，只留配置文案 */
function clsInner(s,px,cls,end='div'){
  const m=s.match(new RegExp(`class="[^"]*${px}${cls}[^"]*"[^>]*>([\\s\\S]*?)</${end}>`));
  if(!m)return '';
  return unesc(m[1].replace(new RegExp(`<span class="${px}-gagedia">[\\s\\S]*?</span>`,'g'),'').trim());
}
/* 属性取值（data-target 等，esc 过的属性值 unesc 还原） */
function attrOf(s,name){const m=s.match(new RegExp(`${name}="([^"]*)"`));return m?unesc(m[1]):''}

/* 各类型 salvage(inner,px) → 草稿字段：认不出的字段不写（create() 默认值兜底），
   只在产物里真实出现时才写。对位类内容（角色/开场白封面）按卡片容器切分逐卡提取，
   避免「前面的卡缺字段」时并行数组错位 */
const SALVAGE={
  welcome:(s,px)=>{const d={};
    const t=s.match(new RegExp(`<h1 class="${px}-title">([\\s\\S]*?)</h1>`));if(t)d.title=unesc(t[1]);
    const sub=s.match(new RegExp(`class="${px}-subtitle">([\\s\\S]*?)</div>`));if(sub)d.subtitle=unesc(sub[1]);
    const eb=s.match(new RegExp(`class="${px}-eyebrow">([\\s\\S]*?)</div>`));if(eb){d.showEyebrow=true;d.eyebrow=unesc(eb[1])}
    return d},
  quote:(s,px)=>{const m=s.match(new RegExp(`class="${px}-quote">([\\s\\S]*?)</div>`));if(!m)return {};
    const src=m[1].match(new RegExp(`<span class="${px}-qsrc">—— ?([\\s\\S]*?)</span>$`));
    const text=src?m[1].slice(0,src.index):m[1];
    const d={text:unesc(text)};if(src)d.source=unesc(src[1]);return d},
  profile:(s,px)=>{
    const parts=s.split(new RegExp(`(?=<div class="${px}-profile">|<details class="${px}-profc">)`))
      .filter(x=>x.includes(px+'-profile">')||x.includes(px+'-profc">'));
    const chars=parts.map(pt=>{
      const nm=pt.match(new RegExp(`class="${px}-pname">([^<]*)<`));
      const ds=pt.match(new RegExp(`class="${px}-pdesc">([\\s\\S]*?)</div>`));
      const tg=pt.match(new RegExp(`class="${px}-ptags">([\\s\\S]*?)</div>`));
      const tags=tg?[...tg[1].matchAll(new RegExp(`class="${px}-ptag">([^<]*)<`,'g'))].map(x=>unesc(x[1])).join(','):'';
      const av=pt.match(new RegExp(`<img class="${px}-avatar" src="([^"]*)"`));
      const md=pt.match(new RegExp(`class="${px}-avatar (char|user)-avatar"`));
      return {name:nm?unesc(nm[1]):'',desc:ds?unesc(ds[1]):'',tags,avatar:av?unesc(av[1]):'',avatarMode:md?(md[1]==='char'?'char':'user'):'manual'};
    });
    return chars.some(c=>c.name||c.desc||c.tags||c.avatar)?{characters:chars}:{}},
  gallery:(s,px)=>({images:[...s.matchAll(new RegExp(`<img data-opg="gimg" src="([^"]*)"[^>]*>(?:<figcaption>([\\s\\S]*?)</figcaption>)?`,'g'))].map(m=>({url:unesc(m[1]),cap:m[2]?unesc(m[2]):''}))}),
  comic:(s,px)=>{const d={};
    const bt=clsInner(s,px,'-rtitle','span')||clsInner(s,px,'-cvbt','span');if(bt)d.title=bt;
    if(s.includes(px+'-cvwrap')){d.entry='cover';const cv=s.match(new RegExp(`class="${px}-cvimg" src="([^"]*)"`));if(cv)d.cover=unesc(cv[1])}
    else if(s.includes(px+'-cvbnr')){d.entry='banner';const bt2=s.match(new RegExp(`class="${px}-cvbnr"[\\s\\S]*?<span aria-hidden="true">📖</span><span>([\\s\\S]*?)</span>`));if(bt2)d.buttonText=unesc(bt2[1])}
    if(new RegExp(`class="${px}-rbody paged"`).test(s))d.mode='paged';
    const pgs=[...s.matchAll(new RegExp(`<img data-opg="comic-page" src="([^"]*)"[^>]*>(?:<figcaption class="${px}-rpgcap">([\\s\\S]*?)</figcaption>)?`,'g'))].map(m=>({url:unesc(m[1]),cap:m[2]?unesc(m[2]):''}));
    if(pgs.length)d.pages=pgs;
    return d},
  greetings:(s,px)=>{const d={};
    const head=s.match(new RegExp(`class="${px}-ghead">([\\s\\S]*?)</div>`));if(head){d.showTitle=true;d.title=unesc(head[1])}
    if(s.includes(px+'-gwallitem'))d.cardStyle='wall';
    const lines=[],covers=[];
    [...s.matchAll(new RegExp(`class="${px}-gitem[^"]*"[^>]*>([\\s\\S]*?)</button>`,'g'))].forEach(m=>{
      const g=t=>{const x=m[1].match(new RegExp(`class="${px}-g${t}">([^<]*)<`));return x?unesc(x[1]):''};
      /* 段数按渲染事实还原：names 恒为末段（描述为空时补空中段），desc 次之——filter 掉空段
         会把「乙线｜｜乙的人物」静默改写成「乙线｜乙的人物」（人物名错位成描述）。
         全空行也占位（渲染为空选项），保证 lines 与 covers 逐 gitem 下标对齐 */
      const t=g('title'),d=g('desc'),n=g('names');
      lines.push(n?[t,d,n].join('｜'):(d?[t,d].join('｜'):t)||'｜｜');
      const cv=m[1].match(new RegExp(`class="${px}-gcover" src="([^"]*)"`));
      covers.push({cover:cv?unesc(cv[1]):''});
    });
    if(lines.length)d.placeholderList=lines.join('\n');
    if(covers.some(c=>c.cover))d.entries=covers;
    const send=s.match(new RegExp(`class="${px}-gsend"[^>]*>([\\s\\S]*?)</button>`));
    if(send){d.clickAction='send';d.buttonText=unesc(send[1])}
    return d},
  divider:(s,px)=>{const m=s.match(new RegExp(`class="${px}-hr"><span>([\\s\\S]*?)</span>`));if(!m)return {};
    const mid=unesc(m[1]);
    const map={'◆':'diamond','✦ ✦ ✦':'dots','❀ ❀ ❀':'flowers','〰 〰 〰':'wave'};
    return map[mid]?{style:map[mid]}:{text:mid}},
  disclaimer:(s,px)=>{
    if(s.includes('<details')){const t=s.match(new RegExp(`<div style="margin-top:6px">([\\s\\S]*?)</div>`));return t?{style:'collapse',text:unesc(t[1])}:{style:'collapse'}}
    const t=s.match(new RegExp(`class="${px}-disc">⚠️ ([\\s\\S]*?)</div>`));return t?{style:'plain',text:unesc(t[1])}:{style:'plain'}},
  author:(s,px)=>{
    if(s.includes('<details')){const t=s.match(new RegExp(`<div style="margin-top:6px;white-space:pre-wrap">([\\s\\S]*?)</div>`));return t?{style:'collapse',text:unesc(t[1])}:{style:'collapse'}}
    const c=s.match(new RegExp(`class="${px}-authb">([\\s\\S]*?)</div>`));
    if(c)return {style:'card',text:unesc(c[1])};
    const p=s.match(new RegExp(`class="${px}-auth" style="white-space:pre-wrap">✒️ ([\\s\\S]*?)</div>`));
    return p?{style:'plain',text:unesc(p[1])}:{style:'plain'}},
  freehtml:(s,px)=>{const m=s.match(new RegExp(`<div class="${px}-free">\n([\\s\\S]*)\n  </div>$`));return {html:m?m[1]:''}},
  clockbar:(s,px)=>{const m=s.match(new RegExp(`class="${px}-clock">([\\s\\S]*?)</div>`));return m?{text:m[1]}:{}},
  randomevent:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-revt">([\\s\\S]*?)</div>`));if(t){d.showTitle=true;d.title=unesc(t[1])}
    const one=s.match(new RegExp(`class="${px}-rline">{{random::([\\s\\S]*?)}}`));
    /* 行文本导出经 esc（body.js），还原须 unesc——与其它区块 salvage 口径一致，否则实体残留、再导出变双转义 */
    if(one){d.pickMode='one';d.lines=one[1].split('::').map(l=>unesc(l.replace(/⦂/g,'::').replace(/⎬⎬/g,'}}'))).join('\n');return d}
    const lines=[...s.matchAll(new RegExp(`class="${px}-rline">([\\s\\S]*?)</div>`,'g'))].map(m=>unesc(m[1]));
    /* shuffle 导出与 line 同形（固定顺序，body.js 注明酒馆宏无法整组乱序），按 line 恢复产物一致 */
    if(lines.length){d.pickMode='line';d.lines=lines.join('\n')}
    return d},
  dice:(s,px)=>{const d={};
    const lb=s.match(new RegExp(`class="${px}-dlabel">🎲 ([\\s\\S]*?)</span>`));if(lb)d.label=unesc(lb[1]);
    const v=s.match(new RegExp(`class="${px}-dval">{{roll::([^}]*)}}</span>`));if(v)d.expr=unesc(v[1]);
    return d},
  countdown:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-cd-title">([\\s\\S]*?)</div>`));if(t)d.title=unesc(t[1]);
    const tg=attrOf(s,'data-target');if(tg)d.target=tg;
    const dn=attrOf(s,'data-done');if(dn)d.doneText=dn;
    return d},
  timeline:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-tl-title">([\\s\\S]*?)</div>`));if(t){d.showTitle=true;d.title=unesc(t[1])}
    const rows=[...s.matchAll(new RegExp(`class="${px}-tl-node ${px}-tl-(\\w+)"><div class="${px}-tl-dot"></div><div class="${px}-tl-body"><div class="${px}-tl-name">([^<]*)</div>(?:<div class="${px}-tl-desc">([\\s\\S]*?)</div>)?`,'g'))]
      .map(m=>[unesc(m[2]),m[3]?unesc(m[3]):'',m[1]].join('|'));
    if(rows.length)d.nodes=rows.join('\n');
    return d},
  bgm:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-bgm-title">([\\s\\S]*?)</div>`));if(t){d.showTitle=true;d.title=unesc(t[1])}
    const tracks=[...s.matchAll(new RegExp(`<source data-name="([^"]*)" src="([^"]*)"`,'g'))].map(m=>({name:unesc(m[1]),url:unesc(m[2])}));
    if(tracks.length)d.tracks=tracks;
    const vol=s.match(new RegExp(`class="${px}-bgm-vol"[^>]*value="(\\d+)"`));if(vol)d.volume=+vol[1];
    d.loop=new RegExp(`class="${px}-bgm-audio" preload="auto" loop`).test(s);
    return d},
  fx:(s,px)=>{const m=s.match(new RegExp(`class="${px}-fx" id="${px}-fx\\d+" data-fx="([^"]*)" data-count="([^"]*)" data-speed="([^"]*)" data-opacity="([^"]*)"`));
    return m?{effect:unesc(m[1]),count:+m[2],speed:+m[3],opacity:+m[4]}:{}},
  qa:(s,px)=>{const d={};
    const sum=s.match(new RegExp(`class="${px}-qa-title"><span class="${px}-qa-tarrow">▸</span>([\\s\\S]*?)</summary>`));
    if(sum&&sum[1].trim()){d.showTitle=true;d.title=unesc(sum[1].trim())}
    const bi=s.indexOf(px+'-qa-body">');if(bi<0)return d;
    const be=s.lastIndexOf('\n    </div>');
    const body=s.slice(bi+px.length+11,be<0?s.length:be);
    const hdrs=[...body.matchAll(new RegExp(`class="${px}-qa-ghdr">([\\s\\S]*?)</div>`,'g'))].map(m=>({i:m.index,name:unesc(m[1])}));
    const groups=[];
    [...body.matchAll(new RegExp(`class="${px}-qa-item"><summary class="${px}-qa-q"><span class="${px}-qa-arrow">▸</span>([\\s\\S]*?)</summary><div class="${px}-qa-a">([\\s\\S]*?)</div>`,'g'))].forEach(m=>{
      let g2=0;while(g2<hdrs.length&&hdrs[g2].i<m.index)g2++;
      if(!groups[g2])groups[g2]={name:g2?hdrs[g2-1].name:'',items:[]};
      groups[g2].items.push({q:unesc(m[1]),a:unesc(m[2])});
    });
    if(groups.length)d.groups=groups.filter(Boolean);
    return d},
  changelog:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-revt">([\\s\\S]*?)</div>`));if(t){d.showTitle=true;d.title=unesc(t[1])}
    const rows=[...s.matchAll(new RegExp(`class="${px}-clrow"><span class="${px}-clv">([^<]*)</span>(?:<span class="${px}-cld">([^<]*)</span>)?<span class="${px}-clt">([\\s\\S]*?)</span></div>`,'g'))]
      .map(m=>[unesc(m[1]),m[2]?unesc(m[2]):'',unesc(m[3])].join('|'));
    if(rows.length)d.lines=rows.join('\n');
    return d},
};

/* gate 六主题的文案类名各不相同（gen/body.js 分主题输出），按主题查表提取；end 为闭合标签名 */
const GATE_CLS={
  classic:[['title','-gatetitle','span'],['text','-gatetext','span'],['buttonText','-gatebtn','span']],
  curtain:[['logo','-gcurlogo','div'],['title','-gcurtitle','div'],['text','-gcurtext','div'],['buttonText','-gcurbtn','span']],
  seal:[['title','-gsealtitle','div'],['text','-gsealtext','div'],['buttonText','-gsealbtn','span']],
  vault:[['logo','-gvaultlogo','div'],['title','-gvaulttitle','div'],['text','-gvaulttext','div'],['buttonText','-gvaultbtn','span']],
  scan:[['logo','-gscanlogo','div'],['title','-gscantitle','div'],['text','-gscantext','div'],['buttonText','-gscanbtn','span']],
  age:[['logo','-gagelogo','div'],['title','-gagetitle','div'],['text','-gagetext','div'],['buttonText','-gageenter','label'],['leaveText','-gageleave','button']],
};
Object.assign(SALVAGE,{
  gate:(s,px)=>{const gt=s.includes(px+'-gateage')?'age':s.includes(px+'-gcurcover')?'curtain':s.includes(px+'-gsealcover')?'seal':s.includes(px+'-gvaultcover')?'vault':s.includes(px+'-gscancover')?'scan':'classic';
    const d={theme:gt};
    GATE_CLS[gt].forEach(([k,cls,end])=>{const v=clsInner(s,px,cls,end);if(v)d[k]=v});
    return d},
  decode:(s,px)=>{const lines=[...s.matchAll(new RegExp(`class="${px}-decl"[^>]*>([\\s\\S]*?)</div>`,'g'))].map(m=>unesc(m[1]));
    return lines.length?{lines:lines.join('\n')}:{}},
  gacha:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-gachahd">([\\s\\S]*?)</div>`));if(t)d.title=unesc(t[1]);
    const bt=s.match(new RegExp(`class="[^"]*${px}-gback[^"]*">🎴<span>([\\s\\S]*?)</span>`));if(bt)d.buttonText=unesc(bt[1]);
    const cards=jsonArrAfter(s,'var CARDS=');
    if(cards)d.cards=cards.map(c=>{while(c.length&&c[c.length-1]==='')c.pop();return c.join('|')}).join('\n');
    return d},
  egg:(s,px)=>{const d={};
    const h=s.match(new RegExp(`class="${px}-egg" id="${px}-egg\\d+"[^>]*>([\\s\\S]*?)</button>`));if(h)d.hint=unesc(h[1]);
    const lines=jsonArrAfter(s,'var LINES=');
    if(lines)d.lines=lines.join('\n');
    const n=s.match(/,N=(\d+),/);if(n)d.count=+n[1];
    return d},
  blurreveal:(s,px)=>{const d={};
    const t=s.match(new RegExp(`class="${px}-revt">([\\s\\S]*?)</div>`));if(t){d.showTitle=true;d.title=unesc(t[1])}
    const h=s.match(new RegExp(`class="${px}-segh">([\\s\\S]*?)</div>`));if(h)d.hint=unesc(h[1]);
    const lines=[...s.matchAll(new RegExp(`class="${px}-segc">([\\s\\S]*?)</div>`,'g'))].map(m=>unesc(m[1]));
    if(lines.length)d.lines=lines.join('\n');
    return d},
});

/* 容器 wrap 层切片：div 配对计数扫描而非正则——自由 HTML 里可能有任意嵌套 div 与同形字符串，
   且页尾运行时脚本（开场白列表/灯箱/漫画阅读器）含各区块类名，不挡在外面尾块会被误认。
   无 wrap 层返回空数组，由调用方报「没解析到内容」 */
function wrapSlice(doc,px){
  const open=`<div class="${px}-wrap">`;
  const s=doc.indexOf(open);
  if(s<0)return [];
  const re=/<\/?div\b[^>]*>/g;
  re.lastIndex=s+open.length;
  let d=1,m;
  while((m=re.exec(doc))){
    d+=m[0][1]==='/'?-1:1;
    if(!d)return [doc.slice(s,re.lastIndex)];
  }
  return [doc.slice(s)];
}

/* v2 配置快照：buildFullDoc 内嵌的精简工程 JSON（< 已转义 \u003c，不会提前闭合标签，
   type=application/json 不执行）。完整往返靠它——salvage 只做旧导出的兜底 */
function parseCfg(doc){
  const m=doc.match(/<script type="application\/json" id="opg-cfg-json">([\s\S]*?)<\/script>/);
  if(!m)return null;
  try{
    const c=JSON.parse(m[1]);
    if(c&&Array.isArray(c.blocks)&&c.theme&&typeof c.theme==='object')return c;
  }catch(e){}
  return null;
}

/** 解析导出的开场页 HTML → 工程草稿。旧导出（无 data-opg-ver 版本锚）也按尽力识别处理；
 *  无 bk 作用域层的更老导出无法安全切块，整段标待认领。
 * @param {string} html 完整导出文档（导出页①带围栏原文亦可）或含 opg- 容器的片段
 * @returns {{ver:number|null,cfg:object|null,px:string,items:{type:string,ok:boolean,html:string,draft:object}[]}}
 *          cfg 为 v2 配置快照（存在时导入优先走它，items 仅供旧路径兼容） */
export function parseExportDoc(html){
  const doc=String(html??'');
  const verM=doc.match(/data-opg-ver="(\d+)"/);
  const cfg=parseCfg(doc);
  const pxM=doc.match(/id="(opg-[a-z0-9]+)"/);
  if(!pxM)throw new Error('没找到开场页容器（id="opg-…"）——确认粘贴的是本工具导出的完整页面');
  const px=pxM[1];
  const wrap=wrapSlice(doc,px)[0]||'';
  const chunks=wrap?[...wrap.matchAll(new RegExp(`<div class="${px}-bk(\\d+)">[\\s\\S]*?(?=<div class="${px}-bk\\d+">|$)`,'g'))]:[];
  const items=[];
  chunks.forEach(m=>{
    const seg=m[0];
    /* 空壳段（decor 或内容为空的区块只产出容器层）无可恢复内容，跳过 */
    /* bk 开闭标签用 div 配对计数定位：末块段里混着 wrap 闭合、自由 HTML 内层 div 层数不定，尾剥正则数不准 */
    const gt=seg.indexOf('>');
    const dre=/<\/?div\b[^>]*>/g;
    dre.lastIndex=gt+1;
    let dd=1,bend=seg.length,dm;
    while((dm=dre.exec(seg))){dd+=dm[0][1]==='/'?-1:1;if(!dd){bend=dm.index;break}}
    const inner=seg.slice(gt+1,bend).trim();
    if(!inner)return;
    let type=null;
    for(const [t,sigs] of SIGNATURES){if(sigs.some(sg=>seg.includes(px+sg))){type=t;break}}
    items.push(type
      ?{type,ok:true,html:inner,draft:SALVAGE[type](inner,px)}
      :{type:'freehtml',ok:false,html:inner,draft:{}});
  });
  /* 无 bk 层的旧导出：整页无法安全切块，不做签名猜测，整段进待认领 */
  if(!chunks.length&&wrap.trim().replace(/^<div[^>]*>/,'').replace(/<\/div>\s*$/,'').trim()){
    items.push({type:'freehtml',ok:false,html:wrap,draft:{}});
  }
  return {ver:verM?+verM[1]:null,cfg,px,items};
}

/* 勾选预览的 detail 列：摘要草稿实际恢复到的内容（freehtml 由调用方按聚合计数另行拼装） */
function detailOf(type,d0){
  const lineN=v=>String(v??'').split('\n').filter(Boolean).length;
  switch(type){
    case 'welcome':return [d0.title&&'标题',d0.subtitle&&'副标题',d0.eyebrow&&'眉标'].filter(Boolean).join(' / ')||'仅启用（字段为空）';
    case 'quote':return d0.text?`引言 ${d0.text.length} 字${d0.source?'（含出处）':''}`:'仅启用';
    case 'profile':return (d0.characters||[]).length?`${d0.characters.length} 位角色`:'仅启用';
    case 'gallery':return `${(d0.images||[]).length} 张图`;
    case 'comic':return `${(d0.pages||[]).length} 页`+(d0.cover?'（含封面入口）':'（横幅入口）');
    case 'greetings':return `${lineN(d0.placeholderList)} 条开场白`+((d0.entries||[]).some(e=>e.cover)?` + ${(d0.entries||[]).filter(e=>e.cover).length} 张封面`:'');
    case 'divider':return d0.text?`自定义文案「${d0.text.slice(0,12)}」`:(d0.style?`样式 ${d0.style}`:'纯线（花色不可辨）');
    case 'disclaimer':case 'author':return `文本 ${String(d0.text||'').length} 字${d0.style?`，样式 ${d0.style}`:''}`;
    case 'clockbar':return '文案原样保留';
    case 'randomevent':case 'changelog':case 'decode':case 'blurreveal':return `${lineN(d0.lines)} 行`;
    case 'timeline':return `${lineN(d0.nodes)} 个节点`;
    case 'dice':return [d0.label,d0.expr&&`表达式 ${d0.expr}`].filter(Boolean).join(' · ')||'仅启用';
    case 'countdown':return [d0.title,d0.target&&`目标 ${d0.target}`].filter(Boolean).join(' · ')||'仅启用';
    case 'bgm':return `${(d0.tracks||[]).length} 首曲目`+(d0.volume!=null?` · 音量 ${d0.volume}`:'');
    case 'fx':return `动效 ${d0.effect||'?'}`;
    case 'qa':return `${(d0.groups||[]).reduce((n,g)=>n+g.items.length,0)} 问`;
    case 'gate':return `主题 ${d0.theme||'classic'}`;
    case 'gacha':return `${lineN(d0.cards)} 张卡`;
    case 'egg':return `${lineN(d0.lines)} 条文案`+(d0.count?` · 连击 ${d0.count}`:'');
  }
  return '';
}
/* salvage 兜底路径的「丢了什么」点名：产物里没保留、只能按默认值回填的配置，逐区块标注 */
const LOSS_NOTES={
  welcome:'装饰风格按默认',
  profile:'头像来源与显示开关按默认',
  gallery:'列数按默认',
  greetings:'风格/点击行为/标题库按默认，音轨不随产物保留',
  clockbar:'颜色/字号/对齐/辉光按默认',
  dice:'样式按默认',
};

/** 解析结果 → 勾选预览（同 cardImport.buildPlan 形状）：v2 配置快照存在时逐区块完整恢复；
 *  否则按类型聚合 salvage 多实例（旧导出兜底）
 * @returns {{items:{id:string,label:string,detail:string}[],recognized:number,total:number}}
 */
export function buildRestorePlan(parsed){
  if(parsed.cfg){
    const agg=new Map();
    parsed.cfg.blocks.forEach(b=>{
      if(!b||!b.type||!BLOCK_DEFS[b.type])return;
      const g=agg.get(b.type)||{type:b.type,n:0,disabled:0,first:b};
      g.n++;if(b.enabled===false)g.disabled++;
      agg.set(b.type,g);
    });
    const items=[...agg.values()].map(g=>{
      const def=BLOCK_DEFS[g.type];
      const name=g.type==='freehtml'?'自由 HTML 区':def.name;
      const d=detailOf(g.type,g.type==='freehtml'?{html:''}:g.first);
      const base=g.type==='freehtml'?'自由 HTML 原文':(d||'内容原样');
      return {id:g.type,label:`${def.icon} ${name}${g.n>1?` ×${g.n}`:''}`,detail:`完整恢复（v2 配置快照）· ${base}${g.disabled?` · 含 ${g.disabled} 个停用实例`:''}`};
    });
    const total=parsed.cfg.blocks.filter(b=>b&&b.type&&BLOCK_DEFS[b.type]).length;
    return {items,recognized:total,total};
  }
  const agg=new Map();
  parsed.items.forEach(it=>{
    const g=agg.get(it.type)||{type:it.type,ok:0,fallback:0,drafts:[]};
    it.ok?g.ok++:g.fallback++;
    g.drafts.push(it.draft);
    agg.set(it.type,g);
  });
  const items=[...agg.values()].map(g=>{
    const def=BLOCK_DEFS[g.type];
    const name=g.type==='freehtml'&&!g.ok?'待认领区块':(def?def.name:g.type);
    const n=g.ok+g.fallback;
    const detail=g.type==='freehtml'
      ?[g.ok&&`${g.ok} 段已识别`,g.fallback&&`${g.fallback} 段未能识别（原样保留待认领）`].filter(Boolean).join(' + ')||'原样保留'
      :detailOf(g.type,g.drafts[0])+(LOSS_NOTES[g.type]?`（${LOSS_NOTES[g.type]}）`:'');
    return {id:g.type,label:`${def?def.icon:'❓'} ${name}${n>1?` ×${n}`:''}`,detail};
  });
  return {items,recognized:parsed.items.filter(i=>i.ok).length,total:parsed.items.length};
}

/* 多实例合并策略：行文本 join 换行、数组 concat 合回单区块。
   create() 默认样本值首次直接替换——默认示例不算用户内容，拼在导入内容后面只会产生脏数据；
   其余标量首见生效（多实例时取文档顺序第一份） */
const LINE_FIELDS={greetings:'placeholderList',randomevent:'lines',timeline:'nodes',changelog:'lines',decode:'lines',blurreveal:'lines',gacha:'cards',egg:'lines',freehtml:'html'};
const ARR_FIELDS={profile:'characters',gallery:'images',comic:'pages',bgm:'tracks',qa:'groups',greetings:'entries'};

/** 把勾选的恢复计划应用到工程（p 已 defaultProject+normalize；调用方在应用后需再跑一遍
 *  migrate/normalize 补齐字段——v2 快照路径整体替换了 theme/blocks）。
 *  v2 快照：整工程配置原样落位（勾选的类型保留、未勾选的补回默认停用块），无损往返；
 *  旧导出：启用区块并按合并策略写字段
 * @returns {string} 结果摘要（toast 用） */
export function applyRestorePlan(p,parsed,chosenTypes){
  const got=new Set(chosenTypes);
  /* v2 配置快照优先：name/marker/theme/macros/blocks 原样回填（create() 缺省字段先垫底，
     快照带值再覆盖——跨版本字段增删由调用方的 normalize 兜底） */
  if(parsed.cfg){
    const c=parsed.cfg;
    if(c.name)p.name=String(c.name);
    if(c.marker)p.marker=String(c.marker);
    if(c.theme&&typeof c.theme==='object')p.theme=c.theme;
    if(Array.isArray(c.macros)&&c.macros.length)p.macros=c.macros;
    const kept=Array.isArray(c.blocks)?c.blocks.filter(b=>b&&b.type&&BLOCK_DEFS[b.type]&&got.has(b.type)):[];
    p.blocks=kept.map(b=>{
      const out={...BLOCK_DEFS[b.type].create(),type:b.type,enabled:b.enabled!==false};
      Object.keys(b).forEach(k=>{if(b[k]!==undefined)out[k]=b[k]});
      return out;
    });
    BLOCK_ORDER.forEach(t=>{if(!p.blocks.some(b=>b.type===t))p.blocks.push({type:t,enabled:false,...BLOCK_DEFS[t].create()})});
    return '已按配置快照完整恢复：'+([...new Set(kept.map(b=>BLOCK_DEFS[b.type].name))].join('、')||'（未勾选任何项）');
  }
  const seen=new Set();
  const done=[];
  parsed.items.forEach(it=>{
    if(!it.ok){
      /* 未识别段落：整段原样进自由 HTML 区并标注，由用户手动认领（需勾选该预览项） */
      if(!got.has('freehtml'))return;
      const fb=p.blocks.find(b=>b.type==='freehtml');
      if(!fb)return;
      /* 字面注释开序列不进源码（build 闸门 lint 规则，惯例见 gen/index.js greetSnapshotLines） */
      const stub=['<!','--'].join('')+' 反向导入：未能自动识别区块类型，以下为原样产物，请手动认领或整理 -->\n'+it.html;
      fb.html=fb.html?fb.html+'\n'+stub:stub;
      fb.enabled=true;
      return;
    }
    if(!got.has(it.type))return;
    const b=p.blocks.find(x=>x.type===it.type);
    if(!b)return;
    b.enabled=true;
    Object.keys(it.draft).forEach(k=>{
      const v=it.draft[k];
      if(v==null||v===''||(Array.isArray(v)&&!v.length))return;
      const fk=it.type+'.'+k;
      const first=!seen.has(fk);
      seen.add(fk);
      if(ARR_FIELDS[it.type]===k){
        const defv=BLOCK_DEFS[it.type]?BLOCK_DEFS[it.type].create()[k]:null;
        b[k]=first&&JSON.stringify(b[k])===JSON.stringify(defv)?v:(Array.isArray(b[k])?b[k]:[]).concat(v);
      }else if(LINE_FIELDS[it.type]===k){
        const defv=BLOCK_DEFS[it.type]?BLOCK_DEFS[it.type].create()[k]:undefined;
        b[k]=first&&b[k]===defv?String(v):(b[k]?b[k]+'\n'+v:String(v));
      }else if(first){
        b[k]=v;
      }
    });
    if(!done.includes(it.type))done.push(it.type);
  });
  return '已恢复：'+(done.map(t=>(BLOCK_DEFS[t]||{name:t}).name).join('、')||'（未勾选任何项）');
}

export { EXPORT_VER };
