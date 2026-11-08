/* opg-gen CLI（scripts/opg-gen-cli.mjs）回归：解析补齐 / 构建契约 / 起步命令 / 错误路径。
   源码在 type:commonjs 包内只能由 vitest 或 esbuild 加载（与 src/ 同处境），运行形态是打包产物。 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, parseProjectJson, buildOut, schemaDump, templateProject, newProjectJson, auditReport, VERSION } from '../scripts/opg-gen-cli.mjs';
import { BUILTIN_TEMPLATES } from '../src/js/defs.js';

const stubIO=()=>{const io={outBuf:'',errBuf:''};io.out={write:s=>{io.outBuf+=s}};io.err={write:s=>{io.errBuf+=s}};return io};
const inTmp=s=>{const dir=mkdtempSync(join(tmpdir(),'opgcli-'));const f=join(dir,'proj.json');writeFileSync(f,s);return {dir,file:f}};

describe('opg-gen CLI',()=>{
  it('--schema：25 种区块 + 每种含 name/icon/defaults + 内置宏表',()=>{
    const s=JSON.parse(schemaDump());
    expect(s.blockOrder).toHaveLength(25);
    expect(s.types.every(t=>t.type&&t.name&&t.icon&&t.defaults&&typeof t.defaults==='object')).toBe(true);
    expect(s.macros.length).toBeGreaterThanOrEqual(5);
  });

  it('残缺工程 JSON 自动补齐：缺失类型补停用、缺字段填默认',()=>{
    const p=parseProjectJson('{"name":"测试","blocks":[{"type":"welcome","enabled":true,"title":"你好"}]}');
    expect(p.blocks).toHaveLength(25);
    expect(p.blocks.find(b=>b.type==='welcome').decoStyle).toBe('ornate');
    expect(p.marker).toBe('【开场页】');
    /* 无 decor 区块时 _hoistBg 走旧扁平兜底 solid——手写残缺 JSON 的既定回落路径 */
    expect(p.theme.bg.type).toBe('solid');
  });

  it('默认工程可构建：自检零提示、产物含容器与 body',()=>{
    const p=newProjectJson();
    expect(auditReport(p)).toEqual([]);
    const doc=buildOut(p);
    expect(doc.includes('<!DOCTYPE html>')).toBe(true);
    expect(doc.includes('id="opg-')).toBe(true);
  });

  it('官方模板起步：名称与序号等价、--name 生效、产物带围栏',()=>{
    const byName=templateProject('奇幻酒馆风','测试');
    expect(byName.name).toBe('测试');
    expect(byName.theme.primary).toBe(BUILTIN_TEMPLATES[1].theme.primary);
    expect(templateProject(1).name).toBe(BUILTIN_TEMPLATES[1].name);
    const f=buildOut(templateProject(0),{fenced:true});
    expect(f.startsWith('```')).toBe(true);
    expect(f.includes('<body>')).toBe(true);
  });

  it('--regex 输出酒馆正则脚本 JSON 契约',()=>{
    const r=JSON.parse(buildOut(templateProject(0),{regex:true}));
    expect(r.findRegex.startsWith('/')).toBe(true);
    expect(r.replaceString.includes('<body>')).toBe(true);
    expect(r.scriptName.startsWith('开场页-')).toBe(true);
    expect(r.placement).toEqual([2]);
  });

  it('main e2e：文件进文件出 + 自检报告走 stderr',()=>{
    const {dir,file}=inTmp('{"blocks":[{"type":"welcome","enabled":true,"title":"你好"}]}');
    try{
      const io=stubIO();
      const outFile=join(dir,'out.txt');
      expect(main([file,'--fenced','-o',outFile],io)).toBe(0);
      expect(readFileSync(outFile,'utf8').startsWith('```')).toBe(true);
      expect(io.errBuf).toContain('[OPG 自检]');
      expect(io.outBuf).toBe('');/* -o 模式产物只落文件不进 stdout */
    }finally{rmSync(dir,{recursive:true,force:true})}
  });

  it('main --new / --list / --version：起步输出合法工程 JSON',()=>{
    const io=stubIO();
    expect(main(['--new','--name','X'],io)).toBe(0);
    const p=JSON.parse(io.outBuf);
    expect(p.name).toBe('X');
    expect(p.blocks).toHaveLength(25);
    const io2=stubIO();
    expect(main(['--list'],io2)).toBe(0);
    expect(io2.outBuf).toContain(BUILTIN_TEMPLATES[0].name);
    const io3=stubIO();
    expect(main(['--version'],io3)).toBe(0);
    expect(io3.outBuf.trim()).toBe('v'+VERSION);
  });

  it('main 错误路径：坏文件/坏 JSON/未知参数/参数冲突 → 退出码 1 + stderr',()=>{
    const io=stubIO();
    expect(main(['no-such-file.json'],io)).toBe(1);
    expect(io.errBuf).toContain('错误：');
    const {dir,file}=inTmp('{oops');
    try{
      const io2=stubIO();
      expect(main([file],io2)).toBe(1);
      expect(io2.errBuf).toContain('工程 JSON 解析失败');
    }finally{rmSync(dir,{recursive:true,force:true})}
    const io3=stubIO();
    expect(main(['--frobnicate'],io3)).toBe(1);
    const io4=stubIO();
    expect(main(['--new','--template','0'],io4)).toBe(1);
  });
});
