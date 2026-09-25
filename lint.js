/* 零依赖 lint：用 node 正则校验 AGENTS.md 硬约束与常见卫生问题
 * 运行：node lint.js（退出码 1 = 有错误）
 * 规则：
 *   1. unused-import  未使用的 import（防 typo/死引用，报告核心目标）
 *   2. localstorage   内联字面量 localStorage key 必须以 openingPageGen 开头（硬约束 7）
 *   3. console-log    console.log/debug 残留（error/warn 属合法诊断，不报）
 *   4. todo-fixme     TODO/FIXME 标记残留
 *   5. undef-ident    调用位未定义标识符（文件内无声明且非白名单全局——防漏 import/typo，曾漏过 renderConfig 的 replaceAllInString）
 * 注：各规则已对当前代码库校准（零误报）；新增规则前先在本地验证不产生假阳性。
 */
const fs=require('fs'),path=require('path');

const ROOT=path.resolve('src');
const EXT=['.js'];
const rules={};   /* name -> {level, message} 仅用于登记 */
const issues=[];  /* {file,line,rule,msg,level} */

function walk(dir){
  const out=[];
  for(const f of fs.readdirSync(dir)){
    const p=path.join(dir,f);
    if(fs.statSync(p).isDirectory())out.push(...walk(p));
    else if(EXT.includes(path.extname(p)))out.push(p);
  }
  return out;
}
const files=walk(ROOT);

/* ---------- 规则 1：未使用 import ---------- */
function checkUnusedImport(file,src,lines){
  lines.forEach((line,i)=>{
    const m=/^import\s*\{([^}]*)\}\s*from/.exec(line);
    if(!m)return;
    const bindings=m[1].split(',').map(s=>s.trim()).filter(Boolean);
    const bodyAfter=lines.slice(i+1).join('\n');
    for(const b of bindings){
      const local=(b.split(/\s+as\s+/)[1]||b).trim();
      let uses;
      if(local==='$'||local==='$$')uses=(bodyAfter.split(local+'(').length-1);
      else{
        const re=new RegExp('\\b'+local.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g');
        uses=(bodyAfter.match(re)||[]).length;
      }
      if(uses===0)issues.push({file,line:i+1,rule:'unused-import',level:'error',msg:`未使用 import：${local}`});
    }
  });
}

/* ---------- 规则 2：localStorage 字面量 key 前缀 ---------- */
function checkLocalStorage(file,src,lines){
  lines.forEach((line,i)=>{
    const re=/localStorage\.(get|set|remove)Item\(\s*(['"])([^'"]*)\2/g;
    let m;
    while((m=re.exec(line))){
      const key=m[3];
      if(!key.startsWith('openingPageGen'))
        issues.push({file,line:i+1,rule:'localstorage',level:'error',msg:`localStorage key 必须以 openingPageGen 开头：'${key}'`});
    }
  });
}

/* ---------- 规则 3：console.log/debug 残留 ---------- */
function checkConsoleLog(file,src,lines){
  lines.forEach((line,i)=>{
    if(/console\.(log|debug)\(/.test(line))
      issues.push({file,line:i+1,rule:'console-log',level:'warn',msg:'console.log/debug 残留'});
  });
}

/* ---------- 规则 4：TODO/FIXME 残留 ---------- */
function checkTodoFIXME(file,src,lines){
  lines.forEach((line,i)=>{
    if(/\b(TODO|FIXME|HACK)\b/.test(line))
      issues.push({file,line:i+1,rule:'todo-fixme',level:'warn',msg:'TODO/FIXME/HACK 标记残留'});
  });
}

/* ---------- 规则 5：调用位未定义标识符 ----------
 * 只查 `foo(` 调用形态：若文件内无任何声明（import/const/let/var/function/class/解构/参数）
 * 且不在 JS/浏览器全局白名单，则疑似漏 import 或 typo（如 replaceAllInString 事故）。
 * 先做词法预清洗（字符串/模板串内容/注释置空，模板串保留 ${} 表达式），避免 HTML 文案被误当调用位。
 * 清洗保持字符长度不变，因此行号可直接映射回源文件。设计取向：宁漏报勿误报。 */
const JS_GLOBALS=new Set(('if,for,while,do,switch,case,catch,finally,try,return,throw,break,continue,else,function,class,extends,super,this,arguments,new,typeof,instanceof,void,delete,in,of,var,let,const,async,await,yield,import,export,with,debugger,null,true,false,Infinity,NaN,undefined,globalThis,'+
  'Array,ArrayBuffer,Boolean,DataView,Date,Error,EvalError,Function,JSON,Map,Math,Number,Object,Promise,Proxy,RangeError,ReferenceError,Reflect,RegExp,Set,Symbol,SyntaxError,TypeError,URIError,WeakMap,WeakRef,WeakSet,BigInt,BigInt64Array,BigUint64Array,Int8Array,Int16Array,Int32Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Float32Array,Float64Array,SharedArrayBuffer,FinalizationRegistry,Atomics,Intl,String,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,escape,eval,isFinite,isNaN,parseFloat,parseInt,unescape,'+
  'window,document,navigator,location,history,localStorage,sessionStorage,console,alert,confirm,prompt,fetch,XMLHttpRequest,WebSocket,Worker,SharedWorker,Blob,File,FileReader,FileList,FormData,Headers,Request,Response,URL,URLSearchParams,crypto,atob,btoa,structuredClone,reportError,queueMicrotask,setTimeout,setInterval,clearTimeout,clearInterval,requestAnimationFrame,cancelAnimationFrame,requestIdleCallback,getComputedStyle,matchMedia,ResizeObserver,MutationObserver,IntersectionObserver,PerformanceObserver,CustomEvent,Event,EventTarget,ErrorEvent,MessageEvent,KeyboardEvent,MouseEvent,PointerEvent,TouchEvent,InputEvent,DragEvent,ProgressEvent,CloseEvent,DOMException,DOMParser,XMLSerializer,Node,NodeList,Element,HTMLElement,Document,DocumentFragment,ShadowRoot,Range,Selection,Text,Comment,CSS,customElements,screen,self,top,parent,frames,open,close,print,focus,blur,scroll,scrollTo,scrollBy,innerWidth,innerHeight,devicePixelRatio,addEventListener,removeEventListener,dispatchEvent,getSelection,performance,caches,indexedDB,isSecureContext,origin,TextEncoder,TextDecoder,TextEncoderStream,TextDecoderStream,AbortController,AbortSignal,BroadcastChannel,MessageChannel,MessagePort,Image,Audio,Path2D,createImageBitmap,Notification,queryLocalFonts,showOpenFilePicker,showSaveFilePicker,showDirectoryPicker,trustedTypes,visualViewport,speechSynthesis,ResizeObserverEntry,import,'+
  'process,require,module,exports,Buffer,global,__dirname,__filename').split(','));

/* 词法预清洗（长度不变）：字符串/模板串内容/注释/正则字面量内容置空（模板串保留 ${} 内表达式）。
 * 不清洗正则会让含引号的正则（如 /"/g）令后续解析失步——css.js 的 rgba/var 等 FP 皆源于此 */
const RE_PRECEDING_KEYWORDS=/(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await|throw)$/;
function scrubLex(src){
  let out='',i=0;const n=src.length;
  function prevMeaningful(){let j=out.length-1;while(j>=0&&/\s/.test(out[j]))j--;return j>=0?out[j]:''}
  function prevWord(){const mm=/([a-zA-Z_$][\w$]*)$/.exec(out.replace(/\s+$/,''));return mm?mm[1]:''}
  function skipStr(q){
    out+=' ';i++;
    while(i<n){
      const c=src[i];
      if(c==='\\'){out+='  ';i+=2;continue}
      if(q==='`'&&c==='$'&&src[i+1]==='{'){out+=' {';i+=2;code(1);out+='}';continue}
      if(c===q){out+=' ';i++;return}
      out+=c==='\n'?'\n':' ';i++;
    }
  }
  function skipRegex(){
    /* 正则字面量内容置空（/ 已在调用方消费）；字符类内 [^/] 不终结；未闭合则止于行尾（多置空无害） */
    out+=' ';i++;
    let inCls=false,clsFirst=false,closed=false;
    while(i<n){
      const c=src[i];
      if(c==='\\'){out+='  ';i+=2;clsFirst=false;continue} /* 转义计为类成员：[\r\n] 这类转义开头的类，clsFirst 不清会让 ] 被误当首成员字面量而永不闭合 */
      if(c==='\n')break;
      if(inCls){if(c===']'&&!clsFirst)inCls=false;clsFirst=false;out+=' ';i++;continue}
      if(c==='['){inCls=true;clsFirst=true;out+=' ';i++;continue}
      if(c==='/'){out+=' ';i++;closed=true;break}
      out+=' ';i++;
    }
    if(closed)while(i<n&&/[a-z]/.test(src[i])){out+=' ';i++} /* flags */
  }
  function code(tpl){
    let depth=0;
    while(i<n){
      const c=src[i];
      if(c==='\''||c==='"'||c==='`'){skipStr(c);continue}
      if(c==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n'){out+=' ';i++}continue}
      if(c==='/'&&src[i+1]==='*'){out+='  ';i+=2;while(i<n&&!(src[i]==='*'&&src[i+1]==='/')){out+=src[i]==='\n'?'\n':' ';i++}out+='  ';i+=2;continue}
      if(c==='/'){
        const pc=prevMeaningful();
        /* 除法/正则启发式：前一有效字符属标点集（或前一词为关键字）→ 正则；标识符/数字/)/]/. 后 → 除法 */
        if(pc===''||'([{,;=:?!&|+-*%~^>'.includes(pc)||RE_PRECEDING_KEYWORDS.test(prevWord())){skipRegex();continue}
        out+=c;i++;continue;
      }
      if(c==='{'){depth++;out+=c;i++;continue}
      if(c==='}'){if(tpl&&depth===0){i++;return}if(depth>0)depth--;out+=c;i++;continue}
      out+=c;i++;
    }
  }
  code(0);
  return out;
}

function checkUndefIdent(file,src,lines){
  const s=scrubLex(src);
  /* 宽松收集"已定义"名字（宁可多收造成漏报，不可漏收造成误报） */
  const defined=new Set();
  const add=x=>{
    const n=String(x).trim().replace(/^\.\.\./,'').split(/[=\s:]/)[0].trim();
    if(/^[a-zA-Z_$][\w$]*$/.test(n))defined.add(n);
  };
  /* 参数/解构项：把 item 内全部标识符 token 都算已定义（兼容 {a,b}、a:b 改名、a=1 默认值；多收无害） */
  const addAll=x=>String(x).replace(/[a-zA-Z_$][\w$]*/g,t=>{defined.add(t)});
  let m;
  const run=(re,fn)=>{re.lastIndex=0;while((m=re.exec(s)))fn(m)};
  run(/import\s*\{([^}]*)\}/g,mm=>mm[1].split(',').forEach(x=>{const nm=/\bas\s+([a-zA-Z_$][\w$]*)/.exec(x);add(nm?nm[1]:x)}));
  run(/import\s+([a-zA-Z_$][\w$]*)\s*(?:,|from\b)/g,mm=>add(mm[1]));
  run(/import\s*\*\s*as\s+([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  run(/\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  run(/[,;{(]\s*([a-zA-Z_$][\w$]*)\s*=(?![=>])/g,mm=>add(mm[1])); /* 逗号多重声明 const a=1,b=2 等 */
  run(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g,mm=>mm[1].split(',').forEach(addAll));
  run(/\b(?:const|let|var)\s*\[([^\][]*)\]\s*=/g,mm=>mm[1].split(',').forEach(addAll));
  run(/\bfunction\s*\*?\s*([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  run(/\bclass\s+([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  run(/\(((?:[^()]|\([^()]*\))*)\)\s*=>/g,mm=>mm[1].split(',').forEach(addAll)); /* 括号箭头参数（允许一层嵌套/解构） */
  run(/\(\s*\{([^{}]*)\}[^)]*\)\s*=>/g,mm=>mm[1].split(',').forEach(addAll)); /* 解构参数 ({a,b})=> */
  run(/[=(,>:?]\s*([a-zA-Z_$][\w$]*)\s*=>/g,mm=>add(mm[1])); /* 单参箭头 x=>（含柯里化 a=>b=>） */
  run(/\bfunction\s*[\w$]*\s*\(((?:[^()]|\([^()]*\))*)\)/g,mm=>mm[1].split(',').forEach(addAll));
  run(/\bcatch\s*\(\s*([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  run(/\bfor\s*\(\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g,mm=>add(mm[1]));
  /* 方法简写参数：cached(key,produce){ / renderConfig(p){ / getter —— p4 只覆盖 function 关键字形态，此处补齐 */
  run(/[(;{},\n]\s*([a-zA-Z_$][\w$]*)\s*\(((?:[^()]|\([^()]*\))*)\)\s*\{/g,mm=>{if(!JS_GLOBALS.has(mm[1]))mm[2].split(',').forEach(addAll)});
  /* 扫描调用位 */
  const callRe=/([a-zA-Z_$][\w$]*)\s*\(/g;
  while((m=callRe.exec(s))){
    const name=m[1];
    if(JS_GLOBALS.has(name)||defined.has(name))continue;
    /* 成员调用 foo.bar( / 可选链 ?.bar( ——查的是 bar 是否存在于对象上，不属于本规则 */
    let j=m.index-1;while(j>=0&&(s[j]===' '||s[j]==='\t'||s[j]==='\n'||s[j]==='\r'))j--;
    if(j>=0&&s[j]==='.')continue;
    /* 方法定义/函数体启发：IDENT(参数){ 后跟块 → 声明位而非调用位（load(){、if( 不走此分支因属关键字） */
    let k=callRe.lastIndex,depth=1,isDef=false;
    while(k<s.length&&depth>0){const c=s[k];if(c==='(')depth++;else if(c===')')depth--;k++}
    if(depth===0){while(k<s.length&&(s[k]===' '||s[k]==='\n'||s[k]==='\r'||s[k]==='\t'))k++;if(s[k]==='{')isDef=true}
    if(isDef)continue;
    const line=s.slice(0,m.index).split('\n').length;
    issues.push({file,line,rule:'undef-ident',level:'error',msg:`未定义标识符（疑似漏 import 或 typo）：${name}`});
  }
}

for(const file of files){
  const src=fs.readFileSync(file,'utf8');
  const lines=src.split('\n');
  const rel=file.split(path.sep).slice(-3).join('/'); /* 相对 src 更短展示 */
  checkUnusedImport(rel,src,lines);
  checkLocalStorage(rel,src,lines);
  checkConsoleLog(rel,src,lines);
  checkTodoFIXME(rel,src,lines);
  checkUndefIdent(rel,src,lines);
}

/* 输出 */
let errCount=0,warnCount=0;
if(issues.length){
  for(const it of issues){
    const tag=it.level==='error'?'✖':'⚠';
    if(it.level==='error')errCount++;else warnCount++;
    console.log(`  ${tag} [${it.rule}] ${it.file}:${it.line}  ${it.msg}`);
  }
  console.log(`\n${errCount} 个错误, ${warnCount} 个警告`);
}else{
  console.log('✓ lint 通过：未发现问题');
}
process.exit(errCount?1:0);