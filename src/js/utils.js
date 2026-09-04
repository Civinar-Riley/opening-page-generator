/* ================================================================
 * 工具函数
 * ================================================================ */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
/* 单调计数器：同毫秒内连续调用也不会重复（时间戳 + 序号 + 随机后缀） */
let _uidSeq=0;
const uid=()=>Date.now().toString(36)+(_uidSeq++).toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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

/* 导出代码简易语法高亮：标签 / 属性 / 双引号字符串（纯正则，无外部依赖） */
function highlightCode(src){
  let s=String(src??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  /* 1. 字符串先占位，避免后续规则误伤 */
  const strs=[];
  s=s.replace(/"[^"\n]*"/g,m=>{strs.push("<span class='hl-str'>"+m+"</span>");return '\u0000'+(strs.length-1)+'\u0000'});
  /* 2. 标签名（排除 JS 比较符 a<b 场景：&lt; 前不能是标识符/右括号）；
     用「行首或一个未排除字符」捕获组替代 lookbehind——旧 Safari(<16.4) 不支持 lookbehind，
     正则字面量在解析期编译，会令整个 bundle 白屏 */
  s=s.replace(/(^|[^a-zA-Z0-9_$)\]}])(&lt;\/?)([a-zA-Z][\w-]*)/g,"$1$2<span class='hl-tag'>$3</span>");
  /* 3. 属性名（= 后紧跟字符串占位符才算属性，避免误伤 JS 赋值） */
  s=s.replace(/([\w-]+)(=\u0000)/g,"<span class='hl-attr'>$1</span>$2");
  /* 4. 还原字符串 */
  s=s.replace(/\u0000(\d+)\u0000/g,(_,i)=>strs[+i]);
  return s;
}

export {$, $$, uid, esc, toast, copyText, download, confirmModal, promptModal, highlightCode};

