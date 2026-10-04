# PITFALLS — 防踩坑清单

> 本仓库**实际踩过**的坑，按「什么时候会踩」组织；每条都是发生过的问题（附版本/场景），
> 不收通用最佳实践。规则类防线（lint/build 闸门）只指路不展开——防线本身是活文档。
> 动手前先读 AGENTS.md 的硬约束；写代码时本清单当检查表用。

## 一、写产物 / 组件代码时

1. **JS 源码（含注释文字！）禁止字面 `<!--`**。bundle 整体嵌在 HTML `<script>` 里，HTML 解析器
   遇 `<!--` 进入转义态，其后 `</script>` 全部失效——**整包被静默吞掉、零报错白屏**（v1.13.0 事故）。
   要输出 HTML 注释用拆接：`const MCMT=['<!','--'].join('')`（defs.js 音乐播放器先例）。
   别在注释里举例写 `<!--`，lint 规则 6 会拦（v1.19 被自己的注释拦过一次）。
2. **别指望 `'\u003c'` 转义**：esbuild minify 会把 `\u003c` 还原成字面 `<`，只保护源码不保护产物。
   拆接 join 是唯一可靠写法（见 gen/index.js greetSnapshotLines 注释）。
3. **产物运行时脚本内禁反引号与 `${}`**（外层是模板字面量）。需要 build 期注入的值在生成期烘焙成
   **字面量**（backHomeScript 的主题色做法），不要留运行时拼接——测试断言与排查都会变难（v1.18 教训）。
4. **第三方图标/字体不进产物，外链 demo 数据不给默认值**：图标用 emoji 或内联 CSS 动画
   （FA 署名义务已于 v1.19 清零，别再引回来）；组件默认数据留空 + 空值降级
   （音乐播放器 `data-src` 空则整体隐藏 + 组件内注释提示）。
5. **`onerror="this.style.display='none'"` 图片回落是惯用法，不是待清理的内联事件**——
   无脚本组件靠它优雅降级，改成 addEventListener 反而要给纯 CSS 组件强加脚本。
   要清理的是内联 `onclick=`（组件交互一律 IIFE + addEventListener + `data-bound` 防重绑）。
6. **`</script>` 一律写 `<\/script>`**（build.js 只处理 bundle 层，gen/defs 手写字符串自行负责）。

## 二、给组件加 `<script>` 时——三处同步

7. tests/complib.test.js 的 **`SCRIPT_OK` 特例表**、AGENTS.md **硬约束 1** 的特例列举、组件自身
   **IIFE + `data-bound` 防重绑**——漏任何一处测试就红（v1.19 加「点击切换消息」时漏了 SCRIPT_OK）。

## 三、酒馆运行时（gen/）

8. **swipe 切换 = 第 0 楼 iframe 整体重建**：楼内脚本与状态全灭。「切走后还要存在」的需求
   （返回按钮、持续音频）必须由不随楼层销毁的角色脚本注入宿主文档，或挂宿主文档
   （TAVERN_API.md 规则 11/12）——返回开场页功能因此做成了导出的角色脚本 JSON 而非产物区块。
9. **酒馆 API 返回值可能是 Promise 也可能是同步**：统一
   `if(r&&typeof r.then==='function')r=await r`。外部参考脚本常漏这条（wobushirenji 返回件的
   `getChatMessages` 就没兼容，Promise 形态下永远走降级）。
10. **导出角色脚本 JSON** 的字段形状照抄 v1.18 `Gen.backHomeScript`（type/enabled/name/id/
    content/info/button/data/export_with），别自己发明结构。
11. **hex8 透明度**（`${primary}59`）要求 6 位 hex——带非 hex 回退兜底；新 API 用前先在
    gen/TAVERN_API.md 登记（守卫/Promise 兼容/降级三件套）。

## 四、工程数据

12. **新增工程级字段三件套**：defs.js `defaultProject()` + project.js `normalize`（注意它的
    补齐白名单数组是手写的，def 里加字段不会自动生效）+ project.test.js 用例
    （backHome、rememberKey 都走这套）。
13. **会话级敏感数据**（API Key 类）：模块级变量暂存 + normalize 默认值 + `exportData` 剔除，
    三处联动；任何「记住我」开关关掉时必须顺手清已落盘的旧值。

## 五、构建 / 验证 / 提交

14. **lint 报错先读规则头注释**——每条规则都写着为什么存在（多是事故换来的），绕过即重蹈。
15. **浏览器冒烟陷阱**（IAB 门面实测）：
    - `fill()` 不触发 `change`——依赖 change 落盘的输入，测试时要
      `dispatchEvent(new Event('change',{bubbles:true}))` 或真实失焦；别信「填了就生效」；
    - locator 可达名带 emoji 常匹配不上，改在 evaluate 里 querySelector 后派发 click；
    - `tab.playwright.keyboard` 不存在，发 Esc 用 `tab.cua.keypress({keys:['Escape']})`；
    - `file://` 不能导航，先起本地静态服务再开 127.0.0.1；
    - 预览页有**两个 iframe，第二个才是预览帧**（第一个是外框）。
16. **看着像坑但别动**：dist 里二十多个 `<style>` 全是组件字符串内嵌样式（组件插入时才解析，
    合并破坏自包含硬约束）；`core.js` 不加 beforeunload（pagehide 已同步强写兜底，弹窗纯打扰）；
    `src/` 就是未压缩源码，别想着给 dist 留可读版。
17. **提交前 `git status --short` 核对**——v1.19 漏 add 过 renderHelp.js（amend 补救）。
    推送走项目级代理 `http.proxy=127.0.0.1:7897`（配置与排查见 AGENTS.md 顶部）。
18. **零依赖走 HTTP 代理出网**：Node 全局 fetch 只认 `NODE_USE_ENV_PROXY=1` 的环境变量路径
    （且进程环境在启动时固定——改了系统代理后必须重启服务进程才生效，v1.21 实测踩过）。
    要运行时指定代理只能手工 CONNECT 隧道（net 连代理 → CONNECT 域名:443 → tls 包隧道）。
    **坑**：预连 socket 用 `https.Agent({createConnection})` 或 `agent:false+createConnection`
    封装，实测握手正常但请求永远无响应——直接在 tls socket 上手写 HTTP 请求最稳
    （`Connection: close` 读到尾 + chunked 解码，先例见 scripts/nh-import.mjs 的 proxyGet）。
    顺带：spawn 的工作目录被删会让整个 shell 工具链 ENOENT（报错指向 bash.exe 缺失，
    实为 cwd 缺失），先重建目录再 cd 走。
