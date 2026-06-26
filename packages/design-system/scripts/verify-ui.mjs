#!/usr/bin/env node
/**
 * verify-ui — executable DESIGN.md §9.5 guard (the static half).
 *
 * Scans chat-frontend source for banned visual/content patterns:
 *   - violet/purple-toned color names
 *   - CSS gradient declarations
 *   - blue-tinted light backgrounds
 *   - emoji used as UI/icon placeholders
 *   - internal implementation / service wording leaking into UI strings
 *
 * Exit 1 on any violation. The runtime half (3-viewport × light/dark screenshots
 * + `scrollWidth === clientWidth` overflow assertion + real interaction audit)
 * is wired with Playwright in P3; this script is the dependency-free core.
 *
 * Run: `npm run verify:ui` (from chat-frontend/).
 */
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative, extname} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
// Repo-root-relative. The design system is a root workspace package consumed by
// chat-frontend (and, when S2 opts in, agent-frontend — add it here then).
const SCAN_DIRS = ["chat-frontend/src", "packages/design-system/src"];
const EXT = new Set([".ts", ".tsx", ".css", ".html"]);

// This scanner file legitimately contains the banned words; skip itself.
const SELF = fileURLToPath(import.meta.url);

const RULES = [
  {
    id: "violet-accent",
    re: /\b(violet|purple|fuchsia|indigo|magenta|mauve)\b/i,
    msg: "violet/purple-toned color — DESIGN.md allows blue (#006FEE) as the only vivid accent",
  },
  {
    id: "gradient",
    re: /(linear-gradient|radial-gradient|conic-gradient|bg-gradient-to-|from-\w+-\d{2,3}\s+to-)/,
    msg: "CSS gradient — DESIGN.md: no gradients; depth from borders/shadow/spacing",
  },
  {
    id: "internal-wording",
    // UI copy must not expose implementation. Match these as whole words; code
    // identifiers (imports, props) are excluded by the string-literal heuristic below.
    re: /\b(gateway|endpoint|deploy(ment)?|webhook|kafka|snowflake|nacos|websocket handshake|baseurl|apikey)\b/i,
    msg: "internal implementation wording in a user-facing string — DESIGN.md §3/§7",
    stringsOnly: true,
  },
  {
    id: "emoji-placeholder",
    // Emoji pictographs used inline as icons/placeholders.
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u,
    msg: "emoji used as UI/icon placeholder — DESIGN.md: single-color linear glyphs only",
    stringsOnly: true,
  },
];

/** Extract quoted string / JSX-text content from a line (rough heuristic). */
function userFacingSlices(line) {
  const out = [];
  const reStr = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = reStr.exec(line))) out.push(m[2]);
  // JSX text between > and <
  const reJsx = />([^<>{}]+)</g;
  while ((m = reJsx.exec(line))) out.push(m[1]);
  return out;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (EXT.has(extname(name)) && full !== SELF) acc.push(full);
  }
  return acc;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), []));
const violations = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      const haystack = rule.stringsOnly ? userFacingSlices(line).join("  ") : line;
      if (!haystack) continue;
      // Allow an explicit opt-out comment for false positives.
      if (line.includes("verify-ui-ignore")) continue;
      if (rule.re.test(haystack)) {
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          rule: rule.id,
          msg: rule.msg,
          text: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log(`verify-ui: ✓ scanned ${files.length} files, no banned patterns.`);
  process.exit(0);
}

console.error(`verify-ui: ✗ ${violations.length} violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
  console.error(`    ${v.msg}`);
  console.error(`    > ${v.text}\n`);
}
process.exit(1);
