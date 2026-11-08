import type { FactorProof } from "@wired-square/appliance-types";
import { createSignal } from "solid-js";

import { withProof } from "../parts/withProof";
import type { ProofAsk } from "../parts/withProof";

/** `send` with the proof `withProof` asks for where `asks`, else with none; `undefined` if cancelled. */
export const provedIf = <T extends NonNullable<unknown> | null>(
  asks: boolean,
  ask: ProofAsk,
  send: (proof: FactorProof) => Promise<T>,
) => (asks ? withProof(ask, send) : send({}));

/** A `Form`'s `done` sentence, held back after an act whose proof was cancelled. */
export function createDone(sentence: string) {
  const [cancelled, setCancelled] = createSignal(false);
  return {
    sentence: () => (cancelled() ? undefined : sentence),
    /** Whether `outcome` went ahead, which a cancelled proof's `undefined` did not. */
    went: <T>(outcome: T | undefined): outcome is T => {
      setCancelled(outcome === undefined);
      return outcome !== undefined;
    },
  };
}
