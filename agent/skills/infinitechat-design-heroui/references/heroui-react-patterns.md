# HeroUI React Patterns

HeroUI v3 is installed in `infinitechat-web` as `@heroui/react@3.2.1` and `@heroui/styles@3.2.1`.

## Imports

```jsx
import { Avatar, Button, Card, Chip, Input, Spinner, Switch, TextArea } from '@heroui/react';
import '@heroui/styles/css';
```

Add additional components from `@heroui/react` as needed. The package does not require a global provider for the current setup.

## Component Notes

- `Card` supports compound children such as `Card.Header`, `Card.Content`, `Card.Footer`, `Card.Title`, and `Card.Description`.
- `Button` supports `variant`, `size`, `fullWidth`, `isIconOnly`, `isDisabled`, and `isLoading`. For icons, set an explicit `aria-label`.
- `Input` and `TextArea` are React Aria-based controls. Pass `value` and `onChange` from controlled state.
- `Chip` supports `size`, `variant`, and `color`. Use chips for small states, never as a replacement for navigation.
- `Avatar` supports `Avatar.Fallback`; use neutral initials only for system roles like `AI` or `你`.
- `Switch` should be paired with visible labels and real state.
- `Spinner` should only appear while an operation is actually running.

## Styling Pattern

- Let HeroUI provide accessible behavior and base classes.
- Apply product classes for layout and final visual tone: shell, workbench panels, row dividers, status chips, composer, bottom dock.
- Use CSS tokens at `:root` and `[data-theme="dark"]` so dark mode stays consistent.
- Avoid overriding every HeroUI internal class unless needed. Prefer class names on the component root.

## Accessibility

- Use `aria-current="page"` for active destination nav.
- Use `aria-pressed` for mode/toggle button groups when not using a native tab component.
- Use real buttons for navigation/actions and labels for settings form controls.
- Keep focus rings visible and blue.
