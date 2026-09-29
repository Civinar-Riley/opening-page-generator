/* 扩展版桥接：本工具被酒馆扩展（extension 分支 ext/index.js）以 iframe 内嵌时，
   宿主页注入 window.__OPG_EXT__（listCards / writeToCard），导出页即可把生成文档
   直写角色卡 first_mes / alternate_greetings，免复制粘贴。
   独立单文件版无桥（parent===window），hasBridge() 恒 false——功能休眠不可见。 */
import { $, esc, toast, confirmModal } from '../utils.js';

export function hasBridge(){
  try{
    const b=window.parent!==window&&window.parent.__OPG_EXT__;
    return !!b&&typeof b.listCards==='function'&&typeof b.writeToCard==='function';
  }catch(e){return false} /* 跨域 parent 直接抛 SecurityError */
}

async function listCards(){
  const r=await window.parent.__OPG_EXT__.listCards();
  return Array.isArray(r)?r:[];
}

async function writeCard(avatar,mode,content){
  return window.parent.__OPG_EXT__.writeToCard(avatar,mode,content);
}

/* 导出页「写入角色卡」全流程：选卡 → 选目标（覆盖 first_mes / 追加 alternate_greetings）
   → 写前确认（覆盖模式二次确认）→ 经桥写入 → toast 结果。弹窗画在工具 iframe 内
   （复用工具主题令牌），桥只负责数据与写动作。 */
export async function openCardWriter(fenced){
  let cards=[];
  try{cards=await listCards()}catch(e){toast('读取角色卡列表失败：'+((e&&e.message)||e));return}
  if(!cards.length){toast('酒馆里没有可写入的角色卡');return}
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
    <div id="opgwc-hint" style="font-size:11px;color:var(--txt2);margin:6px 0"></div>
    <div style="font-size:11px;color:var(--txt2);margin:6px 0">写入内容：本工程生成的「开场白版」完整围栏文档（${fenced.length} 字符），预览前 400 字：</div>
    <pre style="max-height:120px;overflow:auto;font-size:10px;white-space:pre-wrap;margin:4px 0;padding:8px;background:var(--panel2);border-radius:6px">${esc(fenced.slice(0,400))}${fenced.length>400?'…':''}</pre>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button type="button" class="btn ghost small" id="opgwc-cancel">取消</button>
      <button type="button" class="btn small" id="opgwc-write">写入</button>
    </div>`;
  ov.appendChild(box);document.body.appendChild(ov);
  const close=()=>{document.removeEventListener('keydown',onKey);ov.remove()};
  const onKey=e=>{if(e.key==='Escape')close()};
  document.addEventListener('keydown',onKey);
  const cardSel=$('#opgwc-card',box),hint=$('#opgwc-hint',box);
  const refreshHint=()=>{
    const c=cards.find(x=>x.avatar===cardSel.value);
    const mode=box.querySelector('input[name="opgwc-mode"]:checked').value;
    const n=c?((c.alternateGreetings&&c.alternateGreetings.length)||0):0;
    hint.textContent=mode==='first_mes'
      ?`⚠️ 将替换「${c?(c.name||c.avatar):''}」的整个主开场白（已有开场白列表不受影响）。`
      :`将在「${c?(c.name||c.avatar):''}」现有 ${n} 条开场白后追加一条（编号 ${n+1}）。`;
  };
  cardSel.addEventListener('change',refreshHint);
  box.querySelectorAll('input[name="opgwc-mode"]').forEach(r=>r.addEventListener('change',refreshHint));
  refreshHint();
  $('#opgwc-cancel',box).onclick=close;
  $('#opgwc-write',box).onclick=async()=>{
    const avatar=cardSel.value;
    const c=cards.find(x=>x.avatar===avatar);
    const cname=c?(c.name||avatar):avatar;
    const mode=box.querySelector('input[name="opgwc-mode"]:checked').value;
    if(mode==='first_mes'){
      const ok=await confirmModal(`将覆盖角色卡「${cname}」的主开场白（first_mes），原内容不可恢复。确认写入？`,'覆盖确认');
      if(!ok)return;
    }
    const btn=$('#opgwc-write',box);btn.disabled=true;btn.textContent='写入中…';
    try{
      const r=await writeCard(avatar,mode,fenced);
      if(r&&r.ok===false){toast(r.message||'写入失败')}
      else{toast(r&&r.message?r.message:`已写入「${cname}」`);close()}
    }catch(e){toast('写入失败：'+((e&&e.message)||e))}
    finally{btn.disabled=false;btn.textContent='写入'}
  };
}
