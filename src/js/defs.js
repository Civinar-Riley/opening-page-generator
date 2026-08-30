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
  divider:{name:'分隔装饰线',icon:'➖',create:()=>({style:'diamond',text:''})},
  freehtml:{name:'自由 HTML 区',icon:'🧩',create:()=>({html:''})},
  bgm:{name:'音频/BGM 播放区',icon:'🎵',create:()=>({tracks:[{name:'示例曲目',url:''}],volume:50,loop:true,showTitle:true,title:'背景音乐',useTavernCmd:false})},
  fx:{name:'粒子动效区',icon:'💫',create:()=>({effect:'meteor',count:30,speed:1,opacity:0.8})},
  qa:{name:'问答折叠区',icon:'❓',create:()=>({title:'常见问题',showTitle:true,
    groups:[{name:'📖 基础设定',items:[{q:'这个世界的基本规则是什么？',a:'这里写世界观的基础规则说明……'},{q:'故事发生在什么时代？',a:'时代背景说明……'}]},{name:'🎭 角色相关',items:[{q:'主角的特殊能力是什么？',a:'能力设定说明……'}]}]})},
};
const BLOCK_ORDER=['welcome','decor','fx','quote','clockbar','randomevent','dice','profile','qa','gallery','bgm','greetings','divider','disclaimer','author','freehtml'];
/* 默认启用的核心区块；新区块默认关闭，由用户自行开启 */
const CORE_TYPES=['welcome','decor','profile','greetings','divider','disclaimer'];

/* ================================================================
 * 主题预设库：一键套用成品配色
 * ================================================================ */
const THEME_PRESETS=[
  {name:'紫夜幻金',theme:{primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',radius:12,titleAlign:'center'}},
  {name:'赛博朋克',theme:{primary:'#00e5ff',accent:'#ff2ea6',textColor:'#eaf6ff',radius:4,titleAlign:'center'}},
  {name:'和风樱语',theme:{primary:'#d97a8a',accent:'#f0c1bd',textColor:'#f7f0ea',radius:16,titleAlign:'center'}},
  {name:'暗金辉煌',theme:{primary:'#b8923e',accent:'#ffd700',textColor:'#f5ecd7',radius:8,titleAlign:'center'}},
  {name:'粉白甜梦',theme:{primary:'#ff7eb6',accent:'#ffc2dc',textColor:'#fff0f7',radius:20,titleAlign:'center'}},
  {name:'水墨青瓷',theme:{primary:'#4a7a8c',accent:'#9db8a0',textColor:'#ecefe9',radius:6,titleAlign:'left'}},
  {name:'森林秘境',theme:{primary:'#5da88a',accent:'#c9e4a5',textColor:'#eef5ea',radius:14,titleAlign:'center'}},
  {name:'血月暗红',theme:{primary:'#a8323e',accent:'#e0855c',textColor:'#f5e6e6',radius:6,titleAlign:'center'}},
  {name:'海洋之心',theme:{primary:'#2e86c1',accent:'#7fd4e8',textColor:'#e8f4fa',radius:12,titleAlign:'center'}},
  {name:'极简墨白',theme:{primary:'#6b7280',accent:'#d1d5db',textColor:'#f3f4f6',radius:2,titleAlign:'left'}},
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
];

function defaultProject(name){
  return {
    id:uid(),name:name||'未命名工程',createdAt:new Date().toISOString(),
    marker:'【开场页】',
    theme:{primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',followTavern:false,
      fontName:'',radius:12,titleAlign:'center'},
    blocks:BLOCK_ORDER.map(t=>({type:t,enabled:CORE_TYPES.includes(t),...BLOCK_DEFS[t].create()})),
    macros:[{k:'char',v:'艾莉丝'},{k:'user',v:'旅行者'}],
    ai:{baseURL:'https://api.openai.com/v1',apiKey:'',model:'',keyMode:'plain',keyEnc:''},
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

export {BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES, THEME_PRESETS, COMP_LIB, BUILTIN_TEMPLATES, BLOCK_PRESETS, defaultProject};

