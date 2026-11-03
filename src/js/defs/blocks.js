/* 区块类型定义：BLOCK_DEFS / BLOCK_ORDER / CORE_TYPES（defs.js 汇总出口，勿直接从 UI 引用） */

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
 * @property {Array<{url:string,cap:string}>} [pages] - 漫画页列表（comic）
 * @property {Array<{name:string,url:string}>} [tracks] - 曲目列表（bgm）
 * @property {Array<{name:string,items:Array<{q:string,a:string}>}>} [groups] - 问答分组（qa）
 */

/**
 * 主题配置
 * @typedef {Object} ThemeConfig
 * @property {string} primary - 主色
 * @property {string} accent - 强调色（标题/边框）
 * @property {string} textColor - 文字颜色
 * @property {boolean} followTavern - 跟随酒馆主题文字色（旧开关，向后兼容；等价 follow.text）
 * @property {{text:boolean,quote:boolean,font:boolean,em:boolean}} [follow] - 酒馆主题跟随项：正文/引用/字体/强调
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
  welcome:{name:'欢迎 / 标题区',icon:'✨',create:()=>({title:'欢迎来到 {{char}} 的世界',subtitle:'一段旅程，即将开始',decoStyle:'ornate',showEyebrow:false,eyebrow:'STORY OPENING'})},
  decor:{name:'装饰区',icon:'🎨',create:()=>({borderStyle:'double',pattern:'stars',patternText:'✦ ✧ ✦ ✧ ✦',topGlow:false})},
  profile:{name:'角色简介区',icon:'👤',create:()=>({showAvatar:true,showName:true,showDesc:true,showTags:true,avatarRound:true,
    characters:[{name:'{{char}}',desc:'这里显示角色简介，可添加多个角色。',tags:'女主角,神秘,温柔',avatar:'',avatarMode:'manual'}]})},
  disclaimer:{name:'免责声明区',icon:'⚠️',create:()=>({text:'本角色卡内容纯属虚构，由 AI 生成，仅供娱乐。',style:'collapse'})},
  greetings:{name:'开场白选择区',icon:'💌',create:()=>({cardStyle:'card',clickAction:'go',buttonText:'开始',titleWb:'',titleEntry:'开场白标题库',showTitle:false,title:'开场选择',showNames:true,excludedTags:'',entries:[],
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
  /* v1.9 新增区块（默认关闭）：更新日志 / 入场闸门 / 解码文本 / 命运卡池 / 连击彩蛋 / 模糊揭示 */
  changelog:{name:'更新日志区',icon:'🧾',create:()=>({showTitle:true,title:'📜 更新日志',
    lines:'v1.2｜2025-06-01｜新增两张地图与隐藏结局\nv1.1｜2025-05-20｜修复第三夜对话跳出的问题\nv1.0｜2025-05-01｜正式发布'})},
  gate:{name:'入场闸门',icon:'🚪',create:()=>({theme:'classic',title:'✦ 开始阅读 ✦',text:'故事即将展开——确定要推开这扇门吗？',buttonText:'点击进入',leaveText:'不，我未满18岁并离开',logo:'CHARACTER CARD'})},
  decode:{name:'解码文本区',icon:'🔎',create:()=>({lines:'信号接入中……\n身份确认：{{user}}\n欢迎回到深夜电台'})},
  gacha:{name:'命运卡池',icon:'🎴',create:()=>({title:'✦ 命运卡池 ✦',buttonText:'点击抽取',
    cards:'SSR｜命运之刃｜传闻只有命定之人才能拔出它\nSR｜月光斗篷｜在满月之夜隐去身形\nSR｜精灵指环｜古老的森林依然眷顾着佩戴者\nR｜旅人的水袋｜装着永远喝不完的清水\nR｜旧铜钥匙｜能打开某扇被遗忘的门\nN｜一撮烟尘｜除了呛人一无是处'})},
  egg:{name:'连击彩蛋',icon:'🥚',create:()=>({hint:'✦',count:5,
    lines:'「……你为什么一直点我？」\n「好啦好啦，有个秘密告诉你——其实我很喜欢 {{user}}。」'})},
  blurreveal:{name:'模糊揭示区',icon:'🌫️',create:()=>({showTitle:false,title:'🌫️ 逐段揭示',hint:'点击显示',
    lines:'你在旧书页里发现了一张夹着的字条，字迹被水洇开了大半——\n「别相信第七夜的雨声，那不是雨。」\n落款被撕掉了，只留下半个像「{{char}}」开头的签名。'})},
  /* v1.14 新增区块（默认关闭）：漫画阅读器——点击封面/横幅打开全屏阅读器 */
  comic:{name:'漫画阅读器',icon:'📚',create:()=>({entry:'cover',mode:'strip',title:'第 1 话',cover:'',buttonText:'📖 点击阅读漫画',
    pages:[{url:'',cap:''}]})},
};
const BLOCK_ORDER=['welcome','decor','fx','quote','clockbar','randomevent','dice','countdown','timeline','profile','qa','gallery','bgm','greetings','divider','disclaimer','author','freehtml','changelog','gate','decode','gacha','egg','blurreveal','comic'];
/* 默认启用的核心区块；新区块默认关闭，由用户自行开启 */
const CORE_TYPES=['welcome','decor','profile','greetings','divider','disclaimer'];

export {BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES};
