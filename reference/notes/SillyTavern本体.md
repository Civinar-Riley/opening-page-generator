# SillyTavern 本体（酒馆）

> 源码仓库：<https://github.com/SillyTavern/SillyTavern>
> 官方文档：<https://docs.sillytavern.app/>
> 官网：<https://sillytavern.app> | Discord / Reddit: r/SillyTavernAI

## 基本信息

| 项目 | 内容 |
| --- | --- |
| 定位 | LLM Frontend for Power Users（面向高级用户的 LLM 前端） |
| 语言 | JavaScript（前端）+ Node.js（后端） |
| 默认分支 | `release`（稳定版），另有 `staging`（开发版） |
| 许可证 | AGPL-3.0 |
| 规模 | 32.8k+ stars，仓库体积约 215MB |

## 用途与查源码姿势

本仓库是**酒馆本体的全部源码**，做主题/插件开发时主要查：

- `public/` —— 前端代码（UI、CSS、slash 命令实现）
  - `public/script.js` —— 核心前端逻辑
  - `public/scripts/extensions/` —— 内置扩展与第三方扩展目录
  - `public/scripts/slash-commands/` —— 原生 slash 命令注册与解析
  - `public/index.html` —— 页面 DOM 结构（写主题 CSS 选择器必看）
  - `public/css/` —— 原生样式
- `src/` —— Node 后端（API 路由、常量定义等）
  - `src/constants.js` —— 全局常量（API 源列表等，见本目录另一篇笔记）
- `data/<user-handle>/themes/` —— 用户 UI 主题 JSON 存放位置
- `default/content/` 内置扩展 —— 官方扩展源码范例（如 Extension-Dice 同款结构）

## 安装第三方扩展的方式

扩展管理器（ Extensions 抽屉 → Install extension）粘贴 Git URL 安装，或手动 clone 到：

```
SillyTavern/public/scripts/extensions/third-party/<扩展名>/
```

## 相关笔记

- 常量定义（API 源列表）→ [常量定义-API源列表.md](./常量定义-API源列表.md)
- 官方中文文档 → [官方中文文档.md](./官方中文文档.md)
- 世界书与正则 → [世界书WorldInfo精要.md](./世界书WorldInfo精要.md)

## 原文留档

- `99-原文抓取/SillyTavern-README.md`
- `99-原文抓取/SillyTavern-constants.js`（指定 commit `2e3dff73` 版本）
