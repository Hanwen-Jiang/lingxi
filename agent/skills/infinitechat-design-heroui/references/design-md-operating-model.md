# DESIGN.md Operating Model

Use DESIGN.md as an execution contract for UI agents: a concise document that explains how the project should look, feel, and behave. The useful sections are visual atmosphere, semantic color roles, typography, component states, layout, elevation, do/don't rules, responsive behavior, and an agent prompt guide.

Sources considered:

- `voltagent/awesome-design-md` README and selected DESIGN.md files for Intercom, Linear, Cal.com, and Vercel.
- Existing `infinitechat-web/DESIGN.md`.

## Extracted Lessons

- Intercom-like lesson: conversational products should let the product surface be the protagonist. Use product UI and real interaction states, not marketing ornament.
- Linear-like lesson: dense product work benefits from precise surfaces, compact typography, hairline dividers, and scarce accent color.
- Cal.com-like lesson: professional SaaS screens should feel usable before they feel decorative. Product UI fragments and clear action hierarchy matter more than big copy blocks.
- Vercel-like lesson: technical interfaces gain polish from disciplined spacing, subtle borders, crisp type, and restrained button hierarchy.

## InfiniteChat Contract

- The app is a messaging and assistant workspace. The main screen must answer: where am I, what can I do now, what state is the backend in, and what changed after my last action.
- Use neutral light mode and pure black dark mode. Avoid decorative gradients and one-note tinted canvases.
- Use one product accent: HeroUI blue (`#006FEE` family). Other semantic colors may appear only in tiny status dots/text.
- Never fake social data. No seeded contacts, seeded chat rooms, seeded unread activity, or invented teammate names.
- Prefer honest empty states, persisted local user messages, and data returned by backend calls.
- Treat every page as a workflow, not a brochure. A workflow has controls, states, result areas, and recovery from empty/error states.

## Screen Requirements

- Home: compact status overview and direct paths to chat, assistant, ingestion, settings.
- Chat: mode selection, message feed, composer, backend result evidence/status.
- Assistant: tabs or segmented controls for conversation, knowledge, ingestion, memory. Each tab must be directly usable.
- Contacts: honest empty state until real data exists.
- Discover: workflow shortcuts, not fake recommendations.
- Settings: service URL, user/session identity, health check, theme, clear local conversation.

## Anti-Patterns

- Large hero sections that delay the actual app.
- Card-in-card layouts where every row becomes a floating tile.
- Fake activity metrics and fake people.
- Top navigation that scrolls away or duplicates mobile bottom navigation.
- Buttons with text where an established icon-only action is clearer.
- Text clipped inside buttons, chips, sidebars, or mobile top bars.

## Responsive Audit

- Desktop: fixed top bar and left rail, content fully visible below the bar.
- Tablet: primary workflow stays first; side panels may stack.
- Phone: compact top bar, bottom destination dock, no duplicate top nav, composer and send controls visible.
- Every layout must pass no-horizontal-overflow.
