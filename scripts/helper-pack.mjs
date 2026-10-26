/* 「漫画导入助手」小包：文件清单 + store-only ZIP 组装（零依赖纯函数）。
   build.js 构建期调用它把 ZIP 以 base64 内嵌进单文件（工具页按钮直接下载），
   scripts/pack-helper.mjs 调用它产出 CI Release 资产——两处走同一份字节，杜绝漂移。
   包内目录结构镜像仓库（package.json 在根、脚本在 scripts/），scripts/opg-nh.bat 的
   `cd /d "%~dp0.."` 与 nh-import 读 ../package.json 原样成立，四件套零改造。 */

export const HELPER_DIR = 'opg-nh-helper';
/* 进包的三份脚本 + 协议批处理（均从仓库 scripts/ 原样拷贝，不在本文件复制正文） */
export const HELPER_SCRIPTS = ['nh-import.mjs', 'nh-lib.mjs', 'nh-install.mjs', 'opg-nh.bat'];

/* 固定 DOS 时间戳（2026-10-01 00:00）：同一份输入永远产出同一份字节，
   测试可做完整性断言，也避免每次构建都因时间戳产生 diff */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 1;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** 标准 CRC-32（IEEE 802.3，ZIP 用）：入参 Buffer/Uint8Array/string */
export function crc32(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 双击 bat：chcp 65001 保中文；CRLF 行尾（Windows cmd 对 LF 解析不稳） */
const bat = body => body.split('\n').join('\r\n') + '\r\n';

/** 小包使用说明（版本号注入；工具页下载与 CI 资产共用同一份文案） */
export function helperUsageText(version) {
  return `「漫画导入助手」v${version} —— 企鹅的酒馆开场页生成器 · 本机辅助服务
====================================================================

作用：让浏览器里的工具页能抓取 nhentai 画廊直链（浏览器直连会被跨域与防护拦截，
这个小服务在本机代抓）。配合工具页「📚 漫画导入」页签使用。

【系统要求】
· Windows（协议注册仅支持 Windows；macOS/Linux 直接命令行 node scripts/nh-import.mjs --serve）
· Node.js ≥ 18 且 node 在 PATH 里（nodejs.org 下载安装即可）
· 抓取需能访问 nhentai 的网络（通常需要本机代理）

【三步安装】
1. 把整个文件夹解压到一个固定目录（例如 D:\\opg-nh-helper），之后不要移动——
   协议注册指向解压位置，移动了要重新双击「安装协议.bat」
2. 双击「安装协议.bat」，全部 [OK] 即注册成功
3. 打开工具页「📚 漫画导入」，点「🚀 一键启动服务」；浏览器首次会问是否打开
   opg-nh:// 链接——选「始终允许」

【代理怎么填】
抓取 nhentai 通常需要代理。在工具页「📚 漫画导入」的「抓取代理」框里填本机代理地址：
· Clash 默认：http://127.0.0.1:7890
· v2rayN 默认：http://127.0.0.1:10809
填完直接抓即可，改完即生效，无需重启服务；留空则跟随系统环境变量或直连。

【卸载】
双击「卸载协议.bat」移除 opg-nh:// 注册；然后直接删除文件夹。

【排障】
· 提示「node 不是内部或外部命令」：先安装 Node.js（nodejs.org），装完重开窗口
· 端口被占用（默认 8765）：命令行里 set NH_PORT=8766 后再启动服务，并在工具页
  把「服务地址」改成 http://127.0.0.1:8766
· 工具一直显示「未连接」：确认服务窗口开着；或手动双击「启动服务.bat」看报错
· 抓取报「代理连不上」：核对工具页「抓取代理」的端口，确认代理软件正在运行
· 抓取报 Cloudflare 拦截：确认代理可用后重试；仍不行用工具页的「批量导入」手动贴直链

版本：v${version}
`;
}

/** 组装小包文件清单：[{path(含 opg-nh-helper/ 前缀), data(string|Buffer)}]
    sources 为 {脚本名: 正文}，由调用方读盘注入（本模块不碰 fs，便于测试） */
export function helperFiles({ version, sources }) {
  const files = [
    { path: `${HELPER_DIR}/package.json`, data: JSON.stringify({ name: 'opg-nh-helper', version, private: true }, null, 2) },
  ];
  for (const f of HELPER_SCRIPTS) {
    if (typeof sources?.[f] !== 'string') throw new Error(`小包缺少脚本正文：${f}`);
    files.push({ path: `${HELPER_DIR}/scripts/${f}`, data: sources[f] });
  }
  files.push({ path: `${HELPER_DIR}/安装协议.bat`, data: bat([
    '@echo off',
    'chcp 65001>nul',
    'title 漫画导入助手 - 安装协议',
    'cd /d "%~dp0"',
    'echo 正在注册 opg-nh:// 协议（用于工具页「一键启动服务」）...',
    'node scripts\\nh-install.mjs',
    'echo.',
    'pause',
  ].join('\n')) });
  files.push({ path: `${HELPER_DIR}/卸载协议.bat`, data: bat([
    '@echo off',
    'chcp 65001>nul',
    'title 漫画导入助手 - 卸载协议',
    'cd /d "%~dp0"',
    'echo 正在移除 opg-nh:// 协议注册...',
    'node scripts\\nh-install.mjs uninstall',
    'echo.',
    'pause',
  ].join('\n')) });
  files.push({ path: `${HELPER_DIR}/启动服务.bat`, data: bat([
    '@echo off',
    'chcp 65001>nul',
    'title 漫画导入助手 - 服务运行中（关掉此窗口即停止服务）',
    'cd /d "%~dp0"',
    'node scripts\\nh-import.mjs --serve',
    'pause',
  ].join('\n')) });
  files.push({ path: `${HELPER_DIR}/使用说明.txt`, data: helperUsageText(version) });
  return files;
}

/** store-only ZIP（method 0，不压缩）：脚本都是小文本，压缩收益有限，
   换来零依赖与「构建期/CI/测试三处字节完全一致」。文件名用 UTF-8 旗标 0x0800。 */
export function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.path, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          /* 解压所需版本 */
    local.writeUInt16LE(0x0800, 6);      /* 文件名 UTF-8 */
    local.writeUInt16LE(0, 8);           /* method 0 = store */
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);          /* extra 长度 */
    chunks.push(local, name, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);             /* made by */
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}
