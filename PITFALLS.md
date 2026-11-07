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
14. **撤销快照在「改动之后」拍**：saveSnapshot 存的是改动后状态——先拍快照再改数据时，拍的
    内容与栈顶相同被去重**静默吞掉**（project.js 直接 return），改动后的状态永不入栈：一次
    Ctrl+Z 连跳两步、redo 永远回不到已写入态（v1.27.1 漫画导入「应用到区块」踩过）。凡
    「await 确认 → 改数据」的处理器，saveSnapshot 放赋值之后；blockEditors 清空漫画页的
    「先拍 + 改完补拍」写法碰巧有效但冗余，别模仿。

## 五、构建 / 验证 / 提交

15. **lint 报错先读规则头注释**——每条规则都写着为什么存在（多是事故换来的），绕过即重蹈。
16. **浏览器冒烟陷阱**（IAB 门面实测）：
    - `fill()` 不触发 `change`——依赖 change 落盘的输入，测试时要
      `dispatchEvent(new Event('change',{bubbles:true}))` 或真实失焦；别信「填了就生效」；
    - locator 可达名带 emoji 常匹配不上，改在 evaluate 里 querySelector 后派发 click；
    - `tab.playwright.keyboard` 不存在，发 Esc 用 `tab.cua.keypress({keys:['Escape']})`；
    - `file://` 不能导航，先起本地静态服务再开 127.0.0.1；
    - 预览页有**两个 iframe，第二个才是预览帧**（第一个是外框）。
17. **看着像坑但别动**：dist 里二十多个 `<style>` 全是组件字符串内嵌样式（组件插入时才解析，
    合并破坏自包含硬约束）；`core.js` 不加 beforeunload（pagehide 已同步强写兜底，弹窗纯打扰）；
    `src/` 就是未压缩源码，别想着给 dist 留可读版。
18. **提交前 `git status --short` 核对**——v1.19 漏 add 过 renderHelp.js（amend 补救）。
    推送走项目级代理 `http.proxy=127.0.0.1:7897`（配置与排查见 AGENTS.md 顶部）。
19. **零依赖走 HTTP 代理出网**：Node 全局 fetch 只认 `NODE_USE_ENV_PROXY=1` 的环境变量路径
    （且进程环境在启动时固定——改了系统代理后必须重启服务进程才生效，v1.21 实测踩过）。
    要运行时指定代理只能手工 CONNECT 隧道（net 连代理 → CONNECT 域名:443 → tls 包隧道）。
    **坑**：预连 socket 用 `https.Agent({createConnection})` 或 `agent:false+createConnection`
    封装，实测握手正常但请求永远无响应——直接在 tls socket 上手写 HTTP 请求最稳
    （`Connection: close` 读到尾 + chunked 解码，先例见 scripts/nh-import.mjs 的 proxyGet）。
    顺带：spawn 的工作目录被删会让整个 shell 工具链 ENOENT（报错指向 bash.exe 缺失，
    实为 cwd 缺失），先重建目录再 cd 走。
20. **构建期内嵌的资源改完必须重建**（v1.26 助手小包）：`build.js` 把 ZIP 以 base64 注进
    `window.OPG_HELPER_ZIP`，改 `scripts/nh-import.mjs` 等四件套后不 `npm run build`，
    单文件里就是过期小包——用户下载到的助手版本与工具不符。两条闸门挡这个：
    `smoke-static.mjs` 断言「内嵌 === 用当前脚本现组装」，`smoke-browser.mjs` 真实点按钮
    下载再比字节。别绕过它们，也别把 ZIP 改成 deflate（固定 store-only + 固定时间戳才保证
    同输入同字节，压缩会让字节随 zlib 版本浮动，两处比对就失去意义）。
21. **`fs.watch` 递归在 Windows 上只覆盖一层子目录**：watch 模式原先只盯 `src/`，现在补了
    `scripts/` 的平铺监听（`HELPER_WATCH` 白名单）。若以后把小包脚本挪进子目录，监听要跟着调。
22. **「同输入同字节」必须先解决行尾**（v1.26.1 实发版本抓到）：v1.26.0 的 Release 资产比本地
    小 416 字节，根因是 `opg-nh.bat` 在 CI（Linux 检出）是 LF、本地（Windows 检出）是 CRLF。
    凡是把仓库文件内容打进产物再跨平台比对的场景，**读盘后立刻按目标平台归一化行尾**再算
    哈希/CRC——固定 DOS 时间戳只解决了「时间戳浮动」，行尾是另一半。现在的做法是在
    `helperFiles` 出口统一 `normalizeEol`（bat→CRLF、其余→LF），并配 `.gitattributes`。
23. **gen.test.js 的字符串断言钉住运行时脚本内部变量名**（`ACT`→`CFG`、`META`、`WALL`、`NAMES`、
    `BTN` 等）——这是有意为之，锁的是产物脚本的形状。重构 scripts.js 的配置结构时这些断言会
    连环红，属预期：同步更新断言即可，别为绿测在模板里保留旧变量名（v1.27.1 多实例重构的处理方式）。
24. **切段与匹配共用同一字符类时，段内正则的同类兜底是死代码**：parsePageExpr 先按
    `[,，、\s]+` 切段，段内正则 `\s*[-~～]\s*` 的空格兜底永远匹配不到——`1 - 20` 被拆成
    '1'/'-'/'20' 静默只取两端点（v1.27.1 修复，归一化放切段之前）。写「先 split 再 match」
    的解析时先想清楚分隔符由谁消费。

## 六、工具界面 DOM / CSS

25. **同级 z-index 弹层按 DOM 顺序绘制**：统一模态（`.opg-modal-root`，2147483647）与自绘
    fixed 弹层（搜索替换/写卡同为 2147483647）叠放时，后 append 的盖住先 append 的——
    `_modalRoot` 首次确认后常驻 body，会话内第二个才打开的自绘弹层会把确认框盖在底下
    （不可见不可点，看似按钮失灵，v1.27.1 修复）。现在 `_showModal` 每次弹出重挂 body 末尾。
    **不能反过来调低自绘弹层的 z-index**：tool.css 主题纹理层 `body::before` 用
    z-index 2147483646（pointer-events:none 但绘制在上），弹层降到 100 以下纹理会浮在弹层上
    （组件库选择器 z-index:100 就带着这层纹理，属已知观感）。
26. **新增自绘弹层必须挂 `.opg-ov` 类**：core.js 的 Ctrl+Z/Ctrl+Y 与扩展环境 Esc 守卫只认
    `.opg-modal-root.show` 与 `.opg-ov`；漏挂的弹层打开时按 Ctrl+Z 照样 undo，renderAll 重建
    数据后弹层闭包把输入写进已回退的旧对象——用户看到「插入成功」，重渲染后内容消失
    （v1.27.1 组件库选择器踩过）。现存四个：组件库选择器 / 搜索替换 / 新建工程 / 写卡弹窗。
