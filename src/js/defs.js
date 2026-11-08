/* 数据定义：区块 / 主题预设 / 组件库 */
import { uid } from './utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES } from './defs/blocks.js';
import { COMP_LIB } from './defs/complib.js';
import { BUILTIN_TEMPLATES } from './defs/templates.js';
/* 体量大的数据拆到 defs/ 子模块（组件库≈78KB、模板≈16KB）；本文件保持唯一对外出口，调用方 import 路径不变 */

/* ================================================================
 * 主题预设库：一键套用成品配色
 * 每套一个明确的世界观概念（frontend-design：intentionality over generic）
 * ================================================================ */
const THEME_PRESETS=[
  /* bg：v1.24 起背景归主题所有，预设随之升级为「整套观感包」（含底色） */
  {name:'紫夜幻金',caption:'星穹笺 · 紫电与流金',specimen:'星落之时',folio:'NOCTURNE · I',theme:{skin:'nebula',primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',fontName:'',headingFont:'Noto Serif SC',radius:12,titleAlign:'center',motion:'full',bg:{type:'gradient',color:'#161228',color2:'#261b42'}}},
  {name:'荆棘王室',caption:'藏书票 · 绯红与旧银',specimen:'荆棘之誓',folio:'EX LIBRIS',theme:{skin:'royal',primary:'#be6078',accent:'#e3cbb0',textColor:'#f5ece6',fontName:'',headingFont:'Noto Serif SC',radius:3,titleAlign:'center',motion:'soft',bg:{type:'gradient',color:'#190e16',color2:'#2b1521'}}},
  {name:'狐火缘日',caption:'夜祭笺 · 朱砂与狐青',specimen:'今宵有约',folio:'宵 · 祭',theme:{skin:'festival',primary:'#e59065',accent:'#abd7bc',textColor:'#f8efe1',fontName:'',headingFont:'KaiTi',radius:8,titleAlign:'left',motion:'soft',bg:{type:'noise',color:'#181b19',color2:'#29231c'}}},
  {name:'蓝电义体',caption:'检修台 · 冰蓝与信号橙',specimen:'LINK / 01',folio:'NEURAL SYSTEM',theme:{skin:'cyber',primary:'#62c9e5',accent:'#f4ad70',textColor:'#edf5f8',fontName:'',headingFont:'Bahnschrift',radius:2,titleAlign:'left',motion:'full',bg:{type:'gradient',color:'#09131e',color2:'#102537'}}},
  {name:'渊语回廊',caption:'潮汐页 · 深海与珍珠',specimen:'潮声来信',folio:'BATHYAL / 04',theme:{skin:'abyss',primary:'#72aaa5',accent:'#d3ddc4',textColor:'#eaf2ed',fontName:'',headingFont:'Noto Serif SC',radius:22,titleAlign:'center',motion:'soft',bg:{type:'gradient',color:'#091a1d',color2:'#183333'}}},
  {name:'档案机',caption:'旧卷宗 · 炭黑与黄铜',specimen:'未结案记录',folio:'FILE No. 005',theme:{skin:'archive',primary:'#b6ab96',accent:'#ddba78',textColor:'#f0ebe0',fontName:'',headingFont:'Courier New',radius:0,titleAlign:'left',motion:'off',bg:{type:'noise',color:'#191815',color2:'#292720'}}},
];

/* 工程数据 schema 版本（v1.29 引入）：project.js migrate() 按此分段迁移；新增破坏性字段变换时 +1 并在 migrate() 加对应段 */
const SCHEMA_VERSION=2;

function defaultProject(name){
  return {
    id:uid(),name:name||'未命名工程',createdAt:new Date().toISOString(),
    schemaVersion:SCHEMA_VERSION,
    marker:'【开场页】',
    theme:{primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',followTavern:false,
      follow:{text:false,quote:false,font:false,em:false},
      skin:'classic',fontName:'',headingFont:'',radius:12,titleAlign:'center',motion:'full',
      /* 背景归主题所有（v1.24 上收自装饰区）；默认值 = 旧装饰区 create 的默认渐变，新工程观感不变
         presetRef：最近一次套用的主题预设名，用于选中态「已自定义（基于 X）」标识 */
      bg:{type:'gradient',color:'#1a1a2e',color2:'#2d1b3d'},presetRef:''},
    blocks:BLOCK_ORDER.map(t=>({type:t,enabled:CORE_TYPES.includes(t),...BLOCK_DEFS[t].create()})),
    macros:[{k:'char',v:'艾莉丝'},{k:'user',v:'旅行者'}],
    ai:{baseURL:'https://api.openai.com/v1',apiKey:'',model:'',models:[],rememberKey:true},
    preview:{mode:'mobile',theme:'dark'},
    updatedAt:null, /* 最近修改时间：save() 触碰；null=从未编辑（统计行回落 createdAt） */
  };
}

/* ================================================================
 * 区块预设模板：常见内容一键套用
 * ================================================================ */
const BLOCK_PRESETS={
  randomevent:[
    {name:'奇幻酒馆',data:{title:'✦ 今日际遇 ✦',showTitle:true,lines:'旅途中的旅人推开了酒馆的门，带来了远方的消息。\n窗外飘起了细雪，壁炉里的火焰跳动着。\n远处传来悠扬的竖琴声，酒杯轻轻碰撞。\n一位神秘的旅者坐在角落，低声吟唱着古老的歌谣。\n今夜的星辰格外明亮，似乎预示着什么。'}},
    {name:'赛博都市',data:{title:'⚡ 系统事件 ⚡',showTitle:true,lines:'全息广告弹出新的赏金任务：护送数据核心穿越暗网。\n街角的拉面摊冒着热气，老板机器人发出嗡嗡声。\n远处传来警笛声，无人机编队掠过天际。\n你的神经接口收到一条加密信息：「老地方见」。\n霓虹灯在雨中闪烁，倒映在积水的路面上。'}},
    {name:'日常校园',data:{title:'📖 今日小事 📖',showTitle:true,lines:'上课铃声响起，窗外的蝉鸣渐强。\n午后的阳光洒进教室，粉笔灰在光柱中飞舞。\n走廊尽头传来脚步声，是迟到的同学。\n黑板上写着今日课题：关于勇气与选择。\n放学后的社团活动时间，你准备做什么？'}},
    {name:'末日生存',data:{title:'☢ 遭遇记录 ☢',showTitle:true,lines:'废墟中发现了一个完好的医疗箱。\n远处传来变异生物的嘶吼声。\n无线电里断断续续传来求救信号。\n暴风雪即将来临，需要尽快找到避难所。\n在废弃的加油站里，你找到了一箱燃料。'}},
  ],
  welcome:[
    {name:'奇幻风',data:{title:'欢迎来到 {{char}} 的世界',subtitle:'一段传奇，即将书写',decoStyle:'ornate'}},
    {name:'赛博风',data:{title:'LINK START — {{char}}',subtitle:'神经连接已建立 · {{user}} 已接入',decoStyle:'gradient'}},
    {name:'暗黑风',data:{title:'{{char}}',subtitle:'深渊凝视着你',decoStyle:'glitch'}},
    {name:'温馨风',data:{title:'你好，{{user}}',subtitle:'欢迎来到 {{char}} 的小屋',decoStyle:'underline'}},
  ],
  quote:[
    {name:'哲理',data:{text:'每一个选择，都是另一段人生的开始。',source:''}},
    {name:'冒险',data:{text:'真正的冒险，始于你踏出舒适区的那一刻。',source:''}},
    {name:'命运',data:{text:'命运不是被给予的，而是被创造的。',source:''}},
    {name:'勇气',data:{text:'勇气不是没有恐惧，而是决定有比恐惧更重要的事。',source:''}},
  ],
  dice:[
    {name:'命运检定 (1d20)',data:{label:'命运检定',expr:'1d20',style:'card'}},
    {name:'攻击判定 (2d6)',data:{label:'攻击判定',expr:'2d6',style:'poker'}},
    {name:'幸运检定 (1d100)',data:{label:'幸运检定',expr:'1d100',style:'rpg'}},
  ],
  gate:[
    {name:'年龄验证（18+）',data:{theme:'age',title:'你满 18 岁了吗？',text:'本角色卡可能涉及成人内容，未满18岁谢绝进入。',buttonText:'是，我已年满18岁并同意进入',leaveText:'不，我未满18岁并离开',logo:'CHARACTER CARD'}},
    {name:'剧场帷幕',data:{theme:'curtain',title:'✦ 开场在即 ✦',text:'帷幕之后，故事正在等你落座启封。',buttonText:'拉开帷幕',logo:'NOW SHOWING'}},
    {name:'封印法阵',data:{theme:'seal',title:'封印已至',text:'触碰符文，解除沉睡此地的契约。',buttonText:'解开封印'}},
    {name:'机密金库',data:{theme:'vault',title:'库门紧闭',text:'转动转轮，开启尘封的机密档案。',buttonText:'转动开启',logo:'VAULT-07'}},
    {name:'生物识别',data:{theme:'scan',title:'身份未验证',text:'请通过视网膜扫描确认你的访问权限。',buttonText:'通过验证',logo:'SEC-09 // CLEARANCE'}},
  ],
};

/* ================================================================
 * gate 主题/预设文案同步（纯函数，UI 接线 + 测试共用）：
 * 六主题字段集不同，套预设/切主题若不同步字段会跨主题串显残留文案
 * ================================================================ */
const GATE_THEMES=['curtain','seal','vault','scan','age'];
const GATE_COPY_FIELDS=['title','text','buttonText','logo','leaveText'];

/* 套预设：gate 先归一 create() 全字段再叠预设，清除上一预设残留（其他类型只叠预设） */
function applyBlockPreset(b,data){
  if(b&&b.type==='gate'){
    const clean=BLOCK_DEFS.gate.create();
    Object.keys(clean).forEach(k=>{b[k]=clean[k]});
  }
  Object.keys(data).forEach(k=>{b[k]=data[k]});
}

/* 切主题后同步文案：字段值属模板集合（create 默认 + 五预设）→ 换新主题模板值；用户自定义保留 */
function syncGateThemeCopy(b){
  const tpl=new Set();
  const collect=o=>Object.values(o).forEach(v=>{if(typeof v==='string')tpl.add(v)});
  collect(BLOCK_DEFS.gate.create());
  BLOCK_PRESETS.gate.forEach(pd=>collect(pd.data));
  const nt=GATE_THEMES.includes(b.theme)?b.theme:'classic';
  const tOf=k=>{
    if(nt==='classic')return BLOCK_DEFS.gate.create()[k];
    const pd=BLOCK_PRESETS.gate.find(x=>x.data.theme===nt);
    return pd&&pd.data[k]!==undefined?pd.data[k]:BLOCK_DEFS.gate.create()[k];
  };
  GATE_COPY_FIELDS.forEach(k=>{
    if(typeof b[k]==='string'&&tpl.has(b[k]))b[k]=tOf(k);
  });
}

/* ================================================================
 * 工具自身 UI 主题（顶栏下拉选择；CSS 端为 html[data-theme='id'] 令牌块）
 * ================================================================ */
const UI_THEMES=[
  {id:'bronze',   name:'暖铜金'},
  {id:'star',     name:'星夜'},
  {id:'blueprint',name:'蓝图'},
  {id:'crt',      name:'磷光'},
  {id:'abyss',    name:'深海'},
  {id:'velvet',   name:'绯幕'},
  {id:'moonstone',name:'月岩'},
];

export {BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES, THEME_PRESETS, COMP_LIB, BUILTIN_TEMPLATES, BLOCK_PRESETS, defaultProject, UI_THEMES, applyBlockPreset, syncGateThemeCopy, SCHEMA_VERSION};

