/** Fails to typecheck when a generated wire type and the kit's copy of it stop being the same type. */
import type { Pending, Rollback, SettledBy, Warning, WarningScope } from "@wired-square/appliance-types";
import type * as Kit from "@wired-square/kit";

type Same<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

export type WireFitsKit<_ extends true[] = [
  Same<Pending<{ level: number }>, Kit.Pending<{ level: number }>>,
  Same<Rollback, Kit.Rollback>,
  Same<SettledBy, Kit.SettledBy>,
  Same<Warning, Kit.Warning>,
  Same<WarningScope, Kit.WarningScope>,
]> = _;
