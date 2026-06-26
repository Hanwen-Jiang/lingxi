import type {RailDestination} from "@infinitechat/design-system";

/** The six real product destinations (DESIGN.md §Navigation: rail destinations
 *  must be real product views). `/assistant` is the 灵犀 surface. */
export interface Destination {
  to: string;
  icon: RailDestination;
  label: string;
}

export const DESTINATIONS: Destination[] = [
  {to: "/", icon: "home", label: "首页"},
  {to: "/messages", icon: "message", label: "消息"},
  {to: "/contacts", icon: "contacts", label: "通讯录"},
  {to: "/discover", icon: "discover", label: "发现"},
  {to: "/assistant", icon: "assistant", label: "灵犀"},
  {to: "/settings", icon: "settings", label: "设置"},
];

/** Match a destination as active, treating nested routes (/messages/:id) as the
 *  parent destination. */
export function isActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function titleFor(pathname: string): string {
  const hit = [...DESTINATIONS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((d) => isActive(pathname, d.to));
  return hit?.label ?? "灵犀";
}
