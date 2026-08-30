/* HTML 结构生成：按区块顺序逐块渲染（从 gen.js 拆分） */
import { esc } from '../utils.js';
import { Macros } from '../macros.js';

export function body(p,px,blocks,isPreview){
    const g=i=>Macros.apply(i,p.macros); // 预览时替换宏
    const raw=i=>String(i??'');           // 导出时保留宏
    const tx=isPreview?g:raw;
    let out='';
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
            const nameRaw=isPreview?tx(ch.name||''):ch.name||'';
            if(many){
              let body='';
              if(b.showAvatar&&ch.avatar)body+=`      <img class="${px}-avatar" src="${esc(isPreview?tx(ch.avatar):ch.avatar)}" alt="avatar" onerror="this.style.display='none'">\n`;
              let sub='';
              if(b.showDesc&&ch.desc)sub+=`        <div class="${px}-pdesc">${esc(isPreview?tx(ch.desc):ch.desc)}</div>\n`;
              if(b.showTags&&ch.tags){
                const tags=(isPreview?tx(ch.tags):ch.tags).split(/[,，]/).map(s=>s.trim()).filter(Boolean);
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
            if(b.showAvatar&&ch.avatar)inner+=`    <img class="${px}-avatar" src="${esc(isPreview?tx(ch.avatar):ch.avatar)}" alt="avatar" onerror="this.style.display='none'">\n`;
            inner+=`    <div>\n`;
            if(b.showName&&ch.name)inner+=`      <div class="${px}-pname">${esc(isPreview?tx(ch.name):ch.name)}</div>\n`;
            if(b.showDesc&&ch.desc)inner+=`      <div class="${px}-pdesc">${esc(isPreview?tx(ch.desc):ch.desc)}</div>\n`;
            if(b.showTags&&ch.tags){
              const tags=(isPreview?tx(ch.tags):ch.tags).split(/[,，]/).map(s=>s.trim()).filter(Boolean);
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
              out+=`    <figure><img data-opg="gimg" src="${esc(isPreview?tx(im.url):im.url)}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'">${im.cap?`<figcaption>${esc(isPreview?tx(im.cap):im.cap)}</figcaption>`:''}</figure>\n`;
            });
            out+=`  </div>\n`;
            out+=`  <div class="${px}-lb" data-opg="lb"><img alt=""><span class="${px}-lbcap"></span></div>\n`;
          }
          break;
        }
        case 'greetings':{
          out+=`  <div class="${px}-glist" data-opg="glist">\n`;
          const items=(isPreview?tx(b.placeholderList):b.placeholderList).split('\n').map(s=>s.trim()).filter(Boolean);
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
          out+=`  <div class="${px}-free">\n${isPreview?tx(b.html):b.html}\n  </div>\n`;
          break;
        case 'clockbar':
          /* 内容不转义：允许 <i> FA 图标等内联 HTML；预览替换宏，导出保留原样 */
          out+=`  <div class="${px}-clock">${isPreview?tx(b.text):b.text}</div>\n`;
          break;
        case 'randomevent':{
          const rawLines=String(b.lines??'').split('\n').map(x=>x.trim()).filter(Boolean);
          if(b.showTitle)out+=`  <div class="${px}-revt">${esc(isPreview?tx(b.title):b.title)}</div>\n`;
          if(rawLines.length){
            let inner;
            if(b.pickMode==='one'){
              /* 导出：整组包成 {{random::…}}，酒馆每次渲染随机一条；
                 预览：宏引擎不支持嵌套，直接随机选一行模拟效果 */
              inner=isPreview
                ?esc(tx(rawLines[Math.floor(Math.random()*rawLines.length)]||''))
                :'{{random::'+rawLines.map(l=>l.replace(/::/g,'⦂')).join('::')+'}}';
              out+=`  <div class="${px}-rbox"><div class="${px}-rline">${inner}</div></div>\n`;
            }else if(b.pickMode==='shuffle'){
              /* shuffle：显示所有行，但每次顺序随机打乱 */
              const shuffled=isPreview
                ?[...rawLines].sort(()=>Math.random()-0.5)
                :rawLines;
              const rows=(isPreview?tx(shuffled.join('\n')):shuffled.join('\n'))
                .split('\n').map(l=>`    <div class="${px}-rline">${isPreview?esc(l):l}</div>`).join('\n');
              out+=`  <div class="${px}-rbox">\n${rows}\n  </div>\n`;
            }else{
              const rows=(isPreview?tx(rawLines.join('\n')):rawLines.join('\n'))
                .split('\n').map(l=>`    <div class="${px}-rline">${isPreview?esc(l):l}</div>`).join('\n');
              out+=`  <div class="${px}-rbox">\n${rows}\n  </div>\n`;
            }
          }
          break;
        }
        case 'dice':{
          const expr=b.expr||'1d20';
          const val=isPreview?Macros.apply('{{roll::'+expr+'}}',p.macros):'{{roll::'+expr+'}}';
          out+=`  <span class="${px}-dice"><span class="${px}-dlabel">🎲 ${isPreview?tx(b.label):b.label}</span><span class="${px}-dval">${esc(val)}</span></span>\n`;
          break;
        }
        case 'bgm':{
          const tracks=Array.isArray(b.tracks)?b.tracks.filter(t=>t.url):[];
          if(tracks.length){
            const vol=Math.max(0,Math.min(100,+b.volume||50));
            const loopAttr=b.loop?' loop':'';
            const titleHtml=b.showTitle?`<div class="${px}-bgm-title">${esc(isPreview?tx(b.title):b.title)}</div>`:'';
            const dataCmds=b.useTavernCmd?` data-cmds="1"`:'';
            out+=`  <div class="${px}-bgm"${dataCmds}>\n${titleHtml}    <div class="${px}-bgm-bar">\n      <button type="button" class="${px}-bgm-btn ${px}-bgm-play" data-opg="bgm-play">▶</button>\n      <span class="${px}-bgm-name">${esc(isPreview?tx(tracks[0]?.name||''):tracks[0]?.name||'')}</span>\n      <input type="range" class="${px}-bgm-prog" min="0" max="100" value="0">\n      <span class="${px}-bgm-time">0:00</span>\n      <input type="range" class="${px}-bgm-vol" min="0" max="100" value="${vol}">\n      <button type="button" class="${px}-bgm-btn ${px}-bgm-loop${b.loop?' on':''}" data-opg="bgm-loop">🔁</button>\n    </div>\n  </div>\n  <audio class="${px}-bgm-audio" preload="auto"${loopAttr}>\n${tracks.map(t=>`    <source data-name="${esc(isPreview?tx(t.name):t.name)}" src="${esc(isPreview?tx(t.url):t.url)}">`).join('\n')}\n  </audio>\n`;
          }
          break;
        }
        case 'fx':{
          const count=Math.max(1,Math.min(100,+b.count||30));
          const spd=Math.max(.2,Math.min(3,+b.speed||1));
          const op=Math.max(.1,Math.min(1,+b.opacity||.8));
          const effect=b.effect||'meteor';
          const notes=['♪','♫','♩','♬'];
          const notesStr=notes.join('');
          out+=`  <div class="${px}-fx" data-fx="${esc(effect)}" data-count="${count}" data-speed="${spd}" data-opacity="${op}" data-notes="${notesStr}"></div>\n`;
          out+=`  <script>\n(function(){var c=document.currentScript.previousElementSibling;if(!c)return;var type=c.dataset.fx,n=+c.dataset.count||30,spd=+c.dataset.speed||1,op=+c.dataset.opacity||.8,notes=(c.dataset.notes||'♪♫♩♬').split('');var ns=['meteor','snow','rain'];for(var i=0;i<n;i++){var p=document.createElement('div');p.className='${px}-fx-p';var dur=(2+Math.random()*4)/spd;if(ns.indexOf(type)>=0)p.style.animationDuration=dur+'s';else p.style.animationDuration=(1.5+Math.random()*3)/spd+'s';p.style.animationDelay=(-Math.random()*dur)+'s';p.style.opacity=op;p.style.setProperty('--op',op);if(type==='note'){p.textContent=notes[Math.floor(Math.random()*notes.length)];}else if(type==='meteor'){var s=12+Math.random()*20;p.style.width='2px';p.style.height=s+'px';}else{var sz=type==='fog'?1:(type==='note'?12+Math.random()*10:(2+Math.random()*5));p.style.setProperty('--s',sz+'px');if(type==='firefly'){p.style.setProperty('--dx',(Math.random()*60-30)+'px');p.style.setProperty('--dy',(Math.random()*60-30)+'px');}else if(type==='ember'){p.style.background='#'+(Math.floor(Math.random()*3)+6)+''+(Math.floor(Math.random()*6))+'0';}}var r=Math.random()*100,pct=Math.random()*100;if(ns.indexOf(type)>=0){p.style.left=pct+'%';p.style.top='-20px';}else if(type==='fog'){p.style.top=(20+Math.random()*60)+'%';p.style.left='-200px';}else{p.style.left=pct+'%';p.style.top=r+'%';}c.appendChild(p);}})();\n  </script>\n`;
          break;
        }
        case 'qa':{
          const groups=Array.isArray(b.groups)?b.groups:[];
          /* showTitle=false 时不显示标题文字（仅保留折叠箭头），标题为空时回退「常见问题」 */
          const titleTxt=!b.showTitle?'':esc(isPreview?tx(b.title||'常见问题'):b.title||'常见问题');
          out+=`  <details class="${px}-qa-wrap">\n`;
          out+=`    <summary class="${px}-qa-title"><span class="${px}-qa-tarrow">▸</span>${titleTxt}</summary>\n`;
          out+=`    <div class="${px}-qa-body">\n`;
          groups.forEach(grp=>{
            if(grp.name)out+=`    <div class="${px}-qa-group"><div class="${px}-qa-ghdr">${esc(isPreview?tx(grp.name):grp.name)}</div>\n`;
            (Array.isArray(grp.items)?grp.items:[]).forEach(item=>{
              out+=`    <details class="${px}-qa-item"><summary class="${px}-qa-q"><span class="${px}-qa-arrow">▸</span>${esc(isPreview?tx(item.q):item.q)}</summary><div class="${px}-qa-a">${esc(isPreview?tx(item.a):item.a)}</div></details>\n`;
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
