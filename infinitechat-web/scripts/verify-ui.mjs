import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const projectRoot = resolve(appRoot, '..');
const distRoot = resolve(appRoot, 'dist');
const srcRoot = resolve(appRoot, 'src');
const indexHtml = resolve(appRoot, 'index.html');
const outDir = resolve(projectRoot, '.artifacts/frontend/infinitechat-web');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sizes = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'narrow-mobile', width: 320, height: 740 },
  { label: 'tablet', width: 834, height: 1194 },
  { label: 'desktop', width: 1440, height: 1100 },
];
const views = [
  { label: 'home', path: '/home', hash: '#home' },
  { label: 'chat', path: '/chat', hash: '#chat' },
  { label: 'contacts', path: '/contacts', hash: '#contacts' },
  { label: 'discover', path: '/discover', hash: '#discover' },
  { label: 'agent', path: '/agent', hash: '#agent' },
  { label: 'settings', path: '/settings', hash: '#settings' },
  { label: 'auth', path: '/auth', hash: '#auth' },
];
const themes = ['light', 'dark'];
const fullPageSpecs = [
  { size: sizes[0], view: views.find((item) => item.label === 'discover'), theme: 'light' },
  { size: sizes[0], view: views.find((item) => item.label === 'discover'), theme: 'dark' },
  { size: sizes[0], view: views.find((item) => item.label === 'agent'), theme: 'dark' },
  { size: sizes[0], view: views.find((item) => item.label === 'settings'), theme: 'dark' },
  { size: sizes[0], view: views.find((item) => item.label === 'auth'), theme: 'dark' },
  { size: sizes[1], view: views.find((item) => item.label === 'discover'), theme: 'dark' },
  { size: sizes[1], view: views.find((item) => item.label === 'agent'), theme: 'dark' },
].filter((item) => item.size && item.view);
const lowDiskMode = process.env.VERIFY_UI_LOW_DISK === '1';

const visibleBannedWords = [
  'Gateway',
  'Knife4j',
  '后端接口',
  '实现计划',
  '交付',
  'MSG',
  'USR',
  'MOM',
  'CFG',
  '给我',
  '请帮我',
];
const sourceBannedPatterns = [
  { label: 'gradient', pattern: /(?:linear|radial|conic)-gradient/i },
  { label: 'blue tinted light background', pattern: /#(?:f2f7ff|f7faff|eef6ff|f4f8ff|e6f1fe|d7e9ff|eaf2ff|e5f8ff)\b/i },
  { label: 'emoji', pattern: /[\u{1F000}-\u{1FAFF}]/u },
  { label: 'text icon placeholder', pattern: /(?:\bMSG\b|\bUSR\b|\bMOM\b|\bCFG\b|⌘|▶)/ },
  { label: 'internal copy', pattern: /(?:Gateway|Knife4j|后端接口|实现计划|交付|给我|请帮我)/ },
];

function parseFigmaScreenCalls(source) {
  const callPattern = /^(designSystem|authScreenVariant|chatScreen|agent工作台|mobileAuthScreen|mobileChatScreen|mobileAgentScreen|mobileUtilityScreen|tabletAuthScreen|tabletChatScreen|tabletAgentScreen|tabletUtilityScreen|utilityScreenVariant)\(page,?\s*(.*)\);\s*$/;
  const frames = [];
  for (const [index, rawLine] of source.split('\n').entries()) {
    const line = rawLine.trim();
    const match = line.match(callPattern);
    if (!match) continue;
    const [, fn, args] = match;
    const quoted = [...args.matchAll(/'([^']+)'/g)].map((item) => item[1]);
    const dark = /,\s*true(?:,|\))/.test(line);
    const title = fn === 'designSystem' ? '00 / InfiniteChat Blue Design System' : quoted[0] || fn;
    const device = title.includes('手机') || fn.startsWith('mobile')
      ? 'mobile'
      : title.includes('平板') || fn.startsWith('tablet')
        ? 'tablet'
        : 'desktop';
    const route = title.includes('登录') ? '/auth'
      : title.includes('聊天') ? '/chat'
        : title.includes('助手') ? '/agent'
          : title.includes('今日工作台') ? '/home'
            : title.includes('联系人') ? '/contacts'
              : title.includes('发现') ? '/discover'
                : title.includes('设置') ? '/settings'
                  : 'design-system';
    const theme = title.includes('Pure Black') || dark ? 'dark' : 'light';
    frames.push({ line: index + 1, fn, title, route, device, theme });
  }
  return frames;
}

function auditFigmaScreenCoverage(source) {
  const frames = parseFigmaScreenCalls(source);
  const expectedRoutes = views.map((item) => item.path);
  const expectedDevices = sizes.filter((item) => item.label !== 'narrow-mobile').map((item) => item.label);
  const expectedKeys = [];
  for (const route of expectedRoutes) {
    for (const device of expectedDevices) {
      for (const theme of themes) expectedKeys.push(`${route}|${device}|${theme}`);
    }
  }
  const required = new Set(expectedKeys);
  const productFrames = frames.filter((frame) => frame.route !== 'design-system');
  const designSystemFrames = frames.filter((frame) => frame.route === 'design-system');
  const grouped = new Map();
  const unexpected = [];
  for (const frame of productFrames) {
    const key = `${frame.route}|${frame.device}|${frame.theme}`;
    if (!required.has(key)) {
      unexpected.push({ key, title: frame.title, line: frame.line });
      continue;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ title: frame.title, line: frame.line });
  }
  const missing = expectedKeys.filter((key) => !grouped.has(key));
  const duplicates = [...grouped.entries()]
    .filter(([, items]) => items.length !== 1)
    .map(([key, items]) => ({ key, count: items.length, items }));
  return {
    frames,
    count: frames.length,
    productFrameCount: productFrames.length,
    expectedProductFrameCount: expectedKeys.length,
    designSystemFrameCount: designSystemFrames.length,
    missing,
    duplicates,
    unexpected,
    ready: frames.length === expectedKeys.length + 1
      && productFrames.length === expectedKeys.length
      && designSystemFrames.length === 1
      && missing.length === 0
      && duplicates.length === 0
      && unexpected.length === 0,
  };
}

function auditDesignSystemSource() {
  const mainPath = resolve(srcRoot, 'main.jsx');
  const cssPath = resolve(srcRoot, 'styles.css');
  const designPath = resolve(appRoot, 'DESIGN.md');
  const figmaScriptPath = resolve(projectRoot, '.artifacts/figma/hifi-heroui-preview/figma-sync-pure-black.js');
  const main = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : '';
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const design = existsSync(designPath) ? readFileSync(designPath, 'utf8') : '';
  const html = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : '';
  const figmaScript = existsSync(figmaScriptPath) ? readFileSync(figmaScriptPath, 'utf8') : '';
  const scriptSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const routeCount = (main.match(/view === '/g) || []).length;
  const figmaCoverage = auditFigmaScreenCoverage(figmaScript);
  const audit = {
    designPath,
    figmaScriptPath,
    heroUiDirectionDocumented: /HeroUI/i.test(design),
    bluePrimaryToken: css.includes('--blue-500: #006fee') && figmaScript.includes("blue500: '#006FEE'"),
    neutralLightBackgroundReady: css.includes('--bg: #fafafa')
      && css.includes('--surface-2: #f4f4f5')
      && css.includes('--border: #e4e4e7')
      && html.includes("'#fafafa'")
      && figmaScript.includes("lightBg: '#FAFAFA'")
      && figmaScript.includes("lightSurface2: '#F4F4F5'")
      && figmaScript.includes("lightBorder: '#E4E4E7'")
      && design.includes('neutral gray background'),
    pureBlackDocumented: design.includes('#000000') && css.includes('--bg: #000000') && figmaScript.includes("black: '#000000'"),
    lightModeNoHeavyDarkPanelsDocumented: design.includes('Light mode should not use large pure-black functional panels')
      && css.includes('Light-mode assistant panel polish')
      && scriptSource.includes('lightModeNoHeavyDarkPanelsReady')
      && figmaScript.includes('neutral light assistant panel')
      && figmaScript.includes('neutral discover side'),
    firstPaintThemePreset: html.includes('document.documentElement.dataset.theme') && html.includes('document.body.dataset.theme'),
    responsiveBreakpoints: ['1180px', '760px', '430px'].every((bp) => css.includes(bp)),
    reducedMotionReady: css.includes('@media (prefers-reduced-motion: reduce)')
      && css.includes('transition-duration: .01ms')
      && css.includes('animation-duration: .01ms')
      && css.includes('transition-delay: 0ms')
      && css.includes('animation-delay: 0ms')
      && /reduced motion/i.test(design),
    antiCardFatigueDocumented: /Avoid card-in-card fatigue/i.test(design)
      && /open workspace structure/i.test(design),
    antiCardFatigueSourceReady: [
      'Anti card-in-card fatigue',
      '.workspace-shell',
      'background: transparent',
      '.message-feed',
      '.composer.inset',
      'border-left: 3px solid var(--blue-500)',
      '.filter-chip-row button',
      '.process-progress',
    ].every((needle) => css.includes(needle))
      && main.includes('className="composer inset"')
      && !main.includes('className="composer card-surface inset"')
      && main.includes('feed-status-strip')
      && main.includes('quality-meter')
      && main.includes('filter-chip-row')
      && main.includes('process-progress'),
    sourcePriorityListReady: main.includes('className="priority-list"')
      && css.includes('.priority-list')
      && css.includes('.priority-list article'),
    sourceHomeWorkflowOpenReady: design.includes('Home workflow steps use an open divider strip')
      && main.includes('className="focus-flow"')
      && css.includes('.focus-flow')
      && css.includes('border-top: 1px solid var(--border-2)')
      && css.includes('border-bottom: 1px solid var(--border-2)')
      && css.includes('border-right: 1px solid var(--border-2)')
      && css.includes('.focus-flow span:last-child')
      && css.includes('Mobile home dashboard density')
      && css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')
      && css.includes('background: transparent'),
    sourceHomeSignalRowsReady: main.includes('className="home-card-progress"')
      && main.includes('className="home-card-rows"')
      && css.includes('.home-card-progress')
      && css.includes('.home-card-row'),
    sourceHomeInsightRailReady: design.includes('Home desktop signal summaries use one quiet insight rail')
      && css.includes('Home signal rail: one quiet insight panel with divider rows')
      && css.includes('.home-card-grid::before')
      && css.includes('content: "今日重点"')
      && css.includes('.home-card:last-child')
      && css.includes('white-space: nowrap'),
    sourceMobileChatPriorityReady: design.includes('Phone chat screens prioritize the active room and composer before the inbox list')
      && css.includes('Mobile chat priority: current room first, compact recent inbox second')
      && css.includes('.chat-layout .chat-main')
      && css.includes('order: 1')
      && css.includes('.chat-layout .conversation-list')
      && css.includes('order: 2')
      && css.includes('.chat-layout .conversation-row:nth-child(n + 4)')
      && css.includes('display: none')
      && css.includes('Mobile chat composer priority: keep the send path visible above the dock')
      && css.includes('max-height: clamp(260px, 36vh, 320px)')
      && css.includes('.chat-layout .composer-actions button:not(.primary-button)')
      && css.includes('font-size: 0'),
    sourceDiscoverBriefOpenReady: css.includes('.discover-brief {')
      && css.includes('border-left: 0')
      && css.includes('border-right: 0')
      && css.includes('.brief-steps span')
      && css.includes('background: transparent'),
    sourceAgentWorkflowReady: main.includes('className="agent-workflow"')
      && main.includes('agent-command-surface')
      && main.includes('agent-command-copy')
      && design.includes('HeroUI-style command strip')
      && (main.includes('className="workflow-step"') || main.includes("'workflow-step'"))
      && main.includes('className="agent-preview"')
      && main.includes('className="permission-list"')
      && !main.includes('className="agent-form-grid"')
      && !main.includes('className="prompt-box"')
      && css.includes('.agent-workflow')
      && css.includes('.workflow-step')
      && css.includes('.agent-preview')
      && css.includes('.permission-list')
      && css.includes('Agent page HeroUI Pro refinement')
      && css.includes('.agent-command-surface')
      && css.includes('.agent-layout > .agent-sidebar')
      && css.includes('grid-column: 2 / 4'),
    designDocTopbarLanguageReady: !/Phone:\s*topbar[^\n]*segmented nav/i.test(design)
      && !/segmented controls/i.test(design)
      && design.includes('current page title')
      && design.includes('destination switching belongs to the bottom dock')
      && design.includes('Mobile topbar must stay one line')
      && design.includes('icon-only tool cluster')
      && design.includes('should not show the product name or explanation copy')
      && design.includes('status should be quiet')
      && design.includes('Avoid large filled green badges')
      && design.includes('compact destination toolbar'),
    sourceTopnavLightweightReady: main.includes('className="topnav topnav-plain"')
      && ((main.match(/<nav className="topnav topnav-plain"[\s\S]*?<\/nav>/) || [''])[0] || '').includes('>消息</button>')
      && ((main.match(/<nav className="topnav topnav-plain"[\s\S]*?<\/nav>/) || [''])[0] || '').includes('>助手</button>')
      && !((main.match(/<nav className="topnav topnav-plain"[\s\S]*?<\/nav>/) || [''])[0] || '').includes('登录')
      && main.includes('profile-login-action')
      && main.includes('账号与登录')
      && main.includes('const viewTitles')
      && main.includes('className="mobile-page-title"')
      && css.includes('background: transparent;')
      && css.includes('border: 0;')
      && css.includes('.topnav button::after')
      && css.includes('.mobile-page-title')
      && css.includes('.profile-trigger-text'),
    sourceContactsProReady: main.includes('className="contact-signal-strip"')
      && main.includes('className="people-grid contact-open-list"')
      && main.includes('className="contact-meter"')
      && main.includes('className="request-list"')
      && main.includes('className="contact-insight"')
      && css.includes('.contact-signal-strip')
      && css.includes('Mobile contacts density')
      && css.includes('.contact-open-list .contact-row')
      && css.includes('.contact-meter')
      && css.includes('.request-row'),
    sourceSettingsProReady: main.includes('className="settings-control-strip"')
      && main.includes('settings-layout')
      && main.includes('className="settings-list settings-open-list"')
      && main.includes('setting-toggle')
      && main.includes('className="settings-confirm-list"')
      && css.includes('.settings-control-strip')
      && css.includes('.settings-open-list .setting-row')
      && css.includes('.setting-toggle')
      && css.includes('.settings-confirm-row')
      && css.includes('Settings page content-fit layout')
      && css.includes('.settings-layout > .utility-main')
      && css.includes('.settings-layout > .utility-side')
      && design.includes('Settings pages should use content-fit panels')
      && design.includes('not full-height admin-console columns'),
    sourceAuthTrustFlowReady: main.includes('className="auth-trust-flow"')
      && main.includes('className="auth-flow-row"')
      && main.includes('className="login-method-tabs"')
      && main.includes('className="login-security-list"')
      && main.includes('className="login-secondary-row"')
      && main.includes('不想输入密码？')
      && !main.includes('使用邮箱验证码继续</button>')
      && css.includes('.auth-trust-flow')
      && css.includes('.login-method-tabs')
      && css.includes('.login-security-list')
      && css.includes('.login-secondary-row')
      && css.includes('.auth-hero .feature-card')
      && css.includes('border-right: 1px solid var(--border-2)')
      && css.includes('Mobile auth priority')
      && css.includes('.auth-layout .login-card')
      && css.includes('order: 1')
      && css.includes('.auth-layout .auth-hero')
      && css.includes('order: 2')
      && css.includes('Tablet auth priority')
      && css.includes('grid-template-columns: minmax(0, 1.02fr) minmax(330px, .72fr)'),
    designDocAuthReady: design.includes('Authentication screens should be account-first')
      && design.includes('do not repeat the verification-code path as a second large full-width button')
      && design.includes('open divider rows and a three-cell feature strip')
      && design.includes('login options such as “保持登录” and “忘记密码？” should remain on one compact row'),
    sourceMobileHeadingDensityReady: css.includes('Final mobile heading density override')
      && css.includes('font-size: clamp(27px, 7.35vw, 31px)')
      && css.includes('font-size: clamp(28px, 7.8vw, 34px)')
      && css.includes('Desktop/tablet utility title density')
      && css.includes('font-size: clamp(34px, 3.25vw, 50px)')
      && css.includes('font-size: clamp(30px, 4.5vw, 40px)'),
    sourceResponsiveRailPolishReady: css.includes('.topbar .status-pill')
      && css.includes('.success-pill::before')
      && css.includes('background: var(--surface-solid); border: 1px solid var(--border-2)')
      && css.includes('box-shadow: inset 0 0 0 1px rgba(14, 159, 110, .05)')
      && css.includes('grid-template-columns: repeat(6, 40px)')
      && css.includes('.icon-rail .rail-brand')
      && css.includes('display: none')
      && css.includes('width: 40px')
      && css.includes('height: 38px')
      && css.includes('background: transparent')
      && css.includes('border-color: transparent'),
    implementedViews: routeCount,
    expectedViewsReady: routeCount >= 7 && ['home', 'chat', 'contacts', 'discover', 'agent', 'settings', 'auth'].every((view) => main.includes(`view === '${view}'`)),
    figmaScriptParses: false,
    figmaScreenCalls: figmaCoverage.count,
    figmaScreenCoverage: figmaCoverage,
    figmaScreensReady: figmaCoverage.ready,
    figmaDiscoverBriefReady: figmaScript.includes('Discover brief exercise'),
    figmaBrandMarkReady: figmaScript.includes('addBrandMark'),
    figmaMobileHeadingDensityReady: figmaScript.includes("kind==='home'?27:28")
      && figmaScript.includes("lineHeight:kind==='home'?31:32")
      && figmaScript.includes("letterSpacing:-2.5")
      && figmaScript.includes('640,40')
      && figmaScript.includes('lineHeight:46')
      && figmaScript.includes('420,32')
      && figmaScript.includes('lineHeight:38'),
    figmaMobileCompactRailReady: figmaScript.includes('Mobile bottom dock icon rail / destination-only single-line glyph rail / no repeated brand')
      && figmaScript.includes('destination icon')
      && !figmaScript.includes('Mobile rail brand mark')
      && figmaScript.includes('mobileRail(root,14,778')
      && figmaScript.includes("mobileRail(root,14,778,w-28,dark,'agent')"),
    figmaAgentGlobalRailReady: figmaScript.includes("desktopRail(root,48,54,918,dark,'agent')")
      && figmaScript.includes('Tablet global icon rail / agent active'),
    figmaTabletTwoColumnReady: figmaScript.includes('Tablet two-column chat workspace') && figmaScript.includes('Tablet two-column agent workspace'),
    figmaResponsiveUtilityReady: figmaScript.includes('mobileUtilityScreen(page') && figmaScript.includes('tabletUtilityScreen(page'),
    figmaAntiCardFatigueReady: figmaScript.includes('Anti card-in-card fatigue')
      && figmaScript.includes('openWorkspace')
      && figmaScript.includes('dividerRow')
      && figmaScript.includes('accentBlock')
      && figmaScript.includes('flatRow')
      && figmaScript.includes('inlineProgress'),
    figmaPriorityListReady: figmaScript.includes('priorityList(')
      && figmaScript.includes('Priority list row'),
    figmaHomeWorkflowOpenReady: figmaScript.includes('homeWorkflowStrip')
      && figmaScript.includes('Home workflow open divider strip')
      && figmaScript.includes('Home workflow vertical divider')
      && figmaScript.includes('no nested cards'),
    figmaTabletToolDensityReady: figmaScript.includes('Tablet tool density'),
    figmaResponsiveRailPolishReady: figmaScript.includes('quiet neutral tool')
      && figmaScript.includes('Tablet compact destination-only toolbar rail')
      && figmaScript.includes('Status dot /')
      && figmaScript.includes("fill:active?C.blue500:'transparent'")
      && figmaScript.includes("stroke:active?C.blue500:'transparent'")
      && !figmaScript.includes('#CFF5DF'),
    figmaHomeSignalRowsReady: figmaScript.includes('homeSignalCard')
      && figmaScript.includes('Home signal progress')
      && figmaScript.includes('Home signal row'),
    figmaHomeInsightRailReady: figmaScript.includes('Home insight rail / one quiet signal panel')
      && figmaScript.includes('Home insight rail title')
      && figmaScript.includes('Home insight signal divider'),
    figmaDiscoverBriefOpenReady: figmaScript.includes('Discover brief open exercise')
      && figmaScript.includes('Discover brief step row')
      && figmaScript.includes('Tablet discover practice bar / horizontal open practice steps')
      && figmaScript.includes('Tablet practice step cell')
      && figmaScript.includes('Mobile discover brief / short practice flow strip')
      && figmaScript.includes('Mobile practice flow cell'),
    figmaAgentWorkflowReady: figmaScript.includes('Agent workflow step')
      && figmaScript.includes('Agent preview result')
      && figmaScript.includes('Agent permission row')
      && figmaScript.includes('Agent command strip / desktop')
      && figmaScript.includes('Tablet agent command strip'),
    figmaContactsProReady: figmaScript.includes('Contact signal strip')
      && figmaScript.includes('Contact open row')
      && figmaScript.includes('Contact request row')
      && figmaScript.includes('Contact meter'),
    figmaSettingsProReady: figmaScript.includes('Settings control strip')
      && figmaScript.includes('Settings toggle row')
      && figmaScript.includes('Settings confirm row')
      && figmaScript.includes('Settings toggle')
      && figmaScript.includes('Settings content-fit main')
      && figmaScript.includes('content-fit account status'),
    figmaAuthTrustFlowReady: figmaScript.includes('Auth trust flow')
      && figmaScript.includes('Auth method tabs')
      && figmaScript.includes('Login security list')
      && figmaScript.includes('Mobile login form first')
      && figmaScript.includes('Mobile auth support after login')
      && figmaScript.includes('login first')
      && figmaScript.includes('Tablet auth two-column workspace')
      && figmaScript.includes('login visible first'),
    figmaMobileChatPriorityReady: figmaScript.includes('Mobile chat priority / active room first')
      && figmaScript.includes('Mobile recent inbox after room / compact secondary list')
      && figmaScript.indexOf('Mobile chat priority / active room first') < figmaScript.indexOf('Mobile recent inbox after room / compact secondary list'),
  };
  try {
    // eslint-disable-next-line no-new-func
    new Function('figma', `(async()=>{${figmaScript}\n})`);
    audit.figmaScriptParses = true;
  } catch (error) {
    audit.figmaScriptError = String(error?.message || error);
  }
  audit.ready = [
    audit.heroUiDirectionDocumented,
    audit.bluePrimaryToken,
    audit.neutralLightBackgroundReady,
    audit.pureBlackDocumented,
    audit.lightModeNoHeavyDarkPanelsDocumented,
    audit.firstPaintThemePreset,
    audit.responsiveBreakpoints,
    audit.expectedViewsReady,
    audit.reducedMotionReady,
    audit.antiCardFatigueDocumented,
    audit.antiCardFatigueSourceReady,
    audit.sourcePriorityListReady,
    audit.sourceHomeSignalRowsReady,
    audit.sourceHomeInsightRailReady,
    audit.sourceMobileChatPriorityReady,
    audit.sourceDiscoverBriefOpenReady,
    audit.sourceAgentWorkflowReady,
    audit.designDocTopbarLanguageReady,
    audit.sourceTopnavLightweightReady,
    audit.sourceContactsProReady,
    audit.sourceSettingsProReady,
    audit.sourceAuthTrustFlowReady,
    audit.designDocAuthReady,
    audit.figmaScriptParses,
    audit.figmaScreensReady,
    audit.figmaDiscoverBriefReady,
    audit.figmaBrandMarkReady,
    audit.figmaMobileCompactRailReady,
    audit.figmaTabletTwoColumnReady,
    audit.figmaResponsiveUtilityReady,
    audit.figmaAntiCardFatigueReady,
    audit.figmaPriorityListReady,
    audit.figmaTabletToolDensityReady,
    audit.sourceMobileHeadingDensityReady,
    audit.figmaMobileHeadingDensityReady,
    audit.sourceResponsiveRailPolishReady,
    audit.figmaResponsiveRailPolishReady,
    audit.figmaHomeSignalRowsReady,
    audit.figmaHomeInsightRailReady,
    audit.figmaMobileChatPriorityReady,
    audit.figmaDiscoverBriefOpenReady,
    audit.figmaAgentWorkflowReady,
    audit.figmaContactsProReady,
    audit.figmaSettingsProReady,
    audit.figmaAuthTrustFlowReady,
  ].every(Boolean);
  return audit;
}

function fail(message) {
  throw new Error(message);
}

function assertReady() {
  if (!existsSync(distRoot)) fail(`dist 不存在：${distRoot}。请先执行 pnpm build。`);
  if (!chromePath) fail('没有找到 Chrome。可通过 CHROME_PATH 指定浏览器路径。');
}

function scanSource() {
  const files = [
    indexHtml,
    resolve(srcRoot, 'main.jsx'),
    resolve(srcRoot, 'styles.css'),
  ];
  const findings = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const rule of sourceBannedPatterns) {
      const match = text.match(rule.pattern);
      if (match) {
        const before = text.slice(0, match.index ?? 0);
        const line = before.split('\n').length;
        findings.push({ file, line, rule: rule.label, match: match[0] });
      }
    }
  }
  return findings;
}

function createStaticServer() {
  return createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      let pathname = normalize(decodeURIComponent(url.pathname));
      if (pathname.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (pathname === '/') pathname = '/index.html';
      let file = join(distRoot, pathname);
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(distRoot, 'index.html');
      res.writeHead(200, {
        'content-type': mime[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error?.stack || error));
    }
  });
}

function listen(server) {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveListen(address.port);
    });
  });
}

async function getJson(cdpPort, path) {
  for (let index = 0; index < 140; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}${path}`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  fail('Chrome 调试端口没有准备好。');
}

async function newPage(cdpPort, url) {
  await getJson(cdpPort, '/json');
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!response.ok) fail(`无法创建浏览器页面：${response.status}`);
  return response.json();
}

async function closePage(cdpPort, target) {
  if (!target?.id) return;
  try {
    await fetch(`http://127.0.0.1:${cdpPort}/json/close/${encodeURIComponent(target.id)}`);
  } catch {}
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}, timeout = 15000) {
    const id = (this.id += 1);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveSend, rejectSend) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        rejectSend(new Error(`CDP timeout: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, timer });
    });
  }
}

async function capture({ baseUrl, cdpPort, size, view, theme }) {
  const name = `static-${size.label}-${view.label}-${theme}`;
  const url = `${baseUrl}${view.path}?theme=${theme}&t=${encodeURIComponent(name)}`;
  const target = await newPage(cdpPort, url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  const cdp = new CDP(ws);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.width <= 430,
      screenWidth: size.width,
      screenHeight: size.height,
    });
    await cdp.send('Emulation.setVisibleSize', { width: size.width, height: size.height }).catch(() => {});
    await cdp.send('Page.navigate', { url });

    let lastState = null;
    for (let index = 0; index < 120; index += 1) {
      const state = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({
          url: location.href,
          ready: document.readyState,
          hasStage: !!document.querySelector('.stage'),
          text: document.body.innerText.slice(0, 100)
        }))()`,
        returnByValue: true,
      }, 5000);
      lastState = state.result.value;
      if (lastState.ready === 'complete' && lastState.hasStage) break;
      await delay(100);
      if (index === 119) fail(`页面加载失败：${JSON.stringify(lastState)}`);
    }
    await delay(220);

    const auditResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        try {
          const vw = document.documentElement.clientWidth;
          const sw = document.documentElement.scrollWidth;
          const bodySw = document.body.scrollWidth;
          const app = document.querySelector('.app');
          if (!app) return { evalError: 'missing .app root' };
          const ambient = document.querySelector('.ambient-grid');
          const offenders = Array.from(document.querySelectorAll('body *')).map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              cls: typeof el.className === 'string' ? el.className : String(el.className),
              text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 60),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          }).filter((item) => item.right > vw + 1 || item.left < -1).slice(0, 12);
          const railButtons = Array.from(document.querySelectorAll('.rail-button'));
          const railEmoji = railButtons.some((el) => /[\u{1F000}-\u{1FAFF}]/u.test(el.textContent || ''));
          const railTextPlaceholders = railButtons
            .map((el) => (el.textContent || '').replace(/\s+/g, '').trim())
            .filter(Boolean);
          const railUses = Array.from(document.querySelectorAll('.rail-button svg.iconfont use')).map((node) => node.getAttribute('href') || node.getAttribute('xlink:href') || '');
          const spriteSymbols = Array.from(document.querySelectorAll('.icon-sprite symbol')).map((node) => node.id);
          const expectedRailSymbols = ['ic-rail-home', 'ic-rail-message', 'ic-rail-contacts', 'ic-rail-discover', 'ic-rail-assistant', 'ic-rail-settings'];
          const spriteComplete = expectedRailSymbols.every((id) => spriteSymbols.includes(id));
          const railIconRefsValid = railButtons.length === 0
            ? true
            : railUses.length === railButtons.length && railUses.every((href) => href.startsWith('#ic-rail-') && spriteSymbols.includes(href.slice(1)));
          const iconSpriteReady = spriteComplete && railIconRefsValid;
          const railA11yReady = railButtons.length === 0
            ? true
            : railButtons.every((button) => button.hasAttribute('aria-label') && button.hasAttribute('aria-pressed'));
          const brandGlyphs = Array.from(document.querySelectorAll('.brand-glyph'));
          const brandGlyphReady = brandGlyphs.length >= 1
            && brandGlyphs.every((node) => !!node.querySelector('svg path') && !(node.textContent || '').trim());
          const iconRail = document.querySelector('.icon-rail');
          const railBrand = document.querySelector('.icon-rail > .rail-brand.brand-glyph');
          const railBrandStyle = railBrand ? getComputedStyle(railBrand) : null;
          const mobileDockBrandHidden = window.innerWidth > 760 || !iconRail || !railBrand || railBrandStyle?.display === 'none' || railBrand.getBoundingClientRect().width === 0;
          const railBrandReady = !iconRail
            || window.innerWidth <= 760
            || (!!railBrand && !!railBrand.querySelector('svg path') && !(railBrand.textContent || '').trim());
          const railRect = iconRail?.getBoundingClientRect();
          const railStyle = iconRail ? getComputedStyle(iconRail) : null;
          const agentGlobalRailReady = !location.pathname.includes('/agent') || !!iconRail;
          const mobileShouldHaveDock = window.innerWidth <= 760
            && ['/home','/chat','/contacts','/discover','/agent','/settings'].some((path) => location.pathname.includes(path));
          const mobileDockRailReady = window.innerWidth > 760 || !iconRail || (
            railStyle?.position === 'fixed'
            && !!railRect
            && railRect.bottom <= window.innerHeight - 8
            && railRect.bottom >= window.innerHeight - 28
            && Math.abs((railRect.left + railRect.width / 2) - window.innerWidth / 2) <= 2
          );
          const mobileCompactRailReady = window.innerWidth > 760 || !iconRail || (
            railRect.height <= 72
            && railButtons.length === 6
            && mobileDockBrandHidden
            && mobileDockRailReady
            && Array.from(railButtons).every((button) => {
              const rect = button.getBoundingClientRect();
              return rect.width >= 34 && rect.height >= 34 && rect.height <= 42;
            })
          );
          const tabletRailBrandHidden = window.innerWidth <= 760 || window.innerWidth > 1180 || !iconRail || !railBrand || railBrandStyle?.display === 'none' || railBrand.getBoundingClientRect().width === 0;
          const tabletRailHidden = window.innerWidth > 760 && window.innerWidth <= 1180 && (!iconRail || railStyle?.display === 'none' || !railRect || railRect.height === 0);
          const tabletCompactRailReady = window.innerWidth <= 760 || window.innerWidth > 1180 || tabletRailHidden || (
            !!railRect
            && railRect.height <= 64
            && railButtons.length === 6
            && tabletRailBrandHidden
            && Array.from(railButtons).every((button) => {
              const rect = button.getBoundingClientRect();
              return rect.width >= 36 && rect.width <= 44 && rect.height >= 36 && rect.height <= 42;
            })
          );
          const mobileDockPresenceReady = !mobileShouldHaveDock || !!iconRail;
          const mobileDockObstructions = window.innerWidth > 760 || !railRect
            ? []
            : Array.from(document.querySelectorAll('main#main-content button, main#main-content a[href], main#main-content input, main#main-content textarea, main#main-content select'))
              .filter((node) => !node.closest('.icon-rail'))
              .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                  node,
                  rect,
                  overlap: Math.max(0, Math.min(rect.bottom, railRect.bottom) - Math.max(rect.top, railRect.top)),
                };
              })
              .filter(({ rect, overlap }) => {
                if (rect.width === 0 || rect.height === 0) return false;
                if (rect.top >= window.innerHeight) return false;
                if (rect.bottom <= 0) return false;
                const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
                if (visibleHeight < Math.min(28, rect.height * 0.55)) return false;
                return overlap > Math.min(18, visibleHeight * 0.5);
              })
              .map(({ node, rect, overlap }) => ({
                tag: node.tagName,
                cls: typeof node.className === 'string' ? node.className : String(node.className),
                text: (node.textContent || node.getAttribute('aria-label') || node.getAttribute('placeholder') || '').replace(/\s+/g, ' ').slice(0, 40),
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                overlap: Math.round(overlap),
              })).slice(0, 8);
          const mobileDockContentClearReady = window.innerWidth > 760 || !mobileShouldHaveDock || mobileDockObstructions.length === 0;
          const topnav = document.querySelector('.topnav');
          const topnavButtons = Array.from(document.querySelectorAll('.topnav button'));
          const topnavCurrent = topnavButtons.filter((button) => button.getAttribute('aria-current') === 'page');
          const topnavLabels = topnavButtons.map((button) => button.textContent.trim());
          const topnavStyle = topnav ? getComputedStyle(topnav) : null;
          const isPhone = window.innerWidth <= 760;
          const desktopTopnavLightweightReady = !!topnav
            && topnavButtons.length === 2
            && topnavLabels.join('|') === '消息|助手'
            && !topnav.textContent.includes('登录')
            && topnavStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
            && (topnavStyle.borderTopWidth === '0px' || topnavStyle.borderTopStyle === 'none');
          const topnavHiddenOnPhoneReady = !isPhone || (
            !!topnav
            && topnavStyle?.display === 'none'
            && topnavButtons.every((button) => button.getBoundingClientRect().width === 0)
          );
          const topnavLightweightReady = isPhone
            ? topnavHiddenOnPhoneReady
            : desktopTopnavLightweightReady;
          const topnavA11yReady = topnavButtons.length === 2 && (
            topnavCurrent.length === 0
            || (topnavCurrent.length === 1 && topnavCurrent[0].classList.contains('active'))
          );
          const topbar = document.querySelector('.topbar');
          const topbarRect = topbar?.getBoundingClientRect();
          const topbarTools = document.querySelector('.topbar-tools');
          const topbarToolsStyle = topbarTools ? getComputedStyle(topbarTools) : null;
          const brandName = document.querySelector('.brand-name');
          const brandSubtitle = document.querySelector('.brand-subtitle');
          const brandNameStyle = brandName ? getComputedStyle(brandName) : null;
          const brandSubtitleStyle = brandSubtitle ? getComputedStyle(brandSubtitle) : null;
          const mobilePageTitle = document.querySelector('.mobile-page-title');
          const mobilePageTitleStyle = mobilePageTitle ? getComputedStyle(mobilePageTitle) : null;
          const mobilePageTitleRect = mobilePageTitle?.getBoundingClientRect();
          const mobilePageTitleReady = window.innerWidth > 760 || (
            !!mobilePageTitle
            && mobilePageTitleStyle?.display === 'block'
            && (mobilePageTitle.textContent || '').trim().length >= 2
            && !!mobilePageTitleRect
            && mobilePageTitleRect.width >= 32
            && mobilePageTitleRect.height <= 22
          );
          const currentThemeIsLight = !app.classList.contains('dark');
          const heavyDarkLightPanels = currentThemeIsLight
            ? Array.from(document.querySelectorAll('main#main-content *'))
              .map((node) => {
                const rect = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                return { node, rect, style };
              })
              .filter(({ node, rect, style }) => {
                if (node.closest('.icon-rail')) return false;
                if (rect.width < 120 || rect.height < 72) return false;
                const bg = style.backgroundColor.replace(/\s+/g, '');
                const isDarkBg = bg === 'rgb(0,0,0)' || bg === 'rgb(10,10,10)' || bg === 'rgb(17,17,17)' || bg === 'rgba(0,0,0,1)';
                return isDarkBg;
              })
              .map(({ node, rect, style }) => ({
                tag: node.tagName,
                cls: typeof node.className === 'string' ? node.className : String(node.className),
                text: (node.textContent || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                bg: style.backgroundColor,
              })).slice(0, 8)
            : [];
          const lightModeNoHeavyDarkPanelsReady = !currentThemeIsLight || heavyDarkLightPanels.length === 0;
          const themeToggle = document.querySelector('.theme-toggle');
          const quickTriggerRect = document.querySelector('.quick-trigger')?.getBoundingClientRect();
          const themeToggleRect = themeToggle?.getBoundingClientRect();
          const themeToggleText = themeToggle?.querySelector('span');
          const themeToggleTextRect = themeToggleText?.getBoundingClientRect();
          const quickTriggerText = document.querySelector('.quick-trigger span');
          const quickTriggerKey = document.querySelector('.quick-trigger kbd');
          const quickTriggerTextStyle = quickTriggerText ? getComputedStyle(quickTriggerText) : null;
          const quickTriggerKeyStyle = quickTriggerKey ? getComputedStyle(quickTriggerKey) : null;
          const statusText = document.querySelector('.status-pill span');
          const statusTextStyle = statusText ? getComputedStyle(statusText) : null;
          const mobileDiscoverBrief = window.innerWidth <= 760 && location.pathname.includes('/discover') ? document.querySelector('.discover-brief.mobile-brief-flow') : null;
          const mobileDiscoverBriefHeading = mobileDiscoverBrief?.querySelector('h2');
          const mobileDiscoverBriefSteps = mobileDiscoverBrief ? Array.from(mobileDiscoverBrief.querySelectorAll('.brief-steps span')) : [];
          const mobileDiscoverBriefReady = !mobileDiscoverBrief || (
            !!mobileDiscoverBriefHeading
            && mobileDiscoverBriefHeading.getBoundingClientRect().height <= 58
            && mobileDiscoverBriefSteps.length === 3
            && mobileDiscoverBriefSteps.every((step) => step.getBoundingClientRect().width >= 44 && step.getBoundingClientRect().height <= 52)
          );
          const mobileHomeFocusFlow = window.innerWidth <= 760 && location.pathname.includes('/home') ? document.querySelector('.home-hero .focus-flow') : null;
          const mobileHomeFocusStyle = mobileHomeFocusFlow ? getComputedStyle(mobileHomeFocusFlow) : null;
          const mobileHomePriorityRows = window.innerWidth <= 760 && location.pathname.includes('/home') ? Array.from(document.querySelectorAll('.home-hero .priority-list article')) : [];
          const mobileHomeFirstPriorityRect = mobileHomePriorityRows[0]?.getBoundingClientRect();
          const mobileHomeWorkflowCompactReady = window.innerWidth > 760 || !location.pathname.includes('/home') || (
            !!mobileHomeFocusFlow
            && mobileHomeFocusStyle?.gridTemplateColumns?.split(' ').length === 2
            && mobileHomeFocusFlow.getBoundingClientRect().height <= 112
          );
          const mobileHomePriorityVisibleReady = window.innerWidth > 760 || !location.pathname.includes('/home') || (
            !!mobileHomeFirstPriorityRect
            && mobileHomeFirstPriorityRect.top < window.innerHeight - 92
          );
          const mobileContactsRows = window.innerWidth <= 760 && location.pathname.includes('/contacts') ? Array.from(document.querySelectorAll('.contact-open-list .contact-row')) : [];
          const mobileContactSignalStrip = window.innerWidth <= 430 && location.pathname.includes('/contacts') ? document.querySelector('.contact-signal-strip') : null;
          const mobileContactSignalStyle = mobileContactSignalStrip ? getComputedStyle(mobileContactSignalStrip) : null;
          const mobileContactsFirstRowRect = mobileContactsRows[0]?.getBoundingClientRect();
          const mobileContactsFirstRowVisibleReady = window.innerWidth > 760 || !location.pathname.includes('/contacts') || (
            !!mobileContactsFirstRowRect
            && mobileContactsFirstRowRect.top < window.innerHeight - 92
          );
          const mobileContactsSignalCompactReady = window.innerWidth > 430 || !location.pathname.includes('/contacts') || (
            !!mobileContactSignalStrip
            && mobileContactSignalStyle?.gridTemplateColumns?.split(' ').length === 3
            && mobileContactSignalStrip.getBoundingClientRect().height <= 58
          );
          const tabletDiscoverBrief = window.innerWidth > 760 && window.innerWidth <= 1180 && location.pathname.includes('/discover') ? document.querySelector('.discover-brief.tablet-brief-bar') : null;
          const tabletDiscoverBriefStyle = tabletDiscoverBrief ? getComputedStyle(tabletDiscoverBrief) : null;
          const tabletDiscoverBriefHeading = tabletDiscoverBrief?.querySelector('h2');
          const tabletDiscoverBriefSteps = tabletDiscoverBrief ? Array.from(tabletDiscoverBrief.querySelectorAll('.brief-steps span')) : [];
          const tabletDiscoverBriefReady = !tabletDiscoverBrief || (
            tabletDiscoverBriefStyle?.gridTemplateColumns?.split(' ').length === 2
            && !!tabletDiscoverBriefHeading
            && tabletDiscoverBriefHeading.getBoundingClientRect().height <= 82
            && tabletDiscoverBriefSteps.length === 3
            && tabletDiscoverBriefSteps.every((step) => step.getBoundingClientRect().width >= 46)
          );
          const mobileHeadingNodes = window.innerWidth > 760 ? [] : Array.from(document.querySelectorAll('.home-hero h1, .utility-main h1, .auth-hero h1'));
          const mobileHeadingMetrics = mobileHeadingNodes.map((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return {
              cls: typeof node.className === 'string' ? node.className : String(node.className),
              text: (node.textContent || '').replace(/\s+/g, ' ').slice(0, 48),
              fontSize: Number.parseFloat(style.fontSize),
              lineHeight: Number.parseFloat(style.lineHeight),
              height: Math.round(rect.height),
            };
          });
          const mobileAppHeadingDensityReady = window.innerWidth > 760 || mobileHeadingMetrics.every((item) => (item.text.includes('让沟通更清晰') ? item.fontSize <= 35 : item.fontSize <= 32) && item.height <= 108);
          const utilityHeading = document.querySelector('.utility-main h1');
          const utilityHeadingRect = utilityHeading?.getBoundingClientRect();
          const utilityHeadingStyle = utilityHeading ? getComputedStyle(utilityHeading) : null;
          const utilityHeadingMetric = utilityHeading ? {
            text: (utilityHeading.textContent || '').replace(/\s+/g, ' ').slice(0, 48),
            fontSize: Number.parseFloat(utilityHeadingStyle.fontSize),
            lineHeight: Number.parseFloat(utilityHeadingStyle.lineHeight),
            height: Math.round(utilityHeadingRect.height),
          } : null;
          const utilityHeadingDensityReady = !utilityHeading || window.innerWidth <= 760 || (
            window.innerWidth > 1180
              ? utilityHeadingMetric.fontSize <= 52 && utilityHeadingMetric.height <= 118
              : utilityHeadingMetric.fontSize <= 42 && utilityHeadingMetric.height <= 100
          );
          const homeInsightCards = Array.from(document.querySelectorAll('.home-card'));
          const homeInsightGrid = document.querySelector('.home-card-grid');
          const homeInsightGridStyle = homeInsightGrid ? getComputedStyle(homeInsightGrid) : null;
          const homeInsightValueMetrics = homeInsightCards.map((card) => {
            const value = card.querySelector('.home-card-value strong');
            const rect = value?.getBoundingClientRect();
            const style = value ? getComputedStyle(value) : null;
            return {
              text: (value?.textContent || '').replace(/\s+/g, ' ').trim(),
              width: rect ? Math.round(rect.width) : 0,
              height: rect ? Math.round(rect.height) : 0,
              whiteSpace: style?.whiteSpace || '',
              fontSize: style ? Number.parseFloat(style.fontSize) : 0,
            };
          });
          const homeInsightRailReady = !location.pathname.includes('/home') || window.innerWidth <= 1180 || (
            !!homeInsightGrid
            && homeInsightCards.length === 4
            && homeInsightGridStyle?.gridTemplateColumns?.split(' ').length === 1
            && homeInsightValueMetrics.every((item) => item.whiteSpace === 'nowrap' && item.width >= item.height)
          );
          const mobileTopbarControlBounds = window.innerWidth > 760 || !topbarRect ? [] : [
            mobilePageTitle,
            document.querySelector('.quick-trigger'),
            document.querySelector('.status-pill'),
            document.querySelector('.activity-trigger'),
            themeToggle,
            document.querySelector('.profile-trigger'),
          ].filter(Boolean).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              cls: typeof node.className === 'string' ? node.className : String(node.className),
              text: (node.textContent || node.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim(),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          });
          const mobileTopbarControlsFit = window.innerWidth > 760 || (
            !!topbarRect
            && mobileTopbarControlBounds.length >= 6
            && mobileTopbarControlBounds.every((item) => item.left >= Math.floor(topbarRect.left) && item.right <= Math.ceil(topbarRect.right))
          );
          const mobileTopbarIsOneLine = window.innerWidth > 760 || (
            !!topbarRect
            && topbarRect.height <= 64
            && !!document.querySelector('.brand-lockup')
            && !!topbarTools
            && topbarToolsStyle?.display === 'flex'
            && topnavHiddenOnPhoneReady
            && mobilePageTitleReady
            && (!brandName || brandNameStyle?.display === 'none' || brandName.getBoundingClientRect().width === 0)
            && (!brandSubtitle || brandSubtitleStyle?.display === 'none' || brandSubtitle.getBoundingClientRect().width === 0)
            && (!quickTriggerText || quickTriggerTextStyle?.display === 'none' || quickTriggerText.getBoundingClientRect().width === 0)
            && (!quickTriggerKey || quickTriggerKeyStyle?.display === 'none' || quickTriggerKey.getBoundingClientRect().width === 0)
            && (!statusText || statusTextStyle?.display === 'none' || statusText.getBoundingClientRect().width === 0)
          );
          const mobileCompactTopbarReady = window.innerWidth > 760 || (
            mobileTopbarIsOneLine
            && mobileTopbarControlsFit
            && topnavLightweightReady
            && !!quickTriggerRect
            && quickTriggerRect.width >= 34
            && quickTriggerRect.width <= 38
            && !!themeToggleRect
            && themeToggleRect.width >= 34
            && themeToggleRect.width <= 38
          );
          const tabletToolDensityReady = window.innerWidth < 761 || window.innerWidth > 1180 || (
            !!topbarRect
            && topbarRect.height <= 72
            && topnavLightweightReady
            && !!quickTriggerRect
            && quickTriggerRect.height <= 38
            && !!themeToggleRect
            && themeToggleRect.height <= 38
            && (!themeToggleTextRect || themeToggleTextRect.height <= 18)
          );
          const railCurrent = Array.from(document.querySelectorAll('.rail-button')).filter((button) => button.getAttribute('aria-current') === 'page');
          const railCurrentReady = railButtons.length === 0
            ? true
            : railCurrent.length === 1 && railCurrent[0].classList.contains('active');
          const themeToggleReady = !!themeToggle && ['true', 'false'].includes(themeToggle.getAttribute('aria-pressed'));
          const quickTrigger = document.querySelector('.quick-trigger');
          const activityTrigger = document.querySelector('.activity-trigger');
          const profileTrigger = document.querySelector('.profile-trigger');
          const interactiveNodes = Array.from(document.querySelectorAll('button, a[href], input, textarea, select'));
          const unnamedInteractive = interactiveNodes.filter((node) => {
            if (node.closest('.icon-sprite')) return false;
            const label = (
              node.getAttribute('aria-label')
              || node.textContent
              || node.getAttribute('title')
              || node.getAttribute('placeholder')
              || node.closest('label')?.textContent
              || ''
            ).replace(/\\s+/g, '').trim();
            return !label;
          }).map((node) => ({
            tag: node.tagName,
            cls: typeof node.className === 'string' ? node.className : String(node.className),
          })).slice(0, 12);
          const smallTouchTargets = interactiveNodes.filter((node) => {
            if (node.classList.contains('link-button')) return false;
            if (node.type === 'checkbox' || node.type === 'radio') return false;
            if (node.tagName === 'INPUT' && node.closest('.search-box, .quick-search, .field-icon, .form-field')) return false;
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return rect.width < 34 || rect.height < 34;
          }).map((node) => ({
            tag: node.tagName,
            cls: typeof node.className === 'string' ? node.className : String(node.className),
            text: (node.textContent || node.getAttribute('aria-label') || node.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').slice(0, 40),
            width: Math.round(node.getBoundingClientRect().width),
            height: Math.round(node.getBoundingClientRect().height),
          })).slice(0, 12);
          const mainNode = document.querySelector('main#main-content.stage[tabindex="-1"]');
          const skipLink = document.querySelector('.skip-link[href="#main-content"]');
          const landmarkReady = !!mainNode && !!skipLink && document.querySelectorAll('main').length === 1;
          const formFieldsReady = Array.from(document.querySelectorAll('input, textarea')).every((node) => {
            if (node.type === 'checkbox') return !!node.closest('label');
            return !!node.closest('label') || !!node.getAttribute('aria-label') || !!node.getAttribute('placeholder');
          });
          const tabletTwoColumnReady = window.innerWidth < 761 || window.innerWidth > 1180 || (
            location.pathname.includes('/chat')
              ? (() => {
                const list = document.querySelector('.conversation-list')?.getBoundingClientRect();
                const main = document.querySelector('.chat-main')?.getBoundingClientRect();
                return !!list && !!main && Math.abs(list.top - main.top) <= 2 && list.right <= main.left - 8;
              })()
              : location.pathname.includes('/agent')
                ? (() => {
                  const command = document.querySelector('.agent-sidebar.agent-command-surface')?.getBoundingClientRect();
                  const main = document.querySelector('.agent-main')?.getBoundingClientRect();
                  const inspector = document.querySelector('.inspector-panel')?.getBoundingClientRect();
                  return !!command && !!main && !!inspector
                    && command.top < main.top - 8
                    && command.left <= main.left + 2
                    && command.right >= inspector.right - 2
                    && Math.abs(main.top - inspector.top) <= 2
                    && main.right <= inspector.left - 8;
                })()
                : true
          );
          const mobileChatPriorityReady = window.innerWidth > 760 || !location.pathname.includes('/chat') || (() => {
            const list = document.querySelector('.conversation-list')?.getBoundingClientRect();
            const main = document.querySelector('.chat-main')?.getBoundingClientRect();
            const roomTitle = document.querySelector('.chat-main .room-header h1')?.getBoundingClientRect();
            const composer = document.querySelector('.chat-main .composer')?.getBoundingClientRect();
            const send = document.querySelector('.chat-main .composer .primary-button')?.getBoundingClientRect();
            const dock = document.querySelector('.icon-rail')?.getBoundingClientRect();
            const visibleRows = Array.from(document.querySelectorAll('.conversation-list .conversation-row')).filter((row) => {
              const rect = row.getBoundingClientRect();
              const style = getComputedStyle(row);
              return style.display !== 'none' && rect.width > 0 && rect.height > 0;
            });
            return !!list
              && !!main
              && !!roomTitle
              && !!composer
              && !!send
              && main.top < list.top
              && roomTitle.top < window.innerHeight * 0.72
              && composer.top < window.innerHeight
              && send.bottom <= window.innerHeight
              && (!dock || send.bottom <= dock.top + 2)
              && visibleRows.length <= 3;
          })();
          const globalActionsReady = !!quickTrigger
            && quickTrigger.getAttribute('aria-haspopup') === 'dialog'
            && ['true', 'false'].includes(quickTrigger.getAttribute('aria-expanded'))
            && !!quickTrigger.querySelector('kbd')
            && !!activityTrigger
            && activityTrigger.getAttribute('aria-haspopup') === 'dialog'
            && ['true', 'false'].includes(activityTrigger.getAttribute('aria-expanded'))
            && !!profileTrigger
            && profileTrigger.getAttribute('aria-haspopup') === 'dialog'
            && ['true', 'false'].includes(profileTrigger.getAttribute('aria-expanded'))
            && !!document.querySelector('.profile-trigger-text');
          const composerReady = !!document.querySelector('.composer textarea')
            && !!document.querySelector('.composer [class*="primary-button"]')
            && !!document.querySelector('.composer-meta strong');
          const composerButton = document.querySelector('.composer .primary-button');
          const composerButtonRect = composerButton?.getBoundingClientRect();
          const composerVisible = !composerButtonRect
            ? true
            : composerButtonRect.bottom <= window.innerHeight + 1 && composerButtonRect.top >= -1;
          const loginCard = document.querySelector('.login-card');
          const authHero = document.querySelector('.auth-hero');
          const loginCardRect = loginCard?.getBoundingClientRect();
          const authHeroRect = authHero?.getBoundingClientRect();
          const methodTabsRect = document.querySelector('.login-method-tabs')?.getBoundingClientRect();
          const firstEmailFieldRect = document.querySelector('.login-card input[placeholder="you@example.com"]')?.getBoundingClientRect();
          const loginOptionsRect = document.querySelector('.login-options')?.getBoundingClientRect();
          const loginSecondaryRow = document.querySelector('.login-secondary-row');
          const loginSecondaryRect = loginSecondaryRow?.getBoundingClientRect();
          const loginReady = !!document.querySelector('.login-card[aria-busy]')
            && !!document.querySelector('.login-hint[aria-live="polite"]')
            && document.querySelectorAll('.login-card input').length >= 3;
          const authCompactLoginReady = !location.pathname.includes('/auth') || (
            !!loginSecondaryRow
            && !Array.from(document.querySelectorAll('.login-card button')).some((button) => button.textContent?.trim() === '使用邮箱验证码继续')
            && (!loginOptionsRect || loginOptionsRect.height <= (window.innerWidth <= 430 ? 44 : 48))
            && (!loginSecondaryRect || loginSecondaryRect.height <= (window.innerWidth <= 430 ? 42 : 48))
          );
          const mobileAuthLoginFirstReady = window.innerWidth > 760 || !location.pathname.includes('/auth') || (
            !!loginCardRect
            && !!authHeroRect
            && !!methodTabsRect
            && !!firstEmailFieldRect
            && loginCardRect.top < authHeroRect.top
            && loginCardRect.height < window.innerHeight * 0.9
            && methodTabsRect.top < window.innerHeight * 0.36
            && firstEmailFieldRect.top < window.innerHeight * 0.52
            && authCompactLoginReady
          );
          const tabletAuthTwoColumnReady = window.innerWidth <= 760 || window.innerWidth > 1180 || !location.pathname.includes('/auth') || (
            !!loginCardRect
            && !!authHeroRect
            && !!methodTabsRect
            && !!firstEmailFieldRect
            && authHeroRect.right <= loginCardRect.left - 8
            && loginCardRect.top < window.innerHeight * 0.22
            && methodTabsRect.top < window.innerHeight * 0.34
            && firstEmailFieldRect.top < window.innerHeight * 0.48
            && authCompactLoginReady
          );
          const agentNavReady = document.querySelectorAll('.agent-nav button[aria-current="page"]').length === 1;
          const desktopAgentCommandFitReady = window.innerWidth <= 1180 || !location.pathname.includes('/agent') || (() => {
            const command = document.querySelector('.agent-sidebar.agent-command-surface')?.getBoundingClientRect();
            const main = document.querySelector('.agent-main')?.getBoundingClientRect();
            const inspector = document.querySelector('.inspector-panel')?.getBoundingClientRect();
            const rail = document.querySelector('.agent-layout > .icon-rail')?.getBoundingClientRect();
            const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
            return !!command && !!main && !!inspector && !!rail && !!topbar
              && command.top >= topbar.bottom + 16
              && command.top <= topbar.bottom + 40
              && main.top <= command.bottom + 28
              && Math.abs(main.top - inspector.top) <= 2
              && rail.right <= command.left - 8;
          })();
          const mobileAgentFirstContentReady = window.innerWidth > 760 || !location.pathname.includes('/agent') || (() => {
            const nav = document.querySelector('.agent-sidebar')?.getBoundingClientRect();
            const main = document.querySelector('.agent-main')?.getBoundingClientRect();
            const firstStep = document.querySelector('.workflow-step')?.getBoundingClientRect();
            return !!nav && !!main && !!firstStep
              && nav.height <= 248
              && main.top < window.innerHeight * 0.72
              && firstStep.top < window.innerHeight - 36;
          })();
          const workspaceShell = document.querySelector('.workspace-shell');
          const workspaceStyle = workspaceShell ? getComputedStyle(workspaceShell) : null;
          const messageFeed = document.querySelector('.message-feed');
          const messageFeedStyle = messageFeed ? getComputedStyle(messageFeed) : null;
          const composer = document.querySelector('.composer');
          const assistantRows = Array.from(document.querySelectorAll('.assistant-panel .assistant-card'));
          const assistantRowsOpenReady = !location.pathname.includes('/chat') || assistantRows.length === 0 || assistantRows.every((row) => {
            const style = getComputedStyle(row);
            return parseFloat(style.borderTopWidth || '0') === 0
              && parseFloat(style.borderLeftWidth || '0') === 0
              && parseFloat(style.borderRightWidth || '0') === 0
              && parseFloat(style.borderRadius || '0') === 0
              && style.backgroundColor === 'rgba(0, 0, 0, 0)';
          });
          const antiCardFatigueReady = (
            (!workspaceStyle || (
              workspaceStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
              && workspaceStyle.boxShadow === 'none'
            ))
            && (!location.pathname.includes('/chat') || (
              !!messageFeed
              && !!composer
              && composer.classList.contains('inset')
              && !composer.classList.contains('card-surface')
              && messageFeedStyle?.backgroundColor === 'rgba(0, 0, 0, 0)'
              && getComputedStyle(composer).borderTopStyle !== 'none'
              && !!document.querySelector('.feed-status-strip')
              && !!document.querySelector('.quality-meter')
              && assistantRowsOpenReady
            ))
            && (!location.pathname.includes('/contacts') || !!document.querySelector('.filter-chip-row'))
            && (!location.pathname.includes('/agent') || !!document.querySelector('.process-progress'))
          );
          const productPolishReady = location.pathname.includes('/chat')
            ? !!document.querySelector('.member-cluster') && !!document.querySelector('.typing-row')
            : location.pathname.includes('/agent')
              ? !!document.querySelector('.suggestion-strip')
              : location.pathname.includes('/auth')
                ? !!document.querySelector('.trust-row')
                  && !!document.querySelector('.auth-trust-flow')
                  && document.querySelectorAll('.auth-flow-row').length >= 3
                  && !!document.querySelector('.login-method-tabs')
                  && !!document.querySelector('.login-security-list')
              : location.pathname.includes('/home')
                  ? !!document.querySelector('.home-card-grid')
                  : location.pathname.includes('/contacts')
                    ? !!document.querySelector('.contact-signal-strip')
                      && !!document.querySelector('.contact-open-list .contact-row')
                      && !!document.querySelector('.request-list')
                      && !!document.querySelector('.contact-meter')
                    : location.pathname.includes('/discover')
                      ? !!document.querySelector('.discover-grid')
                      : location.pathname.includes('/settings')
                        ? !!document.querySelector('.settings-control-strip')
                          && !!document.querySelector('.settings-open-list .setting-row')
                          && !!document.querySelector('.setting-toggle')
                          && !!document.querySelector('.settings-confirm-list')
                        : true;
          const mobileSettingsSwitchMetrics = window.innerWidth > 760 || !location.pathname.includes('/settings')
            ? []
            : Array.from(document.querySelectorAll('.settings-open-list .setting-row')).map((row) => {
              const rowRect = row.getBoundingClientRect();
              const toggle = row.querySelector('.setting-toggle');
              const track = row.querySelector('.setting-toggle-track');
              const toggleRect = toggle?.getBoundingClientRect();
              const trackRect = track?.getBoundingClientRect();
              return {
                rowRight: Math.round(rowRect.right),
                toggleLeft: toggleRect ? Math.round(toggleRect.left) : null,
                toggleRight: toggleRect ? Math.round(toggleRect.right) : null,
                trackLeft: trackRect ? Math.round(trackRect.left) : null,
                trackRight: trackRect ? Math.round(trackRect.right) : null,
                trackWidth: trackRect ? Math.round(trackRect.width) : null,
              };
            });
          const mobileSettingsSwitchInsetReady = window.innerWidth > 760 || !location.pathname.includes('/settings') || (
            mobileSettingsSwitchMetrics.length >= 4
            && mobileSettingsSwitchMetrics.every((item) => (
              item.toggleLeft !== null
              && item.toggleRight !== null
              && item.trackLeft !== null
              && item.trackRight !== null
              && item.trackWidth >= 32
              && item.trackRight <= item.rowRight - 3
              && item.toggleRight <= item.rowRight
            ))
          );
          const settingsMainRect = document.querySelector('.settings-layout > .utility-main')?.getBoundingClientRect();
          const settingsSide = document.querySelector('.settings-layout > .utility-side');
          const settingsSideRect = settingsSide?.getBoundingClientRect();
          const settingsSideStyle = settingsSide ? getComputedStyle(settingsSide) : null;
          const settingsContentFitReady = !location.pathname.includes('/settings') || (
            window.innerWidth <= 760
              ? settingsSideStyle?.display === 'none'
              : !!settingsMainRect
                && !!settingsSideRect
                && settingsMainRect.height < (window.innerWidth > 1180 ? 720 : 700)
                && settingsSideRect.height < (window.innerWidth > 1180 ? 500 : 470)
          );
          const visible = document.body.innerText;
          const visibleBanned = ${JSON.stringify(visibleBannedWords)}.filter((word) => visible.includes(word));
          const cssTexts = [];
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules || [])) cssTexts.push(rule.cssText || '');
            } catch {}
          }
          const styles = cssTexts.join(String.fromCharCode(10));
          const gradientUsage = /(?:linear|radial|conic)-gradient/i.test(styles);
          const violetUsage = /(?:purple|violet|#8b5cf6|#a855f7|#7c3aed|rgb\(139,\s*92,\s*246\))/i.test(styles);
          const allCssRules = Array.from(document.styleSheets).flatMap((sheet) => {
            try {
              return Array.from(sheet.cssRules || []);
            } catch {
              return [];
            }
          });
          const reducedMotionRules = allCssRules
            .filter((rule) => rule.conditionText && rule.conditionText.includes('prefers-reduced-motion'))
            .flatMap((rule) => Array.from(rule.cssRules || []));
          const reducedMotionReady = reducedMotionRules.some((rule) => {
            const style = rule.style;
            if (!style) return false;
            return style.getPropertyValue('scroll-behavior') === 'auto'
              && !!style.getPropertyValue('transition-duration')
              && style.getPropertyPriority('transition-duration') === 'important'
              && !!style.getPropertyValue('transition-delay')
              && style.getPropertyPriority('transition-delay') === 'important'
              && !!style.getPropertyValue('animation-duration')
              && style.getPropertyPriority('animation-duration') === 'important'
              && style.getPropertyValue('animation-iteration-count') === '1'
              && !!style.getPropertyValue('animation-delay')
              && style.getPropertyPriority('animation-delay') === 'important';
          });
          return {
            vw,
            sw,
            bodySw,
            overflow: Math.max(sw, bodySw) - vw,
            bg: getComputedStyle(app).backgroundColor,
            bodyBg: getComputedStyle(document.body).backgroundColor,
            lightNeutralBgReady: !app.classList.contains('dark')
              ? (
                getComputedStyle(app).backgroundColor === 'rgb(250, 250, 250)'
                && getComputedStyle(document.body).backgroundColor === 'rgb(250, 250, 250)'
                && (!ambient || getComputedStyle(ambient).backgroundColor === 'rgb(244, 244, 245)')
              )
              : true,
            ambientBg: ambient ? getComputedStyle(ambient).backgroundColor : '',
            ambientOpacity: ambient ? Number(getComputedStyle(ambient).opacity) : 0,
            appClass: app.className,
            railEmoji,
            railTextPlaceholders,
            railUses,
            spriteSymbols,
            spriteComplete,
            railIconRefsValid,
            iconSpriteReady,
            railA11yReady,
            brandGlyphReady,
            railBrandReady,
            mobileDockBrandHidden,
            agentGlobalRailReady,
            mobileCompactRailReady,
            tabletCompactRailReady,
            tabletRailHidden,
            tabletRailBrandHidden,
            mobileDockRailReady,
            mobileDockPresenceReady,
            mobileDockContentClearReady,
            mobileDockObstructions,
            lightModeNoHeavyDarkPanelsReady,
            heavyDarkLightPanels,
            railHeight: railRect ? Math.round(railRect.height) : 0,
            railPosition: railStyle?.position || '',
            mobileCompactTopbarReady,
            mobileTopbarIsOneLine,
            mobileTopbarControlsFit,
            mobileTopbarControlBounds,
            mobileAppHeadingDensityReady,
            mobileHeadingMetrics,
            utilityHeadingDensityReady,
            utilityHeadingMetric,
            homeInsightRailReady,
            homeInsightValueMetrics,
            tabletToolDensityReady,
            tabletDiscoverBriefReady,
            mobileDiscoverBriefReady,
            mobileHomeWorkflowCompactReady,
            mobileHomePriorityVisibleReady,
            mobileHomeWorkflowHeight: mobileHomeFocusFlow ? Math.round(mobileHomeFocusFlow.getBoundingClientRect().height) : null,
            mobileHomeFirstPriorityTop: mobileHomeFirstPriorityRect ? Math.round(mobileHomeFirstPriorityRect.top) : null,
            mobileContactsFirstRowVisibleReady,
            mobileContactsSignalCompactReady,
            mobileContactsFirstRowTop: mobileContactsFirstRowRect ? Math.round(mobileContactsFirstRowRect.top) : null,
            mobileContactSignalHeight: mobileContactSignalStrip ? Math.round(mobileContactSignalStrip.getBoundingClientRect().height) : null,
            mobileChatPriorityReady,
            topbarHeight: topbarRect ? Math.round(topbarRect.height) : 0,
            topbarToolsDisplay: topbarToolsStyle?.display || '',
            mobileBrandNameHidden: window.innerWidth > 760 || (!brandName || brandNameStyle?.display === 'none' || brandName.getBoundingClientRect().width === 0),
            mobileBrandSubtitleHidden: window.innerWidth > 760 || (!brandSubtitle || brandSubtitleStyle?.display === 'none' || brandSubtitle.getBoundingClientRect().width === 0),
            mobileQuickTriggerIconOnly: window.innerWidth > 760 || ((!quickTriggerText || quickTriggerTextStyle?.display === 'none' || quickTriggerText.getBoundingClientRect().width === 0) && (!quickTriggerKey || quickTriggerKeyStyle?.display === 'none' || quickTriggerKey.getBoundingClientRect().width === 0)),
            topnavLabels,
            topnavLightweightReady,
            topnavHiddenOnPhoneReady,
            mobilePageTitleReady,
            mobilePageTitleText: mobilePageTitle ? (mobilePageTitle.textContent || '').trim() : '',
            topnavA11yReady,
            railCurrentReady,
            themeToggleReady,
            landmarkReady,
            unnamedInteractive,
            smallTouchTargets,
            formFieldsReady,
            globalActionsReady,
            tabletTwoColumnReady,
            composerReady,
            composerVisible,
            loginReady,
            authCompactLoginReady,
            mobileAuthLoginFirstReady,
            tabletAuthTwoColumnReady,
            authLoginCardTop: loginCardRect ? Math.round(loginCardRect.top) : null,
            authHeroTop: authHeroRect ? Math.round(authHeroRect.top) : null,
            authMethodTabsTop: methodTabsRect ? Math.round(methodTabsRect.top) : null,
            authFirstEmailFieldTop: firstEmailFieldRect ? Math.round(firstEmailFieldRect.top) : null,
            loginCardHeight: loginCardRect ? Math.round(loginCardRect.height) : null,
            loginOptionsHeight: loginOptionsRect ? Math.round(loginOptionsRect.height) : null,
            loginSecondaryHeight: loginSecondaryRect ? Math.round(loginSecondaryRect.height) : null,
            agentNavReady,
            desktopAgentCommandFitReady,
            mobileAgentFirstContentReady,
            antiCardFatigueReady,
            productPolishReady,
            mobileSettingsSwitchInsetReady,
            mobileSettingsSwitchMetrics,
            settingsContentFitReady,
            settingsMainHeight: settingsMainRect ? Math.round(settingsMainRect.height) : null,
            settingsSideHeight: settingsSideRect ? Math.round(settingsSideRect.height) : null,
            priorityListReady: !location.pathname.includes('/home') || document.querySelectorAll('.priority-list article').length >= 3,
            gradientUsage,
            violetUsage,
            reducedMotionReady,
            visibleBanned,
            offenders,
          };
        } catch (error) {
          return { evalError: String(error && (error.stack || error.message || error)) };
        }
      })()`,
      returnByValue: true,
    }, 8000);
    const audit = auditResult?.result?.value;
    if (!audit || audit.evalError) {
      fail(`${name}: 页面审计脚本失败：${JSON.stringify(audit || auditResult)}`);
    }

    const path = join(outDir, `${name}.png`);
    const shouldPersistScreenshot = !lowDiskMode;                         
    if (shouldPersistScreenshot) {
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      }, 30000);
      writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
    }
    return {
      name,
      width: size.width,
      height: size.height,
      pathRoute: view.path,
      hash: view.hash,
      theme,
      path: shouldPersistScreenshot ? path : null,
      audit,
    };
  } finally {
    ws.close();
    await closePage(cdpPort, target);
  }
}


async function captureFullPage({ baseUrl, cdpPort, size, view, theme }) {
  const name = `full-${size.label}-${view.label}-${theme}`;
  const url = `${baseUrl}${view.path}?theme=${theme}&t=${encodeURIComponent(name)}`;
  const target = await newPage(cdpPort, url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  const cdp = new CDP(ws);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.width <= 430,
      screenWidth: size.width,
      screenHeight: size.height,
    });
    await cdp.send('Page.navigate', { url });
    for (let index = 0; index < 120; index += 1) {
      const state = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({ ready: document.readyState, hasStage: !!document.querySelector('.stage') }))()`,
        returnByValue: true,
      }, 5000);
      if (state.result.value.ready === 'complete' && state.result.value.hasStage) break;
      await delay(100);
      if (index === 119) fail(`${name}: 长页面加载失败。`);
    }
    await delay(180);
    const before = await cdp.send('Runtime.evaluate', {
      expression: `(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        appBg: getComputedStyle(document.querySelector('.app')).backgroundColor
      }))()`,
      returnByValue: true,
    }, 5000);
    await cdp.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.documentElement.scrollHeight)',
      returnByValue: true,
    }, 5000);
    await delay(120);
    const after = await cdp.send('Runtime.evaluate', {
      expression: `(() => ({
        scrollY: Math.round(window.scrollY),
        maxScrollY: Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight),
        hasStage: !!document.querySelector('.stage'),
        bottomText: document.body.innerText.slice(-240)
      }))()`,
      returnByValue: true,
    }, 5000);
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)', returnByValue: true }, 5000);
    const path = join(outDir, `${name}.png`);
    if (!lowDiskMode) {
      const metrics = await cdp.send('Page.getLayoutMetrics');
      const contentSize = metrics.contentSize;
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: Math.ceil(contentSize.width),
          height: Math.ceil(contentSize.height),
          scale: 1,
        },
      }, 30000);
      writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
    }
    const first = before.result.value;
    const last = after.result.value;
    return {
      name,
      width: size.width,
      height: size.height,
      pathRoute: view.path,
      theme,
      path: lowDiskMode ? null : path,
      audit: {
        ...first,
        ...last,
        overflow: first.scrollWidth - first.clientWidth,
        canScrollToBottom: last.maxScrollY === 0 || last.scrollY >= last.maxScrollY - 2,
      },
    };
  } finally {
    ws.close();
    await closePage(cdpPort, target);
  }
}


async function captureOverlay({ baseUrl, cdpPort, spec }) {
  const url = `${baseUrl}/chat?theme=${spec.theme}&t=${encodeURIComponent(spec.name)}`;
  const target = await newPage(cdpPort, url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  const cdp = new CDP(ws);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: spec.width,
      height: spec.height,
      deviceScaleFactor: 1,
      mobile: spec.width <= 430,
      screenWidth: spec.width,
      screenHeight: spec.height,
    });
    await cdp.send('Page.navigate', { url });
    for (let index = 0; index < 120; index += 1) {
      const state = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({ ready: document.readyState, hasStage: !!document.querySelector('.stage') }))()`,
        returnByValue: true,
      }, 5000);
      if (state.result.value.ready === 'complete' && state.result.value.hasStage) break;
      await delay(100);
      if (index === 119) fail(`浮层截图页面加载失败：${spec.name}`);
    }
    await delay(150);
    const action = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const trigger = document.querySelector(${JSON.stringify(spec.trigger)});
        if (!trigger) return { clicked: false, reason: 'missing trigger' };
        trigger.click();
        return { clicked: true };
      })()`,
      returnByValue: true,
    }, 5000);
    if (!action.result.value.clicked) fail(`${spec.name}: 无法打开浮层 ${JSON.stringify(action.result.value)}`);
    await delay(180);
    const audit = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.querySelector(${JSON.stringify(spec.panel)});
        const vw = document.documentElement.clientWidth;
        const sw = document.documentElement.scrollWidth;
        const bodySw = document.body.scrollWidth;
        const rect = panel?.getBoundingClientRect();
        return {
          panelReady: !!panel,
          panelText: panel?.innerText?.replace(/\s+/g, ' ').slice(0, 180) || '',
          overflow: Math.max(sw, bodySw) - vw,
          rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
          bg: getComputedStyle(document.querySelector('.app')).backgroundColor,
        };
      })()`,
      returnByValue: true,
    }, 5000);
    const value = audit.result.value;
    if (!value.panelReady) fail(`${spec.name}: 浮层没有出现`);
    if (value.overflow !== 0) fail(`${spec.name}: 浮层打开后横向溢出 ${value.overflow}px`);
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    }, 30000);
    const path = join(outDir, `${spec.name}.png`);
    writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
    return { ...spec, path, audit: value };
  } finally {
    ws.close();
    await closePage(cdpPort, target);
  }
}

async function captureOverlaySet({ baseUrl, cdpPort }) {
  const specs = [
    { name: 'overlay-desktop-quick-entry-light', width: 1440, height: 900, theme: 'light', trigger: '.quick-trigger', panel: '.quick-entry' },
    { name: 'overlay-desktop-activity-light', width: 1440, height: 900, theme: 'light', trigger: '.activity-trigger', panel: '.activity-panel' },
    { name: 'overlay-desktop-profile-light', width: 1440, height: 900, theme: 'light', trigger: '.profile-trigger', panel: '.profile-panel' },
    { name: 'overlay-mobile-quick-entry-dark', width: 390, height: 844, theme: 'dark', trigger: '.quick-trigger', panel: '.quick-entry' },
    { name: 'overlay-mobile-activity-dark', width: 390, height: 844, theme: 'dark', trigger: '.activity-trigger', panel: '.activity-panel' },
    { name: 'overlay-mobile-profile-dark', width: 390, height: 844, theme: 'dark', trigger: '.profile-trigger', panel: '.profile-panel' },
  ];
  const captures = [];
  for (const spec of specs) captures.push(await captureOverlay({ baseUrl, cdpPort, spec }));
  return captures;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function createContactSheet({ cdpPort, results }) {
  const orderedSizes = ['desktop', 'tablet', 'mobile', 'narrow-mobile'];
  const orderedThemes = ['light', 'dark'];
  const orderedViews = ['home', 'chat', 'contacts', 'discover', 'agent', 'settings', 'auth'];
  const resultMap = new Map(results.map((item) => [item.name, item]));
  const cells = [];
  for (const size of orderedSizes) {
    for (const theme of orderedThemes) {
      for (const view of orderedViews) {
        const item = resultMap.get(`static-${size}-${view}-${theme}`);
        if (!item) continue;
        const bytes = readFileSync(item.path).toString('base64');
        cells.push(`
          <article class="cell ${escapeHtml(size)}">
            <div class="label">${escapeHtml(size)}/${escapeHtml(view)}/${escapeHtml(theme)}</div>
            <img src="data:image/png;base64,${bytes}" alt="${escapeHtml(item.name)}" />
          </article>
        `);
      }
    }
  }
  const htmlPath = join(outDir, 'contact-sheet-all-pages.html');
  const pngPath = join(outDir, 'contact-sheet-all-pages.png');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>InfiniteChat visual contact sheet</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #ffffff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { width: 2100px; padding: 0; color: #0f172a; }
    .sheet { width: 2100px; display: grid; grid-template-columns: repeat(7, 300px); align-items: start; }
    .cell { width: 300px; min-height: 318px; padding: 6px 6px 10px; border: 1px solid #dbe7f5; background: #ffffff; overflow: hidden; }
    .cell.tablet { min-height: 438px; }
    .cell.mobile { min-height: 520px; }
    .label { height: 18px; display: flex; align-items: center; color: #334155; font-size: 12px; font-weight: 700; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    img { display: block; width: 100%; height: auto; border: 0; object-fit: contain; object-position: top center; }
    .cell.desktop img { max-height: 286px; }
    .cell.tablet img { max-height: 404px; }
    .cell.mobile img { max-height: 486px; }
  </style>
</head>
<body>
  <main class="sheet">${cells.join('\n')}</main>
</body>
</html>`;
  writeFileSync(htmlPath, html);

  const target = await newPage(cdpPort, pathToFileURL(htmlPath).href);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  const cdp = new CDP(ws);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 2100,
      height: 2600,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 2100,
      screenHeight: 2600,
    });
    await cdp.send('Page.navigate', { url: pathToFileURL(htmlPath).href });
    for (let index = 0; index < 120; index += 1) {
      const state = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({
          ready: document.readyState,
          imageCount: document.images.length,
          loadedImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length,
          height: document.documentElement.scrollHeight
        }))()`,
        returnByValue: true,
      }, 5000);
      const value = state?.result?.value;
      if (!value) {
        await delay(120);
        if (index === 119) fail(`总览图加载失败：${JSON.stringify(state)}`);
        continue;
      }
      if (value.ready === 'complete' && value.imageCount === cells.length && value.loadedImages === value.imageCount) break;
      await delay(120);
      if (index === 119) fail(`总览图加载失败：${JSON.stringify(value)}`);
    }
    await delay(120);
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const contentSize = metrics.contentSize;
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(contentSize.width),
        height: Math.ceil(contentSize.height),
        scale: 1,
      },
    }, 30000);
    writeFileSync(pngPath, Buffer.from(screenshot.data, 'base64'));
    return { htmlPath, pngPath, cells: cells.length, width: Math.ceil(contentSize.width), height: Math.ceil(contentSize.height) };
  } finally {
    ws.close();
    await closePage(cdpPort, target);
  }
}

async function runInteractionAudit({ baseUrl, cdpPort }) {
  const target = await newPage(cdpPort, `${baseUrl}/chat?theme=light&t=interaction-audit`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  const cdp = new CDP(ws);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1440,
      screenHeight: 1100,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}/chat?theme=light&t=interaction-audit` });
    for (let index = 0; index < 120; index += 1) {
      const state = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({ ready: document.readyState, hasStage: !!document.querySelector('.stage') }))()`,
        returnByValue: true,
      }, 5000);
      if (state.result.value.ready === 'complete' && state.result.value.hasStage) break;
      await delay(100);
      if (index === 119) fail('交互审计页面加载失败。');
    }
    await delay(120);
    const auditResult = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const setNativeValue = (node, value) => {
          if (!node) return false;
          const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
          descriptor?.set?.call(node, value);
          node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        };
        const clickText = async (selector, text) => {
          const node = Array.from(document.querySelectorAll(selector)).find((item) => (
            (item.textContent || '').includes(text)
            || (item.getAttribute('aria-label') || '').includes(text)
            || (item.title || '').includes(text)
          ));
          if (!node) return false;
          node.click();
          await wait(80);
          return true;
        };
        const read = () => ({
          pathname: location.pathname,
          appDark: document.querySelector('.app')?.classList.contains('dark') || false,
          quickOpen: !!document.querySelector('.quick-entry'),
          activityOpen: !!document.querySelector('.activity-panel'),
          profileOpen: !!document.querySelector('.profile-panel'),
          activeTopnav: document.querySelector('.topnav button.active')?.textContent?.trim() || '',
          activeRail: document.querySelector('.rail-button.active')?.getAttribute('aria-label') || '',
          selectedConversation: document.querySelector('.conversation-row.active strong')?.textContent?.trim() || '',
          activeAgentNav: document.querySelector('.agent-nav button.active span')?.textContent?.trim() || '',
          activeMode: document.querySelector('.mode-tabs button.active')?.textContent?.trim() || '',
          loginHint: document.querySelector('.login-hint')?.textContent?.trim() || '',
          composerText: document.querySelector('.composer textarea')?.value || '',
          sendDisabled: document.querySelector('.composer .primary-button')?.disabled ?? null,
          email: document.querySelector('.login-card input[placeholder="you@example.com"]')?.value || '',
          password: document.querySelector('.login-card input[type="password"]')?.value || '',
        });
        const steps = [];
        const quickTrigger = document.querySelector('.quick-trigger');
        if (quickTrigger) {
          quickTrigger.click();
          await wait(80);
          steps.push({ step: 'quick-open', ok: !!document.querySelector('.quick-entry'), state: read() });
          const quickInput = document.querySelector('.quick-entry input');
          setNativeValue(quickInput, '资料');
          await wait(80);
          steps.push({ step: 'quick-search', ok: !!document.querySelector('.quick-entry') && (quickInput?.value || '').includes('资料'), state: read() });
          const quickAction = Array.from(document.querySelectorAll('.quick-list button')).find((item) => (item.textContent || '').includes('查找相关资料'));
          quickAction?.click();
          await wait(100);
          steps.push({ step: 'quick-select-agent', ok: !!quickAction, state: read() });
        } else {
          steps.push({ step: 'quick-open', ok: false, state: read() });
        }
        const activityTrigger = document.querySelector('.activity-trigger');
        if (activityTrigger) {
          activityTrigger.click();
          await wait(80);
          steps.push({ step: 'activity-open', ok: !!document.querySelector('.activity-panel'), state: read() });
          document.querySelector('.activity-panel [aria-label="关闭提醒中心"]')?.click();
          await wait(80);
          steps.push({ step: 'activity-close', ok: !document.querySelector('.activity-panel'), state: read() });
        } else {
          steps.push({ step: 'activity-open', ok: false, state: read() });
        }
        const profileTrigger = document.querySelector('.profile-trigger');
        if (profileTrigger) {
          profileTrigger.click();
          await wait(80);
          steps.push({ step: 'profile-open', ok: !!document.querySelector('.profile-panel'), state: read() });
          document.querySelector('.profile-panel [aria-label="关闭账号状态"]')?.click();
          await wait(80);
          steps.push({ step: 'profile-close', ok: !document.querySelector('.profile-panel'), state: read() });
        } else {
          steps.push({ step: 'profile-open', ok: false, state: read() });
        }
        await clickText('.topnav button', '消息');
        await wait(80);
        const themeClicked = await clickText('.theme-toggle', '');
        steps.push({ step: 'theme-toggle', ok: themeClicked, state: read() });
        const agentClicked = await clickText('.topnav button', '助手');
        steps.push({ step: 'topnav-agent', ok: agentClicked, state: read() });
        const knowledgeClicked = await clickText('.agent-nav button', '知识问答');
        steps.push({ step: 'agent-nav-knowledge', ok: knowledgeClicked, state: read() });
        const dataModeClicked = await clickText('.mode-tabs button', '资料');
        steps.push({ step: 'mode-tabs-data', ok: dataModeClicked, state: read() });
        const chatClicked = await clickText('.topnav button', '消息');
        steps.push({ step: 'topnav-chat', ok: chatClicked, state: read() });
        const contactsClicked = await clickText('.rail-button', '联系人');
        steps.push({ step: 'rail-contacts', ok: contactsClicked, state: read() });
        const discoverClicked = await clickText('.rail-button', '发现');
        steps.push({ step: 'rail-discover', ok: discoverClicked, state: read() });
        const settingsClicked = await clickText('.rail-button', '设置');
        steps.push({ step: 'rail-settings', ok: settingsClicked, state: read() });
        const railChatClicked = await clickText('.rail-button', '消息');
        steps.push({ step: 'rail-chat', ok: railChatClicked, state: read() });
        const jasonClicked = await clickText('.conversation-row', 'Jason');
        steps.push({ step: 'conversation-jason', ok: jasonClicked, state: read() });
        const composer = document.querySelector('.composer textarea');
        if (composer) {
          composer.focus();
          setNativeValue(composer, '');
          await wait(80);
          steps.push({ step: 'composer-empty', ok: true, state: read() });
          setNativeValue(composer, '帮我整理成更自然的回复。');
          await wait(80);
          steps.push({ step: 'composer-filled', ok: true, state: read() });
        } else {
          steps.push({ step: 'composer-missing', ok: false, state: read() });
        }
        const profileForLogin = document.querySelector('.profile-trigger');
        if (profileForLogin) {
          profileForLogin.click();
          await wait(80);
          const loginAction = document.querySelector('.profile-login-action');
          loginAction?.click();
          await wait(100);
          steps.push({ step: 'profile-login-auth', ok: !!loginAction, state: read() });
        } else {
          steps.push({ step: 'profile-login-auth', ok: false, state: read() });
        }
        const email = document.querySelector('.login-card input[placeholder="you@example.com"]');
        const password = document.querySelector('.login-card input[type="password"]');
        if (email && password) {
          setNativeValue(email, 'user@example.com');
          setNativeValue(password, 'password123');
          await wait(80);
          steps.push({ step: 'login-inputs', ok: true, state: read() });
        } else {
          steps.push({ step: 'login-inputs-missing', ok: false, state: read() });
        }
        const submit = document.querySelector('.login-card button[type="submit"]');
        if (submit) {
          submit.click();
          await wait(120);
          steps.push({ step: 'login-submit-start', ok: true, state: read() });
          await wait(950);
          steps.push({ step: 'login-submit-finish', ok: true, state: read() });
        } else {
          steps.push({ step: 'login-submit-missing', ok: false, state: read() });
        }
        return { steps };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, 8000);
    const value = auditResult?.result?.value;
    if (!value?.steps) fail(`交互审计脚本失败：${JSON.stringify(auditResult)}`);
    return value;
  } finally {
    ws.close();
    await closePage(cdpPort, target);
  }
}

function validateReport(results, sourceFindings) {
  const failures = [];
  for (const finding of sourceFindings) {
    failures.push(`源码检查失败：${finding.rule} ${finding.file}:${finding.line} ${finding.match}`);
  }
  for (const item of results) {
    const audit = item.audit;
    if (audit.overflow !== 0) failures.push(`${item.name}: 横向溢出 ${audit.overflow}px`);
    if (item.theme === 'light' && !audit.lightNeutralBgReady) failures.push(`${item.name}: 浅色背景不是中性灰，app=${audit.bg} body=${audit.bodyBg} ambient=${audit.ambientBg}`);
    if (item.theme === 'light' && !audit.lightModeNoHeavyDarkPanelsReady) failures.push(`${item.name}: 浅色模式仍存在大面积黑色面板 ${JSON.stringify(audit.heavyDarkLightPanels?.slice(0, 3) || [])}`);
    if (item.theme === 'dark' && audit.bg !== 'rgb(0, 0, 0)') failures.push(`${item.name}: 深色背景不是纯黑，而是 ${audit.bg}`);
    if (item.theme === 'dark' && audit.bodyBg !== 'rgb(0, 0, 0)') failures.push(`${item.name}: body 深色背景不是纯黑，而是 ${audit.bodyBg}`);
    if (item.theme === 'dark' && audit.ambientOpacity !== 0) failures.push(`${item.name}: 深色氛围层没有关闭，opacity=${audit.ambientOpacity}`);
    if (audit.railEmoji) failures.push(`${item.name}: icon rail 仍存在 emoji 文本`);
    if (audit.railTextPlaceholders?.length) failures.push(`${item.name}: icon rail 仍存在可见文字占位 ${audit.railTextPlaceholders.join(', ')}`);
    if (!audit.spriteComplete) failures.push(`${item.name}: SVG symbol sprite 不完整`);
    if (!audit.railIconRefsValid) failures.push(`${item.name}: icon rail 没有使用完整的 SVG symbol sprite 引用`);
    if (!audit.railA11yReady) failures.push(`${item.name}: icon rail 缺少可访问状态`);
    if (!audit.brandGlyphReady) failures.push(`${item.name}: 品牌标识不是 SVG 图形或仍有文字占位`);
    if (!audit.railBrandReady) failures.push(`${item.name}: icon rail 顶部品牌不是 SVG 图形`);
    if (item.width <= 760 && !audit.mobileDockBrandHidden) failures.push(`${item.name}: 手机端底部 dock 不应重复显示品牌标识，顶部栏已经承担品牌入口`);
    if (!audit.agentGlobalRailReady) failures.push(`${item.name}: 助手页缺少全局 icon rail，跨页面导航不完整`);
    if (!audit.mobileDockPresenceReady) failures.push(`${item.name}: 手机端主页面缺少底部 dock 导航`);
    if (!audit.mobileCompactTopbarReady) failures.push(`${item.name}: 手机端顶部栏不是单行紧凑工具栏，或仍显示品牌名称/解释/工具文字/控件被裁切，高度=${audit.topbarHeight}px 工具区=${audit.topbarToolsDisplay} bounds=${JSON.stringify(audit.mobileTopbarControlBounds || [])}`);
    if (item.width <= 760 && (!audit.topnavHiddenOnPhoneReady || !audit.mobilePageTitleReady)) failures.push(`${item.name}: 手机顶栏应隐藏消息/助手文字导航并显示当前页短标题，title=${audit.mobilePageTitleText || ''} topnavHidden=${audit.topnavHiddenOnPhoneReady}`);
    if (!audit.mobileCompactRailReady) failures.push(`${item.name}: 手机端 icon rail 仍然过高、不是单行紧凑底部 dock，或占用了首屏顶部空间，高度=${audit.railHeight}px position=${audit.railPosition}`);
    if (!audit.tabletCompactRailReady) failures.push(`${item.name}: 平板 icon rail 仍然过厚或重复显示品牌标识，高度=${audit.railHeight}px brandHidden=${audit.tabletRailBrandHidden}`);
    if (item.width <= 760 && !audit.mobileAppHeadingDensityReady) failures.push(`${item.name}: 手机端主标题仍像落地页巨幅标题，未达到 App 工作台密度 ${JSON.stringify(audit.mobileHeadingMetrics || [])}`);
    if (item.width > 760 && ['/home','/contacts','/discover','/settings'].includes(item.pathRoute) && !audit.utilityHeadingDensityReady) failures.push(`${item.name}: 工具页标题仍像落地页巨幅标题，未达到 HeroUI Pro 工作台密度 ${JSON.stringify(audit.utilityHeadingMetric || {})}`);
    if (item.width > 1180 && item.pathRoute === '/home' && !audit.homeInsightRailReady) failures.push(`${item.name}: 首页右侧洞察区不是单一开放侧栏，或状态/数值被挤成竖排 ${JSON.stringify(audit.homeInsightValueMetrics || [])}`);
    if (item.width <= 760 && item.pathRoute === '/chat' && !audit.mobileChatPriorityReady) failures.push(`${item.name}: 手机聊天页仍让收件箱列表优先，当前会话和输入路径没有进入首屏优先区`);
    if (!audit.mobileDockContentClearReady) failures.push(`${item.name}: 手机端底部 dock 遮住了主内容交互元素 ${JSON.stringify(audit.mobileDockObstructions?.slice(0, 3) || [])}`);
    if (!audit.landmarkReady) failures.push(`${item.name}: 缺少跳到主内容或 main landmark`);
    if (audit.unnamedInteractive?.length) failures.push(`${item.name}: 有交互元素缺少可访问名称 ${JSON.stringify(audit.unnamedInteractive.slice(0, 3))}`);
    if (audit.smallTouchTargets?.length) failures.push(`${item.name}: 有触控目标过小 ${JSON.stringify(audit.smallTouchTargets.slice(0, 3))}`);
    if (!audit.formFieldsReady) failures.push(`${item.name}: 表单字段缺少 label/placeholder/aria-label`);
    if (!audit.topnavLightweightReady) failures.push(`${item.name}: 顶部导航仍包含登录或背景块过重`);
    if (!audit.topnavA11yReady) failures.push(`${item.name}: 顶部导航当前页状态异常`);
    if (!audit.railCurrentReady) failures.push(`${item.name}: icon rail 缺少准确的当前页状态`);
    if (!audit.themeToggleReady) failures.push(`${item.name}: 主题切换缺少 aria-pressed 状态`);
    if (!audit.globalActionsReady) failures.push(`${item.name}: 顶部全局操作缺少快捷入口、提醒或账号状态`);
    if (!audit.tabletToolDensityReady) failures.push(`${item.name}: 平板顶部工具区密度不够精致，主题按钮发生换行或高度异常`);
    if (item.width > 760 && item.width <= 1180 && item.pathRoute === '/discover' && !audit.tabletDiscoverBriefReady) failures.push(`${item.name}: 平板发现页精选练习区块仍然过窄或标题换行过碎`);
    if (item.width <= 760 && item.pathRoute === '/discover' && !audit.mobileDiscoverBriefReady) failures.push(`${item.name}: 手机发现页精选练习区块仍像压缩桌面内容，未使用短标题和三步流程条`);
    if (item.width <= 760 && item.pathRoute === '/home' && !audit.mobileHomeWorkflowCompactReady) failures.push(`${item.name}: 手机首页流程仍是单列长列表，不是 2×2 紧凑工作台 workflowHeight=${audit.mobileHomeWorkflowHeight}`);
    if (item.width <= 760 && item.pathRoute === '/home' && !audit.mobileHomePriorityVisibleReady) failures.push(`${item.name}: 手机首页首屏看不到真实优先事项，仍像落地页 firstPriorityTop=${audit.mobileHomeFirstPriorityTop}`);
    if (item.width <= 760 && item.pathRoute === '/contacts' && !audit.mobileContactsFirstRowVisibleReady) failures.push(`${item.name}: 手机联系人页首屏看不到真实联系人行，概览区仍然过高 firstRowTop=${audit.mobileContactsFirstRowTop}`);
    if (item.width <= 430 && item.pathRoute === '/contacts' && !audit.mobileContactsSignalCompactReady) failures.push(`${item.name}: 手机联系人概览不是紧凑三列信息条，高度=${audit.mobileContactSignalHeight}`);
    if (!audit.tabletTwoColumnReady) failures.push(`${item.name}: 平板端没有使用两栏工作区布局`);
    if ((item.pathRoute === '/chat') && !audit.composerReady) failures.push(`${item.name}: 聊天输入区不完整`);
    if ((item.pathRoute === '/chat') && item.width >= 1180 && !audit.composerVisible) failures.push(`${item.name}: 桌面聊天发送区没有完整出现在首屏截图内`);
    if ((item.pathRoute === '/agent') && !audit.agentNavReady) failures.push(`${item.name}: 助手导航缺少当前状态`);
    if ((item.pathRoute === '/agent') && !audit.desktopAgentCommandFitReady) failures.push(`${item.name}: 桌面助手命令条或主内容被全局 icon rail 撑低，没有形成贴顶内容区`);
    if ((item.pathRoute === '/agent') && !audit.mobileAgentFirstContentReady) failures.push(`${item.name}: 手机端助手导航占用过高，首屏看不到工作流内容`);
    if ((item.pathRoute === '/auth') && !audit.loginReady) failures.push(`${item.name}: 登录表单交互状态不完整`);
    if ((item.pathRoute === '/auth') && !audit.authCompactLoginReady) failures.push(`${item.name}: 登录页验证码入口或登录选项过重，仍像重复大按钮/换行表单`);
    if ((item.pathRoute === '/auth') && !audit.mobileAuthLoginFirstReady) failures.push(`${item.name}: 手机登录页首屏没有优先展示登录表单 tabs=${audit.authMethodTabsTop} email=${audit.authFirstEmailFieldTop} form=${audit.authLoginCardTop} hero=${audit.authHeroTop}`);
    if ((item.pathRoute === '/auth') && !audit.tabletAuthTwoColumnReady) failures.push(`${item.name}: 平板登录页没有让登录表单在首屏可见并与说明区并排 form=${audit.authLoginCardTop} hero=${audit.authHeroTop}`);
    if ((item.pathRoute === '/settings') && !audit.mobileSettingsSwitchInsetReady) failures.push(`${item.name}: 手机设置页开关过度贴边或被裁切 ${JSON.stringify(audit.mobileSettingsSwitchMetrics || [])}`);
    if ((item.pathRoute === '/settings') && !audit.settingsContentFitReady) failures.push(`${item.name}: 设置页仍像后台管理空白列，未使用内容贴合面板 main=${audit.settingsMainHeight} side=${audit.settingsSideHeight}`);
    if (!audit.antiCardFatigueReady) failures.push(`${item.name}: 仍存在卡片套卡片疲劳风险，未使用开放工作区/分隔行/左侧强调线结构`);
    if (!audit.priorityListReady) failures.push(`${item.name}: 首页缺少真实优先级列表，首屏信息密度不足`);
    if (!audit.productPolishReady) failures.push(`${item.name}: 产品级细节组件缺失`);
    if (audit.gradientUsage) failures.push(`${item.name}: 检测到 CSS 渐变`);
    if (audit.violetUsage) failures.push(`${item.name}: 检测到紫色/紫罗兰色系`);
    if (!audit.reducedMotionReady) failures.push(`${item.name}: 减少动态效果支持不完整`);
    if (audit.visibleBanned.length) failures.push(`${item.name}: 页面可见内部词 ${audit.visibleBanned.join(', ')}`);
    if (audit.offenders.length) failures.push(`${item.name}: 有元素越界 ${JSON.stringify(audit.offenders.slice(0, 3))}`);
  }
  return failures;
}

function validateInteractionAudit(interactionAudit) {
  const failures = [];
  const steps = interactionAudit?.steps || [];
  const byStep = new Map(steps.map((step) => [step.step, step]));
  const requireStep = (name) => {
    const step = byStep.get(name);
    if (!step) failures.push(`交互审计缺少步骤：${name}`);
    else if (!step.ok) failures.push(`交互审计步骤失败：${name}`);
    return step;
  };
  const theme = requireStep('theme-toggle');
  const quickOpen = requireStep('quick-open');
  if (quickOpen && !quickOpen.state.quickOpen) failures.push('交互审计失败：快速入口没有打开');
  const quickSearch = requireStep('quick-search');
  if (quickSearch && !quickSearch.state.quickOpen) failures.push('交互审计失败：快速入口搜索时浮层消失');
  const quickSelect = requireStep('quick-select-agent');
  if (quickSelect && quickSelect.state.activeTopnav !== '助手') failures.push(`交互审计失败：快速入口没有切到助手，而是 ${quickSelect.state.activeTopnav}`);
  const activityOpen = requireStep('activity-open');
  if (activityOpen && !activityOpen.state.activityOpen) failures.push('交互审计失败：提醒中心没有打开');
  const activityClose = requireStep('activity-close');
  if (activityClose && activityClose.state.activityOpen) failures.push('交互审计失败：提醒中心没有关闭');
  const profileOpen = requireStep('profile-open');
  if (profileOpen && !profileOpen.state.profileOpen) failures.push('交互审计失败：账号状态没有打开');
  const profileClose = requireStep('profile-close');
  if (profileClose && profileClose.state.profileOpen) failures.push('交互审计失败：账号状态没有关闭');
  if (theme && !theme.state.appDark) failures.push('交互审计失败：主题切换后没有进入深色模式');
  const agent = requireStep('topnav-agent');
  if (agent && agent.state.activeTopnav !== '助手') failures.push(`交互审计失败：顶部导航没有切到助手，而是 ${agent.state.activeTopnav}`);
  const knowledge = requireStep('agent-nav-knowledge');
  if (knowledge && knowledge.state.activeAgentNav !== '知识问答') failures.push(`交互审计失败：助手侧边导航没有切到知识问答，而是 ${knowledge.state.activeAgentNav}`);
  const dataMode = requireStep('mode-tabs-data');
  if (dataMode && dataMode.state.activeMode !== '资料') failures.push(`交互审计失败：助手模式没有切到资料，而是 ${dataMode.state.activeMode}`);
  const chat = requireStep('topnav-chat');
  if (chat && chat.state.activeTopnav !== '消息') failures.push(`交互审计失败：顶部导航没有切回消息，而是 ${chat.state.activeTopnav}`);
  const railContacts = requireStep('rail-contacts');
  if (railContacts && (railContacts.state.pathname !== '/contacts' || railContacts.state.activeRail !== '联系人')) failures.push(`交互审计失败：rail 没有切到联系人：${JSON.stringify(railContacts.state)}`);
  const railDiscover = requireStep('rail-discover');
  if (railDiscover && (railDiscover.state.pathname !== '/discover' || railDiscover.state.activeRail !== '发现')) failures.push(`交互审计失败：rail 没有切到发现：${JSON.stringify(railDiscover.state)}`);
  const railSettings = requireStep('rail-settings');
  if (railSettings && (railSettings.state.pathname !== '/settings' || railSettings.state.activeRail !== '设置')) failures.push(`交互审计失败：rail 没有切到设置：${JSON.stringify(railSettings.state)}`);
  const railChat = requireStep('rail-chat');
  if (railChat && (railChat.state.pathname !== '/chat' || railChat.state.activeRail !== '消息')) failures.push(`交互审计失败：rail 没有切回消息：${JSON.stringify(railChat.state)}`);
  const jason = requireStep('conversation-jason');
  if (jason && jason.state.selectedConversation !== 'Jason') failures.push(`交互审计失败：会话没有切到 Jason，而是 ${jason.state.selectedConversation}`);
  const empty = requireStep('composer-empty');
  if (empty && !empty.state.sendDisabled) failures.push('交互审计失败：输入区清空后发送按钮没有禁用');
  const filled = requireStep('composer-filled');
  if (filled && (filled.state.sendDisabled || !filled.state.composerText.includes('更自然'))) failures.push('交互审计失败：输入区填入内容后发送按钮没有恢复可用');
  const auth = requireStep('profile-login-auth');
  if (auth && auth.state.pathname !== '/auth') failures.push(`交互审计失败：账号入口没有进入登录页：${JSON.stringify(auth.state)}`);
  const loginInputs = requireStep('login-inputs');
  if (loginInputs && (loginInputs.state.email !== 'user@example.com' || loginInputs.state.password !== 'password123')) failures.push('交互审计失败：登录表单输入没有生效');
  const loginStart = requireStep('login-submit-start');
  if (loginStart && !loginStart.state.loginHint.includes('正在')) failures.push(`交互审计失败：登录开始提示不正确：${loginStart.state.loginHint}`);
  const loginFinish = requireStep('login-submit-finish');
  if (loginFinish && !loginFinish.state.loginHint.includes('已准备好')) failures.push(`交互审计失败：登录完成提示不正确：${loginFinish.state.loginHint}`);
  return failures;
}

function validateDesignSystemAudit(designSystemAudit) {
  const failures = [];
  if (!designSystemAudit.heroUiDirectionDocumented) failures.push('设计系统审计失败：DESIGN.md 未记录 HeroUI 风格方向');
  if (!designSystemAudit.bluePrimaryToken) failures.push('设计系统审计失败：蓝色主色 token 不一致');
  if (!designSystemAudit.neutralLightBackgroundReady) failures.push('设计系统审计失败：浅色背景/普通柔和面未统一为中性灰，或仍存在蓝灰背景 token');
  if (!designSystemAudit.pureBlackDocumented) failures.push('设计系统审计失败：纯黑深色 token / 文档 / Figma 脚本不完整');
  if (!designSystemAudit.lightModeNoHeavyDarkPanelsDocumented) failures.push('设计系统审计失败：浅色模式无大面积黑色功能面板规则未同步到 DESIGN.md/CSS/Figma 脚本');
  if (!designSystemAudit.firstPaintThemePreset) failures.push('设计系统审计失败：首屏主题预设缺失，可能出现深色闪浅色');
  if (!designSystemAudit.responsiveBreakpoints) failures.push('设计系统审计失败：手机 / 平板 / 桌面响应式断点不完整');
  if (!designSystemAudit.expectedViewsReady) failures.push('设计系统审计失败：产品视图数量不完整');
  if (!designSystemAudit.reducedMotionReady) failures.push('设计系统审计失败：减少动态效果规则或文档不完整');
  if (!designSystemAudit.antiCardFatigueDocumented) failures.push('设计系统审计失败：DESIGN.md 未记录避免卡片套卡片的开放工作区规则');
  if (!designSystemAudit.antiCardFatigueSourceReady) failures.push('设计系统审计失败：前端源码未固化开放工作区/分隔行/左侧强调线结构');
  if (!designSystemAudit.sourcePriorityListReady) failures.push('设计系统审计失败：前端首页优先级列表未固化');
  if (!designSystemAudit.sourceHomeWorkflowOpenReady) failures.push('设计系统审计失败：首页流程步骤仍偏嵌套卡片，未固化为开放式分隔步骤条');
  if (!designSystemAudit.sourceHomeSignalRowsReady) failures.push('设计系统审计失败：前端首页信息卡缺少进度/分隔行，信息密度不足');
  if (!designSystemAudit.sourceHomeInsightRailReady) failures.push('设计系统审计失败：首页桌面洞察侧栏未固化为单一开放侧栏，或状态数值缺少横排保护');
  if (!designSystemAudit.sourceMobileChatPriorityReady) failures.push('设计系统审计失败：前端手机聊天页未固化当前会话优先、收件箱后置的移动端结构');
  if (!designSystemAudit.sourceDiscoverBriefOpenReady) failures.push('设计系统审计失败：前端发现页精选练习仍是大块内嵌卡片，未开放为分隔行结构');
  if (!designSystemAudit.sourceAgentWorkflowReady) failures.push('设计系统审计失败：前端 Agent 页仍偏传统表单，未升级为工作流/结果预览结构');
  if (!designSystemAudit.designDocTopbarLanguageReady) failures.push('设计系统审计失败：DESIGN.md 仍保留手机端旧式 segmented nav/controls 表述');
  if (!designSystemAudit.sourceTopnavLightweightReady) failures.push('设计系统审计失败：前端顶部消息/助手导航未轻量化，或登录仍在 switch 中');
  if (!designSystemAudit.sourceContactsProReady) failures.push('设计系统审计失败：联系人页未升级为概览信号、开放联系人行、申请列表和联系人热度结构');
  if (!designSystemAudit.sourceSettingsProReady) failures.push('设计系统审计失败：设置页未升级为控制概览、开放设置行、开关和确认列表结构');
  if (!designSystemAudit.sourceAuthTrustFlowReady) failures.push('设计系统审计失败：登录页未升级为信任流程、登录方式和安全提示结构');
  if (!designSystemAudit.sourceMobileHeadingDensityReady) failures.push('设计系统审计失败：前端未固化手机端 App 级标题密度规则');
  if (!designSystemAudit.figmaMobileHeadingDensityReady) failures.push('设计系统审计失败：Figma 脚本未同步手机端 App 级标题密度');
  if (!designSystemAudit.sourceResponsiveRailPolishReady) failures.push('设计系统审计失败：前端未落实安静在线状态、平板轻工具栏 rail 或透明非激活 dock 按钮');
  if (!designSystemAudit.figmaScriptParses) failures.push(`设计系统审计失败：Figma 脚本语法异常 ${designSystemAudit.figmaScriptError || ''}`.trim());
  if (!designSystemAudit.figmaScreensReady) {
    const coverage = designSystemAudit.figmaScreenCoverage || {};
    failures.push(`设计系统审计失败：Figma 画板矩阵不完整 count=${designSystemAudit.figmaScreenCalls} product=${coverage.productFrameCount}/${coverage.expectedProductFrameCount} designSystem=${coverage.designSystemFrameCount}/1 missing=${JSON.stringify(coverage.missing || [])} duplicates=${JSON.stringify(coverage.duplicates || [])} unexpected=${JSON.stringify(coverage.unexpected || [])}`);
  }
  if (!designSystemAudit.figmaDiscoverBriefReady) failures.push('设计系统审计失败：Figma 发现页未同步精选练习区块');
  if (!designSystemAudit.figmaBrandMarkReady) failures.push('设计系统审计失败：Figma 脚本未同步 SVG 品牌标识');
  if (!designSystemAudit.figmaMobileCompactRailReady) failures.push('设计系统审计失败：Figma 脚本未同步手机端目的地-only 紧凑单行 dock');
  if (!designSystemAudit.figmaAgentGlobalRailReady) failures.push('设计系统审计失败：Figma 脚本未同步助手页桌面/平板全局 icon rail');
  if (!designSystemAudit.figmaTabletTwoColumnReady) failures.push('设计系统审计失败：Figma 脚本未同步平板两栏工作区');
  if (!designSystemAudit.figmaResponsiveUtilityReady) failures.push('设计系统审计失败：Figma 脚本未同步工具页手机/平板响应式画板');
  if (!designSystemAudit.figmaAntiCardFatigueReady) failures.push('设计系统审计失败：Figma 脚本未同步避免卡片套卡片的开放/分隔/强调线构件');
  if (!designSystemAudit.figmaPriorityListReady) failures.push('设计系统审计失败：Figma 首页未同步优先级列表');
  if (!designSystemAudit.figmaHomeWorkflowOpenReady) failures.push('设计系统审计失败：Figma 首页流程步骤未同步开放式分隔步骤条');
  if (!designSystemAudit.figmaTabletToolDensityReady) failures.push('设计系统审计失败：Figma 脚本未同步平板顶部工具区密度');
  if (!designSystemAudit.figmaResponsiveRailPolishReady) failures.push('设计系统审计失败：Figma 脚本未同步安静在线状态和平板轻工具栏 rail');
  if (!designSystemAudit.figmaHomeSignalRowsReady) failures.push('设计系统审计失败：Figma 首页信息卡未同步进度/分隔行');
  if (!designSystemAudit.figmaHomeInsightRailReady) failures.push('设计系统审计失败：Figma 首页未同步单一开放洞察侧栏');
  if (!designSystemAudit.figmaMobileChatPriorityReady) failures.push('设计系统审计失败：Figma 手机聊天页未同步当前会话优先结构');
  if (!designSystemAudit.figmaDiscoverBriefOpenReady) failures.push('设计系统审计失败：Figma 发现页精选练习未同步开放分隔行结构');
  if (!designSystemAudit.figmaAgentWorkflowReady) failures.push('设计系统审计失败：Figma Agent 页未同步工作流/结果预览结构');
  if (!designSystemAudit.figmaContactsProReady) failures.push('设计系统审计失败：Figma 联系人页未同步概览信号、开放联系人行、请求行和热度条');
  if (!designSystemAudit.figmaSettingsProReady) failures.push('设计系统审计失败：Figma 设置页未同步控制概览、开关行和确认行');
  if (!designSystemAudit.figmaAuthTrustFlowReady) failures.push('设计系统审计失败：Figma 登录页未同步信任流程、登录方式和安全提示');
  return failures;
}

function validateFullPageCaptures(fullPageCaptures) {
  const failures = [];
  for (const item of fullPageCaptures) {
    if (item.audit.overflow !== 0) failures.push(`${item.name}: 长页面横向溢出 ${item.audit.overflow}px`);
    if (!item.audit.canScrollToBottom) failures.push(`${item.name}: 长页面无法滚动到底部`);
    if (item.theme === 'dark' && item.audit.appBg !== 'rgb(0, 0, 0)') failures.push(`${item.name}: 长页面深色 app 背景不是纯黑 ${item.audit.appBg}`);
    if (item.theme === 'dark' && item.audit.bodyBg !== 'rgb(0, 0, 0)') failures.push(`${item.name}: 长页面深色 body 背景不是纯黑 ${item.audit.bodyBg}`);
    if (!item.audit.hasStage) failures.push(`${item.name}: 长页面缺少 stage`);
  }
  return failures;
}

async function main() {
  assertReady();
  mkdirSync(outDir, { recursive: true });
  const sourceFindings = scanSource();
  const designSystemAudit = auditDesignSystemSource();
  const server = createStaticServer();
  const staticPort = await listen(server);
  const cdpPort = 9200 + Math.floor(Math.random() * 600);
  const userDataDir = join(tmpdir(), `infinitechat-ui-verify-${process.pid}-${Date.now()}`);
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-application-cache',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const baseUrl = `http://127.0.0.1:${staticPort}`;
    const results = [];
    for (const size of sizes) {
      for (const view of views) {
        for (const theme of themes) {
          results.push(await capture({ baseUrl, cdpPort, size, view, theme }));
        }
      }
    }
    const interactionAudit = await runInteractionAudit({ baseUrl, cdpPort });
    const overlayCaptures = await captureOverlaySet({ baseUrl, cdpPort });
    const fullPageCaptures = [];
    for (const spec of fullPageSpecs) {
      fullPageCaptures.push(await captureFullPage({ baseUrl, cdpPort, ...spec }));
    }
    const contactSheet = lowDiskMode
      ? { htmlPath: null, pngPath: null, cells: 0, lowDiskMode: true }
      : await createContactSheet({ cdpPort, results });
    const failures = [
      ...validateReport(results, sourceFindings),
      ...validateInteractionAudit(interactionAudit),
      ...validateDesignSystemAudit(designSystemAudit),
      ...validateFullPageCaptures(fullPageCaptures),
    ];
    const reportPath = join(outDir, 'static-verification-report.json');
    const summary = {
      reportPath,
      screenshots: results.length,
      failures,
      designSystemReady: designSystemAudit.ready,
      darkPureBlack: results.filter((item) => item.theme === 'dark').every((item) => item.audit.bg === 'rgb(0, 0, 0)'),
      darkBodyPureBlack: results.filter((item) => item.theme === 'dark').every((item) => item.audit.bodyBg === 'rgb(0, 0, 0)'),
      darkAmbientDisabled: results.filter((item) => item.theme === 'dark').every((item) => item.audit.ambientOpacity === 0),
      lightNeutralBackgroundReady: results.filter((item) => item.theme === 'light').every((item) => item.audit.lightNeutralBgReady) && designSystemAudit.neutralLightBackgroundReady,
      lightModeNoHeavyDarkPanelsDocumented: designSystemAudit.lightModeNoHeavyDarkPanelsDocumented,
      lightModeNoHeavyDarkPanelsReady: results.filter((item) => item.theme === 'light').every((item) => item.audit.lightModeNoHeavyDarkPanelsReady),
      noOverflow: results.every((item) => item.audit.overflow === 0),
      noVisibleInternalCopy: results.every((item) => item.audit.visibleBanned.length === 0),
      noEmojiRail: results.every((item) => !item.audit.railEmoji),
      noRailTextPlaceholders: results.every((item) => !item.audit.railTextPlaceholders?.length),
      spriteComplete: results.every((item) => item.audit.spriteComplete),
      railIconRefsValid: results.every((item) => item.audit.railIconRefsValid),
      iconSpriteReady: results.every((item) => item.audit.iconSpriteReady),
      railA11yReady: results.every((item) => item.audit.railA11yReady),
      brandGlyphReady: results.every((item) => item.audit.brandGlyphReady),
      railBrandReady: results.every((item) => item.audit.railBrandReady),
      agentGlobalRailReady: results.every((item) => item.audit.agentGlobalRailReady),
      mobileDockPresenceReady: results.every((item) => item.audit.mobileDockPresenceReady),
      mobileCompactTopbarReady: results.every((item) => item.audit.mobileCompactTopbarReady),
      mobileTopbarControlsFit: results.every((item) => item.audit.mobileTopbarControlsFit),
      mobilePageTitleTopbarReady: results.filter((item) => item.width <= 760).every((item) => item.audit.topnavHiddenOnPhoneReady && item.audit.mobilePageTitleReady),
      mobileCompactRailReady: results.every((item) => item.audit.mobileCompactRailReady),
      tabletCompactRailReady: results.every((item) => item.audit.tabletCompactRailReady),
      mobileDestinationOnlyDockReady: results.filter((item) => item.width <= 430 && item.pathRoute !== '/auth').every((item) => item.audit.mobileDockBrandHidden),
      mobileAppHeadingDensityReady: results.filter((item) => item.width <= 430).every((item) => item.audit.mobileAppHeadingDensityReady),
      utilityHeadingDensityReady: results.filter((item) => item.width > 760 && ['/home','/contacts','/discover','/settings'].includes(item.pathRoute)).every((item) => item.audit.utilityHeadingDensityReady),
      homeInsightRailReady: results.filter((item) => item.width > 1180 && item.pathRoute === '/home').every((item) => item.audit.homeInsightRailReady),
      mobileChatPriorityReady: results.filter((item) => item.width <= 760 && item.pathRoute === '/chat').every((item) => item.audit.mobileChatPriorityReady),
      mobileDockContentClearReady: results.every((item) => item.audit.mobileDockContentClearReady),
      tabletToolDensityReady: results.every((item) => item.audit.tabletToolDensityReady),
      tabletDiscoverBriefReady: results.filter((item) => item.width === 834 && item.pathRoute === '/discover').every((item) => item.audit.tabletDiscoverBriefReady),
      mobileDiscoverBriefReady: results.filter((item) => item.width <= 430 && item.pathRoute === '/discover').every((item) => item.audit.mobileDiscoverBriefReady),
      mobileHomeWorkflowCompactReady: results.filter((item) => item.width <= 760 && item.pathRoute === '/home').every((item) => item.audit.mobileHomeWorkflowCompactReady),
      mobileHomePriorityVisibleReady: results.filter((item) => item.width <= 760 && item.pathRoute === '/home').every((item) => item.audit.mobileHomePriorityVisibleReady),
      mobileContactsFirstRowVisibleReady: results.filter((item) => item.width <= 760 && item.pathRoute === '/contacts').every((item) => item.audit.mobileContactsFirstRowVisibleReady),
      mobileContactsSignalCompactReady: results.filter((item) => item.width <= 430 && item.pathRoute === '/contacts').every((item) => item.audit.mobileContactsSignalCompactReady),
      tabletTwoColumnReady: results.every((item) => item.audit.tabletTwoColumnReady),
      landmarkReady: results.every((item) => item.audit.landmarkReady),
      noUnnamedInteractive: results.every((item) => !item.audit.unnamedInteractive?.length),
      touchTargetsReady: results.every((item) => !item.audit.smallTouchTargets?.length),
      formFieldsReady: results.every((item) => item.audit.formFieldsReady),
      topnavLightweightReady: results.every((item) => item.audit.topnavLightweightReady),
      topnavA11yReady: results.every((item) => item.audit.topnavA11yReady),
      railCurrentReady: results.every((item) => item.audit.railCurrentReady),
      themeToggleReady: results.every((item) => item.audit.themeToggleReady),
      globalActionsReady: results.every((item) => item.audit.globalActionsReady),
      composerReady: results.filter((item) => item.pathRoute === '/chat').every((item) => item.audit.composerReady),
      desktopComposerVisible: results.filter((item) => item.pathRoute === '/chat' && item.width >= 1180).every((item) => item.audit.composerVisible),
      loginReady: results.filter((item) => item.pathRoute === '/auth').every((item) => item.audit.loginReady),
      authCompactLoginReady: results.filter((item) => item.pathRoute === '/auth').every((item) => item.audit.authCompactLoginReady) && designSystemAudit.designDocAuthReady,
      mobileAuthLoginFirstReady: results.filter((item) => item.pathRoute === '/auth' && item.width <= 430).every((item) => item.audit.mobileAuthLoginFirstReady),
      tabletAuthTwoColumnReady: results.filter((item) => item.pathRoute === '/auth' && item.width > 760 && item.width <= 1180).every((item) => item.audit.tabletAuthTwoColumnReady),
      mobileSettingsSwitchInsetReady: results.filter((item) => item.pathRoute === '/settings' && item.width <= 430).every((item) => item.audit.mobileSettingsSwitchInsetReady),
      settingsContentFitReady: results.filter((item) => item.pathRoute === '/settings').every((item) => item.audit.settingsContentFitReady),
      agentNavReady: results.filter((item) => item.pathRoute === '/agent').every((item) => item.audit.agentNavReady),
      desktopAgentCommandFitReady: results.filter((item) => item.pathRoute === '/agent').every((item) => item.audit.desktopAgentCommandFitReady),
      mobileAgentFirstContentReady: results.filter((item) => item.pathRoute === '/agent').every((item) => item.audit.mobileAgentFirstContentReady),
      antiCardFatigueReady: results.every((item) => item.audit.antiCardFatigueReady)
        && designSystemAudit.antiCardFatigueDocumented
        && designSystemAudit.antiCardFatigueSourceReady
        && designSystemAudit.figmaAntiCardFatigueReady,
      priorityListReady: results.every((item) => item.audit.priorityListReady),
      sourcePriorityListReady: designSystemAudit.sourcePriorityListReady,
      sourceHomeWorkflowOpenReady: designSystemAudit.sourceHomeWorkflowOpenReady,
      sourceHomeSignalRowsReady: designSystemAudit.sourceHomeSignalRowsReady,
      sourceHomeInsightRailReady: designSystemAudit.sourceHomeInsightRailReady,
      sourceMobileChatPriorityReady: designSystemAudit.sourceMobileChatPriorityReady,
      sourceDiscoverBriefOpenReady: designSystemAudit.sourceDiscoverBriefOpenReady,
      sourceAgentWorkflowReady: designSystemAudit.sourceAgentWorkflowReady,
      designDocTopbarLanguageReady: designSystemAudit.designDocTopbarLanguageReady,
      sourceTopnavLightweightReady: designSystemAudit.sourceTopnavLightweightReady,
      sourceContactsProReady: designSystemAudit.sourceContactsProReady,
      sourceSettingsProReady: designSystemAudit.sourceSettingsProReady,
      sourceAuthTrustFlowReady: designSystemAudit.sourceAuthTrustFlowReady,
      designDocAuthReady: designSystemAudit.designDocAuthReady,
      sourceMobileHeadingDensityReady: designSystemAudit.sourceMobileHeadingDensityReady,
      figmaMobileHeadingDensityReady: designSystemAudit.figmaMobileHeadingDensityReady,
      sourceResponsiveRailPolishReady: designSystemAudit.sourceResponsiveRailPolishReady,
      figmaPriorityListReady: designSystemAudit.figmaPriorityListReady,
      figmaHomeWorkflowOpenReady: designSystemAudit.figmaHomeWorkflowOpenReady,
      figmaTabletToolDensityReady: designSystemAudit.figmaTabletToolDensityReady,
      figmaResponsiveRailPolishReady: designSystemAudit.figmaResponsiveRailPolishReady,
      figmaHomeSignalRowsReady: designSystemAudit.figmaHomeSignalRowsReady,
      figmaHomeInsightRailReady: designSystemAudit.figmaHomeInsightRailReady,
      figmaMobileChatPriorityReady: designSystemAudit.figmaMobileChatPriorityReady,
      figmaDiscoverBriefOpenReady: designSystemAudit.figmaDiscoverBriefOpenReady,
      figmaAgentWorkflowReady: designSystemAudit.figmaAgentWorkflowReady,
      figmaAgentGlobalRailReady: designSystemAudit.figmaAgentGlobalRailReady,
      figmaContactsProReady: designSystemAudit.figmaContactsProReady,
      figmaSettingsProReady: designSystemAudit.figmaSettingsProReady,
      figmaAuthTrustFlowReady: designSystemAudit.figmaAuthTrustFlowReady,
      productPolishReady: results.every((item) => item.audit.productPolishReady),
      reducedMotionReady: results.every((item) => item.audit.reducedMotionReady) && designSystemAudit.reducedMotionReady,
      interactionAuditReady: validateInteractionAudit(interactionAudit).length === 0,
      overlayScreenshots: overlayCaptures.length,
      overlayCapturesReady: overlayCaptures.every((item) => item.audit.panelReady && item.audit.overflow === 0),
      fullPageScreenshots: fullPageCaptures.length,
      fullPageCapturesReady: validateFullPageCaptures(fullPageCaptures).length === 0,
      contactSheetPath: contactSheet.pngPath,
      contactSheetCells: contactSheet.cells,
      noGradients: results.every((item) => !item.audit.gradientUsage),
      noViolet: results.every((item) => !item.audit.violetUsage),
    };
    const report = {
      createdAt: new Date().toISOString(),
      appRoot,
      outDir,
      sourceFindings,
      designSystemAudit,
      summary,
      interactionAudit,
      overlayCaptures,
      fullPageCaptures,
      contactSheet,
      failures,
      results,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    chrome.kill('SIGTERM');
    server.close();
  }
}

await main();
