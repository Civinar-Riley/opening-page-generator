# 世界书（World Info / Lorebook）官方文档精要

> 来源：<https://docs.sillytavern.app/usage/core-concepts/worldinfo/>
> 本篇为全文精读整理，正则相关另见 `07-正则表达式资料`。

## 核心概念

世界书 = 动态字典：**仅当关键词出现在消息文本中时**，才把对应条目内容插入提示词。扫描文本 → 命中关键词 → 按插入顺序/预算插入 context。

- 激活关键词、标题等**不会**进入上下文，只有 Content 字段内容会插入，所以每个条目要写成自包含的完整描述
- 条目可互相引用（递归激活）构建网状世界观
- 有灵活的 token 预算控制（Context % / Budget）

## 绑定来源（Lorebook 挂载点）

| 类型 | 说明 |
| --- | --- |
| Character Lore | 角色卡主世界书，导出角色时会内嵌 |
| Persona Lorebook | 挂在用户人设上 |
| Chat Lorebook | 只在当前聊天生效 |
| Global | 全局选择器 |

插入顺序策略：Chat → Persona → Character/Global（均匀排序 / 角色优先 / 全局优先）。

## 条目关键字段

- **Key**：触发关键词，默认不区分大小写；支持正则（见下）
- **Optional Filter**：二级关键词，逻辑 AND ANY / AND ALL / NOT ANY / NOT ALL（同样支持正则）
- **Insertion Order**：数值越大越靠近上下文末尾、影响越大
- **Insertion Position**：角色定义前/后、示例消息前/后、AN 顶部/底部、@D 指定深度（可选 system/user/assistant 角色）、**Outlet**（不自动插入，用 `{{outlet::名字}}` 宏在 Prompt Manager 里手动引用）
- **Strategy**：🔵 常驻（蓝点，无需关键词）/ 🟢 关键词触发（绿点）/ 🔗 向量匹配
- **Probability（触发%）**：概率过滤，可做随机事件
- **Inclusion Group**：同组条目只插入一个，按 Group Weight 随机或按 Order 优先
- **Automation ID**：与快速回复（STscript）联动：条目被激活时自动执行同 ID 的 QR 命令
- **Triggers**：限定激活的生成类型（Normal/Continue/Impersonate/Swipe/Regenerate/Quiet）
- **Timed Effects**：Sticky（激活后保持 N 楼）、Cooldown（冷却 N 楼）、Delay（前 N 楼不激活）

## 全局激活设置

- **Scan Depth**：扫描最近几楼（0 = 只扫递归条目和 AN）
- **Context % / Budget**：世界书可用 token 预算；常驻条目先插入，其次 Order 大的
- **Min Activations / Max Depth**：突破扫描深度向前搜，直到触发足够条目（与 Max Recursion Steps 互斥）
- **Recursive scanning**：条目内容提到其他条目关键词可级联激活；可设 不可被递归 / 阻止继续递归 / 延迟到递归（分级别）
- **Case-sensitive / Match whole words**：大小写敏感、整词匹配（**中文等无空格语言建议关闭整词匹配**）
- **Alert on overflow**：超出预算时警告

## 向量匹配（Vector Storage）

安装并启用 Vector Storage 扩展 + 勾选 "Enable for World Info" 后，🔗 状态条目可按语义相似度激活，不依赖关键词。检索质量取决于 embedding 模型，需要确定性时请用关键词。

## 提示

- 文末推荐的深入教程：[World Info Encyclopedia](https://rentry.co/world-info-encyclopedia)（kingbri / Alicat / Trappu）
- 正则作为 Key 的完整用法（JS 风格 `/…/flags`、`\x01` 分隔符技巧、逐楼匹配）→ [../07-正则表达式资料/正则工具与ST应用.md](../07-正则表达式资料/正则工具与ST应用.md)
