/* 数据定义：区块 / 主题预设 / 组件库 */
import { uid } from './utils.js';

/**
 * 区块数据结构（各类型专属字段见 BLOCK_DEFS[type].create() 返回值）
 * @typedef {Object} Block
 * @property {string} type - 区块类型（BLOCK_DEFS 的 key）
 * @property {boolean} enabled - 是否启用
 * @property {string} [title] - 标题类文本（welcome/randomevent/dice/bgm/qa 等）
 * @property {string} [text] - 正文文本（quote/disclaimer/author/clockbar 等）
 * @property {string} [html] - 自由 HTML（freehtml）
 * @property {Array<{name:string,desc:string,tags:string,avatar:string}>} [characters] - 角色列表（profile）
 * @property {Array<{url:string,cap:string}>} [images] - 图片列表（gallery）
 * @property {Array<{name:string,url:string}>} [tracks] - 曲目列表（bgm）
 * @property {Array<{name:string,items:Array<{q:string,a:string}>}>} [groups] - 问答分组（qa）
 */

/**
 * 主题配置
 * @typedef {Object} ThemeConfig
 * @property {string} primary - 主色
 * @property {string} accent - 强调色（标题/边框）
 * @property {string} textColor - 文字颜色
 * @property {boolean} followTavern - 跟随酒馆主题文字色
 * @property {string} fontName - 字体名（空为系统默认）
 * @property {number} radius - 圆角 px
 * @property {string} titleAlign - 标题对齐 center|left
 */

/**
 * 自定义宏（仅影响预览替换）
 * @typedef {Object} Macro
 * @property {string} k - 宏名（如 char）
 * @property {string} v - 预览替换值
 */

const BLOCK_DEFS={
  welcome:{name:'欢迎 / 标题区',icon:'✨',create:()=>({title:'欢迎来到 {{char}} 的世界',subtitle:'一段旅程，即将开始',decoStyle:'ornate'})},
  decor:{name:'装饰区',icon:'🎨',create:()=>({borderStyle:'double',bgType:'gradient',bgColor:'#1a1a2e',bgColor2:'#2d1b3d',bgImage:'',pattern:'stars',patternText:'✦ ✧ ✦ ✧ ✦'})},
  profile:{name:'角色简介区',icon:'👤',create:()=>({showAvatar:true,showName:true,showDesc:true,showTags:true,avatarRound:true,
    characters:[{name:'{{char}}',desc:'这里显示角色简介，可添加多个角色。',tags:'女主角,神秘,温柔',avatar:''}]})},
  disclaimer:{name:'免责声明区',icon:'⚠️',create:()=>({text:'本角色卡内容纯属虚构，由 AI 生成，仅供娱乐。',style:'collapse'})},
  greetings:{name:'开场白选择区',icon:'💌',create:()=>({cardStyle:'card',clickAction:'go',buttonText:'开始',titleWb:'',titleEntry:'开场白标题库',
    placeholderList:'宁静的清晨｜晨光洒进房间，新的一天开始了\n雨夜的邂逅｜一场大雨，命运的相遇\n命运的转折｜故事迎来了关键的抉择时刻'})},
  quote:{name:'开场引言',icon:'📜',create:()=>({text:'每一个选择，都是另一段人生的开始。',source:''})},
  gallery:{name:'图片展示区',icon:'🖼️',create:()=>({images:[{url:'',cap:''}],cols:'3'})},
  author:{name:'作者的话',icon:'🖋️',create:()=>({text:'感谢游玩本卡片！\n制作：xxx ｜ 建议配合 xxx 预设使用。',style:'collapse'})},
  clockbar:{name:'动态时钟栏',icon:'🕰️',create:()=>({text:'◆ {{date}} · {{weekday}} · {{isotime}} ◆',color:'#87CEEB',size:15,align:'center',glow:true})},
  randomevent:{name:'随机事件区',icon:'🎲',create:()=>({title:'✦ 今日际遇 ✦',showTitle:true,pickMode:'one',
    lines:'一阵不知名的花香从半开的窗口飘了进来\n窗外的猫跳上了邻桌，打翻了一杯麦酒\n炉火忽然爆出一串火星，映得墙上影子摇曳\n远处传来钟声，在寂静的夜色中回荡\n一个戴着面纱的女子推门而入，环顾四周后走向角落\n桌上的蜡烛忽然熄灭，黑暗中传来一阵低语\n门外传来马蹄声，有人在雨夜中策马而来\n吟游诗人拨动琴弦，即兴演奏了一段忧伤的旋律'})},
  dice:{name:'掷骰判定区',icon:'🎯',create:()=>({label:'幸运检定',expr:'1d20',style:'card'})},
  countdown:{name:'倒计时区',icon:'⏳',create:()=>({title:'距离正式开始还有',target:'',doneText:'时间到！'})},
  timeline:{name:'时间线/进度区',icon:'🗺️',create:()=>({title:'剧情进度',showTitle:true,
    nodes:'序章 · 启程|主角离开家乡，踏上旅途|done\n第一章 · 迷雾森林|在森林深处遭遇首次战斗|current\n第二章 · 王都见闻|尚未解锁的章节|lock'})},
  divider:{name:'分隔装饰线',icon:'➖',create:()=>({style:'diamond',text:''})},
  freehtml:{name:'自由 HTML 区',icon:'🧩',create:()=>({html:''})},
  bgm:{name:'音频/BGM 播放区',icon:'🎵',create:()=>({tracks:[{name:'示例曲目',url:''}],volume:50,loop:true,showTitle:true,title:'背景音乐',useTavernCmd:false})},
  fx:{name:'粒子动效区',icon:'💫',create:()=>({effect:'meteor',count:30,speed:1,opacity:0.8})},
  qa:{name:'问答折叠区',icon:'❓',create:()=>({title:'常见问题',showTitle:true,
    groups:[{name:'📖 基础设定',items:[{q:'这个世界的基本规则是什么？',a:'这里写世界观的基础规则说明……'},{q:'故事发生在什么时代？',a:'时代背景说明……'}]},{name:'🎭 角色相关',items:[{q:'主角的特殊能力是什么？',a:'能力设定说明……'}]}]})},
};
const BLOCK_ORDER=['welcome','decor','fx','quote','clockbar','randomevent','dice','countdown','timeline','profile','qa','gallery','bgm','greetings','divider','disclaimer','author','freehtml'];
/* 默认启用的核心区块；新区块默认关闭，由用户自行开启 */
const CORE_TYPES=['welcome','decor','profile','greetings','divider','disclaimer'];

/* ================================================================
 * 主题预设库：一键套用成品配色
 * 每套一个明确的世界观概念（frontend-design：intentionality over generic）
 * ================================================================ */
const THEME_PRESETS=[
  {name:'紫夜幻金',theme:{primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',radius:12,titleAlign:'center'}},
  {name:'荆棘王室',theme:{primary:'#8c1f3f',accent:'#e8a2b8',textColor:'#fbeef2',radius:4,titleAlign:'center'}},
  {name:'狐火缘日',theme:{primary:'#e8792e',accent:'#8fd3e8',textColor:'#fdf2e7',radius:10,titleAlign:'center'}},
  {name:'蓝电义体',theme:{primary:'#00a8cc',accent:'#ff2e88',textColor:'#eafcff',radius:2,titleAlign:'center'}},
  {name:'渊语回廊',theme:{primary:'#0d5c63',accent:'#4de3b0',textColor:'#e6f5f0',radius:12,titleAlign:'center'}},
];

/* ================================================================
 * 自由 HTML 组件库：全部内联样式、无脚本、无全局选择器，
 * 点击即追加到「自由 HTML 区」内容末尾
 * ================================================================ */
/* FA 动效组件（模板与组件库共用） */
const AI_LOADING_HTML='<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0;padding:12px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.35);border-radius:8px;font-size:13px;color:#00e5ff"><i class="fa-solid fa-spinner fa-spin"></i> 正在建立神经链接<span style="animation:pulse 1s infinite">...</span></div>';
const HEART_AFF_HTML='<div style="margin:12px 0;padding:12px 14px;background:rgba(255,107,129,.08);border:1px solid rgba(255,107,129,.4);border-radius:10px"><div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px"><i class="fa-solid fa-heart fa-beat" style="color:#ff6b81"></i><strong>好感度</strong><span style="flex:1"></span><span style="color:#ff6b81;font-weight:700">10 / 100</span></div><div style="height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden"><div style="width:10%;height:100%;background:linear-gradient(90deg,#ff6b81,#ffb3c1);border-radius:4px"></div></div></div>';
const RANDOM_LINE_HTML='<div style="margin:12px 0;padding:12px 16px;background:rgba(232,196,124,.07);border-left:3px solid #e8c47c;border-radius:0 8px 8px 0;font-style:italic;font-size:13px;line-height:1.9">{{random::「今天的风里，好像有故事的味道。」::「你相信命运吗？反正我不信……大概。」::「嘘——别出声，你听。」}}</div>';
const LORE_PANEL_HTML='<details style="margin:12px 0;background:rgba(255,255,255,.04);border:1px solid rgba(124,108,240,.35);border-radius:10px;padding:10px 14px"><summary style="cursor:pointer;user-select:none;font-size:13px;font-weight:600"><i class="fa-solid fa-book fa-fade" style="color:#a99cf5"></i> 📜 世界观设定（点击展开）</summary><div style="margin-top:10px;font-size:12px;line-height:2;opacity:.85">这里写世界观、势力划分、魔法体系等背景设定。<br>玩家想看再点开，不占用开场页的视觉空间。</div></details>';

/* v1.6 新增纯 CSS 组件（无脚本；<style> 作用域类名以 opg- 前缀隔离，多次插入不冲突） */
const TYPEWRITER_HTML='<div style="margin:12px 0;padding:12px 16px;background:rgba(0,0,0,.28);border:1px solid rgba(124,108,240,.4);border-radius:10px;font-family:Consolas,monospace;font-size:13px;line-height:1.9">\n<style>\n@keyframes opg-tw{from{width:0}to{width:22ch}}\n@keyframes opg-caret{50%{border-color:transparent}}\n.opg-tw{display:inline-block;overflow:hidden;white-space:nowrap;max-width:100%;border-right:2px solid #7c6cf0;animation:opg-tw 2.6s steps(22) .4s forwards,opg-caret .8s step-end infinite}\n</style>\n<span class="opg-tw">正在接入终端……信号校准中，请稍候。</span>\n</div>';
const TABS_HTML='<div style="margin:12px 0">\n<style>\n.opg-tabs input{display:none}\n.opg-tabs label{display:inline-block;padding:6px 16px;margin-right:4px;font-size:12px;cursor:pointer;border:1px solid rgba(124,108,240,.4);border-bottom:none;border-radius:8px 8px 0 0;opacity:.6;user-select:none}\n.opg-tabs input:checked+label{opacity:1;color:#e8c47c;border-color:#e8c47c}\n.opg-tabs .opg-tab-pane{display:none;padding:12px 14px;border:1px solid rgba(124,108,240,.4);border-radius:0 8px 8px 8px;font-size:13px;line-height:1.8}\n.opg-tabs input:checked~.opg-tab-pane{display:none}\n#opg-tab1:checked~.opg-pane1,#opg-tab2:checked~.opg-pane2,#opg-tab3:checked~.opg-pane3{display:block}\n</style>\n<div class="opg-tabs">\n<input type="radio" name="opg-tabs" id="opg-tab1" checked><label for="opg-tab1">📖 简介</label>\n<input type="radio" name="opg-tabs" id="opg-tab2"><label for="opg-tab2">🎭 角色</label>\n<input type="radio" name="opg-tabs" id="opg-tab3"><label for="opg-tab3">📜 规则</label>\n<div class="opg-tab-pane opg-pane1">第一个标签页的内容，写世界观简介……</div>\n<div class="opg-tab-pane opg-pane2">第二个标签页的内容，写角色介绍……</div>\n<div class="opg-tab-pane opg-pane3">第三个标签页的内容，写游玩规则……</div>\n</div>\n</div>';
const BADGE_HTML='<style>\n@keyframes opg-badge{0%,100%{transform:scale(1);box-shadow:0 0 4px rgba(255,46,166,.4)}50%{transform:scale(1.08);box-shadow:0 0 14px rgba(255,46,166,.7)}}\n.opg-badge{display:inline-block;padding:2px 12px;border-radius:20px;background:linear-gradient(90deg,#ff2ea6,#7c6cf0);color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;animation:opg-badge 1.4s ease-in-out infinite}\n</style>\n<span class="opg-badge">🔥 限时活动</span>';
const TOOLTIP_HTML='<style>\n.opg-tip{position:relative;display:inline-block;border-bottom:1px dotted #e8c47c;cursor:help;font-size:12px}\n.opg-tip .opg-tip-bubble{position:absolute;left:50%;bottom:130%;transform:translateX(-50%);width:max-content;max-width:240px;padding:8px 12px;background:#1e1e2e;border:1px solid #e8c47c;border-radius:8px;font-size:12px;line-height:1.7;color:#f0f0f5;opacity:0;pointer-events:none;transition:opacity .2s;z-index:10}\n.opg-tip:hover .opg-tip-bubble{opacity:1}\n</style>\n<span class="opg-tip">灵力值<span class="opg-tip-bubble">使用法术会消耗灵力，休息或饮用药剂可以恢复。</span></span>';

/* —— v1.7 新增场景组件（frontend-design：每组件一个独立人格，纯 CSS 无脚本）—— */
const CHAT_HTML='<div class="opg-chat">\n<style>\n.opg-chat{--cb-accent:#7c6cf0;display:flex;flex-direction:column;gap:14px;margin:12px 0;font-family:inherit}\n.opg-chat-row{display:flex;gap:9px;align-items:flex-end}\n.opg-chat-row.opg-chat-right{flex-direction:row-reverse}\n.opg-chat-ava{width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;background:linear-gradient(135deg,#2d2d5e,#1a1a3e);border:1px solid var(--cb-accent)}\n.opg-chat-col{max-width:78%;min-width:0}\n.opg-chat-name{font-size:11px;opacity:.55;margin:0 4px 3px}\n.opg-chat-bubble{padding:9px 13px;border-radius:12px 12px 12px 4px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);font-size:13px;line-height:1.75}\n.opg-chat-right .opg-chat-bubble{border-radius:12px 12px 4px 12px;background:linear-gradient(135deg,var(--cb-accent),#453a75);border-color:transparent}\n.opg-chat-time{font-size:10px;opacity:.4;margin-top:3px}\n.opg-chat-right .opg-chat-time{text-align:right}\n</style>\n<div class="opg-chat-row"><div class="opg-chat-ava">🎭</div><div class="opg-chat-col"><div class="opg-chat-name">{{char}}</div><div class="opg-chat-bubble">「早安——今天的风里有海的味道。」她把一杯还冒着热气的奶茶放在你手边。</div><div class="opg-chat-time">08:12</div></div></div>\n<div class="opg-chat-row opg-chat-right"><div class="opg-chat-ava">🧑‍🚀</div><div class="opg-chat-col"><div class="opg-chat-name">{{user}}</div><div class="opg-chat-bubble">你连周一都能说出这种话，真是天赋。</div><div class="opg-chat-time">08:13</div></div></div>\n</div>';
const INV_HTML='<div class="opg-inv">\n<style>\n.opg-inv{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:12px 0}\n.opg-inv-cell{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--rv,#9aa0ad);border-radius:10px;transition:transform .18s,box-shadow .18s}\n.opg-inv-cell:hover{transform:translateY(-3px);box-shadow:0 6px 18px -6px var(--rv,#9aa0ad)}\n.opg-inv-ic{font-size:22px;line-height:1}\n.opg-inv-nm{font-size:11px;opacity:.85;text-align:center;line-height:1.4}\n.opg-inv-ct{position:absolute;top:-7px;right:-4px;font-size:10px;padding:1px 7px;border-radius:9px;background:var(--rv,#9aa0ad);color:#0d0f16;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.35)}\n.opg-inv-lg{grid-column:1/-1;display:flex;justify-content:space-between;font-size:10px;opacity:.55;letter-spacing:1px;padding:2px 4px 0}\n</style>\n<div class="opg-inv-lg"><span>🎒 行囊</span><span>6 / 20 格</span></div>\n<div class="opg-inv-cell" style="--rv:#9aa0ad"><span class="opg-inv-ct">×3</span><span class="opg-inv-ic">🧪</span><span class="opg-inv-nm">治疗药水</span></div>\n<div class="opg-inv-cell" style="--rv:#58a6ff"><span class="opg-inv-ct">×1</span><span class="opg-inv-ic">🗝️</span><span class="opg-inv-nm">锈蚀的钥匙</span></div>\n<div class="opg-inv-cell" style="--rv:#b967ff"><span class="opg-inv-ct">×1</span><span class="opg-inv-ic">🔮</span><span class="opg-inv-nm">虚空棱镜</span></div>\n<div class="opg-inv-cell" style="--rv:#e8c47c"><span class="opg-inv-ct">×1</span><span class="opg-inv-ic">👑</span><span class="opg-inv-nm">先王的冠冕</span></div>\n<div class="opg-inv-cell" style="--rv:#9aa0ad"><span class="opg-inv-ic">🍞</span><span class="opg-inv-nm">黑麦面包</span></div>\n<div class="opg-inv-cell" style="--rv:#58a6ff"><span class="opg-inv-ct">×2</span><span class="opg-inv-ic">📜</span><span class="opg-inv-nm">藏宝图残页</span></div>\n</div>';
const TERM_HTML='<div class="opg-term">\n<style>\n.opg-term{margin:12px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(57,224,110,.35);background:#050a06;font-family:"JetBrains Mono",Consolas,monospace;box-shadow:0 8px 24px rgba(0,0,0,.35)}\n.opg-term-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(57,224,110,.08);border-bottom:1px solid rgba(57,224,110,.25)}\n.opg-term-dot{width:10px;height:10px;border-radius:50%}\n.opg-term-title{margin-left:6px;font-size:11px;letter-spacing:3px;color:rgba(57,224,110,.7)}\n.opg-term-body{padding:12px 14px;font-size:12px;line-height:1.9;color:#39e06e;position:relative}\n.opg-term-body div{white-space:pre-wrap;position:relative;z-index:1}\n.opg-term-body::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 3px)}\n.opg-term-caret{display:inline-block;width:8px;height:13px;vertical-align:-2px;background:#39e06e;animation:opg-term-blink 1.1s steps(1) infinite}\n@keyframes opg-term-blink{50%{opacity:0}}\n</style>\n<div class="opg-term-bar"><span class="opg-term-dot" style="background:#ff5f56"></span><span class="opg-term-dot" style="background:#ffbd2e"></span><span class="opg-term-dot" style="background:#27c93f"></span><span class="opg-term-title">SYSTEM_LOG</span></div>\n<div class="opg-term-body">\n<div>&gt; 正在建立与 {{char}} 的神经链路……</div>\n<div>&gt; 信号强度 ▓▓▓▓▓▓▓▓░░ 82%</div>\n<div>&gt; 记忆分片加载完毕 · 情绪模块在线</div>\n<div>&gt; 欢迎回来，{{user}}。<span class="opg-term-caret"></span></div>\n</div>\n</div>';
const LETTER_HTML='<div class="opg-letter">\n<style>\n.opg-letter{position:relative;margin:16px 4px;padding:18px 20px 38px;background:linear-gradient(160deg,#f2ecdc,#e9e1cc);border-radius:4px;transform:rotate(-.6deg);box-shadow:0 10px 26px rgba(0,0,0,.4);color:#3b342a;font-family:"Noto Serif SC","Songti SC","SimSun",serif}\n.opg-letter::before{content:"";position:absolute;inset:0;border-radius:4px;background:repeating-linear-gradient(0deg,transparent 0 25px,rgba(59,52,42,.13) 25px 26px);pointer-events:none}\n.opg-letter-hd{font-size:11px;letter-spacing:3px;opacity:.55;margin-bottom:8px}\n.opg-letter-bd{position:relative;font-size:13.5px;line-height:26px;white-space:pre-wrap}\n.opg-letter-ft{margin-top:8px;text-align:right;font-size:12.5px;opacity:.75}\n.opg-letter-seal{position:absolute;right:16px;bottom:-12px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 32%,#c94b3d,#8f2f26 70%);color:#f6e8dd;font-size:15px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 0 0 2px rgba(246,232,221,.25);transform:rotate(8deg)}\n</style>\n<div class="opg-letter-hd">✉ FROM {{char}}</div>\n<div class="opg-letter-bd">亲爱的 {{user}}：\n\n　　展信安。正文写在这里，每一行都会落在横线上。\n　　风把窗帘吹起来的时候，我总会想起你。</div>\n<div class="opg-letter-ft">—— {{char}} · 于某个雨夜</div>\n<div class="opg-letter-seal">缄</div>\n</div>';
const QUEST_HTML='<details class="opg-quest" open>\n<style>\n.opg-quest{margin:12px 0;background:rgba(216,179,106,.06);border:1px dashed rgba(216,179,106,.5);border-radius:10px;padding:12px 16px;color:inherit}\n.opg-quest summary{cursor:pointer;user-select:none;font-weight:700;font-size:13px;letter-spacing:2px;color:#d8b36a;list-style:none;display:flex;align-items:center;gap:8px}\n.opg-quest summary::-webkit-details-marker{display:none}\n.opg-quest summary::after{content:"▾";margin-left:auto;font-size:11px;opacity:.6;transition:transform .2s}\n.opg-quest[open] summary::after{transform:rotate(180deg)}\n.opg-quest-i{display:flex;gap:9px;padding:8px 0;font-size:13px;line-height:1.7;border-bottom:1px dotted rgba(216,179,106,.25)}\n.opg-quest-i:last-child{border-bottom:none}\n.opg-quest-mk{flex-shrink:0;color:#d8b36a}\n.opg-quest-done{opacity:.45}\n.opg-quest-done .opg-quest-tx{text-decoration:line-through}\n.opg-quest-rw{margin-top:9px;font-size:11.5px;opacity:.7;letter-spacing:.5px}\n</style>\n<summary>🗡️ 冒险者公会 · 今日委托</summary>\n<div class="opg-quest-i opg-quest-done"><span class="opg-quest-mk">☑</span><span class="opg-quest-tx">清剿下水道的巨鼠群（已验收）</span></div>\n<div class="opg-quest-i"><span class="opg-quest-mk">☐</span><span class="opg-quest-tx">寻找失踪商队的护卫，最后出现在旧城区</span></div>\n<div class="opg-quest-i"><span class="opg-quest-mk">☐</span><span class="opg-quest-tx">调查钟楼午夜传出的低语</span></div>\n<div class="opg-quest-rw">💰 赏金合计 1200 金克朗 ｜ ⚠️ 逾期将扣除公会信用</div>\n</details>';
const CHAPHD_HTML='<div class="opg-chaphd">\n<style>\n.opg-chaphd{position:relative;margin:20px 0 14px;padding:4px 0 4px 14px;overflow:hidden}\n.opg-chaphd::before{content:"";position:absolute;left:0;top:2px;bottom:2px;width:3px;border-radius:2px;background:linear-gradient(180deg,#7c6cf0,transparent)}\n.opg-chaphd-kicker{font-family:"JetBrains Mono",Consolas,monospace;font-size:10px;letter-spacing:5px;opacity:.5}\n.opg-chaphd-title{font-family:"Noto Serif SC","Songti SC","SimSun",serif;font-size:21px;font-weight:700;letter-spacing:2px;margin:3px 0 0}\n.opg-chaphd-no{position:absolute;right:2px;top:-10px;font-family:Georgia,"Times New Roman",serif;font-size:62px;font-weight:700;line-height:1;opacity:.08;pointer-events:none}\n</style>\n<span class="opg-chaphd-no">01</span>\n<div class="opg-chaphd-kicker">CHAPTER 01</div>\n<div class="opg-chaphd-title">雾起星坠城</div>\n</div>';
const RATE_HTML='<div class="opg-rate">\n<style>\n.opg-rate{display:flex;align-items:center;gap:10px;margin:12px 0;padding:11px 14px;background:rgba(232,196,124,.06);border:1px solid rgba(232,196,124,.4);border-radius:10px;flex-wrap:wrap}\n.opg-rate-stars{color:#e8c47c;font-size:14px;letter-spacing:3px;flex-shrink:0}\n.opg-rate-stars .opg-rate-off{opacity:.22}\n.opg-rate-tx{font-size:12.5px;line-height:1.6;opacity:.92;min-width:0}\n.opg-rate-src{font-size:11px;opacity:.5;margin-left:auto;flex-shrink:0}\n</style>\n<span class="opg-rate-stars">★ ★ ★ ★ <span class="opg-rate-off">★</span></span>\n<span class="opg-rate-tx">「看完第一章就没睡着过，世界观吊人得很。」</span>\n<span class="opg-rate-src">—— 匿名旅人</span>\n</div>';
const CAL_HTML='<div class="opg-cal">\n<style>\n.opg-cal{display:flex;margin:12px 0;background:rgba(255,255,255,.05);border:1px solid rgba(124,108,240,.4);border-radius:12px;overflow:hidden}\n.opg-cal-date{flex-shrink:0;width:78px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:linear-gradient(165deg,#7c6cf0,#453a75);color:#fff;padding:14px 8px}\n.opg-cal-mo{font-size:10px;letter-spacing:3px;opacity:.85}\n.opg-cal-day{font-size:30px;font-weight:700;line-height:1.15;font-variant-numeric:tabular-nums}\n.opg-cal-wd{font-size:10px;opacity:.8}\n.opg-cal-list{flex:1;min-width:0;padding:11px 14px;display:flex;flex-direction:column;justify-content:center;gap:7px;font-size:12.5px;line-height:1.55}\n.opg-cal-ev{display:flex;gap:9px;align-items:baseline}\n.opg-cal-tm{font-family:"JetBrains Mono",Consolas,monospace;font-size:11px;opacity:.55;flex-shrink:0}\n</style>\n<div class="opg-cal-date"><span class="opg-cal-mo">SEP</span><span class="opg-cal-day">01</span><span class="opg-cal-wd">星期二</span></div>\n<div class="opg-cal-list">\n<div class="opg-cal-ev"><span class="opg-cal-tm">08:00</span><span>开学典礼 · 大礼堂</span></div>\n<div class="opg-cal-ev"><span class="opg-cal-tm">15:30</span><span>社团招新 · 中庭</span></div>\n<div class="opg-cal-ev"><span class="opg-cal-tm">19:00</span><span>天台 · 与{{char}}有约</span></div>\n</div>\n</div>';

const COMP_LIB=[
  {icon:'📊',name:'进度条',html:'<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>好感度</span><span>35 / 100</span></div><div style="height:8px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden"><div style="width:35%;height:100%;background:linear-gradient(90deg,#7c6cf0,#e8c47c);border-radius:4px"></div></div></div>'},
  {icon:'🏷️',name:'标签组',html:'<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0"><span style="font-size:11px;padding:2px 12px;border:1px solid #7c6cf0;border-radius:20px;color:#a99cf5">温柔</span><span style="font-size:11px;padding:2px 12px;border:1px solid #7c6cf0;border-radius:20px;color:#a99cf5">神秘</span><span style="font-size:11px;padding:2px 12px;border:1px solid #7c6cf0;border-radius:20px;color:#a99cf5">猫系</span></div>'},
  {icon:'💬',name:'引言框',html:'<div style="margin:12px 0;padding:10px 14px;border-left:3px solid #e8c47c;background:rgba(255,255,255,.05);border-radius:0 8px 8px 0;font-style:italic;font-size:13px;line-height:1.8;opacity:.92">「人们说，海洋深处藏着所有被遗忘的名字。」</div>'},
  {icon:'🎴',name:'信息卡片',html:'<div style="display:flex;gap:10px;margin:12px 0;flex-wrap:wrap"><div style="flex:1;min-width:130px;background:rgba(255,255,255,.06);border:1px solid rgba(124,108,240,.4);border-radius:10px;padding:12px"><div style="font-size:11px;opacity:.6;margin-bottom:4px">当前位置</div><div style="font-size:14px;font-weight:600;color:#e8c47c">星坠城 · 港湾区</div></div><div style="flex:1;min-width:130px;background:rgba(255,255,255,.06);border:1px solid rgba(124,108,240,.4);border-radius:10px;padding:12px"><div style="font-size:11px;opacity:.6;margin-bottom:4px">当前时间</div><div style="font-size:14px;font-weight:600;color:#e8c47c">深夜 23:47</div></div></div>'},
  {icon:'🎵',name:'音乐播放器',html:'<div class="opg-music" data-src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" data-title="夏日微风" data-artist="SoundHelix" data-cover="https://picsum.photos/seed/music/300/300">\n<style>\n.opg-music,.opg-music *{box-sizing:border-box;margin:0;padding:0}\n.opg-music{width:100%;max-width:340px;margin:12px auto;padding:24px 22px 20px;border-radius:24px;background:linear-gradient(145deg,#1a1a2e,#16213e);box-shadow:0 20px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);font-family:inherit;color:#f0f0f5;user-select:none;position:relative;overflow:hidden}\n.opg-music::before{content:"";position:absolute;top:-40%;right:-30%;width:200px;height:200px;background:radial-gradient(circle,rgba(0,210,255,.08),transparent 70%);border-radius:50%;pointer-events:none}\n.opg-music-cover{position:relative;display:flex;justify-content:center;margin-bottom:16px}\n.opg-music-cover img{width:110px;height:110px;border-radius:50%;object-fit:cover;box-shadow:0 8px 32px rgba(0,0,0,.5);background:linear-gradient(135deg,#2d2d5e,#1a1a3e)}\n.opg-music.playing .opg-music-cover img{animation:opgMpSpin 20s linear infinite}\n@keyframes opgMpSpin{to{transform:rotate(360deg)}}\n.opg-music-cover span{width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#2d2d5e,#1a1a3e);display:none;align-items:center;justify-content:center;font-size:44px;color:rgba(255,255,255,.2)}\n.opg-music-info{text-align:center;margin-bottom:12px}\n.opg-music-title{font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}\n.opg-music-artist{font-size:13px;color:rgba(255,255,255,.55);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.opg-music-prog{display:flex;align-items:center;gap:10px;margin:10px 0 6px}\n.opg-music-time{font-size:11px;color:rgba(255,255,255,.45);min-width:34px;text-align:center;font-variant-numeric:tabular-nums}\n.opg-music-track{flex:1;height:4px;background:rgba(255,255,255,.12);border-radius:4px;cursor:pointer;position:relative}\n.opg-music-track:hover{height:6px}\n.opg-music-fill{width:0%;height:100%;background:linear-gradient(90deg,#00d2ff,#7a5cff);border-radius:4px;pointer-events:none}\n.opg-music-ctrl{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px}\n.opg-music button{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;transition:all .2s;padding:6px;border-radius:50%}\n.opg-music button:hover{color:#fff}\n.opg-music-play{width:50px;height:50px;background:linear-gradient(135deg,#00d2ff,#7a5cff)!important;color:#fff!important;box-shadow:0 4px 24px rgba(0,210,255,.3);display:flex;align-items:center;justify-content:center}\n.opg-music-play:hover{transform:scale(1.05);box-shadow:0 6px 32px rgba(0,210,255,.45)}\n.opg-music-play svg{width:22px;height:22px;fill:currentColor}\n.opg-music-vol{display:flex;align-items:center;gap:6px}\n.opg-music-vol input{width:56px;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.15);border-radius:4px;outline:none;cursor:pointer}\n.opg-music-vol input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(0,210,255,.3);cursor:pointer}\n.opg-music-vol input::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:none}\n.opg-music-err{text-align:center;font-size:12px;color:rgba(255,100,100,.75);margin-top:6px;min-height:16px}\n@media (max-width:400px){.opg-music{padding:18px 14px 16px}.opg-music-cover img,.opg-music-cover span{width:96px;height:96px}}\n</style>\n<div class="opg-music-cover"><img src="https://picsum.photos/seed/music/300/300" alt="封面" onerror="this.style.display=&#39;none&#39;;this.parentNode.querySelector(&#39;span&#39;).style.display=&#39;flex&#39;"><span>♪</span></div>\n<div class="opg-music-info"><div class="opg-music-title">夏日微风</div><div class="opg-music-artist">SoundHelix</div></div>\n<div class="opg-music-prog"><span class="opg-music-time">0:00</span><div class="opg-music-track"><div class="opg-music-fill"></div></div><span class="opg-music-time">0:00</span></div>\n<div class="opg-music-ctrl"><button type="button" class="opg-music-play" aria-label="播放/暂停"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></button><div class="opg-music-vol"><button type="button" aria-label="静音">🔊</button><input type="range" min="0" max="1" step="0.01" value="0.8"></div></div>\n<div class="opg-music-err"></div>\n<script>\n(function(){\n  function fmt(s){if(isNaN(s)||!isFinite(s))return"0:00";s=Math.floor(s);return Math.floor(s/60)+":"+("0"+s%60).slice(-2)}\n  function setup(root){\n    if(root.getAttribute("data-mp"))return;root.setAttribute("data-mp","1");\n    var q=function(s){return root.querySelector(s)};\n    var img=q("img"),ph=q(".opg-music-cover span"),track=q(".opg-music-track"),fill=q(".opg-music-fill"),\n        times=root.querySelectorAll(".opg-music-time"),tCur=times[0],tTot=times[1],\n        playBtn=q(".opg-music-play"),icon=q(".opg-music-play svg"),volBtn=q(".opg-music-vol button"),volIn=q(".opg-music-vol input"),err=q(".opg-music-err");\n    var audio=null,playing=false,muted=false,prevVol=.8,dragging=false,src=root.dataset.src||"";\n    q(".opg-music-title").textContent=root.dataset.title||"未命名歌曲";\n    q(".opg-music-artist").textContent=root.dataset.artist||"未知艺术家";\n    if(!root.dataset.cover){img.style.display="none";ph.style.display="flex"}\n    function showErr(m){err.textContent=m}\n    function setIcon(p){icon.innerHTML=p?String.fromCharCode(60)+"rect x=\\"6\\" y=\\"4\\" width=\\"4\\" height=\\"16\\"/"+String.fromCharCode(47)+String.fromCharCode(62)+String.fromCharCode(60)+"rect x=\\"14\\" y=\\"4\\" width=\\"4\\" height=\\"16\\"/"+String.fromCharCode(47)+String.fromCharCode(62):String.fromCharCode(60)+"polygon points=\\"5,3 19,12 5,21\\"/"+String.fromCharCode(47)+String.fromCharCode(62)}\n    function initAudio(){\n      if(!src){showErr("⚠️ 未配置 data-src 音乐链接");return false}\n      try{\n        audio=new Audio(src);audio.volume=parseFloat(volIn.value)||.8;audio.preload="metadata";\n        audio.addEventListener("loadedmetadata",function(){if(audio&&!isNaN(audio.duration))tTot.textContent=fmt(audio.duration);err.textContent=""});\n        audio.addEventListener("timeupdate",function(){if(audio&&!isNaN(audio.duration)&&!dragging){fill.style.width=Math.min(audio.currentTime/audio.duration*100,100)+"%";tCur.textContent=fmt(audio.currentTime)}});\n        audio.addEventListener("ended",function(){playing=false;root.classList.remove("playing");setIcon(false);if(audio){audio.currentTime=0;fill.style.width="0%";tCur.textContent="0:00"}});\n        audio.addEventListener("error",function(){showErr("⚠️ 音频加载失败，请检查链接与格式")});\n        audio.addEventListener("play",function(){root.classList.add("playing")});\n        audio.addEventListener("pause",function(){root.classList.remove("playing")});\n        return true;\n      }catch(e){showErr("⚠️ 无法加载音频");return false}\n    }\n    function toggle(){\n      if(!audio&&!initAudio())return;\n      if(playing){audio.pause();playing=false;setIcon(false)}\n      else{try{audio.play().then(function(){playing=true;setIcon(true)}).catch(function(e){showErr("⚠️ 无法播放："+(e.message||"浏览器拦截"))})}catch(e){showErr("⚠️ 无法播放")}}\n    }\n    function seek(x){\n      if(!audio||!audio.duration||isNaN(audio.duration))return;\n      var r=track.getBoundingClientRect(),pct=Math.max(0,Math.min(1,(x-r.left)/r.width));\n      audio.currentTime=pct*audio.duration;fill.style.width=pct*100+"%";tCur.textContent=fmt(pct*audio.duration);\n    }\n    function mv(e){if(dragging)seek(e.clientX)}\n    function up(){dragging=false}\n    playBtn.addEventListener("click",toggle);\n    track.addEventListener("mousedown",function(e){dragging=true;seek(e.clientX)});\n    document.addEventListener("mousemove",mv);document.addEventListener("mouseup",up);\n    track.addEventListener("touchstart",function(e){dragging=true;if(e.touches[0])seek(e.touches[0].clientX)},{passive:true});\n    track.addEventListener("touchmove",function(e){if(dragging&&e.touches[0]){e.preventDefault();seek(e.touches[0].clientX)}},{passive:false});\n    track.addEventListener("touchend",function(){dragging=false});\n    volIn.addEventListener("input",function(){setVol(this.value)});\n    volBtn.addEventListener("click",function(){if(muted)setVol(prevVol>0?prevVol:.8);else{prevVol=parseFloat(volIn.value)||.8;setVol(0)}});\n    function setVol(v){v=Math.max(0,Math.min(1,parseFloat(v)||0));volIn.value=v;if(audio)audio.volume=v;muted=v===0;volBtn.textContent=muted?"🔇":"🔊";if(v>0)prevVol=v}\n    setVol(volIn.value);\n  }\n  function init(){Array.prototype.forEach.call(document.querySelectorAll(".opg-music"),setup)}\n  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();\n})();\n<\/script>\n</div>'},
  {icon:'📁',name:'折叠面板',html:'<details style="margin:12px 0;background:rgba(255,255,255,.05);border:1px solid rgba(124,108,240,.35);border-radius:8px;padding:8px 12px"><summary style="cursor:pointer;user-select:none;font-size:13px;font-weight:600">📖 点击展开隐藏设定</summary><div style="margin-top:8px;font-size:12px;line-height:1.8;opacity:.85">这里写隐藏的世界观设定、背景故事等内容……</div></details>'},
  {icon:'✨',name:'装饰分隔',html:'<div style="display:flex;align-items:center;gap:12px;margin:16px 0;color:#e8c47c;opacity:.75;font-size:12px;letter-spacing:4px"><div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#e8c47c,transparent)"></div><span>✦</span><div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#e8c47c,transparent)"></div></div>'},
  {icon:'🔔',name:'公告栏',html:'<div style="margin:12px 0;padding:10px 14px;background:rgba(232,196,124,.1);border:1px dashed #e8c47c;border-radius:8px;font-size:12px;line-height:1.8"><strong style="color:#e8c47c">📌 公告</strong><br>本卡长期更新，反馈问题请到作者主页留言～</div>'},
  {icon:'📜',name:'滚动文本框',html:'<div style="margin:12px 0;max-height:140px;overflow:auto;padding:10px 14px;background:rgba(0,0,0,.25);border:1px solid rgba(124,108,240,.35);border-radius:8px;font-size:12px;line-height:1.9;opacity:.9">这里放较长的日志、信件、编年史内容……<br>超出高度会出现滚动条。<br>第三行占位。<br>第四行占位。<br>第五行占位。</div>'},
  {icon:'⏳',name:'状态行',html:'<div style="display:flex;flex-wrap:wrap;gap:14px;margin:12px 0;font-size:12px;opacity:.85"><span>🩸 生命 <strong style="color:#e06c5c">82</strong></span><span>🔮 灵力 <strong style="color:#7c6cf0">46</strong></span><span>💰 金币 <strong style="color:#e8c47c">128</strong></span><span>🎒 负重 <strong>12/40</strong></span></div>'},
  /* —— FA 动效 & 宏组合组件（v1.1 新增）—— */
  {icon:'📡',name:'AI 加载动画',html:AI_LOADING_HTML},
  {icon:'💗',name:'心跳好感度条',html:HEART_AFF_HTML},
  {icon:'💬',name:'随机台词框',html:RANDOM_LINE_HTML},
  {icon:'📚',name:'折叠世界观面板',html:LORE_PANEL_HTML},
  /* —— v1.6 新增纯 CSS 组件 —— */
  {icon:'⌨️',name:'打字机文本框',html:TYPEWRITER_HTML},
  {icon:'🗂️',name:'多标签页',html:TABS_HTML},
  {icon:'🔥',name:'动态徽章',html:BADGE_HTML},
  {icon:'💡',name:'悬浮提示标签',html:TOOLTIP_HTML},
  {icon:'🗨️',name:'对话气泡组',html:CHAT_HTML},
  {icon:'🎒',name:'物品栏卡片',html:INV_HTML},
  {icon:'📺',name:'终端窗口',html:TERM_HTML},
  {icon:'📮',name:'手写信笺',html:LETTER_HTML},
  {icon:'🗡️',name:'任务告示板',html:QUEST_HTML},
  {icon:'📰',name:'章节标题头',html:CHAPHD_HTML},
  {icon:'⭐',name:'评价卡',html:RATE_HTML},
  {icon:'🗓️',name:'日期事件卡',html:CAL_HTML},
];

/* ================================================================
 * 内置官方模板（v1.1）：新建工程时可选，一键套用完整布局
 * ================================================================ */
const blk=(type,enabled,patch={})=>({type,enabled,...BLOCK_DEFS[type].create(),...patch});
const BUILTIN_TEMPLATES=[
  {
    name:'赛博 AI 连接风',
    theme:{primary:'#00e5ff',accent:'#ff2ea6',textColor:'#eaf6ff',followTavern:false,fontName:'',radius:4,titleAlign:'center'},
    macros:[{k:'char',v:'NOVA-07'},{k:'user',v:'访问者'}],
    blocks:[
      blk('welcome',true,{title:'{{char}} 神经链接终端',subtitle:'CONNECTION ESTABLISHED · {{user}} 已接入',decoStyle:'gradient'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#0a0a14',bgColor2:'#10182e',borderStyle:'solid',pattern:'stars'}),
      blk('clockbar',true,{text:'<i class="fa-solid fa-satellite-dish fa-spin"></i> {{weekday}} {{isotime}} · 信号良好 · 延迟 3ms',color:'#00e5ff'}),
      blk('randomevent',true,{title:'✦ 本日系统播报 ✦',pickMode:'one',
        lines:'检测到未授权的意识波动，防火墙已自动加固\n星港上空的广告无人机正在集体更换宣传语\n旧城区第 7 区块发生小规模数据暴雨，交通临时管制\n有人在暗网拍卖一段不属于任何人的记忆'}),
      blk('freehtml',true,{html:AI_LOADING_HTML+'\n\n'+RANDOM_LINE_HTML}),
      blk('greetings',true),
      blk('divider',true),
      blk('disclaimer',true),
    ],
  },
  {
    name:'奇幻酒馆风',
    theme:{primary:'#b8923e',accent:'#ffd700',textColor:'#f5ecd7',followTavern:false,fontName:'',radius:8,titleAlign:'center'},
    macros:[{k:'char',v:'玛尔达'},{k:'user',v:'旅人'}],
    blocks:[
      blk('welcome',true,{title:'欢迎来到「银鹿酒馆」',subtitle:'炉火正旺 · 麦酒刚满 · 故事待续',decoStyle:'ornate'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#1a1208',bgColor2:'#2a1f10',borderStyle:'double',pattern:'moons'}),
      blk('quote',true,{text:'每一杯麦酒背后，都藏着一个不肯醒来的故事。',source:'酒馆老板娘 · 玛尔达',style:'center'}),
      blk('dice',true,{label:'命运之骰',expr:'2d6'}),
      blk('randomevent',true,{showTitle:false,pickMode:'line',
        lines:'角落里，一个兜帽旅行者正在低声吟唱古老的歌谣\n酒馆的门被推开，冷风卷着落叶灌了进来\n炉火忽然爆出一串火星，映得墙上影子摇曳\n吟游诗人拨动琴弦：\'为远方的客人献上一曲！\''}),
      blk('greetings',true),
      blk('divider',true),
      blk('disclaimer',true),
    ],
  },
  {
    name:'敦煌秘境·丝路旅记',
    theme:{primary:'#b4622d',accent:'#7fb2c7',textColor:'#f6ecdd',followTavern:false,fontName:'',radius:6,titleAlign:'center'},
    macros:[{k:'char',v:'迦叶沙'},{k:'user',v:'远行者'}],
    blocks:[
      blk('welcome',true,{title:'敦煌 · 千佛窟秘境',subtitle:'鸣沙山下 · 月牙泉畔 · 一卷失落的经变故事',decoStyle:'ornate'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#241612',bgColor2:'#3a2417',borderStyle:'double',pattern:'custom',patternText:'❖ ┈ ❖ ┈ ❖'}),
      blk('clockbar',true,{text:'✦ {{date}} · {{weekday}} · {{isotime}} ✦',color:'#d9a856'}),
      blk('timeline',true,{title:'西行进度',showTitle:true,
        nodes:'敦煌出发|领取经卷，辞别故人|done\n瓜州遇险|风沙中丢失了半数干粮|done\n楼兰古城|发现前朝商队的遗迹|current\n于阗国|尚未抵达|lock'}),
      blk('randomevent',true,{title:'✦ 沙海际遇 ✦',pickMode:'one',
        lines:'驼铃在风里断续，队尾的骆驼忽然停步不前\n洞窟里的提灯无风自灭，黑暗中传来经卷翻动的声音\n月牙泉的水面映出的，似乎不是你此刻的脸\n一个披着褪色头巾的商队遗孤向你讨一碗水喝'}),
      blk('countdown',true,{title:'距离藏经洞开启还有',target:'2027-05-01T00:00',doneText:'藏经洞已开！'}),
      blk('qa',true,{title:'行路问答',showTitle:true,groups:[{name:'📖 旅途须知',items:[{q:'这个故事发生在什么年代？',a:'架空晚唐，丝路沿线的绿洲城邦与佛窟秘境。'},{q:'西行进度怎么推进？',a:'跟随主线推进时间线节点即可解锁下一段旅程。'}]}]}),
      blk('greetings',true),
      blk('divider',true,{style:'diamond'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'拍立得物语·校园日常',
    theme:{primary:'#d9485f',accent:'#f2c4c9',textColor:'#fdf0f0',followTavern:false,fontName:'',radius:16,titleAlign:'center'},
    macros:[{k:'char',v:'小满'},{k:'user',v:'同桌'}],
    blocks:[
      blk('welcome',true,{title:'{{char}} 的拍立得相册',subtitle:'高中二年级 · 三年二班 · 夏天还没结束',decoStyle:'stamp'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#2a1a20',bgColor2:'#402733',borderStyle:'dotted',pattern:'hearts'}),
      blk('gallery',true,{cols:'3',images:[
        {url:'https://picsum.photos/seed/school1/300/300',cap:'天台便当'},
        {url:'https://picsum.photos/seed/school2/300/300',cap:'放学路口'},
        {url:'https://picsum.photos/seed/school3/300/300',cap:'文化祭前夜'}]}),
      blk('countdown',true,{title:'距离文化祭还有',target:'2026-09-30T08:00',doneText:'文化祭，开始了！'}),
      blk('quote',true,{text:'青春就是那种，过完之后才会后知后觉的东西。',source:'{{char}} 写在笔记本最后一页'}),
      blk('randomevent',true,{title:'📣 今日小广播',pickMode:'one',
        lines:'小满的桌上多了一杯没写名字的奶茶\n文化祭班级展板投票，三年二班暂时第二名\n走廊尽头的自动贩卖机吞了硬币不出饮料\n体育课自由活动，有人在天台弹吉他'}),
      blk('greetings',true,{cardStyle:'list'}),
      blk('divider',true,{style:'dots'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'血月庄园·家族谜局',
    theme:{primary:'#9e2437',accent:'#e0995c',textColor:'#f5e8e6',followTavern:false,fontName:'',radius:6,titleAlign:'center'},
    macros:[{k:'char',v:'薇奥拉'},{k:'user',v:'不速之客'}],
    blocks:[
      blk('welcome',true,{title:'血月庄园',subtitle:'欢迎回来 —— 已经等你很久了',decoStyle:'glitch'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#120a0e',bgColor2:'#2a1219',borderStyle:'solid',pattern:'moons'}),
      blk('fx',true,{effect:'firefly',count:24,speed:1,opacity:.7}),
      blk('profile',true,{characters:[
        {name:'薇奥拉 · 庄园大小姐',desc:'总是在晚餐后出现在画像长廊，问每一个客人同一个问题。',tags:'家主,不可名状,微笑',avatar:''},
        {name:'老管家 · 塞巴斯',desc:'庄园唯一的活人（大概）。知道所有房间钥匙的下落。',tags:'管家,守口如瓶',avatar:''},
      ]}),
      blk('dice',true,{label:'命运抽签',expr:'1d20',style:'rpg'}),
      blk('randomevent',true,{title:'🕯 今夜的庄园',pickMode:'one',
        lines:'画像长廊里，第三幅画的眼睛似乎转向了你\n地下室的锁链声准时在午夜十二点响起\n晚餐的汤是温的——这是庄园今晚唯一正常的东西\n你在枕头下发现一张字条：「别相信微笑的人」'}),
      blk('qa',true,{title:'庄园守则',showTitle:true,groups:[{name:'📜 入住须知',items:[{q:'可以离开庄园吗？',a:'血月当空的夜晚，大门只进不出。'},{q:'命运抽签有什么用？',a:'决定夜间探索的凶吉，谨慎掷骰。'}]}]}),
      blk('greetings',true),
      blk('divider',true,{style:'flowers'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'翠竹灵修·修行面板',
    theme:{primary:'#55854f',accent:'#cfe3b8',textColor:'#f1f6ea',followTavern:false,fontName:'',radius:14,titleAlign:'center'},
    macros:[{k:'char',v:'青竹子'},{k:'user',v:'外门弟子'}],
    blocks:[
      blk('welcome',true,{title:'青云观 · 修行录',subtitle:'外门弟子 {{user}} 的每日功课',decoStyle:'brackets'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#131c12',bgColor2:'#1d2a1a',borderStyle:'solid',pattern:'custom',patternText:'❘ ❖ ❘'}),
      blk('clockbar',true,{text:'卯时打坐 · {{weekday}} {{isotime}} · 灵气浓度：晴',color:'#a8c98a'}),
      blk('timeline',true,{title:'修行境界',showTitle:true,
        nodes:'炼气三层|气息初成，可引星辉入体|done\n炼气五层|当前境界，冲关在即|current\n筑基|尚未解锁|lock'}),
      blk('freehtml',true,{html:'<div style="margin:12px 0;padding:12px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(85,133,79,.5);border-radius:10px;font-size:13px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>修行进度</span><span>炼气五层 · 62/100</span></div><div style="height:8px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden"><div style="width:62%;height:100%;background:linear-gradient(90deg,#55854f,#cfe3b8);border-radius:4px"></div></div><div style="display:flex;justify-content:space-between;margin:10px 0 4px"><span>灵力</span><span>46/100</span></div><div style="height:8px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden"><div style="width:46%;height:100%;background:linear-gradient(90deg,#7fd4c1,#cfe3b8);border-radius:4px"></div></div></div>'}),
      blk('dice',true,{label:'每日一签',expr:'1d100',style:'rpg'}),
      blk('randomevent',true,{title:'🍃 观中今日',pickMode:'one',
        lines:'后山的竹子一夜之间拔高了三尺，守林人称不可解\n厨房的粥里被师兄偷偷掺了苦得离谱的草药\n藏经阁三层的门开着，但没有人记得谁进去过\n你的剑在架上轻轻震了一下，像是在回应什么'}),
      blk('greetings',true),
      blk('divider',true),
      blk('disclaimer',true),
    ],
  },
  {
    name:'雾都疑云·维多利亚侦探',
    theme:{primary:'#4a5d6e',accent:'#d4a24e',textColor:'#ece5d3',followTavern:false,fontName:'',radius:4,titleAlign:'center'},
    macros:[{k:'char',v:'格雷探长'},{k:'user',v:'委托人'}],
    blocks:[
      blk('welcome',true,{title:'{{char}} 侦探事务所',subtitle:'雾都贝克街 221B · 委托受理中',decoStyle:'brackets'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#141a20',bgColor2:'#232d38',borderStyle:'double',pattern:'lines'}),
      blk('clockbar',true,{text:'伦敦雾夜 · {{weekday}} {{isotime}} · 煤气灯未熄',color:'#d4a24e'}),
      blk('freehtml',true,{html:CHAPHD_HTML.replace('CHAPTER 01','CASE 01').replace('雾起星坠城','贝克街的第七封信')+'\n\n'+LETTER_HTML.replace('✉ FROM {{char}}','✉ 匿名来信').replace('展信安。正文写在这里，每一行都会落在横线上。','凌晨三点，钟楼的钟无故敲了七下。').replace('风把窗帘吹起来的时候，我总会想起你。','信里只有一句话——「他们知道袖扣在谁手里。」').replace('—— {{char}} · 于某个雨夜','—— 匿名委托人 · 于雾夜')}),
      blk('dice',true,{label:'线索检定',expr:'1d6',style:'rpg'}),
      blk('timeline',true,{title:'案情进度',nodes:'受理委托|匿名信送到事务所|done\n现场勘查|书房壁炉缺少一枚袖扣|current\n结论|尚未揭晓|lock'}),
      blk('freehtml',true,{html:QUEST_HTML.replace('🗡️ 冒险者公会 · 今日委托','🕵️ 事务所 · 悬案一览').replace('清剿下水道的巨鼠群（已验收）','钟楼守夜人失踪案（已结档）').replace('寻找失踪商队的护卫，最后出现在旧城区','追查第七封信的寄件人').replace('调查钟楼午夜传出的低语','辨认打捞出的怀表内刻字').replace('💰 赏金合计 1200 金克朗 ｜ ⚠️ 逾期将扣除公会信用','🕯 线索值累计 1200 ｜ ⚠️ 结案前请勿单独夜行')+'\n\n'+RATE_HTML.replace('「看完第一章就没睡着过，世界观吊人得很。」','「他只看了三分钟烟灰，就说出了我藏了半年的秘密。」').replace('—— 匿名旅人','—— 委托人回访记录')}),
      blk('randomevent',true,{title:'🕯 雾都小报',pickMode:'one',
        lines:'煤气灯又暗了一盏，巡夜人说是灯油，也说是别的\n泰晤士河的雾今天爬到了二楼\n典当行的橱窗里多了一枚不该出现的袖扣\n报童挥着号外跑过：「钟楼案第七位证人失踪！」'}),
      blk('greetings',true),
      blk('divider',true,{style:'plain'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'锈壤纪元·废土拾荒',
    theme:{primary:'#5f6f52',accent:'#d98e32',textColor:'#ede8d8',followTavern:false,fontName:'',radius:6,titleAlign:'center'},
    macros:[{k:'char',v:'拾荒者「阿锈」'},{k:'user',v:'同行者'}],
    blocks:[
      blk('welcome',true,{title:'锈壤纪元 · 第 47 拾荒季',subtitle:'辐射云散去的第三年 · {{user}} 与 {{char}} 同行',decoStyle:'stamp'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#161a12',bgColor2:'#241f16',borderStyle:'dashed',pattern:'custom',patternText:'☢ ⛁ ☢'}),
      blk('clockbar',true,{text:'地表剂量 · {{isotime}} · 辐射尘浓度：可出行',color:'#d98e32'}),
      blk('freehtml',true,{html:TERM_HTML.replace('SYSTEM_LOG','RELAY-07').replace('正在建立与 {{char}} 的神经链路……','接通拾荒者网络 · 中继站 7 号……').replace('信号强度 ▓▓▓▓▓▓▓▓░░ 82%','剂量读数 ▓▓▓▓▓▓░░░░ 61% · 可出行').replace('记忆分片加载完毕 · 情绪模块在线','盖革计数器在线 · 净水存量 3 天').replace('欢迎回来，{{user}}。','路线已标定，出发吧，{{user}}。')+'\n\n'+INV_HTML.replace('🎒 行囊','🎒 拾荒背包').replace('治疗药水','净水合剂').replace('锈蚀的钥匙','旧世界门卡').replace('虚空棱镜','信号棱镜').replace('先王的冠冕','完好防毒面具').replace('黑麦面包','罐头豆子').replace('藏宝图残页','区域地图残页')}),
      blk('randomevent',true,{title:'☢ 今日拾荒',pickMode:'one',
        lines:'商队留下半箱电池，换走了你们全部的罐头\n旧商场的自动门还在忠实地开合，给谁看呢\n风把一张区域地图吹到脚边，正好补上缺角\n远处的高塔闪了两下灯——那是十年前的求救码'}),
      blk('freehtml',true,{html:CAL_HTML.replace('SEP','RUST').replace('开学典礼 · 大礼堂','旧商场三层 · 清扫异变鼠群').replace('社团招新 · 中庭','净水站 · 更换滤芯').replace('天台 · 与{{char}}有约','天台电台 · 与{{char}}碰头交货')}),
      blk('quote',true,{text:'废墟之下，埋着旧世界的课业。',source:'{{char}} 刻在水箱上的话'}),
      blk('dice',true,{label:'物资鉴定',expr:'1d20',style:'poker'}),
      blk('timeline',true,{title:'本周路线',nodes:'出发|检查剂量与水粮|done\n旧商场|三层电器区，提防鼠群|current\n返程|称重结算，兑换电池|lock'}),
      blk('greetings',true),
      blk('divider',true,{style:'gradient-thick'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'云上航线·蒸汽飞艇',
    theme:{primary:'#7d5a3c',accent:'#e0a458',textColor:'#f0e6d2',followTavern:false,fontName:'',radius:8,titleAlign:'center'},
    macros:[{k:'char',v:'维克托船长'},{k:'user',v:'乘客'}],
    blocks:[
      blk('welcome',true,{title:'「信天翁号」云上航线',subtitle:'第 03 次跨海航行 · {{user}} 登船愉快',decoStyle:'ribbon'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#1b150e',bgColor2:'#2b2114',borderStyle:'solid',pattern:'waves'}),
      blk('clockbar',true,{text:'气压正读 · {{isotime}} · 航速 24 节 · 云层：薄',color:'#e0a458'}),
      blk('freehtml',true,{html:CHAPHD_HTML.replace('CHAPTER 01','VOYAGE 03').replace('雾起星坠城','跨越静默之海')+'\n\n'+INV_HTML.replace('🎒 行囊','🛠️ 随艇工具').replace('治疗药水','备用铆钉').replace('锈蚀的钥匙','黄铜气压计').replace('虚空棱镜','云图棱镜').replace('先王的冠冕','舰长怀表').replace('黑麦面包','硬质饼干').replace('藏宝图残页','航线图残页')}),
      blk('quote',true,{text:'人类征服天空的办法，是先学会对它客气。',source:'{{char}} 的航行手记'}),
      blk('dice',true,{label:'气压检定',expr:'2d6',style:'card'}),
      blk('randomevent',true,{title:'☁ 云上遭遇',pickMode:'one',
        lines:'一群候鸟改写了既定航线，甲板上落满羽毛\n齿轮塔的蒸汽在夜空里画出短暂的银线\n有乘客赌咒说看见了另一艘不该存在的飞艇\n静默之海的深处，传来一声悠长的钟响'}),
      blk('timeline',true,{title:'航线进度',nodes:'启航|港都雾散，满压升空|done\n静默之海|无风带，减速巡航|current\n彼岸|预计明日午前入港|lock'}),
      blk('freehtml',true,{html:RATE_HTML.replace('「看完第一章就没睡着过，世界观吊人得很。」','「平稳得像在自家客厅——只是窗外是两千米高的云。」').replace('—— 匿名旅人','—— 三等舱乘客留言')}),
      blk('greetings',true),
      blk('divider',true,{style:'wave'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'百鬼夜市·灯笼街',
    theme:{primary:'#2f3b52',accent:'#eb9546',textColor:'#fdf2e4',followTavern:false,fontName:'',radius:12,titleAlign:'center'},
    macros:[{k:'char',v:'面摊的狐娘'},{k:'user',v:'迷路的活人'}],
    blocks:[
      blk('welcome',true,{title:'百鬼夜市 · 灯笼街',subtitle:'丑时三刻开市 · 活人请跟紧 {{char}}',decoStyle:'ornate'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#10131c',bgColor2:'#1d2436',borderStyle:'dotted',pattern:'custom',patternText:'🏮 ☾ 🏮'}),
      blk('clockbar',true,{text:'丑时三刻 · {{isotime}} · 灯笼次第亮起',color:'#eb9546'}),
      blk('freehtml',true,{html:CHAT_HTML.replace('「早安——今天的风里有海的味道。」她把一杯还冒着热气的奶茶放在你手边。','「新烤的鲤鱼旗团子，三位一份——客人，你的影子在多看我一眼。」').replace('你连周一都能说出这种话，真是天赋。','那给你两位的价钱，让它别跟着我了。').replace('🎭','🦊').replace('🧑‍🚀','🏮')}),
      blk('freehtml',true,{html:INV_HTML.replace('🎒 行囊','🏮 夜市战利品').replace('治疗药水','妖怪面具').replace('锈蚀的钥匙','缠线护符').replace('虚空棱镜','鬼火灯笼').replace('先王的冠冕','玉响铃').replace('黑麦面包','狐狸团子').replace('藏宝图残页','旧祭典门票')}),
      blk('randomevent',true,{title:'🏮 今夜摊位',pickMode:'one',
        lines:'面具摊的老板没有脸，但笑起来很好听\n纸灯笼排成长队，自己走回摊位上睡觉\n卖伞的骷髅坚持这把伞能挡雨，也挡记忆\n桥那头的歌声一响，整条街的灯笼都转了过去'}),
      blk('dice',true,{label:'妖怪骰',expr:'1d100',style:'rpg'}),
      blk('greetings',true),
      blk('divider',true,{style:'dots'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'黄沙驿站·赏金正午',
    theme:{primary:'#6b5d43',accent:'#d9b36a',textColor:'#f5efdd',followTavern:false,fontName:'',radius:4,titleAlign:'left'},
    macros:[{k:'char',v:'驿站长老「铁掌」'},{k:'user',v:'过路客'}],
    blocks:[
      blk('welcome',true,{title:'黄沙驿站 · 正午',subtitle:'水比酒贵的地方，命比水贱——{{user}}，喝完这杯再上路',decoStyle:'stamp'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#1c1912',bgColor2:'#2b2517',borderStyle:'inset',pattern:'custom',patternText:'🌵 ☀ 🌵'}),
      blk('clockbar',true,{text:'日影偏西 · {{isotime}} · 驿车未到',color:'#d9b36a',align:'left'}),
      blk('freehtml',true,{html:QUEST_HTML.replace('🗡️ 冒险者公会 · 今日委托','🤠 驿站布告 · 悬赏榜').replace('清剿下水道的巨鼠群（已验收）','清剿红岩垭口的劫匪（已收队）').replace('寻找失踪商队的护卫，最后出现在旧城区','追捕「响尾」比尔，最后出现在北岔谷').replace('调查钟楼午夜传出的低语','护送周五的正午驿车过隘口').replace('💰 赏金合计 1200 金克朗 ｜ ⚠️ 逾期将扣除公会信用','💰 悬赏合计 1200 银元 ｜ ⚠️ 生死自负，驿站概不负责')+'\n\n'+CAL_HTML.replace('SEP','JUN').replace('开学典礼 · 大礼堂','正午驿车进站 · 装卸货').replace('社团招新 · 中庭','马匹钉掌 · 西棚').replace('天台 · 与{{char}}有约','日落 · 与{{char}}核对路线')}),
      blk('randomevent',true,{title:'🏜 酒馆传闻',pickMode:'one',
        lines:'北岔谷的井水一夜变咸，牛不肯喝\n有人用一枚金牙换了半壶水，没回头\n驿站的狗对着空地叫了半宿，天亮却只有风\n「响尾」的通缉令又贴回来一张，边角带着血'}),
      blk('dice',true,{label:'枪法检定',expr:'1d6',style:'poker'}),
      blk('timeline',true,{title:'赏金进度',nodes:'接榜|红岩垭口的名单已核实|done\n追击|蹄印指向北岔谷|current\n归案|带回驿站领赏|lock'}),
      blk('greetings',true,{cardStyle:'list'}),
      blk('divider',true,{style:'gradient-thick'}),
      blk('disclaimer',true),
    ],
  },
  {
    name:'雾港低语·深潜归航',
    theme:{primary:'#2c3f43',accent:'#a3c9a8',textColor:'#e8efe6',followTavern:false,fontName:'',radius:6,titleAlign:'center'},
    macros:[{k:'char',v:'守塔人「茧」'},{k:'user',v:'打捞员'}],
    blocks:[
      blk('welcome',true,{title:'雾角再次长鸣之夜',subtitle:'渔港 · 打捞队临时驻点 · 请勿应答雾里的桨声',decoStyle:'glitch'}),
      blk('decor',true,{bgType:'gradient',bgColor:'#101a1a',bgColor2:'#182527',borderStyle:'inset',pattern:'waves'}),
      blk('clockbar',true,{text:'涨潮 · {{isotime}} · 雾角长鸣',color:'#a3c9a8'}),
      blk('freehtml',true,{html:CHAPHD_HTML.replace('CHAPTER 01','NIGHT 01').replace('雾起星坠城','打捞「白鲸号」残骸')+'\n\n'+LETTER_HTML.replace('✉ FROM {{char}}','✉ 前船长遗留').replace('展信安。正文写在这里，每一行都会落在横线上。','雾散的第三夜，锚自己升了上来。').replace('风把窗帘吹起来的时候，我总会想起你。','别应答雾里的桨声——无论它喊谁的名字。').replace('—— {{char}} · 于某个雨夜','—— 前船长 · 最后一次出航前')}),
      blk('randomevent',true,{title:'🌊 雾中低语',pickMode:'one',
        lines:'捞起的货箱里全是湿的船长日志，墨迹还没干\n渔获的鱼眼睛都朝着同一个方向\n灯塔的光扫过海面时，多出一条影子\n有人数了数，靠岸的船员比出港时多了一个'}),
      blk('dice',true,{label:'理智检定',expr:'1d20',style:'rpg'}),
      blk('timeline',true,{title:'打捞进度',nodes:'定位|声呐确认「白鲸号」龙骨|done\n下潜|雾变浓了，绳索绷直|current\n起捞|货舱封条完好——这不正常|lock'}),
      blk('greetings',true),
      blk('divider',true,{style:'wave'}),
      blk('disclaimer',true),
    ],
  },
];

function defaultProject(name){
  return {
    id:uid(),name:name||'未命名工程',createdAt:new Date().toISOString(),
    marker:'【开场页】',
    theme:{primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',followTavern:false,
      fontName:'',radius:12,titleAlign:'center'},
    blocks:BLOCK_ORDER.map(t=>({type:t,enabled:CORE_TYPES.includes(t),...BLOCK_DEFS[t].create()})),
    macros:[{k:'char',v:'艾莉丝'},{k:'user',v:'旅行者'}],
    ai:{baseURL:'https://api.openai.com/v1',apiKey:'',model:'',models:[]},
    preview:{mode:'mobile',theme:'dark'},
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
};

/* ================================================================
 * 工具自身 UI 主题（顶栏下拉选择；CSS 端为 html[data-theme='id'] 令牌块）
 * ================================================================ */
const UI_THEMES=[
  {id:'bronze',   name:'暖铜金'},
  {id:'star',     name:'星夜'},
  {id:'blueprint',name:'蓝图'},
  {id:'crt',      name:'磷光'},
  {id:'abyss',    name:'深海'},
];

export {BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES, THEME_PRESETS, COMP_LIB, BUILTIN_TEMPLATES, BLOCK_PRESETS, defaultProject, UI_THEMES};

