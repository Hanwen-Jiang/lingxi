import {Switch as HeroSwitch} from "@heroui/react/switch";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Brand switch — the REAL HeroUI OSS Switch (v3.2 compound anatomy:
 * Content > Control > Thumb) packaged behind a simple checked/onChange API. The
 * "on" track is the brand accent (#006FEE) via the design tokens. Use inside a
 * row that carries its own visible label, and pass `aria-label` for a11y.
 */
export function Switch({checked, defaultChecked, onChange, disabled, ...rest}: SwitchProps) {
  return (
    <HeroSwitch
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onChange}
      isDisabled={disabled}
      {...rest}
    >
      <HeroSwitch.Content>
        <HeroSwitch.Control>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
      </HeroSwitch.Content>
    </HeroSwitch>
  );
}
