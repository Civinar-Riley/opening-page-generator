/* 区块编辑器：renderBlockBody（25 种区块的编辑表单 + 事件）+ 组件库插入/选择器弹窗（自 renderConfig.js 拆出） */
import { esc, toast, confirmModal, copyText } from '../utils.js';
import { COMP_LIB, BLOCK_PRESETS, applyBlockPreset, syncGateThemeCopy } from '../defs.js';
import { Project } from '../project.js';
import { UI } from './core.js';
import { bindListEditor } from './shared.js';
/* 组件库分类（与 defs.js COMP_LIB[].cat 对应） */
const COMP_CATS=[['all','全部'],['text','叙事文本'],['info','信息展示'],['role','角色卡'],['tech','科技终端'],['fx','状态动效'],['fantasy','古风奇幻'],['fun','交互趣味']];

/* ---------- 区块编辑器 ---------- */
export function renderBlockBody(container,b,i){
  const p=Project.cur;
  const bind=(key,label,type='text',extra='')=>`<div><label>${label}</label><input type="${type}" data-bkey="${i}.${key}" value="${esc(b[key]??'')}" ${extra}></div>`;
  const area=(key,label,ph='')=>`<div><label>${label}</label><textarea data-bkey="${i}.${key}" placeholder="${ph}">${esc(b[key]??'')}</textarea></div>`;
  const chk=(key,label)=>`<label class="inline-check"><input type="checkbox" data-bchk="${i}.${key}" ${b[key]?'checked':''}>${label}</label>`;
  let html='';
  switch(b.type){
    case 'welcome':{
      const presets=BLOCK_PRESETS.welcome||[];
      html=(presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="welcome"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:'')
        +bind('title','主标题（支持 {{char}} 等宏）')+bind('subtitle','副标题')+`<div class="row2">${chk('showEyebrow','显示眉题')}</div>`+bind('eyebrow','眉题文字（标题上方小型大写宽字距）')+`<div><label>标题装饰风格</label><select data-bkey="${i}.decoStyle">
          <option value="none"${b.decoStyle==='none'?' selected':''}>无（纯排版 + 题笺刻线）</option>
          <option value="ornate"${b.decoStyle==='ornate'?' selected':''}>华丽辉光（双层柔光 + 两侧星点）</option>
          <option value="glitch"${b.decoStyle==='glitch'?' selected':''}>色差故障（主题双色错位 + 低频抖动）</option>
          <option value="underline"${b.decoStyle==='underline'?' selected':''}>荧光笔（底部高亮划入）</option>
          <option value="boxed"${b.decoStyle==='boxed'?' selected':''}>四角铭牌刻线</option>
          <option value="double"${b.decoStyle==='double'?' selected':''}>双线夹注</option>
          <option value="brackets"${b.decoStyle==='brackets'?' selected':''}>书名括角『』</option>
          <option value="stamp"${b.decoStyle==='stamp'?' selected':''}>篆印（楷书钤印轻旋转）</option>
          <option value="ribbon"${b.decoStyle==='ribbon'?' selected':''}>票根缎带</option>
          <option value="gradient"${b.decoStyle==='gradient'?' selected':''}>流光渐变（缓慢巡游）</option>
        </select></div>`;
      break;
    }
    case 'decor':
      html=`<div class="row2"><div><label>边框样式</label><select data-bkey="${i}.borderStyle">
          ${[['none','无边框'],['solid','实线'],['double','双线'],['dashed','虚线'],['dotted','点线'],['groove','浮雕凹槽'],['ridge','浮雕凸脊'],['inset','内嵌凹线'],['outset','外凸浮线']].map(([v,l])=>`<option value="${v}"${b.borderStyle===v?' selected':''}>${l} (${v})</option>`).join('')}
        </select></div><div><label>装饰花纹</label><select data-bkey="${i}.pattern">
          ${[['none','无'],['stars','星芒 ✦'],['lines','分隔线 ◆'],['moons','月相 ☽'],['petals','花瓣 ❀'],['notes','音符 ♪'],['hearts','爱心 ♡'],['waves','波浪 〰'],['diamonds','菱形阵 ◇'],['custom','自定义字符']].map(([v,l])=>`<option value="${v}"${b.pattern===v?' selected':''}>${l}</option>`).join('')}
        </select></div></div>
        ${bind('patternText','自定义花纹字符（选「自定义字符」时生效）')}
        <div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">ℹ️ 背景色/背景图已移至顶部「🎨 主题风格」卡片统一管理（v1.24 起），此处只管边框、花纹与光带。</div>
        ${chk('topGlow','顶部光带（容器上缘强调色亮线）')}`;
      break;
    case 'profile':{
      const bp=b;
      if(!Array.isArray(bp.characters)||!bp.characters.length)bp.characters=[{name:'',desc:'',tags:'',avatar:''}];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:0 0 8px">📌 角色信息直接填写即可（支持宏）。≤2 个角色渲染为并列主演的横向立牌；超过 2 个自动收成「群像墙」网格——折叠显示序号与角色名，点击展开完整立牌（预览与导出一致）。</div>`;
        bp.characters.forEach((ch,ci)=>{
          h+=`<div style="border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin:8px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <strong style="font-size:12px;color:var(--acc)">角色 ${ci+1}</strong><span style="flex:1"></span>
              ${bp.characters.length>1?`<button type="button" class="btn danger small" data-chardel="${ci}">删除</button>`:''}
            </div>
            <div class="row2">
              <div><label>名字（支持宏）</label><input data-charf="${ci}.name" value="${esc(ch.name)}"></div>
              <div><label>头像来源</label><select data-charf="${ci}.avatarMode">
                <option value="manual"${ch.avatarMode==='char'||ch.avatarMode==='user'?'':' selected'}>手动 URL</option>
                <option value="char"${ch.avatarMode==='char'?' selected':''}>角色卡头像（零 JS）</option>
                <option value="user"${ch.avatarMode==='user'?' selected':''}>用户头像（零 JS）</option>
              </select></div>
            </div>
            <div><label>立绘/头像图片 URL${ch.avatarMode==='char'||ch.avatarMode==='user'?'（零 JS 模式下不使用，酒馆内由渲染器自动注入头像）':''}</label><input data-charf="${ci}.avatar" value="${esc(ch.avatar)}" placeholder="https://..."${ch.avatarMode==='char'||ch.avatarMode==='user'?' disabled':''}></div>
            <div><label>标签（逗号分隔，支持宏）</label><input data-charf="${ci}.tags" value="${esc(ch.tags)}" placeholder="标签1,标签2"></div>
            <div><label>简介（支持宏）</label></div>
            <div><textarea data-charf="${ci}.desc" placeholder="角色简介…">${esc(ch.desc)}</textarea></div>
          </div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-charadd="1" style="margin:2px 0 10px">＋ 添加角色</button>`;
        h+=`<div class="row2">${chk('showAvatar','显示立绘/头像')}${chk('avatarRound','头像圆形（否则矩形立绘）')}</div>
          <div class="row2">${chk('showName','显示名字')}${chk('showDesc','显示简介')}</div>
          ${chk('showTags','显示标签')}
          <div style="font-size:11px;color:var(--txt2);margin-top:6px">💡 零 JS 头像模式：酒馆渲染器检测到 <code>char-avatar</code>/<code>user-avatar</code> 类即自动注入角色/用户头像背景图，无需任何 API，兼容性最好；工具预览中显示占位底色。</div>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,bp.characters,{
        delAttr:'chardel',addAttr:'charadd',fieldAttr:'charf',build,
        confirmMsg:'确定删除该角色？',
        createItem:()=>({name:'{{char}}',desc:'',tags:'',avatar:'',avatarMode:'manual'}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'disclaimer':
      html=`<div><label>样式</label><select data-bkey="${i}.style"><option value="collapse"${b.style==='collapse'?' selected':''}>可折叠</option><option value="plain"${b.style==='plain'?' selected':''}>小字直显</option></select></div>${area('text','声明文本（支持宏）')}`;
      break;
    case 'quote':{
      const presets=BLOCK_PRESETS.quote||[];
      html=(presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="quote"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:'')
        +`${area('text','引言文本（支持宏）')}${bind('source','署名（可选，显示为「—— xxx」)')}`;
      break;
    }
    case 'gallery':{
      if(!Array.isArray(b.images))b.images=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 图片加载失败会自动隐藏；点击图片可全屏放大预览（点空白处或 Esc 关闭），导出后同样有效。</div>
          <div class="row2"><div><label>每行列数</label><select data-bkey="${i}.cols">
          ${['2','3','4'].map(c=>`<option value="${c}"${String(b.cols)===c?' selected':''}>${c} 列</option>`).join('')}</select></div><div></div></div>`;
        b.images.forEach((im,gi)=>{
          h+=`<div style="display:grid;grid-template-columns:1fr 110px 30px;gap:6px;margin:4px 0;align-items:center">
            <input data-glf="${gi}.url" value="${esc(im.url)}" placeholder="图片 URL https://...">
            <input data-glf="${gi}.cap" value="${esc(im.cap??'')}" placeholder="说明(可选)">
            <button type="button" data-gldel="${gi}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-gladd="1" style="margin-top:6px">＋ 添加图片</button>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,b.images,{
        delAttr:'gldel',addAttr:'gladd',fieldAttr:'glf',build,
        confirmMsg:'删除该图片？',
        createItem:()=>({url:'',cap:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'author':
      html=`<div><label>样式</label><select data-bkey="${i}.style"><option value="collapse"${b.style==='collapse'?' selected':''}>可折叠</option><option value="plain"${b.style==='plain'?' selected':''}>直显</option><option value="card"${b.style==='card'?' selected':''}>卡片式（左强调竖线 + 小标题）</option></select></div>${area('text','内容（支持宏，可换行）')}`;
      break;
    case 'divider':
      html=`<div><label>样式</label><select data-bkey="${i}.style">
          <option value="diamond"${b.style==='diamond'?' selected':''}>菱形渐变线 ◆</option>
          <option value="dots"${b.style==='dots'?' selected':''}>星点 ✦ ✦ ✦</option>
          <option value="flowers"${b.style==='flowers'?' selected':''}>花朵线 ❀</option>
          <option value="wave"${b.style==='wave'?' selected':''}>波浪线 〰</option>
          <option value="glow"${b.style==='glow'?' selected':''}>流光线（光点巡游）</option>
          <option value="gradient-thick"${b.style==='gradient-thick'?' selected':''}>粗渐变条</option>
          <option value="plain"${b.style==='plain'||!b.style?' selected':''}>纯渐变线</option>
        </select></div>
        ${bind('text','中间文字（可选，留空则使用默认符号）')}`;
      break;
    case 'greetings':{
      if(!Array.isArray(b.entries))b.entries=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 酒馆运行时以<strong>角色卡当前开场白</strong>（<code>getCharacter('current').first_messages</code>）为准实时渲染——卡里删掉的开场白立即从列表消失；点击跳转时自动把新增开场白同步进聊天第 0 楼再切换。选项显示<strong>标题 + 描述预览</strong>：默认自动提取（首行作标题），配置标题库世界书后按「序号|标题|描述」覆盖。</div>
        ${area('placeholderList','预览占位列表（每行一个，可用 ｜ 分隔标题、描述与人物名）')}
        <div class="row2">${chk('showTitle','显示小节标题')}${chk('showNames','显示自动提取的人物名')}</div>
        ${bind('title','小节标题文字（列表上方强调色小字）')}
        <div class="row2">
          <div><label>标题库世界书名（可选）</label><input data-bkey="${i}.titleWb" value="${esc(b.titleWb||'')}" placeholder="留空则自动提取"></div>
          <div><label>标题库条目名 (comment)</label><input data-bkey="${i}.titleEntry" value="${esc(b.titleEntry||'开场白标题库')}"></div>
        </div>
        <div style="font-size:11px;color:var(--txt2);margin:4px 0">标题库条目内容每行格式：<code>序号|标题|描述</code>，序号从 0 开始（与列表徽标一致，0 即第 1 个开场白；旧的从 1 开始写法会自动识别兼容）。</div>
        ${bind('excludedTags','排除标签（逗号/顿号分隔，自动提取标题、描述、人名前剥除，如 status,设定）')}
        <div style="border:1px dashed var(--accent);border-radius:8px;padding:8px;margin:6px 0">
          <div style="font-size:11px;color:var(--txt2);display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span>📚 标题库草稿（手动维护）——粘进世界书条目「${esc(b.titleEntry||'开场白标题库')}」供运行时按序号覆盖开场白标题${b.titleWb?`（已写入世界书 ${esc(b.titleWb)}）`:''}</span>${b.titleBookDraft?`<button type="button" class="btn ghost small" data-bkcopy="1">📋 复制</button>${typeof window.createWorldbook==='function'?'<button type="button" class="btn ghost small" data-bkwb="1">📤 写入世界书</button>':'<span>（写入需在酒馆内打开工具）</span>'}`:''}</div>
          <textarea data-bkey="${i}.titleBookDraft" rows="3" style="font-size:11px;margin-top:6px" placeholder="留空不使用标题库。每行：序号|标题|描述，如 0｜雨夜邂逅｜一场大雨，命运的相遇">${esc(b.titleBookDraft||'')}</textarea>
        </div>
        <div><label>选项风格</label><select data-bkey="${i}.cardStyle">
          <option value="card"${b.cardStyle==='card'?' selected':''}>卡片式（底色块 + 边框 + 悬浮位移）</option>
          <option value="list"${b.cardStyle==='list'?' selected':''}>列表式（左侧竖线 + 紧凑行）</option>
          <option value="wall"${b.cardStyle==='wall'?' selected':''}>封面墙（大图海报网格，无图回落渐变占位）</option>
        </select></div>
        <div><label>点击行为</label><select data-bkey="${i}.clickAction">
          <option value="go"${b.clickAction!=='insert'&&b.clickAction!=='send'&&b.clickAction!=='button'?' selected':''}>点击选项 → 切换到对应开场白（推荐，直接跳转 swipe 分支）</option>
          <option value="insert"${b.clickAction==='insert'?' selected':''}>点击选项 → 填入输入框（/setinput）</option>
          <option value="send"${b.clickAction==='send'?' selected':''}>选中后点按钮 → 直接发送（/send）</option>
          <option value="button"${b.clickAction==='button'?' selected':''}>页内列表 + 注入酒馆按钮（输入序号快速跳转，极简页适用）</option>
        </select></div>
        ${bind('buttonText','按钮文字（发送模式发送钮 / 按钮模式注册钮名）')}
        <div style="margin-top:8px"><label>封面与音轨（按开场白序号对应）</label></div>`;
        b.entries.forEach((en,ei)=>{
          h+=`<div style="border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:4px 0">
            <div style="display:flex;align-items:center"><span style="font-size:11px;color:var(--accent);font-weight:600">第 ${ei+1} 个开场白</span><button type="button" data-gedel="${ei}" style="margin-left:auto;background:none;border:none;color:var(--err);font-size:14px">✕</button></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0">
              <input data-gef="${ei}.cover" value="${esc(en.cover||'')}" placeholder="封面图 URL（可空）">
              <input data-gef="${ei}.audio" value="${esc(en.audio||'')}" placeholder="联动音轨 URL（可空）">
            </div></div>`;
        });
        h+=`<div style="font-size:11px;color:var(--txt2);margin:4px 0">序号对应角色卡开场白顺序，开场白数多于配置项时多余项用默认样式；联动音轨在<strong>点击切换开场白成功后</strong>播放（挂宿主文档，切换楼层不中断），选中未配音轨的开场白时停止。与 BGM 区块同时使用会叠播，请自行取舍。</div>
        <button type="button" class="btn ghost small" data-geadd="1" style="margin-top:6px">＋ 添加一项</button>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,b.entries,{
        delAttr:'gedel',addAttr:'geadd',fieldAttr:'gef',build,
        confirmMsg:'删除该项的封面与音轨配置？',
        createItem:()=>({cover:'',audio:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      const bkcopy=container.querySelector('[data-bkcopy]');
      if(bkcopy)bkcopy.addEventListener('click',()=>{copyText(b.titleBookDraft);toast('标题库草稿已复制，粘进酒馆世界书条目即可')});
      const bkwb=container.querySelector('[data-bkwb]');
      if(bkwb)bkwb.addEventListener('click',()=>openTitlebookWriter(b));
      break;
    }
    case 'clockbar':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 实时时钟栏：导出后由酒馆的 <code>{{weekday}}</code> <code>{{isotime}}</code> 宏动态显示当前时间。内容支持宏与内联 HTML（可用上方 🧚 图标选择器插入 FA 动效图标）。</div>
        ${area('text','栏内容（支持宏 + HTML）')}
        <div class="row2">
          <div><label>文字颜色</label><input type="color" data-bkey="${i}.color" value="${esc(b.color||'#87CEEB')}"></div>
          <div><label>字号 (px)</label><input type="number" data-bkey="${i}.size" value="${+b.size||15}" min="10" max="28"></div>
        </div>
        <div class="row2">
          <div><label>对齐</label><select data-bkey="${i}.align">
            <option value="center"${b.align==='center'?' selected':''}>居中</option>
            <option value="left"${b.align==='left'?' selected':''}>左对齐</option>
          </select></div>
          <div style="display:flex;align-items:end;padding-bottom:4px"><label class="inline-check"><input type="checkbox" data-bchk="${i}.glow" ${b.glow?'checked':''}>辉光效果</label></div>
        </div>`;
      break;
    case 'randomevent':{
      const presets=BLOCK_PRESETS.randomevent||[];
      /* 行内容导出不转义（允许富文本），与自由 HTML 同属自伤型风险，含脚本时提示 */
      const evScript=/<script/i.test(b.lines||'');
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 每行一条随机内容。「整组随机」导出时自动包装为酒馆的 <code>{{random::…}}</code> 宏——玩家每次打开/刷新开场白都会看到不同内容，营造「活」的世感。行内也可自己写宏。<br>⚠️ 行内避免使用 <code>::</code>（双冒号），导出会自动替换为兼容字符。</div>
        ${evScript?`<div style="font-size:11px;color:var(--err);margin:2px 0">⚠️ 行内容含脚本：预览与酒馆导出中以完整权限运行（与页面同源，可访问本地数据），勿粘贴不可信来源的代码</div>`:''}
        ${chk('showTitle','显示标题')}${b.showTitle?bind('title','标题'):''}
        ${presets.length?`<div style="margin:6px 0"><label>📋 套用预设</label><select data-gpreset="randomevent"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
        ${area('lines','随机内容（每行一条）')}
        <div><label>抽取模式</label><select data-bkey="${i}.pickMode">
          <option value="one"${b.pickMode==='one'||b.pickMode!=='line'&&b.pickMode!=='shuffle'?' selected':''}>整组随机：每次只显示其中一行（推荐做氛围/事件）</option>
          <option value="line"${b.pickMode==='line'?' selected':''}>全部显示：所有行都渲染（各行内的宏独立随机）</option>
          <option value="shuffle"${b.pickMode==='shuffle'?' selected':''}>全部随机排序：预览时打乱顺序（导出为固定顺序，酒馆宏无法整组乱序）</option>
        </select></div>`;
      break;
    }
    case 'dice':{
      const presets=BLOCK_PRESETS.dice||[];
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 导出为酒馆 <code>{{roll::表达式}}</code> 宏，骰子语法：<code>1d20</code>、<code>2d6+3</code>、<code>d100</code>。预览中点「↻ 刷新」可重掷。</div>
        ${presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="dice"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
        ${bind('label','判定名称')}
        ${bind('expr','骰子表达式','text','placeholder="1d20"')}
        <div><label>样式</label><select data-bkey="${i}.style">
          <option value="card"${b.style!=='plain'&&b.style!=='poker'&&b.style!=='rpg'?' selected':''}>卡片式（大数字展示）</option>
          <option value="plain"${b.style==='plain'?' selected':''}>胶囊式（紧凑小标签）</option>
          <option value="poker"${b.style==='poker'?' selected':''}>扑克牌（竖向卡片）</option>
          <option value="rpg"${b.style==='rpg'?' selected':''}>RPG 风（深色面板）</option>
        </select></div>`;
      break;
    }
    case 'countdown':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 实时倒计时：导出后按<strong>访问者设备的本地时间</strong>每秒刷新；目标时间已过则显示完成文案。</div>
        ${bind('title','标题（可选）')}
        <div class="row2">
          <div><label>目标时间</label><input type="datetime-local" data-bkey="${i}.target" value="${esc(b.target||'')}"></div>
          <div><label>完成文案</label><input data-bkey="${i}.doneText" value="${esc(b.doneText||'')}" placeholder="时间到！"></div>
        </div>`;
      break;
    case 'timeline':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 每行一个节点，格式：<code>标题|描述|状态</code>。状态：<code>done</code> 已完成（金色实心）、<code>current</code> 进行中（呼吸辉光）、<code>lock</code> 未解锁（半透明，默认）。</div>
        <div class="row2">${chk('showTitle','显示标题')}${b.showTitle?bind('title','标题'):'<div></div>'}</div>
        ${area('nodes','节点列表（每行一条）')}`;
      break;
    case 'freehtml':
      /* 完整权限运行风险常驻提示（v1.29，硬约束 9）：无脚本时也提示「粘贴脚本后将以完整权限运行」——
         防用户先存干净内容、后被替换成恶意代码的场景（自伤型风险：与酒馆真实环境一致） */
      const hasScript=/<script/i.test(b.html||'');
      html=`<div><label>自由 HTML（支持宏；可用 AI 助手生成）</label></div>
        ${hasScript
          ?`<div style="font-size:11px;color:var(--err);margin:2px 0">⚠️ 内容含脚本：预览与酒馆导出中以完整权限运行（与页面同源，可访问本地数据），勿粘贴不可信来源的代码</div>`
          :`<div style="font-size:11px;color:var(--txt2);margin:2px 0">⚠️ 粘贴含脚本的代码后，预览与酒馆导出中将以完整权限运行（与页面同源，可访问本地数据）——勿粘贴不可信来源的代码</div>`}
        <div><textarea data-bkey="${i}.html" data-freehtml="${i}" style="min-height:140px;font-family:Consolas,monospace" placeholder="<div>自定义内容…</div>">${esc(b.html)}</textarea></div>
        <div style="margin-top:8px"><label>🧺 组件库（${COMP_LIB.length} 个，分类 + 搜索）</label>
          <button type="button" class="btn ghost small" data-compopen="1" style="width:100%;margin-top:4px">🧩 打开组件库选择器</button>
        </div>`;
      container.addEventListener('click',e=>{
        if(e.target.dataset.compopen!==undefined){openCompPicker(b,container,i);return}
      });
      break;
    case 'bgm':{
      if(!Array.isArray(b.tracks))b.tracks=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 音频播放器，支持 MP3 格式。🔁 亮起=循环播放当前曲目，暗色=播完自动切下一首。</div>
          ${bind('title','播放器标题')}
          <div class="row2">
            <div><label>音量 (0-100)</label><input type="number" min="0" max="100" data-bkey="${i}.volume" value="${+b.volume===0?0:(+b.volume||50)}"></div>
            <div><label>循环播放</label> <input type="checkbox" data-bchk="${i}.loop"${b.loop?' checked':''}></div>
          </div>
          <div><label>显示标题</label> <input type="checkbox" data-bchk="${i}.showTitle"${b.showTitle?' checked':''}></div>
          <div style="margin-top:8px"><label>曲目列表</label></div>`;
        b.tracks.forEach((t,ti)=>{
          h+=`<div style="display:grid;grid-template-columns:120px 1fr 30px;gap:6px;margin:4px 0;align-items:center">
            <input data-bf="${ti}.name" value="${esc(t.name)}" placeholder="曲名">
            <input data-bf="${ti}.url" value="${esc(t.url)}" placeholder="音频 URL">
            <button type="button" data-btdel="${ti}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-btadd="1" style="margin-top:6px">＋ 添加曲目</button>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,b.tracks,{
        delAttr:'btdel',addAttr:'btadd',fieldAttr:'bf',build,
        confirmMsg:'删除该曲目？',
        createItem:()=>({name:'',url:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'fx':{
      const effects=[['meteor','流星'],['bubble','气泡'],['note','音符'],['ember','余烬'],['fog','雾气'],['snow','雪花'],['firefly','萤火'],['petal','花瓣'],['star','星尘'],['rain','雨滴']];
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 粒子动效背景，自动遵循系统「减少动效」偏好设置。</div>
        <div><label>动效类型</label><select data-bkey="${i}.effect">
          ${effects.map(([k,v])=>`<option value="${k}"${b.effect===k?' selected':''}>${v}</option>`).join('')}
        </select></div>
        <div class="row2">
          <div><label>粒子数量 (5-100)</label><input type="number" min="5" max="100" data-bkey="${i}.count" value="${+b.count||30}"></div>
          <div><label>速度 (0.2-3)</label><input type="number" min="0.2" max="3" step="0.1" data-bkey="${i}.speed" value="${+b.speed||1}"></div>
        </div>
        <div><label>透明度 (0.1-1)</label><input type="number" min="0.1" max="1" step="0.1" data-bkey="${i}.opacity" value="${+b.opacity||0.8}"></div>`;
      break;
    }
    case 'qa':{
      if(!Array.isArray(b.groups))b.groups=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 问答折叠区：分组展示 Q&A，点击展开/收起，支持展开动画。默认全部折叠。</div>`;
        h+=`<div class="row2">${bind('title','区块标题')}${chk('showTitle','显示标题')}</div>`;
        h+=`<div style="margin-top:8px"><label>分组与问答</label></div>`;
        b.groups.forEach((grp,gi)=>{
          h+=`<div style="border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin:8px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <input data-qgf="${gi}.name" value="${esc(grp.name||'')}" placeholder="分组标题（可选）" style="flex:1">
              <span style="font-size:11px;color:var(--txt2)">组 #${gi+1}</span>
              <button type="button" class="btn danger small" data-qgdel="${gi}">删除组</button>
            </div>`;
          (Array.isArray(grp.items)?grp.items:[]).forEach((item,ii)=>{
            h+=`<div style="display:grid;grid-template-columns:1fr 1fr 30px;gap:6px;margin:4px 0;align-items:start">
              <input data-qif="${gi}.${ii}.q" value="${esc(item.q||'')}" placeholder="问题">
              <input data-qif="${gi}.${ii}.a" value="${esc(item.a||'')}" placeholder="回答">
              <button type="button" data-qidel="${gi}.${ii}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
          });
          h+=`<button type="button" class="btn ghost small" data-qiadd="${gi}" style="margin-top:4px">＋ 添加问答</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-qgadd="1" style="margin-top:4px">＋ 添加分组</button>`;
        container.innerHTML=h;
      };
      build();
      container.addEventListener('click',async e=>{
        if(e.target.dataset.qgadd){
          b.groups.push({name:'',items:[{q:'',a:''}]});build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qgdel!==undefined){
          b.groups.splice(+e.target.dataset.qgdel,1);build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qiadd!==undefined){
          const gi=+e.target.dataset.qiadd;
          if(!Array.isArray(b.groups[gi].items))b.groups[gi].items=[];
          b.groups[gi].items.push({q:'',a:''});build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qidel){
          const[gi,ii]=e.target.dataset.qidel.split('.');
          b.groups[+gi].items.splice(+ii,1);build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
      });
      container.addEventListener('input',e=>{
        const gf=e.target.dataset.qgf;
        if(gf!==undefined){const[gi,k]=gf.split('.');b.groups[+gi][k]=e.target.value;UI.debouncedPreview();Project.saveDebounced()}
        const qif=e.target.dataset.qif;
        if(qif!==undefined){const[gi,ii,k]=qif.split('.');b.groups[+gi].items[+ii][k]=e.target.value;UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'changelog':
      html=`<div class="row2">${chk('showTitle','显示标题')}${bind('title','标题文字')}</div>
        ${area('lines','日志列表（每行：版本｜日期｜内容，支持宏；可多段并入内容）')}`;
      break;
    case 'gate':{
      const presets=BLOCK_PRESETS.gate||[];
      /* 六主题：未知 theme 值（旧工程/手改 JSON）一律回落 classic，与 gen 渲染分支一致 */
      const gt=['curtain','seal','vault','scan','age'].includes(b.theme)?b.theme:'classic';
      const hasLogo=['age','curtain','vault','scan'].includes(gt);
      const TIP={
        classic:'📌 经典幕布：全屏封面先盖住页面，点击按钮后整体淡出揭开（纯 CSS 零脚本）。适合悬疑/仪式感开场。',
        curtain:'🎭 剧场帷幕：丝绒双开幕布 + 顶部帷幔与场次小字，点击后左右拉开揭开（纯 CSS 零脚本）。适合舞台/演出/剧场开场。',
        seal:'🔮 封印法阵：符文法阵慢转环绕，点击后封印扩散消散揭开（纯 CSS 零脚本）。适合奇幻/魔法/契约开场。',
        vault:'🏦 机密金库：钢板铆钉门 + 四辐转轮与钢印编号，点击后转轮旋开、整扇门升起揭开（纯 CSS 零脚本）。适合废土/蒸汽/谍战开场。',
        scan:'🧬 生物识别：指纹弧 + 扫描线往复，验证通过后封面淡出（纯 CSS 零脚本）。适合赛博/科幻开场。',
        age:'🔞 年龄验证闸门：18+ 审查站样式，双按钮——「进入」纯 CSS 揭开，「离开」经酒馆助手 /closechat 退出（无 API 时弹提示），切换聊天自动重新盖上。'
      };
      const LB={
        classic:['封面标题（支持宏）','封面引言（支持宏）','按钮文字'],
        curtain:['幕布标题（支持宏）','幕间引言（支持宏）','拉开按钮文字'],
        seal:['封印标题（支持宏）','封印引言（支持宏）','解印按钮文字'],
        vault:['库门标题（支持宏）','库门引言（支持宏）','转轮按钮文字'],
        scan:['扫描标题（支持宏）','扫描说明（支持宏）','验证按钮文字'],
        age:['验证标题（支持宏）','说明文字（支持宏）','进入按钮文字']
      }[gt];
      const LOGO_LB={age:'标识行文字（支持宏）',curtain:'场次标识（支持宏）',vault:'钢印编号（支持宏）',scan:'系统标识（支持宏）'}[gt]||'标识文字（支持宏）';
      html=(presets.length?`<div style="margin:0 0 8px"><label>✨ 主题预设</label><select data-gpreset="gate"><option value="">选择预设模板…</option>${presets.map((pb,pi)=>`<option value="${pi}">${esc(pb.name)}</option>`).join('')}</select></div>`:'')
        +`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">${esc(TIP[gt]||TIP.classic)}</div>
        <div><label>闸门主题</label><select data-bkey="${i}.theme">
          <option value="classic"${gt==='classic'?' selected':''}>经典幕布（纯 CSS 单按钮）</option>
          <option value="curtain"${gt==='curtain'?' selected':''}>剧场帷幕（双开拉开）</option>
          <option value="seal"${gt==='seal'?' selected':''}>封印法阵（符文消散）</option>
          <option value="vault"${gt==='vault'?' selected':''}>机密金库（转轮开启）</option>
          <option value="scan"${gt==='scan'?' selected':''}>生物识别（扫描验证）</option>
          <option value="age"${gt==='age'?' selected':''}>年龄验证（18+ 双按钮）</option>
        </select></div>
        ${bind('title',LB[0])}
        ${area('text',LB[1])}
        ${bind('buttonText',LB[2])}
        ${(gt==='age'?bind('leaveText','离开按钮文字'):'')+(hasLogo?bind('logo',LOGO_LB):'')}`;
      break;
    }
    case 'decode':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 文本先以乱码呈现再逐字解码成正文（赛博/悬疑/克苏鲁向）。跟随主题「动效档位」与系统减少动效偏好。</div>
        ${area('lines','解码文本（每行一条，行间错峰解码，支持宏）')}`;
      break;
    case 'gacha':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 翻牌抽取：点击卡牌随机翻开一张，可反复抽。稀有度 SSR/SR/R/N（大小写不敏感）对应金/紫/蓝/灰辉光，其他值回落灰色。</div>
        <div class="row2">${bind('title','池子标题')}${bind('buttonText','卡背按钮文字')}</div>
        ${area('cards','卡池列表（每行：稀有度｜名称｜描述）')}`;
      break;
    case 'egg':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 隐藏彩蛋：快速点击诱饵文字达指定次数，随机揭示一条角色碎碎念（支持宏），之后每次点击轮换台词。</div>
        <div class="row2">${bind('hint','诱饵文字')}<div><label>触发次数 (2-20)</label><input type="number" min="2" max="20" data-bkey="${i}.count" value="${+b.count||5}"></div></div>
        ${area('lines','隐藏台词（每行一条，随机揭示）')}`;
      break;
    case 'blurreveal':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 逐段模糊揭示：每行一段，未点击的段以毛玻璃模糊+遮罩盖住，点击该段揭开（纯客户端交互，无需酒馆 API）。适合防剧透剧情、逐步解密文本。</div>
        <div class="row2">${chk('showTitle','显示标题')}${bind('title','标题文字')}</div>
        ${bind('hint','遮罩提示文字（每段遮罩上居中显示）')}
        ${area('lines','揭示文本（每行一段，支持宏）')}`;
      break;
    case 'comic':{
      if(!Array.isArray(b.pages))b.pages=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 点击封面/横幅打开全屏阅读器（✕ 或 Esc 关闭，翻页模式支持键盘 ←→）。图片用图床直链即可；页数多时用「批量导入」一次粘贴全部 URL。</div>
          <div class="row2">
            <div><label>入口形态</label><select data-bkey="${i}.entry">
              <option value="cover"${b.entry!=='banner'?' selected':''}>封面卡片（留空封面自动回落横幅）</option>
              <option value="banner"${b.entry==='banner'?' selected':''}>横幅按钮</option>
            </select></div>
            <div><label>阅读模式</label><select data-bkey="${i}.mode">
              <option value="strip"${b.mode!=='paged'?' selected':''}>条漫 · 上下滚动</option>
              <option value="paged"${b.mode==='paged'?' selected':''}>翻页 · 左右切换</option>
            </select></div>
          </div>
          ${bind('title','标题（封面书腰与阅读器顶栏显示，支持宏）')}
          ${bind('cover','封面图 URL（入口为封面卡片时显示）')}
          ${bind('buttonText','横幅按钮文字')}`;
        b.pages.forEach((pg,pi)=>{
          h+=`<div style="display:grid;grid-template-columns:26px 1fr 110px 30px;gap:6px;margin:4px 0;align-items:center">
            <span style="font-size:11px;color:var(--txt2);text-align:center">${pi+1}</span>
            <input data-cmf="${pi}.url" value="${esc(pg.url)}" placeholder="第 ${pi+1} 页图片 URL https://...">
            <input data-cmf="${pi}.cap" value="${esc(pg.cap??'')}" placeholder="说明(可选)">
            <button type="button" data-cmdel="${pi}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
        });
        h+=`<div style="display:flex;gap:6px;align-items:center;margin-top:6px"><button type="button" class="btn ghost small" data-cmadd="1">＋ 添加一页</button>${b.pages.some(pg=>pg.url)?`<button type="button" class="btn danger small" data-cmclear="1">🗑 清空全部页面</button>`:''}<span style="flex:1"></span>${b.pages.length?`<span style="font-size:11px;color:var(--txt2)">共 ${b.pages.length} 页</span>`:''}</div>
          <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--acc)">📋 批量导入（每行一个 URL，一次生成全部页）</summary>
          <textarea data-cmimp placeholder="每行一个图片 URL 按页序粘贴；行内可用 | 追加该页说明" style="margin-top:6px"></textarea>
          <button type="button" class="btn small" data-cmimprun="1" style="margin-top:6px">解析并替换全部页</button>
          <div style="font-size:11px;color:var(--txt2);margin-top:4px">现有页会被覆盖（先弹确认）。</div></details>`;
        container.innerHTML=h;
        /* 批量导入：局部监听挂在本次 build 新建的按钮上（container 每次重建，无重复绑定） */
        const run=container.querySelector('[data-cmimprun]');
        if(run)run.addEventListener('click',async()=>{
          const ta=container.querySelector('[data-cmimp]');
          const lines=String(ta?ta.value:'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
          if(!lines.length){toast('请先粘贴图片 URL（每行一个）');return}
          if(b.pages.some(pg=>pg.url)&&!await confirmModal(`批量导入将覆盖现有的 ${b.pages.length} 页，确定？`))return;
          b.pages=lines.map(l=>{const[v,c]=l.split('|');return{url:v.trim(),cap:(c||'').trim()}});
          build();
          UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
          toast('已导入 '+b.pages.length+' 页');
        });
        /* 一键清空：删除导入的漫画页（封面/标题保留），可 Ctrl+Z 撤销 */
        const clear=container.querySelector('[data-cmclear]');
        if(clear)clear.addEventListener('click',async()=>{
          const n=b.pages.filter(pg=>pg.url).length;
          if(!n){toast('没有可清空的页面');return}
          if(!await confirmModal(`确定清空全部 ${n} 页漫画？封面与标题保留（Ctrl+Z 可撤销）。`))return;
          Project.saveSnapshot();
          b.pages=[];
          build();
          UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
          toast('已清空 '+n+' 页');
        });
      };
      build();
      bindListEditor(container,b.pages,{
        delAttr:'cmdel',addAttr:'cmadd',fieldAttr:'cmf',build,
        confirmMsg:'删除该页？',
        createItem:()=>({url:'',cap:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
  }
  if(html)container.innerHTML=html;
  /* 预设模板下拉框 */
  container.addEventListener('change',e=>{
    const gp=e.target.dataset.gpreset;
    if(gp===undefined||!BLOCK_PRESETS[gp])return;
    const pi=+e.target.value;
    if(isNaN(pi)||!BLOCK_PRESETS[gp][pi])return;
    const preset=BLOCK_PRESETS[gp][pi];
    applyBlockPreset(Project.cur.blocks[i],preset.data);
    UI.renderConfig();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
    toast('已套用预设：'+preset.name);
  });
  container.addEventListener('input',e=>{
    const bk=e.target.dataset.bkey;
    if(bk!==undefined){
      const[a,c]=bk.split('.');
      /* number 型输入按数值入库（合法 0 保留），避免下游直接比较时踩字符串坑 */
      const v=e.target.type==='number'?(e.target.value!==''&&Number.isFinite(+e.target.value)?+e.target.value:e.target.value):e.target.value;
      Project.cur.blocks[+a][c]=v;
      /* theme 切换会改变 gate 等区块的字段集：先同步闸门文案（模板值随主题换、自定义保留）再重渲染编辑器 */
      if(c==='theme'){
        const blk=Project.cur.blocks[+a];
        if(blk.type==='gate')syncGateThemeCopy(blk);
        UI.renderConfig();
      }
      this.debouncedPreview();Project.saveDebounced();
    }
  });
  container.addEventListener('change',e=>{
    const bc=e.target.dataset.bchk;
    if(bc!==undefined){const[a,c]=bc.split('.');Project.cur.blocks[+a][c]=e.target.checked;this.debouncedPreview();Project.saveDebounced();if(c==='showTitle')UI.renderConfig()}
  });
}

/* ---------- 组件库：插入 + 弹窗选择器（分类/搜索/网格） ---------- */
let compPickerCtx=null;
function insertComp(b,blockIdx,c){
  const cHtml=c.html+'\n';
  const ta=document.querySelector('[data-freehtml="'+blockIdx+'"]'); /* 实时查活 textarea（编辑器可能已重渲染） */
  if(ta){
    const focusIn=ta===document.activeElement;
    const pos=focusIn&&ta.selectionStart!=null?ta.selectionStart:(ta.value.trim()?ta.value.replace(/\s*$/,'').length:0);
    const before=ta.value.slice(0,pos);
    const after=ta.value.slice(pos);
    const glue=before.trim()?before.replace(/\s*$/,'')+'\n\n':'';
    const tail=after.trim()?(after.startsWith("\n")?after:'\n'+after):'';
    b.html=glue+cHtml+tail;
    ta.value=b.html;
    try{const p2=(glue+cHtml).length;ta.setSelectionRange(p2,p2)}catch(e){}
  }else{
    b.html=(b.html&&b.html.trim()?b.html.replace(/\s*$/,'')+'\n\n':'')+cHtml;
    UI.renderConfig(); /* 编辑器不在 DOM（被重渲染过）：重渲染配置页以反映新内容 */
  }
  UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
  toast('已插入组件：'+c.name);
}
function openCompPicker(b,container,blockIdx){
  compPickerCtx={b,blockIdx};
  const ov=document.createElement('div');
  /* opg-ov：自绘弹层统一标记（core.js 的 Ctrl+Z/Esc 守卫借此识别「有弹层打开」） */
  ov.className='opg-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');
  box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;width:min(720px,94vw);max-height:84vh;display:flex;flex-direction:column';
  const grid=(kw,cat)=>{
    const list=COMP_LIB.map((c,i)=>({c,i})).filter(x=>(cat==='all'||x.c.cat===cat)&&(!kw||x.c.name.toLowerCase().includes(kw)));
    if(!list.length)return '<div style="color:var(--txt2);font-size:12px;padding:20px;text-align:center">无匹配组件</div>';
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">'+list.map(x=>
      '<button type="button" data-ci="'+x.i+'" class="btn ghost small" style="text-align:left;padding:10px;white-space:normal;line-height:1.5">'+x.c.icon+' <b>'+x.c.name+'</b></button>').join('')+'</div>';
  };
  box.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">'+
      '<strong style="font-family:var(--font-serif);font-size:14px">🧺 组件库 · '+COMP_LIB.length+' 个</strong>'+
      '<span id="cpInserted" style="font-size:11px;color:var(--txt2)"></span>'+
      '<input id="cpKw" placeholder="🔍 搜索组件名…" style="flex:1;min-width:160px;max-width:240px">'+
      '<button type="button" class="btn ghost small" data-close>✕ 完成并关闭</button>'+
    '</div>'+
    '<div id="cpCats" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'+COMP_CATS.map((c,i)=>'<button type="button" class="btn '+(i===0?'small':'ghost small')+'" data-cat="'+c[0]+'">'+c[1]+'</button>').join('')+'</div>'+
    '<div id="cpGrid" style="overflow:auto;flex:1;min-height:200px">'+grid('','all')+'</div>';
  ov.appendChild(box);document.body.appendChild(ov);
  let curCat='all';let insertedN=0;
  const kw=box.querySelector('#cpKw'),g=box.querySelector('#cpGrid'),badge=box.querySelector('#cpInserted');
  const refresh=()=>{g.innerHTML=grid(kw.value.trim().toLowerCase(),curCat)};
  kw.addEventListener('input',refresh);
  box.querySelector('#cpCats').addEventListener('click',e=>{
    const cat=e.target.dataset.cat;
    if(cat===undefined)return;
    curCat=cat;
    box.querySelectorAll('#cpCats .btn').forEach(x=>x.className=x.dataset.cat===cat?'btn small':'btn ghost small');
    refresh();
  });
  g.addEventListener('click',e=>{
    /* closest：组件名是 <b> 子元素，点中它时 e.target.dataset.ci 为 undefined */
    const btn=e.target.closest('[data-ci]');
    if(!btn)return;
    const ci=btn.dataset.ci;
    insertComp(b,blockIdx,COMP_LIB[+ci]);
    insertedN++;
    badge.textContent='✓ 已插入 '+insertedN+' 个组件（继续点击可追加，✕ 完成关闭）';
    badge.style.color='var(--ok,#6a9b7e)';
    toast('已插入组件：'+COMP_LIB[+ci].name);
  });
  box.addEventListener('keydown',e=>{if(e.key==='Escape')ov.remove()});
  box.querySelector('[data-close]').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove()});
  setTimeout(()=>{kw.focus();box.tabIndex=-1;box.focus({preventScroll:true})},50);
}

/* 标题库草稿 → 酒馆世界书（v1.30，需酒馆环境；真机验证待办）：整份草稿写入一个专用条目
   （content 每行「序号|标题|描述」，与运行时 loadTitleMap 对齐）；已存在同名条目先删后建，
   不动书内其它条目。世界书不存在则自动创建。position 默认 before_character_definition，
   可选 outlet（酒馆新插入位，4.8.1+ 兼容）。API 全走 window.* 守卫 + Promise 兼容。 */
function openTitlebookWriter(b){
  const APIS=['createWorldbook','getWorldbookNames','deleteWorldbookEntries','createWorldbookEntries'];
  if(!APIS.every(n=>typeof window[n]==='function')){toast('未检测到酒馆助手世界书 API——请在酒馆内打开本工具');return}
  const lines=(b.titleBookDraft||'').split('\n').filter(Boolean).length;
  if(!lines){toast('标题库草稿为空');return}
  const defWb=b.titleWb||('开场页标题库-'+((Project.cur&&Project.cur.name)||''));
  const ov=document.createElement('div');
  ov.className='opg-ov'; /* 自绘弹层统一标记（PITFALLS 26）：Ctrl+Z/Esc 守卫识别 */
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');
  box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(460px,92vw);max-height:80vh;overflow:auto';
  box.innerHTML=`<div style="font-weight:700;margin-bottom:8px">📤 标题库写入世界书</div>
    <div style="font-size:12px;color:var(--txt2);margin-bottom:8px">将 ${lines} 条草稿写入一个专用条目（整条 content，运行时按行解析「序号|标题|描述」）。已存在同名条目会先删除再创建，不影响书内其它条目。</div>
    <div><label>世界书名（不存在将自动创建）</label><input id="twbName" value="${esc(defWb)}"></div>
    <div><label>条目名 (comment/name)</label><input id="twbEntry" value="${esc(b.titleEntry||'开场白标题库')}"></div>
    <label class="inline-check" style="margin:8px 0"><input type="checkbox" id="twbOutlet">插入到锚点 (Outlet)——仅新版酒馆支持，默认插入角色定义之前</label>
    <div id="twbMsg" style="font-size:12px;min-height:16px"></div>
    <div style="text-align:right;margin-top:10px"><button type="button" class="btn ghost small" data-close>取消</button> <button type="button" class="btn small" data-go>📤 写入</button></div>`;
  ov.appendChild(box);document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.dataset.close!==undefined)ov.remove()});
  box.querySelector('[data-go]').onclick=async()=>{
    const wb=box.querySelector('#twbName').value.trim()||defWb;
    const entryName=box.querySelector('#twbEntry').value.trim()||'开场白标题库';
    const outlet=box.querySelector('#twbOutlet').checked;
    const msg=box.querySelector('#twbMsg');
    msg.style.color='var(--txt2)';msg.textContent='⏳ 写入中…';
    const entry={name:entryName,content:b.titleBookDraft,enabled:true,position:{type:outlet?'outlet':'before_character_definition'}};
    try{
      const names=await Promise.resolve(window.getWorldbookNames());
      if(!(names||[]).includes(wb)){
        const ok=await Promise.resolve(window.createWorldbook(wb,[entry]));
        if(ok===false)throw new Error('创建世界书失败');
      }else{
        /* 已有书：先删同名条目再建，保留书内其它条目（delete+create 两步，避免整本替换的误伤面） */
        await Promise.resolve(window.deleteWorldbookEntries(wb,e=>e.name===entryName));
        await Promise.resolve(window.createWorldbookEntries(wb,[entry]));
      }
      b.titleWb=wb;b.titleEntry=entryName;
      Project.save();
      ov.remove();
      toast('标题库已写入「'+wb+'」/「'+entryName+'」——进对话验证开场白标题是否生效');
    }catch(err){
      msg.style.color='var(--err)';msg.textContent='❌ 写入失败：'+(err&&err.message||err);
    }
  };
}
