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
  it('音符粒子使用较大字号',()=>{
    const html=Gen.build(proj([{type:'fx',enabled:true,effect:'note',count:5,speed:1,opacity:.8}]),{isPreview:false});
    expect(html).toMatch(/type==='note'\?12\+Math\.random\(\)\*10/);
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
