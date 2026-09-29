/* 注册/卸载 opg-nh:// 本地协议处理器（Windows，HKCU 无需管理员）：
   安装后工具「漫画导入」页的「一键启动服务」按钮即可唤起 nh-serve（首次浏览器会弹一次授权确认）。
   协议处理器仅启动服务，不解析传入参数内容。 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const BAT=join(ROOT,'scripts','opg-nh.bat');
const KEY='HKCU\\Software\\Classes\\opg-nh';
const CMD=`"${BAT}" "%1"`;
const mode=process.argv[2]||'install';
const isUninstall=mode==='uninstall'||mode==='-u';

function reg(args,label){
  const r=spawnSync('reg',args,{encoding:'utf8'});
  const ok=!r.error&&r.status===0;
  console.log((ok?'[OK] ':'[FAIL] ')+label);
  if(!ok)console.error((r.stderr||r.stdout||'').trim());
  return ok;
}

if(process.platform!=='win32'){
  console.error('Protocol registration is Windows-only; on macOS/Linux run `npm run nh-serve` directly.');
  process.exit(1);
}

if(isUninstall){
  const ok=reg(['delete',KEY,'/f'],'Removed opg-nh:// protocol registration');
  process.exit(ok?0:1);
}

const steps=[
  reg(['add',KEY,'/ve','/d','URL:opg-nh Protocol','/f'],'Register opg-nh:// protocol'),
  reg(['add',KEY,'/v','URL Protocol','/d','','/f'],'Mark as URL protocol'),
  reg(['add',KEY+'\\shell\\open\\command','/ve','/d',CMD,'/f'],'Bind launcher opg-nh.bat'),
];
console.log(steps.every(Boolean)
  ?'\n[OK] Installed. In the tool (Manga Import tab) click "Start Service" - the first use asks once to open opg-nh://, choose Always allow.'
  :'\n[FAIL] Install incomplete - please report the errors above.');
process.exit(steps.every(Boolean)?0:1);
