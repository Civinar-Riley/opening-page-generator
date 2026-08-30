/* ================================================================
 * 工具函数
 * ================================================================ */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),1800)}
function copyText(txt){
  if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(txt).then(()=>toast('已复制到剪贴板'));return}
  const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('已复制到剪贴板')}catch(e){toast('复制失败，请手动选择复制')}
  ta.remove();
}
function download(name,content){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'application/octet-stream'}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* 统一模态框：替代原生 confirm / prompt */
let _modalRoot=null;
function _ensureModal(){
  if(_modalRoot)return;
  _modalRoot=document.createElement('div');
  _modalRoot.className='opg-modal-root';
  _modalRoot.innerHTML=`<div class="opg-modal-overlay"></div>
    <div class="opg-modal-box">
      <div class="opg-modal-title"></div>
      <div class="opg-modal-msg"></div>
      <input type="text" class="opg-modal-input" style="display:none">
      <div class="opg-modal-btns">
        <button class="opg-modal-btn opg-modal-cancel">取消</button>
        <button class="opg-modal-btn opg-modal-ok">确定</button>
      </div>
    </div>`;
  document.body.appendChild(_modalRoot);
  /* 样式 */
  const st=document.createElement('style');
  st.textContent=`
.opg-modal-root{display:none;position:fixed;inset:0;z-index:2147483647;align-items:center;justify-content:center}
.opg-modal-root.show{display:flex}
.opg-modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.opg-modal-box{position:relative;background:#1e1e2e;color:#e0e0e5;border-radius:12px;padding:20px 24px;min-width:320px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:inherit}
.opg-modal-title{font-size:15px;font-weight:600;margin-bottom:8px;color:#fff}
.opg-modal-msg{font-size:13px;line-height:1.7;opacity:.88;white-space:pre-wrap;margin-bottom:14px}
.opg-modal-input{width:100%;padding:8px 12px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(255,255,255,.07);color:#e0e0e5;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box}
.opg-modal-input:focus{border-color:#7c6cf0}
.opg-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.opg-modal-btn{padding:7px 18px;border:none;border-radius:6px;font-size:13px;cursor:pointer;transition:all .15s;font-family:inherit}
.opg-modal-cancel{background:rgba(255,255,255,.1);color:#ccc}
.opg-modal-cancel:hover{background:rgba(255,255,255,.18)}
.opg-modal-ok{background:#7c6cf0;color:#fff}
.opg-modal-ok:hover{filter:brightness(1.15)}`;
  document.head.appendChild(st);
}
function _showModal({title='',msg='',input=false,defaultVal=''}){
  _ensureModal();
  return new Promise(resolve=>{
    const r=_modalRoot;
    r.querySelector('.opg-modal-title').textContent=title;
    r.querySelector('.opg-modal-msg').textContent=msg;
    const inp=r.querySelector('.opg-modal-input');
    if(input){inp.style.display='';inp.value=defaultVal;setTimeout(()=>inp.focus(),50)}
    else{inp.style.display='none'}
    r.classList.add('show');
    function close(val){
      r.classList.remove('show');
      r.querySelector('.opg-modal-ok').removeEventListener('click',onOk);
      r.querySelector('.opg-modal-cancel').removeEventListener('click',onCancel);
      r.querySelector('.opg-modal-overlay').removeEventListener('click',onCancel);
      inp.removeEventListener('keydown',onKey);
      resolve(val);
    }
    function onOk(){close(input?inp.value:true)}
    function onCancel(){close(input?null:false)}
    function onKey(e){if(e.key==='Enter')onOk();if(e.key==='Escape')onCancel()}
    r.querySelector('.opg-modal-ok').addEventListener('click',onOk);
    r.querySelector('.opg-modal-cancel').addEventListener('click',onCancel);
    r.querySelector('.opg-modal-overlay').addEventListener('click',onCancel);
    inp.addEventListener('keydown',onKey);
  });
}
function confirmModal(msg,title='确认'){return _showModal({title,msg})}
function promptModal(msg,defaultVal='',title='输入'){return _showModal({title,msg,input:true,defaultVal})}

export {$, $$, uid, esc, toast, copyText, download, confirmModal, promptModal, encryptApiKey, decryptApiKey};

/* ================================================================
 * API Key 加密/解密（Web Crypto API · AES-GCM）
 * ================================================================ */
function _toBase64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}
function _fromBase64(b64){const s=atob(b64);const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function _deriveKey(passphrase,salt){
  const enc=new TextEncoder();
  const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptApiKey(plaintext,passphrase){
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(passphrase,salt);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(plaintext));
  return JSON.stringify({salt:_toBase64(salt),iv:_toBase64(iv),ct:_toBase64(ct)});
}
async function decryptApiKey(cipherJson,passphrase){
  try{
    const{salt,iv,ct}=JSON.parse(cipherJson);
    const key=await _deriveKey(passphrase,_fromBase64(salt));
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:_fromBase64(iv)},key,_fromBase64(ct));
    return new TextDecoder().decode(pt);
  }catch(e){return null}
}

