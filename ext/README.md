# 开场页工坊 · SillyTavern 扩展（extension 分支）

本分支把「开场页生成器」打包成 SillyTavern 扩展：扩展抽屉里出现「📜 开场页工坊」面板，点击后全屏打开完整的可视化编排工具；工坊内「导出 → 📤 写入角色卡」可把生成文档**直写当前酒馆的角色卡**（first_mes / alternate_greetings），免复制粘贴。

## 安装

SillyTavern → 扩展（Extensions）抽屉 → Install extension：

- **URL**：`https://github.com/Civinar-Riley/opening-page-generator`
- **Branch or tag name**：`extension`（必填，本扩展只在 extension 分支发布）

安装后刷新页面（或 `/reload-page`）生效。非官方源会弹安全确认，属正常流程。

## 更新

扩展管理器里对该扩展点 **Update** 即可（等价于对本分支 `git pull`；`auto_update` 已关闭，避免半成品自动更新）。更新后如页面行为异常，刷新一次酒馆。

## 工坊内新增能力（相对独立单文件版）

- **📤 写入角色卡**（导出页「① 开场白版」按钮行）：选目标卡 → 选写入目标（覆盖主开场白 / 追加为新开场白）→ 写前确认（覆盖模式有不可恢复警告的二次确认）→ 经 `/api/characters/merge-attributes` 直写；写入时默认提取所选卡的实际开场白（first_mes + 备用开场白）烘焙进开场白选择区静态列表，替代编辑器占位文本，可勾选关闭。覆盖 first_mes 只影响**新聊天**；追加会排在现有开场白列表末尾。
- **🤖 AI 助手直连酒馆主 AI**（AI 助手页「连接模式」单选，装了酒馆助手时出现）：选「酒馆当前连接」即走酒馆当前连的 API——Key / 代理 / 模型 / 参数全复用，**无需在本工具填任何配置**；经 `TavernHelper.generateRaw` 以 `ordered_prompts` + `should_silence` 静默生成，不带酒馆预设污染。想用自己的 OpenAI 兼容接口则切回「自定义」（Key 仍只本地保存，导出工程自动剔除）。没装酒馆助手时该选项不出现，界面与独立版一致。
- **Esc 关闭工坊**：工具 iframe 获焦后宿主收不到按键，工具侧会转发关闭请求；工坊内弹窗打开时 Esc 只关弹窗，不会误关工坊。
- **编辑自动落盘**：关闭工坊 / 切换聊天导致 iframe 被拆毁时，保存防抖窗口（600ms）内的编辑也会同步写一次 localStorage，不丢数据。

## 本分支结构

```
manifest.json   ST 扩展清单（version 与 package.json 同步手动维护）
ext/index.js    胶水入口：抽屉面板 + 全屏 overlay + __OPG_EXT__ 桥（listCards / writeToCard / aiAvailable / aiGenerate）
ext/overlay.css overlay 与面板样式
tool.html       工具本体（npm run build:ext 由 dist/index.html 复制生成，随分支提交）
```

## 维护（开发者）

main 分支为主开发线；本分支 = main + 上述胶水文件。**日常同步双击根目录 `sync-extension.bat` 即可**——工作区需干净，脚本自动完成：checkout extension → merge main → `build:ext` 重建 tool.html → lint / 测试 → 提交推送 → 切回原分支（合并冲突自动中止回退，测试不过不推送）。

手动等价流程（或脚本失败后排查用）：

```
git checkout extension
git merge main
npm run build:ext
npm run lint && npx vitest run
git add -A && git commit -m "chore: sync extension 分支（main@<短hash>）" && git push origin extension
```

tool.html 是构建产物，merge 后必须重新 `build:ext` 再提交。`manifest.json` 的 version 在功能同步时手动与 `package.json` 对齐。
