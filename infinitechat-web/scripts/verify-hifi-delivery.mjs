import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const projectRoot = resolve(appRoot, '..');
const deliveryRoot = resolve(projectRoot, '.artifacts/delivery/infinitechat-heroui-hifi');
const reportPath = resolve(projectRoot, '.artifacts/frontend/infinitechat-web/static-verification-report.json');
const manifestPath = resolve(deliveryRoot, 'delivery-manifest.json');
const figmaScriptPath = resolve(deliveryRoot, 'figma-sync-pure-black.js');
const localImportBoardPath = resolve(deliveryRoot, 'infinitechat-hifi-local-figma-import-board.svg');
const zipPath = resolve(projectRoot, '.artifacts/delivery/infinitechat-heroui-hifi.zip');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function okFile(path, minBytes = 1) {
  return existsSync(path) && statSync(path).size >= minBytes;
}

const checks = [];
function check(label, ok, detail = {}) {
  checks.push({ label, ok: Boolean(ok), ...detail });
}

check('verification report exists', okFile(reportPath, 1000), { path: reportPath });
check('delivery manifest exists', okFile(manifestPath, 1000), { path: manifestPath });
check('figma sync script exists', okFile(figmaScriptPath, 50000), { path: figmaScriptPath });
check('local Figma import board exists', okFile(localImportBoardPath, 1000000), { path: localImportBoardPath });
check('delivery zip exists', okFile(zipPath, 1000000), { path: zipPath });

let report = null;
let manifest = null;
if (okFile(reportPath)) report = readJson(reportPath);
if (okFile(manifestPath)) manifest = readJson(manifestPath);

if (report) {
  const summary = report.summary || {};
  check('frontend verification has no failures', Array.isArray(report.failures) && report.failures.length === 0, { failures: report.failures });
  check('pure black dark mode verified', summary.darkPureBlack === true && summary.darkBodyPureBlack === true);
  check('neutral light background verified', summary.lightNeutralBackgroundReady === true);
  check('no gradients verified', summary.noGradients === true);
  check('no violet verified', summary.noViolet === true);
  check('anti card fatigue verified', summary.antiCardFatigueReady === true);
  check('mobile title topbar verified', summary.mobileCompactTopbarReady === true && summary.mobileTopbarControlsFit === true && summary.mobilePageTitleTopbarReady === true);
  check('tablet two-column verified', summary.tabletTwoColumnReady === true);
  check('interaction audit verified', summary.interactionAuditReady === true);
}

if (manifest) {
  check('front-end and local Figma design marked complete', manifest.goalStatus?.frontEndAndLocalFigmaDesign === 'complete', { goalStatus: manifest.goalStatus });
  check('remote Figma MCP write skipped by request', manifest.goalStatus?.remoteFigmaMcpWrite === 'skipped_by_user_request', { goalStatus: manifest.goalStatus });
  check('figma dry-run frame count is 43', manifest.figmaDryRun?.ready === true && manifest.figmaDryRun?.frameCount === 43, { figmaDryRun: manifest.figmaDryRun });
  check('single-screen SVG count is 56', manifest.singleScreenSvgs?.count === 56, { singleScreenSvgs: manifest.singleScreenSvgs });
  check('review PDF screen count is 56', manifest.reviewArtifacts?.screenCount === 56, { reviewArtifacts: manifest.reviewArtifacts });
  const required = [
    'ACCEPTANCE_AUDIT.md',
    'HIFI_DELIVERY_STATUS.md',
    'figma-sync-pure-black.js',
    'infinitechat-hifi-local-figma-import-board.svg',
    'infinitechat-hifi-figma-import-board.svg',
    'infinitechat-hifi-screen-review.pdf',
    'review-gallery.html',
    'figma-single-screen-svgs.md',
  ];
  for (const file of required) {
    check(`delivery file present: ${file}`, okFile(resolve(deliveryRoot, file)), { file });
  }
}

const failed = checks.filter((item) => !item.ok);
const result = {
  ready: failed.length === 0,
  failedChecks: failed,
  checks,
  localFigmaAction: failed.length === 0
    ? {
        importBoard: localImportBoardPath,
        singleScreenDirectory: resolve(deliveryRoot, 'figma-single-screen-svgs'),
        reviewGallery: resolve(deliveryRoot, 'review-gallery.html'),
      }
    : null,
};

console.log(JSON.stringify(result, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
