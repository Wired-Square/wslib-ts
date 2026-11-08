/**
 * The open proof ask, read and answered without a DOM, for a runner with no
 * vitest or jsdom; `withProof` still needs a mounted `ProofHost`, as in the app.
 */
import type { FactorProof, Reauthentication } from "@wired-square/appliance-types";

import { answer, asking } from "../parts/withProof";
import type { ProofAsk } from "../parts/withProof";

function open() {
  const ask = asking();
  if (!ask) throw new Error("no proof is being asked for");
  return ask;
}

/** The open proof's ask, or `undefined` while none is. */
export const proofAsked = (): ProofAsk | undefined => asking()?.ask;

/**
 * Hands `proof` to the open ask's `send`, as the dialog would: settles once
 * done, or rejects with a refused proof and leaves the ask open.
 */
export const answerProof = (proof: FactorProof | Reauthentication) => answer(open(), proof);

/** Closes the open ask, as Cancel does, so `withProof` resolves `undefined`. */
export const cancelProof = () => open().settle({ value: undefined });
