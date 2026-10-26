/* 「漫画导入助手」小包组装与 ZIP 编码测试（纯函数，不打网络、不落盘）：
   覆盖 CRC-32 标准值、ZIP 结构与可解析性、字节确定性（构建内嵌与 CI 资产同源的前提）、
   文件清单完整性（四件套 + 三 bat + 说明 + package.json）与版本注入。 */
import { describe, it, expect } from 'vitest';
import { crc32, helperFiles, helperUsageText, zipStore, HELPER_DIR, HELPER_SCRIPTS } from '../scripts/helper-pack.mjs';

/* 夹具正文按真实文件的行尾构造：仓库里的 .bat 是 CRLF（Windows cmd 要求），
   其余脚本是 LF——夹具若统一用 LF，会掩盖「拷进来的 bat 行尾不对」这类真实缺陷 */
const SRC = Object.fromEntries(HELPER_SCRIPTS.map(f =>
  [f, f.endsWith('.bat') ? `rem ${f} body\r\n` : `// ${f} body\n`]));

/** 极简 ZIP 解析（只认本模块产出的 store-only 形态）：返回中央目录条目与 EOCD 计数 */
function parseZip(buf) {
  const eocd = buf.length - 22;
  if (buf.readUInt32LE(eocd) !== 0x06054b50) throw new Error('未找到 EOCD');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录签名不符 @' + p);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('本地头签名不符：' + name);
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    entries.push({
      name,
      crc: buf.readUInt32LE(p + 16),
      size: buf.readUInt32LE(p + 24),
      method: buf.readUInt16LE(p + 10),
      utf8: (buf.readUInt16LE(p + 8) & 0x0800) !== 0,
      data: buf.slice(dataStart, dataStart + buf.readUInt32LE(p + 24)),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, count, cdSize };
}

describe('helper-pack crc32',()=>{
  it('命中标准校验值（IEEE 802.3）',()=>{
    expect(crc32('')).toBe(0);
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe(0x414fa339);
  });
  it('字符串按 UTF-8 编码后计算，与 Buffer 入参一致',()=>{
    const s = '漫画导入助手 opg-nh';
    expect(crc32(s)).toBe(crc32(Buffer.from(s, 'utf8')));
  });
});

describe('helper-pack helperFiles',()=>{
  const files = helperFiles({ version: '9.9.9', sources: SRC });
  const names = files.map(f => f.path);

  it('清单含 package.json / 四件套 scripts / 三个双击 bat / 使用说明',()=>{
    expect(names).toContain(`${HELPER_DIR}/package.json`);
    for (const f of HELPER_SCRIPTS) expect(names).toContain(`${HELPER_DIR}/scripts/${f}`);
    expect(names).toContain(`${HELPER_DIR}/安装协议.bat`);
    expect(names).toContain(`${HELPER_DIR}/卸载协议.bat`);
    expect(names).toContain(`${HELPER_DIR}/启动服务.bat`);
    expect(names).toContain(`${HELPER_DIR}/使用说明.txt`);
    expect(files.every(f => f.path.startsWith(HELPER_DIR + '/'))).toBe(true);
  });
  it('package.json 注入版本且保持极简（不引入依赖）',()=>{
    const pkg = JSON.parse(files.find(f => f.path.endsWith('/package.json')).data);
    expect(pkg).toEqual({ name: 'opg-nh-helper', version: '9.9.9', private: true });
  });
  it('bat 用 CRLF 行尾并以换行收尾（cmd 对纯 LF 解析不稳）',()=>{
    /* 包内共 4 个 bat：仓库的 opg-nh.bat（协议处理器，原样拷入 scripts/）+ 生成的 3 个顶层双击入口 */
    const bats = files.filter(f => f.path.endsWith('.bat'));
    const topBats = files.filter(f => {
      const rel = f.path.slice(HELPER_DIR.length + 1);
      return f.path.startsWith(HELPER_DIR + '/') && !rel.includes('/') && rel.endsWith('.bat');
    });
    expect(bats.length).toBe(4);
    expect(topBats.map(f => f.path.slice(HELPER_DIR.length + 1)).sort()).toEqual(['卸载协议.bat', '启动服务.bat', '安装协议.bat'].sort());
    for (const b of bats) {
      expect(b.data.includes('\r\n')).toBe(true);
      expect(/(^|[^\r])\n/.test(b.data)).toBe(false);
      expect(b.data.endsWith('\r\n')).toBe(true);
    }
  });
  it('使用说明与 package.json 版本一致',()=>{
    expect(files.find(f => f.path.endsWith('/使用说明.txt')).data).toContain('v9.9.9');
  });
  it('脚本正文缺失时报错（防静默出空包）',()=>{
    expect(() => helperFiles({ version: '1.0.0', sources: {} })).toThrow(/nh-import\.mjs/);
  });
  it('行尾按扩展名归一化：bat 恒 CRLF，脚本恒 LF（.mjs 里不能留 CR）',()=>{
    for (const f of files) {
      const isBat = f.path.endsWith('.bat');
      if (isBat) expect(f.data.includes('\r\n'), f.path).toBe(true);
      else expect(f.data.includes('\r'), f.path).toBe(false);
    }
  });
  it('CRLF 与 LF 两种检出产出的包逐字节相同（CI 与本地一致的前提）',()=>{
    /* 仓库文件的 .bat 在 Windows 检出是 CRLF、Linux/CI 检出是 LF，
       .mjs 也可能被 autocrlf 改写——不归一化则两边打出的 zip 差几百字节 */
    const lfSources = Object.fromEntries(Object.entries(SRC).map(([k, v]) => [k, v.replace(/\r\n?/g, '\n')]));
    const crlfSources = Object.fromEntries(Object.entries(SRC).map(([k, v]) => [k, v.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n')]));
    const a = zipStore(helperFiles({ version: '3.0.0', sources: lfSources }));
    const b = zipStore(helperFiles({ version: '3.0.0', sources: crlfSources }));
    expect(a.equals(b)).toBe(true);
  });
});

describe('helper-pack zipStore',()=>{
  const files = helperFiles({ version: '1.2.3', sources: SRC });
  const zip = zipStore(files);
  const parsed = parseZip(zip);

  it('EOCD 条目数与清单一致，全部 store 且标记 UTF-8 文件名',()=>{
    expect(parsed.count).toBe(files.length);
    expect(parsed.entries.every(e => e.method === 0 && e.utf8)).toBe(true);
  });
  it('每个条目的 CRC 与解出的内容一致',()=>{
    for (const e of parsed.entries) {
      const expected = files.find(f => f.path === e.name);
      expect(expected, e.name).toBeTruthy();
      expect(e.size).toBe(e.data.length);
      expect(e.crc).toBe(crc32(e.data));
      expect(e.data.toString('utf8')).toBe(Buffer.from(expected.data).toString('utf8'));
    }
  });
  it('中文文件名正确往返（安装协议.bat 等）',()=>{
    const e = parsed.entries.find(x => x.name.endsWith('/安装协议.bat'));
    expect(e).toBeTruthy();
    expect(e.data.toString('utf8')).toContain('nh-install.mjs');
  });
  it('同一输入产出逐字节相同的 ZIP（构建内嵌与 CI 资产同源的前提）',()=>{
    expect(zipStore(helperFiles({ version: '1.2.3', sources: SRC })).equals(zip)).toBe(true);
  });
  it('不同版本产出不同字节（版本确实进了包内）',()=>{
    expect(zipStore(helperFiles({ version: '1.2.4', sources: SRC })).equals(zip)).toBe(false);
  });
  it('空清单仍产出合法 EOCD',()=>{
    const e = parseZip(zipStore([]));
    expect(e.count).toBe(0);
    expect(e.cdSize).toBe(0);
  });
});

describe('helper-pack helperUsageText',()=>{
  it('含 Node 版本要求、协议注册步骤与代理默认值',()=>{
    const t = helperUsageText('2.0.0');
    expect(t).toContain('v2.0.0');
    expect(t).toContain('Node.js ≥ 18');
    expect(t).toContain('安装协议.bat');
    expect(t).toContain('http://127.0.0.1:7890');
  });
});
