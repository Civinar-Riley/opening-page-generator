import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/js/utils.js',()=>({$:vi.fn(),$$:vi.fn(()=>[]),esc:s=>String(s),toast:vi.fn()}));
vi.mock('../src/js/project.js',()=>({Project:{cur:null,list:[],load:vi.fn(),save:vi.fn()}}));
vi.mock('../src/js/gen/index.js',()=>({Gen:{build:vi.fn(),prefix:()=> 'opg-test'}}));
vi.mock('../src/js/macros.js',()=>({Macros:{vars:{},resetCache:vi.fn()}}));
vi.mock('../src/js/ui/renderConfig.js',()=>({renderConfig:vi.fn(),renderBlockBody:vi.fn()}));
vi.mock('../src/js/ui/renderExport.js',()=>({renderExport:vi.fn()}));
vi.mock('../src/js/ui/renderAI.js',()=>({renderAI:vi.fn()}));
vi.mock('../src/js/ui/renderNh.js',()=>({renderNh:vi.fn()}));
vi.mock('../src/js/ui/renderHelp.js',()=>({renderHelp:vi.fn()}));
vi.mock('../src/js/ui/extBridge.js',()=>({hasBridge:()=>false}));

import { $ } from '../src/js/utils.js';
import { Project } from '../src/js/project.js';
import { Gen } from '../src/js/gen/index.js';

let UI,activeFrame;
function frame(){
  let srcdoc='';
  return {style:{},writes:0,get srcdoc(){return srcdoc},set srcdoc(value){srcdoc=value;this.writes++}};
}

beforeEach(async()=>{
  vi.stubGlobal('window',{addEventListener:vi.fn(),matchMedia:()=>({matches:false})});
  vi.stubGlobal('document',{addEventListener:vi.fn()});
  vi.stubGlobal('localStorage',{getItem:()=>null});
  const bar={addEventListener:vi.fn(),appendChild:vi.fn()};
  $.mockImplementation(selector=>selector==='#tabs'?bar:selector==='#projectSelect'?{}:selector==='.page.active'?{}:selector==='iframe[id^="previewFrame"]'?activeFrame:null);
  Project.cur=null;
  const {UI:ui}=await import('../src/js/ui/core.js');UI={...ui};
  Project.cur={preview:{mode:'mobile',theme:'dark'}};
  Gen.build.mockReset().mockReturnValue('<div>preview</div>');
  activeFrame=frame();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});

describe('预览 iframe 缓存隔离',()=>{
  it('相同内容首次切到另一个 iframe 时仍应渲染',()=>{
    const live=activeFrame;
    UI.refreshPreview();
    activeFrame=frame();
    UI.refreshPreview();
    expect(live.writes).toBe(1);
    expect(activeFrame.srcdoc).toContain('<div>preview</div>');
  });
  it('预览页切换明暗后返回配置页，实际背景同步到亮色',()=>{
    const live=activeFrame;
    UI.refreshPreview();
    activeFrame=frame();
    Project.cur.preview.theme='light';
    UI.refreshPreview();
    activeFrame=live;
    UI.refreshPreview();
    expect(live.writes).toBe(2);
    expect(live.srcdoc).toContain('background:#f2f2f5');
  });
  it('隐藏页内容有更新后返回配置页，不沿用另一 iframe 的缓存',()=>{
    const live=activeFrame;
    UI.refreshPreview();
    activeFrame=frame();
    Gen.build.mockReturnValue('<div>updated</div>');
    UI.refreshPreview();
    activeFrame=live;
    UI.refreshPreview();
    expect(live.srcdoc).toContain('<div>updated</div>');
  });
  it('同一 iframe 内容未变时不重建，宽度切换仍即时生效',()=>{
    UI.refreshPreview();
    Project.cur.preview.mode='pc';
    UI.refreshPreview();
    expect(activeFrame.writes).toBe(1);
    expect(activeFrame.style.width).toBe('100%');
  });
  it('刷新按钮清除当前 iframe 缓存，相同产物也强制重新渲染',()=>{
    UI.refreshPreview();
    const refresh={addEventListener:vi.fn()};
    activeFrame.addEventListener=vi.fn();
    const original=$.getMockImplementation();
    $.mockImplementation((selector,scope)=>selector==='#btnRefresh'?refresh:selector==='#segDevice'||selector==='#segTheme'?{addEventListener:vi.fn()}:selector==='#fixtureFrame'?activeFrame:original(selector,scope));
    UI.mountPreview({dataset:{}},'fixtureFrame');
    const handler=refresh.addEventListener.mock.calls.find(([name])=>name==='click')[1];
    handler();
    expect(activeFrame.writes).toBe(2);
  });
  it('生成失败后恢复原内容，不让错误页面命中旧缓存',()=>{
    vi.spyOn(console,'error').mockImplementation(()=>{});
    UI.refreshPreview();
    Gen.build.mockImplementationOnce(()=>{throw new Error('fixture failure')});
    UI.refreshPreview();
    expect(activeFrame.srcdoc).toContain('fixture failure');
    UI.refreshPreview();
    expect(activeFrame.srcdoc).toContain('<div>preview</div>');
    expect(activeFrame.srcdoc).not.toContain('fixture failure');
  });
});
