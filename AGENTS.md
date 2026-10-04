# AGENTS.md — AI 协作指南

> 本文件写给在本仓库工作的 AI 编码助手。动手前先通读「硬约束」与「常见任务配方」——约束是红线，不是建议。
> 实操层面的坑（双转义/组件 script 特例/浏览器冒烟陷阱等）见根目录 `PITFALLS.md` 防踩坑清单，写码时当检查表用。
> 作者工作方式：本地编辑，git 直推 `origin/main`（HTTPS + 凭据管理器免密，经本地代理 `127.0.0.1:7897`——系统环境变量、用户级 git config、npm config 三处已统一；推送连不上时先确认 7897 代理是否在运行；无 PR / 分支流程，历史以本地为准，必要时 `--force-with-lease` 覆盖），验证闭环以本地 lint + 测试 + 构建为准。提交身份为仓库级 `Civinar-Riley` noreply 邮箱。

## 项目概述

企鹅的酒馆开场页生成器 —— 纯本地浏览器工具（单文件 `dist/index.html`，零服务端），可视化编排 SillyTavern 角色卡开场页（25 种区块：欢迎/装饰/粒子/引言/时钟/随机事件/骰子/倒计时/时间线/角色简介/问答/图库/BGM/开场白选择/分隔/免责/作者的话/自由 HTML + 默认停用的更新日志/入场闸门/解码文本/命运卡池/连击彩蛋/模糊揭示/漫画阅读器）。产物为自包含 HTML 组件，由酒馆助手（TavernHelper / JS-Slash-Runner）在聊天中渲染。

- 技术栈：vanilla JS（ES Modules 源码 → esbuild 打包 IIFE）· 无框架 · 零运行时依赖
- 生成物 API 契约见 `src/js/gen/TAVERN_API.md`（新增 API 使用前必须先在那里登记）

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm test`（等价 `npx vitest run`） | 全部单元测试——**任何改动后必须全过** |
| `npm run build` | 构建 `dist/index.html`（压缩版；构建后自动跑静态冒烟 `postbuild`，超体积预算线失败） |
| `npm run smoke` | 双冒烟：静态检查（script 配平/双转义状态机/版本一致/语法可解析）+ 无头浏览器级冒烟（零 console.error、页签可切、预览挂载、探活 mock） |
| `npm run watch` | 开发模式（不压缩 + 监视 src 变更自动重建） |
| `npm run lint` | 零依赖 lint（`node lint.js`）：未使用 import / 未定义标识符（调用位漏 import·typo） / localStorage key 前缀 / console.log 残留 / TODO·FIXME 标记 / `<button>` 缺显式 type |
| `npm run build:ext` | 扩展产物（仅 extension 分支）：build 后把 dist/index.html 复制为仓库根 tool.html |
| `npm run nh -- <画廊URL\|ID> [--skip-last N] [--pages a-b]` | nhentai 画廊直链单次导出到剪贴板（`scripts/nh-import.mjs`） |
| `npm run nh-serve` | nhentai 导入本地服务（127.0.0.1:8765，`NH_PORT` 可覆盖）——工具「📚 漫画导入」页签的后端 |
| `npm run nh-install` / `nh-uninstall` | 注册/移除 `opg-nh://` 本地协议（HKCU）——工具页「🚀 一键启动服务」按钮的唤起通道 |

交付前闭环：`npm run lint` 通过 → `npm test` 全过 → `npm run build` 成功（postbuild 自动静态冒烟）→ `npm run smoke`（改动涉及工具 UI/壳时必跑）→ **同步根目录 `README.md`**（见「README 同步」）。lint 或测试失败禁止交付。

发版配方（打 tag 自动建 Release 挂 dist 产物，workflow 见 `.github/workflows/release.yml`）：bump `package.json` version → README 标题同步 → 全量闭环 → commit push main → `git tag -a v1.x.0 && git push origin v1.x.0` → GitHub Actions 自动构建并创建 Release（workflow 必须已先在 main 上，tag 才会触发）。

## extension 分支（酒馆扩展形态）

main 为主开发线；`extension` 分支 = main + 扩展胶水（`manifest.json` / `ext/index.js` / `ext/overlay.css` / `ext/README.md` / `ext-build.js` / `tool.html` 产物），以 iframe 全屏内嵌工具 + `__OPG_EXT__` 桥（`src/js/ui/extBridge.js` 的写入角色卡能力只在桥存在时激活，独立版休眠）。**同步配方**：双击根目录 `sync-extension.bat`（工作区需干净；自动完成 checkout extension → merge main → build:ext 重建 tool.html → lint/test → 提交推送 → 切回原分支；合并冲突自动中止回退）。手动等价流程：`git checkout extension && git merge main && npm run build:ext && npm run lint && npm test` → 提交推送（tool.html 是产物，merge 后必须重建再提交）；`manifest.json` 的 version 手动与 `package.json` 对齐。安装方式见 `ext/README.md`（Install extension 填仓库 URL + 分支名 `extension`）。胶水层改动勿反向 merge 回 main（main 无 manifest/ext，保持纯本地单文件形态）。

## 模块地图（src/js js 文件 + index.html + tool.css）

| 文件 | 职责 |
|------|------|
| `src/index.html` | 工具壳（顶栏/页签/页面容器）；`__OPG_VERSION__` 占位由 build.js 注入版本号 |
| `src/css/tool.css` | 工具自身 UI；令牌在 `:root`（暖铜金默认），其余主题为 `html[data-theme='x']` 块（星夜/蓝图/磷光/深海，共 5 套） |
| `src/js/main.js` | 入口：顶栏事件委托（工程 CRUD/导入导出）、工具主题下拉（UI_THEMES 渲染 + localStorage 持久化 + 恢复兜底）、工厂重置（三次确认） |
| `src/js/utils.js` | `$/$$`、`esc()`（五类转义）、`uid()`（时间戳+单调计数器）、toast、confirmModal/promptModal、导出代码语法高亮 |
| `src/js/defs.js` | 纯数据：`BLOCK_DEFS/BLOCK_ORDER/CORE_TYPES`、`THEME_PRESETS`（6 页面主题）、`COMP_LIB`（59 组件）、`UI_THEMES`（5 工具主题）、`BUILTIN_TEMPLATES`（12 官方模板）、`BLOCK_PRESETS`、`defaultProject()` |
| `src/js/macros.js` | 预览专用宏引擎（char/user/random/pick/roll/setvar/getvar/时间类），随机结果带缓存防预览闪变 |
| `src/js/project.js` | 工程存储/migrate/normalize、撤销重做（20 步快照栈）、模板、导入导出（剔除 API Key） |

| `src/js/ui/core.js` | UI 壳 + `UI.renderAll()` 总入口（各渲染页有独立 try/catch 隔离）+ renderProjectSelect + 预览四件套（mountPreview/fitPreviewHeight/refreshPreview/debouncedPreview）+ 页签切换/全局快捷键/启动；经 `Object.assign(UI,…)` 挂载页面方法（模块顶层不读 UI 值，规避循环 import TDZ） |
| `src/js/ui/renderConfig.js` | 配置页渲染与交互（renderConfig + renderBlockBody 区块编辑器 + 区块拖拽/全局搜索替换 UI 层） |
| `src/js/ui/renderExport.js` / `renderAI.js` / `renderHelp.js` | 导出页 / AI 助手页 / 说明页渲染 |
| `src/js/ui/shared.js` | 跨页辅助：bindListEditor / detectFonts |
| `src/js/search.js` | **纯函数**全局搜索替换：collectSearchMatches / replaceAllInString / replaceAllInProject（UI 层仅调 API，逻辑可测） |
| `src/js/fontdetect.js` | **纯函数**字体检测：COMMON_FONTS / BASE_FONTS / fontExists / detectAvailableFonts（ctx 由调用方注入，测试 mock） |
| `src/js/gen/index.js` | 生成引擎入口：`Gen.build`（组件）/ `buildFullDoc` / `fencedFullDoc`（``` 围栏，含四反引号升级）/ `regexScript`（正则脚本 JSON）/ `auditFullDoc`+`auditCompat`（导出自检） |
| `src/js/gen/css.js` | 产物 CSS：容器作用域 + 各区块实例样式（`.opg-{id}-bk{i}` 用 display:contents 隔离，支持同类多实例） |
| `src/js/gen/body.js` | 产物 HTML：逐区块渲染；`tx`（预览替换宏）/`raw`（导出保留宏）双轨；含倒计时/粒子内联脚本（无 API 依赖） |
| `src/js/gen/scripts.js` | 产物运行时：lightbox / BGM 播放器 / 酒馆助手交互（开场白列表/切换/标题库）——全部带 API 守卫与降级 |
| `lint.js` | 零依赖 lint（`node lint.js`）：未使用 import / 未定义标识符（词法预清洗后查调用位 `foo(`——文件内无声明且非白名单全局）/ localStorage key 前缀 / console.log 残留 / TODO·FIXME 标记 / `<button>` 缺显式 type（原始文本扫描，含字符串内 HTML 与 src/index.html）；各规则已对代码库校准（零误报），新增规则前先在本地验证 |

## 数据流

```
localStorage（openingPageGen_* 键）
  → Project.load()（逐工程 migrate → normalize 补齐字段）
  → Project.cur（theme / blocks / macros / ai / preview）
  → 预览：Gen.build(p,{isPreview:true})   ← Macros.apply 替换宏；300ms 防抖 + 内容 key 未变则跳过 iframe 重建
  → 导出：Gen.buildFullDoc / Gen.regexScript ← 宏原样保留，交酒馆运行时解析
```

交互模式：**用户操作改 `Project.cur` 数据 → 调对应 render*/refresh* 重渲染**，不直接改 DOM 状态；数据变更伴随 `Project.save()`（或 saveDebounced）与 `Project.saveSnapshot()`（需可撤销的操作）。新增交互请遵循此模式。

## 硬约束（红线）

1. **组件库 `COMP_LIB`**（defs.js，55+ 条带 cat 分类）：无 id 选择器（**例外**：`opg-` 前缀 id 供 CSS 交互组件如多标签页/求签，多次插入共享状态为已知取舍）、无全局选择器；`<script>` 仅音乐播放器/交互计数器/点击切换消息三个特例（IIFE 局部作用域 + `data-bound` 防重绑，交互一律 addEventListener 禁用内联 onclick）；类名一律 `opg-` 前缀隔离；假设深色生成底；430px 手机宽适配。组件插入走 `openCompPicker` 弹窗（renderConfig）
2. **gen 产物自包含**：style+script 全内联；容器 `opg-{id}` 前缀隔离；同类区块多实例用 `display:contents` 作用域层（`.opg-{id}-bk{i}`）
3. **宏双轨**：`gen/body.js` 的 `tx`（预览经 Macros.apply 替换）/`raw`（导出原样保留交酒馆解析）——新增区块渲染必须双轨支持，只写一边会让预览或导出失真
4. **工具 UI 主题**：`tool.css` 的 `html[data-theme='x']` 块必须覆盖**全部令牌**（`:root` 的全部令牌，含 `--star-c`——星夜主题星点背景依赖）+ `#topbar/#tabs/#main` z-index 三件套（若用 body::before 纹理层）；`bronze` 是 `:root` 默认，不挂 data-theme 属性
5. **`esc()` 五类转义**（`& < > " '`）：任何用户输入拼进 HTML 一律走 esc；组件库/自由 HTML 的内联样式除外（按设计允许富文本）
6. **localStorage key 一律 `openingPageGen` 前缀**；工程导出必须经 `Project.exportData()` 剔除 `ai.apiKey/keyEnc`，防止明文 Key 外泄
7. **`</script>` 转义**：build.js 已处理 bundle 层；gen 内嵌脚本（body.js 倒计时/粒子、scripts.js 各脚本）手写闭合标签必须用 `<\/script>`
8. **产物运行时 API 守卫**：任何酒馆助手 API 调用必须 `typeof` 守卫 + try/catch + 降级提示（详见 `src/js/gen/TAVERN_API.md`）；禁止依赖 DOMContentLoaded
9. **自由 HTML 全权限警示**：自由 HTML 区块的脚本在预览（srcdoc 继承父 origin + allow-same-origin）与酒馆导出中均以完整权限运行，可读写 localStorage——文档与区块编辑器须注明「勿粘贴不可信来源的代码」（自伤型风险，与酒馆真实环境一致）

## 常见任务配方

### README 同步（每次修改后必做）
每次功能/结构调整落地后，基于**当前代码实际状态**核对根目录 `README.md` 并更新——README 是对外门面，数字过时即失真。核对清单：

| README 位置 | 对照源 |
|------|------|
| 标题版本号 `v x.y.z` | `package.json` `version`（build.js 注入 `__OPG_VERSION__`） |
| 功能特性列表（区块/组件/模板/主题数量与名称） | `defs.js`：`BLOCK_ORDER`（24）、`COMP_LIB`（59）、`BUILTIN_TEMPLATES`（12）、`THEME_PRESETS`（6）、`UI_THEMES`（5） |
| 功能特性新增条目 | 本次改动引入的能力（如新区块特性、新组件、闸门双主题） |
| 项目结构树 | `src/`、`tests/`、根目录实际文件（新增/删除目录要同步，如 `reference/`；不存在的文件如 `TESTING.md` 要移除） |
| 构建/测试命令说明 | `package.json` scripts |

- 只改了文案/注释/测试 → 快速扫一遍结构树即可；动了 `defs.js` 或新增模块 → 上表逐行核对
- 数字与清单以代码为准，凭记忆写的描述一律视为待核对
- 版本号是否 bump 由改动性质决定（feature/fix 通常升 minor/patch，纯 docs 不必），升版本时 README 标题同步改

### UI 设计任务（强制）
涉及新增/修改 工具主题（`UI_THEMES`+`tool.css`）、页面主题预设（`THEME_PRESETS`）、`COMP_LIB` 组件、或任何可见界面视觉设计时：**必须先调用 skill 工具加载 `frontend-design`**，按其方法论（概念先行/纹理氛围/克制动效/破格排版）执行设计，并遵守本文件硬约束与该技能内的「opening-page-generator 项目适配注记」。设计前先查 `defs.js` 现有视觉资产（6 套页面主题 / 59 组件），避免趋同。

### 新增区块类型（6 文件 checklist）
1. `defs.js`：`BLOCK_DEFS` 加 `type:{name,icon,create()}` + `BLOCK_ORDER` 追加（可选 `BLOCK_PRESETS` 预设）
2. `ui/renderConfig.js` renderBlockBody：新 `case`（编辑器 HTML + 事件）
3. `gen/css.js`：新 `case`（作用域样式，用 `${bk}` 前缀）
4. `gen/body.js`：新 `case`（tx/raw 双轨渲染）
5. 需要运行时脚本 → `gen/scripts.js`（守卫+降级）
6. 帮助文案（ui/renderHelp.js）+ 补测试（tests/gen.test.js）

### 新增组件库组件
`defs.js` 定义 HTML 常量（遵守约束 1）+ `COMP_LIB` 追加 `{icon,name,html}` → ui/renderHelp.js 枚举追加

> ⚠️ 改 COMP_LIB 基础文案时：若该组件被官方模板 `BUILTIN_TEMPLATES` 以 `.replace('旧文案',…)` 定制（常见 8 个：CHAPHD/LETTER/QUEST/RATE/TERM/INV/CAL/CHAT_HTML），先全局搜索 defs.js 里的 `.replace('该文案'` 核对模板——否则模板 replace 会静默失效回落到默认文案（模板本就是「开场即改」素材，影响小，但改动前留意即可）。

### 新增页面主题预设
`defs.js` `THEME_PRESETS` 追加 `{name,theme:{primary,accent,textColor,radius,titleAlign}}`——先核对与现有 5 套色相不撞；textColor 必须近白（深底可读）

### 新增工具 UI 主题
`defs.js` `UI_THEMES` 追加 + `tool.css` 新 data-theme 块（遵守约束 4）；当前 5 套全深色系，新增浅色需先与作者确认（浅色主题曾因可读性被整体移除）

## 产物真机验证配方（酒馆环境）

预览 iframe（srcdoc 模拟）通过 ≠ 真机通过。涉及酒馆 API 交互（开场白列表/切换/标题库/选项填入）的改动必须真机验证：

1. 酒馆 → 扩展 → 酒馆助手，确认「实时监听-允许监听」已启用（代码→酒馆热同步的前提）
2. 用 chrome-devtools 连接**已打开的酒馆浏览器页**（MCP 或调试端口，勿新开实例读不到真实环境）
3. 从导出页复制带围栏文档，贴进 first_mes 或已有楼层，观察真实渲染
4. 核对点：列表与卡开场白一致 → 点击切换楼层 swipe 正确 → 选项填入输入框 → 标题库命中 → 对照 TAVERN_API.md 降级矩阵确认 note 提示按预期出现/不出现
5. 证据等级口径：预览通过=开发环境档；真机通过=真机档——产物 API 行为改动收尾必须真机档，报告时如实标注（预览过/真机过/未验证）

## 风格约定

- 紧凑单行风格（与现有代码一致），中文注释说明"为什么"而非"是什么"
- 无框架、零运行时依赖（仅 esbuild 构建 + vitest 测试）——新增依赖需先与作者确认
- 不做无关重构；改动最小化；每步可验证
- 用户偏好：中文交流、先方案后执行（规划→确认→动手）、修复前逐步验证
