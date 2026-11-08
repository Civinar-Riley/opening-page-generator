/* OPG headless 生成 CLI：工程 JSON → 自包含开场页 HTML。
   生成逻辑全在 src/js/gen 引擎与 defs/project（纯函数，Node 可跑），本文件只做参数解析与 IO；
   由 scripts/pack-skill.mjs 经 esbuild 打成单文件 opg-gen.mjs 随 skill 分发。
   注意：本 CLI 不内嵌进工具单文件（与助手小包不同），改它无需重新 npm run build。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Project } from '../src/js/project.js';
import { Gen } from '../src/js/gen/index.js';
import { defaultProject, BUILTIN_TEMPLATES, BLOCK_DEFS, BLOCK_ORDER, CORE_TYPES } from '../src/js/defs.js';

const VERSION=typeof __OPG_VERSION__!=='undefined'?__OPG_VERSION__:'dev';

/* 内置宏表（预览由 Macros.apply 替换；CLI 构建一律原样保留交酒馆解析——宏双轨的导出侧） */
const MACRO_DOC=[
  {syntax:'{{char}} / {{user}}',desc:'角色 / 用户名；可被工程 macros 数组覆盖（[{k,v}]）'},
  {syntax:'{{random::a::b::c}}',desc:'随机取一项'},
  {syntax:'{{random_nr::a::b::c}}',desc:'随机取一项，相邻两次不重复'},
  {syntax:'{{pick::a::b}}',desc:'随机取一项（random 别名）'},
  {syntax:'{{roll::1d20}} {{roll::2d6+3}}',desc:'骰子表达式；{{roll::100}} 即 1~100'},
  {syntax:'{{setvar::名::值}} / {{getvar::名}}',desc:'变量赋值 / 取值'},
  {syntax:'{{date}} {{time}} {{isodate}} {{isotime}} {{weekday}}',desc:'日期时间（酒馆解析时取值）'},
];

/** 解析工程 JSON 文本并按工具导入同一套路径补齐（migrate = 背景上收 + 旧字段迁移 + normalize）：
 *  手写/半成品 JSON 缺的区块类型自动补（停用）、缺字段填 create() 默认、未知类型剔除 */
function parseProjectJson(text){
  let p;
  try{p=JSON.parse(text)}catch(e){throw new Error('工程 JSON 解析失败：'+e.message)}
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('工程 JSON 顶层必须是对象（{theme,blocks,…}）');
  Project.migrate(p);
  return p;
}

/** 官方模板 → 完整工程（builtinTemplateProject 补齐 id/时间/ai/preview 后走同一 normalize） */
function resolveTemplate(key){
  const s=String(key??'').trim();
  if(!s)throw new Error('模板名/序号为空——node opg-gen.mjs --list 查看清单');
  const t=/^\d+$/.test(s)?BUILTIN_TEMPLATES[+s]:BUILTIN_TEMPLATES.find(x=>x.name===s)||BUILTIN_TEMPLATES.find(x=>x.name.includes(s));
  if(!t)throw new Error(`找不到官方模板「${key}」——node opg-gen.mjs --list 查看清单`);
  return t;
}
function templateProject(key,name){return Project.builtinTemplateProject(resolveTemplate(key),name)}
function newProjectJson(name){return defaultProject(name||'新工程')}

/** 构建输出：fenced=带 ``` 围栏完整文档（贴酒馆楼层），regex=ST 正则脚本 JSON，默认裸完整文档 */
function buildOut(p,{fenced=false,regex=false}={}){
  if(regex)return JSON.stringify(Gen.regexScript(p),null,2);
  return fenced?Gen.fencedFullDoc(p):Gen.buildFullDoc(p);
}

/** 自检报告（生成引擎的 auditFullDoc + auditCompat，恒跑）：返回 stderr 行数组，空数组 = 无提示 */
function auditReport(p){
  const doc=Gen.buildFullDoc(p);
  return [
    ...Gen.auditCompat(p).items.map(x=>`${x.level}: ${x.msg}`),
    ...Gen.auditFullDoc(doc).problems.map(x=>`${x.level}: ${x.msg}`),
  ];
}

/** 区块类型参考 + 内置宏表（字段真相随引擎打包发出，永远与引擎同版本） */
function schemaDump(){
  return JSON.stringify({
    version:VERSION,
    blockOrder:BLOCK_ORDER,
    coreTypes:CORE_TYPES,
    types:BLOCK_ORDER.map(t=>({type:t,name:BLOCK_DEFS[t].name,icon:BLOCK_DEFS[t].icon,defaults:BLOCK_DEFS[t].create()})),
    macros:MACRO_DOC,
  },null,2);
}

function usage(){
  return [
    'OPG 开场页生成引擎 v'+VERSION+' —— 工程 JSON 进 → 自包含开场页 HTML 出',
    '',
    '  node opg-gen.mjs <工程.json> [选项]   构建 → stdout（参数为 - 时读 stdin）',
    '  node opg-gen.mjs --new [--name 名]    输出默认工程 JSON（全区块骨架）',
    '  node opg-gen.mjs --template <名|序号> [--name 名]   官方模板起步（--list 先看清单）',
    '  node opg-gen.mjs --list               官方模板清单',
    '  node opg-gen.mjs --schema             区块类型字段参考 + 内置宏表',
    '',
    '构建选项：',
    '  -o, --out <file>   写入文件（默认 stdout）',
    '  --fenced           输出带代码围栏的完整文档（贴酒馆 first_mes / 楼层用）',
    '  --regex            输出「标记+正则脚本」JSON（酒馆 扩展→正则 导入）',
    '',
    '构建恒跑产物自检与兼容审查，报告输出到 stderr，不拦截产物。',
  ].join('\n');
}

/** 入口（纯同步，返回退出码；io 参数供测试注入）。未知参数/解析失败 → 退出码 1 + 用法 */
export function main(argv=[],io={}){
  const out=io.out||process.stdout,err=io.err||process.stderr;
  const say=s=>out.write(s+'\n');
  try{
    /* 先全量解析再分发：--name 写在 --template 之后也要生效 */
    const opts={pos:[],out:'',fenced:false,regex:false,name:'',tpl:null,fresh:false};
    for(let i=0;i<argv.length;i++){
      const a=argv[i];
      if(a==='-o'||a==='--out')opts.out=argv[++i]??'';
      else if(a==='--fenced')opts.fenced=true;
      else if(a==='--regex')opts.regex=true;
      else if(a==='--name')opts.name=argv[++i]??'';
      else if(a==='--template')opts.tpl=argv[++i]??'';
      else if(a==='--new')opts.fresh=true;
      else if(a==='--help'||a==='-h'){say(usage());return 0}
      else if(a==='--version'){say('v'+VERSION);return 0}
      else if(a==='--schema'){say(schemaDump());return 0}
      else if(a==='--list'){
        say('官方模板（--template 按序号或名称取用）：');
        BUILTIN_TEMPLATES.forEach((t,i)=>say(`  ${i}. ${t.name}`));
        return 0;
      }
      else if(a.startsWith('-'))throw new Error(`未知参数 ${a}\n\n`+usage());
      else opts.pos.push(a);
    }
    if(opts.fresh&&opts.tpl!==null)throw new Error('--new 与 --template 只能选一个');
    if(opts.fresh||opts.tpl!==null){
      if(opts.pos.length)throw new Error('起步命令（--new / --template）输出工程 JSON，不接收工程文件');
      const p=opts.tpl!==null?templateProject(opts.tpl,opts.name):newProjectJson(opts.name);
      /* 组合 --fenced/--regex 时直接按构建选项输出（此前静默忽略，用户拿不到预期产物） */
      emit(p,(opts.fenced||opts.regex)?buildOut(p,opts):JSON.stringify(p,null,2),opts,io);
      return 0;
    }
    if(!opts.pos.length)throw new Error('缺少工程 JSON 文件（或用 --new / --template 起步）\n\n'+usage());
    const input=opts.pos[0];
    const p=parseProjectJson(input==='-'?readFileSync(0,'utf8'):readFileSync(input,'utf8'));
    emit(p,buildOut(p,opts),opts,io);
    return 0;
  }catch(e){
    err.write('错误：'+e.message+'\n');
    return 1;
  }
}

/** 统一出口：写产物 + 自检报告到 stderr（JSON 起步与构建共用，提示先于编辑出现） */
function emit(p,text,opts,io){
  const out=io.out||process.stdout,err=io.err||process.stderr;
  if(opts.out)writeFileSync(opts.out,text.endsWith('\n')?text:text+'\n');
  else out.write(text.endsWith('\n')?text:text+'\n');
  const report=auditReport(p);
  err.write(report.length?`[OPG 自检] ${report.length} 条提示\n`+report.map(l=>'  '+l).join('\n')+'\n':'[OPG 自检] 通过，无提示\n');
}

/* 直接执行才跑 main（vitest import 与 esbuild bundle 两种来源都安全） */
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isMain)process.exitCode=main(process.argv.slice(2))||0;

export {parseProjectJson,buildOut,auditReport,schemaDump,templateProject,newProjectJson,resolveTemplate,VERSION,MACRO_DOC};
