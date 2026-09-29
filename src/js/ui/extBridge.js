/* 扩展版桥接：本工具被酒馆扩展（extension 分支 ext/index.js）以 iframe 内嵌时，
   宿主页注入 window.__OPG_EXT__（listCards / writeToCard / aiAvailable / aiGenerate），
   导出页可把生成文档直写角色卡、AI 助手页可直连酒馆当前连接生成，免复制粘贴免 Key。
   独立单文件版无桥（parent===window），hasBridge() 恒 false——功能休眠不可见。 */
import { $, esc, toast, confirmModal } from '../utils.js';

export function hasBridge(){
  try{
    const b=window.parent!==window&&window.parent.__OPG_EXT__;
    return !!b&&typeof b.listCards==='function'&&typeof b.writeToCard==='function';
  }catch(e){return false} /* 跨域 parent 直接抛 SecurityError */
}

/* AI 连接模式解析（纯函数）：桥存在且宿主暴露酒馆生成通道（aiAvailable）时可用「酒馆当前连接」，
   否则一律回落自定义接口模式。channel 用户可显式选 'custom' 强制走自定义。 */
export function resolveAiChannel(channel){
  let tavernOK=false;
  try{
    const b=window.parent!==window&&window.parent.__OPG_EXT__;
    tavernOK=!!b&&typeof b.aiAvailable==='function'&&!!b.aiAvailable();
  }catch(e){tavernOK=false}
  if(!tavernOK)return 'custom';
  return channel==='custom'?'custom':'tavern';
}

/* 酒馆模式生成请求的载荷（纯函数，便于测试）：ordered_prompts 干净生成（不带预设/世界书），
   should_silence 静默生成不打扰玩家发送按钮 */
export function buildTavernAiPayload(system,user){
  return {
    ordered_prompts:[
      {role:'system',content:String(system??'')},
      {role:'user',content:String(user??'')},
    ],
    should_silence:true,
  };
}

async function listCards(){
  const r=await window.parent.__OPG_EXT__.listCards();
  return Array.isArray(r)?r:[];
}

/* 卡的开场白快照（纯函数，便于测试）：first_mes + 备用开场白，滤空白。
   旧版宿主桥不回 firstMes 时自然只提取备用开场白 */
export function greetSnapshot(c){
  return [c&&c.firstMes,...((c&&c.alternateGreetings)||[])]
    .map(x=>String(x??'').trim()).filter(Boolean);
}

async function writeCard(avatar,mode,content){
  return window.parent.__OPG_EXT__.writeToCard(avatar,mode,content);
}

/* 酒馆模式生成：经桥调用宿主侧 TavernHelper.generateRaw，走酒馆当前连接（Key/模型/参数全复用） */
export async function tavernGenerate(system,user){
  const payload=buildTavernAiPayload(system,user);
  const r=await window.parent.__OPG_EXT__.aiGenerate(payload);
  return typeof r==='string'?r:String((r&&r.content)??r??'');
}

let writerOpen=false; /* listCards 为异步：await 期间连点会叠开两层弹窗 */

/* 导出页「写入角色卡」全流程：选卡 → 选目标（覆盖 first_mes / 追加 alternate_greetings）
   → 写前确认（覆盖模式二次确认）→ 经桥写入 → toast 结果。弹窗画在工具 iframe 内
   （复用工具主题令牌），桥只负责数据与写动作。
   rebuild 可选（(开场白原文数组)=>围栏文档|null）：勾选「提取该卡实际开场白」时按所选卡
   重建文档，把真实开场白烘焙进开场白选择区的静态列表（替代编辑器占位文本）；null/不传 =
   保持预构建文档原样写入 */
export async function openCardWriter(fenced,rebuild){
  if(writerOpen)return;
  writerOpen=true;
  try{
    let cards=[];
    try{cards=await listCards()}catch(e){toast('读取角色卡列表失败：'+((e&&e.message)||e));return}
    if(!cards.length){toast('酒馆里没有可写入的角色卡');return}
    await new Promise(resolve=>{openWriterDialog(cards,fenced,rebuild,resolve)});
  }finally{writerOpen=false}
}

function openWriterDialog(cards,fenced,rebuild,onDone){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');
  box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(560px,92vw);max-height:86vh;overflow:auto;box-sizing:border-box';
  const opts=cards.map(c=>`<option value="${esc(c.avatar)}">${esc(c.name||c.avatar)}</option>`).join('');
  box.innerHTML=`<h3 style="margin:0 0 10px">📤 写入角色卡 <span class="hint">经酒馆接口直写，免复制粘贴</span></h3>
    <div><label>目标角色卡</label><select id="opgwc-card" style="width:100%">${opts}</select></div>
    <div style="margin-top:10px"><label>写入目标</label>
      <label class="inline-check" style="display:block;margin:4px 0"><input type="radio" name="opgwc-mode" value="first_mes" checked>覆盖主开场白（first_mes）——新聊天才生效</label>
      <label class="inline-check" style="display:block;margin:4px 0"><input type="radio" name="opgwc-mode" value="append_greeting">追加为新开场白（alternate_greetings 末尾）</label>
    </div>
    ${rebuild?'<div style="margin-top:8px"><label class="inline-check"><input type="checkbox" id="opgwc-greet" checked>开场白列表提取该卡实际开场白（写入时点快照，运行时仍实时同步）</label></div>':''}
    <div id="opgwc-hint" style="font-size:11px;color:var(--txt2);margin:6px 0"></div>
    <div id="opgwc-greethint" style="font-size:11px;color:var(--ok,#7fc97f);margin:6px 0"></div>
    <div id="opgwc-contenthint" style="font-size:11px;color:var(--txt2);margin:6px 0"></div>
    <pre id="opgwc-prev" style="max-height:120px;overflow:auto;font-size:10px;white-space:pre-wrap;margin:4px 0;padding:8px;background:var(--panel2);border-radius:6px"></pre>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button type="button" class="btn ghost small" id="opgwc-cancel">取消</button>
      <button type="button" class="btn small" id="opgwc-write">写入</button>
    </div>`;
  ov.appendChild(box);document.body.appendChild(ov);
  const close=()=>{document.removeEventListener('keydown',onKey);ov.remove();onDone()};
  const onKey=e=>{
    if(e.key!=='Escape')return;
    /* 确认框（.opg-modal-root.show）叠在写卡弹窗上时让位：Esc 只关确认框，
       否则会把写卡弹窗连根关掉、悬留确认框点确定仍执行不可恢复覆盖 */
    if(document.querySelector('.opg-modal-root.show'))return;
    close();
  };
  document.addEventListener('keydown',onKey);
  const cardSel=$('#opgwc-card',box),hint=$('#opgwc-hint',box);
  const greetChk=$('#opgwc-greet',box),greetHint=$('#opgwc-greethint',box);
  const contentHint=$('#opgwc-contenthint',box),prevPre=$('#opgwc-prev',box);
  /* 待写入文档：随所选卡/勾选实时重建（默认预构建原样），预览与写入共用同一份 */
  let curFenced=fenced;
  const refreshContent=()=>{
    const c=cards.find(x=>x.avatar===cardSel.value);
    let baked=false;
    if(rebuild&&greetChk&&greetChk.checked&&c){
      const gs=greetSnapshot(c);
      if(gs.length){
        const doc=rebuild(gs);
        if(doc){curFenced=doc;baked=true}else curFenced=fenced;
      }else curFenced=fenced;
    }else curFenced=fenced;
    greetHint.textContent=baked?`✓ 已提取「${c?(c.name||c.avatar):''}」当前 ${greetSnapshot(c).length} 条开场白写入开场白选择区列表`:'';
    contentHint.textContent=`写入内容：「开场白版」完整围栏文档（${curFenced.length} 字符），预览前 400 字：`;
    prevPre.textContent=curFenced.slice(0,400)+(curFenced.length>400?'…':'');
  };
  const refreshHint=()=>{
    const c=cards.find(x=>x.avatar===cardSel.value);
    const mode=box.querySelector('input[name="opgwc-mode"]:checked').value;
    const n=c?((c.alternateGreetings&&c.alternateGreetings.length)||0):0;
    hint.textContent=mode==='first_mes'
      ?`⚠️ 将替换「${c?(c.name||c.avatar):''}」的整个主开场白（已有开场白列表不受影响）。`
      :`将在「${c?(c.name||c.avatar):''}」现有 ${n} 条开场白后追加一条（编号 ${n+1}）。`;
    refreshContent();
  };
  cardSel.addEventListener('change',refreshHint);
  box.querySelectorAll('input[name="opgwc-mode"]').forEach(r=>r.addEventListener('change',refreshHint));
  if(greetChk)greetChk.addEventListener('change',refreshContent);
  refreshHint();
  $('#opgwc-cancel',box).onclick=close;
  $('#opgwc-write',box).onclick=async()=>{
    const avatar=cardSel.value;
    const c=cards.find(x=>x.avatar===avatar);
    const cname=c?(c.name||avatar):avatar;
    const mode=box.querySelector('input[name="opgwc-mode"]:checked').value;
    if(mode==='first_mes'){
      const ok=await confirmModal(`将覆盖角色卡「${cname}」的主开场白（first_mes），原内容不可恢复。确认写入？`,'覆盖确认');
      /* 确认期间弹窗可能已被 Esc 关闭（ov 已脱离 DOM）：此刻中止，杜绝在死 UI 上继续写入 */
      if(!ok||!ov.isConnected)return;
    }
    const btn=$('#opgwc-write',box);btn.disabled=true;btn.textContent='写入中…';
    try{
      const r=await writeCard(avatar,mode,curFenced);
      if(r&&r.ok===false){toast(r.message||'写入失败')}
      else{toast(r&&r.message?r.message:`已写入「${cname}」`);close()}
    }catch(e){toast('写入失败：'+((e&&e.message)||e))}
    finally{btn.disabled=false;btn.textContent='写入'}
  };
}
