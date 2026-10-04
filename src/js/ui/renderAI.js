/* AI 助手页渲染 */
import { $, esc, toast } from '../utils.js';
import { BLOCK_DEFS } from '../defs.js';
import { Project } from '../project.js';
import { UI } from './core.js';
import { resolveAiChannel, tavernGenerate } from './extBridge.js';

/* 会话内暂存 Key：勾掉「在本机记住 Key」时 Key 只活在本模块内存，不进 localStorage（导出剔除逻辑照旧） */
let _sessionKey='';

export function renderAI(){
  const p=Project.cur,col=$('#aiCol');
  /* 连接模式：桥存在且宿主暴露酒馆生成通道（TavernHelper.generateRaw）时可选「酒馆当前连接」，
     否则一律自定义接口模式（独立版无桥，界面与旧版一致） */
  const tavernOK=resolveAiChannel('')==='tavern';
  const channel=resolveAiChannel(p.ai.channel);
  col.innerHTML=`
    <div class="card">
      <h3>🤖 AI 助手（可选）${channel==='tavern'?'<span class="hint">酒馆当前连接 · 静默生成，不打扰游玩</span>':'<span class="hint">OpenAI 兼容接口 · 仅本工具内使用，不写入导出代码</span>'}</h3>
      ${tavernOK?`<div style="font-size:12px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">连接模式：
        <label class="inline-check" style="margin-left:6px"><input type="radio" name="aiChannel" value="tavern"${channel==='tavern'?' checked':''}>酒馆当前连接（免 Key）</label>
        <label class="inline-check" style="margin-left:10px"><input type="radio" name="aiChannel" value="custom"${channel==='custom'?' checked':''}>自定义 OpenAI 兼容接口</label></div>`:''}
      ${channel==='tavern'
        ?`<div style="font-size:12px;color:var(--txt2)">✓ 生成将走酒馆当前连接的模型与参数（经酒馆助手 <code>generateRaw</code> 静默生成，不带预设与世界书污染）。在酒馆里连好 API 即可，无需下方配置。</div>`
        :`<div class="row3">
        <div><label>API Base URL</label><input id="aiBase" value="${esc(p.ai.baseURL)}" placeholder="https://api.openai.com/v1"></div>
        <div><label>API Key（勾选「记住」才落盘，导出工程不含）</label><div style="display:flex;gap:6px"><input id="aiKey" type="password" autocomplete="new-password" value="${esc(p.ai.apiKey||_sessionKey)}" placeholder="sk-..." style="min-width:0"><button type="button" class="btn ghost small" id="aiKeyEye" title="显示 / 隐藏 Key">👁</button></div></div>
        <div><label>模型（下拉选择）</label><select id="aiModel"></select></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button type="button" class="btn ghost small" id="aiFetchModels">🔄 获取模型列表</button>
        <label class="inline-check" title="取消勾选后 Key 仅存于本页会话内存，刷新页面即失效，不写入 localStorage"><input type="checkbox" id="aiRemember"${p.ai.rememberKey===false?'':' checked'}>在本机记住 Key</label>
        <span class="hint">填好 URL 与 Key 后点击，拉取 /models 填充上方下拉；此操作只读模型列表，不发送对话请求</span>
      </div>`}
    </div>
    <div class="card">
      <h3>① 生成自由 HTML 区内容</h3>
      <div><label>描述你想要的内容（如：一个带角色好感度进度条的展示栏）</label>
      <textarea id="aiPrompt" style="min-height:70px" placeholder="例：生成一个音乐播放器样式的框，显示角色「正在收听」的歌曲名，带闪烁的音符装饰"></textarea></div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button type="button" class="btn" id="aiGenHtml">✨ 生成（写入自由 HTML 区）</button>
        <span style="align-self:center;font-size:12px;color:var(--txt2)">提示：生成后自动填入「自由 HTML 区」并启用该区块</span>
      </div>
    </div>
    <div class="card">
      <h3>② 主题风格调整</h3>
      <div><label>描述想要的风格（AI 输出配色/风格参数回填主题）</label>
      <textarea id="aiStylePrompt" style="min-height:56px" placeholder="例：红白撞色，和风庄重感"></textarea></div>
      <div style="margin-top:10px"><button type="button" class="btn" id="aiGenStyle">🎨 生成主题配色</button></div>
    </div>
    <div class="card">
      <h3>输出 <span id="aiStatus" class="status-dot"></span></h3>
      <div id="aiOut">（等待调用）</div>
    </div>`;

  if(channel==='custom'){
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
    $('#aiKey',col).addEventListener('change',function(){
      const v=this.value.trim();
      _sessionKey=v;
      if($('#aiRemember',col).checked){p.ai.apiKey=v;Project.save()}
      else if(p.ai.apiKey){p.ai.apiKey='';Project.save()} /* 关闭记住时清掉已落盘的旧 Key */
    });
    $('#aiRemember',col).addEventListener('change',function(){
      p.ai.rememberKey=this.checked;
      /* 勾上：把会话内的 Key 立即落盘；勾掉：清掉已落盘的 Key（输入框里的值仍在，继续可用） */
      if(this.checked)p.ai.apiKey=_sessionKey||$('#aiKey',col).value.trim();
      else p.ai.apiKey='';
      Project.save();
    });
    $('#aiKeyEye',col).addEventListener('click',function(){
      const inp=$('#aiKey',col);
      const show=inp.type==='password';
      inp.type=show?'text':'password';
      this.textContent=show?'🙈':'👁';
    });
    $('#aiModel',col).addEventListener('change',function(){p.ai.model=this.value;Project.save()});

    /* 拉取模型列表（只读 /models，不发送对话请求） */
    $('#aiFetchModels',col).onclick=async function(){
      const base=$('#aiBase',col).value.trim().replace(/\/$/,'');
      const key=$('#aiKey',col).value.trim();
      if(!base||!key){toast('请先填写 API Base URL 和 Key');return}
      const out=$('#aiOut'),dot=$('#aiStatus');
      this.disabled=true;const oldTxt=this.textContent;this.textContent='⏳ 获取中…';
      /* 超时保护：90 秒无响应自动中止（对话生成在 call() 内另有 120 秒带逐块重置的超时） */
      const ac=new AbortController();
      const timer=setTimeout(()=>ac.abort(),90000);
      try{
        const res=await fetch(base+'/models',{headers:{'Authorization':'Bearer '+key},signal:ac.signal});
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
        out.textContent='❌ 获取模型列表失败：'+(err.name==='AbortError'?'请求超时（90 秒无响应，已自动中止）':err.message);
      }finally{clearTimeout(timer);this.disabled=false;this.textContent=oldTxt}
    };
  }

  col.querySelectorAll('input[name="aiChannel"]').forEach(r=>r.addEventListener('change',function(){
    p.ai.channel=this.value;Project.save();UI.renderAI();
  }));

  /* 系统提示词（吸收前端规范：安全渲染/布局边界/可访问性/输出前自查） */
  const SYS_HTML=`你是酒馆(SillyTavern)角色卡内嵌HTML组件工程师。只输出一段HTML/CSS代码，规则：
1. 输出一个最外层<div>，内部可含<style>，所有class必须以 "opg-ai-" 前缀命名；
2. 禁止使用全局选择器(如 *、body、html)、禁止 id 选择器、禁止 <script> 脚本与外部资源依赖，禁止内联事件属性(onclick等)；
3. 适配暗色背景：文字用近白色避免深底深字；主体不脱离文档流，不用 vh/vw 撑高度，不产生横向滚动；
4. 可点击元素用真实 <button type="button">/<label> 并给 hover/focus 反馈；字号不小于 12px，点击区域足够大（触屏可用）；
5. 引用的图片/音频 URL 必须是真实可用的 https:// 链接，背景必须同时有纯色或渐变兜底；不用系统外的花哨字体，给系统字体回退；
6. 内容可能为空时写出空态提示文案；装饰不得遮挡正文；
7. 不留未完成占位、省略号或假占位符；输出前自查：标签全部闭合、class 前缀正确、无遗漏占位；只输出代码本身，不要解释，不要markdown代码块包裹。`;

  const SYS_STYLE=`你是UI配色设计师。根据用户描述输出一行JSON，字段：primary(主色hex)、accent(强调色hex)、textColor(文字色hex，必须接近白色保证深色底可读)、radius(圆角0-30数字)。只输出JSON，不要其他内容。`;

  async function call(apiSys,user){
    const out=$('#aiOut'),dot=$('#aiStatus');
    /* 连接分流：酒馆模式走桥（TavernHelper generateRaw，非流式）；自定义模式走流式 fetch */
    if(resolveAiChannel(p.ai.channel)==='tavern'){
      dot.className='status-dot status-ok';
      out.textContent='⏳ 正在经酒馆当前连接生成…（静默生成，非流式输出）';
      try{
        const r=await tavernGenerate(apiSys,user);
        dot.className='status-dot status-ok';
        out.textContent=r||'（空响应）';
        return r||null;
      }catch(err){
        dot.className='status-dot status-err';
        out.textContent='❌ 酒馆连接调用失败：'+(err&&err.message||err)+'\n若酒馆当前未连接 API，请先在酒馆连接面板连上，或切换到「自定义 OpenAI 兼容接口」模式。';
        return null;
      }
    }
    /* Key 取值：关掉「记住」时用会话内存里的（落盘值已被清空） */
    const apiKey=p.ai.rememberKey===false?_sessionKey:(p.ai.apiKey||_sessionKey);
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

  $('#aiGenHtml',col).onclick=async function(){
    if(this.disabled)return;
    const q=$('#aiPrompt',col).value.trim();if(!q){toast('请先描述想要的内容');return}
    this.disabled=true;const oldTxt=this.textContent;this.textContent='⏳ 生成中…';
    try{
      const r=await call(SYS_HTML,q);if(!r)return;
      /* 生成期间切工程/撤销会重建整个页面：闭包里的 p 已不是当前工程，静默写入会造成跨工程污染 */
      if(Project.cur!==p){toast('⚠️ 已切换工程，本次生成结果已丢弃');return}
      let code=r.trim().replace(/^```(html)?\s*/i,'').replace(/```\s*$/,'');
      let fb=p.blocks.find(b=>b.type==='freehtml');
      if(!fb){/* 自由 HTML 区块被删除过：自动重建，避免写入时崩溃 */
        fb={type:'freehtml',enabled:true,...BLOCK_DEFS.freehtml.create()};
        p.blocks.push(fb);
      }
      fb.html=code;fb.enabled=true;
      UI.renderConfig();UI.refreshPreview();Project.save();toast('已写入自由 HTML 区');
    }finally{this.disabled=false;this.textContent=oldTxt}
  };
  $('#aiGenStyle',col).onclick=async function(){
    if(this.disabled)return;
    const q=$('#aiStylePrompt',col).value.trim();if(!q){toast('请先描述想要的风格');return}
    this.disabled=true;const oldTxt=this.textContent;this.textContent='⏳ 生成中…';
    try{
      const r=await call(SYS_STYLE,q);if(!r)return;
      if(Project.cur!==p){toast('⚠️ 已切换工程，本次生成结果已丢弃');return}
      try{
        const m=r.match(/\{[\s\S]*\}/);
        if(!m)throw new Error('输出中未找到 JSON 对象');
        const j=JSON.parse(m[0]);
        if(j.primary)p.theme.primary=j.primary;
        if(j.accent)p.theme.accent=j.accent;
        if(j.textColor)p.theme.textColor=j.textColor;
        /* radius=0 是合法值，不能用 || 短路吞掉 */
        if(j.radius!==undefined)p.theme.radius=Number.isFinite(+j.radius)?Math.min(30,Math.max(0,+j.radius)):12;
        UI.renderConfig();UI.refreshPreview();Project.save();toast('主题已回填');
      }catch(e){toast('AI 输出解析失败：'+(e&&e.message||e))}
    }finally{this.disabled=false;this.textContent=oldTxt}
  };
}
