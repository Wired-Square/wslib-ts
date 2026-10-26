// The page half of wslib-mcp's `tauri-bridge`.

import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { runDomOp } from "./dom-ops.ts";

export const REQUEST_EVENT = "harness:request";
export const REPLY_EVENT = "harness:reply";

export type HarnessArgs = Record<string, unknown>;

export interface HarnessRequest {
  id: number;
  op: string;
  args: HarnessArgs;
}

export type HarnessReply = { id: number; ok: unknown } | { id: number; error: string };

/** Ops only the app can answer, such as `navigate`; tried before the DOM ops. */
export type AppOps = Record<string, (args: HarnessArgs) => unknown>;

export async function answer({ id, op, args }: HarnessRequest, appOps: AppOps = {}): Promise<HarnessReply> {
  try {
    const run = Object.prototype.hasOwnProperty.call(appOps, op) ? appOps[op] : undefined;
    return { id, ok: await (run ? run(args) : runDomOp(op, args)) };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
}

export function startHarnessBridge(appOps: AppOps = {}): Promise<UnlistenFn> {
  return listen<HarnessRequest>(REQUEST_EVENT, async ({ payload }) => {
    await emit(REPLY_EVENT, await answer(payload, appOps));
  });
}
