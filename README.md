# Hanako Memory System v2

基于 Obsidian 知识图谱的 Agent 自我改进记忆系统。

适用于 Hanako 及其他 OpenClaw 兼容的 AI Agent 环境。支持从对话中自动提取结构化记忆，以 Obsidian 双链笔记的形式持久化存储，并在新会话开始时自动注入相关上下文。

---

## 设计参考

本项目融合了三个开源项目的核心思想：

| 项目 | 贡献 | 体现位置 |
|---|---|---|
| [graph-memory](https://github.com/adoresever/graph-memory) | 三元组提取模式——从对话中提取实体→关系→实体 | `memory-extract` 工具的提取 JSON 格式 |
| [self-improving-agent](https://github.com/peterskoett/self-improving-agent) | 学习/错误双层记录 + 会话注入提醒 | `学习/` 和 `错误/` 目录结构，`context.md` 自动注入 |
| [openclaw/skills](https://github.com/openclaw/skills) | SKILL.md 标准化 + lazy-load 模式 | 实体笔记的标准模板结构 |

---

## 架构

```
对话中 ──→ LLM 提取三元组 ──→ memory-extract 工具
                                    │
会话开始 ←── memory-context 注入 ←──┘
                                    │
                              Obsidian vault
                             ┌──────────────┐
                             │  记忆/         │
                             │    context.md  │ ← 自动维护的上下文
                             │    实体/       │ ← 人物/项目/技能/概念
                             │    关系/       │ ← 显式关系（可选）
                             │    学习/       │ ← 偏好/纠正/洞察
                             │    错误/       │ ← 独立记录+实体引用
                             └──────────────┘
```

**关键设计决策：**

- **纯 JS 实现**：无 Python 依赖，无 shell 调用，无命令注入风险
- **Obsidian 原生**：存储为标准 `.md` + frontmatter + `[[双链]]`，兼容 Dataview 查询和知识图谱可视化
- **双层错误记录**：错误同时写入独立文件（完整上下文）和关联实体笔记（双链引用）
- **智能注入**：上下文包含近期日记摘要 + 高优先级学习 + 待修复错误

---

## 安装

### 前置要求

- Node.js >= 18
- 一个 Hanako（或 OpenClaw）环境
- 一个 Obsidian vault（用于存储记忆数据）

### 步骤

1. 将 `hanako-memory-plugin/` 放入 Hanako 的 plugins 目录：

```
.hanako/plugins/hanako-memory-plugin/
```

2. 在 Hanako 的配置中设置 Obsidian vault 路径：

```json
{
  "plugins": {
    "hanako-memory-plugin": {
      "vaultPath": "W:/Games/Obsidian/Work/无极限"
    }
  }
}
```

3. 重启 Hanako。插件会在首次使用时自动初始化 `记忆/` 目录结构。

---

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `vaultPath` | string | `W:/Games/Obsidian/Work/无极限` | Obsidian vault 根路径 |
| `autoExtract` | boolean | `true` | 对话结束时自动提取记忆 |
| `autoContext` | boolean | `true` | 会话开始时自动注入上下文 |
| `maxContextTokens` | number | `2000` | 最大上下文 token 数 |

---

## 工具参考

系统提供 5 个工具，供 Agent（LLM）在对话中调用：

### memory-context

会话开始时静默调用。读取近期日记摘要、高优先级学习、待修复错误，注入 system prompt。

**参数：** `maxTokens`（可选，默认 2000）

### memory-extract

重要对话结束时调用。接收 LLM 生成的结构化 JSON，批量写入实体、关系、学习、错误。

**参数：** `extraction`（必需）

```json
{
  "entities": [
    {"name": "冰原晶狐", "type": "世界观生物", "properties": {...}, "tags": [...]}
  ],
  "relations": [
    {"from": "冰原晶狐", "to": "隙光纪行", "type": "belongs_to"}
  ],
  "learnings": [
    {"content": "偏好用世界观生物传递温度", "category": "preference", "priority": "high"}
  ],
  "errors": [
    {"content": "冰原晶狐与白狗设定冲突", "severity": "medium", "relatedEntity": "冰原晶狐"}
  ]
}
```

### memory-search

关键词搜索记忆系统。

**参数：** `query`（必需）

### memory-stats

获取记忆系统统计信息（无参数）。

### memory-entity

单个实体笔记的 CRUD 操作。

**参数：** `action`（create/read/update），`name`，`type`，`path` 等

---

## 实体笔记格式

每个实体是一个标准化的 Obsidian 笔记：

```markdown
---
type: 项目
created: 2026-04-30
updated: 2026-04-30
tags: [OC, 创作, memory]
---
# 隙光纪行

## 属性
- **规模**: 约2000章
- **风格**: 日常向
- **模式**: AI初稿 + 人工精修

## 关系
- 主角:: [[月曦夜]]
- belongs_to:: [[OC创作]]

## 相关学习
- [[学习/2026-04-30-偏好用生物传递温度]]

## 相关错误
- [[错误/2026-04-30-第三章风格偏移]]
```

兼容 Obsidian Dataview 内联字段和图谱视图。

---

## 双/层错误记录

**层 1（独立记录）：** 写入 `记忆/错误/`，包含完整上下文、严重程度、关联实体、修复状态。

**层 2（实体引用）：** 在关联实体笔记的 `## 相关错误` 区块添加双链引用。

修复后更新独立记录中的状态字段，实体笔记的引用会自然显示最新状态。

---

## 使用示例

### 首次使用

```text
Agent 在对话开始前自动调用 memory-context：
→ 返回空上下文（记忆目录初始为空）

Agent 检测到用户未设置记忆目录：
→ 自动调用 memory-extract 的 init 逻辑
→ 创建 记忆/ 目录结构 + context.md
```

### 对话中

```text
用户："我设计了一个新生物叫冰原晶狐，它能感知裂隙异常。"

Agent 判断这是一个重要实体：
→ 记录在对话内部
→ 对话结束时调用 memory-extract
→ 写入 记忆/实体/世界观生物/冰原晶狐.md
→ 与 记忆/实体/项目/隙光纪行.md 建立双链关系
```

### 后续会话

```text
Agent 自动调用 memory-context：
→ 读取 context.md
→ 扫描近期日记
→ 发现冰原晶狐是高优先级学习
→ 注入 system prompt

用户（无需主动提及）：
Agent 已了解冰原晶狐的存在和相关设定。
```

---

## 与平台内置记忆的分工

| 功能 | 平台内置 Memory | 本系统 |
|---|---|---|
| 短期对话摘要 | ✅ 今天/本周 | — |
| 长期事实 | ✅ 长期情况 | 实体笔记（更细粒度） |
| 实体关系图谱 | — | ✅ Obsidian 双链 |
| 错误纠正闭环 | — | ✅ 双层错误记录 |
| 可审计可编辑 | 间接 | ✅ 直接编辑 .md |
| 可视化 | — | ✅ Obsidian 图谱 |

本系统不替代平台内置的短期记忆功能，而是补充长期结构化知识的持久化和检索能力。

---

## 许可

MIT
