# reference/ —— 外部参考资料

> 本目录为**只读参考**，不参与构建（lint/test/build 只扫描 `src/`）。
> 来源：本地资料库 `整理后的SillyTavern资料`（2026-08-31 整理），筛选与本项目（开场页生成器）相关部分。

## 目录

| 路径 | 内容 | 与本项目的关系 |
| --- | --- | --- |
| `tavern-helper/` | 酒馆助手官方文档 66 篇 md 源文件 + 文档导航 + 插件本体说明 | `src/js/gen/TAVERN_API.md` 契约的权威对照源；渲染器渲染条件、前端编写问题、各 API 模块 |
| `api-types/` | 酒馆助手 API 接口定义（22 个 `.d.ts`） | 新增 API 使用、核对签名/返回值时速查 |
| `slash-commands/酒馆命令手册.md` | ST slash 命令速查（社区整理） | `triggerSlash` 所用命令（`/setinput` `/send` `/closechat` …）自查 |
| `notes/` | 实战开发要点笔记、常用资料链接、开场白与提示词模板、简易开场白选择示例脚本、ST 本体 4 篇 | 踩坑经验（如 `/sendas` bug）；「开场白选择」区块文案与实现参考 |
| `template-agents.md` | `tavern_helper_template` 的 AGENTS.md | `TAVERN_API.md`「接口优先级（抽象层次从高到低）」原则的出处（来源五） |

## 出处与许可证

- 酒馆助手官方文档：[n0vi028/JS-Slash-Runner-Doc](https://github.com/n0vi028/JS-Slash-Runner-Doc)（VitePress，可离线阅读）
- 酒馆助手插件本体：[n0vi028/JS-Slash-Runner](https://github.com/n0vi028/JS-Slash-Runner)（许可证 Aladdin）
- 酒馆命令手册：社区整理 <https://rentry.org/sillytavern-script-book>
- `template-agents.md`：[StageDog/tavern_helper_template](https://github.com/StageDog/tavern_helper_template)
- 其余笔记为资料库整理稿（各文件头部标注原始出处）

本目录仅供开发参考，版权归原作者所有；更新资料请回源重新复制。
