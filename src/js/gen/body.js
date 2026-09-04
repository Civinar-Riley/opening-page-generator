/* HTML 结构生成：按区块顺序逐块渲染（从 gen.js 拆分） */
import { esc } from '../utils.js';
import { Macros } from '../macros.js';

export function body(p,px,blocks,isPreview){
    const g=i=>Macros.apply(i,p.macros); // 预览时替换宏
    const raw=i=>String(i??'');           // 导出时保留宏
    const tx=isPreview?g:raw;
    let out='',lbOut=false;               // lbOut：灯箱层全页仅输出一份
    /* 按用户配置的顺序逐块渲染（↑↓/拖拽排序真实生效）；
       每块包一层实例作用域 div（display:contents），支持同类型多实例 */
    blocks.forEach((b,i)=>{
      out+=`  <div class="${px}-bk${i}">\n`;
      switch(b.type){
        case 'welcome':
          out+=`  <h1 class="${px}-title">${esc(tx(b.title))}</h1>\n  <div class="${px}-subtitle">${esc(tx(b.subtitle))}</div>\n`;
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
          chars.forEach(ch=>{
            const nameRaw=tx(ch.name||'');
            if(many){
              let body='';
              if(b.showAvatar&&ch.avatar)body+=`      <img class="${px}-avatar" src="${esc(tx(ch.avatar))}" alt="avatar" onerror="this.style.display='none'">\n`;
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
            if(b.showAvatar&&ch.avatar)inner+=`    <img class="${px}-avatar" src="${esc(tx(ch.avatar))}" alt="avatar" onerror="this.style.display='none'">\n`;
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
          out+=`  <div class="${px}-glist" data-opg="glist">\n`;
          const items=tx(b.placeholderList).split('\n').map(s=>s.trim()).filter(Boolean);
          items.forEach((it,i)=>{
            const sep=it.includes('｜')?'｜':(it.includes('|')?'|':null);
            const title=sep?it.split(sep)[0].trim():it;
            const desc=sep?it.split(sep).slice(1).join(sep).trim():'';
            out+=`    <button type="button" class="${px}-gitem" data-opg="g" data-i="${i}"><span class="${px}-gtitle">${esc(title)}</span>${desc?`<span class="${px}-gdesc">${esc(desc)}</span>`:''}</button>\n`;
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
        /* decor：仅影响整体背景样式，在 css() 中处理 */
      }
      out+=`  </div>\n`;
    });
    return `  <div class="${px}-wrap">\n${out}  </div>\n`;
}
