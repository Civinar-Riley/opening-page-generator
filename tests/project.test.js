/* 工程数据规范化 / 迁移逻辑单元测试 */
import { describe, it, expect } from 'vitest';
import { Project, setUI } from '../src/js/project.js';
import { BLOCK_DEFS, BLOCK_ORDER, defaultProject } from '../src/js/defs.js';

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
  it('缺失的区块字段用默认值补齐',()=>{
    const p={name:'t',blocks:[{type:'welcome',enabled:true}]};
    Project.normalize(p);
    const w=p.blocks.find(b=>b.type==='welcome');
    expect(w.title).toBe(BLOCK_DEFS.welcome.create().title);
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
    expect(pr.wbName).toBeUndefined();
  });
  it('greetings clickAction insert/缺省迁移为 go',()=>{
    const p={name:'t',blocks:[
      {type:'greetings',enabled:true,clickAction:'insert'},
      {type:'greetings',enabled:true},
    ]};
    Project.migrate(p);
    /* normalize 会补齐其他默认区块，需过滤后断言 */
    p.blocks.filter(b=>b.type==='greetings').forEach(b=>expect(b.clickAction).toBe('go'));
  });
  it('greetings 合法的 send 行为保留',()=>{
    const p={name:'t',blocks:[{type:'greetings',enabled:true,clickAction:'send'}]};
    Project.migrate(p);
    expect(p.blocks[0].clickAction).toBe('send');
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
