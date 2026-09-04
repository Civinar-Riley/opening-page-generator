/* ================================================================
 * 纯文本状态栏生成器（纯函数模块）
 * 自定义字段 → 三件套：世界书条目 + 正则美化 JSON + 开场白后纯文字状态栏
 * 两种模式：
 *   lines 行式：AI 逐行输出「字段：值」，正则按字段名顺序捕获，静态 HTML 模板 $n 插值
 *   block 标签块：AI 在自定义标签内输出（行式/简化 YAML），整块捕获后由内嵌
 *                解析器动态渲染，字段增删自适应
 * ================================================================ */
import { esc, uid } from './utils.js';

const SB_PRESETS_KEY='openingPageGen_v1_sbPresets';
/* 生成的美化面板 DOM 前缀（单状态栏场景足够；localStorage 记忆按此前缀存取） */
const SB_PX='opg-sb';

/* ---------- 默认配置 ---------- */
const DEFAULT_FIELDS=[
  {name:'角色名称',sample:'林晚晴',hint:'当前焦点角色的全名',quote:false,render:'normal'},
  {name:'当前时间',sample:'周五傍晚，华灯初上',hint:'大致时间即可，无需精确到分秒',quote:false,render:'normal'},
  {name:'地点',sample:'老城区一栋旧楼的天台咖啡馆',hint:'角色当前所在地点，可带简短环境描写',quote:false,render:'normal'},
  {name:'关系',sample:'半年未见的老同学',hint:'与{{user}}的当前关系',quote:false,render:'normal'},
  {name:'服装',sample:'米色针织开衫，内搭白色长裙',hint:'角色当前的穿着描述',quote:false,render:'normal'},
  {name:'心理活动',sample:'他居然真的来了……半年没联系，一开口就约在天台，到底想说什么呢。先稳住，别让他看出我紧张。',hint:'用引号包裹的内心独白，20 个汉字以上，不使用省略号',quote:true,render:'quote'},
];
/* 参考1 完整字段套（含成人字段，由用户自行选用；示例值为原创占位） */
const REF_FULL_FIELDS=[
  {name:'角色名称',sample:'林晚晴',hint:'当前焦点角色的全名',quote:false,render:'normal'},
  {name:'当前时间',sample:'周五傍晚，华灯初上',hint:'大致时间即可，无需精确到分秒',quote:false,render:'normal'},
  {name:'地点',sample:'老城区一栋旧楼的天台咖啡馆',hint:'所在地点与简短环境',quote:false,render:'normal'},
  {name:'关系',sample:'半年未见的老同学',hint:'与{{user}}的当前关系',quote:false,render:'normal'},
  {name:'服装',sample:'米色针织开衫，内搭白色长裙，肩上挎着帆布包',hint:'穿着描写',quote:false,render:'normal'},
  {name:'内衣',sample:'……（穿戴情况与样式，简单短语描述）',hint:'包括文胸和内裤，说明是否穿戴',quote:false,render:'normal'},
  {name:'乳房',sample:'……（简单短语描述，不少于 15 个汉字）',hint:'简单短语描述，不得低于 15 个中文汉字',quote:false,render:'normal'},
  {name:'阴道',sample:'……（简单短语描述，不少于 15 个汉字）',hint:'简单短语描述，不得低于 15 个中文汉字',quote:false,render:'normal'},
  {name:'肛门',sample:'……（简单短语描述，不少于 15 个汉字）',hint:'简单短语描述，不得低于 15 个中文汉字',quote:false,render:'normal'},
  {name:'处女膜',sample:'……（简单短语描述，不少于 15 个汉字）',hint:'简单短语描述，不得低于 15 个中文汉字',quote:false,render:'normal'},
  {name:'心理活动',sample:'他居然真的来了……半年没联系，一开口就约在天台，到底想说什么呢。先稳住，别让他看出我紧张。',hint:'引号包裹，20 汉字以上，不用省略号',quote:true,render:'quote'},
];
const MINI_FIELDS=[
  {name:'角色名称',sample:'林晚晴',hint:'当前焦点角色的全名',quote:false,render:'normal'},
  {name:'当前时间',sample:'周五傍晚',hint:'大致时间',quote:false,render:'normal'},
  {name:'地点',sample:'天台咖啡馆',hint:'所在地点',quote:false,render:'normal'},
  {name:'心理活动',sample:'他居然真的来了……半年没联系，到底想说什么呢。先稳住。',hint:'引号包裹的内心独白',quote:true,render:'quote'},
];

const STATUS_PRESETS=[
  {name:'中性日常套（默认）',fields:DEFAULT_FIELDS},
  {name:'参考·完整套（含成人字段）',fields:REF_FULL_FIELDS},
  {name:'精简三件套',fields:MINI_FIELDS},
];

/* ---------- 美化配置预设（布局 + 标题 + 行动选项组合） ---------- */
const BEAUTY_PRESETS=[
  {name:'夜宴酒牌',dot:'#b8956a',patch:{layout:'cards',title:'角色状态',actions:true,actionCount:4,actionStyles:'最佳,良好,中等,冒险'}},
  {name:'赛博终端',dot:'#00e5ff',patch:{layout:'grid',title:'STATUS · 系统监测',actions:true,actionCount:4,actionStyles:'最优,稳健,中性,大胆',extraCss:'.opg-sb-title{letter-spacing:4px}'}},
  {name:'手稿扉页',dot:'#d9a856',patch:{layout:'opening',title:'本章状态',actions:false,actionCount:4,actionStyles:'最佳,良好,中等,冒险'}},
  {name:'黑客终端',dot:'#39e06e',patch:{layout:'terminal',title:'SYSTEM_LOG',actions:true,actionCount:4,actionStyles:'最优,稳健,中性,大胆',layoutConfig:{columns:1,gap:4,borderStyle:'solid',borderWidth:1,borderRadius:0,headerStyle:'minimal',actionPosition:'inline'}}},
  {name:'冰晶玻璃',dot:'#a0d8ef',patch:{layout:'glass',title:'Status',actions:true,actionCount:4,actionStyles:'平滑,转折,揭秘,超展开',layoutConfig:{columns:2,gap:10,borderStyle:'solid',borderWidth:1,borderRadius:16,headerStyle:'centered',actionPosition:'bottom'}}},
  {name:' Editorial 杂志',dot:'#c9a86c',patch:{layout:'editorial',title:'状 态 栏',actions:false,actionCount:4,actionStyles:'最佳,良好,中等,冒险',layoutConfig:{columns:3,gap:12,borderStyle:'double',borderWidth:1,borderRadius:0,headerStyle:'centered',actionPosition:'bottom'}}},
];
const SB_BEAUTY_KEY='openingPageGen_v1_sbBeauty';

/* ---------- 行动方向词库：选项可单选/组合的方向及定义（定义写入世界书供 AI 理解） ---------- */
const ACTION_DIRECTIONS=[
  {k:'平滑',d:'行动自然顺承前文，对剧情推动较小，平滑过渡。在 NSFW 场景中，可体现为不同的性互动、情趣玩法或情绪表达。'},
  {k:'色情',d:'行动会尝试引入 NSFW 内容，无论当前氛围如何。'},
  {k:'淫秽',d:'行动将引入直白、粗俗或带有强烈性暗示的 NSFW 内容，侧重感官刺激与露骨描述。'},
  {k:'快进',d:'行动将推动时间发展，让故事快进一段时间（通常为几小时到几天）。'},
  {k:'时间跳跃',d:'行动将实现大幅度的跨时间推进（通常为数月到数年），直接呈现未来状态。'},
  {k:'转场',d:'主体的言行将推动空间转场，将故事转移至其他场合。'},
  {k:'超展开',d:'发展完全出乎意料。行动将{{random::大幅深化当前的故事基调::引入脑洞清奇的新剧情::完全颠覆当前的基调}}。'},
  {k:'转折',d:'行动将引入突发事件或意外信息，使剧情剧烈偏转，但建立在既有逻辑之上。'},
  {k:'揭秘',d:'行动将揭示一个隐藏的事实或秘密，改变角色关系或对局势的理解。'},
  {k:'试探',d:'行动将以含蓄方式测试其他角色的底线、真实想法或反应，侧重观察与收集信息。'},
  {k:'退缩',d:'行动将表现角色的犹豫、回避或放弃，从当前局势中抽身或降低冲突烈度。'},
  {k:'视角转换',d:'行动将使叙事视角切换至其他角色、旁观者或全知视角。'},
  {k:'黑暗',d:'行动可能带有残忍/暴虐/幽邃/邪恶/阴暗，引导故事向沉重、压抑、痛苦的方向发展，可能引发矛盾冲突。'},
  {k:'失控',d:'行动将导致角色失去对局面、情绪或身体的控制，引发混乱或真情流露。'},

  {k:'心理描写',d:'行动将深入刻画角色的内心世界，描绘其思想、情感与潜意识。'},
  {k:'闪回',d:'行动将插入一段过去记忆片段，用以解释动机、铺垫情感或埋下伏笔。'},
  {k:'细节',d:'行动将聚焦于环境、物品或角色的微小细节，通过感官描写营造氛围或暗示潜在信息。'},
  {k:'氛围',d:'行动将着力改变当前的情绪或环境基调（如紧张→舒缓，浪漫→悬疑）。'},
];
/* 取某方向的定义；未知（用户自定义）返回空 */
function directionDesc(style){
  return (ACTION_DIRECTIONS.find(d=>d.k===style)||{}).d||'';
}
function loadBeautyPresets(){
  try{return JSON.parse(localStorage.getItem(SB_BEAUTY_KEY)||'[]')}catch(e){return []}
}
function saveBeautyPresets(list){
  try{localStorage.setItem(SB_BEAUTY_KEY,JSON.stringify(list.slice(0,20)))}catch(e){}
}

const DEFAULT_RULES=[
  '必须严格按照给出的参考格式进行输出，不允许更改任何一处格式与字段名，字段顺序不得变动',
  '状态栏拥有全局视角，只显示当前在场角色的状态，不在场的不显示',
  '字段值中不得出现 < > 字符和 HTML 标签，值内不得出现换行',
  '禁止输出扮演者（{{user}}）的心理活动',
  '时间无需精确到几分几秒，但至少需要说明此时的大概时间',
];

function defaultConfig(){
  return {
    mode:'lines',              /* 'lines' 行式 | 'block' 标签块 */
    tag:'Status_block',
    title:'角色状态',
    fields:JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
    rules:DEFAULT_RULES.slice(),
    entryComment:'状态栏输出指令',
    depth:0,
    role:0,                    /* 0=system 1=user 2=AI */
    order:999,
    actions:false,             /* 行动选项（两种模式通用） */
    actionCount:4,
    actionStyles:'平滑,试探,转折,超展开',  /* 每个选项的方向，英文逗号分割（顺序=组合顺序），写入世界书规则 */
    layout:'cards',            /* 美化布局：cards 卡片风 / grid 紧凑网格 / opening 开场页风 / terminal 终端 / glass 玻璃态 / editorial 杂志排版 */
    layoutConfig:{columns:2,gap:8,borderStyle:'solid',borderWidth:1,borderRadius:12,headerStyle:'standard',actionPosition:'bottom'},
    extraCss:'',               /* 自定义 CSS：追加在生成的美化样式之后 */
    /* 样式统筹：分级覆盖（空值回落工程主题色）；extraCss 仍是最后优先级 */
    style:{
      labelColor:'',           /* 标签色（空=跟随面板文字色） */
      valueColor:'',           /* 值色（空=跟随面板文字色） */
      panelTextColor:'',       /* 面板文字色（空=跟随工程文字色）；同时覆盖标签/值/行动选项 */
      labelFont:'',            /* 标签字体 */
      valueFont:'',            /* 值字体 */
      panelBg:'follow',        /* follow|transparent|solid|gradient|image */
      panelBgColor:'#12141d',
      panelBgColor2:'#1b1e2e',
      panelBgImage:'',
      panelShadow:true,
      actionOptColor:'',       /* 行动选项文字色（空=跟随面板文字色） */
      actionOptBg:'',          /* 行动选项背景色（空=跟随默认深底） */
      actionOptBorder:'',      /* 行动选项边框色（空=跟随主色） */
    },
  };
}

/* ---------- 旧版默认示例值迁移 ----------
 * v1.7.0 默认字段示例借用了参考文件内容（梁晓彤等），v1.7.1 换为原创值；
 * 旧工程已在 localStorage 里保存了旧示例，这里按值精确映射替换。
 * 只替换恰好等于旧默认值的 sample，用户自定义的内容不受影响 */
const SAMPLE_MIGRATE_MAP={
  '梁晓彤':'林晚晴',
  '黄昏时刻':'周五傍晚，华灯初上',
  '学校体育馆':'老城区一栋旧楼的天台咖啡馆',
  '学校体育馆的更衣室':'老城区一栋旧楼的天台咖啡馆',
  '朋友':'半年未见的老同学',
  '哥们(允许非插入行为)':'半年未见的老同学',
  '运动背心和短裤':'米色针织开衫，内搭白色长裙',
  '运动背心被汗水浸湿，短裤松松垮垮地挂在腰间':'米色针织开衫，内搭白色长裙，肩上挎着帆布包',
  '这家伙到底在想什么……算了，先观察一下再说。':'他居然真的来了……半年没联系，一开口就约在天台，到底想说什么呢。先稳住，别让他看出我紧张。',
  '那家伙要是现在在这儿，肯定又得盯着看个没完，不过…他那副偷偷摸摸的样子还挺好玩的':'他居然真的来了……半年没联系，一开口就约在天台，到底想说什么呢。先稳住，别让他看出我紧张。',
  '步非烟':'林晚晴',
  '深夜 23:15':'周五傍晚',
  '私人直播间':'天台咖啡馆',
  '问他个人信息真的只是为了工作吗？我怎么感觉自己是真的想了解他……':'他居然真的来了……半年没联系，到底想说什么呢。先稳住。',
};
function migrateStatusbarSamples(cfg){
  if(!cfg||!Array.isArray(cfg.fields))return;
  cfg.fields.forEach(f=>{
    if(f&&typeof f.sample==='string'&&SAMPLE_MIGRATE_MAP[f.sample])f.sample=SAMPLE_MIGRATE_MAP[f.sample];
  });
}

/* 有效字段：过滤掉名字为空的字段（空名会让正则乱匹配、$n 编号错位），
 * 所有生成器（正则/静态模板/条目/示例/预览）必须统一使用这一份列表，保证编号一致 */
const effFields=cfg=>(cfg.fields||[]).filter(f=>f.name&&f.name.trim());
/* 渲染样式判定：render 优先，兼容旧数据的 quote 布尔 */
const isQuote=f=>f.render==='quote'||(!f.render&&f.quote);
const isProgress=f=>f.render==='progress';

/* ---------- 用户自存字段预设（localStorage 全局，上限 20） ---------- */
function loadUserPresets(){
  try{return JSON.parse(localStorage.getItem(SB_PRESETS_KEY)||'[]')}catch(e){return []}
}
function saveUserPresets(list){
  try{localStorage.setItem(SB_PRESETS_KEY,JSON.stringify(list.slice(0,20)))}catch(e){}
}

/* ---------- 示例文本导入解析（也被预览/示例复用） ----------
 * 自动检测：含状态栏式自定义标签 → 块式（标签名限制为「大写字母开头且总长≥4」，
 * 避免 <b>/<div> 等普通 HTML 标签误判）；否则行式。
 * 返回 {mode,tag,fields:[{name,sample,quote}]} */
function parseSampleText(text){
  const t=String(text??'').trim();
  const out={mode:'lines',tag:'Status_block',fields:[]};
  if(!t)return out;
  let inner=t,tag='';
  const bm=/<\s*([A-Z][A-Za-z0-9_-]{3,})\s*>([\s\S]*?)<\s*\/\s*\1\s*>/.exec(t);
  if(bm){out.mode='block';out.tag=bm[1];inner=bm[2]}
  const seen=new Set();
  let cur=null;
  inner.replace(/\r/g,'').split('\n').forEach(line=>{
    const s=line.trim().replace(/^-\s*/,'');
    if(!s)return;
    if(/^\d+[.、]\s*/.test(s)&&cur&&cur.name==='行动选项')return; /* 跳过选项编号行 */
    const m=s.match(/^([^：:]{1,24})[:：]\s*(.*)$/);
    if(m){
      const name=m[1].trim();
      if(!name||seen.has(name)){cur=null;return}
      seen.add(name);
      let val=m[2].trim();
      let quote=false;
      const qm=/^["“]([\s\S]*)["”]$/.exec(val);
      if(qm){val=qm[1].trim();quote=true}
      cur={name,sample:val,quote};
      out.fields.push(cur);
    }else if(cur){
      if(/选项/.test(cur.name))return; /* 选项字段的续行（选项列表）不并入示例值 */
      cur.sample=(cur.sample?cur.sample+'\n':'')+s; /* 无冒号行：上一字段的续行 */
    }
  });
  return out;
}

/* ---------- findRegex ---------- */
const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function buildFindRegex(cfg){
  if(cfg.mode==='block'){
    const tag=escRe(cfg.tag||'Status_block');
    return '<'+tag+'>\\s*([\\s\\S]*?)\\s*<\\/'+tag+'>';
  }
  const fields=effFields(cfg);
  let pat='';
  fields.forEach((f,i)=>{
    const vp=isQuote(f)
      ?'["\u201c]([^"\u201d]+)["\u201d]'
      :(i===fields.length-1?'([^\\n]*)':'([^\\n]*?)');
    pat+=escRe(f.name)+'\\s*[:：][ \\t]*'+vp;
    if(i<fields.length-1)pat+='[ \\t]*\\r?\\n[\\s\\S]*?';
  });
  /* 行动选项（与生成模式无关）：末尾「行动选项：」+ 短横线列表，整体作为一个捕获组 */
  if(cfg.actions&&fields.length){
    pat+='\\s*[\\s\\S]*?'+escRe('行动选项')+'\\s*[:：][ \\t]*\\r?\\n((?:[ \\t]*-[^\\n]*\\n?)+)';
  }
  return pat;
}

/* 正则测试沙盒（纯函数）：用与 findRegex 同源的 pattern 对真实文本执行匹配+替换。
 * 返回 {hit, groups:[{n,name,value}], replaced} 或 {hit:false}（未命中）/{hit:false,error}（正则无效）；
 * 替换按 $n 降序（避免 $1 误伤 $10/$11），块式 $1 为整块文本——与 buildPreviewDoc 同规则 */
function applyStatusRegex(text,cfg,{theme}={}){
  const isBlock=cfg.mode==='block';
  let re;
  try{re=new RegExp(buildFindRegex(cfg),'g')}catch(e){return {hit:false,error:'正则无效：'+e.message}}
  const m=re.exec(String(text??''));
  if(!m)return {hit:false};
  const fields=effFields(cfg);
  const groups=[];
  if(isBlock){
    groups.push({n:1,name:'状态栏整块',value:m[1]||''});
  }else{
    fields.forEach((f,i)=>{if(m[i+1]!==undefined)groups.push({n:i+1,name:f.name,value:m[i+1]})});
    if(cfg.actions&&fields.length&&m[fields.length+1]!==undefined)groups.push({n:fields.length+1,name:'行动选项',value:m[fields.length+1]});
  }
  let doc=buildFullDoc(cfg,theme||defaultConfig(),{preview:false});
  const caps=Array.from({length:Math.max(0,m.length-1)},(_,i)=>esc(m[i+1]||''));
  /* 单遍替换 $n：逐遍 split/join 会二次命中插入文本里的 $<数字>（如捕获值含 $100 被 $1 遍破坏） */
  doc=doc.replace(/\$(\d+)/g,(mm,num)=>{const v=caps[+num-1];return v===undefined?mm:v});
  return {hit:true,groups,replaced:doc};
}


/* ---------- 世界书条目 ---------- */
function fieldLines(cfg,{quote=false}={}){
  return effFields(cfg).map(f=>{
    const ph='${'+(f.hint||'填写内容')+(f.sample?'，示例:'+f.sample:'')+'}';
    const v=quote&&isQuote(f)?'"'+ph+'"':ph;
    return f.name+'：'+v;
  }).join('\n');
}
function actionBlock(cfg,indent='  '){
  if(!cfg.actions)return '';
  const n=Math.max(2,Math.min(8,+cfg.actionCount||4));
  const styles=String(cfg.actionStyles||'').split(',').map(s=>s.trim()).filter(Boolean);
  let s='\n行动选项：\n';
  for(let i=0;i<n;i++){
    const st=styles.length?styles[i%styles.length]:'';
    s+=indent+'- '+(st
      ?st+'：${符合「'+st+'」方向、从{{user}}角度出发的具体行动，约 30 字}'
      :'${从{{user}}角度出发、贴合当前剧情的行动选项，约 30 字}')+'\n';
  }
  return s;
}
/* 行动方向定义段：仅列出 actionStyles 中实际用到的方向（去重保序），写入世界书供 AI 理解 */
function directionDefsBlock(cfg){
  if(!cfg.actions)return '';
  const used=[...new Set(String(cfg.actionStyles||'').split(',').map(x=>x.trim()).filter(Boolean))]
    .map(st=>{const d=directionDesc(st);return d?`- ${st}——${d}`:null}).filter(Boolean);
  if(!used.length)return '';
  return '\n行动选项方向定义（每个选项须严格符合其方向描述）：\n'+used.join('\n')+'\n';
}
/* 行动选项的示例短横线行（世界书完整示例 / 开场白后缀 / 行式预览数据源共用） */
function optionLines(cfg,indent='  '){
  const n=Math.max(2,Math.min(8,+cfg.actionCount||4));
  const styles=String(cfg.actionStyles||'').split(',').map(x=>x.trim()).filter(Boolean);
  let s='';
  for(let i=0;i<n;i++){
    const st=styles.length?styles[i%styles.length]:'';
    s+=indent+'- '+(st?st+'：':'')+'（示例选项：从{{user}}角度出发的行动选项，约 30 字）\n';
  }
  return s;
}
function buildEntryContent(cfg){
  const isBlock=cfg.mode==='block';
  let s='在每次输出的最后，先正常输出正文剧情，然后在正文之后严格按照以下格式输出状态栏（将 ${...} 占位替换为实际内容，不要输出 ${ } 符号本身）：\n\n';
  if(isBlock)s+='<'+(cfg.tag||'Status_block')+'>\n';
  s+=fieldLines(cfg,{quote:true,render:'quote'});
  if(cfg.actions)s+=actionBlock(cfg,'  ');
  if(isBlock)s+='\n</'+(cfg.tag||'Status_block')+'>';
  s+=directionDefsBlock(cfg);
  s+='\n\n完整示例（仅示意内容与格式，实际输出必须贴合当前剧情）：\n\n';
  if(isBlock)s+='<'+(cfg.tag||'Status_block')+'>\n';
  s+=buildSampleInner(cfg);
  if(isBlock)s+='\n</'+(cfg.tag||'Status_block')+'>';
  s+='\n\n字段说明：\n';
  effFields(cfg).forEach(f=>{s+='- '+f.name+'：'+(f.hint||'')+(isQuote(f)?'（值需用引号包裹）':'')+'\n'});
  s+='\n规则：\n';
  (cfg.rules||[]).forEach(r=>{if(r.trim())s+='- '+r.trim()+'\n'});
  if(cfg.actions)s+='- 行动选项共 '+Math.max(2,Math.min(8,+cfg.actionCount||4))+' 个，从{{user}}角度出发，必须贴合当前上下文\n';
  return s.replace(/\n{3,}/g,'\n\n').trim()+'\n';
}
function buildWorldbook(cfg){
  return {entries:{
    '0':{
      uid:0,
      comment:cfg.entryComment||'状态栏输出指令',
      content:buildEntryContent(cfg),
      constant:true,          /* 蓝灯常驻 */
      key:[],
      keysecondary:[],
      position:4,             /* @D 深度插入 */
      depth:+cfg.depth||0,
      role:+cfg.role||0,      /* 0=system 1=user 2=AI */
      order:+cfg.order||999,
      excludeRecursion:true,
      preventRecursion:true,
      disable:false,
    },
  }};
}

/* ---------- 纯文字状态栏示例 ---------- */
function buildSampleInner(cfg){
  let s=effFields(cfg).map(f=>{
    const v=isQuote(f)?'"'+(f.sample||'')+'"':(f.sample||'');
    return f.name+'：'+v;
  }).join('\n');
  if(cfg.actions)s+='\n行动选项：\n'+optionLines(cfg,'  ');
  return s;
}
function buildSampleText(cfg,{commentHeader=false}={}){
  const isBlock=cfg.mode==='block';
  let s='';
  if(commentHeader){
    s+='<!-- 开场页状态栏示例：本段会被「状态栏美化」正则替换为美化面板；'
      +'字段格式由世界书条目约束；可修改下方示例值，字段增删后请到生成器重新生成两份文件 -->\n';
  }
  if(isBlock)s+='<'+(cfg.tag||'Status_block')+'>\n';
  s+=buildSampleInner(cfg);
  if(isBlock)s+='\n</'+(cfg.tag||'Status_block')+'>';
  return s;
}

/* ================================================================
 * 美化 HTML（跟随工程主题色）
 * ================================================================ */
/* 噪点纹理（SVG feTurbulence data URI，无外部资源） */
const SB_NOISE="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

/* CSS 值净化：主题/样式值随工程 JSON 可分享（导入即生成可在酒馆执行的产物），
   </style> 逃逸可注入任意 HTML——与 gen/css.js fontSafe 同款防御；
   剔除尖括号/引号/反斜杠/换行（合法颜色/字体名均不含这些字符） */
const cssSafe=v=>String(v??'').replace(/[<>"\\]/g,'').replace(/[\r\n]/g,'');

function sbCss(theme,cfg){
  const th=theme||{};
  const layout=cfg.layout||'grid';
  const st=cfg.style||{};
  const primary=cssSafe(th.primary)||'#7c6cf0';
  const accent=cssSafe(th.accent)||'#e8c47c';
  const textColor=cssSafe(th.textColor)||'#f0f0f5';
  const radius=+(th.radius||12);
  const font=(th.fontName?'"'+cssSafe(th.fontName)+'",':'')+'"Segoe UI","Microsoft YaHei",sans-serif';
  /* 样式统筹：标签/值/行动选项 颜色与字体（空值回落面板文字色或主题色） */
  const panelText=cssSafe(st.panelTextColor)||textColor;
  const kColor=cssSafe(st.labelColor)||panelText;
  const vColor=cssSafe(st.valueColor)||panelText;
  const kFont=(st.labelFont?'"'+cssSafe(st.labelFont)+'",':'')+font;
  const vFont=(st.valueFont?'"'+cssSafe(st.valueFont)+'",':'')+font;
  const actColor=cssSafe(st.actionOptColor)||panelText;
  const actBg=cssSafe(st.actionOptBg)||'rgba(15,15,25,.85)';
  const actBorder=cssSafe(st.actionOptBorder)||primary+'55';
  /* 衬线显示栈：标题/徽章用（iframe 内依赖本机字体，宋体系必有） */
  const serif='"Noto Serif SC","Source Han Serif SC","STZhongsong","SimSun",serif';
  /* 入场交错浮现延迟（封顶 12 个） */
  const stagger=Array.from({length:12},(_,i)=>`.${SB_PX}-body>.${SB_PX}-item:nth-child(${i+1}),.${SB_PX}-body>.${SB_PX}-card:nth-child(${i+1}){animation-delay:${(0.12+i*0.06).toFixed(2)}s}`).join('\n');
  return `
.${SB_PX}-root{all:initial;box-sizing:border-box;font-family:${font};display:block;max-width:640px;margin:0 auto;color:${textColor};font-size:14px;line-height:1.7;position:relative}
.${SB_PX}-root *{box-sizing:border-box;font-family:inherit}
.${SB_PX}-root>*{position:relative;z-index:1}
.${SB_PX}-root.sb-s{font-size:12px}.${SB_PX}-root.sb-l{font-size:16px}
/* 氛围层：主题色光晕 + 噪点 */
.${SB_PX}-atmo{position:absolute;inset:0;z-index:0;pointer-events:none;background:
  radial-gradient(620px 320px at 12% -4%,${primary}36,transparent 62%),
  radial-gradient(540px 340px at 90% 104%,${accent}24,transparent 62%),
  ${SB_NOISE}}
.${SB_PX}-panel{margin:12px 0;background:rgba(15,15,25,.94);border:1px solid ${primary}66;border-radius:${radius}px;overflow:hidden;backdrop-filter:blur(2px);animation:${SB_PX}-fadein .45s ease both}
.${SB_PX}-head{display:flex;align-items:center;flex-wrap:wrap;row-gap:6px;gap:8px;padding:10px 14px;cursor:pointer;user-select:none;list-style:none;background:linear-gradient(90deg,${primary}33,transparent);border-bottom:1px solid ${primary}44}
.${SB_PX}-head::-webkit-details-marker{display:none}
.${SB_PX}-headtxt{position:relative;display:inline-block}
.${SB_PX}-title{font-weight:700;font-size:15px;color:${accent};letter-spacing:1px;flex-shrink:0;font-family:${serif}}
.${SB_PX}-headtxt::after{content:"";position:absolute;left:0;bottom:-3px;height:1px;width:100%;background:linear-gradient(90deg,${accent},transparent);transform:scaleX(0);transform-origin:left;animation:${SB_PX}-sweep .6s .2s ease forwards}
.${SB_PX}-hud{display:flex;align-items:center;gap:8px;min-width:0}
.${SB_PX}-chip{min-width:0;flex-shrink:1;font-size:11px;padding:2px 10px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid ${primary}44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.${SB_PX}-chip::before{content:"●";font-size:7px;vertical-align:1px;margin-right:5px;color:${accent}}
.${SB_PX}-chip:empty{display:none}
.${SB_PX}-fold{margin-left:auto;font-size:11px;opacity:.6;transition:transform .2s}
.${SB_PX}-panel[open] .${SB_PX}-fold{transform:rotate(180deg)}
.${SB_PX}-body{padding:10px 14px}
.${SB_PX}-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.${SB_PX}-root.sb-list .${SB_PX}-grid{grid-template-columns:1fr}
.${SB_PX}-item{background:rgba(255,255,255,.05);border:1px solid ${primary}33;border-radius:8px;padding:7px 10px;min-width:0;animation:${SB_PX}-up .5s ease both}
.${SB_PX}-k{font-size:11px;font-weight:700;color:${accent};letter-spacing:1px;margin-bottom:2px}
.${SB_PX}-v{font-size:1em;word-break:break-word;white-space:pre-wrap}
.${SB_PX}-think{grid-column:1/-1;border-left:3px solid ${accent};font-style:italic;background:rgba(255,255,255,.04);border-radius:0 8px 8px 0}
/* 进度条字段：骨架内置，运行时读 N/M 或 N% 填充 */
.${SB_PX}-prog{grid-column:1/-1}
.${SB_PX}-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:5px}
.${SB_PX}-fill{height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,${primary},${accent});box-shadow:0 0 8px ${primary}66;transition:width .8s ease}
.${SB_PX}-prog .${SB_PX}-v{margin-top:3px;font-variant-numeric:tabular-nums;font-size:.9em;opacity:.9}
.${SB_PX}-card{grid-column:1/-1;background:rgba(255,255,255,.04);border:1px solid ${primary}44;border-radius:10px;padding:8px 12px;animation:${SB_PX}-up .5s ease both}
.${SB_PX}-card .${SB_PX}-k{margin-bottom:4px}
.${SB_PX}-actions{margin:0 0 12px;padding:0 2px}
.${SB_PX}-actions:empty{display:none}
.${SB_PX}-opt{position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:5px 0;padding:8px 12px;font-size:13px;line-height:1.6;color:${actColor};background:${actBg};border:1px solid ${actBorder};border-radius:8px;cursor:pointer;transition:all .15s;animation:${SB_PX}-up .5s ease both;animation-delay:calc(.3s + var(--i,0)*.06s)}
.${SB_PX}-opt:hover{border-color:${cssSafe(st.actionOptBorder)||accent};background:linear-gradient(rgba(255,255,255,.12),rgba(255,255,255,.12)),${actBg};transform:translateX(3px)}
/* 选项悬停扫光 */
.${SB_PX}-opt::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.16),transparent);transform:skewX(-18deg);transition:left .5s ease;pointer-events:none}
.${SB_PX}-opt:hover::after{left:110%}
/* 序号徽章 */
.${SB_PX}-badge{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:1px solid ${accent}88;color:${accent};font-size:10px;font-family:${serif};transition:all .15s}
.${SB_PX}-opt:hover .${SB_PX}-badge{background:${accent};color:#1a1a26}
.${SB_PX}-opttxt{min-width:0}
.${SB_PX}-gearbar{display:none;gap:6px;padding:8px 14px;flex-wrap:wrap;align-items:center;border:1px solid ${primary}33;border-top:none;border-radius:0 0 ${radius}px ${radius}px;margin:-6px 0 10px;background:rgba(15,15,25,.9)}
.${SB_PX}-gearbar.on{display:flex}
.${SB_PX}-gearbar .lb{font-size:11px;opacity:.6}
.${SB_PX}-gearbar button{font-size:11px;padding:2px 10px;border-radius:12px;border:1px solid ${primary}55;background:none;color:inherit;cursor:pointer}
.${SB_PX}-gearbar button.on{background:${primary};color:#fff;border-color:${primary}}
.${SB_PX}-gear{background:none;border:none;color:inherit;opacity:.55;cursor:pointer;font-size:13px;padding:0 2px}
.${SB_PX}-gear:hover{opacity:1}
.${SB_PX}-note{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,30,.9);color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;z-index:99999;max-width:80vw;display:none}
.${SB_PX}-note.on{display:block}
.${SB_PX}-demo{max-width:640px;margin:0 auto 6px;padding:10px 14px;font-size:13px;line-height:1.9;color:#9aa0ad;background:rgba(15,15,25,.6);border-radius:8px}
.${SB_PX}-err{grid-column:1/-1;font-size:12px;color:#e06c5c;white-space:pre-wrap}
/* 动效编排 */
@keyframes ${SB_PX}-fadein{from{opacity:0}to{opacity:1}}
@keyframes ${SB_PX}-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ${SB_PX}-sweep{to{transform:scaleX(1)}}
${stagger}
@media (prefers-reduced-motion:reduce){
  .${SB_PX}-panel,.${SB_PX}-item,.${SB_PX}-card,.${SB_PX}-opt{animation:none}
  .${SB_PX}-headtxt::after{animation:none;transform:scaleX(1)}
  .${SB_PX}-opt::after{display:none}
}
${layoutCss(theme,layout)}
/* 样式统筹覆盖（置于布局样式之后）：面板背景/阴影/标签值颜色字体 */
.${SB_PX}-root .${SB_PX}-body .${SB_PX}-k{color:${kColor};font-family:${kFont}}
.${SB_PX}-root .${SB_PX}-body .${SB_PX}-v{color:${vColor};font-family:${vFont}}
/* 面板背景/阴影需压过布局变体的同名规则（如 ly-cards 渐变面板），故用 !important */
${st.panelShadow===false?`.${SB_PX}-panel{box-shadow:none!important}`:''}
  ${(()=>{const bg=st.panelBg||'follow';if(bg==='transparent')return `.${SB_PX}-panel{background:transparent!important;backdrop-filter:none!important}`;
  if(bg==='solid')return `.${SB_PX}-panel{background:${cssSafe(st.panelBgColor)||'#12141d'}!important}`;
  if(bg==='gradient')return `.${SB_PX}-panel{background:linear-gradient(160deg,${cssSafe(st.panelBgColor)||'#12141d'},${cssSafe(st.panelBgColor2)||'#1b1e2e'})!important}`;
  if(bg==='image'){const u=cssSafe(st.panelBgImage);return `.${SB_PX}-panel{background:linear-gradient(rgba(10,10,18,.74),rgba(10,10,18,.74)),url("${u}") center/cover no-repeat!important}`}
  return ''})()}
  ${layoutCss(theme,layout,cfg.layoutConfig)}
/* 行动选项三色：用户显式设置后以 !important 压过布局变体的硬编码观感（空值不输出，保留变体设计） */
${st.actionOptColor?`.${SB_PX}-opt{color:${actColor}!important}`:''}
${st.actionOptBg?`.${SB_PX}-opt{background:${actBg}!important}`:''}
${st.actionOptBorder?`.${SB_PX}-opt{border-color:${actBorder}!important}`:''}
/* 窄宽度（手机预览 iframe / 真机）：头部堆叠——标题一行、胶囊+⚙一行，▼ 绝对定位右上。
 * 放在布局样式之后以获得覆盖优先级；iframe 内媒体查询按 iframe 视口计算，预览与真机行为一致 */
@media (max-width:520px){
  .${SB_PX}-head{flex-direction:column;justify-content:center;row-gap:8px;padding:12px 14px;position:relative}
  .${SB_PX}-headtxt{order:1}
  .${SB_PX}-hud{order:2;justify-content:center;flex-wrap:wrap}
  .${SB_PX}-gear{order:3}
  .${SB_PX}-fold{position:absolute;right:14px;top:12px;margin:0}
  .${SB_PX}-root .${SB_PX}-head .${SB_PX}-title{font-size:16px;letter-spacing:3px}
  .${SB_PX}-chip{max-width:150px}
}
`;
}

/* 布局变体：夜宴酒牌（cards）/ 手稿扉页（opening）/ 终端读数（grid） */
function layoutCss(theme,layout,lc){
  const th=theme||{};
  const primary=cssSafe(th.primary)||'#7c6cf0';
  const accent=cssSafe(th.accent)||'#e8c47c';
  const radius=+(th.radius||12);
  const lc_=lc||{};
  /* 数值钳制用 Number.isFinite 而非 ||：合法的 0（如圆角 0）不被回落默认值 */
  const num=(v,d)=>Number.isFinite(+v)?+v:d;
  const cols=num(lc_.columns,2);
  const gap=num(lc_.gap,8);
  const bStyle=lc_.borderStyle||'solid';
  const bWidth=Math.max(0,Math.min(3,num(lc_.borderWidth,1)));
  const br=Math.max(0,Math.min(24,num(lc_.borderRadius,12)));
  const hStyle=lc_.headerStyle||'standard';
  const actPos=lc_.actionPosition||'bottom';
  const px=SB_PX;
  const R=`.${px}-root`;
  const serif='"Noto Serif SC","Source Han Serif SC","STZhongsong","SimSun",serif';
  const gridCols=cols===1?'1fr':cols===3?'1fr 1fr 1fr':'1fr 1fr';
  let s='';
  if(layout==='cards'){
    /* 夜宴酒牌：渐变面板、主题色柔和阴影、卡片 hover 上浮、左侧色条 */
    s=`
${R}.ly-cards .${px}-panel{background:linear-gradient(160deg,${primary}40,transparent 60%),rgba(15,15,25,.94);border:1px solid ${primary}55;box-shadow:0 10px 30px rgba(0,0,0,.35)}
${R}.ly-cards .${px}-head{background:linear-gradient(90deg,${primary}59,${accent}1f,transparent);padding:12px 16px;border-bottom:1px solid ${primary}55}
${R}.ly-cards .${px}-title{font-size:17px;letter-spacing:2px;text-shadow:0 0 14px ${primary}88,0 0 30px ${primary}44}
${R}.ly-cards .${px}-chip{background:${primary}2e;border-color:${primary}66}
${R}.ly-cards .${px}-item{background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid ${primary}3d;border-left:3px solid ${primary}88;border-radius:10px;padding:9px 12px;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s,border-color .2s}
${R}.ly-cards .${px}-item:hover{transform:translateY(-2px);border-color:${accent}77;box-shadow:0 10px 25px -5px ${primary}44}
${R}.ly-cards .${px}-k{display:flex;align-items:center;gap:6px}
${R}.ly-cards .${px}-k::before{content:"◈";font-size:10px;opacity:.85}
${R}.ly-cards .${px}-think{position:relative;overflow:hidden;border-left:3px solid ${accent};background:linear-gradient(135deg,${accent}14,transparent)}
${R}.ly-cards .${px}-think::before{position:absolute;right:8px;top:-14px;font-size:44px;line-height:1;color:${accent}2e;font-family:${serif};content:"\\201d";pointer-events:none}
${R}.ly-cards .${px}-card{background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid ${primary}44;border-left:3px solid ${accent};box-shadow:0 2px 8px rgba(0,0,0,.25);border-radius:12px;padding:12px 14px;transition:transform .2s,box-shadow .2s}
${R}.ly-cards .${px}-card:hover{transform:translateY(-2px);box-shadow:0 10px 25px -5px ${accent}33}
${R}.ly-cards .${px}-opt{border-left:3px solid ${accent};background:linear-gradient(90deg,${primary}33,transparent 60%),rgba(15,15,25,.85);border-radius:0 10px 10px 0}
${R}.ly-cards .${px}-opt:hover{transform:translateX(4px);box-shadow:-2px 4px 14px -4px ${accent}55}
${R}.ly-cards .${px}-panel::after{content:"";display:block;height:3px;background:linear-gradient(90deg,transparent,${accent},${primary},transparent)}
`;
  }else if(layout==='opening'){
    /* 手稿扉页：双线内外双框、居中辉光标题、点线引导两栏、❦ 饰线 */
    s=`
${R}.ly-opening .${px}-panel{background:rgba(20,20,30,.95);border:3px double ${accent};border-radius:${radius}px;box-shadow:inset 0 0 0 1px ${primary}33}
${R}.ly-opening .${px}-head{position:relative;justify-content:center;background:none;border-bottom:1px solid ${accent}44;padding:12px 40px}
${R}.ly-opening .${px}-head .${px}-title{padding-right:5px;flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R}.ly-opening .${px}-head::before{content:"― ❖ ―";color:${accent};opacity:.8;letter-spacing:2px;font-family:${serif}}
${R}.ly-opening .${px}-head .${px}-fold{position:absolute;right:14px}
${R}.ly-opening .${px}-title{font-size:17px;letter-spacing:5px;text-shadow:0 0 14px ${accent}66,0 0 30px ${accent}33}
${R}.ly-opening .${px}-headtxt{display:inline-flex;align-items:center;gap:8px}
${R}.ly-opening .${px}-body{padding:12px 20px 14px}
${R}.ly-opening .${px}-grid{gap:0}
${R}.ly-opening .${px}-item{display:flex;align-items:baseline;gap:10px;background:none;border:none;border-bottom:1px dotted ${primary}59;border-radius:0;padding:8px 2px}
${R}.ly-opening .${px}-k{flex-shrink:0;color:${accent};letter-spacing:2px}
${R}.ly-opening .${px}-v{margin-left:auto;text-align:right;font-family:${serif};letter-spacing:.5px}
${R}.ly-opening .${px}-think{border-left:none;border-radius:0;text-align:center;background:none;border-top:1px solid ${accent}44;border-bottom:1px solid ${accent}44;padding:10px 4px}
${R}.ly-opening .${px}-think::before{content:"❦ ";color:${accent};font-style:normal;opacity:.8}
${R}.ly-opening .${px}-think::after{content:" ❦";color:${accent};font-style:normal;opacity:.8}
${R}.ly-opening .${px}-opt{justify-content:center;background:rgba(20,20,30,.85);border:none;border-top:1px solid ${primary}33;border-radius:0;gap:8px}
${R}.ly-opening .${px}-opt::before{content:"❖";color:${accent};opacity:0;transition:opacity .2s;font-family:${serif}}
${R}.ly-opening .${px}-opt:hover{background:linear-gradient(${primary}33,${primary}33),rgba(20,20,30,.85);transform:none}
${R}.ly-opening .${px}-opt:hover::before{opacity:.9}
${R}.ly-opening .${px}-panel::after{content:"✦ ✧ ✦";display:block;text-align:center;color:${accent};opacity:.6;letter-spacing:6px;font-size:11px;padding:8px 0 10px}
`;
  }else if(layout==='terminal'){
    /* 终端黑绿：等宽字体、扫描线、绿色文字、大写标签 */
    const mono='"JetBrains Mono","Fira Code","Consolas",monospace';
    s=`
${R}.ly-terminal .${px}-panel{background:#0a0e0a;border:1px solid #1a3a1a;font-family:${mono}}
${R}.ly-terminal .${px}-head{background:linear-gradient(90deg,#0d1f0d,transparent);border-bottom:1px solid #1a3a1a;padding:8px 14px}
${R}.ly-terminal .${px}-title{color:#39e06e;font-size:13px;letter-spacing:3px;font-family:${mono}}
${R}.ly-terminal .${px}-chip{color:#39e06e;background:#0d1f0d;border-color:#1a3a1a;font-family:${mono}}
${R}.ly-terminal .${px}-body::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,.15) 2px 4px);pointer-events:none;z-index:1}
${R}.ly-terminal .${px}-grid{position:relative;z-index:2}
${R}.ly-terminal .${px}-item{background:rgba(57,224,110,.04);border:none;border-left:2px solid #39e06e;border-radius:0;padding:5px 10px;font-size:12px}
${R}.ly-terminal .${px}-k{color:#39e06e;text-transform:uppercase;letter-spacing:2px;font-size:11px}
${R}.ly-terminal .${px}-v{color:#e0f5e0;font-variant-numeric:tabular-nums}
${R}.ly-terminal .${px}-think{border-left:2px solid #27c93f;background:rgba(57,224,110,.06)}
${R}.ly-terminal .${px}-opt{color:#39e06e;background:#0d1f0d;border:1px solid #1a3a1a;font-family:${mono}}
${R}.ly-terminal .${px}-opt:hover{background:#142814;border-color:#39e06e}
${R}.ly-terminal .${px}-badge{color:#39e06e;border-color:#1a3a1a}
`;
  }else if(layout==='glass'){
    /* 玻璃态：毛玻璃、大圆角、半透明、柔和弥散阴影 */
    s=`
${R}.ly-glass .${px}-panel{background:linear-gradient(160deg,rgba(16,18,28,.78),rgba(12,14,22,.62)),rgba(255,255,255,.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 32px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.1);border-radius:${br}px}
${R}.ly-glass .${px}-head{background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.12);padding:12px 18px;backdrop-filter:blur(8px)}
${R}.ly-glass .${px}-title{color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)}
${R}.ly-glass .${px}-chip{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.9)}
${R}.ly-glass .${px}-item{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:${br}px;padding:10px 14px;backdrop-filter:blur(4px)}
${R}.ly-glass .${px}-item:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);box-shadow:0 4px 16px rgba(0,0,0,.12)}
${R}.ly-glass .${px}-k{color:rgba(255,255,255,.75)}
${R}.ly-glass .${px}-v{color:#fff}
${R}.ly-glass .${px}-think{background:rgba(255,255,255,.06);border-left:3px solid rgba(255,255,255,.3)}
${R}.ly-glass .${px}-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:${br}px}
${R}.ly-glass .${px}-opt{color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:${br}px}
${R}.ly-glass .${px}-opt:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3)}
`;
  }else if(layout==='editorial'){
    /* 杂志排版：大衬线标题、字段分栏、细线分隔、宽松行高 */
    s=`
${R}.ly-editorial .${px}-panel{background:#faf8f5;border:none;border-radius:0;box-shadow:none;color:#2c2416}
${R}.ly-editorial .${px}-head{background:none;border-bottom:2px solid ${accent};padding:16px 24px;justify-content:center}
${R}.ly-editorial .${px}-headtxt{display:block;text-align:center}
${R}.ly-editorial .${px}-title{color:#2c2416;font-size:20px;letter-spacing:4px;font-family:${serif};text-shadow:none}
${R}.ly-editorial .${px}-hud{justify-content:center}
${R}.ly-editorial .${px}-chip{background:#f0ece4;border-color:#d4c9b5;color:#6b5d4d}
${R}.ly-editorial .${px}-body{padding:20px 24px}
${R}.ly-editorial .${px}-grid{grid-template-columns:${gridCols};gap:${gap}px}
${R}.ly-editorial .${px}-item{background:none;border:none;border-bottom:1px solid #e0d8c8;border-radius:0;padding:10px 4px}
${R}.ly-editorial .${px}-k{color:#6b5d4d;font-size:12px;letter-spacing:2px;text-transform:uppercase}
${R}.ly-editorial .${px}-v{color:#2c2416;font-size:14px;line-height:1.8;margin-left:0;text-align:left}
${R}.ly-editorial .${px}-think{border-left:3px solid ${accent};background:none;padding:12px 16px;font-style:italic}
${R}.ly-editorial .${px}-opt{color:#2c2416;background:#f5f1ea;border:1px solid #d4c9b5;border-radius:8px;text-align:center}
${R}.ly-editorial .${px}-opt:hover{background:#ebe5da;border-color:${accent}}
${R}.ly-editorial .${px}-badge{background:#2c2416;color:#faf8f5}
`;
  }else{
    /* 终端读数：紧凑网格，左竖线、等宽数字、行更密（未知 layout 亦回落 grid） */
    s=`
${R}.ly-grid .${px}-item{border:none;border-left:2px solid ${accent};border-radius:0 6px 6px 0;background:rgba(255,255,255,.045);padding:6px 10px}
${R}.ly-grid .${px}-k{text-transform:uppercase;letter-spacing:2px}
${R}.ly-grid .${px}-v{font-variant-numeric:tabular-nums}
${R}.ly-grid .${px}-think{border-left:2px solid ${accent};border-radius:0 6px 6px 0}
${R}.ly-grid .${px}-badge{border-radius:3px;width:auto;min-width:20px;height:16px;padding:0 4px}
`;
  }
  /* 布局微调通用 CSS（所有布局共用）：仅随带 layoutConfig 的调用输出（sbCss 第二次调用），!important 压过变体与统筹覆盖 */
  if(!lc)return s;
  const borderVal=bStyle==='none'?'none':bStyle==='double'?`double ${accent}44`:`${bStyle} ${accent}44`;
  /* 标题栏样式（hStyle 曾仅存储未消费）：standard 保持变体原貌，其余以覆盖规则实现 */
  const headCss=hStyle==='centered'?`
${R} .${px}-head{justify-content:center!important;position:relative!important}
${R} .${px}-fold{margin-left:0!important;position:absolute!important;right:14px!important;top:12px!important}`
    :hStyle==='minimal'?`
${R} .${px}-head{background:none!important;border-bottom:none!important;padding:6px 4px!important}
${R} .${px}-title{font-size:13px!important;letter-spacing:0!important;opacity:.75!important}
${R} .${px}-fold{display:none!important}
${R} .${px}-headtxt::after{display:none!important}`
    :hStyle==='underline'?`
${R} .${px}-head{background:none!important;border-bottom:none!important;padding:10px 2px!important}
${R} .${px}-headtxt::after{height:2px!important;background:${accent}!important}`
    :'';
  /* 行动选项位置：inline 时选项并入面板体（DOM 搬移由 sbRuntime 负责），仅补分隔样式 */
  const actCss=actPos==='inline'?`
${R} .${px}-actions{margin:8px 0 0!important;padding:8px 0 0!important;border-top:1px dashed ${primary}44!important}`:'';
  return `
${R}.${px}-grid{grid-template-columns:${gridCols}!important;gap:${gap}px!important}
${R}.${px}-item{padding:${gap/2}px ${gap}px!important}
${R}.${px}-panel{border:${bWidth}px ${borderVal}!important;border-radius:${br}px!important}
${R}.${px}-head{padding:${gap*1.5}px ${gap*2}px!important}
${R}.${px}-body{padding:${gap*1.5}px ${gap*2}px!important}${headCss}${actCss}
`;
}

/* 面板骨架（行式/块式共用；折叠记忆与字号/布局设置由内嵌 JS 处理） */
function sbShell(cfg,theme,innerFieldsHtml,opts={}){
  const px=SB_PX;
  const preview=!!opts.preview;
  /* layout 来自可导入的工程数据，白名单化防属性注入（未知值回落 grid） */
  const ly=['cards','grid','opening','terminal','glass','editorial'].includes(cfg.layout)?cfg.layout:'grid';
  return `<div id="${px}" class="${px}-root ly-${ly}">
<div class="${px}-atmo" aria-hidden="true"></div>
<details class="${px}-panel"${preview?' open':''}>
  <summary class="${px}-head">
    <span class="${px}-headtxt"><span class="${px}-title">${esc(cfg.title||'角色状态')}</span></span>
    <span class="${px}-hud">
      <span class="${px}-chip" data-slot="time"></span>
      <span class="${px}-chip" data-slot="loc"></span>
      <button type="button" class="${px}-gear" title="设置">⚙</button>
    </span>
    <span class="${px}-fold">▼</span>
  </summary>
  <div class="${px}-body"><div class="${px}-grid" data-slot="fields">${innerFieldsHtml}</div></div>
</details>
<div class="${px}-gearbar">
  <span class="lb">字号</span><button type="button" data-size="s">小</button><button type="button" data-size="m">中</button><button type="button" data-size="l">大</button>
  <span class="lb">布局</span><button type="button" data-layout="grid">网格</button><button type="button" data-layout="list">列表</button>
</div>
<div class="${px}-actions" data-slot="actions"></div>
<div class="${px}-note"></div>
</div>`;
}

/* 行式：静态字段模板，$n 插值（编号与 findRegex 捕获组一致，均基于有效字段）；
 * 时间/地点关键词字段进头部胶囊；渲染样式：quote=心声、progress=进度条骨架（运行时读值填充）；
 * 字段名带世界书填写规则的悬浮提示 */
function staticFieldsHtml(cfg){
  const fields=effFields(cfg);
  let html='';
  fields.forEach((f,i)=>{
    const n=i+1;
    const k=f.name;
    const tt=f.hint?` title="${esc(f.hint)}"`:'';
    if(/时间|日期/.test(k)&&!isQuote(f)&&!isProgress(f)){html+=`<span class="sb-time-slot" style="display:none">$${n}</span>\n`;return}
    if(/地点|位置/.test(k)&&!isQuote(f)&&!isProgress(f)){html+=`<span class="sb-loc-slot" style="display:none">$${n}</span>\n`;return}
    if(isProgress(f)){
      html+=`<div class="${SB_PX}-item ${SB_PX}-prog"${tt}><div class="${SB_PX}-k"${tt}>${esc(k)}</div><div class="${SB_PX}-bar"><div class="${SB_PX}-fill"></div></div><div class="${SB_PX}-v">$${n}</div></div>\n`;
      return;
    }
    const cls=isQuote(f)?`${SB_PX}-item ${SB_PX}-think`:`${SB_PX}-item`;
    html+=`<div class="${cls}"${tt}><div class="${SB_PX}-k"${tt}>${esc(k)}</div><div class="${SB_PX}-v">$${n}</div></div>\n`;
  });
  return html;
}

/* 生成的运行时脚本：折叠/设置记忆 + 块式解析渲染 + 选项点击。
 * 注意：不得包含反引号与 ${}，闭合标签写 <\/script> 由调用方再做转义 */
function sbRuntime(cfg){
  const px=SB_PX;
  const isBlock=cfg.mode==='block';
  return `(function(){
  var PX=${JSON.stringify(px)};
  var root=document.getElementById(PX);if(!root)return;
  var KEY=PX+'-set';
  var S={};try{S=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
  var panel=root.querySelector('.'+PX+'-panel');
  if(S.fold!==undefined)panel.open=!S.fold;
  panel.addEventListener('toggle',function(){S.fold=!panel.open;save()});
  var stg=root.querySelector('.'+PX+'-gearbar');
  root.querySelector('.'+PX+'-gear').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();stg.classList.toggle('on')});
  stg.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.size)S.size=b.dataset.size;
    if(b.dataset.layout)S.layout=b.dataset.layout;
    save();apply();
  });
  function apply(){
    root.classList.toggle('sb-s',S.size==='s');
    root.classList.toggle('sb-l',S.size==='l');
    root.classList.toggle('sb-list',S.layout==='list');
    var bs=stg.querySelectorAll('button');
    for(var i=0;i<bs.length;i++){
      var b=bs[i];
      if(b.dataset.size)b.classList.toggle('on',(S.size||'m')===b.dataset.size);
      if(b.dataset.layout)b.classList.toggle('on',(S.layout||'grid')===b.dataset.layout);
    }
  }
  apply();
  ${cfg.layoutConfig&&cfg.layoutConfig.actionPosition==='inline'?`var actBox=root.querySelector('[data-slot="actions"]');if(actBox){var bodyEl=root.querySelector('.'+PX+'-body');if(bodyEl)bodyEl.appendChild(actBox)}`:''}
  var noteEl=root.querySelector('.'+PX+'-note'),noteTm=null;
  function note(m){noteEl.textContent=m;noteEl.classList.add('on');clearTimeout(noteTm);noteTm=setTimeout(function(){noteEl.classList.remove('on')},2200)}
  var timeSlot=root.querySelector('.sb-time-slot'),locSlot=root.querySelector('.sb-loc-slot');
  if(timeSlot){var chip=root.querySelector('[data-slot="time"]');chip.textContent=timeSlot.textContent;timeSlot.parentNode.removeChild(timeSlot)}
  if(locSlot){var chip2=root.querySelector('[data-slot="loc"]');chip2.textContent=locSlot.textContent;locSlot.parentNode.removeChild(locSlot)}
  /* 进度条字段：读 N/M 或 N% 填充（行式骨架 + 块式自动检测统一在此计算） */
  function fillProgress(){
    Array.prototype.forEach.call(root.querySelectorAll('.'+PX+'-prog .'+PX+'-v'),function(v){
      var m=/^\\s*(\\d{1,3})\\s*(?:\\/\\s*(\\d{1,3})|%)[\\s\\S]*$/.exec(v.textContent);
      var bar=v.parentNode.querySelector('.'+PX+'-fill');
      if(!m||!bar)return;
      var num=+m[1],den=m[2]?+m[2]:100;
      var pct=Math.max(0,Math.min(100,den?num/den*100:num));
      setTimeout(function(){bar.style.width=pct+'%'},80);
    });
  }
  fillProgress();
  function fillSlot(sel,node){var el=root.querySelector(sel);if(el)el.parentNode.replaceChild(node,el)}
  function optClick(t){
    if(typeof triggerSlash==='function'){try{triggerSlash('/setinput '+t)}catch(e){note('填入输入框失败')}}
    else note('未检测到酒馆助手 API，无法填入输入框');
  }
  function addOpt(act,t){
    var CN=['壹','贰','叁','肆','伍','陆','柒','捌'];
    var n=+(act.dataset.n||0);act.dataset.n=n+1;
    var b=document.createElement('button');b.type='button';b.className=PX+'-opt';
    b.setAttribute('data-opt',t);
    b.style.setProperty('--i',n);
    var bg=document.createElement('span');bg.className=PX+'-badge';
    bg.textContent=CN[n%CN.length]||String(n+1);
    var sp=document.createElement('span');sp.className=PX+'-opttxt';sp.textContent=t;
    b.appendChild(bg);b.appendChild(sp);
    act.appendChild(b);
  }
  root.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-opt]');if(!b)return;
    optClick(b.getAttribute('data-opt'));
  });
  var srcEl=document.getElementById(PX+'-src');
  ${isBlock?`(function(){
    if(!srcEl)return;
    var data;
    try{data=parse(srcEl.textContent)}catch(e){err('状态栏解析失败：'+e.message);return}
    render(data);
    fillProgress();/* 动态渲染出的进度条在此时才存在，需再填充一次 */
    function err(m){var d=document.createElement('div');d.className=PX+'-err';d.textContent=m;fillSlot('[data-slot="fields"]',d)}
    function parse(txt){
      var out=[];var stack=[{indent:-1,children:out,item:null}];
      txt.replace(/\\r/g,'').split('\\n').forEach(function(line){
        if(!line.trim())return;
        var indent=line.match(/^\\s*/)[0].length;
        var s=line.trim().replace(/^-\\s*/,'');
        while(stack.length>1&&stack[stack.length-1].indent>=indent)stack.pop();
        var top=stack[stack.length-1];
        var m=s.match(/^([^：:]{1,24})[:：]\\s*([\\s\\S]*)$/);
        var it;
        if(m){
          it={k:m[1].trim(),v:m[2].trim(),indent:indent,children:[]};
          top.children.push(it);
          stack.push({indent:indent,children:it.children,item:it});
        }else if(top.item&&top.item.v===''){
          it={k:'',v:s,indent:indent,children:[]};
          top.item.children.push(it);
          stack.push({indent:indent,children:it.children,item:it});
        }else if(top.item){
          top.item.v=(top.item.v?top.item.v+'\\n':'')+s;
        }else{
          it={k:s,v:'',indent:indent,children:[],header:true};
          top.children.push(it);
          stack.push({indent:indent,children:it.children,item:it});
        }
      });
      return out;
    }
    function render(items){
      var grid=root.querySelector('[data-slot="fields"]');
      var act=root.querySelector('[data-slot="actions"]');
      items.forEach(function(it){walk(it,grid,act)});
      if(!act.hasChildNodes())act.style.display='none';
    }
    function walk(it,grid,act){
      var k=(it.k||'').trim(),v=(it.v||'').trim();
      if(!it.header&&!k&&v)return; /* 裸文本行忽略 */
      if(/时间|日期/.test(k)&&v&&!hasKids(it)){chipSet('[data-slot="time"]',v);return}
      if(/地点|位置/.test(k)&&v&&!hasKids(it)){chipSet('[data-slot="loc"]',v);return}
      if(/选项/.test(k)&&hasKids(it)){renderOptions(it.children,act);return}
      if(hasKids(it)){
        var card=document.createElement('div');card.className=PX+'-card';
        if(k){var kh=document.createElement('div');kh.className=PX+'-k';kh.textContent=k;card.appendChild(kh)}
        if(v){var vv=document.createElement('div');vv.className=PX+'-v';vv.textContent=v;card.appendChild(vv)}
        it.children.forEach(function(c){
          if((c.k||'').trim())walkDeep(c,card);
          else if((c.v||'').trim()){var li=document.createElement('div');li.className=PX+'-v';li.textContent=c.v;card.appendChild(li)}
        });
        grid.appendChild(card);return;
      }
      if(!k&&!v)return;
      /* 值整段是 N/M 或 N% → 自动渲染为进度条 */
      var pm=/^\\s*(\\d{1,3})\\s*(?:\\/\\s*(\\d{1,3})|%)[\\s\\S]*$/.exec(v);
      if(pm&&!hasKids(it)){
        var pi=document.createElement('div');pi.className=PX+'-item '+PX+'-prog';
        var pk=document.createElement('div');pk.className=PX+'-k';pk.textContent=k;pi.appendChild(pk);
        var pbar=document.createElement('div');pbar.className=PX+'-bar';
        var pfill=document.createElement('div');pfill.className=PX+'-fill';pbar.appendChild(pfill);pi.appendChild(pbar);
        var pv=document.createElement('div');pv.className=PX+'-v';pv.textContent=v;pi.appendChild(pv);
        grid.appendChild(pi);return;
      }
      var quote=/^["\\u201c][\\s\\S]*["\\u201d]$/.test(v);
      var item=document.createElement('div');
      item.className=PX+'-item'+(quote||/心理|内心|想法/.test(k)?' '+PX+'-think':'');
      var kh=document.createElement('div');kh.className=PX+'-k';kh.textContent=k||'…';item.appendChild(kh);
      var vv=document.createElement('div');vv.className=PX+'-v';vv.textContent=quote?v.slice(1,-1):v;item.appendChild(vv);
      grid.appendChild(item);
    }
    function walkDeep(it,card){
      var kh=document.createElement('div');kh.className=PX+'-k';kh.textContent=it.k;card.appendChild(kh);
      var vv=document.createElement('div');vv.className=PX+'-v';vv.textContent=it.v;card.appendChild(vv);
    }
    function hasKids(it){return it.children&&it.children.length}
    function chipSet(sel,v){
      var el=root.querySelector(sel);if(!el){el=document.createElement('span');el.className=PX+'-chip';el.setAttribute('data-slot',sel.indexOf('time')>=0?'time':'loc');var hud=root.querySelector('.'+PX+'-hud');(hud||root.querySelector('.'+PX+'-head')).appendChild(el)}
      el.textContent=v;
    }
    function renderOptions(kids,act){
      act.style.display='';
      kids.forEach(function(c){
        var t=((c.k?c.k+'：':'')+(c.v||'')).trim();
        if(!t)return;
        t=t.replace(/^\\d+[.、]\\s*/,'');
        addOpt(act,t);
      });
    }
  })();`:`
  /* 行式 + 行动选项：数据源是「- 选项」短横线列表，直接渲染成可点击按钮 */
  if(srcEl){
    var act=root.querySelector('[data-slot="actions"]');
    if(act){
      srcEl.textContent.replace(/\\r/g,'').split('\\n').forEach(function(line){
        var s=line.trim().replace(/^-\\s*/,'').replace(/^\\d+[.、]\\s*/,'');
        if(s)addOpt(act,s);
      });
      if(act.hasChildNodes())act.style.display='';
    }
  }`}
})();
`;
}

/* 完整美化文档（``` 围栏由 buildReplaceString 添加） */
function buildFullDoc(cfg,theme,opts={}){
  const px=SB_PX;
  const isBlock=cfg.mode==='block';
  const fieldsHtml=isBlock?'':staticFieldsHtml(cfg);
  /* 数据源标签：块式 $1 为整块状态栏文本；行式+行动选项为最后一个捕获组（选项短横线列表） */
  const nFields=effFields(cfg).length;
  const srcTag=isBlock
    ?`<script type="text/plain" id="${px}-src">$1</script>\n`
    :(cfg.actions&&nFields?`<script type="text/plain" id="${px}-src">$${nFields+1}</script>\n`:'');
  const demo=opts.preview?`<div class="${px}-demo">（预览示例正文：这里是消息里的正文叙事部分，美化状态栏会显示在正文下方。点击面板头部可折叠/展开，⚙ 可调字号与布局。）</div>\n`:'';
  /* extraCss 为作者自定义 CSS：仅防御 </style> 逃逸（导入的工程文件绕过编辑器口头提示） */
  const extraCss=cfg.extraCss&&cfg.extraCss.trim()?`<style>${String(cfg.extraCss).replace(/<\/style/gi,'')}</style>\n`:'';
  const body=sbShell(cfg,theme,fieldsHtml,opts);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>状态栏</title>
<style>html,body{margin:0;padding:0;background:transparent}</style>
<style>${sbCss(theme,cfg)}</style>
${extraCss}
</head>
<body>
${demo}${body}
${srcTag}<script>
${sbRuntime(cfg)}
<\/script>
</body>
</html>`;
}

function buildReplaceString(cfg,theme){
  return '```\n'+buildFullDoc(cfg,theme)+'\n```';
}

/* 预览文档：行式将 $n → esc(示例值)（降序替换避免 $1 误伤 $10/$11）；
 * 块式将 $1（数据源）→ 完整示例文本——否则预览里解析器只会拿到第一个字段的示例值 */
function buildPreviewDoc(cfg,theme){
  let doc=buildFullDoc(cfg,theme,{preview:true});
  /* 仅预览注入 body 1px 内距：断开子元素与 body 的外边距塌陷，让自适应高度量到完整内容 */
  doc=doc.replace('</head>','<style>body{padding:1px 0}</style></head>');
  if(cfg.mode==='block'){
    return doc.split('id="'+SB_PX+'-src">$1<').join('id="'+SB_PX+'-src">'+esc(buildSampleInner(cfg))+'<');
  }
  const fields=effFields(cfg);
  /* 单遍替换 $n（含末尾行动选项捕获组）：插入文本不被任何遍扫二次破坏
   * （逐遍 split/join 会把示例值里的 $<数字> 前缀误当占位符，如 $100 被 $1 遍破坏） */
  const caps=fields.map(f=>esc(f.sample||''));
  if(cfg.actions&&fields.length)caps.push(esc(optionLines(cfg,'')));
  doc=doc.replace(/\$(\d+)/g,(mm,num)=>{const v=caps[+num-1];return v===undefined?mm:v});
  return doc;
}

/* 可导入酒馆的正则脚本 JSON（结构与 ST 正则扩展一致） */
function buildRegexScript(cfg,theme,{placement=[2],runOnEdit=true,projectName=''}={}){
  return {
    id:uid(),
    scriptName:'状态栏美化'+(projectName?'-'+projectName:''),
    findRegex:'/'+buildFindRegex(cfg)+'/',
    replaceString:buildReplaceString(cfg,theme),
    trimStrings:[],
    placement:[...placement],
    disabled:false,
    markdownOnly:true,   /* 仅影响显示，AI 上下文保留原始状态栏文本 */
    promptOnly:false,
    runOnEdit,
    substituteRegex:0,
    minDepth:null,
    maxDepth:null,
  };
}

/* 三步使用说明（发卡用）；世界书以「手动新建条目」为主流程，独立 JSON 为可选 */
function buildUsageText(cfg){
  const isBlock=cfg.mode==='block';
  return `【纯文字状态栏 · 使用说明】

一、添加世界书条目：打开角色卡绑定的世界书（没有就新建一个并在角色卡绑定它），新建条目：
    - 勾选「常驻（蓝灯）」，关键词留空
    - 插入位置选「@D 深度」，深度 ${+cfg.depth||0}，角色 ${[ '系统','用户','AI' ][+(cfg.role||0)]}，顺序 ${+cfg.order||999}
    - 勾选「防止递归」相关选项
    然后把条目文案整段粘贴进条目内容。（也可直接导入附带的「世界书-状态栏.json」再绑定到角色卡。）
二、导入正则：酒馆 → 扩展 → 正则(Regex) → 导入「regex-状态栏-状态栏.json」。它会把 AI 输出的${isBlock?'「'+(cfg.tag||'Status_block')+'」标签块':'状态栏字段'}替换为美化面板（仅影响显示，AI 上下文保留原文）。
三、开场白后缀：把「纯文字状态栏」整段粘贴到角色卡 first_mes（或某条 alternate_greetings）的正文末尾——玩家刷到该开场白时第一楼即显示美化状态栏，之后每楼由 AI 自动输出。

注意事项：
- AI 必须完整按格式输出所有字段，缺字段该楼不渲染（行式严格匹配）。
- 修改过字段/规则后，请重新下载正则等文件并重新导入，世界书条目内容重新粘贴。
- 行动选项点击后填入输入框，由玩家确认后手动发送。`;
}

export {defaultConfig, STATUS_PRESETS, DEFAULT_FIELDS, BEAUTY_PRESETS, ACTION_DIRECTIONS, parseSampleText, buildFindRegex, applyStatusRegex, buildEntryContent, buildWorldbook, buildSampleText, buildSampleInner, buildReplaceString, buildPreviewDoc, buildRegexScript, buildUsageText, loadUserPresets, saveUserPresets, loadBeautyPresets, saveBeautyPresets, migrateStatusbarSamples};
