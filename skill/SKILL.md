---
name: opg
description: 企鹅的酒馆开场页生成器（OPG）headless 引擎。为 SillyTavern 角色卡生成、修改或调试开场页 HTML 时使用——25 种区块（欢迎/装饰/粒子/引言/时钟/随机事件/骰子/倒计时/时间线/角色简介/问答/图库/BGM/开场白选择等）凭一份工程 JSON 直接产出自包含单文件，交酒馆助手（TavernHelper）在楼层渲染，无需打开可视化工具。
---

# OPG 开场页生成器 — headless 引擎

可视化工具本体见 https://github.com/Civinar-Riley/opening-page-generator 。本技能是其生成引擎的命令行形态：**工程 JSON 进 → 自包含开场页 HTML 出**。

## 三步上手

```bash
node opg-gen.mjs --schema                     # ① 25 种区块的字段参考 + 内置宏表（动手前先看）
node opg-gen.mjs --template 1 --name 我的工程 > proj.json   # ② 官方模板起步（--list 看清单；或 --new 空白骨架）
node opg-gen.mjs proj.json --fenced -o out.txt              # ③ 构建 → out.txt 整段贴进酒馆
```

产物自检恒跑（报告在 stderr）：出现「提示」先修工程 JSON 再交付，涉及 `freehtml` 的提示尤其要处理。

## 命令

| 命令 | 作用 |
|---|---|
| `node opg-gen.mjs <proj.json>` | 构建 → stdout 完整 HTML 文档（`-o` 写文件；参数为 `-` 读 stdin） |
| `… --fenced` | 加代码围栏输出——贴酒馆 first_mes / 楼层的形态，酒馆助手只渲染围栏内含 body 标签的代码 |
| `… --regex` | 改输出「标记+正则脚本」JSON（酒馆 扩展→正则 导入；标记文本贴进开场白或世界书） |
| `--new` | 输出默认工程 JSON（25 区块全量骨架，核心区块启用，其余停用待启用） |
| `--template <名或序号>` | 官方模板（12 套）起步输出工程 JSON，`--list` 先列清单 |
| `--schema` | 区块类型参考 JSON：每种类型的 name / icon / 全部默认字段 + 内置宏表 |

## 工程 JSON 怎么写

- 顶层字段：`id`（容器前缀 opg-{id}）、`name`、`marker`（正则方案标记文本）、`theme`（配色/材质/背景）、`blocks`（数组顺序即渲染顺序）、`macros`（自定义宏 `[{k:'char',v:'名字'}]`）。手写残缺没关系——缺的区块类型自动补为停用，缺字段填默认值，未知类型剔除
- 区块对象：`{type, enabled, …该类型字段}`——**字段真相以 `--schema` 输出为准**；同 type 可多实例（数组重复出现即可）；停用区块保留在数组里置 `enabled:false`
- 主题：`theme.skin` 只接受 classic/nebula/royal/festival/cyber/abyss/archive（未知回落 classic）；背景归主题所有（`theme.bg`，type 为 gradient/solid/image/noise）；配色自定时保证文字色对背景 ≥4.5:1 对比度

## 文本与宏

- 普通字段（标题/正文/列表行）写**纯文本**，引擎负责 HTML 转义；只有 `freehtml` 区块的 `html` 字段收富文本——它在预览与酒馆里均以完整权限运行，勿粘贴不可信来源的代码；禁 position:fixed、vw/vh（min-height 除外）、Google Fonts、http:// 图源、重复 id，自检会逐条提示
- 构建产物里宏**原样保留**，由酒馆运行时解析：`{{char}}` `{{user}}`（可被工程 macros 覆盖）、`{{random::a::b::c}}`、`{{random_nr::…}}`（相邻不重复）、`{{pick::a::b}}`、`{{roll::1d20}}`、`{{setvar::名::值}}` / `{{getvar::名}}`、`{{date}}` `{{time}}` `{{isotime}}` `{{weekday}}`。完整表见 `--schema` 输出

## 交付前

- 想肉眼核对：`-o preview.html` 后浏览器直开看静态观感（酒馆 API 交互类区块如开场白切换在浏览器里静态降级，真机才完整生效）
- 产物含酒馆 API 调用时自检会提示「预览通过≠真机通过」——API 行为改动收尾须真机验证
- 随机/时间宏在浏览器直开时不会替换（原样显示），属预期；贴进酒馆才解析
