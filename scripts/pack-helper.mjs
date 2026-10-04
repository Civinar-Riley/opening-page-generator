/* 「漫画导入助手」独立小包打包：组装 opg-nh-helper/（四件套 + 极简 package.json +
   三个双击 bat + 使用说明，版本号注入）并压缩为 dist-nh/opg-nh-helper-v{版本}.zip。
   包内目录结构镜像仓库（package.json 在根、脚本在 scripts/），opg-nh.bat 的
   `cd /d "%~dp0.."` 与 nh-import 读 ../package.json 原样成立，四件套零改造。
   Windows 用 PowerShell Compress-Archive 压缩，其余平台用 zip（CI ubuntu）。 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const STAGE = join(ROOT, 'dist-nh', 'opg-nh-helper');
const ZIP = join(ROOT, 'dist-nh', `opg-nh-helper-v${VERSION}.zip`);
const bat = body => body.split('\n').join('\r\n') + '\r\n';

/* 1. 组装目录 */
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, 'scripts'), { recursive: true });
for (const f of ['nh-import.mjs', 'nh-lib.mjs', 'nh-install.mjs', 'opg-nh.bat']) {
  cpSync(join(ROOT, 'scripts', f), join(STAGE, 'scripts', f));
}
writeFileSync(join(STAGE, 'package.json'), JSON.stringify({ name: 'opg-nh-helper', version: VERSION, private: true }, null, 2));

/* 2. 三个双击 bat（chcp 65001 保中文；CRLF 行尾） */
writeFileSync(join(STAGE, '安装协议.bat'), bat([
  '@echo off',
  'chcp 65001>nul',
  'title 漫画导入助手 - 安装协议',
  'cd /d "%~dp0"',
  'echo 正在注册 opg-nh:// 协议（用于工具页「一键启动服务」）...',
  'node scripts\\nh-install.mjs',
  'echo.',
  'pause',
].join('\n')));
writeFileSync(join(STAGE, '卸载协议.bat'), bat([
  '@echo off',
  'chcp 65001>nul',
  'title 漫画导入助手 - 卸载协议',
  'cd /d "%~dp0"',
  'echo 正在移除 opg-nh:// 协议注册...',
  'node scripts\\nh-install.mjs uninstall',
  'echo.',
  'pause',
].join('\n')));
writeFileSync(join(STAGE, '启动服务.bat'), bat([
  '@echo off',
  'chcp 65001>nul',
  'title 漫画导入助手 - 服务运行中（关掉此窗口即停止服务）',
  'cd /d "%~dp0"',
  'node scripts\\nh-import.mjs --serve',
  'pause',
].join('\n')));

/* 3. 使用说明 */
writeFileSync(join(STAGE, '使用说明.txt'), `「漫画导入助手」v${VERSION} —— 企鹅的酒馆开场页生成器 · 本机辅助服务
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

版本：v${VERSION}
`);

/* 4. 压缩 */
if (existsSync(ZIP)) rmSync(ZIP);
if (process.platform === 'win32') {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${STAGE}' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('压缩失败（PowerShell Compress-Archive）'); process.exit(1); }
} else {
  const r = spawnSync('zip', ['-r', ZIP, 'opg-nh-helper'], { cwd: join(ROOT, 'dist-nh'), stdio: 'inherit' });
  if (r.status !== 0) { console.error('压缩失败（zip 未安装？）'); process.exit(1); }
}
const kb = (statSync(ZIP).size / 1024).toFixed(1);
console.log(`✓ 漫画导入助手小包已打包 → dist-nh/opg-nh-helper-v${VERSION}.zip (${kb} KB)`);
