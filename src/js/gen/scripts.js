/* 运行时脚本：灯箱 / BGM 播放器 / 酒馆助手 API 交互（从 gen.js 拆分） */

/* JSON.stringify 不转义 <：值含 </script> 会提前闭合外层脚本标签（产物不经 build.js
   bundle 转义）。统一补 \u003c 转义（与 build.js 内嵌游戏数据同一惯例） */
const jss=v=>JSON.stringify(v).replace(/</g,'\\u003c');

export function lightbox(px){
    return `<script>
(function(){
  var PX=${jss(px)};
  var root=document.getElementById(PX);
  if(!root)return;
  var lb=root.querySelector('[data-opg="lb"]');
  if(!lb)return;
  var limg=lb.querySelector('img');
  var lcap=lb.getElementsByClassName(PX+'-lbcap')[0];
  root.addEventListener('click',function(ev){
    var im=ev.target.closest('[data-opg="gimg"]');
    if(im){
      limg.src=im.getAttribute('src');
      var fig=im.parentNode,fc=fig?fig.querySelector('figcaption'):null;
      lcap.textContent=fc?fc.textContent:'';
      lb.classList.add('on');
      return;
    }
    if(ev.target.closest('[data-opg="lb"]')){lb.classList.remove('on');limg.src='';}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('on')){lb.classList.remove('on');limg.src='';}});
})();
<\/script>`;
}

export function comicReader(px){
    /* 漫画阅读器：纯 DOM 无 API 依赖，全页注入一份靠守卫空转。
       打开热区 data-comic="bkN" 与覆盖层配对（多实例互不串扰）；
       cur 记录当前打开实例，天然互斥；翻页状态存楼内内存，楼层重建自动复位 */
    return `<script>
(function(){
  var PX=${jss(px)};
  var root=document.getElementById(PX);
  if(!root)return;
  var cur=null,curIdx=0;
  var rbodyOf=function(rd){var b=rd.getElementsByClassName(PX+'-rbody')[0];return b};
  var pagedOf=function(rd){var b=rbodyOf(rd);return !!(b&&b.classList.contains('paged'))};
  function show(rd,i){
    var pgs=rd.querySelectorAll('[data-opg="comic-page"]'),n=pgs.length;
    if(!n)return;
    if(i<0)i=0;if(i>n-1)i=n-1;
    curIdx=i;
    var paged=pagedOf(rd);
    if(paged){
      for(var k=0;k<n;k++)pgs[k].classList.toggle('onp',k===i);
      var pv=rd.querySelector('[data-opg="comic-prev"]'),nx=rd.querySelector('[data-opg="comic-next"]');
      if(pv)pv.disabled=i<=0;
      if(nx)nx.disabled=i>=n-1;
    }
    var info=rd.querySelector('[data-opg="comic-pageinfo"]');
    if(info)info.textContent=paged?(i+1)+' / '+n:('共 '+n+' 页');
  }
  function openRd(rd){
    if(cur)closeRd();
    cur=rd;rd.classList.add('on');rd.setAttribute('aria-hidden','false');
    show(rd,0);
  }
  function closeRd(){
    if(!cur)return;
    cur.classList.remove('on');cur.setAttribute('aria-hidden','true');
    cur=null;
  }
  root.addEventListener('click',function(ev){
    var op=ev.target.closest('[data-opg="comic-open"]');
    if(op){
      var rd=root.querySelector('[data-opg="comic-reader"][data-comic="'+op.getAttribute('data-comic')+'"]');
      if(rd)openRd(rd);
      return;
    }
    if(!cur)return;
    if(ev.target.closest('[data-opg="comic-close"]')){closeRd();return}
    if(ev.target.closest('[data-opg="comic-prev"]')){show(cur,curIdx-1);return}
    if(ev.target.closest('[data-opg="comic-next"]')){show(cur,curIdx+1);return}
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target&&e.target.closest){
      var f=e.target.closest('[data-opg="comic-open"]');
      if(f){
        var rd=root.querySelector('[data-opg="comic-reader"][data-comic="'+f.getAttribute('data-comic')+'"]');
        if(rd)openRd(rd);
        return;
      }
    }
    if(!cur)return;
    if(e.key==='Escape'){closeRd();return}
    if(pagedOf(cur)){
      if(e.key==='ArrowLeft')show(cur,curIdx-1);
      else if(e.key==='ArrowRight')show(cur,curIdx+1);
    }
  });
})();
<\/script>`;
}

export function bgmScript(px){
    return `<script>
(function(){
  var PX=${jss(px)};
  var root=document.getElementById(PX);
  if(!root)return;
  /* 酒馆助手音频播放器（≥4.0.0，接续播放修复需 ≥4.3.5）：双通道绑定聊天文件，
     切楼不重播、刷新不丢；可用时优先走 API，缺失时降级为本地 <audio>（多楼会各自播放） */
  var hasFn=function(n){return typeof window[n]==='function'};
  var TA=hasFn('playAudio')&&hasFn('pauseAudio');
  var audios=root.querySelectorAll('.'+PX+'-bgm-audio');
  audios.forEach(function(audio){
    var wrap=audio.previousElementSibling;
    if(!wrap)return;
    var playBtn=wrap.querySelector('.'+PX+'-bgm-play');
    var nameEl=wrap.querySelector('.'+PX+'-bgm-name');
    var progBar=wrap.querySelector('.'+PX+'-bgm-prog');
    var timeEl=wrap.querySelector('.'+PX+'-bgm-time');
    var volBar=wrap.querySelector('.'+PX+'-bgm-vol');
    var loopBtn=wrap.querySelector('.'+PX+'-bgm-loop');
    var sources=audio.querySelectorAll('source');
    var idx=0;
    var playing=false;
    var fmt=function(s){s=Math.floor(s);var m=Math.floor(s/60);return m+':'+(s%60<10?'0':'')+s%60;};
    /* API 路径：UI 事件 → playAudio/pauseAudio/setAudioSettings；<audio> 元素仅作曲目数据源 */
    var pollTimer=null;
    function taSync(){ /* 轮询播放进度（API 无 timeupdate 事件） */
      clearInterval(pollTimer);
      if(!TA||!playing)return;
      pollTimer=setInterval(function(){
        try{
          if(typeof getCurrentAudio!=='function')return;
          var cur=getCurrentAudio('bgm');
          if(!cur||!cur.playing)return;
          var p=Number(cur.progress)||0;
          if(p>0&&p<=1)progBar.value=p*100;
        }catch(e){}
      },500);
    }
    function load(i){
      idx=i;
      if(sources[idx])nameEl.textContent=sources[idx].dataset.name||'';
      if(!TA)audio.src=sources[idx]?sources[idx].src:'';
    }
    var playSafe=function(){var r=audio.play();if(r&&r.catch)r.catch(function(){playBtn.textContent='▶';});};
    function next(){if(!sources.length)return;load((idx+1)%sources.length);playing=true;if(TA)taSync();else playSafe();playBtn.textContent='⏸';}
    load(0);
    playBtn.addEventListener('click',function(){
      var src=sources[idx]?sources[idx].src:'';
      var title=sources[idx]?sources[idx].dataset.name||'':'';
      if(TA){
        try{
          if(playing){pauseAudio('bgm');playing=false;playBtn.textContent='▶';clearInterval(pollTimer);}
          else{playAudio('bgm',{title:title,url:src});playing=true;playBtn.textContent='⏸';taSync();}
        }catch(e){noteTa('音频播放失败（酒馆助手音频 API 异常）')}
        return;
      }
      if(audio.paused){playSafe();playBtn.textContent='⏸';}
      else{audio.pause();playBtn.textContent='▶';}
    });
    if(TA){
      taSync();
      progBar.addEventListener('input',function(){ /* API 模式进度条仅展示（getCurrentAudio 无 seek 能力） */ });
      volBar.addEventListener('input',function(){
        if(hasFn('setAudioSettings')){try{setAudioSettings('bgm',{muted:volBar.value==0,volume:volBar.value/100})}catch(e){}}
      });
      loopBtn.addEventListener('click',function(){
        var on=!loopBtn.classList.contains('on');
        loopBtn.classList.toggle('on',on);
        if(hasFn('setAudioSettings')){try{setAudioSettings('bgm',{mode:on?'repeat_one':'repeat_all'})}catch(e){}}
      });
    }else{
    audio.addEventListener('timeupdate',function(){
      if(audio.duration){progBar.value=audio.currentTime/audio.duration*100;timeEl.textContent=fmt(audio.currentTime)+'/'+fmt(audio.duration);}
    });
    /* 源失效/加载失败：切下一曲或提示。失败计数封顶曲目数——全部失效时终止，防 error→next 无限重试循环 */
    var errCount=0;
    audio.addEventListener('error',function(){
      errCount++;
      if(sources.length>1&&errCount<sources.length){next();return}
      playBtn.textContent='▶';
      nameEl.textContent='⚠️ 音频加载失败';
    });
    progBar.addEventListener('input',function(){if(audio.duration)audio.currentTime=progBar.value/100*audio.duration;});
    volBar.addEventListener('input',function(){audio.volume=volBar.value/100;});
    audio.volume=volBar.value/100;
    loopBtn.addEventListener('click',function(){audio.loop=!audio.loop;loopBtn.classList.toggle('on',audio.loop);});
    }
  });
  /* API 模式下的轻提示（与 script() 的 note 同款，避免未定义引用） */
  function noteTa(m){
    try{if(typeof toastr!=='undefined'&&toastr&&toastr.info){toastr.info(m);return}}catch(e){}
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,30,.88);color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;z-index:99999;max-width:80vw';
    d.textContent=m;document.body.appendChild(d);
    setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},2200);
  }
})();
<\/script>`;
}

  /** 排除标签解析（纯函数，gen 侧共用：运行时 script() 与写卡快照烘焙同一口径）：
   *  切分→剥 <> 前后缀→合法性→去重→上限 40 */
export function parseExcludedTags(str){
    return [...new Set(String(str??'').split(/[，,、\s]+/).map(x=>x.trim().replace(/^<\/?|\/?>$/g,'')).filter(x=>/^[\w\u4e00-\u9fa5-]{1,40}$/.test(x)))].slice(0,40);
}

  /** 运行时脚本：酒馆助手 API，全量 typeof 检查 + 降级 */
export function script(p,px){
    const greet=p.blocks.find(b=>b.type==='greetings');
    const action=greet?.clickAction||'go';
    const titleWb=greet?.titleWb||'',titleEntry=greet?.titleEntry||'开场白标题库';
    const btnName=(greet&&greet.buttonText)?greet.buttonText:'快速切换开局';
    const tags=parseExcludedTags(greet?.excludedTags);
    const meta=(Array.isArray(greet?.entries)?greet.entries:[]).map(e=>({cover:String(e&&e.cover||''),audio:String(e&&e.audio||'')}));
    const showNames=greet?greet.showNames!==false:true;
    const wall=greet?.cardStyle==='wall';
    return `<script>
/* 运行时脚本：酒馆助手（TavernHelper）API，无 API 环境自动降级为占位数据 */
(function(){
  var PX=${JSON.stringify(px)};
  var root=document.getElementById(PX);
  if(!root)return;
  var hasFn=function(n){return typeof window[n]==='function'};
  /* iframe 内轻量提示：酒馆内置 toastr 优先（风格统一），缺失时降级自制浮层 */
  function note(m){
    try{if(typeof toastr!=='undefined'&&toastr&&typeof toastr.info==='function'){toastr.info(m,'',{timeOut:2200});return}}catch(e){}
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,30,.88);color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;z-index:99999;max-width:80vw';
    d.textContent=m;document.body.appendChild(d);
    setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},2200);
  }

  /* ---------- 读取开场白列表：以角色卡为准（getCharacter('current').first_messages），
     卡里删掉的开场白立即从列表消失；聊天消息 0 的 swipe 只是创建时的快照，仅用于映射跳转。
     无卡数据时降级读聊天 swipe ---------- */
  async function getCardGreetings(){
    if(!hasFn('getCharacter'))return null;
    try{
      var c=await getCharacter('current');
      if(c&&c.first_messages&&c.first_messages.length)return c.first_messages;
    }catch(e){}
    return null;
  }
  async function getChatMsg0(){
    if(!hasFn('getChatMessages'))return null;
    try{
      var r=getChatMessages(0,{include_swipes:true});
      if(r&&typeof r.then==='function')r=await r;
      var m=r&&r[0];
      if(m&&m.swipes&&m.swipes.length)return m;
    }catch(err){console.warn('[开场页] 读取聊天 swipe 失败',err)}
    return null;
  }
  async function getSwipes(){
    var card=await getCardGreetings();
    var chat=await getChatMsg0();
    if(!card)return chat?{list:chat.swipes,cur:chat.swipe_id||0}:null;
    if(!chat)return{list:card,cur:0};
    /* 卡开场白 → 第 0 楼 swipe 索引映射；卡里新增而聊天缺的先补进去（点击才能切过去） */
    var swipes=chat.swipes.slice(),map=[];
    card.forEach(function(fm){
      var idx=swipes.indexOf(fm);
      if(idx===-1){swipes.push(fm);idx=swipes.length-1}
      map.push(idx);
    });
    return{list:card,cur:card.indexOf(swipes[chat.swipe_id||0]||''),map:map,swipes:swipes,chatSwipeCount:chat.swipes.length};
  }

  /* ---------- 切换到对应开场白：先把卡的开场白同步进第 0 楼 swipes，
     再按映射的 swipe_id 切换（setChatMessages 支持整体 swipes 与 swipe_id）。
     切换后重读第 0 楼校验 swipe_id：酒馆在切换被拦截/失败时不一定抛错，
     静默重读才能发现；校验通过才触发联动音轨（无法确认时也不播）。
     busy 串行化：连点两个选项会让两次切换交错 await，先点的重读看到后写的
     swipe_id，产生假「消息页未切换」警报 ---------- */
  var _goBusy=false;
  function goGreeting(i){
    if(_goBusy)return;
    _goBusy=true;
    _goGreeting(i).finally(function(){_goBusy=false});
  }
  async function _goGreeting(i){
    if(hasFn('setChatMessages')){
      try{
        var d=await getSwipes();
        var target=i;
        if(d&&d.map){
          target=d.map[i];
          if(d.swipes.length!==d.chatSwipeCount){
            var s0=setChatMessages([{message_id:0,swipes:d.swipes}]);
            if(s0&&typeof s0.then==='function')await s0;
          }
        }
        var r=setChatMessages([{message_id:0,swipe_id:target}]);
        if(r&&typeof r.then==='function')await r;
        var v=await getChatMsg0();
        if(!v||typeof v.swipe_id!=='number'){loadGreetings();return}
        if(v.swipe_id!==target){note('消息页未切换，请重试');return}
        playGreetAudio(i);
        loadGreetings();return;
      }catch(e){console.warn('[开场页] setChatMessages 切换失败',e);note('切换开场白失败：'+((e&&e.message)||e))}
    }
    /* /swipe 命令只支持 left/right 方向、无法按序号切换，故无 setChatMessages 时仅提示 */
    else{note('未检测到酒馆助手 setChatMessages API，无法切换开场白')}
    setTimeout(loadGreetings,600);
  }
  /* 开场白标题/描述：优先读「标题库」世界书条目（每行：序号|标题|描述），
     未配置或未命中时自动提取——开场白首行作标题、后续文字作描述，
     无需在开场白文本里添加任何注释标记（避免被预设美化破坏显示） */
  var TITLE_WB=${jss(titleWb||'')},TITLE_ENTRY=${jss(titleEntry||'')};
  /* 封面墙/联动音轨/排除标签/人名开关（按开场白序号对应，见 gen 层 script()） */
  var TAGS=${jss(tags)},META=${jss(meta)},NAMES=${jss(showNames)},WALL=${jss(wall)};
  /* 剥除作者配置的排除标签：整块元素连内容删掉；自闭合/孤立开、孤立闭标签单独删
     （标签名已经 gen 侧白名单校验，无需再转义正则元字符） */
  function stripTags(text){
    var t=String(text||'');
    for(var k=0;k<TAGS.length;k++){
      var tag=TAGS[k];
      t=t.replace(new RegExp('<'+tag+'(\\\\s[^<>]*)?>[\\\\s\\\\S]*?<\\\\/'+tag+'\\\\s*>','gi'),' ');
      t=t.replace(new RegExp('<'+tag+'(?:\\\\s[^<>]*)?\\\\/?>','gi'),' ');
      t=t.replace(new RegExp('<\\\\/'+tag+'\\\\s*>','gi'),' ');
    }
    return t;
  }
  /* 人物名提取（思路借鉴外部开场白选择器，实现为精简自研版）：
     显式字段 → 成对标签 → 冒号说话人归属（剥标签后 + 元数据/代词黑名单），去重上限 3 */
  function extractNames(text){
    /* '\u003c' 转义断开 HTML 注释开启序列（HTML script 双转义坑，惯例同上方 jss），正则语义等价 */
    var raw=stripTags(String(text||'')).replace(/\\u003c!--[\\s\\S]*?-->/g,' ');
    var found=[],add=function(n){n=(n||'').trim();if(n&&found.indexOf(n)===-1&&found.length<3)found.push(n)},m,re;
    re=/(?:姓名|人物姓名|角色名|角色姓名|登场人物|名字)[：:]\\s*([\\u4e00-\\u9fa5]{2,4})(?=$|[\\s，,。；;|<])/gm;
    while((m=re.exec(raw)))add(m[1]);
    re=/<(?:姓名|角色名|人物姓名|角色姓名|名字)>\\s*([\\u4e00-\\u9fa5]{2,4})\\s*<\\//g;
    while((m=re.exec(raw)))add(m[1]);
    var plain=raw.replace(/<[^<>\\n]{1,120}>/g,'\\n');
    re=/(?:^|\\n)\\s*(?:【|\\[)?([\\u4e00-\\u9fa5]{2,4})(?:】|\\])?\\s*[：:][^\\n]{1,80}/gm;
    var BAD=/^(?:时间|地点|日期|天气|姓名|人物|角色|正文|内容|旁白|系统|状态|说明|剧情|备注|年龄|性别|身份|关系|身高|职业|性格|外貌|你|我|她|他|它|玩家|用户|场景)$/;
    while((m=re.exec(plain))){if(!BAD.test(m[1]))add(m[1])}
    return found;
  }
  /* ---------- 开场白联动音轨：挂宿主文档，切换楼层后继续播放 ----------
     楼层 iframe 在 swipe 后整体重建，楼内 <audio> 必随销毁；故向上穿透 parent
     （≤8 层，逐层 try/catch，跨域停在当前层）把音频挂到顶层文档。穿透失败
     降级楼内播放（切楼即停）。选中未配音轨的开场白时停止并移除。 */
  function hostDoc(){
    try{
      var w=window;
      for(var k=0;k<8&&w.parent&&w.parent!==w;k++){
        try{void w.parent.document}catch(e){break}
        w=w.parent;
      }
      return w.document;
    }catch(e){return null}
  }
  function findHostAudio(doc){try{return doc.querySelector('[data-opg-greet-audio]')}catch(e){return null}}
  function stopGreetAudio(){
    var a=gAudio||findHostAudio(hostDoc()||document);
    if(a){try{a.pause();if(a.parentNode)a.parentNode.removeChild(a)}catch(e){}}
    gAudio=null;
  }
  var gAudio=null;
  function playGreetAudio(i){
    var url=(META[i]&&META[i].audio)||'';
    if(!url){stopGreetAudio();return}
    try{
      var doc=hostDoc()||document;
      gAudio=findHostAudio(doc);
      if(!gAudio){
        gAudio=doc.createElement('audio');
        gAudio.setAttribute('data-opg-greet-audio','');
        gAudio.loop=true;gAudio.style.display='none';
        (doc.body||doc.documentElement).appendChild(gAudio);
      }
      if(gAudio.getAttribute('src')!==url){gAudio.src=url;try{gAudio.currentTime=0}catch(e){}}
      var pr=gAudio.play();
      if(pr&&typeof pr.catch==='function')pr.catch(function(){note('开场白音轨播放失败')});
    }catch(e){console.warn('[开场页] 联动音轨播放失败',e)}
  }
  var titleMap=null;
  async function loadTitleMap(){
    if(!TITLE_WB)return;
    if(!hasFn('getLorebookEntries')&&!hasFn('getWorldbook'))return;
    try{
      var entries=null;
      if(hasFn('getLorebookEntries'))entries=await getLorebookEntries(TITLE_WB);
      else entries=await getWorldbook(TITLE_WB);
      /* 旧 API LorebookEntry 条目名是 comment，新 API WorldbookEntry 是 name，两者兼容 */
      var e=(entries||[]).find(function(x){return (x.comment!==undefined?x.comment:x.name)===TITLE_ENTRY});
      if(!e||!e.content)return;
      var m={},oneBased=null;
      e.content.split(/\\n/).forEach(function(line){
        var p=line.split('|');
        if(p.length>=2){var idx=parseInt(p[0].trim(),10);if(!isNaN(idx)){m[idx]={title:p[1].trim(),desc:(p[2]||'').trim()};if(oneBased===null)oneBased=idx===1}}
      });
      if(Object.keys(m).length){
        /* 序号从 1 开始写时（用户习惯）整体偏移成 0-based 列表索引 */
        titleMap=oneBased?Object.keys(m).reduce(function(acc,k){acc[k-1]=m[k];return acc},{}):m;
      }else titleMap=null;
    }catch(err){console.warn('[开场页] 读取标题库失败',err)}
  }
  function extractTitleDesc(text){
    text=stripTags(text);
    var CMT='<'+'!--',FEN='\\x60\\x60\\x60';
    var lines=String(text||'').replace(/\\r/g,'').split('\\n').map(function(s){return s.trim()})
      .filter(function(s){return s&&s.indexOf(CMT)!==0&&s.indexOf(FEN)!==0});
    if(!lines.length)return{title:'（无内容）',desc:''};
    var t=lines[0].replace(/^#+\\s*/,'');
    if(t.length>20)t=t.slice(0,20)+'…';
    var rest=lines.slice(1).join(' ').slice(0,48);
    return{title:t,desc:rest.length>=48?rest+'…':rest};
  }

  /* 渲染列表（不缓存数据——每次渲染都来自实时读取）。
     序号用中文数字徽标（与 gen/body.js 占位列表同一视觉；运行时脚本字符串
     自包含无法引用 gen 层常量，GNUM 改动须两处同步），>10 条回落阿拉伯数字 */
  var GNUM='壹贰叁肆伍陆柒捌玖拾';
  var lastSig=null;
  function swipeSig(d){return JSON.stringify([d.cur,d.list])}
  function renderList(d){
    var listEl=root.querySelector('[data-opg="glist"]');
    if(!listEl)return;
    listEl.innerHTML='';
    d.list.forEach(function(msg,i){
      var td=(titleMap&&titleMap[i])?titleMap[i]:extractTitleDesc(msg);
      var btn=document.createElement('button');
      btn.type='button';btn.className=PX+'-gitem'+(WALL?' '+PX+'-gwallitem':'')+(i===d.cur?' '+PX+'-gcur':'');
      btn.setAttribute('data-opg','g');btn.setAttribute('data-i',i);
      var main=document.createElement('span');main.className=PX+'-gmain';
      var t1=document.createElement('span');t1.className=PX+'-gtitle';t1.textContent=td.title;
      main.appendChild(t1);
      if(td.desc){var t2=document.createElement('span');t2.className=PX+'-gdesc';t2.textContent=td.desc;main.appendChild(t2)}
      var names=NAMES?extractNames(msg):[];
      if(names.length){var n3=document.createElement('span');n3.className=PX+'-gnames';n3.textContent=names.join(' · ');main.appendChild(n3)}
      if(WALL){
        /* 封面墙条目：渐变回落层垫底，img 加载失败隐藏后自然露出（与占位渲染同构） */
        var wrap=document.createElement('span');wrap.className=PX+'-gcoverwrap';
        var ph=document.createElement('span');ph.className=PX+'-gcoverph';
        var pn=document.createElement('span');pn.className=PX+'-gphnum';pn.textContent=GNUM[i]||(i+1);
        ph.appendChild(pn);wrap.appendChild(ph);
        var cv=(META[i]&&META[i].cover)||'';
        if(cv){
          var img=document.createElement('img');img.className=PX+'-gcover';
          img.setAttribute('loading','lazy');img.setAttribute('alt','');img.src=cv;
          img.onerror=function(){this.style.display='none'};
          wrap.appendChild(img);
        }
        var n1=document.createElement('span');n1.className=PX+'-gnum';n1.textContent=GNUM[i]||(i+1);
        wrap.appendChild(n1);btn.appendChild(wrap);
      }else{
        var n0=document.createElement('span');n0.className=PX+'-gnum';n0.textContent=GNUM[i]||(i+1);
        btn.appendChild(n0);
      }
      btn.appendChild(main);
      listEl.appendChild(btn);
    });
    lastSig=swipeSig(d);
  }
  async function loadGreetings(){
    var d=await getSwipes();
    if(!d)return; /* 无 API 环境：保留占位列表 */
    renderList(d);
  }
  /* 实时同步：优先事件驱动（酒馆助手 tavern_events），3 秒轮询兜底。
     不做持久缓存——已删除的开场白不会残留在列表里。
     重入保护：上一次尚未完成时跳过本轮，防止 API 慢时调用无限堆积 */
  var syncing=false;
  function syncList(){
    if(syncing)return;
    /* 页面不可见时跳过，省掉后台 iframe 的无谓 API 轮询 */
    if(document.hidden)return;
    syncing=true;
    getSwipes().then(function(d){
      if(d&&swipeSig(d)!==lastSig)return loadTitleMap().then(function(){renderList(d)});
    }).catch(function(e){console.warn('[开场页] 同步失败',e)}).then(function(){syncing=false});
  }
  (function(){
    if(typeof tavern_events!=='object'||!tavern_events||typeof eventOn!=='function')return;
    [tavern_events.MESSAGE_SWIPED,tavern_events.MESSAGE_EDITED,tavern_events.MESSAGE_DELETED,tavern_events.CHAT_CHANGED]
      .forEach(function(n){if(n===undefined||n===null)return;try{eventOn(n,syncList)}catch(e){}});
  })();
  setInterval(syncList,3000);

  /* ---------- 点击开场白选项 ---------- */
  var selIdx=-1;
  var ACT=${jss(action)};
  var _lastSwipes=null;
  async function getGreetingText(i){
    if(!_lastSwipes)_lastSwipes=await getSwipes();
    return _lastSwipes?(_lastSwipes.list[i]||''):'';
  }
  root.addEventListener('click',async function(ev){
    var item=ev.target.closest('[data-opg="g"]');
    if(item){
      var i=parseInt(item.getAttribute('data-i'),10);
      _lastSwipes=await getSwipes();
      if(ACT==='go'){await goGreeting(i)}
      else if(ACT==='insert'){
        var msg=await getGreetingText(i);
        if(msg&&hasFn('triggerSlash')){try{await triggerSlash('/setinput '+msg)}catch(e){note('填入输入框失败')}}
        else if(!hasFn('triggerSlash')){note('未检测到酒馆助手 API，无法填入')}
      }else{ /* send 模式：先选中再点按钮 */
        selIdx=i;
        root.querySelectorAll('[data-opg="g"]').forEach(function(b){b.style.outline=''});
        item.style.outline='2px solid currentColor';
      }
      return;
    }
    var send=ev.target.closest('[data-opg="gsend"]');
    if(send){
      var msg2=await getGreetingText(selIdx);
      if(msg2&&hasFn('triggerSlash')){try{await triggerSlash('/send '+msg2)}catch(e){note('发送失败')}}
      else if(selIdx<0){note('请先选择一个开场白')}
      else if(!hasFn('triggerSlash')){note('未检测到酒馆助手 API，无法发送')}
      return;
    }
  });

  loadTitleMap().then(loadGreetings);

  /* ---------- 按钮模式：注册酒馆脚本按钮 + 输入序号跳转 ----------
     把切换能力注册成酒馆助手按钮栏的脚本按钮，点击后弹输入要序号（1 开始），
     范围校验后走与页内点选同一条 goGreeting 映射路径（卡↔swipe 一致）。
     页内列表照常渲染：无 API/注册失败环境降级为占位列表，功能静默跳过 */
  if(ACT==='button'){
    var BTN=${jss(btnName)};
    var hasBtnApi=hasFn('appendInexistentScriptButtons')&&hasFn('getButtonEvent');
    var hasPopup=(function(){try{return typeof window.SillyTavern==='object'&&!!window.SillyTavern&&!!window.SillyTavern.POPUP_TYPE&&typeof window.SillyTavern.callGenericPopup==='function'}catch(e){return false}})();
    if(hasBtnApi){
      try{
        appendInexistentScriptButtons([{name:BTN,visible:true}]);
        var btnEv=getButtonEvent(BTN);
        if(btnEv!==undefined&&btnEv!==null&&typeof eventOn==='function'){
          eventOn(btnEv,async function(){
            try{
              if(!hasPopup){note('未检测到弹出输入，请直接点击页内列表选项');return}
              var d=await getSwipes();
              if(!d||!d.list||!d.list.length){note('未找到任何开场白');return}
              var n=parseInt(String(await window.SillyTavern.callGenericPopup('请输入要选择的开局号（从 1 开始，共 '+d.list.length+' 个）',window.SillyTavern.POPUP_TYPE.INPUT),10));
              if(!isFinite(n)||n<1||n>d.list.length){note('未填入有效开局号');return}
              /* 序号（1 开始）= 卡开场白索引：与页内点选同一条 goGreeting 路径，
                 由 goGreeting 内部完成卡↔swipe 映射（此处传 swipe 序号会双重映射） */
              await goGreeting(n-1);
            }catch(e){console.warn('[开场页] 按钮切换失败',e);note('按钮切换失败：'+((e&&e.message)||e))}
          });
        }
      }catch(e){console.warn('[开场页] 注册切换按钮失败',e)}
    }
  }
})();
<\/script>`;
}
