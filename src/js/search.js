/* 全局搜索替换 + 深层路径赋值：纯函数（可测），UI 层只负责弹窗/DOM/渲染 */
export const TEXT_FIELDS=['title','subtitle','text','html','lines','desc','source','label','expr','placeholderList','buttonText','titleEntry','titleWb','name','cap','url','nodes','target','doneText','patternText'];

/* 按 "a.b.c" 点号路径给嵌套对象赋值（返回 root）。缺失的中间节点会报错——用于样式统筹 style.xxx 两层路径 */
export function setDeep(root,path,val){
  const keys=String(path).split('.');
  let obj=root;
  while(keys.length>1)obj=obj[keys.shift()];
  obj[keys[0]]=val;
  return root;
}

/* 收集全部匹配：遍历区块及其子项 + 状态栏字段，返回 {blockIdx,path,field,subIdx,subField,parent?,sbIdx?}[] */
export function collectSearchMatches(blocks,sbCfg,kw){
  const matches=[];
  const lkw=String(kw||'').trim().toLowerCase();
  if(!lkw)return matches;
  blocks.forEach((b,bi)=>{
    TEXT_FIELDS.forEach(k=>{
      if(typeof b[k]==='string'&&b[k].toLowerCase().includes(lkw))
        matches.push({blockIdx:bi,path:`区块 #${bi+1}`,field:k,subIdx:-1,subField:k});
    });
    if(Array.isArray(b.characters))b.characters.forEach((ch,ci)=>{
      ['name','desc','tags','avatar'].forEach(k=>{
        if(typeof ch[k]==='string'&&ch[k].toLowerCase().includes(lkw))
          matches.push({blockIdx:bi,path:`区块 #${bi+1} → 角色 ${ci+1}`,field:k,subIdx:ci,subField:k,parent:'characters'});
      });
    });
    if(Array.isArray(b.images))b.images.forEach((im,ii)=>{
      ['url','cap'].forEach(k=>{
        if(typeof im[k]==='string'&&im[k].toLowerCase().includes(lkw))
          matches.push({blockIdx:bi,path:`区块 #${bi+1} → 图片 ${ii+1}`,field:k,subIdx:ii,subField:k,parent:'images'});
      });
    });
    if(Array.isArray(b.tracks))b.tracks.forEach((tr,ti)=>{
      ['name','url'].forEach(k=>{
        if(typeof tr[k]==='string'&&tr[k].toLowerCase().includes(lkw))
          matches.push({blockIdx:bi,path:`区块 #${bi+1} → 曲目 ${ti+1}`,field:k,subIdx:ti,subField:k,parent:'tracks'});
      });
    });
    if(Array.isArray(b.groups))b.groups.forEach((grp,gi)=>{
      if(typeof grp.name==='string'&&grp.name.toLowerCase().includes(lkw))
        matches.push({blockIdx:bi,path:`区块 #${bi+1} → QA组 ${gi+1}`,field:'name',subIdx:gi,subField:'name',parent:'groups'});
      (Array.isArray(grp.items)?grp.items:[]).forEach((item,ii)=>{
        ['q','a'].forEach(k=>{
          if(typeof item[k]==='string'&&item[k].toLowerCase().includes(lkw))
            matches.push({blockIdx:bi,path:`区块 #${bi+1} → QA组 ${gi+1} #${ii+1}`,field:k,subIdx:`${gi}.${ii}`,subField:k,parent:'groups.items'});
        });
      });
    });
  });
  /* 状态栏字段：name/sample/hint */
  if(sbCfg&&Array.isArray(sbCfg.fields))sbCfg.fields.forEach((f,fi)=>{
    ['name','sample','hint'].forEach(k=>{
      if(typeof f[k]==='string'&&f[k].toLowerCase().includes(lkw))
        matches.push({blockIdx:-1,path:`状态栏 → 字段 ${fi+1} → ${f.name}`,field:k,subIdx:-1,subField:k,parent:'statusbar',sbIdx:fi});
    });
  });
  return matches;
}

/* 字符串替换（转义正则元字符；$& 等不作替换模式展开） */
export function replaceAllInString(str,kw,repl){
  if(typeof str!=='string')return str;
  const esc=kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return str.replace(new RegExp(esc,'gi'),()=>repl);
}

/* 工程内全局替换全部文本字段，返回替换次数 */
export function replaceAllInProject(project,kw,repl){
  if(!project)return 0;
  let count=0;
  const doReplace=(str)=>{
    if(typeof str!=='string')return str;
    const out=replaceAllInString(str,kw,repl);
    if(out!==str)count+=(str.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
    return out;
  };
  project.blocks.forEach(b=>{
    TEXT_FIELDS.forEach(k=>{if(typeof b[k]==='string')b[k]=doReplace(b[k])});
    if(Array.isArray(b.characters))b.characters.forEach(ch=>{
      ['name','desc','tags','avatar'].forEach(k=>{if(typeof ch[k]==='string')ch[k]=doReplace(ch[k])});
    });
    if(Array.isArray(b.images))b.images.forEach(im=>{
      ['url','cap'].forEach(k=>{if(typeof im[k]==='string')im[k]=doReplace(im[k])});
    });
    if(Array.isArray(b.tracks))b.tracks.forEach(tr=>{
      ['name','url'].forEach(k=>{if(typeof tr[k]==='string')tr[k]=doReplace(tr[k])});
    });
    if(Array.isArray(b.groups))b.groups.forEach(grp=>{
      if(typeof grp.name==='string')grp.name=doReplace(grp.name);
      (Array.isArray(grp.items)?grp.items:[]).forEach(item=>{
        ['q','a'].forEach(k=>{if(typeof item[k]==='string')item[k]=doReplace(item[k])});
      });
    });
  });
  /* 状态栏字段 */
  const sbCfg=project.statusbar;
  if(sbCfg&&Array.isArray(sbCfg.fields))sbCfg.fields.forEach(f=>{
    ['name','sample','hint'].forEach(k=>{if(typeof f[k]==='string')f[k]=doReplace(f[k])});
  });
  return count;
}
