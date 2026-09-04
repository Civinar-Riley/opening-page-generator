/* 纯文本状态栏生成器单元测试 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, STATUS_PRESETS, DEFAULT_FIELDS, BEAUTY_PRESETS, ACTION_DIRECTIONS, parseSampleText, buildFindRegex, applyStatusRegex, buildEntryContent, buildWorldbook, buildSampleText, buildSampleInner, buildReplaceString, buildPreviewDoc, buildRegexScript, buildUsageText, loadBeautyPresets, migrateStatusbarSamples } from '../src/js/statusbar.js';

const cfg=patch=>Object.assign(defaultConfig(),patch);

describe('findRegex 行式捕获',()=>{
  it('按字段顺序正确捕获各字段值',()=>{
    const c=cfg();
    const re=new RegExp(buildFindRegex(c));
    const text='正文……\n角色名称：林晚晴\n当前时间：周五傍晚\n地点：天台咖啡馆\n关系：老同学\n服装：米色针织开衫\n心理活动："他想什么呢"\n结尾';
    const m=re.exec(text);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('林晚晴');
    expect(m[2]).toBe('周五傍晚');
    expect(m[3]).toBe('天台咖啡馆');
    expect(m[4]).toBe('老同学');
    expect(m[5]).toBe('米色针织开衫');
    expect(m[6]).toBe('他想什么呢');
  });
  it('兼容全角/半角冒号与字段间空行',()=>{
    const c=cfg({fields:[{name:'名字',sample:'',quote:false},{name:'时间',sample:'',quote:false}]});
    const re=new RegExp(buildFindRegex(c));
    expect(re.exec('名字: 阿狼\n\n时间：深夜')[1]).toBe('阿狼');
    expect(re.exec('名字: 阿狼\n\n时间：深夜')[2]).toBe('深夜');
  });
  it('缺字段时不匹配（行式严格匹配）',()=>{
    const c=cfg({fields:[{name:'名字',sample:'',quote:false},{name:'时间',sample:'',quote:false}]});
    expect(new RegExp(buildFindRegex(c)).test('名字：阿狼')).toBe(false);
  });
  it('字段名含正则特殊字符时仍可匹配',()=>{
    const c=cfg({fields:[{name:'HP(%)',sample:'',quote:false},{name:'MP[蓝]',sample:'',quote:false}]});
    const re=new RegExp(buildFindRegex(c));
    expect(re.exec('HP(%)：80\nMP[蓝]：30')[1]).toBe('80');
  });
});

describe('applyStatusRegex 正则测试沙盒',()=>{
  it('行式：真实文本命中各字段，编号与字段名一致',()=>{
    const c=cfg();
    const text='正文……\n角色名称：林晚晴\n当前时间：周五傍晚\n地点：天台咖啡馆\n关系：老同学\n服装：米色针织开衫\n心理活动："他想什么呢"\n结尾';
    const r=applyStatusRegex(text,c);
    expect(r.hit).toBe(true);
    expect(r.groups).toHaveLength(6);
    expect(r.groups[0]).toEqual({n:1,name:'角色名称',value:'林晚晴'});
    expect(r.groups[5]).toEqual({n:6,name:'心理活动',value:'他想什么呢'});
  });
  it('替换结果：$n 注入实际捕获值（HTML 转义），完整文档含 body 标签',()=>{
    const c=cfg({fields:[{name:'名字',sample:'',quote:false},{name:'状态',sample:'',quote:false}]});
    const r=applyStatusRegex('前文\n名字：<b>危</b>\n状态：正常',c);
    expect(r.hit).toBe(true);
    expect(r.replaced).toContain('&lt;b&gt;危&lt;/b&gt;');
    expect(r.replaced).not.toContain('<b>危</b>');
    expect(r.replaced).toContain('<body>');
    expect(r.replaced).toContain('正常');
  });
  it('块式：$1 为整块捕获文本',()=>{
    const c=cfg({mode:'block',tag:'Sb'});
    const r=applyStatusRegex('正文。<Sb>\n名字：x\n</Sb>尾',c);
    expect(r.hit).toBe(true);
    expect(r.groups[0].name).toBe('状态栏整块');
    expect(r.groups[0].value.trim()).toBe('名字：x');
  });
  it('未命中返回 hit:false；行动选项作为末尾捕获组',()=>{
    expect(applyStatusRegex('完全无关的文本',cfg()).hit).toBe(false);
    const c=cfg({fields:[{name:'名字',sample:'',quote:false}],actions:true,actionCount:2});
    const r=applyStatusRegex('前文\n名字：阿狼\n行动选项：\n  - 选项一\n  - 选项二',c);
    expect(r.hit).toBe(true);
    expect(r.groups[r.groups.length-1].name).toBe('行动选项');
    expect(r.groups[r.groups.length-1].value).toContain('选项二');
  });
});

describe('$n 替换注入与 CSS 净化回归',()=>{
  it('预览：示例值含 $1/$100 不被占位符遍历二次破坏',()=>{
    const c=cfg({fields:[{name:'角色名称',sample:'林晚晴',quote:false},{name:'状态',sample:'价 $1 与 $100 元',quote:false}]});
    const doc=buildPreviewDoc(c,{});
    expect(doc).toContain('价 $1 与 $100 元');
    expect(doc).not.toContain('价 价');
    expect(doc).toContain('林晚晴');
  });
  it('沙盒：捕获值含 $<数字> 时替换结果不被二次破坏',()=>{
    const c=cfg({fields:[{name:'名字',sample:'',quote:false},{name:'状态',sample:'',quote:false}]});
    const r=applyStatusRegex('名字：价 $1 元\n状态：正常',c);
    expect(r.hit).toBe(true);
    expect(r.replaced).toContain('价 $1 元');
    expect(r.replaced).not.toContain('价 价');
  });
  it('主题/样式/layout 值含 </style> 不逃逸 style 标签、不注入属性（工程 JSON 可分享）',()=>{
    const c=cfg({});
    c.style.panelBgColor='</style><img src=x onerror=alert(1)>';
    c.layout='" onmouseover="alert(1)';
    const doc=buildPreviewDoc(c,{primary:'</style><script>alert(1)</script>',accent:'</style>'});
    expect(doc.includes('</style><img')).toBe(false);
    expect(doc.includes('</style><script')).toBe(false);
    expect(doc.includes('onmouseover')).toBe(false);
    /* 合法闭合标签仍在（净化只去注入点） */
    expect((doc.match(/<\/style>/g)||[]).length).toBeGreaterThan(0);
  });
  it('extraCss 含 </style> 被中性化，不逃逸',()=>{
    const c=cfg({extraCss:'.opg-sb-item{color:red}</style><script>alert(1)</script>'});
    const doc=buildPreviewDoc(c,{});
    expect(doc.includes('</style><script')).toBe(false);
    expect(doc.includes('color:red')).toBe(true);
  });
});

describe('findRegex 标签块模式',()=>{
  it('只捕获标签内内容，正文保留',()=>{
    const c=cfg({mode:'block',tag:'Status_block'});
    const re=new RegExp(buildFindRegex(c));
    const m=re.exec('正文叙事。<Status_block>\n名字：x\n</Status_block>结尾');
    expect(m[1].trim()).toBe('名字：x');
    expect(m[0]).not.toContain('正文叙事');
  });
  it('标签名含下划线等字符可用',()=>{
    const c=cfg({mode:'block',tag:'My_Status-1'});
    expect(new RegExp(buildFindRegex(c)).test('x<My_Status-1> y </My_Status-1>z')).toBe(true);
  });
});

describe('世界书条目',()=>{
  it('entries.0 关键字段正确（蓝灯/@D/防递归）',()=>{
    const c=cfg({depth:1,role:2,order:5});
    const wb=buildWorldbook(c);
    const e=wb.entries['0'];
    expect(e.constant).toBe(true);
    expect(e.key).toEqual([]);
    expect(e.position).toBe(4);
    expect(e.depth).toBe(1);
    expect(e.role).toBe(2);
    expect(e.order).toBe(5);
    expect(e.excludeRecursion).toBe(true);
    expect(e.preventRecursion).toBe(true);
    expect(e.comment).toBe(c.entryComment);
  });
  it('条目内容含占位符格式、引号字段、逐字段说明与规则',()=>{
    const c=cfg({rules:['规则甲','规则乙']});
    const s=buildEntryContent(c);
    expect(s).toContain('角色名称：${');
    expect(s).toContain('心理活动："${');
    expect(s).toContain('- 心理活动：');
    expect(s).toContain('- 规则甲');
  });
  it('标签块模式条目含包裹标签；行动选项可开关',()=>{
    const c=cfg({mode:'block',actions:true,actionCount:4});
    const s=buildEntryContent(c);
    expect(s).toContain('<Status_block>');
    expect(s).toContain('行动选项：');
    const c2=cfg({mode:'block',actions:false});
    expect(buildEntryContent(c2)).not.toContain('行动选项：');
  });
});

describe('纯文字状态栏示例',()=>{
  it('行式逐行输出，引号字段带引号',()=>{
    const s=buildSampleInner(cfg());
    expect(s).toContain('角色名称：林晚晴');
    expect(s).toContain('心理活动："');
  });
  it('标签块模式包裹标签；注释头可选',()=>{
    const c=cfg({mode:'block'});
    expect(buildSampleText(c)).toContain('<Status_block>');
    expect(buildSampleText(c,{commentHeader:true})).toContain('<!--');
    expect(buildSampleText(c)).not.toContain('<!--');
  });
});

describe('正则美化 JSON 与美化文档',()=>{
  it('结构与 ST 正则扩展一致，findRegex 带斜杠且可解析',()=>{
    const c=cfg();
    const rx=buildRegexScript(c,{primary:'#7c6cf0'},{placement:[1,2],runOnEdit:false});
    expect(rx.placement).toEqual([1,2]);
    expect(rx.runOnEdit).toBe(false);
    expect(rx.markdownOnly).toBe(true);
    expect(rx.promptOnly).toBe(false);
    expect(()=>new RegExp(rx.findRegex.replace(/^\//,'').replace(/\/$/,''))).not.toThrow();
    expect(rx.scriptName).toContain('状态栏美化');
  });
  it('replaceString 为 ``` 围栏完整文档，行式含 $n 插值与主题色',()=>{
    const s=buildReplaceString(cfg(),{primary:'#00e5ff',accent:'#ff2ea6'});
    expect(s.startsWith('```\n<!DOCTYPE html>')).toBe(true);
    expect(s.endsWith('\n```')).toBe(true);
    expect(s).toContain('$1');
    expect(s).toContain('#00e5ff');
    expect(s).toContain('<body>');
  });
  it('块式含数据源标签、解析器与选项点击逻辑',()=>{
    const s=buildReplaceString(cfg({mode:'block',actions:true}),{primary:'#7c6cf0'});
    expect(s).toContain('type="text/plain" id="opg-sb-src">$1<');
    expect(s).toContain('function parse(');
    expect(s).toContain('/setinput ');
    expect(s).toContain('renderOptions'); /* 选项由关键词识别渲染为按钮 */
  });
  it('预览文档将 $n 替换为示例值且无残留',()=>{
    const c=cfg();
    const doc=buildPreviewDoc(c,{primary:'#7c6cf0'});
    expect(doc).toContain('林晚晴');
    expect(doc).not.toMatch(/\$\d/);
    expect(doc).toContain('预览示例正文');
  });
});

describe('示例文本导入解析',()=>{
  it('行式文本解析出字段，引号值识别为引号字段',()=>{
    const r=parseSampleText('角色名称：林晚晴\n当前时间：黄昏\n心理活动："好的"\n');
    expect(r.mode).toBe('lines');
    expect(r.fields.map(f=>f.name)).toEqual(['角色名称','当前时间','心理活动']);
    expect(r.fields[2].quote).toBe(true);
    expect(r.fields[2].sample).toBe('好的');
  });
  it('标签块文本自动识别模式与标签名',()=>{
    const r=parseSampleText('前言<My_Tag>\n名字：x\n时间：y\n</My_Tag>后记');
    expect(r.mode).toBe('block');
    expect(r.tag).toBe('My_Tag');
    expect(r.fields.length).toBe(2);
  });
  it('重复字段去重、无冒号行并入上一字段',()=>{
    const r=parseSampleText('名字：a\n名字：b\n描述：第一行\n第二行续');
    expect(r.fields.length).toBe(2);
    expect(r.fields[1].sample).toBe('第一行\n第二行续');
  });
});

describe('配置与预设',()=>{
  it('defaultConfig 默认 6 字段、行式模式、心理活动为引号字段',()=>{
    const c=defaultConfig();
    expect(c.mode).toBe('lines');
    expect(c.fields.length).toBe(6);
    expect(c.fields.find(f=>f.name==='心理活动').quote).toBe(true);
  });
  it('内置预设共 3 套且字段非空',()=>{
    expect(STATUS_PRESETS.length).toBe(3);
    STATUS_PRESETS.forEach(p=>expect(p.fields.length).toBeGreaterThan(0));
  });
});

describe('使用说明',()=>{
  it('包含三步导入说明与缺字段提示',()=>{
    const s=buildUsageText(cfg());
    expect(s).toContain('世界书');
    expect(s).toContain('正则');
    expect(s).toContain('first_mes');
    expect(s).toContain('缺字段');
  });
});

describe('v1.7.1 修复回归',()=>{
  it('空字段名被过滤：正则仍按有效字段匹配，编号一致',()=>{
    const c=cfg({fields:[{name:'名字',sample:'a',quote:false},{name:'',sample:'b',quote:false},{name:'时间',sample:'c',quote:false}]});
    const re=new RegExp(buildFindRegex(c));
    const m=re.exec('名字：a\n时间：c');
    expect(m).not.toBeNull();
    expect(m[1]).toBe('a');
    expect(m[2]).toBe('c');
  });
  it('块式预览数据源注入完整示例文本而非单个字段值',()=>{
    const doc=buildPreviewDoc(cfg({mode:'block'}),{});
    const m=/id="opg-sb-src">([\s\S]*?)<\//.exec(doc);
    expect(m[1]).toContain('角色名称：');
    expect(m[1]).toContain('心理活动：');
  });
  it('含普通 HTML 标签的文本不再误判为块式',()=>{
    const r=parseSampleText('说明：<b>加粗</b>文字\n名字：x');
    expect(r.mode).toBe('lines');
    expect(r.fields.some(f=>f.name==='名字')).toBe(true);
  });
  it('行动选项跟随 actions 开关而非生成模式（未启用时不写入条目）',()=>{
    expect(buildEntryContent(cfg({mode:'lines',actions:false}))).not.toContain('行动选项：');
    expect(buildEntryContent(cfg({mode:'block',actions:false}))).not.toContain('行动选项：');
  });
  it('选项风格（英文逗号分割）逐条写入世界书行动选项规则',()=>{
    const s=buildEntryContent(cfg({mode:'block',actions:true,actionCount:4,actionStyles:'平滑,淫秽'}));
    expect(s).toContain('- 平滑：');
    expect(s).toContain('淫秽：');
    expect(s).toContain('行动选项方向定义');
  });
  it('使用说明为手动建条目流程（@D 参数）',()=>{
    const s=buildUsageText(cfg({depth:1,role:2,order:5}));
    expect(s).toContain('新建条目');
    expect(s).toContain('@D');
    expect(s).toContain('regex-状态栏-状态栏.json');
  });
});

describe('旧版示例值迁移',()=>{
  it('恰好等于旧默认值的 sample 被替换为原创值，自定义内容不受影响',()=>{
    const c={fields:[
      {name:'角色名称',sample:'梁晓彤',quote:false},
      {name:'自定义',sample:'梁晓彤的朋友圈',quote:false},
      {name:'当前时间',sample:'黄昏时刻',quote:false},
      {name:'关系',sample:'哥们(允许非插入行为)',quote:false},
    ]};
    migrateStatusbarSamples(c);
    expect(c.fields[0].sample).toBe('林晚晴');
    expect(c.fields[1].sample).toBe('梁晓彤的朋友圈'); /* 非精确匹配不替换 */
    expect(c.fields[2].sample).toBe('周五傍晚，华灯初上');
    expect(c.fields[3].sample).toBe('半年未见的老同学');
  });
});

describe('行动选项与生成模式解绑',()=>{
  it('行式 findRegex 末尾追加选项捕获组并可匹配',()=>{
    const c=cfg({fields:[{name:'名字',sample:'a',quote:false},{name:'时间',sample:'b',quote:false}],actions:true,actionCount:3,actionStyles:'最佳,中等,冒险'});
    const re=new RegExp(buildFindRegex(c));
    const text='名字：a\n时间：b\n行动选项：\n- 最佳：先观察\n- 中等：打个招呼\n- 冒险：直接走近';
    const m=re.exec(text);
    expect(m).not.toBeNull();
    expect(m[3]).toContain('最佳：先观察');
    expect(m[3]).toContain('冒险：直接走近');
  });
  it('行式启用行动选项时生成数据源标签（最后一个捕获组）',()=>{
    const doc=buildPreviewDoc(cfg({fields:[{name:'名字',sample:'a',quote:false}],actions:true,actionCount:2,actionStyles:'最佳,中等'}),{});
    expect(doc).toContain('id="opg-sb-src"');
    expect(doc).toContain('最佳：');
    expect(doc).not.toMatch(/\$\d/);
  });
  it('行式条目同样输出行动选项格式段',()=>{
    const s=buildEntryContent(cfg({mode:'lines',actions:true,actionStyles:'平滑,冒险'}));
    expect(s).toContain('行动选项：');
    expect(s).toContain('- 平滑：');
    expect(s).toContain('- 冒险：');
  });
  it('未启用行动选项时行式 findRegex 无选项组',()=>{
    const c=cfg({fields:[{name:'名字',sample:'a',quote:false}],actions:false});
    expect(buildFindRegex(c)).not.toContain('行动选项');
  });
});

describe('美化布局预设与自定义 CSS',()=>{
  it('默认卡片风：文档含 ly-cards 且应用卡片风覆盖样式',()=>{
    const s=buildReplaceString(cfg(),{primary:'#7c6cf0',accent:'#e8c47c'});
    expect(s).toContain('ly-cards');
    expect(s).toContain('ly-cards .opg-sb-item');
  });
  it('开场页风与紧凑网格布局切换',()=>{
    expect(buildReplaceString(cfg({layout:'opening'}),{})).toContain('ly-opening');
    expect(buildReplaceString(cfg({layout:'opening'}),{})).toContain('3px double');
    const g=buildReplaceString(cfg({layout:'grid'}),{});
    expect(g).toContain('ly-grid');
    expect(g).not.toContain('ly-cards .');
  });
  it('自定义 CSS 注入生成的美化样式之后',()=>{
    const s=buildReplaceString(cfg({extraCss:'.opg-sb-item{border-radius:20px}'}),{});
    expect(s).toContain('.opg-sb-item{border-radius:20px}');
  });
  it('预览文档同样应用布局与自定义 CSS',()=>{
    const doc=buildPreviewDoc(cfg({layout:'opening',extraCss:'.xx{color:red}'}),{});
    expect(doc).toContain('ly-opening');
    expect(doc).toContain('.xx{color:red}');
  });
});

describe('布局微调：标题栏样式与行动选项位置（此前为死配置）',()=>{
  const lc=patch=>Object.assign(defaultConfig().layoutConfig,patch);
  it('headerStyle=minimal：极简标题栏（无背景/隐藏折叠箭头/去掉扫光）',()=>{
    const s=buildReplaceString(cfg({layoutConfig:lc({headerStyle:'minimal'})}),{});
    expect(s).toMatch(/opg-sb-head\{background:none!important;border-bottom:none!important/);
    expect(s).toMatch(/opg-sb-fold\{display:none!important/);
    expect(s).toMatch(/opg-sb-headtxt::after\{display:none!important/);
  });
  it('headerStyle=centered：标题居中且折叠箭头绝对定位',()=>{
    const s=buildReplaceString(cfg({layoutConfig:lc({headerStyle:'centered'})}),{});
    expect(s).toMatch(/opg-sb-head\{justify-content:center!important/);
    expect(s).toMatch(/opg-sb-fold\{[^}]*position:absolute!important/);
  });
  it('headerStyle=underline：无头背景并强化标题下划线',()=>{
    const s=buildReplaceString(cfg({layoutConfig:lc({headerStyle:'underline'})}),{});
    expect(s).toMatch(/opg-sb-headtxt::after\{height:2px!important/);
  });
  it('actionPosition=inline：选项分隔样式 + 运行时把选项容器搬入面板体',()=>{
    const s=buildReplaceString(cfg({layoutConfig:lc({actionPosition:'inline'})}),{});
    expect(s).toMatch(/opg-sb-actions\{margin:8px 0 0!important/);
    expect(s).toContain('bodyEl.appendChild(actBox)');
  });
  it('standard/bottom 不输出覆盖规则（保持布局变体原貌）',()=>{
    const s=buildReplaceString(cfg(),{});
    expect(s).not.toMatch(/opg-sb-fold\{display:none/);
    expect(s).not.toContain('bodyEl.appendChild(actBox)');
  });
});

describe('行动选项三色与玻璃底可读性',()=>{
  it('三色仅显式设置时以 !important 压过布局变体（空值保持变体原貌）',()=>{
    const base=buildReplaceString(cfg(),{});
    expect(base).not.toMatch(/opg-sb-opt\{color:[^}]*!important/);
    const c=cfg({style:Object.assign(defaultConfig().style,{actionOptColor:'#ff8800',actionOptBg:'#102030',actionOptBorder:'#44aaff'})});
    const s=buildReplaceString(c,{});
    expect(s).toContain('.opg-sb-opt{color:#ff8800!important}');
    expect(s).toContain('.opg-sb-opt{background:#102030!important}');
    expect(s).toContain('.opg-sb-opt{border-color:#44aaff!important}');
  });
  it('玻璃态面板自带深色基底（亮底预览下白字仍可读）',()=>{
    const s=buildReplaceString(cfg({layout:'glass'}),{});
    expect(s).toMatch(/ly-glass [^{]*panel\{background:linear-gradient\(160deg,rgba\(16,18,28/);
  });
  it('布局微调 borderRadius=0 生效为 0（合法的 0 不被回落 12）',()=>{
    const s=buildReplaceString(cfg({layoutConfig:Object.assign(defaultConfig().layoutConfig,{borderRadius:0})}),{});
    expect(s).toContain('border-radius:0px!important');
  });
});

describe('frontend-design 重设计（星夜工作台）',()=>{
  it('面板含氛围层（光晕+噪点）与衬线标题栈',()=>{
    const s=buildReplaceString(cfg(),{});
    expect(s).toContain('opg-sb-atmo');
    expect(s).toContain('feTurbulence');
    expect(s).toContain('STZhongsong');
  });
  it('载入动效编排与 reduced-motion 降级',()=>{
    const s=buildReplaceString(cfg(),{});
    expect(s).toContain('opg-sb-fadein');
    expect(s).toContain('opg-sb-sweep');
    expect(s).toContain('@media (prefers-reduced-motion:reduce)');
  });
  it('行动选项带序号徽章与扫光',()=>{
    const s=buildReplaceString(cfg({actions:true,actionCount:3}),{});
    expect(s).toContain('opg-sb-badge');
    expect(s).toContain('壹');
    expect(s).toMatch(/opt::after/);
  });
  it('手稿扉页布局含点线引导与 ❦ 饰线',()=>{
    const s=buildReplaceString(cfg({layout:'opening'}),{});
    expect(s).toContain('dotted');
    expect(s).toContain('❦');
  });
  it('自定义 CSS 仍注入在最后（可覆盖重设计样式）',()=>{
    const s=buildReplaceString(cfg({layout:'cards',extraCss:'.opg-sb-item{border:none}'}),{});
    const last=	s.lastIndexOf('<style>');
    expect(s.slice(last)).toContain('.opg-sb-item{border:none}');
  });
});

describe('美化配置预设与进度条字段',()=>{
  it('BEAUTY_PRESETS 内置 6 套且 patch 覆盖布局/标题',()=>{
    expect(BEAUTY_PRESETS.length).toBe(6);
    BEAUTY_PRESETS.forEach(bp=>{
      expect(bp.name).toBeTruthy();
      expect(bp.dot).toMatch(/^#/);
      expect(bp.patch.layout).toBeTruthy();
      expect(bp.patch.title).toBeTruthy();
    });
    expect(BEAUTY_PRESETS[0].patch.layout).toBe('cards');
  });
  it('progress 渲染样式的字段输出进度条骨架（预览可读值）',()=>{
    const c=cfg({fields:[{name:'好感度',sample:'35/100',hint:'',quote:false,render:'progress'}]});
    const doc=buildPreviewDoc(c,{});
    expect(doc).toContain('opg-sb-bar');
    expect(doc).toContain('opg-sb-fill');
    expect(doc).toContain('35/100');
  });
  it('进度条填充逻辑由运行时计算（数据源/骨架在文档中）',()=>{
    const s=buildReplaceString(cfg({fields:[{name:'好感度',sample:'',hint:'',quote:false,render:'progress'}]}),{});
    expect(s).toContain('opg-sb-fill');
    expect(s).toContain('bar.style.width=pct');
  });
  it('字段名悬浮提示（hint 编入 title）',()=>{
    const s=buildReplaceString(cfg({fields:[{name:'好感度',sample:'35/100',hint:'当前好感程度',quote:false,render:'progress'}]}),{});
    expect(s).toContain('title="当前好感程度"');
  });
});

describe('行动方向词库',()=>{
  it('内置 18 个方向，均有定义',()=>{
    expect(ACTION_DIRECTIONS.length).toBe(18);
    ACTION_DIRECTIONS.forEach(d=>{expect(d.k).toBeTruthy();expect(d.d.length).toBeGreaterThan(4)});
  });
  it('方向定义仅列 actionStyles 中用到的方向',()=>{
    const s=buildEntryContent(cfg({mode:'block',actions:true,actionStyles:'平滑,闪回'}));
    expect(s).toContain('- 平滑——');
    expect(s).toContain('- 闪回——');
    expect(s).not.toContain('- 黑暗——');
  });
  it('「超展开」定义中的 {{random}} 宏原样保留（酒馆运行时解析）',()=>{
    const s=buildEntryContent(cfg({mode:'block',actions:true,actionStyles:'超展开'}));
    expect(s).toContain('{{random::大幅深化当前的故事基调');
  });
});
