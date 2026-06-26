# InfiniteChat 高保真 HeroUI Blue 重设计交付说明

日期：2026-06-19  
目标文件：<https://www.figma.com/design/DRuJXLExRcsIJR7UC5BU4s/Untitled?t=SuNQzGUzF0qARqkT-0>  
当前状态：Figma MCP Starter 调用额度受限，已完成本地高保真预览、纯黑深色版、导出图和待同步脚本。

## 1. 设计目标

本次重设计不是线框稿，而是可作为前端实现参考的高保真产品稿。核心要求：

- 风格参考 HeroUI / HeroUI Pro：干净卡片、精细描边、稳定圆角、轻阴影、清晰信息层级。
- 主色只使用蓝色，核心色为 `#006FEE`。
- 不使用紫色。
- 不使用渐变色。
- 提供浅色主题和纯黑深色主题。
- 深色模式使用纯黑画布，不使用深蓝作为大面积背景。
- 字体风格精致：Inter / 系统中文无衬线，标题使用紧凑字距，正文保持高可读行高。
- Navigation rail 与 Agent sidebar 使用 iconfont 风格的单色线性图标，避免 emoji 和字母缩写占位。

## 2. 当前画板清单

本地预览包含 5 张主画板：

1. `00 / HeroUI Blue Design System`
   - 设计系统总览
   - 浅色 / 纯黑深色主题样例
   - Button / Input / Chip 组件样例
   - 核心色板和排版节奏

2. `01 / Auth Onboarding — High Fidelity`
   - 登录 / 注册 / 邮箱验证码入口
   - Gateway / Agent / Knife4j 状态信息
   - 环境与安全提示区域

3. `02 / Chat Workspace — Light HeroUI`
   - 浅色聊天工作区
   - 左侧导航、会话列表、聊天主区、AI 右侧栏
   - Summary / Citation / Memory / Tool trace 四个 AI 信息卡

4. `03 / Chat Workspace — Pure Black HeroUI`
   - 纯黑深色聊天工作区
   - 黑色画布、中性灰面板、蓝色焦点态
   - 避免深蓝背景，只在按钮、描边、选中态使用蓝色

5. `04 / Agent Console — Pure Black`
   - Agent Playground
   - RAG / Adaptive / Chat Tab
   - Prompt、Answer preview、Trace & Governance、Tool audit
   - 对应 Agent 后端接口调试场景

## 3. 视觉规范

### 3.1 主色

| Token | Value | 用途 |
| --- | --- | --- |
| Primary 500 | `#006FEE` | 主按钮、选中态、关键 CTA |
| Primary 400 | `#338EF7` | Hover / 次级强调 |
| Primary 300 | `#66AFFF` | 暗色模式辅助文字 |
| Primary 100 | `#E6F1FE` | 浅色模式 soft chip / light fill |

### 3.2 浅色主题

| Token | Value |
| --- | --- |
| Light BG | `#F7FAFF` |
| Surface | `#FFFFFF` |
| Surface 2 | `#F2F7FF` |
| Border | `#D7E9FF` |
| Neutral Border | `#E4EAF2` |
| Text | `#0B1220` |
| Muted | `#667085` |

### 3.3 纯黑深色主题

| Token | Value | 用途 |
| --- | --- | --- |
| Dark BG | `#000000` | 画布、App shell、聊天 feed 背景 |
| Dark Surface | `#0A0A0A` | 卡片、侧栏、输入区 |
| Dark Surface 2 | `#111111` | 局部层级、选中弱背景 |
| Dark Border | `#27272A` | 细边框 |
| Dark Text | `#FAFAFA` | 主文本 |
| Dark Muted | `#A1A1AA` | 辅助文本 |

深色模式规则：

- 大面积背景必须是 `#000000` 或接近纯黑的中性灰。
- 不允许用深蓝作为页面、面板、卡片底色。
- 蓝色仅用于：CTA、选中态、聚焦描边、少量链接文字。
- AI 信息卡、工具追踪、侧边栏均使用中性黑灰，不用蓝黑。

## 4. 组件风格

### Button

- Primary：实心蓝 `#006FEE`，白字。
- Soft：浅色模式使用 `#E6F1FE`，深色模式使用黑底 + 蓝色描边。
- Ghost：白底/黑底 + 中性边框。
- 圆角：约 14px。

### Card

- 大卡片圆角：24px-32px。
- 小卡片圆角：16px-22px。
- 浅色模式可使用柔和阴影。
- 纯黑模式减少阴影依赖，更多依赖中性边框和层级灰。

### Input

- 高度约 58px。
- Label 使用 11px、加粗、Muted 色。
- Value 使用 14px、Semi Bold。

### Chip

- 高度约 28px。
- 圆角胶囊。
- 状态色保留 Success / Warning / Danger，但保持低饱和。

### Icon Rail

- Navigation rail 与 Agent sidebar 使用 iconfont-ready 的单色线性图标体系。
- 本地预览使用内联 SVG 模拟 iconfont 字形，确保离线、无外部 CDN 依赖。
- 图标统一为 1.8px stroke、round cap / round join，风格接近 HeroUI / Lucide / Tabler 的轻量线性系统。
- 不再使用 emoji、命令符号或 `MSG` / `USR` / `MOM` / `CFG` 这类字母缩写占位。

## 5. 对应后端页面规划

### Auth

对应能力：

- 登录
- 注册
- 邮箱验证码
- Gateway 健康状态

### Chat Workspace

对应能力：

- 会话列表
- 消息流
- 好友 / 群组入口
- AI 辅助回复
- RAG citation
- Memory context
- Tool trace

### Agent Console

对应能力：

- `/api/chat`
- `/api/streamChat`
- `/api/rag/chat`
- `/api/rag/adaptive/chat`
- `/api/agent/chat`
- `/api/agent/tools`
- `/api/agent/tools/audit`
- `/api/memory/context`

## 6. 本地交付物

预览入口：

```text
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/index.html
```

关键截图：

```text
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/design-system.png
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/auth.png
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/chat-light.png
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/chat-dark.png
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/agent-console.png
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/full-page.png
```

待 Figma 额度恢复后可执行的同步脚本：

```text
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/figma-sync-pure-black.js
```

## 7. 当前验证结果

已做本地静态检查：

- 存在主蓝色 `#006FEE`。
- 存在纯黑 `#000000`。
- 存在浅色聊天画板。
- 存在纯黑聊天画板。
- 未发现 purple / violet / 常见紫色 token。
- 未发现 `linear-gradient` / `radial-gradient` / `conic-gradient`。
- iconfont rail 已在本地预览和待同步脚本中完成，等待 Figma 额度恢复后写回。
- 未发现旧深蓝背景色残留：
  - `#070B14`
  - `#0D111C`
  - `#121A2A`
  - `#162033`
  - `#22304A`
  - `#082F49`
  - `#0B4A7A`
  - `#0B1626`
  - `#10182A`
  - `#0A1322`
  - `#090E18`

## 8. 尚未完成

Figma MCP 当前仍返回 Starter plan tool call limit，暂时不能把本地高保真稿写回 Figma，也不能拉 Figma 截图做最终验证。

完成标准仍然是：

1. 同步到 Figma 的 `HIFI HeroUI Blue Redesign` 页面。
2. Figma 内存在 5 张高保真画板。
3. 截图验证 Figma 画板和本地预览一致。
4. 确认无紫色、无渐变、纯黑深色模式、HeroUI 风格和精致字体均满足要求。
