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

- **📤 写入角色卡**（导出页「① 开场白版」按钮行）：选目标卡 → 选写入目标（覆盖主开场白 / 追加为新开场白）→ 写前确认（覆盖模式有不可恢复警告的二次确认）→ 经 `/api/characters/merge-attributes` 直写。覆盖 first_mes 只影响**新聊天**；追加会排在现有开场白列表末尾。

## 本分支结构

```
manifest.json   ST 扩展清单（version 与 package.json 同步手动维护）
ext/index.js    胶水入口：抽屉面板 + 全屏 overlay + __OPG_EXT__ 桥（listCards / writeToCard）
ext/overlay.css overlay 与面板样式
tool.html       工具本体（npm run build:ext 由 dist/index.html 复制生成，随分支提交）
```

## 维护（开发者）

main 分支为主开发线；本分支 = main + 上述胶水文件。同步流程：

```
git checkout extension
git merge main
npm run build:ext
npm run lint && npx vitest run
git add -A && git commit -m "chore: sync extension 分支（main@<短hash>）" && git push origin extension
```

tool.html 是构建产物，merge 后必须重新 `build:ext` 再提交。`manifest.json` 的 version 在功能同步时手动与 `package.json` 对齐。
