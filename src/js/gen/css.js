/* CSS 样式生成：根容器 + 各区块实例作用域样式（从 gen.js 拆分） */

export function css(p,px,blocks){
    const th=p.theme;
    const follow=th.followTavern;
    const cText=follow?`var(--SmartThemeBodyColor, ${th.textColor})`:th.textColor;
    /* fontName 是唯一未经 esc 直插 <style> 的用户字段（工程 JSON 可分享）：
       剔除引号/尖括号/反斜杠，防止 </style> 提前闭合注入任意 HTML */
    const fontSafe=String(th.fontName||'').replace(/[<>"\\]/g,'').trim();
    const font=`${fontSafe?`"${fontSafe}",`:''}"Segoe UI","Microsoft YaHei",sans-serif`;
    /* radius 来自可导入的工程数据：数值钳制，防 `12px;background:url(x)` 形态的 CSS 注入 */
    const radius=Math.max(0,Math.min(40,+th.radius||12));
    let s=`/* ${px} 组件样式（前缀隔离，勿改类名） */
.${px}-root{all:initial;font-family:${font};display:block}
.${px}-root *{box-sizing:border-box;font-family:inherit}
.${px}-wrap{max-width:640px;margin:0 auto;padding:18px;color:${cText};border-radius:${radius}px;overflow:hidden;position:relative}
`;
    /* 实例作用域层：display:contents 不影响布局，让同类区块多实例样式互不干扰 */
    blocks.forEach((b,i)=>{s+=`.${px}-bk${i}{display:contents}\n`});
    // 装饰区作为整体背景
    const d=blocks.find(b=>b.type==='decor');
    if(d&&d.enabled){
      let bg='';
      if(d.bgType==='solid')bg=d.bgColor;
      else if(d.bgType==='gradient')bg=`linear-gradient(160deg, ${d.bgColor}, ${d.bgColor2})`;
      /* 背景图 URL 与 fontName 同一信任面（工程 JSON 可分享）：剔除引号/尖括号/反斜杠/换行，防 </style> 提前闭合注入 */
      else if(d.bgType==='image')bg=`#0e0e14 url("${String(d.bgImage||'').replace(/[<>"\\]/g,'').replace(/[\r\n]/g,'')}") center/cover no-repeat`;
      else if(d.bgType==='noise')bg=`linear-gradient(160deg, ${d.bgColor}, ${d.bgColor2})`;
      s+=`.${px}-wrap{background:${bg}}\n`;
      if(d.bgType==='noise')s+=`.${px}-wrap::after{content:"";position:absolute;inset:0;opacity:.08;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");pointer-events:none;border-radius:inherit}\n`;
      if(d.borderStyle&&d.borderStyle!=='none'){
        const bw=(['groove','ridge','inset','outset'].includes(d.borderStyle))?'4px':'2px';
        s+=`.${px}-wrap{border:${bw} ${d.borderStyle} ${th.accent}}\n`;
      }
      const PATTERNS={stars:'✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧',lines:'⸻ ◆ ⸻',moons:'☽ ✦ ☾ ✦ ☽',petals:'❀ ❀ ❀ ❀ ❀',notes:'♪ ♫ ♪ ♫ ♪',hearts:'♡ ♥ ♡ ♥ ♡',waves:'〰 〰 〰 〰 〰',diamonds:'◇ ◆ ◇ ◆ ◇'};
      /* patternText 同 fontName 信任面：JSON.stringify 只转义引号不转义 <，须先剔除尖括号防 </style> 逃逸 */
      const patTxt=d.pattern==='custom'?String(d.patternText||'').replace(/[<>]/g,''):PATTERNS[d.pattern];
      if(patTxt)s+=`.${px}-wrap::before{content:${JSON.stringify(patTxt)};display:block;text-align:center;letter-spacing:6px;color:${th.accent};opacity:.65;font-size:11px;margin-bottom:10px}\n`;
    }else{
      s+=`.${px}-wrap{background:rgba(20,20,30,.85)}\n`;
    }

    /* 各区块实例样式（支持同类型多实例，按实例作用域隔离） */
    let lbCssDone=false;
    blocks.forEach((b,i)=>{
      const bk=`.${px}-bk${i}`;
      switch(b.type){
        case 'welcome':{
          const ds=b.decoStyle||'none';
          const mAuto=th.titleAlign==='center'?'margin:6px auto 10px;':'margin:6px 0 10px;';
          let deco='';
          if(ds==='underline')deco=`border-bottom:2px solid ${th.accent};width:fit-content;${mAuto}padding:0 18px 8px`;
          if(ds==='boxed')deco=`border:1px solid ${th.accent};width:fit-content;${mAuto}padding:6px 22px;border-radius:8px`;
          if(ds==='double')deco=`border-top:3px double ${th.accent};border-bottom:3px double ${th.accent};width:fit-content;${mAuto}padding:8px 26px`;
          if(ds==='stamp')deco=`border:2px dashed ${th.accent};width:fit-content;${mAuto}padding:8px 24px;transform:rotate(-3deg);color:${th.accent};letter-spacing:2px`;
          if(ds==='ribbon')deco=`background:linear-gradient(90deg,transparent,${th.accent}22,${th.accent}33,${th.accent}22,transparent);width:fit-content;${mAuto}padding:8px 36px;position:relative`;
          s+=`
${bk} .${px}-title{font-size:26px;font-weight:700;text-align:${th.titleAlign};color:${ds==='gradient'?'transparent':th.accent};${ds==='ornate'?`text-shadow:0 0 14px ${th.accent}66,0 0 30px ${th.accent}33;`:''}${ds==='glitch'?`text-shadow:2px 0 ${th.accent},-2px 0 #ff00cc;position:relative;`:''}${deco};margin-top:6px}
${bk} .${px}-title::before,${bk} .${px}-title::after{content:""}
${bk} .${px}-subtitle{font-size:14px;text-align:${th.titleAlign};opacity:.75;margin-bottom:14px}
`;
          if(ds==='gradient')s+=`
${bk} .${px}-title{background:linear-gradient(90deg,${th.accent},${th.primary});-webkit-background-clip:text;background-clip:text}
`;
          if(ds==='brackets')s+=`
${bk} .${px}-title::before{content:"『 ";opacity:.65}
${bk} .${px}-title::after{content:" 』";opacity:.65}
`;
          if(ds==='ribbon')s+=`
${bk} .${px}-title::before,${bk} .${px}-title::after{content:"";position:absolute;top:50%;border:12px solid transparent;border-top:12px solid ${th.accent}33;transform:translateY(-50%)}
${bk} .${px}-title::before{left:-24px;border-right:12px solid ${th.accent}33}
${bk} .${px}-title::after{right:-24px;border-left:12px solid ${th.accent}33}
`;
          break;
        }
        case 'profile':
          s+=`
${bk} .${px}-profile{display:flex;gap:14px;align-items:flex-start;background:rgba(255,255,255,.06);border:1px solid ${th.primary}66;border-radius:px;padding:14px;margin:12px 0}
${bk} .${px}-avatar{width:${b.avatarRound?'84px':'100px'};height:${b.avatarRound?'84px':'120px'};object-fit:cover;border-radius:${b.avatarRound?'50%':'8px'};border:2px solid ${th.accent};flex-shrink:0}
${bk} .${px}-pname{font-size:18px;font-weight:700;color:${th.accent};margin-bottom:6px}
${bk} .${px}-pdesc{font-size:13px;line-height:1.7;opacity:.9;white-space:pre-wrap}
${bk} .${px}-ptags{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
${bk} .${px}-ptag{font-size:11px;padding:2px 10px;border:1px solid ${th.primary};border-radius:20px;color:${th.primary};opacity:.9}
`;
          /* 角色 >2 个：折叠为名字列表，点击名字展开完整卡片 */
          s+=`
${bk} .${px}-profc{background:rgba(255,255,255,.06);border:1px solid ${th.primary}66;border-radius:px;padding:12px 14px;margin:12px 0}
${bk} .${px}-phead{cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:8px}
${bk} .${px}-phead::-webkit-details-marker{display:none}
${bk} .${px}-phead:hover{opacity:.85}
${bk} .${px}-phead .${px}-pname{margin-bottom:0;font-size:16px}
${bk} .${px}-parrow{transition:transform .25s ease;font-size:12px;opacity:.6;flex-shrink:0}
${bk} .${px}-profc[open] .${px}-parrow{transform:rotate(90deg);opacity:1}
${bk} .${px}-profc[open] .${px}-phead{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}
${bk} .${px}-pbody{display:flex;gap:14px;align-items:flex-start}
`;
          break;
        case 'disclaimer':
          s+=`
${bk} .${px}-disc{margin-top:14px;font-size:11px;opacity:.55;line-height:1.6}
${bk} .${px}-disc summary{cursor:pointer;user-select:none}
`;
          break;
        case 'greetings':
          s+=`
${bk} .${px}-glist{margin:12px 0;display:flex;flex-direction:column;gap:${b.cardStyle==='list'?'2px':'8px'}}
${bk} .${px}-gitem{background:rgba(255,255,255,.07);border:1px solid ${th.primary}55;border-radius:8px;padding:10px 14px;cursor:pointer;transition:all .15s;font-size:13px;line-height:1.5;color:inherit;text-align:left;width:100%}
${bk} .${px}-gitem:hover{border-color:${th.accent};background:rgba(255,255,255,.13);transform:translateX(3px)}
${bk} .${px}-gcur{border-color:${th.accent}!important;color:${th.accent}}
${bk} .${px}-gtitle{display:block;font-weight:600}
${bk} .${px}-gdesc{display:block;font-size:11px;opacity:.7;margin-top:2px;line-height:1.4;font-weight:400}
${bk} .${px}-gsend{margin-top:10px;width:100%;padding:10px;border:none;border-radius:8px;background:${th.primary};color:#fff;font-size:14px;cursor:pointer}
${bk} .${px}-gsend:hover{filter:brightness(1.15)}
`;
          if(b.cardStyle==='list')s+=`
${bk} .${px}-gitem{background:transparent;border:none;border-left:3px solid ${th.primary}66;border-radius:0;padding:7px 12px}
${bk} .${px}-gitem:hover{background:transparent;border-left-color:${th.accent};transform:none;color:${th.accent}}
`;
          break;
        case 'freehtml':
          s+=`${bk} .${px}-free{margin:12px 0}\n`;
          break;
        case 'quote':
          s+=`
${bk} .${px}-quote{text-align:center;margin:12px 0;padding:0 18px;font-style:italic;font-size:13px;line-height:1.9;opacity:.9}
${bk} .${px}-quote::before{content:"❝ ";opacity:.5}
${bk} .${px}-quote::after{content:" ❞";opacity:.5}
`;
          s+=`${bk} .${px}-qsrc{display:block;margin-top:4px;font-size:11px;opacity:.6;font-style:normal}
`;
          break;
        case 'gallery':{
          const cols=['2','3','4'].includes(String(b.cols))?b.cols:'3';
          s+=`
${bk} .${px}-gal{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;margin:12px 0}
${bk} .${px}-gal figure{margin:0;background:rgba(255,255,255,.05);border:1px solid ${th.primary}44;border-radius:8px;overflow:hidden}
${bk} .${px}-gal img{width:100%;height:110px;object-fit:cover;display:block;cursor:zoom-in;transition:transform .15s}
${bk} .${px}-gal img:hover{transform:scale(1.04)}
${bk} .${px}-gal figcaption{font-size:11px;padding:4px 8px;opacity:.75;text-align:center}
`;
          /* 灯箱样式全页只需一份 */
          if(!lbCssDone){
            lbCssDone=true;
            s+=`
.${px}-lb{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:2147483647;cursor:zoom-out;padding:20px}
.${px}-lb.on{display:flex}
.${px}-lb img{max-width:94vw;max-height:84vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
.${px}-lbcap{color:#fff;font-size:13px;opacity:.85;text-align:center;max-width:90vw;line-height:1.6}
`;
          }
          break;
        }
        case 'author':
          s+=`
${bk} .${px}-auth{margin-top:14px;font-size:12px;opacity:.8;line-height:1.7}
${bk} .${px}-auth summary{cursor:pointer;user-select:none}
`;
          break;
        case 'clockbar':{
          const cc=b.color||'#87CEEB',cs=Math.max(10,Math.min(28,+b.size||15));
          s+=`
${bk} .${px}-clock{text-align:${b.align||'center'};color:${cc};font-size:${cs}px;letter-spacing:1px;margin:12px 0;line-height:1.6;${b.glow?`text-shadow:0 0 10px ${cc}66,0 0 24px ${cc}33;`:''}}
`;
          break;
        }
        case 'randomevent':
          s+=`
${bk} .${px}-revt{font-size:13px;font-weight:600;color:${th.accent};margin:14px 0 6px;text-align:center;letter-spacing:3px}
${bk} .${px}-rbox{margin:8px 0;padding:12px 16px;background:rgba(255,255,255,.05);border:1px dashed ${th.primary}66;border-radius:10px;font-size:13px;line-height:1.9;opacity:.96}
${bk} .${px}-rline{white-space:pre-wrap}
`;
          break;
        case 'dice':
          if(b.style==='plain'){
            s+=`
${bk} .${px}-dice{display:inline-flex;align-items:center;gap:8px;margin:12px 0;padding:6px 14px;background:rgba(255,255,255,.06);border:1px solid ${th.primary}55;border-radius:20px;font-size:13px}
${bk} .${px}-dval{font-weight:700;color:${th.accent}}
`;
          }else if(b.style==='poker'){
            s+=`
${bk} .${px}-dice{display:inline-flex;flex-direction:column;align-items:center;margin:12px 0;padding:16px 24px;background:rgba(255,255,255,.08);border:2px solid ${th.accent}88;border-radius:12px;font-size:13px;min-width:80px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
${bk} .${px}-dlabel{font-size:11px;opacity:.7;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
${bk} .${px}-dval{font-size:32px;font-weight:700;font-variant-numeric:tabular-nums;color:${th.textColor};text-shadow:0 0 12px ${th.accent}55}
`;
          }else if(b.style==='rpg'){
            s+=`
${bk} .${px}-dice{display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px 16px;background:linear-gradient(135deg,rgba(0,0,0,.4),rgba(0,0,0,.2));border:1px solid ${th.accent}44;border-radius:10px;font-size:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 8px rgba(0,0,0,.3)}
${bk} .${px}-dlabel{font-weight:600;color:${th.accent}}
${bk} .${px}-dval{margin-left:auto;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;min-width:2ch;text-align:right;color:${th.textColor};text-shadow:0 0 10px ${th.accent}66;background:rgba(0,0,0,.3);padding:4px 12px;border-radius:6px;border:1px solid ${th.accent}33}
`;
          }else{
            s+=`
${bk} .${px}-dice{display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px 16px;background:rgba(0,0,0,.25);border:1px solid ${th.primary}55;border-radius:12px;font-size:13px}
${bk} .${px}-dlabel{font-weight:600;color:${th.accent}}
${bk} .${px}-dval{margin-left:auto;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;min-width:2ch;text-align:right;color:${th.textColor};text-shadow:0 0 12px ${th.accent}55}
`;
          }
          break;
        case 'divider':
          if(b.style==='gradient-thick'){
            s+=`
${bk} .${px}-hr{margin:16px 0;height:3px;background:linear-gradient(90deg,transparent,${th.accent},${th.primary},transparent);border-radius:2px}
`;
          }else if(b.style==='wave'){
            s+=`
${bk} .${px}-hr{display:flex;align-items:center;gap:0;margin:16px 0;opacity:.75;font-size:14px;letter-spacing:2px;color:${th.accent}}
${bk} .${px}-hr::before,${bk} .${px}-hr::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,${th.accent}88,transparent)}
${bk} .${px}-hr span{padding:0 8px}
`;
          }else{
            s+=`
${bk} .${px}-hr{display:flex;align-items:center;gap:12px;margin:16px 0;color:${th.accent};opacity:.75;font-size:12px;letter-spacing:4px}
${bk} .${px}-hr::before,${bk} .${px}-hr::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,${th.accent},transparent)}
`;
          }
          break;
        case 'countdown':
          s+=`
${bk} .${px}-cd{margin:12px 0;padding:14px 18px;background:rgba(0,0,0,.25);border:1px solid ${th.accent}55;border-radius:12px;text-align:center}
${bk} .${px}-cd-title{font-size:13px;color:${th.accent};letter-spacing:2px;margin-bottom:6px}
${bk} .${px}-cd-val{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:${th.textColor};text-shadow:0 0 12px ${th.accent}55}
${bk} .${px}-cd-done .${px}-cd-val{color:${th.accent}}
`;
          break;
        case 'timeline':
          s+=`
@keyframes ${px}-tl-pulse{0%,100%{box-shadow:0 0 4px ${th.accent}}50%{box-shadow:0 0 14px ${th.accent}}}
${bk} .${px}-tl-title{font-size:15px;font-weight:600;color:${th.accent};text-align:center;letter-spacing:2px;margin:12px 0 4px}
${bk} .${px}-tl-node{position:relative;display:flex;gap:12px;padding:0 0 16px 24px}
${bk} .${px}-tl-node:last-child{padding-bottom:2px}
${bk} .${px}-tl-node::before{content:"";position:absolute;left:5px;top:14px;bottom:-2px;width:2px;background:${th.primary}44}
${bk} .${px}-tl-node:last-child::before{display:none}
${bk} .${px}-tl-dot{position:absolute;left:0;top:4px;width:12px;height:12px;border-radius:50%;border:2px solid ${th.primary};background:rgba(255,255,255,.1)}
${bk} .${px}-tl-done .${px}-tl-dot{background:${th.accent};border-color:${th.accent}}
${bk} .${px}-tl-current .${px}-tl-dot{border-color:${th.accent};animation:${px}-tl-pulse 1.5s ease-in-out infinite}
${bk} .${px}-tl-lock{opacity:.45}
${bk} .${px}-tl-name{font-size:14px;font-weight:600;color:${th.textColor}}
${bk} .${px}-tl-done .${px}-tl-name{color:${th.accent}}
${bk} .${px}-tl-desc{font-size:12px;opacity:.85;line-height:1.6;margin-top:2px;white-space:pre-wrap}
`;
          break;
        case 'bgm':
          s+=`
${bk} .${px}-bgm{margin:12px 0}
${bk} .${px}-bgm-title{font-size:13px;font-weight:600;color:${th.accent};margin-bottom:8px;letter-spacing:1px}
${bk} .${px}-bgm-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid ${th.primary}44;border-radius:10px;font-size:12px}
${bk} .${px}-bgm-btn{background:none;border:none;color:inherit;font-size:16px;cursor:pointer;padding:4px;line-height:1}
${bk} .${px}-bgm-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.9;min-width:0}
${bk} .${px}-bgm-prog{-webkit-appearance:none;appearance:none;flex:2;height:4px;border-radius:2px;background:rgba(255,255,255,.15);outline:none;cursor:pointer}
${bk} .${px}-bgm-prog::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:${th.accent};cursor:pointer}
${bk} .${px}-bgm-time{font-size:11px;opacity:.5;min-width:32px;text-align:center;font-variant-numeric:tabular-nums}
${bk} .${px}-bgm-vol{-webkit-appearance:none;appearance:none;width:60px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);outline:none;cursor:pointer}
${bk} .${px}-bgm-vol::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.6);cursor:pointer}
${bk} .${px}-bgm-loop{opacity:.5}
${bk} .${px}-bgm-loop.on{opacity:1;color:${th.accent}}
`;
          break;
        case 'fx':{
          const fxAnims={
            /* 透明度关键帧统一乘 var(--op,1)（粒子内联设置），否则动画会覆盖内联 opacity，滑杆失效 */
            meteor:`@keyframes ${px}-fx-meteor{0%{transform:translate(0,0) rotate(215deg);opacity:calc(1*var(--op,1))}70%{opacity:calc(1*var(--op,1))}100%{transform:translate(-300px,300px) rotate(215deg);opacity:0}}`,
            bubble:`@keyframes ${px}-fx-bubble{0%{transform:translateY(0) scale(1);opacity:calc(.7*var(--op,1))}100%{transform:translateY(-100vh) scale(.4);opacity:0}}`,
            note:`@keyframes ${px}-fx-note{0%{transform:translateY(0) rotate(0deg);opacity:calc(.8*var(--op,1))}50%{transform:translateY(-40px) rotate(15deg);opacity:calc(.6*var(--op,1))}100%{transform:translateY(-80px) rotate(-10deg);opacity:0}}`,
            ember:`@keyframes ${px}-fx-ember{0%{transform:translateY(0) scale(1);opacity:calc(1*var(--op,1))}100%{transform:translateY(-100px) scale(.3);opacity:0}}`,
            fog:`@keyframes ${px}-fx-fog{0%{transform:translateX(-20%);opacity:0}20%{opacity:calc(.5*var(--op,1))}80%{opacity:calc(.5*var(--op,1))}100%{transform:translateX(120%);opacity:0}}`,
            snow:`@keyframes ${px}-fx-snow{0%{transform:translateY(-10px) rotate(0deg);opacity:calc(1*var(--op,1))}100%{transform:translateY(100vh) rotate(360deg);opacity:0}}`,
            firefly:`@keyframes ${px}-fx-firefly{0%,100%{opacity:0;transform:translate(0,0)}50%{opacity:calc(1*var(--op,1));transform:translate(var(--dx),var(--dy))}}`,
            petal:`@keyframes ${px}-fx-petal{0%{transform:translateY(-10px) rotate(0deg);opacity:calc(.9*var(--op,1))}100%{transform:translateY(100vh) rotate(540deg);opacity:0}}`,
            star:`@keyframes ${px}-fx-star{0%,100%{opacity:calc(.2*var(--op,1));transform:scale(.8)}50%{opacity:calc(1*var(--op,1));transform:scale(1.2)}}`,
            rain:`@keyframes ${px}-fx-rain{0%{transform:translateY(-10px);opacity:calc(.8*var(--op,1))}100%{transform:translateY(100vh);opacity:0}}`,
          };
          const fxStyles={
            meteor:`width:2px;height:20px;background:linear-gradient(to bottom,${th.accent},transparent);border-radius:1px;animation:${px}-fx-meteor linear infinite`,
            bubble:`width:var(--s);height:var(--s);border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.08);animation:${px}-fx-bubble linear infinite`,
            note:`font-size:var(--s);animation:${px}-fx-note ease-in-out infinite;color:${th.accent}`,
            ember:`width:var(--s);height:var(--s);border-radius:50%;background:${th.accent};animation:${px}-fx-ember ease-out infinite`,
            fog:`width:200px;height:60px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.06),transparent);animation:${px}-fx-fog linear infinite`,
            snow:`width:var(--s);height:var(--s);border-radius:50%;background:rgba(255,255,255,.8);animation:${px}-fx-snow linear infinite`,
            firefly:`width:var(--s);height:var(--s);border-radius:50%;background:${th.accent};box-shadow:0 0 6px ${th.accent};animation:${px}-fx-firefly ease-in-out infinite`,
            petal:`width:var(--s);height:calc(var(--s)*.6);border-radius:50% 0 50% 0;background:rgba(255,180,200,.6);animation:${px}-fx-petal linear infinite`,
            star:`width:var(--s);height:var(--s);border-radius:50%;background:${th.accent};box-shadow:0 0 4px ${th.accent};animation:${px}-fx-star ease-in-out infinite`,
            rain:`width:1px;height:var(--s);background:linear-gradient(to bottom,rgba(255,255,255,.4),transparent);animation:${px}-fx-rain linear infinite`,
          };
          const key=fxAnims[b.effect]||fxAnims.meteor;
          const sty=fxStyles[b.effect]||fxStyles.meteor;
          s+=`
${key}
${bk} .${px}-fx{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
${bk} .${px}-fx-p{position:absolute;${sty}}
@media(prefers-reduced-motion:reduce){${bk} .${px}-fx-p{animation:none!important;opacity:.15}}
`;
          break;
        }
        case 'qa':
          s+=`
${bk} .${px}-qa-wrap{margin:0}
${bk} .${px}-qa-title{cursor:pointer;user-select:none;font-size:15px;font-weight:600;color:${th.accent};letter-spacing:2px;text-align:center;padding:8px 0;list-style:none;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
${bk} .${px}-qa-title::-webkit-details-marker{display:none}
${bk} .${px}-qa-title:hover{opacity:.8}
${bk} .${px}-qa-tarrow{transition:transform .25s ease;font-size:12px;opacity:.6}
${bk} .${px}-qa-wrap[open] .${px}-qa-tarrow{transform:rotate(90deg);opacity:1}
${bk} .${px}-qa-body{overflow:hidden;max-height:0;transition:max-height .3s ease,padding .2s;padding:0}
${bk} .${px}-qa-wrap[open] .${px}-qa-body{max-height:2000px;padding:0}
${bk} .${px}-qa-group{margin:6px 0}
${bk} .${px}-qa-ghdr{font-size:12px;font-weight:600;color:${th.accent};padding:6px 0;letter-spacing:1px;opacity:.85;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:4px}
${bk} .${px}-qa-item{margin:4px 0;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.08);transition:border-color .2s}
${bk} .${px}-qa-item[open]{border-color:${th.accent}}
${bk} .${px}-qa-q{cursor:pointer;user-select:none;padding:10px 14px;display:flex;align-items:center;gap:8px;font-weight:600;transition:background .15s;list-style:none}
${bk} .${px}-qa-q::-webkit-details-marker{display:none}
${bk} .${px}-qa-q:hover{background:rgba(255,255,255,.04)}
${bk} .${px}-qa-arrow{transition:transform .25s ease;font-size:11px;opacity:.5;flex-shrink:0}
${bk} .${px}-qa-item[open] .${px}-qa-arrow{transform:rotate(90deg);opacity:1}
${bk} .${px}-qa-a{overflow:hidden;max-height:0;transition:max-height .3s ease,padding .2s;padding:0 14px;font-size:12px;line-height:1.9;opacity:.85}
${bk} .${px}-qa-item[open] .${px}-qa-a{max-height:2000px;padding:0 14px 12px}
`;
          break;
      }
    });
    return s;
}
