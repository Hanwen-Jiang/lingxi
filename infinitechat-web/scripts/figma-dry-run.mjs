import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const projectRoot = resolve(appRoot, '..');
const figmaScriptPath = resolve(projectRoot, '.artifacts/figma/hifi-heroui-preview/figma-sync-pure-black.js');
const outDir = resolve(projectRoot, '.artifacts/figma/hifi-heroui-preview');
const manifestPath = resolve(outDir, 'figma-dry-run-manifest.json');
const markdownPath = resolve(outDir, 'figma-dry-run-manifest.md');

if (!existsSync(figmaScriptPath)) {
  throw new Error(`Figma 同步脚本不存在：${figmaScriptPath}`);
}

const script = readFileSync(figmaScriptPath, 'utf8');
const expectedRoutes = ['/home', '/chat', '/contacts', '/discover', '/agent', '/settings', '/auth'];
const expectedDevices = ['desktop', 'tablet', 'mobile'];
const expectedThemes = ['light', 'dark'];

function expectedMatrixKeys() {
  const keys = [];
  for (const route of expectedRoutes) {
    for (const device of expectedDevices) {
      for (const theme of expectedThemes) {
        keys.push(`${route}|${device}|${theme}`);
      }
    }
  }
  return keys;
}

function parseCalls(source) {
  const lines = source.split('\n');
  const callPattern = /^(designSystem|authScreenVariant|chatScreen|agent工作台|mobileAuthScreen|mobileChatScreen|mobileAgentScreen|mobileUtilityScreen|tabletAuthScreen|tabletChatScreen|tabletAgentScreen|tabletUtilityScreen|utilityScreenVariant)\(page,?\s*(.*)\);\s*$/;
  const calls = [];
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    const match = line.match(callPattern);
    if (!match) continue;
    const [, fn, args] = match;
    const quoted = [...args.matchAll(/'([^']+)'/g)].map((item) => item[1]);
    const numbers = [...args.matchAll(/(?:^|,\s*)(-?\d+)\s*(?=,|$)/g)].map((item) => Number(item[1]));
    const dark = /,\s*true(?:,|\))/.test(line);
    const kindMatch = args.match(/,\s*'(home|contacts|discover|settings)'\s*\)?\s*$/);
    const title = fn === 'designSystem' ? '00 / InfiniteChat Blue Design System' : quoted[0] || fn;
    const viewport = title.includes('手机') || fn.startsWith('mobile')
      ? { label: 'mobile', width: 390, height: 844 }
      : title.includes('平板') || fn.startsWith('tablet')
        ? { label: 'tablet', width: 834, height: 1194 }
        : { label: 'desktop', width: 1440, height: 1024 };
    const route = title.includes('登录') ? '/auth'
      : title.includes('聊天') ? '/chat'
        : title.includes('助手') ? '/agent'
          : title.includes('今日工作台') ? '/home'
            : title.includes('联系人') ? '/contacts'
              : title.includes('发现') ? '/discover'
                : title.includes('设置') ? '/settings'
                  : 'design-system';
    const theme = title.includes('Pure Black') || dark ? 'dark' : 'light';
    calls.push({
      index: calls.length,
      line: index + 1,
      fn,
      title,
      route,
      theme,
      viewport,
      x: numbers[0] ?? 0,
      y: numbers[1] ?? 0,
      kind: kindMatch?.[1] || null,
    });
  }
  return calls;
}

function assertNo(pattern, label) {
  const match = script.match(pattern);
  return match ? { ok: false, label, match: match[0] } : { ok: true, label };
}

function frameCoverage(frames) {
  const requiredKeys = expectedMatrixKeys();
  const required = new Set(requiredKeys);
  const productFrames = frames.filter((frame) => frame.route !== 'design-system');
  const designSystemFrames = frames.filter((frame) => frame.route === 'design-system');
  const grouped = new Map();
  const unexpected = [];

  for (const frame of productFrames) {
    const key = `${frame.route}|${frame.viewport.label}|${frame.theme}`;
    if (!required.has(key)) {
      unexpected.push({ key, title: frame.title, line: frame.line });
      continue;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ title: frame.title, line: frame.line });
  }

  const missing = requiredKeys.filter((key) => !grouped.has(key));
  const duplicates = [...grouped.entries()]
    .filter(([, items]) => items.length !== 1)
    .map(([key, items]) => ({ key, count: items.length, items }));

  return {
    requiredProductFrames: requiredKeys.length,
    actualProductFrames: productFrames.length,
    designSystemFrames: designSystemFrames.length,
    expectedRoutes,
    expectedDevices,
    expectedThemes,
    missing,
    duplicates,
    unexpected,
    ready: designSystemFrames.length === 1
      && productFrames.length === requiredKeys.length
      && missing.length === 0
      && duplicates.length === 0
      && unexpected.length === 0,
  };
}

let parses = true;
let parseError = null;
try {
  // eslint-disable-next-line no-new-func
  new Function('figma', `(async()=>{${script}\n})`);
} catch (error) {
  parses = false;
  parseError = String(error?.message || error);
}

const frames = parseCalls(script);
const coverage = frameCoverage(frames);
const checks = [
  { ok: parses, label: 'Figma 脚本语法可解析', error: parseError },
  { ok: frames.length === 43, label: '画板调用数量等于 43 个', count: frames.length },
  {
    ok: coverage.ready,
    label: '画板矩阵精确覆盖：1 个设计系统 + 7 页面 × 3 设备 × 2 主题',
    coverage: {
      actualProductFrames: coverage.actualProductFrames,
      requiredProductFrames: coverage.requiredProductFrames,
      designSystemFrames: coverage.designSystemFrames,
      missing: coverage.missing,
      duplicates: coverage.duplicates,
      unexpected: coverage.unexpected,
    },
  },
  { ok: script.includes("blue500: '#006FEE'"), label: '主色为 #006FEE' },
  {
    ok: script.includes("neutral100: '#F4F4F5'")
      && script.includes("lightBg: '#FAFAFA'")
      && script.includes("lightSurface2: '#F4F4F5'")
      && script.includes("lightBorder: '#E4E4E7'"),
    label: '浅色背景与普通柔和面为中性灰，不使用蓝灰底',
  },
  { ok: script.includes("black: '#000000'"), label: '深色模式 token 为纯黑 #000000' },
  { ok: script.includes('addBrandMark'), label: '包含 SVG 品牌标识函数' },
  {
    ok: script.includes('Responsive compact topbar')
      && script.includes('Lightweight top nav')
      && script.includes('messages assistant only / no login switch')
      && script.includes('Current page title on phone')
      && script.includes('Mobile compact quick entry / no segmented switch')
      && script.includes('const h = tablet ? 68 : 56')
      && script.includes('Single-line mobile topbar')
      && script.includes('one line, no product name, no subtitle, no message/assistant switch')
      && script.includes('今日工作台')
      && script.includes('icon only')
      && script.includes('Account action / login entry')
      && script.includes('Mobile bottom dock icon rail / destination-only single-line glyph rail / no repeated brand')
      && script.includes('destination icon')
      && !script.includes('Mobile rail brand mark')
      && script.includes('mobileRail(root,14,778')
      && script.includes("mobileRail(root,14,778,w-28,dark,'agent')")
      && script.includes("check: (color, size)")
      && script.includes("sun: (color, size)")
      && !script.includes('Segmented nav')
      && !script.includes("['消息','助手','登录']"),
    label: '手机顶栏改为当前页标题，消息/助手切换下沉到底部 dock，登录移入账号入口',
  },
  { ok: script.includes('mobileUtilityScreen(page') && script.includes('tabletUtilityScreen(page'), label: '包含首页、联系人、发现、设置的手机和平板响应式画板' },
  {
    ok: script.includes("kind==='home'?27:28")
      && script.includes("lineHeight:kind==='home'?31:32")
      && script.includes("Mobile bottom dock icon rail / destination-only single-line glyph rail / no repeated brand"),
    label: '手机端工作台标题使用 App 级紧凑排版，不再是落地页巨幅标题',
  },
  { ok: script.includes('Discover brief exercise') && script.includes('Tablet discover practice bar / horizontal open practice steps') && script.includes('Mobile discover brief / short practice flow strip'), label: '包含发现页精选练习区块、平板横向练习条和手机短流程条' },
  {
    ok: script.includes('neutral light assistant panel')
      && script.includes('neutral discover side')
      && !script.includes("Mobile assistant cards',14,536,w-28,86,true"),
    label: '浅色模式助手/推荐侧栏使用中性面板，不回退为大面积黑色功能块',
  },
  {
    ok: script.includes('Anti card-in-card fatigue')
      && script.includes('openWorkspace')
      && script.includes('dividerRow')
      && script.includes('flatRow')
      && script.includes('accentBlock')
      && script.includes('inlineProgress'),
    label: '包含开放工作区、分隔行、左侧强调线和内联进度，避免卡片套卡片疲劳',
  },
  {
    ok: script.includes('priorityList(')
      && script.includes('Priority list row')
      && script.includes('Tablet tool density'),
    label: '同步首页优先级列表与平板顶部工具区密度细节',
  },
  {
    ok: script.includes('quiet neutral tool')
      && script.includes('Tablet compact destination-only toolbar rail')
      && script.includes('Status dot /')
      && script.includes("fill:active?C.blue500:'transparent'")
      && script.includes("stroke:active?C.blue500:'transparent'")
      && !script.includes('#CFF5DF'),
    label: '同步安静在线状态、tiny-dot 状态徽章、透明非激活 dock 按钮和平板轻工具栏 rail',
  },
  {
    ok: script.includes("desktopRail(root,48,54,918,dark,'agent')")
      && script.includes('Tablet global icon rail / agent active'),
    label: '助手桌面和平板画板包含全局 icon rail，跨页面导航一致',
  },
  {
    ok: script.includes('homeSignalCard')
      && script.includes('Home signal progress')
      && script.includes('Home signal row'),
    label: '同步首页信息卡进度和分隔行，减少空白并避免卡片套卡片',
  },
  {
    ok: script.includes('homeWorkflowStrip')
      && script.includes('Home workflow open divider strip')
      && script.includes('Home workflow vertical divider')
      && script.includes('no nested cards'),
    label: '同步首页流程为开放式分隔步骤条，不使用四个内嵌步骤卡片',
  },
  {
    ok: script.includes('Contact signal strip')
      && script.includes('Contact open row')
      && script.includes('Contact request row')
      && script.includes('Contact meter'),
    label: '同步联系人页概览信号、开放联系人行、好友申请和热度条',
  },
  {
    ok: script.includes('Settings control strip')
      && script.includes('Settings toggle row')
      && script.includes('Settings confirm row')
      && script.includes('inset compact primary track')
      && script.includes('trackX = w - (compact ? 44 : 46)')
      && script.includes('trackW = compact ? 34 : 38'),
    label: '同步设置页控制概览、设置开关行、确认列表和手机端内收开关',
  },
  {
    ok: script.includes('Auth trust flow')
      && script.includes('Auth method tabs')
      && script.includes('Login security list')
      && script.includes('Mobile login form first')
      && script.includes('Mobile auth support after login')
      && script.includes('login first'),
    label: '同步登录页信任流程、登录方式、安全提示，并确保手机登录表单首屏优先',
  },
  assertNo(/(?:linear|radial|conic)-gradient/i, '不包含渐变声明'),
  assertNo(/(?:purple|violet|#8b5cf6|#a855f7|#7c3aed)/i, '不包含紫色/紫罗兰色'),
  assertNo(/#(?:f2f7ff|f7faff|eef6ff|f4f8ff|e6f1fe|d7e9ff|eaf2ff|e5f8ff)\b/i, '不包含蓝灰浅色背景'),
];

const manifest = {
  createdAt: new Date().toISOString(),
  figmaFile: {
    url: 'https://www.figma.com/design/DRuJXLExRcsIJR7UC5BU4s/Untitled',
    fileKey: 'DRuJXLExRcsIJR7UC5BU4s',
    targetPageName: 'HIFI 精致界面 Blue Redesign',
  },
  scriptPath: figmaScriptPath,
  skillNames: 'figma-use,figma-generate-design',
  checks,
  coverage,
  ready: checks.every((item) => item.ok),
  frames,
  writePlan: [
    'Figma MCP 额度恢复后，先 get_metadata inspect 文件和 Page 1。',
    '确认文件可写后，使用 use_figma 执行 figma-sync-pure-black.js。',
    '写入后用 get_metadata 验证 HIFI 精致界面 Blue Redesign 页面和 43 个画板。',
    '截取设计系统、登录、聊天、助手、手机、平板和工具页关键画板。',
    '对照本地 .artifacts/frontend/infinitechat-web 的截图检查视觉一致性。',
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const table = frames.map((frame) => (
  `| ${String(frame.index).padStart(2, '0')} | ${frame.title} | ${frame.viewport.label} ${frame.viewport.width}×${frame.viewport.height} | ${frame.theme} | ${frame.route} | (${frame.x}, ${frame.y}) |`
)).join('\n');
const checkList = checks.map((item) => {
  const details = [];
  if (item.count !== undefined) details.push(String(item.count));
  if (item.error) details.push(item.error);
  if (item.match) details.push(item.match);
  if (item.coverage && !item.ok) {
    details.push(`missing=${item.coverage.missing.join(', ') || '[]'}`);
    details.push(`duplicates=${JSON.stringify(item.coverage.duplicates)}`);
    details.push(`unexpected=${JSON.stringify(item.coverage.unexpected)}`);
  }
  return `- ${item.ok ? '✅' : '❌'} ${item.label}${details.length ? `：${details.join('；')}` : ''}`;
}).join('\n');
const coverageSummary = [
  `- 产品画板：${coverage.actualProductFrames}/${coverage.requiredProductFrames}`,
  `- 设计系统画板：${coverage.designSystemFrames}/1`,
  `- 页面：${coverage.expectedRoutes.map((item) => `\`${item}\``).join('、')}`,
  `- 设备：${coverage.expectedDevices.map((item) => `\`${item}\``).join('、')}`,
  `- 主题：${coverage.expectedThemes.map((item) => `\`${item}\``).join('、')}`,
  `- 缺失组合：${coverage.missing.length ? coverage.missing.map((item) => `\`${item}\``).join('、') : '无'}`,
  `- 重复组合：${coverage.duplicates.length ? coverage.duplicates.map((item) => `\`${item.key} × ${item.count}\``).join('、') : '无'}`,
  `- 异常组合：${coverage.unexpected.length ? coverage.unexpected.map((item) => `\`${item.key}\``).join('、') : '无'}`,
].join('\n');
const markdown = `# InfiniteChat Figma 写入前 Dry Run 清单\n\n- Figma 文件：[Untitled](https://www.figma.com/design/DRuJXLExRcsIJR7UC5BU4s/Untitled)\n- fileKey: \`DRuJXLExRcsIJR7UC5BU4s\`\n- 目标页面：\`HIFI 精致界面 Blue Redesign\`\n- 同步脚本：\`${figmaScriptPath}\`\n- use_figma skillNames：\`figma-use,figma-generate-design\`\n- 当前状态：${manifest.ready ? '可写入，等待 Figma MCP 额度恢复' : '暂不可写入，需先修复检查项'}\n\n## 检查项\n\n${checkList}\n\n## 覆盖矩阵\n\n${coverageSummary}\n\n## 画板清单\n\n| # | 画板 | 设备 | 主题 | 对应页面 | 坐标 |\n| --- | --- | --- | --- | --- | --- |\n${table}\n\n## 写入后验证步骤\n\n${manifest.writePlan.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n`;
writeFileSync(markdownPath, markdown);

console.log(JSON.stringify({ manifestPath, markdownPath, ready: manifest.ready, frames: frames.length, failedChecks: checks.filter((item) => !item.ok) }, null, 2));
