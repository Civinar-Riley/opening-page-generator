/* AI 助手页渲染 */
import { $, esc, toast } from '../utils.js';
import { BLOCK_DEFS } from '../defs.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';
import { UI } from './core.js';
import { resolveAiChannel, tavernGenerate } from './extBridge.js';

/* 会话 Key 按工程隔离，只存内存；工程释放后随 WeakMap 回收，不带入其他工程的接口。 */
const _sessionKeys=new WeakMap();

/* 生成草稿（v1.30）：本机最近 5 份，跨工程共用；独立 localStorage 键，不进工程 schema */
const DRAFT_KEY='openingPageGen_v1_aiDrafts';
const loadDrafts=()=>{
  try{const a=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');return Array.isArray(a)?a.slice(0,5):[]}
  catch(e){return []}
};
const saveDraft=(mode,text)=>{
  try{const list=loadDrafts();list.unshift({ts:Date.now(),mode,text});localStorage.setItem(DRAFT_KEY,JSON.stringify(list.slice(0,5)))}
  catch(e){/* 草稿是锦上添花，写失败静默 */}
};

export function renderAI(){
  const p=Project.cur,col=$('#aiCol');
  /* 连接模式：桥存在且宿主暴露酒馆生成通道（TavernHelper.generateRaw）时可选「酒馆当前连接」，
     否则一律自定义接口模式（独立版无桥，界面与旧版一致） */
  const tavernOK=resolveAiChannel('')==='tavern';
  const channel=resolveAiChannel(p.ai.channel);

  const SYS_HTML=`你是酒馆(SillyTavern)角色卡内嵌HTML组件工程师。只输出一段HTML/CSS代码，规则：
1. 输出一个最外层<div>，内部可含<style>，所有class必须以 "opg-ai-" 前缀命名；
2. 禁止使用全局选择器(如 *、body、html)、禁止 id 选择器、禁止 <script> 脚本与外部资源依赖，禁止内联事件属性(onclick等)；
3. 适配暗色背景：文字用近白色避免深底深字；主体不脱离文档流，不用 vh/vw 撑高度，不产生横向滚动；
4. 可点击元素用真实 <button type="button">/<label> 并给 hover/focus 反馈；字号不小于 12px，点击区域足够大（触屏可用）；
5. 引用的图片/音频 URL 必须是真实可用的 https:// 链接，背景必须同时有纯色或渐变兜底；不用系统外的花哨字体，给系统字体回退；
6. 内容可能为空时写出空态提示文案；装饰不得遮挡正文；
7. 不留未完成占位、省略号或假占位符；输出前自查：标签全部闭合、class 前缀正确、无遗漏占位；只输出代码本身，不要解释，不要markdown代码块包裹。`;

  const SYS_STYLE=`你是UI配色设计师。根据用户描述输出一行JSON，字段：primary(主色hex)、accent(强调色hex)、textColor(文字色hex，必须接近白色保证深色底可读)、radius(圆角0-30数字)。只输出JSON，不要其他内容。`;

  const SYS_GREET=`你是酒馆角色卡开场白写手。根据用户描述写一条开场白正文（first_mes 风格）：以第二人称「你」称呼用户，代入角色口吻（用户描述里可含角色与世界观信息）；300-600 字，小说化叙事，结尾留出玩家行动空间。引用的图片/音频 URL 必须用户描述里真实给出，没有就不要编造链接。只输出正文本身，不要标题、不要解释、不要 Markdown 包裹。`;
  const SYS_PROFILE=`你是酒馆角色卡设定师。根据用户描述写一段角色简介：80-200 字，第三人称，涵盖身份、性格与外观亮点，供角色简介区向玩家展示；只输出简介文本，不要解释与 Markdown。`;
  const SYS_TIMELINE=`你是剧情进度编排器。根据用户描述输出时间线节点：每行一条，格式为 标题|描述|状态（状态仅限 done/current/lock，其中 current 至多一个）。5-8 行，按剧情顺序排列；只输出这些行，不要解释与 Markdown。`;
  const SYS_QA=`你是世界观问答编写器。根据用户描述输出问答组：每行一条，格式为 分组名|问题|答案（答案 30-80 字）。至少 4 行，可跨多个分组；只输出这些行，不要解释与 Markdown。`;

  /* 生成目标注册表：提示词 + 文案 + 写入分支（写入逻辑见 aiGenHtml 处理器的分支） */
  const TARGETS={
    freehtml:{sys:SYS_HTML,short:'自由HTML',label:'描述你想要的内容（如：一个带角色好感度进度条的展示栏）',btn:'✨ 生成（写入自由 HTML 区）',hint:'生成后自动填入「自由 HTML 区」并启用该区块'},
    greeting:{sys:SYS_GREET,short:'开场白',label:'描述这条开场白的情境（角色、氛围、与用户的初次相遇…）',btn:'✨ 生成（追加进开场白列表）',hint:'生成后以「标题｜描述」追加进开场白占位列表；正文要成为可选开场白，还需写进角色卡的 alternate_greetings（导出①写入角色卡或手动贴）'},
    profile:{sys:SYS_PROFILE,short:'角色简介',label:'描述这个角色（身份、性格、外观亮点…）',btn:'✨ 生成（追加进角色简介区）',hint:'生成后作为新角色条目追加进角色简介区并启用'},
    timeline:{sys:SYS_TIMELINE,short:'时间线',label:'描述剧情阶段或进度节点（顺序、当前进度…）',btn:'✨ 生成（追加进时间线区块）',hint:'生成后按行追加进时间线区块的节点列表并启用'},
    qa:{sys:SYS_QA,short:'问答组',label:'描述要覆盖的问答主题（世界观 / 角色设定 / 玩法…）',btn:'✨ 生成（追加进问答折叠区）',hint:'生成后按「分组|问题|答案」解析并追加进问答折叠区的分组'},
  };
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
        <div><label>API Key（勾选「记住」才落盘，导出工程不含）</label><div style="display:flex;gap:6px"><input id="aiKey" type="password" autocomplete="new-password" value="${esc(p.ai.apiKey||_sessionKeys.get(p)||'')}" placeholder="sk-..." style="min-width:0"><button type="button" class="btn ghost small" id="aiKeyEye" title="显示 / 隐藏 Key">👁</button></div></div>
        <div><label>模型（下拉选择，可输关键词过滤）</label><input id="aiModelFilter" placeholder="输入关键词过滤模型…" style="margin-bottom:4px"><select id="aiModel"></select></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button type="button" class="btn ghost small" id="aiFetchModels">🔄 获取模型列表</button>
        <label class="inline-check" title="取消勾选后 Key 仅存于本页会话内存，刷新页面即失效，不写入 localStorage"><input type="checkbox" id="aiRemember"${p.ai.rememberKey===false?'':' checked'}>在本机记住 Key</label>
        <span class="hint">填好 URL 与 Key 后点击，拉取 /models 填充上方下拉；此操作只读模型列表，不发送对话请求</span>
      </div>`}
    </div>
    <div class="card">
      <h3>① 生成内容 <span class="hint">选目标，生成后自动写入对应区块</span></h3>
      <div><label>生成目标</label><select id="aiTarget">
        <option value="freehtml">自由 HTML 区（可视化组件）</option>
        <option value="greeting">开场白正文（追加进开场白列表）</option>
        <option value="profile">角色简介（追加进角色简介区）</option>
        <option value="timeline">时间线节点（追加进时间线区块）</option>
        <option value="qa">问答组（追加进问答折叠区）</option>
      </select></div>
      <div><label id="aiPromptLabel">描述你想要的内容（如：一个带角色好感度进度条的展示栏）</label>
      <textarea id="aiPrompt" style="min-height:70px" placeholder="例：生成一个音乐播放器样式的框，显示角色「正在收听」的歌曲名，带闪烁的音符装饰"></textarea></div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button type="button" class="btn" id="aiGenHtml">✨ 生成（写入自由 HTML 区）</button>
        <span id="aiTargetHint" style="align-self:center;font-size:12px;color:var(--txt2)">生成后自动填入「自由 HTML 区」并启用该区块</span>
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
      <div style="margin-top:10px"><label>🕘 最近草稿（本机最近 5 份，可恢复到输出区）</label><div id="aiDrafts"></div></div>
    </div>`;

  if(channel==='custom'){
    /* 模型下拉：优先展示已拉取的列表（p.ai.models），保存过但不在列表中的模型也保留可选；
       v1.29 起支持关键词过滤（本地 substring 匹配，不发请求） */
    const renderModelSel=()=>{
      const list=Array.isArray(p.ai.models)?p.ai.models:[];
      const fEl=$('#aiModelFilter',col);const kw=((fEl&&fEl.value)||'').trim().toLowerCase(); /* 测试环境的最小 DOM mock 可能没有过滤框，防御式读取 */
      const shown=kw?list.filter(m=>m.toLowerCase().includes(kw)):list;
      const opts=shown.map(m=>`<option value="${esc(m)}"${m===p.ai.model?' selected':''}>${esc(m)}</option>`);
      if(p.ai.model&&!shown.includes(p.ai.model))opts.unshift(`<option value="${esc(p.ai.model)}" selected>${esc(p.ai.model)}（${kw?'当前选择':'不在列表中'}）</option>`);
      if(!opts.length)opts.push(`<option value="">${kw?'（无匹配模型，清空关键词重试）':'（点击「获取模型列表」填充）'}</option>`);
      $('#aiModel',col).innerHTML=opts.join('');
    };
    renderModelSel();
    const fInp=$('#aiModelFilter',col);if(fInp)fInp.addEventListener('input',renderModelSel);

    $('#aiBase',col).addEventListener('input',function(){p.ai.baseURL=this.value.trim();Project.saveDebounced()});
    $('#aiKey',col).addEventListener('change',function(){
      const v=this.value.trim();
      _sessionKeys.set(p,v);
      if($('#aiRemember',col).checked){p.ai.apiKey=v;Project.save()}
      else if(p.ai.apiKey){p.ai.apiKey='';Project.save()} /* 关闭记住时清掉已落盘的旧 Key */
    });
    $('#aiRemember',col).addEventListener('change',function(){
      p.ai.rememberKey=this.checked;
      /* 勾上：把会话内的 Key 立即落盘；勾掉：清掉已落盘的 Key（输入框里的值仍在，继续可用） */
      const key=$('#aiKey',col).value.trim();
      _sessionKeys.set(p,key);
      p.ai.apiKey=this.checked?key:'';
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
        /* 90 秒 await 期间切工程：p 已不是当前工程，写进去的结果不会被 save 序列化（已在
           _written 缓存里），刷新即丢——与 aiGenHtml/aiGenStyle 同款守卫，直接丢弃 */
        if(Project.cur!==p){toast('⚠️ 已切换工程，模型列表未应用');return}
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

  /* 生成目标切换：换提示词文案与按钮（TARGETS 注册表驱动）。防御式读写——
     ai.test 的最小 DOM mock 只认旧元素，新元素缺位时静默跳过 */
  const syncTarget=()=>{
    const t=TARGETS[($('#aiTarget',col)||{}).value]||TARGETS.freehtml;
    const lb=$('#aiPromptLabel',col),btn=$('#aiGenHtml',col),hint=$('#aiTargetHint',col);
    if(lb)lb.textContent=t.label;
    if(btn)btn.textContent=t.btn;
    if(hint)hint.textContent=t.hint;
  };
  const tSel=$('#aiTarget',col);
  if(tSel)tSel.addEventListener('change',syncTarget);
  syncTarget();

  /* 最近草稿（本机 5 份）：恢复=回填输出区并切回对应目标；丢弃=直接移除 */
  const dEl=$('#aiDrafts',col);
  const renderDrafts=()=>{
    if(!dEl)return;
    const list=loadDrafts();
    dEl.innerHTML=list.length?list.map((d,i)=>`<div style="display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:5px 8px;margin:4px 0;font-size:12px">
      <span style="color:var(--accent)">${esc((TARGETS[d.mode]||{short:d.mode}).short)}</span>
      <span style="color:var(--txt2)">${new Date(d.ts).toLocaleString()}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt2)">${esc(d.text.slice(0,60))}</span>
      <button type="button" class="btn ghost small" data-draft-res="${i}">恢复</button>
      <button type="button" class="btn ghost small" data-draft-del="${i}">丢弃</button>
    </div>`).join(''):'<div style="font-size:12px;color:var(--txt2)">（暂无草稿）</div>';
  };
  renderDrafts();
  if(dEl)dEl.addEventListener('click',e=>{
    const res=e.target.dataset.draftRes,del=e.target.dataset.draftDel;
    if(res===undefined&&del===undefined)return;
    const list=loadDrafts();
    if(del!==undefined){list.splice(+del,1);try{localStorage.setItem(DRAFT_KEY,JSON.stringify(list))}catch(_){/* */}renderDrafts();return}
    const d=list[+res];if(!d)return;
    if(TARGETS[d.mode])$('#aiTarget',col).value=d.mode;
    syncTarget();
    const out=$('#aiOut',col);
    if(out)out.textContent=d.text;
    toast('草稿已回填输出区');
  });

  /* 系统提示词（吸收前端规范：安全渲染/布局边界/可访问性/输出前自查） */
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
    const apiKey=p.ai.rememberKey===false?_sessionKeys.get(p):(p.ai.apiKey||_sessionKeys.get(p));
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
    const tKey=$('#aiTarget',col).value;
    const tDef=TARGETS[tKey]||TARGETS.freehtml;
    const q=$('#aiPrompt',col).value.trim();if(!q){toast('请先描述想要的内容');return}
    this.disabled=true;const oldTxt=this.textContent;this.textContent='⏳ 生成中…';
    try{
      const r=await call(tDef.sys,q);if(!r)return;
      /* 生成期间切工程/撤销会重建整个页面：闭包里的 p 已不是当前工程，静默写入会造成跨工程污染 */
      if(Project.cur!==p){toast('⚠️ 已切换工程，本次生成结果已丢弃');return}
      saveDraft(tKey,r);
      renderDrafts(); /* 草稿已落库就刷新列表——下面的解析失败早退分支不再漏刷 */
      if(tKey==='freehtml'){
        let code=r.trim().replace(/^```(html)?\s*/i,'').replace(/```\s*$/,'');
        let fb=p.blocks.find(b=>b.type==='freehtml');
        if(!fb){/* 自由 HTML 区块被删除过：自动重建，避免写入时崩溃 */
          fb={type:'freehtml',enabled:true,...BLOCK_DEFS.freehtml.create()};
          p.blocks.push(fb);
        }
        fb.html=code;fb.enabled=true;
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('已写入自由 HTML 区');
      }else if(tKey==='greeting'){
        /* 运行时开场白以角色卡为准：这里只把 AI 文本以「标题｜描述」追加进占位列表供预览与认领 */
        const line=Gen.greetSnapshotLines([r]);
        if(!line){toast('生成内容为空');return}
        let g=p.blocks.find(b=>b.type==='greetings');
        if(!g){g={type:'greetings',enabled:true,...BLOCK_DEFS.greetings.create()};p.blocks.push(g)}
        g.enabled=true;
        g.placeholderList=(g.placeholderList?g.placeholderList+'\n':'')+line;
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('已追加进开场白占位列表（正文生效需写进角色卡 alternate_greetings）');
      }else if(tKey==='profile'){
        const pr=p.blocks.find(b=>b.type==='profile');
        if(!pr){toast('角色简介区块不存在');return}
        pr.enabled=true;
        pr.characters=[...(Array.isArray(pr.characters)?pr.characters:[]),{name:'{{char}}',desc:r.trim(),tags:'',avatar:'',avatarMode:'manual'}];
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('已追加进角色简介区');
      }else if(tKey==='timeline'){
        let tl=p.blocks.find(b=>b.type==='timeline');
        if(!tl){tl={type:'timeline',enabled:true,...BLOCK_DEFS.timeline.create()};p.blocks.push(tl)}
        tl.enabled=true;
        tl.nodes=(tl.nodes?tl.nodes+'\n':'')+r.trim();
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('已追加进时间线区块');
      }else if(tKey==='qa'){
        /* AI 输出行格式：分组|问题|答案（答案里允许再出现 |，归入答案） */
        const map=new Map();
        r.trim().split('\n').forEach(l=>{
          const ps=l.split('|');
          if(ps.length>=3){const g=ps[0].trim(),q2=ps[1].trim(),a=ps.slice(2).join('|').trim();if(g&&q2){if(!map.has(g))map.set(g,[]);map.get(g).push({q:q2,a})}}
        });
        if(!map.size){toast('⚠️ AI 输出未解析出问答行（需要 分组|问题|答案 格式），已存草稿');return}
        let qa=p.blocks.find(b=>b.type==='qa');
        if(!qa){qa={type:'qa',enabled:true,...BLOCK_DEFS.qa.create()};p.blocks.push(qa)}
        qa.enabled=true;
        qa.groups=[...(Array.isArray(qa.groups)?qa.groups:[]),...[...map].map(([name,items])=>({name,items}))];
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('已追加 '+[...map].reduce((n,[,it])=>n+it.length,0)+' 条问答');
      }
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
        Project.saveSnapshot();UI.renderConfig();UI.refreshPreview();Project.save();toast('主题已回填');
      }catch(e){toast('AI 输出解析失败：'+(e&&e.message||e))}
    }finally{this.disabled=false;this.textContent=oldTxt}
  };
}
