# 企鹅的酒馆开场页生成器 v1.5.0

为 [SillyTavern](https://github.com/SillyTavern/SillyTavern)（酒馆）角色卡生成开场页组件的本地可视化工具。

通过拖拽、配置区块，一键生成可嵌入酒馆的开场页 HTML 代码，无需手写。

## 功能特性

- **可视化编辑**：拖拽排列区块、一键复制区块、实时预览效果
- **撤销/重做**：Ctrl+Z 撤销、Ctrl+Shift+Z 重做，最多 20 步历史；Ctrl+S 立即保存
- **区块搜索**：按名称实时筛选区块，快速定位
- **全局搜索替换**：跨区块批量查找替换（含角色/图片/曲目/问答子项），支持逐个定位后单处或全部替换
- **区块预设**：欢迎标题/引言/随机事件/骰子内置常用风格模板，一键套用
- **触屏支持**：长按把手拖拽排序，移动端可用
- **丰富区块类型**：对话气泡、图片展示、世界观面板、骰子判定、随机事件等
- **宏语法支持**：`{{random::}}`、`{{roll::}}`、`{{setvar}}/{{getvar}}`、`{{isotime}}` 等酒馆宏自动包装与预览
- **主题预设**：赛博 AI 连接风、奇幻酒馆风等一键套用
- **组件库**：AI 加载动画、心跳好感度条、随机台词框等可复用组件
- **工程管理**：本地存储、导入导出、多工程切换
- **多种导出格式**：开场白版、标记+正则脚本版，适配不同嵌入场景；导出代码带语法高亮

## 快速开始

### 直接使用（推荐）

下载 `dist/index.html`，双击打开即可使用，无需安装任何依赖。

### 从源码构建

```bash
# 1. 安装依赖
npm install

# 2. 构建（正式构建自动压缩 JS/CSS；watch 模式不压缩便于调试）
npm run build

# 3. 运行单元测试（宏引擎 / 数据迁移 / 加解密）
npm test

# 4. 产物在 dist/ 目录下
```

开发时可使用 watch 模式，修改 `src/` 后自动重新构建：

```bash
npm run watch
```

## 项目结构

```
├── src/                     # 源码（开发用）
│   ├── index.html           # 页面骨架
│   ├── css/tool.css         # 工具界面样式
│   └── js/
│       ├── main.js          # 入口
│       ├── utils.js         # 工具函数
│       ├── defs.js          # 区块定义 / 主题预设 / 组件库
│       ├── macros.js        # 宏替换引擎
│       ├── project.js       # 工程管理
│       ├── gen/              # 生成引擎
│       │   ├── index.js      # 入口：build / 完整文档 / 正则脚本
│       │   ├── css.js        # CSS 样式生成
│       │   ├── body.js       # HTML 结构生成
│       │   └── scripts.js    # 运行时脚本（灯箱 / BGM / 酒馆 API）
│       └── ui.js            # 界面渲染
├── tests/                    # 单元测试（vitest：宏引擎 / 数据迁移 / 加解密）
├── dist/                    # 构建产物（单文件 HTML）
├── build.js                 # 构建脚本
├── package.json
└── LICENSE                  # CC BY-NC-SA 4.0
```

## 自定义

- **添加组件**：编辑 `src/js/defs.js` 中的 `COMP_LIB`
- **添加主题预设**：编辑 `src/js/defs.js` 中的 `THEME_PRESETS`
- **添加区块类型**：编辑 `src/js/defs.js` 的 `BLOCK_DEFS` + `BLOCK_ORDER`，渲染逻辑在 `src/js/gen/` 目录

## 注意事项

- 开发版 `src/index.html` 使用 ES Modules，直接双击会被浏览器 CORS 拦截，请使用构建产物或本地静态服务器
- 构建产物 `dist/` 是自包含单文件，可直接分发给酒馆用户

## 📄 许可证

本项目采用 [CC BY-NC-SA 4.0（署名-非商业性使用-相同方式共享 4.0）](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) 协议授权，完整法律文本见仓库中的 `LICENSE` 文件。

---

🐧 感谢使用！遇到问题欢迎反馈日志截图。