/* 生成引擎单元测试（纯字符串函数，无需 DOM） */
import { describe, it, expect } from 'vitest';
import { Gen } from '../src/js/gen/index.js';
import { defaultProject, BLOCK_PRESETS } from '../src/js/defs.js';

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

describe('gate 双主题（经典幕布 / 年龄验证）',()=>{
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
});
