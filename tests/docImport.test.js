import { describe,it,expect } from 'vitest';
import { defaultProject } from '../src/js/defs.js';
import { Gen } from '../src/js/gen/index.js';
import { parseExportDoc, buildRestorePlan, applyRestorePlan, EXPORT_VER } from '../src/js/docImport.js';

/* 24 类可识别区块 + 自由 HTML 全内容工程：导出 → 反向解析 → 应用的字段级往返核对 */
function buildRichProject(){
  const p=defaultProject('往返测试');
  const B=t=>p.blocks.find(b=>b.type===t);
  p.blocks.forEach(b=>{b.enabled=true});
  Object.assign(B('welcome'),{title:'欢迎标题 A&B<C',subtitle:'副标题文本',showEyebrow:true,eyebrow:'眉标文本'});
  Object.assign(B('quote'),{text:'引言正文 X|Y',source:'出处名'});
  Object.assign(B('profile'),{characters:[{name:'角色甲',desc:'甲的简介',tags:'女主,温柔',avatar:'',avatarMode:'manual'},{name:'角色乙',desc:'乙的简介',tags:'',avatar:'https://example.com/b.png',avatarMode:'manual'}]});
  Object.assign(B('gallery'),{images:[{url:'https://example.com/1.png',cap:'图一'},{url:'https://example.com/2.png',cap:''}]});
  Object.assign(B('comic'),{entry:'cover',mode:'paged',title:'第 1 话',cover:'https://example.com/c.jpg',buttonText:'📖 点我',pages:[{url:'https://example.com/p1.png',cap:'页1'},{url:'https://example.com/p2.png',cap:''}]});
  Object.assign(B('greetings'),{cardStyle:'wall',clickAction:'send',buttonText:'开始冒险',showTitle:true,title:'选择入口',placeholderList:'甲线｜甲的描述\n乙线｜乙的描述｜乙的人物',entries:[{cover:'https://example.com/g1.png'},{cover:''}]});
  Object.assign(B('divider'),{style:'wave'});
  Object.assign(B('disclaimer'),{style:'plain',text:'免责文本 <b>注意</b>'});
  Object.assign(B('author'),{style:'card',text:'作者的话正文'});
  Object.assign(B('freehtml'),{html:'<p class="x">自由 <b>HTML</b> 内容</p>'});
  Object.assign(B('clockbar'),{text:'◆ {{date}} · <i>钟</i>'});
  Object.assign(B('randomevent'),{showTitle:true,title:'随机事件',pickMode:'one',lines:'事件一行::带双冒号\n事件二行}}收尾'});
  Object.assign(B('dice'),{label:'攻击判定',expr:'2d6+1'});
  Object.assign(B('countdown'),{title:'距离上线',target:'2030-01-01T00:00:00',doneText:'已上线！'});
  Object.assign(B('timeline'),{showTitle:true,title:'进度',nodes:'序章|启程|done\n终章||lock'});
  Object.assign(B('bgm'),{tracks:[{name:'曲一',url:'https://example.com/a.mp3'},{name:'曲二',url:'https://example.com/b.mp3'}],volume:30,loop:false,showTitle:true,title:'背景音乐'});
  Object.assign(B('fx'),{effect:'snow',count:50,speed:1.5,opacity:0.5});
  Object.assign(B('qa'),{showTitle:true,title:'常见问题',groups:[{name:'📖 基础',items:[{q:'问题一',a:'答案一'}]},{name:'🎭 角色',items:[{q:'问题二',a:'答案二'},{q:'问题三',a:'答案三'}]}]});
  Object.assign(B('changelog'),{showTitle:true,title:'更新日志',lines:'v1.2|2026-01-01|加了个|功能\nv1.0||首发'});
  Object.assign(B('gate'),{theme:'vault',title:'库门紧闭',text:'转动转轮',buttonText:'转动开启',logo:'VAULT-07'});
  Object.assign(B('decode'),{lines:'信号一行\n信号二行'});
  Object.assign(B('gacha'),{title:'命运卡池',buttonText:'点击抽取',cards:'SSR｜剑｜描述A\nR｜尘'});
  Object.assign(B('egg'),{hint:'✦',count:3,lines:'彩蛋一\n彩蛋二'});
  Object.assign(B('blurreveal'),{showTitle:true,title:'揭示',hint:'点我',lines:'揭示一行\n揭示二行'});
  return p;
}

const RICH_TYPES=['welcome','quote','profile','gallery','comic','greetings','divider','disclaimer','author','freehtml','clockbar','randomevent','dice','countdown','timeline','bgm','fx','qa','changelog','gate','decode','gacha','egg','blurreveal'];

describe('docImport 导出反向解析',()=>{
  it('全类型导出→解析→应用字段级往返',()=>{
    const parsed=parseExportDoc(Gen.buildFullDoc(buildRichProject()));
    expect(parsed.ver).toBe(EXPORT_VER);
    const types=new Set(parsed.items.map(i=>i.type));
    RICH_TYPES.forEach(t=>expect(types).toContain(t));
    /* 25 类中 decor 仅作用于背景样式产物为空壳；其余全部认出，无待认领段 */
    expect(types.has('decor')).toBe(false);
    expect(parsed.items.every(i=>i.ok)).toBe(true);
    const p2=defaultProject('恢复目标');
    const sum=applyRestorePlan(p2,parsed,parsed.items.map(i=>i.type));
    expect(sum).toContain('欢迎 / 标题区');
    const B2=t=>p2.blocks.find(b=>b.type===t);
    expect(B2('welcome').title).toBe('欢迎标题 A&B<C');
    expect(B2('welcome').subtitle).toBe('副标题文本');
    expect(B2('welcome').eyebrow).toBe('眉标文本');
    expect(B2('welcome').showEyebrow).toBe(true);
    expect(B2('quote').text).toBe('引言正文 X|Y');
    expect(B2('quote').source).toBe('出处名');
    const chars=B2('profile').characters;
    expect(chars).toHaveLength(2);
    expect(chars[0]).toMatchObject({name:'角色甲',desc:'甲的简介',tags:'女主,温柔',avatar:'',avatarMode:'manual'});
    expect(chars[1]).toMatchObject({name:'角色乙',avatar:'https://example.com/b.png'});
    expect(B2('gallery').images).toEqual([{url:'https://example.com/1.png',cap:'图一'},{url:'https://example.com/2.png',cap:''}]);
    const cm=B2('comic');
    expect(cm.title).toBe('第 1 话');
    expect(cm.cover).toBe('https://example.com/c.jpg');
    expect(cm.entry).toBe('cover');
    expect(cm.mode).toBe('paged');
    expect(cm.pages).toEqual([{url:'https://example.com/p1.png',cap:'页1'},{url:'https://example.com/p2.png',cap:''}]);
    const gr=B2('greetings');
    expect(gr.placeholderList).toBe('甲线｜甲的描述\n乙线｜乙的描述｜乙的人物');
    expect(gr.cardStyle).toBe('wall');
    expect(gr.clickAction).toBe('send');
    expect(gr.buttonText).toBe('开始冒险');
    expect(gr.entries).toEqual([{cover:'https://example.com/g1.png'},{cover:''}]);
    expect(B2('divider').style).toBe('wave');
    expect(B2('disclaimer').text).toBe('免责文本 <b>注意</b>');
    expect(B2('disclaimer').style).toBe('plain');
    expect(B2('author').style).toBe('card');
    expect(B2('author').text).toBe('作者的话正文');
    expect(B2('freehtml').html).toBe('<p class="x">自由 <b>HTML</b> 内容</p>');
    expect(B2('clockbar').text).toBe('◆ {{date}} · <i>钟</i>');
    const re=B2('randomevent');
    expect(re.pickMode).toBe('one');
    expect(re.lines).toBe('事件一行::带双冒号\n事件二行}}收尾');
    expect(B2('dice').label).toBe('攻击判定');
    expect(B2('dice').expr).toBe('2d6+1');
    const cd=B2('countdown');
    expect(cd.title).toBe('距离上线');
    expect(cd.target).toBe('2030-01-01T00:00:00');
    expect(cd.doneText).toBe('已上线！');
    expect(B2('timeline').nodes).toBe('序章|启程|done\n终章||lock');
    const bg=B2('bgm');
    expect(bg.tracks).toEqual([{name:'曲一',url:'https://example.com/a.mp3'},{name:'曲二',url:'https://example.com/b.mp3'}]);
    expect(bg.volume).toBe(30);
    expect(bg.loop).toBe(false);
    expect(bg.title).toBe('背景音乐');
    const fx=B2('fx');
    expect(fx.effect).toBe('snow');
    expect(fx.count).toBe(50);
    expect(fx.speed).toBe(1.5);
    expect(fx.opacity).toBe(0.5);
    const qa=B2('qa');
    expect(qa.groups).toEqual([{name:'📖 基础',items:[{q:'问题一',a:'答案一'}]},{name:'🎭 角色',items:[{q:'问题二',a:'答案二'},{q:'问题三',a:'答案三'}]}]);
    expect(B2('changelog').lines).toBe('v1.2|2026-01-01|加了个|功能\nv1.0||首发');
    const gt=B2('gate');
    expect(gt.theme).toBe('vault');
    expect(gt.title).toBe('库门紧闭');
    expect(gt.buttonText).toBe('转动开启');
    expect(gt.logo).toBe('VAULT-07');
    expect(B2('decode').lines).toBe('信号一行\n信号二行');
    expect(B2('gacha').title).toBe('命运卡池');
    /* v2 快照路径：区块字段原样回填，全角｜不做归一（salvage 才会转半角） */
    expect(B2('gacha').cards).toBe('SSR｜剑｜描述A\nR｜尘');
    const eg=B2('egg');
    expect(eg.lines).toBe('彩蛋一\n彩蛋二');
    expect(eg.count).toBe(3);
    const br=B2('blurreveal');
    expect(br.lines).toBe('揭示一行\n揭示二行');
    expect(br.title).toBe('揭示');
  });

  it('randomevent line 模式多行恢复（shuffle 导出与 line 同形，按 line 恢复产物一致）',()=>{
    const p=defaultProject('行模式');
    p.blocks.forEach(b=>{b.enabled=b.type==='randomevent'});
    Object.assign(p.blocks.find(b=>b.type==='randomevent'),{pickMode:'line',showTitle:false,lines:'行甲\n行乙\n行丙'});
    const parsed=parseExportDoc(Gen.buildFullDoc(p));
    const it=parsed.items.find(i=>i.type==='randomevent');
    expect(it.draft.pickMode).toBe('line');
    expect(it.draft.lines).toBe('行甲\n行乙\n行丙');
  });

  it('greetings salvage 保留空段与全空占位，行与封面按下标对齐',()=>{
    const p=defaultProject('空段');
    p.blocks.forEach(b=>{b.enabled=b.type==='greetings'});
    Object.assign(p.blocks.find(b=>b.type==='greetings'),{
      cardStyle:'wall',placeholderList:'乙线｜｜乙的人物\n｜',
      entries:[{cover:'https://example.com/g1.png'},{cover:'https://example.com/g2.png'}]});
    const parsed=parseExportDoc(Gen.buildFullDoc(p));
    const item=parsed.items.find(i=>i.type==='greetings');
    /* 空描述段保留（filter 掉会静默改写成「乙线｜乙的人物」，人物名错位成描述）；
       全空行以「｜｜」占位（原「｜」与「｜｜」渲染等价不可分辨），两行两封面下标对齐 */
    expect(item.draft.placeholderList).toBe('乙线｜｜乙的人物\n｜｜');
    expect(item.draft.entries).toEqual([{cover:'https://example.com/g1.png'},{cover:'https://example.com/g2.png'}]);
  });

  it('decor 空壳与停用区块不进解析结果',()=>{
    const p=defaultProject('最小工程');
    p.blocks.forEach(b=>{b.enabled=b.type==='welcome'});
    const parsed=parseExportDoc(Gen.buildFullDoc(p));
    const types=parsed.items.map(i=>i.type);
    expect(types).toEqual(['welcome']);
  });

  it('未识别段落整段进自由 HTML 并标注待认领',()=>{
    const html='<!DOCTYPE html><html data-opg-ver="1"><body><div id="opg-test1" class="opg-test1-root"><div class="opg-test1-wrap">\n  <div class="opg-test1-bk0">\n  <div class="opg-test1-mystery">未知内容</div>\n  </div>\n  </div></div></body></html>';
    const parsed=parseExportDoc(html);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].type).toBe('freehtml');
    expect(parsed.items[0].ok).toBe(false);
    const p=defaultProject('兜底');
    applyRestorePlan(p,parsed,['freehtml']);
    const fb=p.blocks.find(b=>b.type==='freehtml');
    expect(fb.enabled).toBe(true);
    expect(fb.html).toContain('opg-test1-mystery');
    expect(fb.html).toContain('手动认领');
  });

  it('无 bk 作用域层的旧导出整段走待认领，不做签名猜测',()=>{
    const html='<div id="opg-old1" class="opg-old1-root"><div class="opg-old1-wrap">\n<div class="opg-old1-glist">旧列表</div>\n  </div></div>';
    const parsed=parseExportDoc(html);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].type).toBe('freehtml');
    expect(parsed.items[0].ok).toBe(false);
  });

  it('非本工具页面直接报错',()=>{
    expect(()=>parseExportDoc('<html><body>hello</body></html>')).toThrow(/opg-/);
    expect(()=>parseExportDoc('')).toThrow(/opg-/);
  });

  it('同类多实例：v2 快照逐实例保留不合并；旧导出（剥快照）salvage 合并行、标量首见生效',()=>{
    const p=defaultProject('多实例');
    p.blocks.forEach(b=>{b.enabled=b.type==='greetings'||b.type==='quote'});
    p.blocks.find(b=>b.type==='quote').text='第一条引言';
    p.blocks.push({type:'greetings',enabled:true,placeholderList:'额外线｜额外描述',clickAction:'go'});
    const doc=Gen.buildFullDoc(p);
    /* v2：两个 greetings 实例作为独立区块原样落位（多实例不再被迫合并） */
    const parsed=parseExportDoc(doc);
    const p2=defaultProject('快照目标');
    applyRestorePlan(p2,parsed,['greetings','quote']);
    const greets2=p2.blocks.filter(b=>b.type==='greetings');
    expect(greets2).toHaveLength(2);
    expect(greets2[0].enabled).toBe(true);
    expect(greets2[1].placeholderList).toContain('额外线｜额外描述');
    const qu2=p2.blocks.find(b=>b.type==='quote');
    expect(qu2.enabled).toBe(true);
    expect(qu2.text).toBe('第一条引言');
    /* 旧导出（剥掉配置快照模拟 v1）：salvage 路径合并两实例行回单区块 */
    const oldDoc=doc.replace(/<script type="application\/json" id="opg-cfg-json">[\s\S]*?<\/script>/,'');
    const parsedOld=parseExportDoc(oldDoc);
    const greets=parsedOld.items.filter(i=>i.type==='greetings');
    expect(greets).toHaveLength(2);
    const p3=defaultProject('合并目标');
    applyRestorePlan(p3,parsedOld,['greetings','quote']);
    const gr=p3.blocks.find(b=>b.type==='greetings');
    expect(gr.enabled).toBe(true);
    expect(gr.placeholderList).toContain('额外线｜额外描述');
    /* 首实例恢复出的正是 create() 默认样本（被替换而非拼积），第二实例追加 */
    expect(gr.placeholderList.split('\n')).toHaveLength(4);
    expect(p3.blocks.find(b=>b.type==='quote').text).toBe('第一条引言');
  });

  it('v2 快照完整往返：salvage 认不回的排版/样式/开关配置原样恢复',()=>{
    const p=defaultProject('快照往返');
    const B=t=>p.blocks.find(b=>b.type===t);
    p.blocks.forEach(b=>{b.enabled=true});
    Object.assign(B('welcome'),{decoStyle:'stamp',showEyebrow:true,eyebrow:'E'});
    Object.assign(B('gallery'),{cols:'4'});
    Object.assign(B('clockbar'),{color:'#ff8800',size:22,align:'left',glow:false});
    Object.assign(B('greetings'),{cardStyle:'list',clickAction:'insert',excludedTags:'status',
      entries:[{title:'宁静的清晨',cover:'https://example.com/g1.png',audio:'https://example.com/a.mp3'}]});
    const parsed=parseExportDoc(Gen.buildFullDoc(p));
    expect(parsed.cfg).toBeTruthy();
    expect(parsed.cfg.theme).toEqual(p.theme);
    const p2=defaultProject('恢复目标');
    applyRestorePlan(p2,parsed,['welcome','gallery','clockbar','greetings']);
    const B2=t=>p2.blocks.find(b=>b.type===t);
    expect(B2('welcome').decoStyle).toBe('stamp');
    expect(B2('welcome').showEyebrow).toBe(true);
    expect(B2('gallery').cols).toBe('4');
    expect(B2('clockbar')).toMatchObject({color:'#ff8800',size:22,align:'left',glow:false});
    const gr=B2('greetings');
    expect(gr.cardStyle).toBe('list');
    expect(gr.clickAction).toBe('insert');
    expect(gr.excludedTags).toBe('status');
    /* 封面/音轨连绑定标题一起原样回位（标题绑定跨导出仍然命中） */
    expect(gr.entries).toEqual([{title:'宁静的清晨',cover:'https://example.com/g1.png',audio:'https://example.com/a.mp3'}]);
  });

  it('勾选摘要：v2 标注完整恢复；旧导出逐区块点名按默认项',()=>{
    const p=defaultProject('摘要');
    p.blocks.forEach(b=>{b.enabled=b.type==='gallery'||b.type==='clockbar'});
    Object.assign(p.blocks.find(b=>b.type==='gallery'),{cols:'2',images:[{url:'a.png',cap:''},{url:'b.png',cap:''}]});
    const plan=buildRestorePlan(parseExportDoc(Gen.buildFullDoc(p)));
    expect(plan.items.find(i=>i.id==='gallery').detail).toContain('完整恢复');
    expect(plan.recognized).toBe(plan.total);
    const oldDoc=Gen.buildFullDoc(p).replace(/<script type="application\/json" id="opg-cfg-json">[\s\S]*?<\/script>/,'');
    const planOld=buildRestorePlan(parseExportDoc(oldDoc));
    expect(planOld.items.find(i=>i.id==='gallery').detail).toContain('列数按默认');
    expect(planOld.items.find(i=>i.id==='clockbar').detail).toContain('颜色/字号/对齐/辉光按默认');
  });

  it('v2 快照损坏（JSON 不合法）回落 salvage 轻量恢复',()=>{
    const doc=Gen.buildFullDoc(buildRichProject())
      .replace(/(<script type="application\/json" id="opg-cfg-json">)[\s\S]*?(<\/script>)/,'$1not-json{$2');
    const parsed=parseExportDoc(doc);
    expect(parsed.cfg).toBe(null);
    expect(parsed.items.length).toBeGreaterThan(0);
    const p2=defaultProject('兜底');
    const sum=applyRestorePlan(p2,parsed,['welcome']);
    expect(sum).toContain('欢迎 / 标题区');
    expect(p2.blocks.find(b=>b.type==='welcome').title).toBe('欢迎标题 A&B<C');
  });

  it('buildRestorePlan 按类型聚合并给出勾选摘要',()=>{
    const parsed=parseExportDoc(Gen.buildFullDoc(buildRichProject()));
    const plan=buildRestorePlan(parsed);
    /* v2 快照路径：total=快照区块数（含 decor 空壳与停用块，均完整还原），不再等于 salvage 识别数 */
    expect(plan.total).toBe(parsed.cfg.blocks.length);
    expect(plan.recognized).toBe(plan.total);
    const greet=plan.items.find(i=>i.id==='greetings');
    expect(greet.label).toContain('开场白选择区');
    expect(greet.detail).toContain('完整恢复');
    expect(greet.detail).toContain('2 条开场白');
    expect(greet.detail).toContain('1 张封面');
  });
});
