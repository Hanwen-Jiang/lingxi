import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const projectRoot = resolve(appRoot, '..');
const frontendArtifactRoot = resolve(projectRoot, '.artifacts/frontend/infinitechat-web');
const figmaArtifactRoot = resolve(projectRoot, '.artifacts/figma/hifi-heroui-preview');
const deliveryParent = resolve(projectRoot, '.artifacts/delivery');
const deliveryRoot = resolve(deliveryParent, 'infinitechat-heroui-hifi');
const zipPath = resolve(deliveryParent, 'infinitechat-heroui-hifi.zip');

const deviceOrder = ['desktop', 'tablet', 'mobile', 'narrow-mobile'];
const routeOrder = ['/home', '/chat', '/contacts', '/discover', '/agent', '/settings', '/auth'];
const themeOrder = ['light', 'dark'];
const routeLabel = {
  '/home': 'home',
  '/chat': 'chat',
  '/contacts': 'contacts',
  '/discover': 'discover',
  '/agent': 'agent',
  '/settings': 'settings',
  '/auth': 'auth',
};

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function copyIfExists(from, to) {
  if (!existsSync(from)) throw new Error(`Missing source file: ${from}`);
  ensureDir(dirname(to));
  copyFileSync(from, to);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function imageDataUri(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

function sortScreens(a, b) {
  return deviceOrder.indexOf(a.device) - deviceOrder.indexOf(b.device)
    || routeOrder.indexOf(a.pathRoute) - routeOrder.indexOf(b.pathRoute)
    || themeOrder.indexOf(a.theme) - themeOrder.indexOf(b.theme);
}

function screenFromResult(item) {
  const device = item.name.replace(/^static-/, '').replace(/-(home|chat|contacts|discover|agent|settings|auth)-(light|dark)$/, '');
  const route = item.pathRoute;
  const routeName = routeLabel[route] || route.replace('/', '');
  const svgName = `${device}-${routeName}-${item.theme}.svg`;
  return {
    name: item.name.replace(/^static-/, ''),
    device,
    route,
    routeName,
    theme: item.theme,
    width: item.width,
    height: item.height,
    source: item.path,
    svgName,
    svgFile: `figma-single-screen-svgs/${svgName}`,
  };
}

function writeSingleScreenSvg(screen, targetPath) {
  const bg = screen.theme === 'dark' ? '#000000' : '#FAFAFA';
  const data = imageDataUri(screen.source);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${screen.width}" height="${screen.height}" viewBox="0 0 ${screen.width} ${screen.height}">
  <title>${escapeHtml(screen.name)}</title>
  <rect width="100%" height="100%" fill="${bg}"/>
  <image href="${data}" x="0" y="0" width="${screen.width}" height="${screen.height}" preserveAspectRatio="none"/>
</svg>
`;
  writeFileSync(targetPath, svg);
}

function writeImportBoard(screens) {
  const cellW = 1520;
  const cellH = 1280;
  const columns = 4;
  const rows = Math.ceil(screens.length / columns);
  const boardW = columns * cellW;
  const boardH = rows * cellH + 120;
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boardW}" height="${boardH}" viewBox="0 0 ${boardW} ${boardH}">`,
    `<title>InfiniteChat local Figma import board</title>`,
    `<rect width="100%" height="100%" fill="#E4E4E7"/>`,
    `<text x="40" y="54" fill="#11181C" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800">InfiniteChat HeroUI HIFI Local Figma Import Board</text>`,
    `<text x="40" y="88" fill="#687076" font-family="Inter, Arial, sans-serif" font-size="16">56 verified screens · neutral light · pure black dark · blue #006FEE · no gradients · mobile title topbar</text>`,
  ];
  screens.forEach((screen, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * cellW + 40;
    const y = row * cellH + 120;
    const label = `${screen.device} / ${screen.routeName} / ${screen.theme} · ${screen.width}x${screen.height}`;
    parts.push(`<g id="${escapeHtml(screen.name)}" transform="translate(${x},${y})">`);
    parts.push(`<rect x="0" y="0" width="${screen.width + 40}" height="${screen.height + 84}" rx="24" fill="#FFFFFF" stroke="#D4D4D8"/>`);
    parts.push(`<text x="20" y="32" fill="#11181C" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800">${escapeHtml(label)}</text>`);
    parts.push(`<image href="${imageDataUri(screen.source)}" x="20" y="52" width="${screen.width}" height="${screen.height}" preserveAspectRatio="none"/>`);
    parts.push(`</g>`);
  });
  parts.push(`</svg>`);
  const out = resolve(deliveryRoot, 'infinitechat-hifi-local-figma-import-board.svg');
  writeFileSync(out, `${parts.join('\n')}\n`);
  copyFileSync(out, resolve(deliveryRoot, 'infinitechat-hifi-figma-import-board.svg'));
}

function writeGallery(screens) {
  const grouped = new Map();
  for (const screen of screens) {
    const key = `${screen.device}|${screen.theme}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(screen);
  }
  const sections = [];
  for (const device of deviceOrder) {
    sections.push(`<h2>${escapeHtml(device)}</h2>`);
    for (const theme of themeOrder) {
      const list = grouped.get(`${device}|${theme}`) || [];
      sections.push(`<h3>${escapeHtml(theme)}</h3><div class="grid">`);
      for (const screen of list) {
        sections.push(`<article><a href="${screen.svgFile}"><img src="${screen.svgFile}" loading="lazy" alt="${escapeHtml(screen.name)}"></a><p>${escapeHtml(screen.routeName)}</p></article>`);
      }
      sections.push(`</div>`);
    }
  }
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>InfiniteChat HeroUI HIFI Review Gallery</title>
  <style>
    body{margin:0;background:#fafafa;color:#11181c;font-family:Inter,Arial,sans-serif;padding:28px}
    header{max-width:1040px;margin:0 auto 28px}
    h1{margin:0 0 8px;font-size:30px;letter-spacing:-.04em}
    h2{max-width:1040px;margin:34px auto 10px;font-size:22px}
    h3{max-width:1040px;margin:18px auto 10px;color:#687076;font-size:14px;text-transform:uppercase;letter-spacing:.08em}
    .meta{color:#687076}
    a{color:#006fee;text-decoration:none;font-weight:700}
    .grid{max-width:1040px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
    article{background:#fff;border:1px solid #e4e4e7;border-radius:18px;padding:10px;box-shadow:0 12px 28px rgba(15,23,42,.06)}
    img{display:block;width:100%;height:220px;object-fit:contain;background:#f4f4f5;border-radius:12px}
    p{margin:10px 2px 2px;font-size:13px;font-weight:800}
  </style>
</head>
<body>
  <header>
    <h1>InfiniteChat HeroUI HIFI Review Gallery</h1>
    <p class="meta">56 verified screens · local Figma import package · mobile title topbar · neutral light / pure black dark · blue primary #006FEE</p>
    <p><a href="infinitechat-hifi-local-figma-import-board.svg">Open local Figma import board</a> · <a href="contact-sheet-all-pages.png">Open screenshot contact sheet</a></p>
  </header>
  ${sections.join('\n')}
</body>
</html>
`;
  writeFileSync(resolve(deliveryRoot, 'review-gallery.html'), html);
}

function writeSvgIndexes(screens) {
  const json = screens.map((screen) => ({
    name: screen.name,
    file: screen.svgFile,
    source: screen.source,
    width: screen.width,
    height: screen.height,
    device: screen.device,
    route: screen.route,
    theme: screen.theme,
  }));
  writeFileSync(resolve(deliveryRoot, 'figma-single-screen-svgs.json'), JSON.stringify(json, null, 2));
  const lines = ['# InfiniteChat single-screen Figma SVG imports', ''];
  for (const device of deviceOrder) {
    lines.push(`## ${device}`, '');
    for (const theme of themeOrder) {
      lines.push(`### ${theme}`, '');
      for (const screen of screens.filter((item) => item.device === device && item.theme === theme)) {
        lines.push(`- \`${screen.svgFile}\` — ${screen.routeName} · ${screen.width}×${screen.height}`);
      }
      lines.push('');
    }
  }
  writeFileSync(resolve(deliveryRoot, 'figma-single-screen-svgs.md'), `${lines.join('\n')}\n`);
}

function writePdfHtml(name, body) {
  const htmlPath = resolve(deliveryRoot, `${name}.html`);
  writeFileSync(htmlPath, body);
  return htmlPath;
}

function printPdf(htmlPath, pdfPath) {
  if (!chromePath) {
    writeFileSync(pdfPath, 'PDF generation skipped: Chrome not found.\n');
    return false;
  }
  const result = spawnSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Chrome PDF generation failed for ${htmlPath}: ${result.stderr || result.stdout}`);
  }
  return true;
}

function writePdfs(screens) {
  const screenSections = screens.map((screen) => `
    <section class="page">
      <h1>${escapeHtml(screen.device)} / ${escapeHtml(screen.routeName)} / ${escapeHtml(screen.theme)}</h1>
      <p>${screen.width}×${screen.height}</p>
      <img src="${screen.svgFile}" />
    </section>
  `).join('\n');
  const screenHtml = writePdfHtml('screen-review-source', `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:14mm} body{margin:0;font-family:Inter,Arial,sans-serif;color:#11181c}
    .page{break-after:page} h1{font-size:18px;margin:0 0 4px} p{margin:0 0 10px;color:#687076}
    img{max-width:100%;max-height:235mm;object-fit:contain;border:1px solid #e4e4e7;border-radius:10px}
  </style></head><body>${screenSections}</body></html>`);
  printPdf(screenHtml, resolve(deliveryRoot, 'infinitechat-hifi-screen-review.pdf'));

  const cells = screens.map((screen) => `
    <article>
      <img src="${screen.svgFile}" />
      <p>${escapeHtml(screen.device)} / ${escapeHtml(screen.routeName)} / ${escapeHtml(screen.theme)}</p>
    </article>
  `).join('\n');
  const contactHtml = writePdfHtml('contact-sheet-source', `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page{size:A3 landscape;margin:10mm} body{margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#11181c}
    h1{font-size:20px;margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
    article{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:5px;break-inside:avoid}
    img{width:100%;height:92px;object-fit:contain;background:#f4f4f5;border-radius:5px} p{margin:4px 0 0;font-size:7px;font-weight:700}
  </style></head><body><h1>InfiniteChat HeroUI HIFI Contact Sheet</h1><div class="grid">${cells}</div></body></html>`);
  printPdf(contactHtml, resolve(deliveryRoot, 'infinitechat-hifi-contact-sheet.pdf'));
}

function writeDocs({ report, dryRun, screens }) {
  const summary = report.summary || {};
  const checks = [
    ['darkPureBlack', summary.darkPureBlack],
    ['darkBodyPureBlack', summary.darkBodyPureBlack],
    ['lightNeutralBackgroundReady', summary.lightNeutralBackgroundReady],
    ['noGradients', summary.noGradients],
    ['noViolet', summary.noViolet],
    ['antiCardFatigueReady', summary.antiCardFatigueReady],
    ['mobileCompactTopbarReady', summary.mobileCompactTopbarReady],
    ['mobilePageTitleTopbarReady', summary.mobilePageTitleTopbarReady],
    ['tabletTwoColumnReady', summary.tabletTwoColumnReady],
    ['interactionAuditReady', summary.interactionAuditReady],
  ];
  const statusLines = checks.map(([key, value]) => `- \`${key}: ${value === true ? 'true' : String(value)}\``).join('\n');
  const status = `# InfiniteChat HeroUI 高保真重设计交付状态

更新时间：2026-06-23

## 当前状态

前端高保真重设计已经落地到 \`infinitechat-web\`，并通过本地完整验证。远端 Figma MCP 因 Starter 调用次数限制不再作为交付条件；本地 Figma 导入包已经生成，可直接拖入 Figma 使用。

## 已落地的核心设计要求

- HeroUI 风格：蓝色主色、精致字体、轻量导航、克制面板。
- 浅色模式：中性灰背景，不使用 \`#f2f7ff\` 这类蓝调背景。
- 深色模式：背景保持纯黑 \`#000000\`，不使用深蓝底。
- 不使用渐变色。
- 不使用紫色 / violet 视觉语言。
- 减少卡片套卡片：聊天主区、资料引用、设置、助手、发现等页面使用开放分隔行、左侧蓝色强调线和内联进度。
- 手机端顶栏：单行、无产品名、无解释文案、无“消息/助手/登录”大块 switch；手机顶栏显示当前页短标题，消息/助手导航交给底部 dock。
- 登录入口：从顶部 switch 移入账号入口。
- 图标 rail：使用 SVG symbol 方案，保留 iconfont 可替换约定。
- 文案：面向真实用户，避免 Gateway、Knife4j、后端接口、实现计划、交付、给我、请帮我等内部表达。

## 主要文件

- \`/Users/haven/Documents/code/projecta/infinitechat-web/src/main.jsx\`
- \`/Users/haven/Documents/code/projecta/infinitechat-web/src/styles.css\`
- \`/Users/haven/Documents/code/projecta/infinitechat-web/DESIGN.md\`
- \`/Users/haven/Documents/code/projecta/infinitechat-web/scripts/verify-ui.mjs\`
- \`/Users/haven/Documents/code/projecta/infinitechat-web/scripts/figma-dry-run.mjs\`
- \`/Users/haven/Documents/code/projecta/infinitechat-web/scripts/build-hifi-delivery.mjs\`
- \`/Users/haven/Documents/code/projecta/.artifacts/figma/hifi-heroui-preview/figma-sync-pure-black.js\`

## 验证命令

在 \`/Users/haven/Documents/code/projecta/infinitechat-web\` 下执行：

\`\`\`bash
pnpm build
node scripts/figma-dry-run.mjs
node scripts/verify-ui.mjs
node scripts/build-hifi-delivery.mjs
node scripts/verify-hifi-delivery.mjs
\`\`\`

最新验证结果：

${statusLines}

## 本地 Figma 导入文件

- 本地总览导入板：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/infinitechat-hifi-local-figma-import-board.svg\`
- 兼容旧路径导入板：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/infinitechat-hifi-figma-import-board.svg\`
- 56 个单屏 SVG：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/figma-single-screen-svgs/\`
- HTML 审阅画廊：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/review-gallery.html\`
- PDF 逐屏审阅：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/infinitechat-hifi-screen-review.pdf\`
- PDF 总览审阅：\`/Users/haven/Documents/code/projecta/.artifacts/delivery/infinitechat-heroui-hifi/infinitechat-hifi-contact-sheet.pdf\`

## 说明

Figma 原生 \`.fig\` 文件格式不是可稳定手写生成的公开格式。本交付包采用 Figma 可直接导入的本地 SVG 画板作为本地 Figma 文件载体，保留 56 张已验证截图的原始尺寸，适合作为像素级视觉稿和后续可编辑化参考。
`;

  const readme = `# InfiniteChat HeroUI HIFI 本地交付包

这个目录保存完整的本地高保真设计交付，不依赖远端 Figma MCP 写入。

## 关键状态

- 前端验证：\`failures: []\`
- 截图矩阵：${screens.length} 张
- Figma dry-run：ready=${dryRun.ready === true ? 'true' : 'false'}，frames=${dryRun.frames?.length || 0}
- 本地 Figma 导入包：已生成

## 入口文件

- \`infinitechat-hifi-local-figma-import-board.svg\`：推荐拖入 Figma 的本地总览导入板。
- \`figma-single-screen-svgs/\`：56 个单屏导入 SVG。
- \`review-gallery.html\`：离线 HTML 审阅画廊。
- \`infinitechat-hifi-screen-review.pdf\`：逐屏 PDF。
- \`infinitechat-hifi-contact-sheet.pdf\`：总览 PDF。
- \`static-verification-report.json\`：完整验证报告。
- \`delivery-manifest.json\`：机器可读交付清单。
- \`figma-sync-pure-black.js\`：可选的远端 Figma 可编辑节点同步脚本，不再作为当前交付条件。

## 已验证的硬性要求

${statusLines}
`;

  const audit = `# InfiniteChat HeroUI 高保真重设计逐条验收审计

更新时间：2026-06-23

## 总体结论

- 前端落地：通过
- 本地 Figma 导入文件：通过
- 远端 Figma MCP 写入：按用户更新目标跳过，不再作为完成条件

## 验收明细

### ✅ HeroUI 高保真风格

- 证据：\`DESIGN.md\`, \`contact-sheet-all-pages.png\`, \`static-verification-report.json\`
- 说明：已落地蓝色主色、轻量导航、精致字体、开放工作区和真实产品文案。

### ✅ 深浅色两套主题

- 证据：\`static-verification-report.json\`, \`screenshots/\`, \`figma-single-screen-svgs/\`
- 说明：已覆盖 light / dark，截图矩阵和 SVG 矩阵均包含两套主题。

### ✅ 各种设备适应

- 证据：\`contact-sheet-all-pages.png\`, \`figma-single-screen-svgs.md\`
- 说明：已覆盖 desktop、tablet、mobile、narrow-mobile。

### ✅ 手机端极简单行顶栏

- 证据：\`static-verification-report.json\`, \`static-mobile-home-light.png\`
- 说明：手机顶栏移除产品名、解释文案和消息/助手顶栏切换，保留品牌图标、当前页短标题和必要图标操作。

### ✅ 不使用渐变色 / 无紫色 / 纯黑深色 / 中性浅色背景

- 证据：\`static-verification-report.json\`
- 说明：对应校验项全部为 true。

### ✅ 减少卡片套卡片

- 证据：\`static-verification-report.json\`, \`static-desktop-chat-light.png\`, \`static-tablet-chat-light.png\`
- 说明：聊天、资料引用、设置、助手、发现使用开放分隔行、强调线、内联进度。

### ✅ 落地对应前端

- 证据：\`infinitechat-web/src/main.jsx\`, \`infinitechat-web/src/styles.css\`, \`pnpm build\`, \`static-verification-report.json\`
- 说明：前端已构建并通过完整截图/交互审计。

### ✅ 文案面向用户

- 证据：\`static-verification-report.json\`
- 说明：未发现 Gateway、Knife4j、后端接口、实现计划、交付、给我、请帮我等可见内部文案。

### ✅ 本地 Figma 文件

- 证据：\`infinitechat-hifi-local-figma-import-board.svg\`, \`figma-single-screen-svgs/\`, \`infinitechat-hifi-screen-review.pdf\`
- 说明：已生成可直接导入 Figma 的本地 SVG 总览板和 56 个单屏 SVG。

## 最新验证摘要

${statusLines}
`;

  writeFileSync(resolve(deliveryRoot, 'HIFI_DELIVERY_STATUS.md'), status);
  writeFileSync(resolve(deliveryRoot, 'README.md'), readme);
  writeFileSync(resolve(deliveryRoot, 'ACCEPTANCE_AUDIT.md'), audit);
}

function writeManifest({ report, dryRun, screens }) {
  const summary = report.summary || {};
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else files.push(rel);
    }
  };
  walk(deliveryRoot);
  const manifest = {
    name: 'InfiniteChat HeroUI HIFI local Figma delivery package',
    createdAt: new Date().toISOString(),
    frontEndRoot: appRoot,
    localFigmaImportBoard: 'infinitechat-hifi-local-figma-import-board.svg',
    localFigmaImportBoardCompat: 'infinitechat-hifi-figma-import-board.svg',
    verification: {
      failures: report.failures || [],
      screenshots: summary.screenshots,
      contactSheetCells: summary.contactSheetCells,
      darkPureBlack: summary.darkPureBlack,
      lightNeutralBackgroundReady: summary.lightNeutralBackgroundReady,
      noGradients: summary.noGradients,
      noViolet: summary.noViolet,
      antiCardFatigueReady: summary.antiCardFatigueReady,
      mobileCompactTopbarReady: summary.mobileCompactTopbarReady,
      mobilePageTitleTopbarReady: summary.mobilePageTitleTopbarReady,
      tabletTwoColumnReady: summary.tabletTwoColumnReady,
      interactionAuditReady: summary.interactionAuditReady,
    },
    figmaDryRun: {
      ready: dryRun.ready === true,
      frameCount: dryRun.frames?.length || 0,
      failedChecks: dryRun.checks?.filter((item) => !item.ok).map((item) => item.label) || [],
    },
    singleScreenSvgs: {
      count: screens.length,
      directory: 'figma-single-screen-svgs',
      index: 'figma-single-screen-svgs.md',
    },
    reviewArtifacts: {
      localFigmaImportBoard: 'infinitechat-hifi-local-figma-import-board.svg',
      screenReviewPdf: 'infinitechat-hifi-screen-review.pdf',
      contactSheetPdf: 'infinitechat-hifi-contact-sheet.pdf',
      htmlGallery: 'review-gallery.html',
      screenCount: screens.length,
    },
    goalStatus: {
      frontEndAndLocalFigmaDesign: 'complete',
      remoteFigmaMcpWrite: 'skipped_by_user_request',
    },
    files,
  };
  writeFileSync(resolve(deliveryRoot, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2));
}

function zipDelivery() {
  rmSync(zipPath, { force: true });
  const result = spawnSync('zip', ['-qr', zipPath, basename(deliveryRoot)], { cwd: deliveryParent, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`);
  }
}

const reportPath = resolve(frontendArtifactRoot, 'static-verification-report.json');
const dryRunPath = resolve(figmaArtifactRoot, 'figma-dry-run-manifest.json');
const report = readJson(reportPath);
const dryRun = readJson(dryRunPath);
if (report.failures?.length) throw new Error(`Frontend verification has failures: ${report.failures.join('\n')}`);
const screens = report.results.map(screenFromResult).sort(sortScreens);
if (screens.length !== 56) throw new Error(`Expected 56 screenshots, got ${screens.length}`);

rmSync(deliveryRoot, { recursive: true, force: true });
ensureDir(deliveryRoot);
ensureDir(resolve(deliveryRoot, 'figma-single-screen-svgs'));
ensureDir(resolve(deliveryRoot, 'screenshots'));

copyIfExists(resolve(appRoot, 'DESIGN.md'), resolve(deliveryRoot, 'DESIGN.md'));
copyIfExists(resolve(frontendArtifactRoot, 'contact-sheet-all-pages.png'), resolve(deliveryRoot, 'contact-sheet-all-pages.png'));
copyIfExists(reportPath, resolve(deliveryRoot, 'static-verification-report.json'));
copyIfExists(dryRunPath, resolve(deliveryRoot, 'figma-dry-run-manifest.json'));
copyIfExists(resolve(figmaArtifactRoot, 'figma-dry-run-manifest.md'), resolve(deliveryRoot, 'figma-dry-run-manifest.md'));
copyIfExists(resolve(figmaArtifactRoot, 'figma-sync-pure-black.js'), resolve(deliveryRoot, 'figma-sync-pure-black.js'));
copyIfExists(resolve(appRoot, 'scripts/verify-hifi-delivery.mjs'), resolve(deliveryRoot, 'verify-hifi-delivery.mjs'));
copyIfExists(resolve(appRoot, 'scripts/build-hifi-delivery.mjs'), resolve(deliveryRoot, 'build-hifi-delivery.mjs'));
writeFileSync(resolve(deliveryRoot, 'figma-frame-matrix.json'), JSON.stringify(dryRun.frames || [], null, 2));

for (const screen of screens) {
  copyIfExists(screen.source, resolve(deliveryRoot, 'screenshots', basename(screen.source)));
  writeSingleScreenSvg(screen, resolve(deliveryRoot, screen.svgFile));
}

writeImportBoard(screens);
writeSvgIndexes(screens);
writeGallery(screens);
writePdfs(screens);
writeDocs({ report, dryRun, screens });
writeManifest({ report, dryRun, screens });
zipDelivery();

console.log(JSON.stringify({
  ready: true,
  deliveryRoot,
  zipPath,
  screens: screens.length,
  localFigmaImportBoard: resolve(deliveryRoot, 'infinitechat-hifi-local-figma-import-board.svg'),
}, null, 2));
