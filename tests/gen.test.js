/* 生成引擎单元测试（纯字符串函数，无需 DOM） */
import { describe, it, expect } from 'vitest';
import { Gen } from '../src/js/gen/index.js';
import { defaultProject, BLOCK_PRESETS, BLOCK_DEFS, applyBlockPreset, syncGateThemeCopy } from '../src/js/defs.js';

const proj=blocks=>{const p=defaultProject('t');p.blocks=blocks;return p};
const stripSlashes=s=>s.replace(/^\//,'').replace(/\/$/,'');

describe('Gen.regexScript 标记正则',()=>{
  it('默认标记生成可解析且可匹配的 findRegex',()=>{
    const rx=Gen.regexScript(defaultProject('t'));
    const pat=stripSlashes(rx.findRegex);
    expect(()=>new RegExp(pat)).not.toThrow();
    expect(new RegExp(pat).test('前言【开场页】后记')).toBe(true);
  });
  it('标记含 / 时仍生成合法正则并可匹配',()=>{
    const p=defaultProject('t');p.marker='开/场·页';
    const rx=Gen.regexScript(p);
    const pat=stripSlashes(rx.findRegex);
    expect(()=>new RegExp(pat)).not.toThrow();
    expect(new RegExp(pat).test('xx开/场·页yy')).toBe(true);
  });
});

describe('Gen.build 转义与宏',()=>{
  it('divider 自定义文字被转义（预览与导出）',()=>{
    const b={type:'divider',enabled:true,style:'plain',text:'<b>x</b>'};
    for(const opts of [{isPreview:true},{isPreview:false}]){
      const html=Gen.build(proj([b]),opts);
      expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
      expect(html).not.toContain('<b>x</b>');
    }
  });
  it('随机事件「全部显示」预览行转义、导出保留宏与原文',()=>{
    const b={type:'randomevent',enabled:true,showTitle:false,pickMode:'line',lines:'<i>危</i>\n正常行'};
    expect(Gen.build(proj([b]),{isPreview:true})).toContain('&lt;i&gt;危&lt;/i&gt;');
    const exp=Gen.build(proj([{...b,lines:'<i>危</i>\n{{getvar::k}}'}]),{isPreview:false});
    expect(exp).toContain('<i>危</i>');
    expect(exp).toContain('{{getvar::k}}');
  });
  it('profile 头像 URL 预览替换宏、导出保留宏',()=>{
    const p=proj([{type:'profile',enabled:true,showAvatar:true,avatarRound:true,
      characters:[{name:'{{char}}',desc:'',tags:'',avatar:'https://x/{{user}}.png'}]}]);
    p.macros=[{k:'char',v:'艾莉丝'},{k:'user',v:'旅人'}];
    expect(Gen.build(p,{isPreview:true})).toContain('src="https://x/旅人.png"');
    expect(Gen.build(p,{isPreview:false})).toContain('src="https://x/{{user}}.png"');
  });
  it('qa showTitle=false 不输出标题文字',()=>{
    const html=Gen.build(proj([{type:'qa',enabled:true,showTitle:false,title:'常见问题',groups:[]}]),{isPreview:true});
    expect(html).not.toContain('常见问题');
  });
  it('qa showTitle=true 且标题为空回退「常见问题」',()=>{
    const html=Gen.build(proj([{type:'qa',enabled:true,showTitle:true,title:'',groups:[]}]),{isPreview:true});
    expect(html).toContain('常见问题');
  });
  it('bgm 首曲目名预览替换宏',()=>{
    const p=proj([{type:'bgm',enabled:true,tracks:[{name:'{{char}}之歌',url:'https://x/a.mp3'}],volume:50,loop:true,showTitle:false,title:'',useTavernCmd:false}]);
    p.macros=[{k:'char',v:'艾莉丝'}];
    expect(Gen.build(p,{isPreview:true})).toContain('艾莉丝之歌');
    expect(Gen.build(p,{isPreview:false})).toContain('{{char}}之歌');
  });
});

describe('Gen.build 粒子动效',()=>{
  it('粒子携带 --op 变量且 keyframes 按 --op 乘算透明度',()=>{
    const html=Gen.build(proj([{type:'fx',enabled:true,effect:'snow',count:5,speed:1,opacity:.42}]),{isPreview:false});
    expect(html).toContain("setProperty('--op'");
    expect(html).toContain('var(--op,1)');
    expect(html).toContain('data-opacity="0.42"');
  });
  it('音符粒子使用较大字号（note 分支设置 --s，随机 12-22px）',()=>{
    const html=Gen.build(proj([{type:'fx',enabled:true,effect:'note',count:5,speed:1,opacity:.8}]),{isPreview:false});
    expect(html).toMatch(/type==='note'\)\{p\.textContent=notes\[[^\]]*\];p\.style\.setProperty\('--s',\(12\+Math\.random\(\)\*10\)\+'px'\)/);
  });
  it('BGM 多音源失效时有失败计数封顶（防 error→next 无限重试）',()=>{
    const html=Gen.build(proj([{type:'bgm',enabled:true,tracks:[{name:'a',url:'a.mp3'},{name:'b',url:'b.mp3'}]}]),{isPreview:false});
    expect(html).toContain('errCount');
    expect(html).toMatch(/errCount<sources\.length/);
  });
  it('时间线描述含 | 时末段白名单判定状态、中间段并回描述',()=>{
    const html=Gen.build(proj([{type:'timeline',enabled:true,showTitle:true,title:'进度',nodes:'第二章|遭遇战|险胜|current\n第三章|描述|含|竖线'}]),{isPreview:false});
    expect(html).toContain('tl-current');
    expect(html).toContain('遭遇战|险胜');
    expect(html).toContain('tl-lock');
    expect(html).toContain('描述|含|竖线');
  });
});

describe('Gen.build 角色简介折叠',()=>{
  const chars=n=>Array.from({length:n},(_,i)=>({name:'角色'+(i+1),desc:'简介'+(i+1),tags:'标签'+(i+1),avatar:''}));
  const prof=n=>proj([{type:'profile',enabled:true,showAvatar:true,showName:true,showDesc:true,showTags:true,avatarRound:true,characters:chars(n)}]);
  it('≤2 个角色保持完整卡片（无折叠）',()=>{
    const html=Gen.build(prof(2),{isPreview:true});
    expect(html).not.toMatch(/-profc"/);
    expect((html.match(/-profile"/g)||[]).length).toBe(2);
    expect(html).toContain('角色2');
  });
  it('>2 个角色折叠为名字列表，点击名字展开完整卡片',()=>{
    const html=Gen.build(prof(3),{isPreview:true});
    expect((html.match(/-profc"/g)||[]).length).toBe(3);
    expect(html).toContain('<summary');
    expect(html).toContain('角色3');
    /* 折叠模式不再输出旧版 flex 卡片 */
    expect(html).not.toMatch(/-profile"/);
    /* 展开内容（简介/标签）保留在 details 内 */
    expect(html).toContain('简介3');
    expect(html).toContain('-pbody');
  });
  it('折叠模式导出同样生效且宏原样保留',()=>{
    const p=proj([{type:'profile',enabled:true,showAvatar:false,showName:true,showDesc:true,showTags:false,avatarRound:true,
      characters:[{name:'{{char}}',desc:'d1',tags:'',avatar:''},{name:'x',desc:'d2',tags:'',avatar:''},{name:'y',desc:'d3',tags:'',avatar:''}]}]);
    p.macros=[{k:'char',v:'艾莉丝'}];
    const exp=Gen.build(p,{isPreview:false});
    expect(exp).toContain('<details');
    expect(exp).toContain('{{char}}');
    const prev=Gen.build(p,{isPreview:true});
    expect(prev).toContain('艾莉丝');
  });
  it('折叠模式显示标签与头像标记',()=>{
    const html=Gen.build(prof(3),{isPreview:true});
    expect(html).toContain('-ptag');
  });
});

describe('Gen.build 骰子区转义',()=>{
  it('dice label 被转义（预览与导出）',()=>{
    const b={type:'dice',enabled:true,label:'危<b>险</b>',expr:'1d20',style:'card'};
    for(const opts of [{isPreview:true},{isPreview:false}]){
      const html=Gen.build(proj([b]),opts);
      expect(html).toContain('危&lt;b&gt;险&lt;/b&gt;');
      expect(html).not.toContain('危<b>险</b>');
    }
  });
});

describe('Gen.build 倒计时区',()=>{
  it('输出 data-target 与内联脚本，完成文案被转义',()=>{
    const b={type:'countdown',enabled:true,title:'倒计时',target:'2027-01-01T00:00',doneText:'<b>开始</b>'};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('data-target="2027-01-01T00:00"');
    expect(html).toContain('data-done="&lt;b&gt;开始&lt;/b&gt;"');
    expect(html).toContain('setInterval(tick,1000)');
  });
  it('未设置目标时间时给出占位提示',()=>{
    const html=Gen.build(proj([{type:'countdown',enabled:true,title:'',target:'',doneText:''}]),{isPreview:false});
    expect(html).toContain('⚠️ 未设置目标时间');
  });
});

describe('Gen.build 时间线区',()=>{
  it('节点状态类名正确，未知/缺省状态回退 lock',()=>{
    const b={type:'timeline',enabled:true,showTitle:true,title:'进度',nodes:'A|d1|done\nB|d2|current\nC|d3|其它\nD|d4'};
    const html=Gen.build(proj([b]),{isPreview:true});
    expect(html).toContain('-tl-done');
    expect(html).toContain('-tl-current');
    expect(html).toContain('-tl-lock');
    expect(html).toContain('d1');
  });
  it('预览替换宏、导出保留宏',()=>{
    const b={type:'timeline',enabled:true,showTitle:false,nodes:'{{char}}|简介|done'};
    const p=proj([b]);p.macros=[{k:'char',v:'艾莉丝'}];
    expect(Gen.build(p,{isPreview:true})).toContain('艾莉丝');
    expect(Gen.build(p,{isPreview:false})).toContain('{{char}}');
  });
});

describe('Gen.build 边界与安全回归',()=>{
  it('null 字段导出不崩溃且不输出 "undefined"（normalize 只补 undefined 不补 null）',()=>{
    const b={type:'greetings',enabled:true,cardStyle:'card',clickAction:'go',buttonText:'开始',titleWb:'',titleEntry:'',placeholderList:null};
    expect(()=>Gen.build(proj([b]),{isPreview:false})).not.toThrow();
    const b2={type:'clockbar',enabled:true,text:null,color:'#87CEEB',size:15,align:'center',glow:true};
    const html2=Gen.build(proj([b2]),{isPreview:false});
    expect(html2).not.toContain('"undefined"');
    expect(html2).not.toContain('"null"');
  });
  it('bgm 音量 0 不被兜底吞成 50（falsy-0 回归）',()=>{
    const b={type:'bgm',enabled:true,tracks:[{name:'x',url:'https://x/a.mp3'}],volume:0,loop:true,showTitle:false,title:'',useTavernCmd:false};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('value="0"');
  });
  it('randomevent one 模式导出行内 }} 不破坏 {{random}} 宏',()=>{
    const b={type:'randomevent',enabled:true,showTitle:false,pickMode:'one',lines:'结果{{x}}尾'};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).not.toMatch(/\{\{random::[^}]*\}\}\}\}/);
    expect(html).toContain('⎬⎬');
  });
  it('正文含 ``` 时 fencedFullDoc 升级四反引号围栏',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');
    fb.enabled=true;fb.html='<div>```code```</div>';
    const f=Gen.fencedFullDoc(p);
    expect(f.startsWith('````\n')).toBe(true);
    expect(f.endsWith('\n````')).toBe(true);
    /* 无 ``` 时保持三反引号 */
    fb.enabled=false;
    expect(Gen.fencedFullDoc(p).startsWith('```\n')).toBe(true);
  });
  it('fontName 含 </style> 时不逃逸 style 标签',()=>{
    const p=defaultProject('t');
    p.theme.fontName='x";}</style><img src=x>';
    const html=Gen.build(p,{isPreview:false});
    expect(html).not.toContain('</style><img');
  });
  it('decor 背景图 URL 与自定义花纹含 </style> 时不逃逸 style 标签',()=>{
    const p=defaultProject('t');
    const d=p.blocks.find(b=>b.type==='decor');
    d.enabled=true;d.bgType='image';d.bgImage='x</style><img src=x onerror=alert(1)>';
    d.pattern='custom';d.patternText='✦</style><img src=x>';
    const html=Gen.build(p,{isPreview:false});
    expect(html).not.toContain('</style><img');
  });
  it('theme.radius 非数值/超界时钳制到 0-40（防 CSS 注入）',()=>{
    const p=defaultProject('t');
    p.theme.radius='12px;background:url(x)';
    expect(Gen.build(p,{isPreview:false})).not.toContain('background:url(x)');
    p.theme.radius=999;
    expect(Gen.build(p,{isPreview:false})).toContain('border-radius:40px');
  });
});

describe('Gen.auditFullDoc 导出自检',()=>{
  it('正常产物零阻断，opg- 容器前缀存在',()=>{
    const a=Gen.auditFullDoc(Gen.buildFullDoc(defaultProject('t')));
    expect(a.ok).toBe(true);
    expect(a.problems.filter(x=>x.level==='阻断')).toHaveLength(0);
  });
  it('缺 body 标签判阻断；无 opg- 前缀判提示',()=>{
    const a=Gen.auditFullDoc('<html><body>x</body></html>');
    expect(a.ok).toBe(true);
    expect(a.problems.some(x=>x.level==='提示'&&/opg-/.test(x.msg))).toBe(true);
    const b=Gen.auditFullDoc('<html>x</html>');
    expect(b.ok).toBe(false);
    expect(b.problems[0].level).toBe('阻断');
   });
  it('内联脚本闭合标签数量不一致判阻断（未转义逃逸/缺失）',()=>{
    const good=Gen.auditFullDoc(Gen.buildFullDoc(defaultProject('t')));
    expect(good.ok).toBe(true);
    /* 多塞一个裸 </script>：模拟脚本字符串未转义逃逸（提前闭合外层标签） */
    const bad=Gen.buildFullDoc(defaultProject('t')).replace('</body>','</script></body>');
    const b=Gen.auditFullDoc(bad);
    expect(b.ok).toBe(false);
    expect(b.problems.some(x=>x.level==='阻断'&&/script/.test(x.msg))).toBe(true);
  });
  it('体积超 20 万字符判提示（不阻断）',()=>{
    const doc=Gen.buildFullDoc(defaultProject('t'))+' '.repeat(200000);
    const a=Gen.auditFullDoc(doc);
    expect(a.ok).toBe(true);
    expect(a.problems.some(x=>x.level==='提示'&&/超长/.test(x.msg))).toBe(true);
  });
  it('正文含 ``` 时给出四反引号长围栏提示（不阻断）',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');
    fb.enabled=true;fb.html='<div>```code```</div>';
    const a=Gen.auditFullDoc(Gen.buildFullDoc(p));
    expect(a.ok).toBe(true);
    expect(a.problems.some(x=>x.level==='提示'&&/四反引号/.test(x.msg))).toBe(true);
  });
});

describe('Gen.auditCompat 兼容审查',()=>{
  it('正常工程（默认标记/无自由 HTML）零提示',()=>{
    expect(Gen.auditCompat(defaultProject('t')).items).toHaveLength(0);
  });
  it('标记含 / 判一条提示',()=>{
    const p=defaultProject('t');
    p.marker='开/场·页';
    const items=Gen.auditCompat(p).items;
    expect(items.some(x=>/含 \//.test(x.msg))).toBe(true);
  });
  it('自由 HTML 弯引号判提示',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');
    fb.enabled=true;fb.html='<div>他说“你好”</div>';
    const items=Gen.auditCompat(p).items;
    expect(items.some(x=>/弯引号/.test(x.msg))).toBe(true);
    const fb2=p.blocks.find(b=>b.type==='freehtml');
    fb2.html='<div>"直引号没问题"</div>';
    expect(Gen.auditCompat(p).items.some(x=>/弯引号/.test(x.msg))).toBe(false);
  });
  it('maxDepth/minDepth 进入正则导出；scriptName 带启用提示',()=>{
    const p=defaultProject('t');
    const rx=Gen.regexScript(p,{maxDepth:0});
    expect(rx.maxDepth).toBe(0);
    expect(rx.minDepth).toBeNull();
    expect(rx.scriptName).toContain('导入后启用');
    const rx2=Gen.regexScript(p,{});
    expect(rx2.maxDepth).toBeNull();
  });
  it('自由 HTML 捕获组>15 / 重复 id 判提示',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');
    fb.enabled=true;
    fb.html='<div id="x1"></div><div id="x1"></div>';
    expect(Gen.auditCompat(p).items.some(x=>/重复 id/.test(x.msg))).toBe(true);
    const many=Array.from({length:16},(_,i)=>'(组'+i+')').join('');
    fb.html='<div>'+many+'</div>';
    expect(Gen.auditCompat(p).items.some(x=>/捕获组约 16 个/.test(x.msg))).toBe(true);
    expect(Gen.auditCompat(p).items.some(x=>/捕获组约 16 个/.test(x.msg))).toBe(true);
  });
  it('自由 HTML 区块启用判提示（全权限警示）',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');
    fb.enabled=true;fb.html='<div>x</div>';
    const items=Gen.auditCompat(p).items;
    expect(items.some(x=>/自由 HTML/.test(x.msg))).toBe(true);
  });
});

describe('Gen.build greetings 按钮模式（序号跳转）',()=>{
  it('clickAction=button 时产物含按钮注册代码与序号输入校验文案，按钮名来自 buttonText',()=>{
    const b={type:'greetings',enabled:true,clickAction:'button',cardStyle:'card',buttonText:'跳转开局',titleWb:'',titleEntry:'',placeholderList:'开场一\n开场二'};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('appendInexistentScriptButtons');
    expect(html).toContain('getButtonEvent');
    expect(html).toContain('callGenericPopup');
    expect(html).toContain('跳转开局');
    expect(html).toContain('未填入有效开局号');
    expect(html).toContain('从 1 开始');
  });
  it('注册段被 ACT 运行时门控（非 button 模式不执行注入，代码仍随产物输出）',()=>{
    const html=Gen.build(proj([{type:'greetings',enabled:true,clickAction:'go',cardStyle:'card',buttonText:'开始',titleWb:'',titleEntry:'',placeholderList:'a'}]),{isPreview:false});
    /* 模板常量在两种模式都输出，靠运行时 ACT 门控——断言门控存在且按钮名不来自本例的 buttonText */
    expect(html).toContain("if(ACT==='button')");
    expect(html).toContain('var BTN="开始"');
    expect(html).not.toContain('var BTN="跳转开局"');
  });
  it('按钮模式与 go 同一条 goGreeting 映射路径（产物含 setChatMessages 切换与卡映射）',()=>{
    const b={type:'greetings',enabled:true,clickAction:'button',cardStyle:'card',buttonText:'x',titleWb:'',titleEntry:'',placeholderList:'a'};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('goGreeting');
    expect(html).toContain('setChatMessages');
    expect(html).toContain('getChatMessages');
  });
});

describe('Gen.build greetings 中文数字序号与箭头',()=>{
  const g3={type:'greetings',enabled:true,clickAction:'go',cardStyle:'card',buttonText:'开始',titleWb:'',titleEntry:'',placeholderList:'宁静的清晨｜晨光洒进房间\n雨夜的邂逅｜一场大雨\n命运的转折'};
  it('占位列表项含壹贰叁中文数字徽标与 gmain 包裹，箭头由 CSS ::after 输出',()=>{
    for(const opts of [{isPreview:true},{isPreview:false}]){
      const html=Gen.build(proj([g3]),opts);
      expect(html).toContain('-gnum">壹</span>');
      expect(html).toContain('-gnum">贰</span>');
      expect(html).toContain('-gnum">叁</span>');
      expect(html).toContain('-gmain');
      expect(html).toContain('-gtitle">宁静的清晨</span>');
      expect(html).toContain('-gdesc">晨光洒进房间</span>');
      expect(html).toContain('content:"→"');
      expect(html).toContain('-gcur::after');
    }
  });
  it('超过 10 条回落阿拉伯数字',()=>{
    const items=Array.from({length:11},(_,i)=>'开场白'+(i+1)).join('\n');
    const html=Gen.build(proj([{...g3,placeholderList:items}]),{isPreview:true});
    expect(html).toContain('-gnum">拾</span>');
    expect(html).toContain('-gnum">11</span>');
  });
  it('运行时脚本按同一结构重绘（GNUM 常量 + gnum/gmain 节点），标题不再拼阿拉伯序号前缀',()=>{
    const html=Gen.build(proj([g3]),{isPreview:false});
    expect(html).toContain("var GNUM='壹贰叁肆伍陆柒捌玖拾'");
    expect(html).toContain("PX+'-gnum'");
    expect(html).toContain("PX+'-gmain'");
    expect(html).not.toContain("(i+1)+'. '");
  });
});

describe('Gen.build greetings 封面墙/排除标签/人名/联动音轨（v1.11.0）',()=>{
  const gBase={type:'greetings',enabled:true,clickAction:'go',cardStyle:'card',buttonText:'开始',titleWb:'',titleEntry:'',showNames:true,excludedTags:'',entries:[],placeholderList:'宁静的清晨｜晨光洒进房间\n雨夜的邂逅｜一场大雨'};
  it('wall：占位渲染封面图 + 渐变回落垫底 + 序号徽标，无封面项露出占位水印',()=>{
    const b={...gBase,cardStyle:'wall',entries:[{cover:'https://x/1.png',audio:''},{cover:'',audio:''}]};
    const html=Gen.build(proj([b]),{isPreview:true});
    expect(html).toContain('-gwallitem');
    expect(html).toContain('-gcover" src="https://x/1.png"');
    expect(html).toContain("onerror=\"this.style.display='none'\"");
    expect(html).toContain('-gcoverph');
    expect(html).toContain('-gphnum">贰</span>');
    expect(html).toContain('-gnum">壹</span>');
  });
  it('wall：CSS 网格/16:9 封面/430px 两列断点/reduced-motion 兜底，且左缘竖条外挂不再作用于 wall',()=>{
    const html=Gen.build(proj([{...gBase,cardStyle:'wall'}]),{isPreview:true});
    expect(html).toContain('repeat(auto-fill,minmax(160px,1fr))');
    expect(html).toContain('aspect-ratio:16/9');
    expect(html).toContain('@media(max-width:430px)');
    expect(html).toContain('linear-gradient(160deg');
    expect(html).not.toContain('-gitem::before{content:"";position:absolute;top:0;left:0;width:3px');
    const motionless=Gen.build(proj([{...gBase,cardStyle:'wall'}]),{isPreview:true});
    expect(motionless).toContain('prefers-reduced-motion:reduce');
  });
  it('card/list 样式不受影响（左缘竖条仍属 card，list 保持竖线行）',()=>{
    const card=Gen.build(proj([{...gBase,cardStyle:'card'}]),{isPreview:true});
    expect(card).toContain('-gitem::before{content:"";position:absolute;top:0;left:0;width:3px');
    const list=Gen.build(proj([{...gBase,cardStyle:'list'}]),{isPreview:true});
    expect(list).toContain('border-left:3px solid');
    expect(list).not.toContain('-gcoverph');
  });
  it('占位行第三段作人物名渲染 gnames；两段行行为与旧版一致',()=>{
    const html=Gen.build(proj([{...gBase,placeholderList:'晨光｜新的一天｜林晚\n雨夜｜相遇'}]),{isPreview:true});
    expect(html).toContain('-gnames">林晚</span>');
    expect(html).toContain('-gtitle">晨光</span>');
    expect(html).toContain('-gdesc">新的一天</span>');
    expect(html).toContain('-gdesc">相遇</span>');
    expect(html).not.toContain('-gnames">相遇');
  });
  it('排除标签 gen 侧解析注入 TAGS（全角逗号/顿号切分、剥 <> 前后缀、非法项过滤、去重），运行时 extractTitleDesc 先剥除',()=>{
    const b={...gBase,excludedTags:'status, 设定，<world>、;;bad tag!'};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('var TAGS=["status","设定","world"]');
    expect(html).toContain('text=stripTags(text)');
    expect(html).toContain("new RegExp('<'+tag+'(\\\\s[^<>]*)?>[\\\\s\\\\S]*?<\\\\/'+tag+'\\\\s*>','gi')");
  });
  it('人名提取：运行时含 extractNames 与 gnames 渲染分支，showNames 开关注入 NAMES',()=>{
    const on=Gen.build(proj([{...gBase}]),{isPreview:false});
    expect(on).toContain('function extractNames');
    expect(on).toContain("PX+'-gnames'");
    expect(on).toContain('NAMES=true');
    const off=Gen.build(proj([{...gBase,showNames:false}]),{isPreview:false});
    expect(off).toContain('NAMES=false');
  });
  it('切换校验：setChatMessages 后重读第 0 楼，不符弹「消息页未切换」；按钮模式序号直传卡索引（修复双重映射）',()=>{
    const html=Gen.build(proj([gBase]),{isPreview:false});
    expect(html).toContain('消息页未切换，请重试');
    expect(html).toContain('await goGreeting(n-1)');
    expect(html).not.toContain('d.map?d.map[n-1]');
  });
  it('联动音轨：META 注入 + 宿主文档挂载标记 + 穿透与降级结构',()=>{
    const b={...gBase,entries:[{cover:'',audio:'https://x/a.mp3'},{cover:'',audio:''}]};
    const html=Gen.build(proj([b]),{isPreview:false});
    expect(html).toContain('META=[{"cover":"","audio":"https://x/a.mp3"},{"cover":"","audio":""}]');
    expect(html).toContain('data-opg-greet-audio');
    expect(html).toContain('function hostDoc()');
    expect(html).toContain('w.parent.document');
    expect(html).toContain('playGreetAudio(i)');
    expect(html).toContain('stopGreetAudio()');
  });
  it('行为验证：stripTags 剥除 / extractNames 三层启发式 / 楼内降级音频建立与停止',async()=>{
    const b={...gBase,cardStyle:'wall',excludedTags:'status',entries:[{cover:'',audio:'https://x/a.mp3'}],placeholderList:'a'};
    const code=Gen.build(proj([b]),{isPreview:false}).match(/<script>([\s\S]*?)<\/script>/)[1];
    const start=code.indexOf('(function(){'),li=code.lastIndexOf('})();');
    /* 开头接 IIFE 返回值与尾部挂载须用不同变量：返回值 undefined 会覆盖尾部挂载 */
    const probe='globalThis.__iife=(function(){'+code.slice(start+'(function(){'.length,li)+'globalThis.__f={stripTags,extractNames,playGreetAudio,hostDoc};})();';
    const doc={hidden:false,querySelector:()=>null,getElementById:()=>({querySelector:()=>null,addEventListener(){},setAttribute(){}}),addEventListener(){},body:null};
    const created=[];
    doc.createElement=tag=>{const el={tag,style:{},attrs:{},src:'',loop:false,parentNode:null,play:()=>Promise.resolve(),pause(){},setAttribute:(k,v)=>{el.attrs[k]=v},getAttribute:k=>el.attrs[k]};created.push(el);return el};
    doc.body={appendChild:el=>{el.parentNode=doc.body},removeChild:el=>{el.parentNode=null}};
    const {document:origDoc,window:origWin,setInterval:origSi}=globalThis;
    globalThis.document=doc;globalThis.window={document:doc};globalThis.setInterval=()=>0;
    try{
      new Function(probe)();
      const f=globalThis.__f;
      expect(f.stripTags('<status>情绪：平静</status>正文开始<status/>')).toBe(' 正文开始 ');
      expect(f.stripTags('</status>半截闭标签正文')).toBe(' 半截闭标签正文');
      expect(f.stripTags('普通文本')).toBe('普通文本');
      expect(f.extractNames('姓名：林晚\n<角色名>沈之衍</角色名>\n时间：清晨\n林晚：你来了。')).toEqual(['林晚','沈之衍']);
      expect(f.extractNames('没有名字的普通文本')).toEqual([]);
      expect(f.hostDoc()).toBe(doc);
      f.playGreetAudio(0);
      expect(created.length).toBe(1);
      expect(created[0].attrs['data-opg-greet-audio']).toBe('');
      expect(created[0].src).toBe('https://x/a.mp3');
      f.playGreetAudio(5);
      expect(created[0].parentNode).toBe(null);
      /* 让 IIFE 尾部 loadTitleMap().then(loadGreetings) 的微任务链在 stub 还原前排空 */
      await new Promise(r=>setTimeout(r,0));
    }finally{globalThis.document=origDoc;globalThis.window=origWin;globalThis.setInterval=origSi}
  });
});

describe('Gen.build 视觉细节升级（入场动效/选区/灯箱/倒计时/流光）',()=>{
  it('全局包：入场渐显 stagger + ::selection/焦点主题化 + 全局 reduced-motion 豁免',()=>{
    const html=Gen.build(proj([{type:'divider',enabled:true,style:'plain'}]),{isPreview:false});
    expect(html).toContain('-in{from{opacity:0;transform:translateY(8px)}');
    expect(html).toContain('animation-delay');
    expect(html).toContain('::selection');
    expect(html).toContain(':focus-visible');
    expect(html).toContain('prefers-reduced-motion');
    expect(html).toContain('animation:none!important');
  });
  it('灯箱开合动效与倒计时完成 pop',()=>{
    const html=Gen.build(proj([
      {type:'gallery',enabled:true,cols:'3',images:[{url:'x.png',cap:'a'}]},
      {type:'countdown',enabled:true,title:'t',target:'2030-01-01T00:00:00',doneText:'到'},
    ]),{isPreview:false});
    expect(html).toContain('lbfade');
    expect(html).toContain('scale(.96)');
    expect(html).toContain('cd-pop');
  });
  it('divider 流光样式输出巡游光点',()=>{
    const html=Gen.build(proj([{type:'divider',enabled:true,style:'glow',text:''}]),{isPreview:false});
    expect(html).toContain('hrglow');
    expect(html).toContain('radial-gradient(ellipse');
  });
});

describe('Gen.build 参考图新增四项（眉题/卡片作者/小节标题/顶部光带）',()=>{
  it('welcome 眉题：开启输出、默认关闭不输出',()=>{
    const on=Gen.build(proj([{type:'welcome',enabled:true,showEyebrow:true,eyebrow:'STORY OPENING',title:'T',subtitle:'S',decoStyle:'none'}]),{isPreview:true});
    expect(on).toContain('-eyebrow">STORY OPENING');
    const off=Gen.build(proj([{type:'welcome',enabled:true,title:'T',subtitle:'S',decoStyle:'none'}]),{isPreview:true});
    expect(off).not.toContain('-eyebrow">');
  });
  it('author 卡片式：左竖线卡片 + 小标题 + 正文容器',()=>{
    const html=Gen.build(proj([{type:'author',enabled:true,style:'card',text:'hi'}]),{isPreview:false});
    expect(html).toContain('-authc');
    expect(html).toContain('💬 作者的话');
    expect(html).toContain('-authb">hi');
  });
  it('greetings 小节标题：开启输出、默认关闭不输出',()=>{
    const base={type:'greetings',enabled:true,cardStyle:'card',clickAction:'go',buttonText:'开始',titleWb:'',titleEntry:'',placeholderList:'a'};
    const on=Gen.build(proj([{...base,showTitle:true,title:'开场选择'}]),{isPreview:true});
    expect(on).toContain('-ghead">开场选择');
    const off=Gen.build(proj([base]),{isPreview:true});
    expect(off).not.toContain('-ghead">');
  });
  it('decor 顶部光带：开启输出 border-top 亮线、默认关闭不输出',()=>{
    const base={type:'decor',enabled:true,borderStyle:'none',bgType:'solid',bgColor:'#101018',bgColor2:'',bgImage:'',pattern:'none',patternText:''};
    const on=Gen.build(proj([{...base,topGlow:true}]),{isPreview:false});
    expect(on).toContain('border-top:2px solid');
    const off=Gen.build(proj([base]),{isPreview:false});
    expect(off).not.toContain('border-top:2px');
  });
});

describe('Gen.build 主题动效档位与标题字体',()=>{
  const mk=t=>{const p=proj([{type:'divider',enabled:true,style:'plain'},{type:'greetings',enabled:true,placeholderList:'a'}]);p.theme.motion=t;return p};
  it('motion=off：不产出入场动画 keyframes，流光/入场回落静态',()=>{
    const html=Gen.build(mk('off'),{isPreview:false});
    expect(html).toContain('-wrap>div>*{animation:none}');
    expect(html).not.toContain('@keyframes');
  });
  it('motion=soft：入场只淡入（无位移）',()=>{
    const html=Gen.build(mk('soft'),{isPreview:false});
    expect(html).toContain('-in{from{opacity:0}}');
    expect(html).not.toContain('translateY(8px)');
  });
  it('headingFont：sanitize 后作用于标题位，空则不输出规则',()=>{
    const p=proj([{type:'welcome',enabled:true,title:'T',subtitle:'S'}]);
    p.theme.headingFont='Noto<Script> "Serif"';
    const html=Gen.build(p,{isPreview:false});
    expect(html).toContain('"NotoScript Serif"');
    expect(html).not.toContain('<Script>');
    const p2=proj([{type:'welcome',enabled:true,title:'T',subtitle:'S'}]);
    p2.theme.headingFont='';
    expect(Gen.build(p2,{isPreview:false})).not.toContain('-title,.');
  });
});

describe('Gen.build 新增五区块（更新日志/闸门/解码/卡池/彩蛋）',()=>{
  it('默认工程产物不含新区块 DOM（默认停用不渲染）',()=>{
    const html=Gen.build(defaultProject('t'),{isPreview:false});
    expect(html).not.toContain('-gatecover');
    expect(html).not.toContain('-gcard');
    expect(html).not.toContain('-decl">');
    expect(html).not.toContain('-clrow');
    expect(html).not.toContain('-egg"');
  });
  it('changelog：版本|日期|内容解析，多段并入内容',()=>{
    const html=Gen.build(proj([{type:'changelog',enabled:true,showTitle:true,title:'日志',lines:'v1.0|2025-05-01|发布|首版'}]),{isPreview:false});
    expect(html).toContain('-revt">日志');
    expect(html).toContain('-clv">v1.0');
    expect(html).toContain('-cld">2025-05-01');
    expect(html).toContain('-clt">发布|首版');
  });
  it('gate：checkbox 与全屏封面 label 联动',()=>{
    const html=Gen.build(proj([{type:'gate',enabled:true,title:'开始',text:'引言',buttonText:'进入'}]),{isPreview:false});
    expect(html).toContain('-gateck');
    expect(html).toContain('-gatecover">');
    expect(html).toContain('-gatetitle">开始');
    expect(html).toContain('-gatebtn">进入');
    expect(html).toContain('-gateck:checked');
  });
  it('decode：动效开启输出解码脚本，motion=off 只出纯文本',()=>{
    const p=proj([{type:'decode',enabled:true,lines:'信号接入'}]);
    const on=Gen.build(p,{isPreview:false});
    expect(on).toContain('-decl">信号接入');
    expect(on).toContain('GLYPHS');
    p.theme.motion='off';
    const off=Gen.build(p,{isPreview:false});
    expect(off).toContain('-decl">信号接入');
    expect(off).not.toContain('GLYPHS');
  });
  it('gacha：卡池数据注入脚本与稀有度回落路径',()=>{
    const html=Gen.build(proj([{type:'gacha',enabled:true,title:'卡池',buttonText:'抽',cards:'SSR｜命运之刃｜描述\nXYZ｜神秘卡｜?'}]),{isPreview:false});
    expect(html).toContain('-gcard');
    expect(html).toContain('-gfront');
    expect(html).toContain('RAR={ssr:');
    expect(html).toContain('命运之刃');
    expect(html).toContain('RAR.n');
  });
  it('egg：宏双轨（预览替换/导出保留）与计次阈值注入',()=>{
    const base={type:'egg',enabled:true,hint:'✦',count:5,lines:'「{{user}}」'};
    const prev=Gen.build(proj([base]),{isPreview:true});
    expect(prev).toContain('-egg" data-opg="egg"');
    expect(prev).toContain('旅行者');
    const exp=Gen.build(proj([base]),{isPreview:false});
    expect(exp).toContain('{{user}}');
    expect(exp).toContain(',N=5,');
  });
});

describe('Gen 完整文档与正则脚本选项',()=>{
  it('buildFullDoc 含 body 标签，fencedFullDoc 以 ``` 围栏包裹（酒馆助手渲染必要条件）',()=>{
    const doc=Gen.buildFullDoc(defaultProject('t'));
    expect(doc).toContain('<body>');
    expect(doc).toContain('</body>');
    const f=Gen.fencedFullDoc(defaultProject('t'));
    expect(f.startsWith('```\n')).toBe(true);
    expect(f.endsWith('\n```')).toBe(true);
    expect(f).toContain('<body>');
  });
  it('regexScript 默认 placement [2]（AI 输出）+ runOnEdit，且可配置',()=>{
    const p=defaultProject('t');
    expect(Gen.regexScript(p).placement).toEqual([2]);
    expect(Gen.regexScript(p).runOnEdit).toBe(true);
    const rx=Gen.regexScript(p,{placement:[1,2],runOnEdit:false});
    expect(rx.placement).toEqual([1,2]);
    expect(rx.runOnEdit).toBe(false);
    expect(rx.replaceString.startsWith('```\n<!DOCTYPE html>')).toBe(true);
  });
});

describe('Gen.build 模糊揭示区（blurreveal）',()=>{
  it('默认工程产物不含模糊揭示 DOM（默认停用）',()=>{
    expect(Gen.build(defaultProject('t'),{isPreview:false})).not.toContain('-brv">');
  });
  it('每行一段输出 seg+遮罩，点击脚本随实例输出',()=>{
    const html=Gen.build(proj([{type:'blurreveal',enabled:true,showTitle:true,title:'雾语',hint:'点击显示',lines:'第一段\n第二段'}]),{isPreview:false});
    expect(html).toContain('-revt">雾语');
    expect((html.match(/-seg" data-opg="seg"/g)||[]).length).toBe(2);
    expect(html).toContain('-segh">点击显示');
    expect(html).toContain("classList.add('on')");
  });
  it('宏双轨：预览替换、导出保留',()=>{
    const p=proj([{type:'blurreveal',enabled:true,showTitle:false,title:'',hint:'',lines:'你好 {{user}}'}]);
    p.macros=[{k:'char',v:'艾'},{k:'user',v:'旅人'}];
    expect(Gen.build(p,{isPreview:true})).toContain('你好 旅人');
    expect(Gen.build(p,{isPreview:false})).toContain('你好 {{user}}');
  });
  it('全部空行不出容器与脚本',()=>{
    const html=Gen.build(proj([{type:'blurreveal',enabled:true,lines:'  \n '}]),{isPreview:false});
    expect(html).not.toContain('data-opg="seg"');
  });
});

describe('Gen.auditCompat 墨月避坑检查',()=>{
  const withHtml=html=>{const p=defaultProject('t');const fb=p.blocks.find(b=>b.type==='freehtml');fb.enabled=true;fb.html=html;return p};
  it('formatAsDisplayedMessage 调用判提示',()=>{
    const items=Gen.auditCompat(withHtml('<div>x</div><script>var t=formatAsDisplayedMessage("a");<\/script>')).items;
    expect(items.some(x=>/formatAsDisplayedMessage/.test(x.msg))).toBe(true);
  });
  it('楼层数据写入 innerHTML 判提示；纯 innerHTML 不判',()=>{
    const bad=Gen.auditCompat(withHtml('<script>var m=getChatMessages(0)[0];el.innerHTML=m.message;<\/script>')).items;
    expect(bad.some(x=>/innerHTML/.test(x.msg))).toBe(true);
    const ok=Gen.auditCompat(withHtml('<script>el.innerHTML="静态内容";<\/script>')).items;
    expect(ok.some(x=>/innerHTML/.test(x.msg))).toBe(false);
  });
});

describe('gate 六主题（经典/帷幕/法阵/金库/扫描/年龄）',()=>{
  const ageGate=(over={})=>({type:'gate',enabled:true,theme:'age',title:'你满 18 岁了吗？',text:'本角色卡可能涉及成人内容，未满18岁谢绝进入。',buttonText:'是，我已年满18岁并同意进入',leaveText:'不，我未满18岁并离开',logo:'CHARACTER CARD',...over});
  it('BLOCK_PRESETS.gate 预设换主题并带完整文案',()=>{
    const g=BLOCK_PRESETS.gate[0];
    expect(g.data.theme).toBe('age');
    expect(g.data.title).toBe('你满 18 岁了吗？');
    expect(g.data.text).toBe('本角色卡可能涉及成人内容，未满18岁谢绝进入。');
  });
  it('年龄主题：18+ 徽章 / 标识行 / 双按钮 / 离开与切卡重显脚本',()=>{
    const html=Gen.build(proj([ageGate()]),{isPreview:false});
    expect(html).toContain('-gagebadge">18+');
    expect(html).toContain('-gagelogo');
    expect(html).toContain('-gagetitle">你满 18 岁了吗？');
    expect(html).toContain('-gageenter');
    expect(html).toContain('data-opg="gateleave"');
    expect(html).toContain('不，我未满18岁并离开');
    expect(html).toContain('未检测到酒馆助手 triggerSlash API');
    expect(html).toContain('ck.checked=false');
    expect(html).toContain('</script>');
    /* 脚本锚点必须是 parentNode（gate 容器）而非 previousElementSibling（gagecover 面板）——
       后者查不到面板外的 checkbox 会提前 return，监听器全灭；离开命令为 ST 内置 /closechat */
    expect(html).toContain('document.currentScript.parentNode');
    expect(html).not.toContain('document.currentScript.previousElementSibling');
    expect(html).toContain("triggerSlash('/closechat')");
    expect(html).not.toContain("triggerSlash('/close')");
  });
  it('年龄主题导出自检零阻断（脚本闭合计数平衡）',()=>{
    const a=Gen.auditFullDoc(Gen.buildFullDoc(proj([ageGate()])));
    expect(a.ok).toBe(true);
    expect(a.problems.filter(x=>x.level==='阻断')).toHaveLength(0);
  });
  it('经典主题：无年龄内容与脚本，checkbox id 带块索引',()=>{
    const html=Gen.build(proj([{type:'gate',enabled:true,title:'开始',text:'引言',buttonText:'进入'}]),{isPreview:false});
    expect(html).toMatch(/id="opg-[a-z0-9]+-bk0-gateck"/);
    expect(html).toContain('-gatecover">');
    expect(html).toContain('-gatebtn">进入');
    expect(html).not.toContain('-gagebadge');
    expect(html).not.toContain('gateleave');
  });
  it('宏双轨：预览替换、导出保留',()=>{
    const mk=()=>{const p=proj([ageGate({title:'你好 {{user}}'})]);p.macros=[{k:'char',v:'艾'},{k:'user',v:'旅人'}];return p};
    expect(Gen.build(mk(),{isPreview:true})).toContain('你好 旅人');
    expect(Gen.build(mk(),{isPreview:false})).toContain('你好 {{user}}');
  });
  it('双实例：checkbox id 唯一、两主题同工程互不干扰',()=>{
    const html=Gen.build(proj([ageGate(),{type:'gate',enabled:true,title:'经典',text:'引言',buttonText:'进入'}]),{isPreview:false});
    expect(html).toMatch(/id="opg-[a-z0-9]+-bk0-gateck"/);
    expect(html).toMatch(/id="opg-[a-z0-9]+-bk1-gateck"/);
    expect(html).toContain('-gagebadge">18+');
    expect(html).toContain('-gatecover">');
  });
  it('motion=off：功能脚本照常产出、面板入场关键帧不产出',()=>{
    const p=proj([ageGate()]);p.theme.motion='off';
    const html=Gen.build(p,{isPreview:false});
    expect(html).toContain('data-opg="gateleave"');
    expect(html).not.toContain('-gagein');
  });
  it('四新主题：标记类 + 揭开选择器 + 纯 CSS 零脚本',()=>{
    const mk=t=>Gen.build(proj([{type:'gate',enabled:true,theme:t,title:'开始',text:'引言',buttonText:'进入',logo:'LOGO'}]),{isPreview:false});
    const cur=mk('curtain');
    expect(cur).toContain('-gcurcover">');
    expect(cur).toContain('-gcurl');
    expect(cur).toContain('-gcurval');
    expect(cur).toContain('-gcurmid');
    expect(cur).toContain('-gcurck:checked');
    expect(cur).not.toContain('gateleave');
    const seal=mk('seal');
    expect(seal).toContain('-gsealcover">');
    expect(seal).toContain('-gsealring');
    expect(seal).toContain('-gsealglyph');
    expect(seal).toContain('-gsealck:checked');
    expect(seal).not.toContain('gateleave');
    const vault=mk('vault');
    expect(vault).toContain('-gvaultcover">');
    expect(vault).toContain('-gvaultwheel');
    expect(vault).toContain('-gvaulthub');
    expect(vault).toContain('-gvaultck:checked');
    expect(vault).not.toContain('gateleave');
    const scan=mk('scan');
    expect(scan).toContain('-gscancover">');
    expect(scan).toContain('-gscanfpr');
    expect(scan).toContain('-gscanline');
    expect(scan).toContain('-gscandone');
    expect(scan).toContain('-gscanck:checked');
    expect(scan).not.toContain('gateleave');
  });
  it('新主题结构：帷幕三件套 / 法阵徽记 / 钢印标识 / 扫描状态双 span',()=>{
    const mk=t=>Gen.build(proj([{type:'gate',enabled:true,theme:t,title:'开始',text:'引言',buttonText:'进入',logo:'LOGO'}]),{isPreview:false});
    const cur=mk('curtain');
    expect(cur).toContain('-gcurr');
    expect(cur).toContain('-gcurval');
    expect(cur).toContain('-gcurlogo">LOGO');
    const seal=mk('seal');
    expect(seal).toContain('-gsealtick');
    expect(seal).toContain('-gsealinner');
    expect(seal).not.toContain('logo">LOGO'); /* seal 无 logo 字段渲染 */
    const vault=mk('vault');
    expect(vault).toContain('-gvaultlogo">LOGO');
    expect(vault).toContain('rotate(540deg)');
    expect(vault).toContain('cubic-bezier(.7,0,.3,1) .25s'); /* 转轮先转、闸门延时升起 */
    expect(vault).toContain('visibility 0s 1.05s');
    const scan=mk('scan');
    expect(scan).toContain('-gscanlogo">LOGO');
    expect(scan).toContain('-gscanwait');
    expect(scan).toContain('-gscandone');
    expect(scan).toContain('<svg');
  });
  it('未知 theme 回落经典（兼容旧工程/手改数据）',()=>{
    const html=Gen.build(proj([{type:'gate',enabled:true,theme:'weird',title:'开始',text:'引言',buttonText:'进入'}]),{isPreview:false});
    expect(html).toContain('-gatecover">');
    expect(html).toMatch(/class="opg-[a-z0-9]+-gateck"/);
    expect(html).not.toContain('-gcurcover');
    expect(html).not.toContain('gateleave');
  });
  it('新主题双实例：ck 类与封面各归各、checkbox id 唯一',()=>{
    const html=Gen.build(proj([
      {type:'gate',enabled:true,theme:'curtain',title:'幕',text:'引言',buttonText:'进入'},
      {type:'gate',enabled:true,theme:'vault',title:'库',text:'引言',buttonText:'进入'}
    ]),{isPreview:false});
    expect(html).toMatch(/id="opg-[a-z0-9]+-bk0-gateck"/);
    expect(html).toMatch(/id="opg-[a-z0-9]+-bk1-gateck"/);
    expect(html).toContain('-gcurck');
    expect(html).toContain('-gvaultck');
    expect(html).toContain('-gcurcover">');
    expect(html).toContain('-gvaultcover">');
  });
  it('motion=off：新主题法阵慢转/扫描线关键帧不产出，揭开选择器仍在',()=>{
    const p=proj([
      {type:'gate',enabled:true,theme:'seal',title:'开始',text:'引言',buttonText:'进入'},
      {type:'gate',enabled:true,theme:'scan',title:'开始',text:'引言',buttonText:'进入'}
    ]);
    p.theme.motion='off';
    const html=Gen.build(p,{isPreview:false});
    expect(html).not.toContain('-gsealspin');
    expect(html).not.toContain('-gscansweep');
    expect(html).toContain('-gsealck:checked');
    expect(html).toContain('-gscanck:checked');
  });
  it('六主题混合导出自检零阻断（仅 age 贡献脚本，闭合平衡）',()=>{
    const mk=t=>({type:'gate',enabled:true,theme:t,title:t,text:'引言',buttonText:'进入',logo:'LOGO',leaveText:'离开'});
    const p=proj([mk('classic'),mk('age'),mk('curtain'),mk('seal'),mk('vault'),mk('scan')]);
    const doc=Gen.buildFullDoc(p);
    const a=Gen.auditFullDoc(doc);
    expect(a.ok).toBe(true);
    expect(a.problems.filter(x=>x.level==='阻断')).toHaveLength(0);
    expect(doc).toContain('</script>');
    expect(doc).toContain('-gcurck:checked');
    expect(doc).toContain('-gsealck:checked');
    expect(doc).toContain('-gvaultck:checked');
    expect(doc).toContain('-gscanck:checked');
  });
  it('新主题宏双轨：预览替换、导出保留',()=>{
    const mk=()=>{const p=proj([{type:'gate',enabled:true,theme:'curtain',title:'你好 {{user}}',text:'引言',buttonText:'进入'}]);p.macros=[{k:'user',v:'旅人'}];return p};
    expect(Gen.build(mk(),{isPreview:true})).toContain('你好 旅人');
    expect(Gen.build(mk(),{isPreview:false})).toContain('你好 {{user}}');
  });
  it('BLOCK_PRESETS.gate 五预设：theme 顺序与文案齐全',()=>{
    expect(BLOCK_PRESETS.gate.map(x=>x.data.theme)).toEqual(['age','curtain','seal','vault','scan']);
    BLOCK_PRESETS.gate.forEach(x=>{
      expect(x.data.title).toBeTruthy();
      expect(x.data.text).toBeTruthy();
      expect(x.data.buttonText).toBeTruthy();
    });
  });
  it('套预设归一：上一预设残留字段被清（logo/leaveText 不跨主题串）',()=>{
    const b={type:'gate',enabled:true,...BLOCK_DEFS.gate.create()};
    applyBlockPreset(b,BLOCK_PRESETS.gate[1].data); /* 剧场帷幕 */
    applyBlockPreset(b,BLOCK_PRESETS.gate[2].data); /* 封印法阵（预设无 logo/leaveText） */
    expect(b.theme).toBe('seal');
    expect(b.title).toBe('封印已至');
    expect(b.logo).toBe(BLOCK_DEFS.gate.create().logo); /* 帷幕 NOW SHOWING 残留被清 */
    expect(b.leaveText).toBe(BLOCK_DEFS.gate.create().leaveText); /* 年龄预设残留被清 */
    const other={type:'welcome',enabled:true,title:'自定'};
    applyBlockPreset(other,{title:'新标题'});
    expect(other.title).toBe('新标题'); /* 非 gate 类型行为不变：只叠预设 */
  });
  it('切主题文案同步：模板值随主题换、用户自定义保留',()=>{
    const mk=()=>({type:'gate',enabled:true,...BLOCK_DEFS.gate.create()});
    const b=mk();b.theme='curtain';syncGateThemeCopy(b);
    expect(b.title).toBe('✦ 开场在即 ✦'); /* 经典模板 → 帷幕模板 */
    expect(b.buttonText).toBe('拉开帷幕');
    const b2=mk();b2.title='我的自定义标题';b2.theme='seal';syncGateThemeCopy(b2);
    expect(b2.title).toBe('我的自定义标题'); /* 自定义不动 */
    const b3=mk();b3.theme='age';syncGateThemeCopy(b3);b3.theme='vault';syncGateThemeCopy(b3);
    expect(b3.title).toBe('库门紧闭'); /* 模板 → 模板连续换 */
    expect(b3.logo).toBe('VAULT-07');
  });
  it('帷幕揭示：背景独立 ::before 层并随揭示淡出，封面 checked 后无残留遮挡',()=>{
    const html=Gen.build(proj([{type:'gate',enabled:true,theme:'curtain',title:'幕',text:'引言',buttonText:'进入'}]),{isPreview:false});
    expect(html).toContain('-gcurcover::before{content:""');
    expect(html).toMatch(/-gcurcover::before\{[^}]*background:radial-gradient/);
    expect(html).not.toMatch(/-gcurcover\{[^}]*background:/); /* 背景不在封面本体上 */
    expect(html).toContain('-gcurcover{pointer-events:none;visibility:hidden'); /* 揭开后整面退出 */
    expect(html).toContain('-gcurcover::before{opacity:0}'); /* 背景层随幕布滑出淡出 */
  });
});

describe('Gen.build 审计修复回归（v1.13.0）',()=>{
  it('gacha：tx 逐字段应用，运行时拿到二维数组而非逗号拼接字符串（预览与导出双轨）',()=>{
    const base={type:'gacha',enabled:true,title:'卡池',buttonText:'抽',cards:'SSR｜命运之刃｜{{char}}的剑\nXYZ｜神秘卡｜?'};
    const exp=Gen.build(proj([base]),{isPreview:false});
    expect(exp).toContain('var CARDS=[["SSR","命运之刃","{{char}}的剑"],["XYZ","神秘卡","?"]]');
    expect(exp).not.toContain('var CARDS="');
    const prev=Gen.build(proj([{...base,cards:'SSR｜命运之刃｜{{char}}的剑'}]),{isPreview:true});
    expect(prev).toContain('var CARDS=[["SSR","命运之刃","');
    expect(prev).toContain('的剑"]]');
    expect(prev).not.toContain('var CARDS="');
  });
  it('egg：LINES 为字符串数组且宏逐条应用（导出保留宏）',()=>{
    const exp=Gen.build(proj([{type:'egg',enabled:true,hint:'✦',count:5,lines:'彩蛋甲\n彩蛋乙'}]),{isPreview:false});
    expect(exp).toContain('var LINES=["彩蛋甲","彩蛋乙"],N=5,');
    expect(exp).not.toContain('var LINES="');
  });
  it('封面墙：运行时重建带 -gwallitem 类（有 API 环境加载即重建不掉样式）；当前项徽标为复合选择器',()=>{
    const html=Gen.build(proj([{type:'greetings',enabled:true,cardStyle:'wall',placeholderList:'a\nb'}]),{isPreview:false});
    expect(html).toContain("PX+'-gitem'+(WALL?' '+PX+'-gwallitem':'')");
    expect(html).toMatch(/-gwallitem\.opg-[\w]+-gcur \.opg-[\w]+-gnum/);
    expect(html).not.toMatch(/-gwallitem \.opg-[\w]+-gcur/);
  });
  it('stripTags：三条正则（成对/孤立开/孤立闭）齐备',()=>{
    const code=Gen.build(proj([{type:'greetings',enabled:true,excludedTags:'status',placeholderList:'a'}]),{isPreview:false}).match(/<script>([\s\S]*?)<\/script>/)[1];
    const stripLines=code.split('\n').filter(l=>l.includes("t=t.replace(new RegExp('<"));
    expect(stripLines.length).toBe(3);
    /* 产物里反斜杠双写（模板转义层），用程序化拼装断言第三个正则以 '<\\/'+tag 开头 */
    const bs=String.fromCharCode(92);
    expect(stripLines[2]).toContain("new RegExp('<"+bs+bs+"/'+tag+'"+bs+bs+"s*>','gi')");
  });
  it('auditCompat：不同 id 不误报重复（回归：match/g 取错捕获组），相同 id 报出名字',()=>{
    const p=defaultProject('t');
    const fb=p.blocks.find(b=>b.type==='freehtml');fb.enabled=true;
    fb.html='<div id="aaa"></div><div id="bbb"></div>';
    expect(Gen.auditCompat(p).items.some(x=>/重复 id/.test(x.msg))).toBe(false);
    fb.html='<div id="aaa"></div><div id="aaa"></div>';
    expect(Gen.auditCompat(p).items.some(x=>/重复 id（aaa）/.test(x.msg))).toBe(true);
  });
});

describe('Gen.greetSnapshotLines 写卡开场白快照（v1.13.1）',()=>{
  it('多行开场白 → 首行标题｜余行描述（与运行时 extractTitleDesc 同口径）',()=>{
    expect(Gen.greetSnapshotLines(['宁静的清晨\n晨光洒进房间\n新的一天'])).toBe('宁静的清晨｜晨光洒进房间 新的一天');
  });
  it('标题超 20 字截断加省略号，描述满 48 字截断加省略号',()=>{
    const t30='一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十';
    expect(Gen.greetSnapshotLines([t30+'尾'])).toBe(t30.slice(0,20)+'…');
    const d=Array.from({length:48},()=>'字').join('');
    expect(Gen.greetSnapshotLines(['标\n'+d+'尾'])).toBe('标｜'+d+'…');
    expect(Gen.greetSnapshotLines(['标\n'+d.slice(0,47)])).toBe('标｜'+d.slice(0,47));
  });
  it('跳过 HTML 注释行与围栏标记行（围栏内容行保留，与运行时同口径），剥行首 #，兼容 \\r',()=>{
    expect(Gen.greetSnapshotLines(['<!-- 注释 -->\n```js\n代码\n```\n真标题\r\n正文'])).toBe('代码｜真标题 正文');
    expect(Gen.greetSnapshotLines(['# 标题\n正文'])).toBe('标题｜正文');
  });
  it('排除标签剥除（与运行时 stripTags 同口径）',()=>{
    expect(Gen.greetSnapshotLines(['<think>内心</think>开场白\n描述'],'<think>')).toBe('开场白｜描述');
  });
  it('标题/描述自带竖线换近似字形，防占位行误切字段',()=>{
    const out=Gen.greetSnapshotLines(['A｜B\nC|D']);
    expect(out).toBe('A│B｜C│D');
  });
  it('空输入 / 非数组 / 全空白 → 空串（调用方回落原占位列表）',()=>{
    expect(Gen.greetSnapshotLines([])).toBe('');
    expect(Gen.greetSnapshotLines('str')).toBe('');
    expect(Gen.greetSnapshotLines([null,'   \n  <!-- x -->'])).toBe('');
  });
});
