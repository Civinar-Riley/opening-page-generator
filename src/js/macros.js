/* 宏替换引擎（仅预览用；导出代码保留原始宏） */
const Macros={
  /* 预览用变量池：setvar/getvar 跨区块共享（仅预览，导出保留原样由酒馆解析） */
  vars:{},

  /* 预览随机结果缓存：编辑期间 random/roll/抽取结果保持稳定，避免打字时预览闪变；
     点「↻ 刷新」或切换工程时清空重掷 */
  _cache:{},
  cached(key,produce){
    if(this._cache[key]===undefined)this._cache[key]=produce();
    return this._cache[key];
  },
  resetCache(){this._cache={}},

  builtin(){
    const d=new Date(),wd=['日','一','二','三','四','五','六'];
    const p2=n=>String(n).padStart(2,'0');
    return {
      time:`${p2(d.getHours())}:${p2(d.getMinutes())}`,
      date:`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,
      isotime:`${p2(d.getHours())}:${p2(d.getMinutes())}`,
      isodate:`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,
      weekday:`星期${wd[d.getDay()]}`,
      model:'(当前模型)',
      idleDuration:'片刻',
    };
  },

  /* 骰子表达式解析：1d20 / 2d6+3 / d100-1 → 结果数字 */
  dice(expr){
    const m=/^\s*(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(String(expr));
    if(!m)return null;
    const n=Math.min(50,Math.max(1,parseInt(m[1]||'1',10)));
    const faces=Math.min(1000,Math.max(2,parseInt(m[2],10)));
    let sum=0;
    for(let i=0;i<n;i++)sum+=Math.floor(Math.random()*faces)+1;
    if(m[3])sum+=parseInt(m[3].replace(/\s/g,''),10);
    return sum;
  },
  /* 按双冒号拆分参数（宏参数推荐语法） */
  splitArgs(s){return String(s).split('::').map(x=>x.trim())},
  /* 从列表参数中随机取一项（兼容 :: 与逗号两种分隔） */
  pickOne(arg){
    let arr;
    if(arg.includes('::'))arr=this.splitArgs(arg);
    else arr=arg.split(',').map(s=>s.trim());
    arr=arr.filter(Boolean);
    return arr.length?arr[Math.floor(Math.random()*arr.length)]:'';
  },
  /* 不重复随机：记忆上次结果避开；候选耗尽（只剩1个）后重置。key 用于区分不同调用点 */
  pickOneNr(key,arg){
    let arr;
    if(arg.includes('::'))arr=this.splitArgs(arg);
    else arr=arg.split(',').map(s=>s.trim());
    arr=arr.filter(Boolean);
    if(arr.length<=1)return arr.length?arr[0]:'';
    const lastKey='_nr_last:'+key;
    const last=this.vars[lastKey];
    let pool=arr.filter(x=>x!==last);
    if(!pool.length)pool=arr; /* 全部与上次相同（候选只剩一类）时重置 */
    const pick=pool[Math.floor(Math.random()*pool.length)];
    this.vars[lastKey]=pick;
    return pick;
  },

  /* 替换文本中的宏。custom: [{k:'char',v:'x'},...] */
  apply(text,custom){
    let out=String(text??'');
    const map={};
    (custom||[]).forEach(m=>{if(m.k)map[m.k.toLowerCase()]=m.v});
    const bi=this.builtin();

    /* setvar：先收集赋值（支持 {{setvar::名::值}} 与 {{setvar 名 值}}） */
    out=out.replace(/\{\{\s*setvar\s*(?:::|\s+)\s*([^:{}]+?)\s*(?:::|\s+)\s*([^{}]*?)\s*\}\}/gi,(_,k,v)=>{this.vars[k.trim().toLowerCase()]=v;return ''});

    /* random / roll 双冒号新语法 + 旧版单冒号/逗号兼容（结果走缓存，编辑期间稳定）；
       列表参数允许包含一层非嵌套花括号（如 {{random::a{b}::c}}），双层嵌套不支持 */
    out=out.replace(/\{\{\s*random\s*(?:::|:|\s+)\s*((?:[^{}]+|\{[^{}]*\})+?)\s*\}\}/gi,(_,list)=>this.cached('random:'+list,()=>this.pickOne(list)));
    /* 不重复随机：{{random_nr::a::b::c}}（预览每次编辑会重掷，但同一次会话内相邻两次不重复） */
    out=out.replace(/\{\{\s*random_nr\s*(?:::|:|\s+)\s*((?:[^{}]+|\{[^{}]*\})+?)\s*\}\}/gi,(_,list)=>this.pickOneNr('random_nr:'+list,list));
    out=out.replace(/\{\{\s*(?:pick|rand)\s*(?:::|:|\s+)\s*((?:[^{}]+|\{[^{}]*\})+?)\s*\}\}/gi,(_,list)=>this.cached('pick:'+list,()=>this.pickOne(list)));
    out=out.replace(/\{\{\s*roll\s*(?:::|:|\s+)\s*([^{}]+?)\s*\}\}/gi,(_,e)=>this.cached('roll:'+e,()=>{
      const r=this.dice(e);
      if(r!==null)return String(r);
      const n=parseInt(e,10);/* 旧版 {{roll:100}} = 1~N */
      return String(isNaN(n)?Math.floor(Math.random()*100)+1:Math.floor(Math.random()*n)+1);
    }));

    /* getvar 与命名宏 */
    out=out.replace(/\{\{\s*getvar\s*(?:::|\s+)\s*([^:{}]+?)\s*\}\}/gi,(_,k)=>{
      const v=this.vars[k.trim().toLowerCase()];
      return v===undefined?'':v;
    });
    out=out.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g,(m,k)=>{
      const lk=k.toLowerCase();
      if(map[lk]!==undefined)return map[lk];
      if(bi[lk]!==undefined)return bi[lk];
      return m; // 未知宏保留
    });
    return out;
  },
};

export {Macros};
