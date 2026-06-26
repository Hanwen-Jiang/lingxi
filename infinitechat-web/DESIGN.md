# InfiniteChat Design System

## 1. Visual Theme & Atmosphere

InfiniteChat uses a calm, refined HeroUI-inspired application style: quiet surfaces, crisp blue focus states, generous whitespace, and precise typography. The interface should feel like a premium messaging workspace rather than an internal admin console.

- Primary direction: elegant blue SaaS/chat workspace.
- Light mode: bright, airy, neutral gray background with white cards; do not use blue-tinted page or nested-card backgrounds.
- Light mode should not use large pure-black functional panels; reserve pure black for dark mode and use neutral white/gray surfaces for assistant, recommendation, and side panels.
- Dark mode: pure black base with neutral gray panels; never use deep-blue backgrounds for dark mode.
- Dark mode must not use any visible ambient wash; the app background and page background stay pure `#000000`.
- No gradients. Depth comes from border precision, subtle shadows, spacing, and typography.
- Icons should be single-color linear iconfont/SVG glyphs, not emoji and not text placeholders.

## 2. Color Palette & Roles

| Token | Value | Role |
| --- | --- | --- |
| `--neutral-50` | `#FAFAFA` | Light app background; intentionally neutral gray, not blue-tinted |
| `--neutral-100` | `#F4F4F5` | Soft nested surfaces and subtle selected backgrounds |
| `--neutral-200` | `#E4E4E7` | Light borders and dividers |
| `--blue-500` | `#006FEE` | Primary actions, selected tabs, active navigation |
| `--blue-600` | `#005BC4` | Strong action text in light mode |
| `--surface-solid` light | `#FFFFFF` | Card and input surfaces |
| `--text` light | `#07111F` | Main text |
| `--bg` dark | `#000000` | Required pure black dark mode background |
| `--surface-solid` dark | `#0A0A0A` | Dark cards |
| `--surface-2` dark | `#111111` | Nested dark surfaces |
| `--text` dark | `#FAFAFA` | Main text in dark mode |

Do not add violet-toned accents. Do not use CSS gradient declarations. Do not use blue-tinted light backgrounds; keep neutral surfaces gray and reserve blue for actions, active states, focus rings, and small semantic accents.

## 3. Typography Rules

- Font stack: `Inter`, system UI, PingFang SC, Microsoft YaHei, sans-serif.
- Headings use strong negative letter spacing for a polished HeroUI feel. On phones, workspace headings are compact app titles rather than oversized marketing headlines.
- Body copy should be readable and calm, generally `1.6–1.8` line-height.
- Labels and eyebrows use compact uppercase or short Chinese labels with high weight and tracking.
- User-facing text must read like product copy; avoid implementation, deployment, endpoint, gateway, or delivery-plan wording.

## 4. Components

### Navigation

- Top navigation uses lightweight text tabs for the two high-frequency contexts: messages and assistant. It must not look like a heavy switch or background block.
- Login is not part of the top navigation switch; account and login live behind the account entry in the tool row.
- Mobile top navigation is removed from the topbar; destination switching belongs to the bottom dock, while the topbar shows only the brand glyph, current page title, and essential icon actions.
- Mobile topbar must stay one line: brand glyph, one compact current-page title, and an icon-only tool cluster for quick entry, online state, reminder, theme, and account. It should not show the product name or explanation copy on phones, and it must not become a tall action dashboard. This rule also applies to narrow 320px phones: shrink spacing, not information priority.
- Mobile topbar status should be quiet: online state uses the same neutral circular tool surface as the other actions, with only a green glyph/dot-level signal instead of a large filled green chip.
- Theme control must be visible, understandable, and touch-friendly.
- Global product actions should include a refined quick-entry control, reminder center, and account status entry without crowding the navigation.
- Side and rail navigation must show the active item with both visual state and semantic current-page state.
- Assistant pages still need the same global icon rail on desktop and tablet, so users can move to home, messages, contacts, discover, and settings without relying on quick-entry overlays.
- Mobile assistant capability switching uses a compact horizontal command rail, not a tall grid of tool blocks. The current task title, mode tabs, and first workflow steps should enter the first viewport before secondary capability browsing dominates the screen.
- Desktop and tablet assistant pages use a HeroUI-style command strip for assistant capabilities, not a tall admin sidebar. The command surface should hug content, show only the most frequent capability tabs at the top, and let the main workflow plus confirmation panel sit as content-fit panels below it.
- On phones, the app rail is a bottom dock, not a second top navigation row; it must stay icon-only, single-line, centered above the safe area, and must not push first-screen content downward. Because the phone topbar already carries the brand glyph, the bottom dock should avoid repeating the brand mark and focus only on destination icons. Add a neutral safe-area mask below the dock so list rows, meters, or progress accents never peek through the bottom gap.
- On tablets, the global icon rail should read as a compact destination toolbar, not a row of oversized segmented cards: low height, transparent inactive buttons, no repeated brand glyph, and a single blue active state.
- Icon rail destinations must be real product views: home, messages, contacts, discover, assistant, and settings.

### Cards and Panels

- Cards use rounded corners between `18px–32px`.
- Borders are visible but soft; shadows are subtle in light mode and reduced in dark mode.
- Right-side assistant panels can be pure black to create hierarchy, but should still use readable neutral text.
- Avoid card-in-card fatigue: large work areas should stay open, while inner content uses divider rows, left blue accent rails, chips, inline progress, and flat list rows instead of repeated nested cards.
- Chat feeds, composer areas, assistant summaries, contact lists, and settings rows should prefer open workspace structure with precise dividers; reserve rounded cards for top-level panels and clear modal-like surfaces. On phones, contacts must show a compact three-column signal strip instead of stacking overview rows vertically, so at least the first real contact row enters the first viewport.
- Phone chat screens prioritize the active room and composer before the inbox list. The inbox becomes a compact recent-message list after the room, showing only the most relevant rows on the first pass; do not let the full inbox consume the first mobile viewport.
- Phone chat secondary actions should not compete with the fixed bottom dock. Reference-detail and new-conversation actions are deferred to the full section or inline row affordances on phones, so no visible button sits under or against the dock.
- Home workflow steps use an open divider strip instead of four nested tiles: numbered blue dots, quiet separators, and compact row rhythm should make the first screen feel like a working dashboard, not a marketing section. On phones, the workflow uses a compact two-by-two open divider strip so real priority rows appear in the first viewport. The home status/progress summary is an open divider strip, not a nested mini card inside the hero panel.
- Home desktop signal summaries use one quiet insight rail with divider rows, not four independent stacked mini cards. Numeric and status values must remain horizontal and readable; use open rows, inline progress, and restrained blue focus instead of tall card stacks.
- Settings pages should stay dense and calm on phone and tablet: the overview strip remains a compact three-column signal, setting rows keep the status and toggle on the same visual line, row icons use small semantic outline tokens, and toggles use a compact primary track inside a larger touch target rather than a full blue pill button.
- Settings pages should use content-fit panels on desktop and tablet, not full-height admin-console columns. The main settings card and account status card should hug their divider rows and confirmation content, leaving the surrounding neutral page background visible instead of stretching cards into large empty blocks. On phones, hide the secondary account status card and keep the bottom dock clearance without adding a blank tail below the final setting row.
- Discover pages should use an open editorial list instead of large nested cards: numbered pills, divider rows, inline scenario tags, and restrained action buttons keep the page closer to HeroUI Pro content surfaces. On tablets, the selected practice block should become a horizontal open practice bar with short title copy and equal-width steps, not a cramped long headline inside a narrow column. On phones, the same practice block should use short product copy and a three-step flow strip so it reads like an app action, not a compressed desktop article.
- Discover recommendation sidebars should not feel empty on desktop. Use open divider rows, a simple blue progress line, and compact recommendation metadata such as expected time, evidence handling, and send confirmation instead of stacking more cards.
- Authentication screens should be account-first, not marketing-first. The login form is the primary surface on phones; the product explanation follows it. Keep email/password and verification-code mode selection in one quiet HeroUI-style segmented control, but do not repeat the verification-code path as a second large full-width button under the primary login action. Use a compact text link for passwordless email verification instead.
- Authentication trust content uses open divider rows and a three-cell feature strip, not nested feature cards. Copy should explain what happens for the user after login: preview before sending, important content preserved, and confirmation before continuing. Avoid implementation words and avoid vague launch-page promises.
- On phones, login options such as “保持登录” and “忘记密码？” should remain on one compact row so the first viewport stays focused on signing in rather than becoming a tall form stack.

### Buttons

- Primary buttons are solid blue with white text.
- Secondary buttons use neutral soft fills with blue text/borders in light mode and neutral/pure black fills in dark mode.
- Status pills should stay quiet: use neutral surfaces and a tiny semantic dot or icon. Avoid large filled green badges, especially on pure-black dark screens.
- Touch targets should be at least `40px` high on mobile.
- Buttons must have visible hover, pressed, disabled, and keyboard focus states.
- Focus rings use a soft blue outline, never violet and never gradient glow.

### Inputs

- Inputs are rounded, border-based, and quiet.
- Placeholder text should explain the user action, not the internal data model.
- Text fields and textareas must show a clear blue focus boundary.
- Long-form inputs can include character count and concise helper text, written for end users.
- Chat composer should behave like a real product input, with draft text, helper copy, and disabled send state for empty content.

### Icons

- Use an iconfont-ready SVG symbol sprite for app rail icons, with `<use href="#...">` references that can be replaced by a real iconfont symbol file later.
- No emoji, no letter abbreviations, no placeholder command symbols.
- Rail icons must keep the `#ic-rail-*` symbol convention until a real iconfont symbol bundle is introduced.
- When replacing with iconfont.cn or another symbol source, keep single-color linear glyphs and the same semantic names: home, message, contacts, discover, assistant, settings.

### Interaction & Accessibility

- Main navigation exposes the active page through `aria-current`.
- Toggle-style controls expose their state with `aria-pressed`.
- Floating quick-entry, reminder, and account panels must expose dialog intent and close controls.
- Login and composer forms must stay usable from keyboard alone.
- Motion is subtle and disabled for users who prefer reduced motion.
- Chat screens should include real product cues such as members, message time, typing state, and assistant suggestions.
- Authentication screens should include confidence-building product cues, not internal status or implementation notes.
- Product interactions should be verifiable through real click/input flows, not only static screenshots.

## 5. Layout Principles

- Desktop chat workspace: rail, conversations, main chat, assistant panel.
- Desktop utility pages: rail, large primary content panel, focused side panel with useful contextual content.
- Desktop chat first viewport should show the complete composer action area; the send button must not be cropped in the standard desktop capture.
- Tablet: use a true two-column workspace for chat and assistant screens where width allows; stack only secondary panels below. Do not treat tablets as oversized phones.
- Phone: topbar stays as a compact single-line toolbar with only the brand glyph, current page title, and icon-only tools; icon rail becomes a compact icon-only bottom dock without a repeated brand mark, so first-screen content appears earlier and the dock owns destination switching. Phone workspace titles must use app-scale typography, not landing-page headline sizing, so primary content appears within the first viewport.
- Phone chat: the active conversation panel appears before the inbox list. Recent conversations may follow as a compact secondary section, but the user should see the room title, message context, and composer path before scanning the full inbox.
- Every layout container must prevent horizontal overflow with `min-width: 0` and viewport-aware widths.

## 6. Depth & Elevation

- Light mode: neutral gray background, white cards, soft shadows, and restrained blue accents only where action or focus is needed.
- Dark mode: pure black background, low-contrast neutral borders, minimal shadow.
- Never use gradient glow or decorative color haze.

## 7. Do / Don't

Do:

- Use blue as the only vivid accent, but not as the default page or nested-card background.
- Use precise spacing, high-quality typography, and clear hierarchy.
- Keep user copy natural and product-facing.
- Verify phone/tablet/desktop screenshots after visual changes.

Don't:

- Use violet-toned accents or gradients.
- Use emoji in navigation.
- Expose internal API, gateway, deployment, or implementation-plan language in the UI.
- Assume mobile works without checking true mobile viewport width.

## 8. Responsive Behavior

| Breakpoint | Behavior |
| --- | --- |
| `>1180px` | Four-column chat workspace, three-column agent layout, two-column auth layout |
| `<=1180px` | Major panels stack; rail becomes a horizontal/compact section |
| `<=760px` | Phone-focused layout with one-line compact topbar, icon-only tools, and destination-only bottom dock glyph rail |
| `<=430px` | Single-column actions, tighter spacing, no horizontal scroll |

## 9. Verification Guide

Before calling the UI complete:

1. Run `pnpm build`.
2. Capture desktop, tablet, and phone screenshots for light mode.
3. Capture desktop, tablet, and phone screenshots for dark mode using `?theme=dark`.
4. Assert `document.documentElement.scrollWidth === document.documentElement.clientWidth` for each tested viewport.
5. Search source for banned visual/content patterns: violet-toned color names, gradient declarations, blue-tinted light background colors, emoji placeholders, and internal implementation or service-status wording.
6. Verify interactive product states: current navigation, theme toggle state, icon rail accessibility, chat composer, assistant navigation, and login feedback.
7. Verify the desktop chat composer send action is fully visible in the standard desktop screenshot.
8. Run the real interaction audit to confirm theme switching, navigation, assistant capability selection, mode switching, conversation selection, composer disabled/enabled states, and login feedback.
9. Verify top-level product actions: quick entry opens, filters, navigates; reminder center and account status open and close cleanly.
10. Verify icon rail navigation for contacts, discover, settings, and return-to-chat flows.
11. Verify mobile topbar stays one line: product name and subtitle hidden, message/assistant nav hidden from the topbar, current page title visible, login reached from the account entry, and quick/status/reminder/theme/account tools are icon-only.
12. Verify mobile icon rail stays compact, single-line, destination-only, and fixed as a bottom dock; it should not repeat the topbar brand glyph, become a top row, or turn into a tall 3×2 card that pushes core content down.
13. Verify tablet chat and assistant screens keep the primary work area visible in a two-column layout instead of pushing it below a full-width list/sidebar.
