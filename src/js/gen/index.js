/* 生成引擎入口：组装 CSS / HTML / 脚本，产出可嵌入酒馆的组件代码 */
import { uid } from '../utils.js';
import { css } from './css.js';
import { body } from './body.js';
import { script, lightbox, bgmScript } from './scripts.js';

const Gen={
  /** 容器唯一前缀。同一工程导出的组件共用一个 id */
  prefix(p){return 'opg-'+(p.id||'page')},

  /** 生成完整组件 HTML（含 style + script）。isPreview=true 时使用占位数据并禁用 API
   * @param {import('../project.js').ProjectData} p
   * @param {{isPreview?:boolean}} [opts]
   * @returns {string}
   */
  build(p,{isPreview=false}={}){
    const px=this.prefix(p);
    const blocks=p.blocks.filter(b=>b.enabled);
    const cssStr=css(p,px,blocks);
    const html=body(p,px,blocks,isPreview);
    const js=(isPreview?'':script(p,px))+lightbox(px)+bgmScript(px);
    return `<div id="${px}" class="${px}-root">\n<style>\n${cssStr}\n</style>\n${html}\n${js}\n</div>`;
  },

  /** 完整 HTML 文档（用于正则 replaceString：``` 包裹，由酒馆助手渲染为 iframe） */
  buildFullDoc(p){
    const comp=this.build(p,{isPreview:false});
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>开场页</title>
<style>html,body{margin:0;padding:0;background:transparent}</style>
</head>
<body>
${comp}
</body>
</html>`;
  },

  /** 可直接导入酒馆的正则脚本 JSON（字段结构与 ST 正则扩展一致）
   * @param {import('../project.js').ProjectData} p
   * @returns {{id:string,scriptName:string,findRegex:string,replaceString:string,trimStrings:Array,placement:number[],disabled:boolean,markdownOnly:boolean,promptOnly:boolean,runOnEdit:boolean,substituteRegex:number,minDepth:number|null,maxDepth:number|null}}
   */
  regexScript(p){
    const marker=(p.marker||'【开场页】').trim()||'【开场页】';
    /* / 分隔符也需转义：findRegex 以 /pattern/ 形式交给酒馆，标记含 / 会截断模式 */
    const escRe=marker.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
    return {
      id:uid(),
      scriptName:'开场页-'+p.name,
      findRegex:'/'+escRe+'/',
      replaceString:'```\n'+this.buildFullDoc(p)+'\n```',
      trimStrings:[],
      placement:[2],
      disabled:false,
      markdownOnly:true,
      promptOnly:false,
      runOnEdit:true,
      substituteRegex:0,
      minDepth:null,
      maxDepth:null,
    };
  },
};

export {Gen};
