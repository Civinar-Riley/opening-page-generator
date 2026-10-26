/* 「漫画导入助手」独立小包打包：把四件套 + 极简 package.json + 三个双击 bat + 使用说明
   组装成 dist-nh/opg-nh-helper-v{版本}.zip。
   文件清单与 ZIP 字节由 scripts/helper-pack.mjs 统一产出——build.js 构建期内嵌进单文件的
   同一份 ZIP 就来自它，工具页「导出助手小包」按钮下载的与这里产出的 Release 资产逐字节一致。 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELPER_SCRIPTS, helperFiles, zipStore } from './helper-pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const OUT_DIR = join(ROOT, 'dist-nh');
const ZIP = join(OUT_DIR, `opg-nh-helper-v${VERSION}.zip`);

const sources = {};
for (const f of HELPER_SCRIPTS) sources[f] = readFileSync(join(ROOT, 'scripts', f), 'utf8');
const zip = zipStore(helperFiles({ version: VERSION, sources }));

mkdirSync(OUT_DIR, { recursive: true });
rmSync(ZIP, { force: true });
writeFileSync(ZIP, zip);
console.log(`✓ 漫画导入助手小包已打包 → dist-nh/opg-nh-helper-v${VERSION}.zip (${(zip.length / 1024).toFixed(1)} KB)`);
