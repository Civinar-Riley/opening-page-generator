/* 工程数据规范化 / 迁移逻辑单元测试 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Project, setUI } from '../src/js/project.js';
import { BLOCK_DEFS, BLOCK_ORDER, BUILTIN_TEMPLATES, THEME_PRESETS, defaultProject } from '../src/js/defs.js';
import { contrastRatio } from '../src/js/utils.js';

describe('Project.normalize 规范化',()=>{
  it('空工程补齐全部默认区块（未启用）',()=>{
    const p={name:'测试'};
    Project.normalize(p);
    expect(Array.isArray(p.blocks)).toBe(true);
    BLOCK_ORDER.forEach(t=>{
      expect(p.blocks.some(b=>b.type===t),`缺少区块类型 ${t}`).toBe(true);
    });
    p.blocks.forEach(b=>expect(b.enabled).toBe(false));
  });

  it('ai.rememberKey 缺失补默认 true（v1.19 Key 记住开关）',()=>{
    const p={name:'测试',ai:{baseURL:'https://x/v1'}};
    Project.normalize(p);
    expect(p.ai.rememberKey).toBe(true);
    const q={name:'测试',ai:{rememberKey:false}};
    Project.normalize(q);
    expect(q.ai.rememberKey).toBe(false);
  });
  it('存量工程缺新增区块时补入且默认停用（v1.9 五区块）',()=>{
    const p=defaultProject('t');
    p.blocks=p.blocks.filter(b=>!['changelog','gate','decode','gacha','egg'].includes(b.type));
    const before=p.blocks.length;
    Project.normalize(p);
    expect(p.blocks.length).toBe(before+5);
    p.blocks.filter(b=>['changelog','gate','decode','gacha','egg'].includes(b.type))
      .forEach(b=>expect(b.enabled).toBe(false));
  });
  it('缺失的区块字段用默认值补齐',()=>{
    const p={name:'t',blocks:[{type:'welcome',enabled:true}]};
    Project.normalize(p);
    const w=p.blocks.find(b=>b.type==='welcome');
    expect(w.title).toBe(BLOCK_DEFS.welcome.create().title);
  });
  it('gate 缺 theme 等字段补默认值（旧工程兼容）',()=>{
    const p={name:'t',blocks:[{type:'gate',enabled:true}]};
    Project.normalize(p);
    const g=p.blocks.find(b=>b.type==='gate');
    expect(g.theme).toBe('classic');
    expect(g.leaveText).toBe(BLOCK_DEFS.gate.create().leaveText);
    expect(g.logo).toBe(BLOCK_DEFS.gate.create().logo);
  });
  it('comic 缺 entry/mode/pages 等字段补默认值（旧工程兼容）',()=>{
    const p={name:'t',blocks:[{type:'comic',enabled:true}]};
    Project.normalize(p);
    const c=p.blocks.find(b=>b.type==='comic');
    const proto=BLOCK_DEFS.comic.create();
    expect(c.entry).toBe(proto.entry);
    expect(c.mode).toBe(proto.mode);
    expect(c.cover).toBe('');
    expect(Array.isArray(c.pages)).toBe(true);
  });
  it('已有区块的 enabled 不被覆盖',()=>{
    const p={name:'t',blocks:[{type:'welcome',enabled:true}]};
    Project.normalize(p);
    expect(p.blocks.find(b=>b.type==='welcome').enabled).toBe(true);
  });
  it('theme 缺失字段补齐',()=>{
    const p={name:'t',theme:{primary:'#ffffff'}};
    Project.normalize(p);
    expect(p.theme.accent).toBeDefined();
    expect(p.theme.radius).toBeDefined();
    expect(p.theme.primary).toBe('#ffffff');
  });
  it('profile 缺 characters 数组补默认',()=>{
    const p={name:'t',blocks:[{type:'profile',enabled:true}]};
    Project.normalize(p);
    const pr=p.blocks.find(b=>b.type==='profile');
    expect(Array.isArray(pr.characters)).toBe(true);
    expect(pr.characters.length).toBeGreaterThan(0);
  });
  it('macros 缺省补 char/user',()=>{
    const p={name:'t'};
    Project.normalize(p);
    expect(p.macros.some(m=>m.k==='char')).toBe(true);
    expect(p.macros.some(m=>m.k==='user')).toBe(true);
  });
  it('preview 状态补齐',()=>{
    const p={name:'t'};
    Project.normalize(p);
    expect(p.preview.mode).toBeDefined();
    expect(p.preview.theme).toBeDefined();
  });
});

describe('Project.migrate 旧版迁移',()=>{
  it('未知区块类型被过滤',()=>{
    const p={name:'t',blocks:[{type:'no_such',enabled:true}]};
    Project.migrate(p);
    expect(p.blocks.some(b=>b.type==='no_such')).toBe(false);
  });
  it('profile 旧占位字段迁移为 characters',()=>{
    const p={name:'t',blocks:[{type:'profile',enabled:true,
      placeholderName:'旧角色',placeholderDesc:'旧简介',placeholderTags:'a,b',avatarUrl:'http://x'}]};
    Project.migrate(p);
    const pr=p.blocks.find(b=>b.type==='profile');
    expect(pr.characters[0].name).toBe('旧角色');
    expect(pr.characters[0].desc).toBe('旧简介');
    expect(pr.characters[0].tags).toBe('a,b');
    expect(pr.characters[0].avatar).toBe('http://x');
    expect(pr.placeholderName).toBeUndefined();
  });
  it('greetings 仅缺省或空值点击行为补为 go',()=>{
    const p={name:'t',blocks:[
      {type:'greetings',enabled:true},
      {type:'greetings',enabled:true,clickAction:null},
      {type:'greetings',enabled:true,clickAction:''},
    ]};
    Project.migrate(p);
    p.blocks.filter(b=>b.type==='greetings').forEach(b=>expect(b.clickAction).toBe('go'));
  });
  it.each(['insert','send','go','button'])('greetings 显式 %s 行为多次迁移仍保留',clickAction=>{
    const p={name:'t',blocks:[{type:'greetings',enabled:true,clickAction}]};
    Project.migrate(p);
    Project.migrate(p);
    expect(p.blocks[0].clickAction).toBe(clickAction);
  });
});

describe('defaultProject',()=>{
  it('返回规范结构',()=>{
    const p=defaultProject('示例');
    expect(p.name).toBe('示例');
    expect(Array.isArray(p.blocks)).toBe(true);
    expect(p.blocks.length).toBeGreaterThan(0);
  });
  it('示例工程含启用的区块',()=>{
    const p=defaultProject('示例工程');
    expect(p.blocks.some(b=>b.enabled)).toBe(true);
  });
});

describe('撤销历史隔离',()=>{
  it('切换工程后 resetHistory 阻止跨工程恢复',()=>{
    const origSave=Project.save,origDeb=Project.saveDebounced;
    Project.save=()=>{};Project.saveDebounced=()=>{};
    setUI({renderAll(){}});
    try{
      /* 工程 A：两次快照，可撤销一步 */
      Project.cur={id:'a',name:'A',blocks:[{type:'divider',enabled:true,text:'A1'}]};
      Project.saveSnapshot();
      Project.cur.blocks[0].text='A2';
      Project.saveSnapshot();
      expect(Project.undo()).toBe(true);
      expect(Project.cur.blocks[0].text).toBe('A1');
      /* 模拟切换到工程 B：必须 resetHistory，否则 undo 会把 A 的区块写进 B */
      Project.cur={id:'b',name:'B',blocks:[{type:'divider',enabled:true,text:'B1'}]};
      Project.resetHistory();
      expect(Project.undo()).toBe(false);
      expect(Project.redo()).toBe(false);
      expect(Project.cur.blocks[0].text).toBe('B1');
    }finally{
      Project.save=origSave;Project.saveDebounced=origDeb;
    }
  });
});

describe('工程导出脱敏',()=>{
  it('exportData 剔除 apiKey/keyEnc 且不影响原工程',()=>{
    const orig=Project.cur;
    Project.cur={name:'t',ai:{baseURL:'https://x',apiKey:'sk-secret',keyEnc:'ENC',model:'m',keyMode:'plain'}};
    try{
      const out=Project.exportData();
      expect(out.ai.apiKey).toBeUndefined();
      expect(out.ai.keyEnc).toBeUndefined();
      expect(out.ai.baseURL).toBe('https://x');
      expect(out.ai.model).toBe('m');
      expect(Project.cur.ai.apiKey).toBe('sk-secret');
    }finally{Project.cur=orig}
  });
});

describe('快照纳入区块配置',()=>{
  it('undo/redo 双向恢复 blocks',()=>{
    const origSave=Project.save,origDeb=Project.saveDebounced;
    Project.save=()=>{};Project.saveDebounced=()=>{};
    setUI({renderAll(){}});
    try{
      Project.cur={id:'s',name:'S',blocks:[{type:'welcome',title:'旧标题'}]};
      Project.resetHistory();
      Project.cur.blocks.push({type:'quote',text:'新引言'});
      Project.saveSnapshot();
      expect(Project.cur.blocks.length).toBe(2);
      expect(Project.undo()).toBe(true);
      expect(Project.cur.blocks.length).toBe(1);
      expect(Project.cur.blocks[0].title).toBe('旧标题');
      expect(Project.redo()).toBe(true);
      expect(Project.cur.blocks.length).toBe(2);
    }finally{Project.save=origSave;Project.saveDebounced=origDeb}
  });
});

describe('输入历史与工程往返保存',()=>{
  let original;
  beforeEach(()=>{
    original={...Project};
    vi.useFakeTimers();
    const storage=new Map();
    vi.stubGlobal('localStorage',{
      getItem:k=>storage.get(k)??null,
      setItem:vi.fn((k,v)=>storage.set(k,String(v))),
    });
    Project.list=[defaultProject('A')];Project.cur=Project.list[0];Project.templates=[];
    Project._svT=null;Project._resetting=false;
    setUI({renderAll(){}});
    Project.resetHistory();
  });
  afterEach(()=>{
    vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();
    Object.assign(Project,original);setUI(undefined);
  });

  it.each(['insert','send','go'])('%s 经导出迁移和保存加载后均保持不变',clickAction=>{
    Project.cur.blocks.find(b=>b.type==='greetings').clickAction=clickAction;
    const imported=Project.exportData();
    Project.migrate(imported);
    expect(imported.blocks.find(b=>b.type==='greetings').clickAction).toBe(clickAction);
    Project.save();Project.load();
    expect(Project.cur.blocks.find(b=>b.type==='greetings').clickAction).toBe(clickAction);
    expect(JSON.parse(localStorage.getItem(Project.LS_KEY))[0].blocks.find(b=>b.type==='greetings').clickAction).toBe(clickAction);
  });

  it('输入后不足 600ms 就添加区块，撤销只移除新增区块',()=>{
    const title=Project.cur.blocks[0].title,n=Project.cur.blocks.length;
    Project.cur.blocks[0].title='刚编辑的标题';Project.saveDebounced();
    vi.advanceTimersByTime(100);
    Project.cur.blocks.push({type:'quote',enabled:true,text:'新引言'});
    Project.save();Project.saveSnapshot();
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks).toHaveLength(n);
    expect(Project.cur.blocks[0].title).toBe('刚编辑的标题');
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe(title);
    expect(Project.redo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('刚编辑的标题');
    expect(Project.redo()).toBe(true);
    expect(Project.cur.blocks).toHaveLength(n+1);
  });

  it('输入立即记录，同一防抖批次合并，间隔 600ms 后独立记录',()=>{
    const title=Project.cur.blocks[0].title;
    Project.cur.blocks[0].title='第一个字';Project.saveDebounced();
    expect(Project._history).toHaveLength(2);
    expect(Project._history[1].blocks[0].title).toBe('第一个字');
    expect(localStorage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    Project.cur.blocks[0].title='完整一句';Project.saveDebounced();
    expect(Project._history).toHaveLength(2);
    expect(Project._history[0].blocks[0].title).toBe(title);
    expect(Project._history[1].blocks[0].title).toBe('完整一句');
    vi.advanceTimersByTime(599);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(JSON.parse(localStorage.getItem(Project.LS_KEY))[0].blocks[0].title).toBe('完整一句');
    expect(Project._history).toHaveLength(2);
    Project.cur.blocks[0].title='下一批输入';Project.saveDebounced();
    expect(Project._history).toHaveLength(3);
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('完整一句');
  });

  it('结构快照结束输入合并；重复快照去重但下一次输入仍独立',()=>{
    Project.cur.blocks[0].title='批次一';Project.saveDebounced();
    Project.saveSnapshot();Project.saveSnapshot();
    expect(Project._history).toHaveLength(2);
    Project.cur.blocks[0].title='批次二';Project.saveDebounced();
    expect(Project._history).toHaveLength(3);
    Project.cur.blocks.push({type:'quote',enabled:true,text:'结构操作'});
    Project.saveSnapshot();Project.saveSnapshot();
    expect(Project._history).toHaveLength(4);
    Project.cur.blocks[0].title='结构操作后的输入';Project.saveDebounced();
    expect(Project._history).toHaveLength(5);
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('批次二');
    expect(Project.cur.blocks.at(-1).text).toBe('结构操作');
  });

  it('撤销后新输入立即截断 redo，不会被重做覆盖',()=>{
    const title=Project.cur.blocks[0].title;
    Project.cur.blocks[0].title='旧分支';Project.saveSnapshot();
    expect(Project.undo()).toBe(true);
    Project.cur.blocks[0].title='新分支';Project.saveDebounced();
    expect(Project.redo()).toBe(false);
    expect(Project.cur.blocks[0].title).toBe('新分支');
    vi.advanceTimersByTime(600);
    expect(Project.redo()).toBe(false);
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe(title);
    expect(Project.redo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('新分支');
  });

  it('仅保存或重复快照不增加历史，也不截断 redo',()=>{
    Project.cur.blocks[0].title='待重做';Project.saveSnapshot();
    Project.undo();
    const history=JSON.stringify(Project._history),idx=Project._historyIdx;
    Project.save();Project.saveDebounced();Project.saveSnapshot();
    vi.advanceTimersByTime(600);
    expect(JSON.stringify(Project._history)).toBe(history);
    expect(Project._historyIdx).toBe(idx);
    expect(Project.redo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('待重做');
  });

  it('ai/macros/preview 等非主题非区块输入不生成历史，重做也不回退这些字段（v1.24 主题已单独入栈）',()=>{
    Project.cur.blocks[0].title='待重做';Project.saveSnapshot();Project.undo();
    const history=JSON.stringify(Project._history);
    Project.cur.ai.baseURL='https://example.test/v1';
    Project.cur.macros[0].v='新宏值';
    Project.cur.preview.theme='light';
    Project.saveDebounced();vi.advanceTimersByTime(600);
    expect(JSON.stringify(Project._history)).toBe(history);
    expect(Project.redo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('待重做');
    expect(Project.cur.ai.baseURL).toBe('https://example.test/v1');
    expect(Project.cur.macros[0].v).toBe('新宏值');
    expect(Project.cur.preview.theme).toBe('light');
  });

  it('主题输入生成历史并截断 redo（v1.24 主题进撤销栈）',()=>{
    Project.cur.blocks[0].title='待重做';Project.saveSnapshot();Project.undo();
    Project.cur.theme.primary='#123456';
    Project.saveDebounced();vi.advanceTimersByTime(600);
    expect(Project.redo()).toBe(false); /* 新输入截断 redo，与区块输入同契约 */
    expect(Project.undo()).toBe(true);
    expect(Project.cur.theme.primary).not.toBe('#123456'); /* 撤销回退主题 */
  });

  it('undo/redo 的防抖保存不生成历史，且终止此前输入批次',()=>{
    Project.cur.blocks[0].title='编辑值';Project.saveDebounced();
    const history=JSON.stringify(Project._history);
    expect(Project.undo()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(JSON.stringify(Project._history)).toBe(history);
    expect(Project._historyIdx).toBe(0);
    expect(Project.redo()).toBe(true);
    expect(JSON.stringify(Project._history)).toBe(history);
    /* 紧接重做输入：不能把重做的快照当成仍在输入中的批次覆盖 */
    Project.cur.blocks[0].title='重做后输入';Project.saveDebounced();
    expect(Project._history).toHaveLength(3);
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('编辑值');
    vi.advanceTimersByTime(600);
    expect(Project.redo()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(Project.cur.blocks[0].title).toBe('重做后输入');
    expect(Project._history).toHaveLength(3);
  });

  it('undo/redo 重渲染即使补齐 block 字段，也不能由保存写入新历史',()=>{
    Project.cur.blocks[0].title='待重做';Project.saveSnapshot();
    const history=JSON.stringify(Project._history);
    setUI({renderAll(){Project.cur.blocks[0].subtitle='渲染补齐'}});
    expect(Project.undo()).toBe(true);
    expect(JSON.stringify(Project._history)).toBe(history);
    expect(Project.redo()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(JSON.stringify(Project._history)).toBe(history);
    expect(Project.cur.blocks[0].title).toBe('待重做');
  });

  it('输入历史仍受 MAX_HISTORY 限制，合并与撤销不越界',()=>{
    for(let i=1;i<=Project.MAX_HISTORY+3;i++){
      Project.cur.blocks[0].title=String(i);Project.saveDebounced();
      vi.advanceTimersByTime(600);
    }
    expect(Project._history).toHaveLength(Project.MAX_HISTORY);
    expect(Project._historyIdx).toBe(Project.MAX_HISTORY-1);
    for(let i=1;i<Project.MAX_HISTORY;i++)expect(Project.undo()).toBe(true);
    expect(Project.undo()).toBe(false);
    expect(Project.cur.blocks[0].title).toBe('4');
    for(let i=1;i<Project.MAX_HISTORY;i++)expect(Project.redo()).toBe(true);
    expect(Project.redo()).toBe(false);
    expect(Project.cur.blocks[0].title).toBe(String(Project.MAX_HISTORY+3));
  });

  it('输入防抖未结束时切工程，B 的首轮输入不能合并到 A 或覆盖 B 基线',()=>{
    const a=Project.cur,b=defaultProject('B'),titleB=b.blocks[0].title;
    Project.list.push(b);
    a.blocks[0].title='A 的输入';Project.saveDebounced();
    Project.select(b.id);
    expect(Project.undo()).toBe(false);
    expect(Project.redo()).toBe(false);
    b.blocks[0].title='B 的输入';Project.saveDebounced();
    expect(Project._history).toHaveLength(2);
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe(titleB);
    expect(Project.redo()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(a.blocks[0].title).toBe('A 的输入');
    Project.select(a.id);
    expect(Project.undo()).toBe(false);
    expect(Project.redo()).toBe(false);
    expect(Project.cur.blocks[0].title).toBe('A 的输入');
    const saved=JSON.parse(localStorage.getItem(Project.LS_KEY));
    expect(saved.find(p=>p.id===b.id).blocks[0].title).toBe('B 的输入');
  });

  it('重复 load 重建当前基线，不保留此前工程或待重做历史',()=>{
    Project.cur.blocks[0].title='已保存';Project.saveSnapshot();Project.save();
    Project.cur.blocks[0].title='未落盘输入';Project.saveDebounced();
    Project.load();
    expect(Project.cur.blocks[0].title).toBe('已保存');
    expect(Project._history).toHaveLength(1);
    expect(Project.undo()).toBe(false);
    expect(Project.redo()).toBe(false);
    Project.cur.blocks[0].title='加载后输入';Project.saveDebounced();
    expect(Project.undo()).toBe(true);
    expect(Project.cur.blocks[0].title).toBe('已保存');
    Project.load();vi.advanceTimersByTime(600);
    expect(Project._history).toHaveLength(1);
    expect(Project.undo()).toBe(false);
    expect(Project.redo()).toBe(false);
  });
});

describe('背景上收 _hoistBg（v1.24 背景归主题）',()=>{
  it('启用装饰区的旧工程 bg 上收进 theme.bg 并从区块剔除',()=>{
    const p={blocks:[
      {type:'decor',enabled:true,bgType:'gradient',bgColor:'#112233',bgColor2:'#445566',bgImage:'',borderStyle:'solid',pattern:'stars'},
      {type:'welcome',enabled:true},
    ]};
    Project.migrate(p);
    expect(p.theme.bg).toEqual({type:'gradient',color:'#112233',color2:'#445566',image:''});
    expect(p.blocks[0].bgType).toBeUndefined();
    expect(p.blocks[0].bgColor).toBeUndefined();
    expect(p.blocks[0].borderStyle).toBe('solid'); /* 装饰区自有字段保留 */
  });
  it('装饰区停用/缺失时回落旧扁平兜底色（与旧渲染 fallback 一致）',()=>{
    const off={blocks:[{type:'decor',enabled:false,bgType:'gradient',bgColor:'#aabbcc',bgColor2:'#ddeeff'}]};
    Project.migrate(off);
    expect(off.theme.bg).toEqual({type:'solid',color:'#14141e'});
    const none={blocks:[{type:'welcome',enabled:true}]};
    Project.migrate(none);
    expect(none.theme.bg).toEqual({type:'solid',color:'#14141e'});
  });
  it('已有 theme.bg 的工程不被覆写，decor 残留字段仍被清理（幂等）',()=>{
    const p={theme:{bg:{type:'solid',color:'#123456'}},blocks:[{type:'decor',enabled:true,bgType:'gradient',bgColor:'#aabbcc',bgColor2:'#ddeeff'}]};
    Project.migrate(p);
    expect(p.theme.bg).toEqual({type:'solid',color:'#123456'});
    expect(p.blocks[0].bgType).toBeUndefined();
  });
  it('官方模板建工程：decor bg 走同一条上收路进 theme.bg',()=>{
    const t=BUILTIN_TEMPLATES.map(t=>Project.builtinTemplateProject(t,'x'))
      .find(p=>p.theme.bg&&p.theme.bg.type==='gradient'&&p.theme.bg.color!=='#1a1a2e');
    expect(t).toBeTruthy(); /* 12 套模板各带专属渐变背景 */
    expect(t.blocks.find(b=>b.type==='decor').bgType).toBeUndefined();
  });
});

describe('撤销栈纳入主题（v1.24）',()=>{
  it('saveSnapshot 记录 theme，undo/redo 双向恢复',()=>{
    const origSave=Project.save,origDeb=Project.saveDebounced;
    Project.save=()=>{};Project.saveDebounced=()=>{};
    setUI({renderAll(){}});
    try{
      Project.cur={id:'th',name:'T',theme:{primary:'#111111',accent:'#222222'},blocks:[{type:'divider',enabled:true}]};
      Project.resetHistory();
      Project.cur.theme.primary='#333333';
      Project.saveSnapshot();
      expect(Project.cur.theme.primary).toBe('#333333');
      expect(Project.undo()).toBe(true);
      expect(Project.cur.theme.primary).toBe('#111111');
      expect(Project.redo()).toBe(true);
      expect(Project.cur.theme.primary).toBe('#333333');
    }finally{Project.save=origSave;Project.saveDebounced=origDeb}
  });
  it('无 theme 键的旧格式快照恢复时不覆盖当前主题',()=>{
    const origSave=Project.save,origDeb=Project.saveDebounced;
    Project.save=()=>{};Project.saveDebounced=()=>{};
    setUI({renderAll(){}});
    try{
      Project.cur={id:'old',name:'O',theme:{primary:'#111111'},blocks:[{type:'divider',enabled:true}]};
      /* 双条目旧格式历史（均无 theme 键），栈顶为当前区块态 */
      Project._history=[{blocks:[{type:'welcome',enabled:true}]},{blocks:[{type:'divider',enabled:true}]}];
      Project._historyIdx=1;
      expect(Project.undo()).toBe(true);
      expect(Project.cur.blocks[0].type).toBe('welcome');
      expect(Project.cur.theme.primary).toBe('#111111');
    }finally{Project.save=origSave;Project.saveDebounced=origDeb}
  });
});

describe('主题预设（v1.24 整套观感包）',()=>{
  it('6 套预设均带背景且文字色对底色对比度达标（≥4.5:1）',()=>{
    for(const t of THEME_PRESETS){
      expect(t.theme.bg,`${t.name} 缺背景`).toBeTruthy();
      const bg=t.theme.bg.type==='gradient'?(t.theme.bg.color||''):t.theme.bg.color;
      const cr=contrastRatio(t.theme.textColor,bg);
      expect(cr,`${t.name} 文字对比度 ${cr}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('defaultProject theme 含 bg 与 presetRef 默认值',()=>{
    const p=defaultProject('t');
    expect(p.theme.bg).toEqual({type:'gradient',color:'#1a1a2e',color2:'#2d1b3d'});
    expect(p.theme.presetRef).toBe('');
  });
});
