# InfiniteChat Web

InfiniteChat 的前端高保真原型工程，使用 React + Vite 实现首页工作台、消息、联系人、发现、智能助手、设置和登录页。

## 当前设计方向

- HeroUI / HeroUI Pro 风格：干净、克制、圆角卡片、精细边框、清晰层级。
- 主色为蓝色 `#006FEE`。
- 不使用渐变色。
- 支持浅色与深色两套主题。
- 深色模式背景为纯黑 `#000000`。
- icon rail 使用线性 SVG 图标，后续可无损替换为 iconfont symbol。
- 顶部导航、主题切换、会话选择、登录表单和输入区都包含可见的 hover / pressed / focus 状态。
- 顶部包含真实产品常见的快速入口、提醒中心和账号状态，可点击并被自动验证。
- 消息页包含成员头像、消息时间、正在输入状态和真实输入区。
- 桌面消息页标准截图内必须完整露出输入区和发送按钮。
- 助手页包含可切换的侧边导航、模式分段和常用提示。
- icon rail 已可真实切换首页、消息、联系人、发现、助手和设置，不只是视觉装饰。
- 手机端顶部已经压缩为品牌、三段导航、紧凑工具条三层结构，快速入口、在线状态、提醒、主题和账号入口都保留但不再挤占首屏。
- 手机端 icon rail 已压缩成单行胶囊式 glyph rail，让首屏内容更早出现，避免移动端过度堆叠。
- 平板端消息页和助手页使用两栏工作区，不再把核心工作区推到列表或侧栏下方。
- 首页、联系人、发现和设置页包含真实产品级内容密度，避免空壳页面。
- 登录页包含保持登录、登录中反馈和用户可理解的信任提示。
- 已补充真实交互审计：主题切换、顶部导航、助手导航、模式切换、会话选择、输入区禁用态和登录反馈都会被自动点击验证。
- 已补充减少动态效果支持：当用户开启 reduced motion 时，过渡和动画会被压到近乎静止，并由自动验证覆盖。
- 已适配手机、平板和桌面尺寸。

## 页面入口

启动后可通过路径直接查看不同页面，同时保留 hash 兼容：

- `/home` 或 `/#home`：今日工作台
- `/chat` 或 `/#chat`：消息工作台
- `/contacts` 或 `/#contacts`：联系人
- `/discover` 或 `/#discover`：发现
- `/agent` 或 `/#agent`：智能助手工作台
- `/settings` 或 `/#settings`：设置
- `/auth` 或 `/#auth`：登录页

主题可通过 query 参数切换：

- `?theme=light`
- `?theme=dark`

例如：

- `http://localhost:5173/chat?theme=dark`
- `http://localhost:5173/agent?theme=light`

## 本地运行

```bash
pnpm install
pnpm dev
```

默认会启动 Vite 开发服务。

## 生产构建

```bash
pnpm build
```

构建产物输出到：

```text
/Users/haven/Documents/code/projecta/infinitechat-web/dist
```

## Iconfont 接入约定

当前 rail 图标已按 iconfont symbol 的形态实现：

- 图标定义集中在 `src/main.jsx` 的 `IconSprite()`。
- 图标使用集中在 `IconFont()`，通过 `<use href="#ic-rail-...">` 引用。
- 现有 symbol id：
  - `ic-rail-home`
  - `ic-rail-message`
  - `ic-rail-contacts`
  - `ic-rail-discover`
  - `ic-rail-assistant`
  - `ic-rail-settings`

后续替换为 iconfont.cn 的 symbol 文件时，建议保留这组语义命名，或同步更新 `railIconSymbolIds` 和验证脚本里的 expected symbol 列表。

## 一键视觉验证

```bash
pnpm verify:ui
```

这个命令会：

1. 执行生产构建。
2. 用本地静态服务打开构建产物。
3. 通过 Chrome 截取手机、平板、桌面三种尺寸。
4. 分别验证 `home`、`chat`、`contacts`、`discover`、`agent`、`settings`、`auth` 七个页面。
5. 分别验证浅色与深色两种主题。
6. 检查是否存在横向溢出。
7. 检查深色模式背景是否为纯黑。
8. 检查是否误用了渐变、紫色、emoji rail、内部说明文案，且确认 icon rail 使用 SVG symbol sprite。
9. 检查当前页状态、主题切换状态、icon rail 可访问状态、聊天输入区、助手导航和登录反馈是否完整。
10. 检查桌面消息页输入区发送按钮是否完整出现在标准截图内。
11. 执行真实交互审计，确认用户能完成主题切换、顶部页面切换、icon rail 页面切换、助手能力切换、会话选择、消息输入和登录反馈流程。
12. 检查快速入口、提醒中心和账号状态浮层是否可打开、可关闭、可导航，并保持移动端不溢出。
13. 检查减少动态效果规则是否存在且在浏览器 CSSOM 中可被识别。
14. 检查手机端顶部栏是否保持紧凑工具区，不退化成厚重多行操作卡片。
15. 检查手机端 icon rail 是否保持紧凑单行布局，不退化成厚重的 3×2 卡片。
16. 检查平板端消息页和助手页是否保持两栏工作区布局。

验证报告位置：

```text
/Users/haven/Documents/code/projecta/.artifacts/frontend/infinitechat-web/static-verification-report.json
```

截图位置：

```text
/Users/haven/Documents/code/projecta/.artifacts/frontend/infinitechat-web/
```

代表性截图：

- `static-desktop-chat-light.png`
- `static-desktop-chat-dark.png`
- `static-mobile-auth-dark.png`
- `static-tablet-agent-dark.png`

## Figma 同步状态

对应 Figma 文件：

```text
https://www.figma.com/design/DRuJXLExRcsIJR7UC5BU4s/Untitled
```

本地已准备同步脚本：

```text
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/figma-sync-pure-black.js
```

写入前 dry-run 清单：

```text
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/figma-dry-run-manifest.md
/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/figma-dry-run-manifest.json
```

当前 Figma MCP 本轮已能读取文件顶层并确认存在 `Page 1`，但继续读取页面结构时再次触发 Starter 额度限制，暂时无法把画板写入 Figma，也无法截图验证 Figma 文件内效果。额度恢复后，应先 inspect `Page 1`，再执行同步脚本并截图验证。

同步脚本当前计划写入 `43` 个画板：`1` 个设计系统画板，加上 `7` 个页面在手机、平板、桌面三种尺寸下的浅色与纯黑深色版本。
