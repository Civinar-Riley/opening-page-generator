/* 「OPG skill」打包：SKILL.md + esbuild 打包的 headless 生成 CLI 组装成
   dist-skill/opg-skill-v{版本}.zip。ZIP 字节走 helper-pack 的 zipStore
   （store-only + 固定 DOS 时间戳 + 出口行尾归一化），本地与 CI 产出逐字节一致。
   与助手小包不同，本 CLI 不内嵌进工具单文件——分发途径只有本资产，改 CLI 后重跑本脚本即可。 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { zipStore, normalizeEol } from './helper-pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const OUT_DIR = join(ROOT, 'dist-skill');
const ZIP = join(OUT_DIR, `opg-skill-v${VERSION}.zip`);
const SKILL_DIR = 'opg'; /* 解压后的技能目录名 = 技能名 */

/* 生成引擎（gen + defs + project 的模板/补齐逻辑）打成单文件 ESM：零外部依赖，
   skill 用户拿到手 node 直接跑；版本号经 define 注入 CLI 的 --version/--schema */
const built = await esbuild.build({
  entryPoints: [join(ROOT, 'scripts', 'opg-gen-cli.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  minify: true,
  write: false,
  logLevel: 'silent',
  banner: { js: `#!/usr/bin/env node\n/* OPG headless 生成引擎 v${VERSION}——由 scripts/pack-skill.mjs 打包，勿手改；源码见仓库 scripts/opg-gen-cli.mjs */` },
  define: { __OPG_VERSION__: JSON.stringify(VERSION) },
});

const files = [
  { path: `${SKILL_DIR}/SKILL.md`, data: readFileSync(join(ROOT, 'skill', 'SKILL.md'), 'utf8') },
  { path: `${SKILL_DIR}/opg-gen.mjs`, data: built.outputFiles[0].text },
].map(f => ({ ...f, data: normalizeEol(f.path, f.data) }));

const zip = zipStore(files);
mkdirSync(OUT_DIR, { recursive: true });
rmSync(ZIP, { force: true });
writeFileSync(ZIP, zip);
console.log(`✓ OPG skill 已打包 → dist-skill/opg-skill-v${VERSION}.zip (${(zip.length / 1024).toFixed(1)} KB)`);
