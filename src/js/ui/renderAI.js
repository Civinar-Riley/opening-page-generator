/* AI 助手页渲染 */
import { $, esc, toast } from '../utils.js';
import { BLOCK_DEFS } from '../defs.js';
import { Project } from '../project.js';
import { UI } from './core.js';

export function renderAI(){
  const p=Project.cur,col=$('#aiCol');
  col.innerHTML=`
    <div class="card">
      <h3>🤖 AI 助手（可选）<span class="hint">OpenAI 兼容接口 · 仅本工具内使用，不写入导出代码</span></h3>
      <div class="row3">
        <div><label>API Base URL</label><input id="aiBase" value="${esc(p.ai.baseURL)}" placeholder="https://api.openai.com/v1"></div>
        <div><label>API Key（仅明文本地保存，导出工程不含）</label><input id="aiKey" type="text" autocomplete="off" value="${esc(p.ai.apiKey)}" placeholder="sk-..."></div>
        <div><label>模型（下拉选择）</label><select id="aiModel"></select></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
        <button type="button" class="btn ghost small" id="aiFetchModels">🔄 获取模型列表</button>
        <span class="hint">填好 URL 与 Key 后点击，拉取 /models 填充上方下拉；此操作只读模型列表，不发送对话请求</span>
      </div>
    </div>
    <div class="card">
      <h3>① 生成自由 HTML 区内容</h3>
      <div><label>描述你想要的内容（如：一个带角色好感度进度条的展示栏）</label>
      <textarea id="aiPrompt" style="min-height:70px" placeholder="例：生成一个音乐播放器样式的框，显示角色「正在收听」的歌曲名，带闪烁的音符装饰"></textarea></div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn" id="aiGenHtml">✨ 生成（写入自由 HTML 区）</button>
        <span style="align-self:center;font-size:12px;color:var(--txt2)">提示：生成后自动填入「自由 HTML 区」并启用该区块</span>
      </div>
    </div>
    <div class="card">
      <h3>② 主题风格调整</h3>
      <div><label>描述想要的风格（AI 输出配色/风格参数回填主题）</label>
      <textarea id="aiStylePrompt" style="min-height:56px" placeholder="例：红白撞色，和风庄重感"></textarea></div>
      <div style="margin-top:10px"><button class="btn" id="aiGenStyle">🎨 生成主题配色</button></div>
    </div>
    <div class="card">
      <h3>输出 <span id="aiStatus" class="status-dot"></span></h3>
      <div id="aiOut">（等待调用）</div>
    </div>`;

  /* 模型下拉：优先展示已拉取的列表（p.ai.models），保存过但不在列表中的模型也保留可选 */
  const renderModelSel=()=>{
    const list=Array.isArray(p.ai.models)?p.ai.models:[];
    const opts=list.map(m=>`<option value="${esc(m)}"${m===p.ai.model?' selected':''}>${esc(m)}</option>`);
    if(p.ai.model&&!list.includes(p.ai.model))opts.unshift(`<option value="${esc(p.ai.model)}" selected>${esc(p.ai.model)}（不在列表中）</option>`);
    if(!opts.length)opts.push('<option value="">（点击「获取模型列表」填充）</option>');
    $('#aiModel',col).innerHTML=opts.join('');
  };
  renderModelSel();

  $('#aiBase',col).addEventListener('input',function(){p.ai.baseURL=this.value.trim();Project.saveDebounced()});
  $('#aiKey',col).addEventListener('change',function(){p.ai.apiKey=this.value.trim();Project.save()});
  $('#aiModel',col).addEventListener('change',function(){p.ai.model=this.value;Project.save()});

  /* 拉取模型列表（只读 /models，不发送对话请求） */
  $('#aiFetchModels',col).onclick=async function(){
    const base=$('#aiBase',col).value.trim().replace(/\/$/,'');
    const key=$('#aiKey',col).value.trim();
    if(!base||!key){toast('请先填写 API Base URL 和 Key');return}
    const out=$('#aiOut'),dot=$('#aiStatus');
    this.disabled=true;const oldTxt=this.textContent;this.textContent='⏳ 获取中…';
    try{
      const res=await fetch(base+'/models',{headers:{'Authorization':'Bearer '+key}});
      if(!res.ok)throw new Error('HTTP '+res.status+' '+(await res.text()).slice(0,200));
      const j=await res.json();
      let list=Array.isArray(j?.data)?j.data.map(m=>m.id||m.name||m):(Array.isArray(j)?j:[]);
      list=[...new Set(list.filter(x=>typeof x==='string'))].sort();
      if(!list.length)throw new Error('响应中没有模型');
      p.ai.models=list;
      if(!list.includes(p.ai.model))p.ai.model=list[0];
      renderModelSel();Project.save();
      dot.className='status-dot status-ok';out.textContent='✓ 已获取 '+list.length+' 个模型，请在上方下拉选择';
      toast('模型列表已更新');
    }catch(err){
      dot.className='status-dot status-err';
      out.textContent='❌ 获取模型列表失败：'+err.message;
    }finally{this.disabled=false;this.textContent=oldTxt}
  };

  const SYS_HTML=`你是酒馆(SillyTavern)角色卡内嵌HTML组件工程师。只输出一段HTML/CSS代码，规则：
1. 输出一个最外层<div>，内部可含<style>，所有class必须以 "opg-ai-" 前缀命名；
2. 禁止使用全局选择器(如 *、body、html)、禁止 id 选择器、禁止外部资源/脚本依赖；
3. 不使用脚本标签(script标签)；配色和谐，适配暗色背景；
4. 只输出代码本身，不要解释，不要markdown代码块包裹。`;

  const SYS_STYLE=`你是UI配色设计师。根据用户描述输出一行JSON，字段：primary(主色hex)、accent(强调色hex)、textColor(文字色hex)、radius(圆角0-30数字)。只输出JSON，不要其他内容。`;

  async function call(apiSys,user){
    const out=$('#aiOut'),dot=$('#aiStatus');
    const apiKey=p.ai.apiKey;
    if(!apiKey||!p.ai.baseURL){out.textContent='⚠️ 请先填写 API Base URL 和 Key';dot.className='status-dot status-warn';return null}
    dot.className='status-dot status-ok';out.textContent='';
    /* 超时保护：120 秒无响应自动中止，防止永久挂起 */
    const ac=new AbortController();
    let timer=setTimeout(()=>ac.abort(),120000);
    try{
      const res=await fetch(p.ai.baseURL.replace(/\/$/,'')+'/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
        body:JSON.stringify({model:p.ai.model||'gpt-4o-mini',stream:true,
          messages:[{role:'system',content:apiSys},{role:'user',content:user}]}),
        signal:ac.signal
      });
      if(!res.ok){throw new Error('HTTP '+res.status+' '+(await res.text()).slice(0,200))}
      const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';
      while(true){
        const{done,value}=await reader.read();if(done)break;
        clearTimeout(timer);timer=setTimeout(()=>ac.abort(),120000);
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split('\n');buf=lines.pop();
        for(const line of lines){
          const t=line.trim();if(!t.startsWith('data:'))continue;
          const d=t.slice(5).trim();if(d==='[DONE]')continue;
          try{const j=JSON.parse(d);const delta=j.choices?.[0]?.delta?.content||'';
            if(delta){full+=delta;out.textContent=full;out.scrollTop=out.scrollHeight}}catch(e){}
        }
      }
      dot.className='status-dot status-ok';
      return full;
    }catch(err){
      dot.className='status-dot status-err';
      out.textContent+='\n❌ 调用失败：'+(err.name==='AbortError'?'请求超时（120 秒无响应，已自动中止）':err.message);
      return null;
    }finally{clearTimeout(timer)}
  }

  $('#aiGenHtml',col).onclick=async()=>{
    const q=$('#aiPrompt',col).value.trim();if(!q){toast('请先描述想要的内容');return}
    const r=await call(SYS_HTML,q);if(!r)return;
    let code=r.trim().replace(/^```(html)?\s*/i,'').replace(/```\s*$/,'');
    let fb=p.blocks.find(b=>b.type==='freehtml');
    if(!fb){/* 自由 HTML 区块被删除过：自动重建，避免写入时崩溃 */
      fb={type:'freehtml',enabled:true,...BLOCK_DEFS.freehtml.create()};
      p.blocks.push(fb);
    }
    fb.html=code;fb.enabled=true;
    UI.renderConfig();UI.refreshPreview();Project.save();toast('已写入自由 HTML 区');
  };
  $('#aiGenStyle',col).onclick=async()=>{
    const q=$('#aiStylePrompt',col).value.trim();if(!q){toast('请先描述想要的风格');return}
    const r=await call(SYS_STYLE,q);if(!r)return;
    try{
      const m=r.match(/\{[\s\S]*\}/);const j=JSON.parse(m[0]);
      if(j.primary)p.theme.primary=j.primary;
      if(j.accent)p.theme.accent=j.accent;
      if(j.textColor)p.theme.textColor=j.textColor;
      if(j.radius!==undefined)p.theme.radius=Math.min(30,Math.max(0,+j.radius||12));
      UI.renderConfig();UI.refreshPreview();Project.save();toast('主题已回填');
    }catch(e){toast('AI 输出解析失败，请重试')}
  };
}