/* HTML 结构生成：按区块顺序逐块渲染（从 gen.js 拆分） */
import { esc } from '../utils.js';
import { Macros } from '../macros.js';

/* 开场白列表项的中文数字序号（与 scripts.js 运行时 renderList 共用同一视觉，
   运行时脚本字符串自包含无法引用此常量，改动须两处同步）；超过 10 条回落阿拉伯数字 */
const GNUM='壹贰叁肆伍陆柒捌玖拾';

export function body(p,px,blocks,isPreview){
    const g=i=>Macros.apply(i,p.macros); // 预览时替换宏
    const raw=i=>String(i??'');           // 导出时保留宏
    const tx=isPreview?g:raw;
    const motionOff=p.theme&&p.theme.motion==='off'; // 动效档位：off 时解码等纯装饰脚本不产出
    let out='',lbOut=false;               // lbOut：灯箱层全页仅输出一份
    /* 按用户配置的顺序逐块渲染（↑↓/拖拽排序真实生效）；
       每块包一层实例作用域 div（display:contents），支持同类型多实例 */
    blocks.forEach((b,i)=>{
      out+=`  <div class="${px}-bk${i}">\n`;
      switch(b.type){
        case 'welcome':
          out+=(b.showEyebrow&&b.eyebrow?`  <div class="${px}-eyebrow">${esc(tx(b.eyebrow))}</div>\n`:'')+`  <h1 class="${px}-title">${esc(tx(b.title))}</h1>\n  <div class="${px}-subtitle">${esc(tx(b.subtitle))}</div>\n`;
          break;
        case 'quote':{
          const src=b.source?`<span class="${px}-qsrc">—— ${esc(tx(b.source))}</span>`:'';
          out+=`  <div class="${px}-quote">${esc(tx(b.text))}${src}</div>\n`;
          break;
        }
        case 'profile':{
          const chars=(Array.isArray(b.characters)&&b.characters.length)?b.characters:[{name:'',desc:'',tags:'',avatar:''}];
          /* 角色 >2 个：自动折叠为「只显示名字」列表，点击名字展开完整卡片。
             用 <details> 实现无需脚本，预览与导出行为一致 */
          const many=chars.length>2;
          /* 头像来源三模式：manual=手动 URL（<img>）；char/user=酒馆渲染器零 JS 方案——
             渲染器检测到 .char-avatar/.user-avatar 类即注入对应头像背景图（无 API、最兼容），
             预览环境无渲染器，显示占位底色 */
          const avEl=ch=>{
            if(!b.showAvatar)return '';
            const m=ch.avatarMode==='char'?'char-avatar':ch.avatarMode==='user'?'user-avatar':'';
            if(m)return `    <div class="${px}-avatar ${m}"></div>\n`;
            if(ch.avatar)return `    <img class="${px}-avatar" src="${esc(tx(ch.avatar))}" alt="avatar" onerror="this.style.display='none'">\n`;
            return '';
          };
          chars.forEach(ch=>{
            const nameRaw=tx(ch.name||'');
            if(many){
              let body='';
              const av=avEl(ch);if(av)body+=`      ${av.trim()}\n`;
              let sub='';
              if(b.showDesc&&ch.desc)sub+=`        <div class="${px}-pdesc">${esc(tx(ch.desc))}</div>\n`;
              if(b.showTags&&ch.tags){
                const tags=tx(ch.tags).split(/[,，]/).map(s=>s.trim()).filter(Boolean);
                if(tags.length)sub+=`        <div class="${px}-ptags">\n${tags.map(t=>`          <span class="${px}-ptag">${esc(t)}</span>\n`).join('')}        </div>\n`;
              }
              if(sub)body+=`      <div>\n${sub}      </div>\n`;
              out+=`  <details class="${px}-profc">\n`;
              out+=`    <summary class="${px}-phead"><span class="${px}-parrow">▸</span><span class="${px}-pname">${esc(nameRaw||'未命名')}</span></summary>\n`;
              if(body)out+=`    <div class="${px}-pbody">\n${body}    </div>\n`;
              out+=`  </details>\n`;
              return;
            }
            let inner='';
            inner+=avEl(ch);
            inner+=`    <div>\n`;
            if(b.showName&&ch.name)inner+=`      <div class="${px}-pname">${esc(tx(ch.name))}</div>\n`;
            if(b.showDesc&&ch.desc)inner+=`      <div class="${px}-pdesc">${esc(tx(ch.desc))}</div>\n`;
            if(b.showTags&&ch.tags){
              const tags=tx(ch.tags).split(/[,，]/).map(s=>s.trim()).filter(Boolean);
              if(tags.length)inner+=`      <div class="${px}-ptags">\n${tags.map(t=>`        <span class="${px}-ptag">${esc(t)}</span>\n`).join('')}      </div>\n`;
            }
            inner+=`    </div>\n`;
            out+=`  <div class="${px}-profile">\n${inner}  </div>\n`;
          });
          break;
        }
        case 'gallery':{
          const imgs=Array.isArray(b.images)?b.images.filter(x=>x.url):[];
          if(imgs.length){
            out+=`  <div class="${px}-gal">\n`;
            imgs.forEach(im=>{
              out+=`    <figure><img data-opg="gimg" src="${esc(tx(im.url))}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'">${im.cap?`<figcaption>${esc(tx(im.cap))}</figcaption>`:''}</figure>\n`;
            });
            out+=`  </div>\n`;
            /* 灯箱层全页共用一份（运行时只绑第一个），仅随首个 gallery 实例输出 */
            if(!lbOut){out+=`  <div class="${px}-lb" data-opg="lb"><img alt=""><span class="${px}-lbcap"></span></div>\n`;lbOut=true}
          }
          break;
        }
        case 'greetings':{
          if(b.showTitle&&b.title)out+=`  <div class="${px}-ghead">${esc(tx(b.title))}</div>\n`;
          out+=`  <div class="${px}-glist" data-opg="glist">\n`;
          const items=tx(b.placeholderList).split('\n').map(s=>s.trim()).filter(Boolean);
          items.forEach((it,i)=>{
            const sep=it.includes('｜')?'｜':(it.includes('|')?'|':null);
            const title=sep?it.split(sep)[0].trim():it;
            const desc=sep?it.split(sep).slice(1).join(sep).trim():'';
            out+=`    <button type="button" class="${px}-gitem" data-opg="g" data-i="${i}"><span class="${px}-gnum">${GNUM[i]||(i+1)}</span><span class="${px}-gmain"><span class="${px}-gtitle">${esc(title)}</span>${desc?`<span class="${px}-gdesc">${esc(desc)}</span>`:''}</span></button>\n`;
          });
          out+=`  </div>\n`;
          if(b.clickAction==='send'){
            out+=`  <button type="button" class="${px}-gsend" data-opg="gsend">${esc(tx(b.buttonText||'开始'))}</button>\n`;
          }
          break;
        }
        case 'divider':{
          const customTxt=b.text?tx(b.text):'';
          const mid=customTxt||(b.style==='diamond'?'◆':(b.style==='dots'?'✦ ✦ ✦':(b.style==='flowers'?'❀ ❀ ❀':(b.style==='wave'?'〰 〰 〰':''))));
          out+=`  <div class="${px}-hr">${mid?`<span>${esc(mid)}</span>`:''}</div>\n`;
          break;
        }
        case 'disclaimer':{
          const txt=esc(tx(b.text));
          out+= b.style==='collapse'
            ? `  <details class="${px}-disc"><summary>⚠️ 免责声明</summary><div style="margin-top:6px">${txt}</div></details>\n`
            : `  <div class="${px}-disc">⚠️ ${txt}</div>\n`;
          break;
        }
        case 'author':{
          const txt=esc(tx(b.text));
          out+= b.style==='collapse'
            ? `  <details class="${px}-auth"><summary>✒️ 作者的话</summary><div style="margin-top:6px;white-space:pre-wrap">${txt}</div></details>\n`
            : b.style==='card'
              ? `  <div class="${px}-authc"><div class="${px}-authh">💬 作者的话</div><div class="${px}-authb">${txt}</div></div>\n`
              : `  <div class="${px}-auth" style="white-space:pre-wrap">✒️ ${txt}</div>\n`;
          break;
        }
        case 'freehtml':
          out+=`  <div class="${px}-free">\n${tx(b.html)}\n  </div>\n`;
          break;
        case 'clockbar':
          /* 内容不转义：允许 <i> FA 图标等内联 HTML；预览替换宏，导出保留原样 */
          out+=`  <div class="${px}-clock">${tx(b.text)}</div>\n`;
          break;
        case 'randomevent':{
          const rawLines=String(b.lines??'').split('\n').map(x=>x.trim()).filter(Boolean);
          if(b.showTitle)out+=`  <div class="${px}-revt">${esc(tx(b.title))}</div>\n`;
          if(rawLines.length){
            const linesKey=rawLines.join('\u0001');/* 缓存 key：内容不变则抽取结果稳定 */
            let inner;
            if(b.pickMode==='one'){
              /* 导出：整组包成 {{random::…}}，酒馆每次渲染随机一条；
                  预览：宏引擎不支持嵌套，直接随机选一行模拟效果（结果缓存防闪变）。
                  行内 :: 与 }} 都会破坏 {{random}} 宏语法，导出前替换为兼容字符 */
              inner=isPreview
                ?esc(tx(Macros.cached('one:'+linesKey,()=>rawLines[Math.floor(Math.random()*rawLines.length)]||'')))
                :'{{random::'+rawLines.map(l=>l.replace(/::/g,'⦂').replace(/\}\}/g,'⎬⎬')).join('::')+'}}';
              out+=`  <div class="${px}-rbox"><div class="${px}-rline">${inner}</div></div>\n`;
            }else if(b.pickMode==='shuffle'){
              /* shuffle：预览时随机打乱顺序；导出为固定顺序（酒馆宏无法整组乱序，UI 已注明） */
              const shuffled=isPreview
                ?Macros.cached('shuffle:'+linesKey,()=>[...rawLines].sort(()=>Math.random()-0.5))
                :rawLines;
              const rows=tx(shuffled.join('\n'))
                .split('\n').map(l=>`    <div class="${px}-rline">${isPreview?esc(l):l}</div>`).join('\n');
              out+=`  <div class="${px}-rbox">\n${rows}\n  </div>\n`;
            }else{
              const rows=tx(rawLines.join('\n'))
                .split('\n').map(l=>`    <div class="${px}-rline">${isPreview?esc(l):l}</div>`).join('\n');
              out+=`  <div class="${px}-rbox">\n${rows}\n  </div>\n`;
            }
          }
          break;
        }
        case 'dice':{
          const expr=b.expr||'1d20';
          const val=isPreview?Macros.apply('{{roll::'+expr+'}}',p.macros):'{{roll::'+expr+'}}';
          out+=`  <span class="${px}-dice"><span class="${px}-dlabel">🎲 ${esc(tx(b.label))}</span><span class="${px}-dval">${esc(val)}</span></span>\n`;
          break;
        }
        case 'countdown':{
          const tgt=String(b.target||'');
          const done=esc(tx(b.doneText||''));
          out+=`  <div class="${px}-cd" data-target="${esc(tgt)}" data-done="${done}">\n`;
          out+=`    <div class="${px}-cd-title">${esc(tx(b.title||''))}</div>\n`;
          out+=`    <div class="${px}-cd-val" data-opg="cdv">--</div>\n`;
          out+=`  </div>\n`;
          /* 内联脚本每秒刷新；目标时间取访问者本地时间，与酒馆时区无关 */
          out+=`  <script>
(function(){
  var el=document.currentScript.previousElementSibling;if(!el)return;
  var v=el.querySelector('[data-opg="cdv"]');if(!v)return;
  var t=new Date(el.getAttribute('data-target')||'').getTime();
  if(isNaN(t)){v.textContent='⚠️ 未设置目标时间';return}
  var done=el.getAttribute('data-done')||'';
  /* 存储层 esc 转义（防属性注入），运行时 getAttribute 拿到的是转义后的字面文本：
     textContent 不解析 HTML，须手动还原实体，否则完成文案会显示成 &lt;b&gt;… 原样实体码 */
  var ta=document.createElement('textarea');ta.innerHTML=done;done=ta.value;
  function pad(n){return(n<10?'0':'')+n}
  function tick(){
    var d=t-Date.now();
    if(d<=0){v.textContent=done||'⏰ 时间到！';el.classList.add('${px}-cd-done');return}
    var s=Math.floor(d/1000),days=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
    var parts=[];
    if(days)parts.push(days+' 天');
    parts.push(pad(h)+' : '+pad(m)+' : '+pad(sec));
    v.textContent=parts.join(' ');
  }
  tick();setInterval(tick,1000);
})();
  <\/script>\n`;
          break;
        }
        case 'timeline':{
          if(b.showTitle)out+=`  <div class="${px}-tl-title">${esc(tx(b.title||''))}</div>\n`;
          const nodes=String(b.nodes??'').split('\n').map(s=>s.trim()).filter(Boolean);
          nodes.forEach(nd=>{
            /* 末段命中白名单才认作状态，其余段全部并回描述——描述含 | 不再丢内容/错乱状态 */
            const seg=nd.split('|');
            const stRaw=(seg[seg.length-1]||'').trim().toLowerCase();
            const hasSt=['done','current','lock'].includes(stRaw);
            const st=hasSt?stRaw:'lock';
            const name=(seg[0]||'').trim();
            const desc=(hasSt?seg.slice(1,-1):seg.slice(1)).join('|').trim();
            out+=`  <div class="${px}-tl-node ${px}-tl-${st}"><div class="${px}-tl-dot"></div><div class="${px}-tl-body"><div class="${px}-tl-name">${esc(tx(name))}</div>${desc?`<div class="${px}-tl-desc">${esc(tx(desc))}</div>`:''}</div></div>\n`;
          });
          break;
        }
        case 'bgm':{
          const tracks=Array.isArray(b.tracks)?b.tracks.filter(t=>t.url):[];
          if(tracks.length){
            /* 显式判型：音量 0 是合法值，不能用 ||50 兜底（会把 0 吞成 50） */
            const vol=Math.max(0,Math.min(100,Number.isFinite(+b.volume)?+b.volume:50));
            const loopAttr=b.loop?' loop':'';
            const titleHtml=b.showTitle?`<div class="${px}-bgm-title">${esc(tx(b.title))}</div>`:'';
            const dataCmds=b.useTavernCmd?` data-cmds="1"`:'';
            out+=`  <div class="${px}-bgm"${dataCmds}>\n${titleHtml}    <div class="${px}-bgm-bar">\n      <button type="button" class="${px}-bgm-btn ${px}-bgm-play" data-opg="bgm-play">▶</button>\n      <span class="${px}-bgm-name">${esc(tx(tracks[0]?.name||''))}</span>\n      <input type="range" class="${px}-bgm-prog" min="0" max="100" value="0">\n      <span class="${px}-bgm-time">0:00</span>\n      <input type="range" class="${px}-bgm-vol" min="0" max="100" value="${vol}">\n      <button type="button" class="${px}-bgm-btn ${px}-bgm-loop${b.loop?' on':''}" data-opg="bgm-loop">🔁</button>\n    </div>\n  </div>\n  <audio class="${px}-bgm-audio" preload="auto"${loopAttr}>\n${tracks.map(t=>`    <source data-name="${esc(tx(t.name))}" src="${esc(tx(t.url))}">`).join('\n')}\n  </audio>\n`;
          }
          break;
        }
        case 'fx':{
          const count=Math.max(1,Math.min(100,Number.isFinite(+b.count)?+b.count:30));
          const spd=Math.max(.2,Math.min(3,+b.speed||1));
          const op=Math.max(.1,Math.min(1,+b.opacity||.8));
          const effect=b.effect||'meteor';
          const notes=['♪','♫','♩','♬'];
          const notesStr=notes.join('');
          out+=`  <div class="${px}-fx" data-fx="${esc(effect)}" data-count="${count}" data-speed="${spd}" data-opacity="${op}" data-notes="${notesStr}"></div>\n`;
          out+=`  <script>\n(function(){var c=document.currentScript.previousElementSibling;if(!c)return;var type=c.dataset.fx,n=+c.dataset.count||30,spd=+c.dataset.speed||1,op=+c.dataset.opacity||.8,notes=(c.dataset.notes||'♪♫♩♬').split('');var ns=['meteor','snow','rain'];for(var i=0;i<n;i++){var p=document.createElement('div');p.className='${px}-fx-p';var dur=(2+Math.random()*4)/spd;if(ns.indexOf(type)>=0)p.style.animationDuration=dur+'s';else p.style.animationDuration=(1.5+Math.random()*3)/spd+'s';p.style.animationDelay=(-Math.random()*dur)+'s';p.style.opacity=op;p.style.setProperty('--op',op);if(type==='note'){p.textContent=notes[Math.floor(Math.random()*notes.length)];p.style.setProperty('--s',(12+Math.random()*10)+'px');}else if(type==='meteor'){var s=12+Math.random()*20;p.style.width='2px';p.style.height=s+'px';}else{var sz=type==='fog'?1:(2+Math.random()*5);p.style.setProperty('--s',sz+'px');if(type==='firefly'){p.style.setProperty('--dx',(Math.random()*60-30)+'px');p.style.setProperty('--dy',(Math.random()*60-30)+'px');}else if(type==='ember'){p.style.background='#'+(Math.floor(Math.random()*3)+6)+''+(Math.floor(Math.random()*6))+'0';}}var r=Math.random()*100,pct=Math.random()*100;if(ns.indexOf(type)>=0){p.style.left=pct+'%';p.style.top='-20px';}else if(type==='fog'){p.style.top=(20+Math.random()*60)+'%';p.style.left='-200px';}else{p.style.left=pct+'%';p.style.top=r+'%';}c.appendChild(p);}})();\n  <\/script>\n`;
          break;
        }
        case 'qa':{
          const groups=Array.isArray(b.groups)?b.groups:[];
          /* showTitle=false 时不显示标题文字（仅保留折叠箭头），标题为空时回退「常见问题」 */
          const titleTxt=!b.showTitle?'':esc(tx(b.title||'常见问题'));
          out+=`  <details class="${px}-qa-wrap">\n`;
          out+=`    <summary class="${px}-qa-title"><span class="${px}-qa-tarrow">▸</span>${titleTxt}</summary>\n`;
          out+=`    <div class="${px}-qa-body">\n`;
          groups.forEach(grp=>{
            if(grp.name)out+=`    <div class="${px}-qa-group"><div class="${px}-qa-ghdr">${esc(tx(grp.name))}</div>\n`;
            (Array.isArray(grp.items)?grp.items:[]).forEach(item=>{
              out+=`    <details class="${px}-qa-item"><summary class="${px}-qa-q"><span class="${px}-qa-arrow">▸</span>${esc(tx(item.q))}</summary><div class="${px}-qa-a">${esc(tx(item.a))}</div></details>\n`;
            });
            if(grp.name)out+=`    </div>\n`;
          });
          out+=`    </div>\n`;
          out+=`  </details>\n`;
          break;
        }
        case 'changelog':{
          if(b.showTitle&&b.title)out+=`  <div class="${px}-revt">${esc(tx(b.title))}</div>\n`;
          const rows=String(b.lines??'').split('\n').map(s=>s.trim()).filter(Boolean);
          if(rows.length){
            out+=`  <div class="${px}-cl">\n`;
            rows.forEach(r=>{
              const seg=r.split('|');
              const ver=(seg[0]||'').trim(),date=(seg[1]||'').trim(),txt=seg.slice(2).join('|').trim();
              out+=`    <div class="${px}-clrow"><span class="${px}-clv">${esc(ver)}</span>${date?`<span class="${px}-cld">${esc(date)}</span>`:''}<span class="${px}-clt">${esc(txt)}</span></div>\n`;
            });
            out+=`  </div>\n`;
          }
          break;
        }
        case 'gate':{
          /* 入场闸门双主题：
             经典幕布 = hidden checkbox + label 封面，:checked 后揭开（纯 CSS 零脚本）；
             年龄验证 = 审查站面板双按钮，「进入」仍纯 CSS label，「离开」与切卡重显走内联脚本
             （hasFn 守卫 + note 降级，同 scripts.js 模式；功能性脚本，motion off 也产出）。
             checkbox id 带块索引（bk{i}）支持同类多实例；id 用 opg- 前缀（约束 1 已知例外） */
          const isAge=b.theme==='age';
          const ckId=`${px}-bk${i}-gateck`;
          out+=`  <div class="${px}-gate${isAge?' '+px+'-gateage':''}">\n`;
          out+=`    <input type="checkbox" id="${ckId}" class="${isAge?px+'-gageck':px+'-gateck'}">\n`;
          if(!isAge){
            out+=`    <label for="${ckId}" class="${px}-gatecover">\n`;
            if(b.title)out+=`      <span class="${px}-gatetitle">${esc(tx(b.title))}</span>\n`;
            if(b.text)out+=`      <span class="${px}-gatetext">${esc(tx(b.text))}</span>\n`;
            out+=`      <span class="${px}-gatebtn">${esc(tx(b.buttonText||'点击进入'))}</span>\n`;
            out+=`    </label>\n`;
          }else{
            out+=`    <div class="${px}-gagecover">\n`;
            out+=`      <div class="${px}-gagepanel">\n`;
            out+=`        <div class="${px}-gagestripe"></div>\n`;
            out+=`        <div class="${px}-gagelogo"><span class="${px}-gagedia">◆</span>${esc(tx(b.logo||'CHARACTER CARD'))}<span class="${px}-gagedia">◆</span></div>\n`;
            out+=`        <div class="${px}-gagebadge">18+</div>\n`;
            if(b.title)out+=`        <div class="${px}-gagetitle">${esc(tx(b.title))}</div>\n`;
            if(b.text)out+=`        <div class="${px}-gagetext">${esc(tx(b.text))}</div>\n`;
            out+=`        <div class="${px}-gagebtns">\n`;
            out+=`          <label for="${ckId}" class="${px}-gagebtn ${px}-gageenter">${esc(tx(b.buttonText||'是，我已年满18岁并同意进入'))}</label>\n`;
            out+=`          <button type="button" class="${px}-gagebtn ${px}-gageleave" data-opg="gateleave">${esc(tx(b.leaveText||'不，我未满18岁并离开'))}</button>\n`;
            out+=`        </div>\n`;
            out+=`      </div>\n    </div>\n`;
            /* 年龄主题运行时：离开（triggerSlash /close，缺失降级 note）+ 切卡重显（CHAT_CHANGED）。
               脚本内无反引号与字面 ${}、闭合标签转义（约束 7）；API 契约见 TAVERN_API.md §4/§6/§10 */
            out+=`  <script>
(function(){
  var root=document.currentScript.previousElementSibling;if(!root)return;
  var ck=root.querySelector('.${px}-gageck');if(!ck)return;
  function note(m){
    try{if(typeof toastr!=='undefined'&&toastr&&typeof toastr.info==='function'){toastr.info(m,'',{timeOut:2200});return}}catch(e){}
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,30,.88);color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;z-index:2147483647;max-width:80vw';
    d.textContent=m;document.body.appendChild(d);
    setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},2200);
  }
  var lv=root.querySelector('[data-opg="gateleave"]');
  if(lv)lv.addEventListener('click',function(){
    if(typeof triggerSlash!=='function'){note('未检测到酒馆助手 triggerSlash API，无法退出');return}
    try{
      var r=triggerSlash('/close');
      if(r&&typeof r.then==='function')r.catch(function(){note('离开失败：/close 未执行')});
    }catch(e){note('离开失败：'+e)}
  });
  if(typeof eventOn==='function'&&typeof tavern_events==='object'&&tavern_events){
    var ev=tavern_events.CHAT_CHANGED;
    if(ev!==undefined&&ev!==null){try{eventOn(ev,function(){ck.checked=false})}catch(e){}}
  }
})();
  <\/script>\n`;
          }
          out+=`  </div>\n`;
          break;
        }
        case 'decode':{
          const dlines=String(b.lines??'').split('\n').map(s=>s.trim()).filter(Boolean);
          if(dlines.length){
            out+=`  <div class="${px}-dec">\n`;
            dlines.forEach(l=>{out+=`    <div class="${px}-decl">${esc(tx(l))}</div>\n`});
            out+=`  </div>\n`;
            if(!motionOff)out+=`  <script>
(function(){
  var root=document.currentScript.previousElementSibling;if(!root)return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var GLYPHS='!<>-_\\\\/[]{}=+*^?#________\\u30a1\\u30a2\\u30a3\\u30a4\\u30a501';
  var els=root.children,t0=null;
  function run(el,delay){
    var fin=el.textContent,len=fin.length;
    el.textContent='\\u00a0';
    setTimeout(function(){
      var start=null;
      function frame(ts){
        if(start===null)start=ts;
        var p=Math.min((ts-start)/900,1),lock=Math.floor(p*len),s='';
        for(var i=0;i<len;i++){
          var ch=fin[i];
          s+=(i<lock||ch===' '||ch==='\\n')?ch:GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
        }
        el.textContent=s;
        if(p<1)requestAnimationFrame(frame);else el.textContent=fin;
      }
      requestAnimationFrame(frame);
    },delay);
  }
  Array.prototype.forEach.call(els,function(el,i){run(el,i*260)});
})();
  <\/script>\n`;
          }
          break;
        }
        case 'gacha':{
          const cards=String(b.cards??'').split('\n').map(s=>s.trim()).filter(Boolean)
            .map(l=>{const seg=l.split('|');return [(seg[0]||'').trim(),(seg[1]||'').trim(),seg.slice(2).join('|').trim()]});
          if(cards.length){
            out+=`  <div class="${px}-gacha">\n`;
            if(b.title)out+=`    <div class="${px}-gachahd">${esc(tx(b.title))}</div>\n`;
            out+=`    <div class="${px}-gstage" data-opg="gstage"><div class="${px}-gcard" data-opg="gcard"><div class="${px}-gface ${px}-gback">🎴<span>${esc(tx(b.buttonText||'点击抽取'))}</span></div><div class="${px}-gface ${px}-gfront" data-opg="gfront"></div></div></div>\n`;
            out+=`  </div>\n`;
            out+=`  <script>
(function(){
  var root=document.currentScript.previousElementSibling;if(!root)return;
  var card=root.querySelector('[data-opg="gcard"]'),front=root.querySelector('[data-opg="gfront"]');
  if(!card||!front)return;
  var CARDS=${jssx(tx(cards))};
  var RAR={ssr:['#f5c56b','rgba(245,197,107,.3)'],sr:['#b89cff','rgba(184,156,255,.3)'],r:['#7db8e8','rgba(125,184,232,.3)'],n:['#8a8a99','rgba(138,138,153,.25)']};
  function draw(){
    var c=CARDS[Math.floor(Math.random()*CARDS.length)];if(!c)return;
    var m=RAR[String(c[0]).toLowerCase()]||RAR.n;
    card.style.setProperty('--gr',m[0]);card.style.setProperty('--gra',m[1]);
    front.textContent='';
    var s1=document.createElement('span');s1.className='${px}-grar';s1.textContent=c[0];
    var s2=document.createElement('div');s2.className='${px}-gname';s2.textContent=c[1]||c[0];
    front.appendChild(s1);front.appendChild(s2);
    if(c[2]){var s3=document.createElement('div');s3.className='${px}-gdesc';s3.textContent=c[2];front.appendChild(s3)}
    card.classList.remove('flip');void card.offsetWidth;card.classList.add('flip');
  }
  card.addEventListener('click',draw);
})();
  <\/script>\n`;
          }
          break;
        }
        case 'egg':{
          const cnt=Math.max(2,Math.min(20,Number.isFinite(+b.count)?+b.count:5));
          const secrets=String(b.lines??'').split('\n').map(s=>s.trim()).filter(Boolean);
          if(secrets.length){
            out+=`  <button type="button" class="${px}-egg" data-opg="egg">${esc(tx(b.hint||'✦'))}</button>\n`;
            out+=`  <div class="${px}-eggmsg" data-opg="eggmsg"></div>\n`;
            out+=`  <script>
(function(){
  var msg=document.currentScript.previousElementSibling;if(!msg)return;
  var btn=msg.previousElementSibling;if(!btn)return;
  var LINES=${jssx(tx(secrets))},N=${cnt},n=0;
  btn.addEventListener('click',function(){
    n++;
    if(n<N){btn.title='再点 '+(N-n)+' 次……';return}
    btn.classList.add('on');btn.title='';
    msg.textContent=LINES[(n-N)%LINES.length];
  });
})();
  <\/script>\n`;
          }
          break;
        }
        case 'blurreveal':{
          if(b.showTitle&&b.title)out+=`  <div class="${px}-revt">${esc(tx(b.title))}</div>\n`;
          const blines=String(b.lines??'').split('\n').map(s=>s.trim()).filter(Boolean);
          if(blines.length){
            const hint=esc(tx(b.hint||'点击显示'));
            out+=`  <div class="${px}-brv">\n`;
            blines.forEach(l=>{
              out+=`    <div class="${px}-seg" data-opg="seg"><div class="${px}-segc">${esc(tx(l))}</div><div class="${px}-segh">${hint}</div></div>\n`;
            });
            out+=`  </div>\n`;
            /* 点击揭段：纯 DOM 无 API 依赖（同 egg/gacha 先例，内联于 body）；
               预览宏已替换、导出保留原样（tx 双轨），揭示交互两端一致 */
            out+=`  <script>
(function(){
  var root=document.currentScript.previousElementSibling;if(!root)return;
  Array.prototype.forEach.call(root.querySelectorAll('[data-opg="seg"]'),function(seg){
    seg.addEventListener('click',function(){seg.classList.add('on')});
  });
})();
  <\/script>\n`;
          }
          break;
        }
        /* decor：仅影响整体背景样式，在 css() 中处理 */
      }
      out+=`  </div>\n`;
    });
    return `  <div class="${px}-wrap">\n${out}  </div>\n`;
}

/* v1.9 新增区块的内联脚本注入辅助（与 scripts.js 的 jss 同款：JSON + < 转义防 </script> 逃逸） */
const jssx=v=>JSON.stringify(v).replace(/</g,'\\u003c');
