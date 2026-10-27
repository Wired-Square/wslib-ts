/** What a factory reset erased and kept, and the way on to the first-account screen. */
import type { ResetReport } from "@wired-square/appliance-types";
import { Button, Notice, Warnings } from "@wired-square/kit";
import { Show } from "solid-js";

export function ResetDone(props: { report: ResetReport; pending: boolean; onContinue: () => void }) {
  return (
    <>
      <Notice tone="good">This appliance was reset. You are signed out.</Notice>
      <Show when={props.report.erased.length > 0}>
        <p>Erased: {props.report.erased.join("; ")}.</p>
      </Show>
      <Show when={props.report.kept.length > 0}>
        <p>Kept: {props.report.kept.join("; ")}.</p>
      </Show>
      <Warnings of={props.report.warnings} />
      <div class="app-actions">
        <Button tone="primary" pending={props.pending} onClick={props.onContinue}>
          Continue
        </Button>
      </div>
    </>
  );
}
