# TavernHelper API 契约（gen 生成脚本所依赖）

> 适用范围：本目录生成的运行时脚本 —— `gen/scripts.js` 的 `script()/lightbox()/bgmScript()` 与 `gen/body.js` 内联脚本，以及 `../mvu.js` 生成的状态栏运行时（同属生成产物）。
> 官方文档：https://n0vi028.github.io/JS-Slash-Runner-Doc/
> **新增任何酒馆助手 API 使用前，先在本表登记**（作用/签名/守卫/降级），保持契约与实现同步。

## 运行环境规则

1. 产物是嵌在酒馆消息楼层里的 **iframe**（酒馆助手渲染「``` 代码块内 + 同时含 `<body></body>` 标签」的代码），脚本以 `<script>` 内联于 body 尾部——**IIFE 立即执行即加载时机**
2. **禁止依赖 `DOMContentLoaded`**：产物可能经 `$('body').load(网络链接)` 等方式二次加载，该事件不会触发；需要"加载后执行"一律用 IIFE 直执行（现状）或 jQuery `$(fn)`
3. **所有 API 必须先守卫再调用**：`typeof window['函数名']==='function'`（本目录惯用 `var hasFn=function(n){return typeof window[n]==='function'}` 封装）
4. **返回值可能是 Promise 也可能同步**：统一 `if(r&&typeof r.then==='function')r=await r` 兼容
5. **每个调用点 try/catch + 降级提示**：iframe 内无宿主 toast，用自绘 note 条（fixed 定位，2.2s 自动消失）
6. **无任何 API 的环境**（如普通浏览器直接打开）：显示占位内容，功能静默降级，绝不抛错白屏
7. **脚本字符串由外层模板拼接生成**：运行时脚本内**不得包含反引号与 `${}`**（与外层模板字面量冲突），正则转义注意双写（`\\n`、`\\r`）；闭合标签写 `<\/script>`（build.js 只处理 bundle 层，gen 手写部分自行负责）
8. **楼层本地交互状态必然复位**：楼层 iframe 在重渲染、swipe、刷新后整体重建，组件内折叠/标签页/揭示等用户操作状态**不可持久化**——文档不得声称"记住用户选择"，需记忆的需求应写回聊天数据（当前产物不做）
9. **重读本楼原文用 `getChatMessages(getCurrentMessageId())[0]?.message`**：正则 `$1` 向 HTML 传内容与对原始消息调 `formatAsDisplayedMessage`（会二次执行宏与正则）均为废弃做法，禁止采用
10. **外层标签命名**：依赖标签定位的产物标记须是卡内唯一的 ASCII 小写标识符（字母开头，仅字母/数字/下划线/短横线），**禁用 `think`/`thinking`/`content`**（与预设职责冲突）

## 接口优先级（选择原则）

同一能力存在多层接口时（来源五 StageDog/tavern_helper_template AGENTS 成文），按抽象层次从高到低选择：

1. **酒馆助手封装接口**（本表契约所列：getChatMessages / setChatMessages / getWorldbook / triggerSlash / eventOn…）——抽象层次高、跨酒馆版本相对稳定，**永远首选**
2. **酒馆原生导出**（`window.SillyTavern` / `getContext` / `tavern_events`）——抽象层次低、随酒馆版本漂移，仅作降级路径或封装接口缺失时的兜底（本产物仅 `tavern_events` 事件名读取一处）
3. **STScript DSL**（`/swipe` `/setinput` `/send` 等，经 triggerSlash 执行）——与代码结合困难，仅在无对应封装接口时使用（本产物仅开场白 insert/send 与选项填入三处）

新增 API 使用时先查 1，再查 2，最后才考虑 3；严禁绕过 `hasFn` 守卫直接引用低层接口。

## API 契约表（仅列实际使用的接口）

### 1. getCharacter —— 读取角色卡开场白列表
- 用途：以**角色卡当前数据**为准获取开场白（卡里删掉的开场白立即从列表消失，优于读聊天快照）
- 签名：`getCharacter('current')` → `Promise<{ first_messages: string[] , ... }>`
- 守卫与降级：`hasFn('getCharacter')`；try/catch，失败返回 `null` → 调用方降级读聊天 swipe
- 使用处：`gen/scripts.js` `getCardGreetings()`

### 2. getChatMessages —— 读取第 0 楼消息与 swipe
- 用途：获取聊天第 0 楼的 swipes（创建时的开场白快照）与当前 swipe_id，用于与卡开场白做映射
- 签名：`getChatMessages(0,{include_swipes:true})` → 同步或 `Promise<messages>`；`messages[0]` 含 `{swipes:string[], swipe_id:number}`
- 守卫与降级：`hasFn('getChatMessages')`；Promise 兼容判断；失败 `console.warn` 返回 `null`
- 使用处：`gen/scripts.js` `getChatMsg0()`

### 3. setChatMessages —— 切换开场白（写入第 0 楼）
- 用途：点击开场白选项后跳转。两种形态：`[{message_id:0, swipes:[...] }]` 整体同步（卡里新增而聊天缺的开场白先补进去）；`[{message_id:0, swipe_id:n}]` 按映射索引切换
- 签名：`setChatMessages(msgs)` → 同步或 `Promise`
- 守卫与降级：`hasFn('setChatMessages')`；失败 `note('切换开场白失败：…')`；**API 缺失时仅提示**（`/swipe` 命令只支持 left/right，无法按序号切换，故不做替代实现）
- 使用处：`gen/scripts.js` `goGreeting(i)`

### 4. triggerSlash —— 执行酒馆斜杠命令
- 用途：开场白「填入输入框」模式（`/setinput 文本`）、「直接发送」模式（`/send 文本`）
- 签名：`triggerSlash(cmd)` → `Promise`
- 守卫与降级：`hasFn('triggerSlash')`；try/catch → `note('填入输入框失败')`；缺失时 `note('未检测到酒馆助手 API，无法填入')`
- 使用处：`gen/scripts.js` 开场白 insert/send 分支

### 5. getLorebookEntries / getWorldbook —— 读世界书（开场白标题库）
- 用途：读「标题库」世界书条目（每行 `序号|标题|描述`）覆盖开场白选项的自动提取标题。两代 API 兼容：旧 `getLorebookEntries` 条目名字段是 `comment`，新 `getWorldbook` 是 `name`
- 签名：`getLorebookEntries(书名)` / `getWorldbook(书名)` → `Promise<entries[]>`，条目含 `comment|name` 与 `content`
- 守卫与降级：两者任一存在即可（`hasFn` 判断优先用旧 API）；书未配置 / 条目未命中 / 解析失败 → `titleMap=null`，回退**自动提取**（首行作标题、余行作描述，跳过 HTML 注释与代码围栏）
- 使用处：`gen/scripts.js` `loadTitleMap()`

### 6. eventOn + tavern_events —— 酒馆事件监听（开场白列表实时同步）
- 用途：监听 `MESSAGE_SWIPED / MESSAGE_EDITED / MESSAGE_DELETED / CHAT_CHANGED`，驱动开场白列表重读；另有 3 秒 `setInterval` 轮询兜底（带 `syncing` 重入保护与 `document.hidden` 跳过）
- 签名：`eventOn(事件名, cb)`；事件名取自全局 `tavern_events` 对象（逐个 `undefined/null` 判断后才注册，单个注册失败不影响其余）
- 守卫与降级：`typeof tavern_events==='object' && typeof eventOn==='function'` 整体守卫；缺失时仅靠轮询
- 使用处：`gen/scripts.js` IIFE 事件注册段

### 7. appendInexistentScriptButtons + getButtonEvent —— 注册酒馆脚本按钮（开场白序号跳转）
- 用途：开场白「按钮模式」（clickAction='button'）下向酒馆助手按钮栏注册脚本按钮，点击后输入序号（1 开始）快速跳转；页内列表照常渲染（点选切换不受影响），按钮仅作快捷方式。灵感来源外部「快速切换开局」脚本（只学思路，实现自研）
- 签名：`appendInexistentScriptButtons([{name,visible}])`（去重注册）；`getButtonEvent(name)` → 按钮点击事件名，配 `eventOn` 监听
- 守卫与降级：`hasFn('appendInexistentScriptButtons') && hasFn('getButtonEvent')` 双守卫；try/catch；任一缺失 → **静默跳过注册**（页内列表仍可点选，功能不受影响）
- 使用处：`gen/scripts.js` `script()` button 模式注册段

### 8. SillyTavern.callGenericPopup —— 弹出输入（酒馆原生导出，接口优先级第 2 层）
- 用途：按钮模式点击按钮后的序号输入弹窗（1 开始，与页内列表序号一致）。酒馆助手封装接口无对应输入能力，按「接口优先级」取第 2 层（酒馆原生导出）
- 签名：`SillyTavern.callGenericPopup(文案, SillyTavern.POPUP_TYPE.INPUT)` → `Promise<输入值|false>`（取消返回 false）
- 守卫与降级：`typeof window.SillyTavern==='object' && SillyTavern.POPUP_TYPE && typeof callGenericPopup==='function'` 整体守卫；try/catch；缺失时 `note('未检测到弹出输入，请直接点击页内列表选项')`；输入非有效序号 → `note('未填入有效开局号')`
- 使用处：`gen/scripts.js` `script()` button 模式点击处理

### 9. playAudio / pauseAudio / getCurrentAudio / setAudioSettings —— 酒馆助手音频播放器（≥4.0.0，接续播放修复需 ≥4.3.5）
- 用途：BGM 区块在酒馆内改走音频播放器双通道（`'bgm'`）：播放列表绑定聊天文件——切楼不重播、刷新接续播放，解决裸 `<audio>` 多楼同播/切楼断音的痛点
- 签名：`playAudio(type,{title,url})`（不在列表自动加入）/ `pauseAudio(type)` / `getCurrentAudio(type)` → `{src,title,playing,progress}` / `setAudioSettings(type,{volume,muted,mode})`（mode: `repeat_one|repeat_all|shuffle|…`）
- 守卫与降级：`typeof playAudio==='function' && typeof pauseAudio==='function'` 双守卫（`bgmScript` 内 `TA` 标志）；轮询进度 `getCurrentAudio` 每处 try/catch；任一缺失 → 整体回落本地 `<audio>` 播放器（原行为，多楼各自播放）
- 使用处：`gen/scripts.js` `bgmScript()` TA 分支

### 10. toastr —— 酒馆内置弹窗（iframe 内全局可用）
- 用途：产物内轻提示统一酒馆风格（替代自绘 note 条）
- 签名：`toastr.info(text, title, opts)`
- 守卫与降级：`typeof toastr!=='undefined' && typeof toastr.info==='function'`；try/catch 包裹；缺失 → 自绘 note 浮层（2.2s 自动消失）
- 使用处：`gen/scripts.js` `script()` 的 `note()` 与 `bgmScript()` 的 `noteTa()`

### 11. Mvu —— MVU 变量框架全局接口（`mvu.js` 生成的状态栏运行时）
- 用途：读当前楼层 `stat_data` 渲染状态面板；监听变量更新自动重渲染
- 签名：`waitGlobalInitialized('Mvu')` → Promise（等全局接口就绪）；`Mvu.getMvuData({type:'message',message_id})` → `{stat_data,…}`；`Mvu.events.VARIABLE_UPDATE_ENDED` 事件名
- 守卫与降级：`typeof Mvu!=='undefined' && typeof waitGlobalInitialized==='function'`；getMvuData/waitGlobalInitialized 全程 try/catch；Mvu 缺失 → 降级 `getVariables({type:'message'})` 读 `stat_data`；再缺失 → 轮询 20×200ms 后显示「未读取到变量」提示（绝不白屏）
- 使用处：`mvu.js` `buildStatusbarHtml()` 运行时

### 12. getVariables —— 读楼层变量（状态栏降级路径）
- 签名：`getVariables({type:'message'})` → 同步或 Promise<变量对象>
- 守卫与降级：`typeof getVariables==='function'`；缺失时轮询超限后提示安装 MVU
- 使用处：`mvu.js` 状态栏运行时（Mvu 缺失时）

### 13. getCurrentMessageId —— 取所在楼层号（状态栏定位自己的楼层变量）
- 签名：`getCurrentMessageId()` → number
- 守卫与降级：`typeof getCurrentMessageId==='function'`；缺失传 `undefined` 由 Mvu 取默认楼层
- 使用处：`mvu.js` 状态栏运行时

### 14. 渲染器 CSS 类 char-avatar / user-avatar 与宏 {{charAvatarPath}} / {{userAvatarPath}}（零 JS，无 API 依赖）
- 用途：角色简介区头像「零 JS 方案」——容器加 `char-avatar`/`user-avatar` 类，渲染器自动注入对应头像为背景图（仅 background-image，尺寸/圆角等由产物样式自理）
- 守卫与降级：非 API，无需守卫；无渲染器的环境（工具预览/普通浏览器）显示占位底色
- 使用处：`gen/body.js` profile 区块（characters[].avatarMode='char'|'user'）、`gen/css.js` `.opg-avatar` 背景兜底

### 15. 未使用 API 的生成脚本（明确无依赖，列出防误加）
- `lightbox()`：纯 DOM，无酒馆 API（`bgmScript` 见 §9）
- `gen/body.js` 倒计时 / 粒子内联脚本：纯 DOM + 访问者本地时间（`Date.now()`），与酒馆时区无关

### 16. 已评估可用的备用接口（登记备用，产物暂未使用——启用前先真机验证）

来源：TavernHelper @types 官方声明（墨月本地写卡工坊核对副本）+ 墨月前端规范实测。按「接口优先级」均属第 1 层封装接口，启用时照 §运行环境规则 3-5 守卫。

| 接口 | 用途 | 签名要点 | 注意 |
|------|------|---------|------|
| `getAudioList / replaceAudioList / appendAudioList` | BGM 区块整列表绑定音频播放器（切歌而非单曲） | `replaceAudioList('bgm', [{title,url},…])` | 与 §9 同通道；需 ≥4.0.0，改列表前先 `getAudioList` 比对避免重复注入 |
| `playAudio('ambient',…)` | 独立于 BGM 的环境音/音效通道（按钮/灯箱点击音效） | 同 §9，type 换 `'ambient'` | 需用户自配音效 URL；两通道音量独立 |
| `getAudioSettings(type)` | 回显播放模式/音量到 UI | 返回 `{volume,muted,mode}`；mode 含 `play_one_and_stop` | 仅读，不写回 |
| `createChatMessages([{role,message}],{insert_before,refresh})` | 按钮发送消息的官方推荐模式（比拼文本进 `/send` 多一层控制，防转义问题） | 发送后配 `triggerSlash('/trigger')` | 必须防重复点击（生成中禁用按钮）；`refresh:'none'` 可免整页刷新 |
| `deleteChatMessages / rotateChatMessages` | 「清除聊天重新开局」类按钮（理论可用） | `deleteChatMessages(start,end)` | 破坏性操作，启用前必须二次确认弹窗 |
| `refreshOneMessage(message_id)` | 强制重渲染某楼层（列表同步兜底） | 同步或 Promise | 与 §6 事件监听互补 |
| `MESSAGE_UPDATED / MESSAGE_SWIPE_DELETED / MORE_MESSAGES_LOADED` | 补齐开场白同步盲区（编辑刷新、删 swipe、向上翻页加载旧消息时第 0 楼可能变化） | 同 §6 `eventOn` 注册 | 逐个守卫，单个注册失败不影响其余 |
| `errorCatched(fn)` | 启动函数包裹：报错转酒馆通知弹窗（比裸 try/catch 提示更统一） | `$(errorCatched(init))` | iframe 产物内建议替代裸 catch 的 UI 提示 |
| `getTavernHelperVersion()` | 兼容性门槛判断（如音频 API 需 ≥4.3.5） | 返回版本字符串 | 缺失时视为旧版，走降级路径 |
| `waitGlobalInitialized(name)` | 等待全局共享接口就绪（§11 Mvu 已用；其他全局接口同理） | → Promise | 超时须有降级 |

**变量写入类 API（`insertOrAssignVariables` 等）**：TAVERN_API.md 维持「产物不写回变量/楼层」的既有边界（见仓库根 AGENTS.md 同层原理备忘），未评估前不登记使用。

## 降级矩阵（无 API 环境的用户所见）

| 缺失 API | 用户所见 |
|----------|---------|
| getCharacter | 开场白列表降级读聊天 swipe（getChatMessages 可用时） |
| getChatMessages | 列表显示卡开场白；都缺则保留渲染时的静态占位列表 |
| setChatMessages | 点选项弹 note「未检测到酒馆助手 setChatMessages API，无法切换开场白」 |
| triggerSlash | 弹 note「未检测到酒馆助手 API，无法填入」 |
| getLorebookEntries / getWorldbook | 标题/描述自动提取（无需配置，永不出错） |
| eventOn / tavern_events | 列表同步退化为 3 秒轮询 |
| appendInexistentScriptButtons / getButtonEvent | 静默跳过按钮注册（页内列表仍可点选，功能不受影响） |
| SillyTavern.callGenericPopup | 点按钮弹 note「未检测到弹出输入，请直接点击页内列表选项」 |
| playAudio / pauseAudio（音频 API） | BGM 回落本地 `<audio>` 播放器（多楼层可能各自播放） |
| Mvu / getVariables（状态栏） | 轮询 20×200ms 后显示「未读取到楼层变量 stat_data」提示与安装指引 |
| toastr | 降级自绘 note 浮层（视觉差异仅此而已） |
| 全部缺失（普通浏览器） | 静态占位内容完整可见，无任何报错 |

## 参考

- 官方文档（接口说明与示例）：https://n0vi028.github.io/JS-Slash-Runner-Doc/
- 修改 `gen/scripts.js` / `mvu.js` 后：核对本文档契约 → `npm test` → `npm run build` → 在真实酒馆环境冒烟一次（列表渲染/切换/选项填入/BGM 接续/状态栏读数）
- 版本基线：酒馆助手 ≥ 4.6.0（SillyTavern ≥ 1.12.13）解锁全部能力；BGM 音频 API ≥ 4.3.5；其余守卫式 API 无硬性版本要求
