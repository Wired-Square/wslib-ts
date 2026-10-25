import { expect, test, vi } from "vitest";

import { Confirm } from "../src/index";
import { button, field, mount, type } from "../src/testing";

test("a Confirm asking a reason waits for a non-blank one and acts on it trimmed", async () => {
  const act = vi.fn(async (_reason: string) => {});
  const onClose = vi.fn();
  mount(() => (
    <Confirm title="Revoke" verb="Revoke" reason={{ label: "Reason", placeholder: "For the audit trail" }} act={act} onClose={onClose}>
      Revoke the certificate?
    </Confirm>
  ));
  expect(field("Reason").placeholder).toBe("For the audit trail");
  expect(field("Reason").required).toBe(true);
  expect(button("Revoke").disabled).toBe(true);
  type("Reason", "   ");
  expect(button("Revoke").disabled, "blank is no reason").toBe(true);
  type("Reason", "  key leaked ");
  button("Revoke").click();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(act).toHaveBeenCalledWith("key leaked");
});

test("a Confirm with no reason acts on an empty one, in its tone, with Cancel disabled while it acts", async () => {
  let finish!: () => void;
  const act = vi.fn((_reason: string) => new Promise<void>((resolve) => (finish = resolve)));
  mount(() => (
    <Confirm title="Publish" verb="Publish" tone="primary" act={act} onClose={() => {}}>
      Publish the list?
    </Confirm>
  ));
  expect(document.querySelector("input")).toBeNull();
  expect(button("Publish").className).toBe("app-btn app-btn--primary");
  button("Publish").click();
  expect(act).toHaveBeenCalledWith("");
  expect(button("Cancel").disabled).toBe(true);
  finish();
  await vi.waitFor(() => expect(button("Cancel").disabled).toBe(false));
});

test("a Confirm's act may still take no argument, and its tone defaults to danger", () => {
  mount(() => (
    <Confirm title="Power off" verb="Power off" act={() => {}} onClose={() => {}}>
      Power off now?
    </Confirm>
  ));
  expect(button("Power off").className).toBe("app-btn app-btn--danger");
});
