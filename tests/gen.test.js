/* 生成引擎单元测试（纯字符串函数，无需 DOM） */
import { describe, it, expect } from 'vitest';
import { Gen } from '../src/js/gen/index.js';
import { defaultProject } from '../src/js/defs.js';

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
  it('正常工程（默认标记/无重名/无自由 HTML）零提示',()=>{
    expect(Gen.auditCompat(defaultProject('t')).items).toHaveLength(0);
  });
  it('状态栏重名字段判提示（行式捕获错位风险）',()=>{
    const p=defaultProject('t');
    p.statusbar={fields:[{name:'状态',sample:'',quote:false},{name:'状态',sample:'',quote:false}]};
    const items=Gen.auditCompat(p).items;
    expect(items.some(x=>/重名字段/.test(x.msg))).toBe(true);
  });
  it('标记含 / 与字段名含冒号各判一条提示',()=>{
    const p=defaultProject('t');
    p.marker='开/场·页';
    p.statusbar={fields:[{name:'时间：段',sample:'',quote:false}]};
    const items=Gen.auditCompat(p).items;
    expect(items.some(x=>/含 \//.test(x.msg))).toBe(true);
    expect(items.some(x=>/含冒号/.test(x.msg))).toBe(true);
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
