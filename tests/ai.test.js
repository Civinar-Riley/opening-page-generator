import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {nodes}=vi.hoisted(()=>({nodes:new Map()}));
vi.mock('../src/js/utils.js',async importOriginal=>({...await importOriginal(),$:selector=>nodes.get(selector),toast:vi.fn()}));
vi.mock('../src/js/project.js',()=>({Project:{cur:null,save:vi.fn(),saveDebounced:vi.fn()}}));
vi.mock('../src/js/ui/core.js',()=>({UI:{renderConfig:vi.fn(),refreshPreview:vi.fn(),renderAI:vi.fn()}}));
vi.mock('../src/js/ui/extBridge.js',()=>({resolveAiChannel:()=> 'custom',tavernGenerate:vi.fn()}));

import { defaultProject } from '../src/js/defs.js';
import { Project } from '../src/js/project.js';
import { renderAI } from '../src/js/ui/renderAI.js';

function control(){
  return {value:'',checked:false,type:'password',textContent:'',className:'',listeners:{},
    addEventListener(name,fn){this.listeners[name]=fn},
    change(){return this.listeners.change.call(this)},querySelectorAll(){return []}};
}
function render(p){
  Project.cur=p;
  renderAI();
  nodes.get('#aiRemember').checked=p.ai.rememberKey!==false;
  nodes.get('#aiStylePrompt').value='fixture style';
}
function remember(checked){const input=nodes.get('#aiRemember');input.checked=checked;input.change()}
async function generate(){await nodes.get('#aiGenStyle').onclick()}

beforeEach(()=>{
  nodes.clear();
  for(const id of ['aiCol','aiModel','aiBase','aiKey','aiRemember','aiKeyEye','aiFetchModels','aiOut','aiStatus','aiGenHtml','aiGenStyle','aiPrompt','aiStylePrompt'])nodes.set('#'+id,control());
  Object.defineProperty(nodes.get('#aiCol'),'innerHTML',{set(html){nodes.get('#aiKey').value=html.match(/id="aiKey"[^>]*value="([^"]*)"/)[1]}});
  const data=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"{}"}}]}\n\n');
  vi.stubGlobal('fetch',vi.fn(async()=>{
    let done=false;
    return {ok:true,body:{getReader:()=>({read:async()=>done?{done:true}:(done=true,{done:false,value:data})})}};
  }));
});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()});

describe('AI Key 会话与记住开关',()=>{
  it('取消记住已加载的 Key 后，清空持久化值但仍可生成',async()=>{
    const p=defaultProject('key-toggle');p.ai.apiKey='sk-fixture';
    render(p);
    remember(false);
    expect(p.ai.apiKey).toBe('');
    expect(nodes.get('#aiKey').value).toBe('sk-fixture');
    await generate();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-fixture');
    render(p);
    expect(nodes.get('#aiKey').value).toBe('sk-fixture');
    remember(true);
    expect(p.ai.apiKey).toBe('sk-fixture');
  });
  it('重新勾选记住时使用当前工程输入框，不回填之前输入的旧 Key',()=>{
    const a=defaultProject('A');
    render(a);
    nodes.get('#aiKey').value='sk-A';nodes.get('#aiKey').change();
    const b=defaultProject('B');b.ai.apiKey='sk-B';
    render(b);
    remember(false);
    remember(true);
    expect(b.ai.apiKey).toBe('sk-B');
  });
  it('会话 Key 按工程隔离，不带入另一个工程的接口请求',async()=>{
    const a=defaultProject('A');a.ai.rememberKey=false;
    render(a);
    nodes.get('#aiKey').value='sk-session-A';nodes.get('#aiKey').change();
    const b=defaultProject('B');b.ai.rememberKey=false;b.ai.baseURL='https://other.example.invalid/v1';
    render(b);
    expect(nodes.get('#aiKey').value).toBe('');
    await generate();
    expect(fetch).not.toHaveBeenCalled();
    render(a);
    expect(nodes.get('#aiKey').value).toBe('sk-session-A');
    await generate();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-session-A');
    expect(a.ai.apiKey).toBe('');
  });
});
