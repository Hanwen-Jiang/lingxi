---
name: infinitechat-design-heroui
description: Design and implement polished InfiniteChat frontend experiences with HeroUI, DESIGN.md-style rules, and real backend workflows. Use when redesigning the InfiniteChat React UI, removing demo seed content, fixing navigation/layout quality, applying HeroUI components, or auditing desktop/tablet/mobile app usability.
---

# InfiniteChat Design HeroUI

## Operating Rule

Build InfiniteChat as a real application workspace, not a decorative mockup. Preserve working API flows, remove fake seed/demo people or conversations, and make the first screen immediately usable for chat, knowledge ingestion, memory, and settings.

Before redesigning UI, read:

- `references/design-md-operating-model.md` for visual and product rules derived from DESIGN.md practice.
- `references/heroui-react-patterns.md` when editing HeroUI React components, imports, or component composition.

## Workflow

1. Inspect the current UI code, CSS, `DESIGN.md`, and API calls before editing.
2. Define the active product surface: chat workspace, assistant workflow, ingestion, memory, contacts, discover, or settings.
3. Keep real flows wired:
   - Chat: `/chat`, `/streamChat`, `/agent/chat`, `/rag/adaptive/chat`.
   - Ingestion: `/rag/documents/upload`, `/rag/documents/text`, `/rag/documents/local-ingest`, `/rag/documents/jobs/{jobId}`.
   - Memory: `/memory/write`, `/memory/user/{userId}`.
   - Health/settings: `/actuator/health`.
4. Redesign through structure first: shell, navigation, panel hierarchy, empty states, controls, then color/detail.
5. Use HeroUI components for interactive primitives, plus project CSS for product-specific layout.
6. Remove generated demo/seed content. Static labels are fine; fake contacts, fake people, fake conversations, and hardcoded pretend activity are not.
7. Verify with build and browser checks at desktop and mobile sizes.

## InfiniteChat Visual Direction

- Use a quiet, precise SaaS/messaging workspace: neutral canvas, white/light panels, crisp hairline borders, measured blue focus/action states.
- Keep blue as the only vivid product accent in the app chrome. Do not import the source brands' orange, lavender, gradients, or colorful decorative palettes.
- Prefer open rows, dividers, and small status indicators over stacked nested cards.
- Keep radii professional: 8px for buttons/inputs, 12px-16px for top-level panels, 999px only for avatars/chips/docks.
- Type should be app-scale, not landing-page scale. Headings inside panels must be compact enough for dense repeated work.
- Icons must be real icon components, usually lucide or HeroUI-provided icons. No emoji placeholders.

## Layout Rules

- Desktop shell: fixed top app bar, fixed left rail, content area with stable gutters.
- Mobile shell: compact fixed top bar plus fixed bottom destination dock. Hide desktop text navigation from the phone top bar.
- Chat desktop: conversation/context column, main room, assistant insight column. Hide or move secondary panels on small screens so composer stays visible.
- Utility pages: primary work surface plus a contextual side panel on desktop; one-column flow on mobile.
- Every fixed shell must reserve content padding so headers, rails, and bottom docks never cover controls.
- Set `min-width: 0` on grid children and audit horizontal overflow.

## HeroUI Usage

- Import `@heroui/styles/css` once and import components from `@heroui/react`.
- Prefer compound components where available: `Card`, `Card.Content`, `Card.Header`, `Tabs`, `TabList`, `Tab`, `TabPanel`.
- Use HeroUI `Button`, `Input`, `TextArea`, `Chip`, `Avatar`, `Switch`, `Spinner`, `Tabs`, and `ProgressBar` for accessible controls.
- Use `isIconOnly` for icon actions and clear `aria-label` values.
- Use `isDisabled`, `isLoading`, `aria-current`, and `aria-pressed` where state matters.
- Do not depend on HeroUI default theme alone; align final visual quality with product CSS tokens.

## Content Rules

- Product copy should describe what the user can do, not backend implementation details.
- Empty states should be honest. "Waiting for real contacts" is acceptable; invented contact names and invented messages are not.
- Status labels should be useful and short: "Connected", "Generating", "Waiting for input", "Importing".
- Do not surface internal delivery wording, implementation plans, or endpoint names in user-facing primary areas.

## Verification

Run the strongest practical subset:

1. `npm run build`.
2. Search for banned remnants: `topnav`, `topnav-plain`, `seed`, fake names, demo conversations, gradients used as decoration.
3. Open desktop and mobile viewports.
4. Check `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
5. Confirm fixed header/rail/dock do not cover composer, send button, settings controls, or ingestion controls.
6. Click through chat, assistant tabs, ingestion, memory, settings, theme toggle, and connection check where possible.
