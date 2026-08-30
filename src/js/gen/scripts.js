/* 运行时脚本：灯箱 / BGM 播放器 / 酒馆助手 API 交互（从 gen.js 拆分） */

export function lightbox(px){
    return `<script>
(function(){
  var PX=${JSON.stringify(px)};
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

export function bgmScript(px){
    return `<script>
(function(){
  var PX=${JSON.stringify(px)};
  var root=document.getElementById(PX);
  if(!root)return;
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
    var fmt=function(s){s=Math.floor(s);var m=Math.floor(s/60);return m+':'+(s%60<10?'0':'')+s%60;};
    function load(i){
      idx=i;
      if(sources[idx]){audio.src=sources[idx].src;nameEl.textContent=sources[idx].dataset.name||'';}
    }
    function next(){if(!sources.length)return;load((idx+1)%sources.length);audio.play();playBtn.textContent='⏸';}
    load(0);
    playBtn.addEventListener('click',function(){
      if(audio.paused){audio.play();playBtn.textContent='⏸';}
      else{audio.pause();playBtn.textContent='▶';}
    });
    audio.addEventListener('ended',function(){
      if(audio.loop){audio.currentTime=0;audio.play();}
      else{next();}
    });
    audio.addEventListener('timeupdate',function(){
      if(audio.duration){progBar.value=audio.currentTime/audio.duration*100;timeEl.textContent=fmt(audio.currentTime)+'/'+fmt(audio.duration);}
    });
    progBar.addEventListener('input',function(){if(audio.duration)audio.currentTime=progBar.value/100*audio.duration;});
    volBar.addEventListener('input',function(){audio.volume=volBar.value/100;});
    audio.volume=volBar.value/100;
    loopBtn.addEventListener('click',function(){audio.loop=!audio.loop;loopBtn.classList.toggle('on',audio.loop);});
  });
})();
<\/script>`;
}

  /** 运行时脚本：酒馆助手 API，全量 typeof 检查 + 降级 */
export function script(p,px){
    const greet=p.blocks.find(b=>b.type==='greetings');
    const action=greet?.clickAction||'go';
    const titleWb=greet?.titleWb||'',titleEntry=greet?.titleEntry||'开场白标题库';
    return `<script>
/* 运行时脚本：酒馆助手（TavernHelper）API，无 API 环境自动降级为占位数据 */
(function(){
  var PX=${JSON.stringify(px)};
  var root=document.getElementById(PX);
  if(!root)return;
  var hasFn=function(n){return typeof window[n]==='function'};
  /* iframe 内轻量提示（无宿主 toast 可用） */
  function note(m){
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,20,30,.88);color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;z-index:99999;max-width:80vw';
    d.textContent=m;document.body.appendChild(d);
    setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},2200);
  }

  /* ---------- 读取开场白列表：以角色卡为准（getCharacter('current').first_messages），
     卡里删掉的开场白立即从列表消失；聊天消息 0 的 swipe 只是创建时的快照，仅用于映射跳转。
     无卡数据时降级读聊天 swipe，再降级 getCharacter() 无参 ---------- */
  async function getCardGreetings(){
    if(!hasFn('getCharacter'))return null;
    try{
      var c=await getCharacter('current');
      if(c&&c.first_messages&&c.first_messages.length)return c.first_messages;
    }catch(e){}
    try{
      var c2=await getCharacter();
      if(c2&&c2.first_messages&&c2.first_messages.length)return c2.first_messages;
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
     再按映射的 swipe_id 切换（setChatMessages 支持整体 swipes 与 swipe_id） ---------- */
  async function goGreeting(i){
    if(hasFn('setChatMessages')){
      try{
        var d=await getSwipes();
        if(d&&d.map){
          if(d.swipes.length!==d.chatSwipeCount){
            var s0=setChatMessages([{message_id:0,swipes:d.swipes}]);
            if(s0&&typeof s0.then==='function')await s0;
          }
          var r=setChatMessages([{message_id:0,swipe_id:d.map[i]}]);
          if(r&&typeof r.then==='function')await r;
        }else{
          var r2=setChatMessages([{message_id:0,swipe_id:i}]);
          if(r2&&typeof r2.then==='function')await r2;
        }
        loadGreetings();return;
      }catch(e){console.warn('[开场页] setChatMessages 切换失败',e);note('切换开场白失败：'+((e&&e.message)||e))}
    }
    if(hasFn('triggerSlash')){try{await triggerSlash('/swipe '+i)}catch(e){note('切换开场白失败')}}
    else{note('未检测到酒馆助手 API，无法切换开场白')}
    setTimeout(loadGreetings,600);
  }
  /* 开场白标题/描述：优先读「标题库」世界书条目（每行：序号|标题|描述），
     未配置或未命中时自动提取——开场白首行作标题、后续文字作描述，
     无需在开场白文本里添加任何注释标记（避免被预设美化破坏显示） */
  var TITLE_WB=${JSON.stringify(titleWb)},TITLE_ENTRY=${JSON.stringify(titleEntry)};
  var titleMap=null;
  async function loadTitleMap(){
    if(!TITLE_WB)return;
    if(!hasFn('getLorebookEntries')&&!hasFn('getWorldbook'))return;
    try{
      var entries=null;
      if(hasFn('getLorebookEntries'))entries=await getLorebookEntries(TITLE_WB);
      else entries=await getWorldbook(TITLE_WB);
      var e=(entries||[]).find(function(x){return x.comment===TITLE_ENTRY});
      if(!e||!e.content)return;
      var m={};
      e.content.split(/\\n/).forEach(function(line){
        var p=line.split('|');
        if(p.length>=2){var idx=parseInt(p[0].trim(),10);if(!isNaN(idx))m[idx]={title:p[1].trim(),desc:(p[2]||'').trim()}}
      });
      if(Object.keys(m).length)titleMap=m;else titleMap=null;
    }catch(err){console.warn('[开场页] 读取标题库失败',err)}
  }
  function extractTitleDesc(text){
    var CMT='<'+'!--',FEN='\\x60\\x60\\x60';
    var lines=String(text||'').replace(/\\r/g,'').split('\\n').map(function(s){return s.trim()})
      .filter(function(s){return s&&s.indexOf(CMT)!==0&&s.indexOf(FEN)!==0});
    if(!lines.length)return{title:'（无内容）',desc:''};
    var t=lines[0].replace(/^#+\\s*/,'');
    if(t.length>20)t=t.slice(0,20)+'…';
    var rest=lines.slice(1).join(' ').slice(0,48);
    return{title:t,desc:rest.length>=48?rest+'…':rest};
  }

  /* 渲染列表（不缓存数据——每次渲染都来自实时读取） */
  var lastSig=null;
  function swipeSig(d){return JSON.stringify([d.cur,d.list])}
  function renderList(d){
    var listEl=root.querySelector('[data-opg="glist"]');
    if(!listEl)return;
    listEl.innerHTML='';
    d.list.forEach(function(msg,i){
      var td=(titleMap&&titleMap[i])?titleMap[i]:extractTitleDesc(msg);
      var btn=document.createElement('button');
      btn.type='button';btn.className=PX+'-gitem'+(i===d.cur?' '+PX+'-gcur':'');
      btn.setAttribute('data-opg','g');btn.setAttribute('data-i',i);
      var t1=document.createElement('span');t1.className=PX+'-gtitle';t1.textContent=(i+1)+'. '+td.title;
      btn.appendChild(t1);
      if(td.desc){var t2=document.createElement('span');t2.className=PX+'-gdesc';t2.textContent=td.desc;btn.appendChild(t2)}
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
  var ACT=${JSON.stringify(action)};
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
      return;
    }
  });

  loadTitleMap().then(loadGreetings);
})();
<\/script>`;
}
