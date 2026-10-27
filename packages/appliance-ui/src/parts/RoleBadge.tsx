/**
 * A role, rendered where an account is listed.
 *
 * **Deliberately neutral for all four.** Colouring the ladder reads as a
 * severity scale, and an administrator is not a warning.
 *
 * Capitalised here rather than in CSS: `text-transform` changes what is painted
 * and not what is copied, announced or searched for, and "viewer" is the string
 * the wire uses.
 */
import type { Role } from "@wired-square/appliance-types";
import { Badge } from "@wired-square/kit";

/**
 * The four, spelled for a person.
 *
 * A `Record<Role, string>` rather than a function, so adding a role to the Rust
 * ladder fails to typecheck here. A `capitalise(role)` helper compiles and ships
 * the fifth role in lowercase.
 */
export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  operator: "Operator",
  admin: "Admin",
  hostadmin: "Host admin",
};

export interface RoleBadgeProps {
  role: Role;
}

export function RoleBadge(props: RoleBadgeProps) {
  return <Badge tone="neutral">{ROLE_LABELS[props.role]}</Badge>;
}
