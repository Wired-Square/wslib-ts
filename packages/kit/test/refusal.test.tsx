import { expect, test, vi } from "vitest";

import { Form, PendingChange, Refusal, refusalMessage, unanswered } from "../src/index";
import type { Pending } from "../src/index";
import { button, mount, text, unmountAll } from "../src/testing";

test("a Refusal's message is shown, and anything else gets the fixed sentence and is logged", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(refusalMessage(new Refusal("ask another administrator"))).toBe("ask another administrator");
  expect(refusalMessage(new TypeError("x is undefined"))).toBe("something went wrong in this page");
  expect(logged).toHaveBeenCalledOnce();
});

test("only a Refusal marked unanswered is unanswered", () => {
  expect(unanswered(new Refusal("nothing answered", { unanswered: true }))).toBe(true);
  expect(unanswered(new Refusal("no"))).toBe(false);
  expect(unanswered(new Error("nothing answered"))).toBe(false);
  expect(new Refusal("no").name).toBe("Refusal");
});

test("a subclass keeps the seam, as a transport's own error extends Refusal", () => {
  class TransportError extends Refusal {
    constructor(readonly status: number) {
      super(status === 0 ? "nothing answered" : "refused", { unanswered: status === 0 });
    }
  }
  expect(unanswered(new TransportError(0))).toBe(true);
  expect(refusalMessage(new TransportError(403))).toBe("refused");
});

test("a Form renders a thrown Refusal's sentence", async () => {
  mount(() => (
    <Form
      act={() => {
        throw new Refusal("the interval must be a whole number of seconds");
      }}
    >
      {null}
    </Form>
  ));
  button("Save").click();
  await vi.waitFor(() => expect(text()).toContain("the interval must be a whole number of seconds"));
});

const change: Pending<string> = {
  change: "port 2 off",
  state: "pending",
  check_after_ms: null,
  rollback: null,
  warnings: [],
};

test("PendingChange says not answered for an unanswered Refusal, and refused for any other", async () => {
  const rereadWith = (error: Refusal) => () => Promise.reject(error);
  mount(() => (
    <PendingChange
      of={{ ...change, state: "expired" }}
      reread={rereadWith(new Refusal("unreachable", { unanswered: true }))}
      describe={(c) => c}
    />
  ));
  button("Read again").click();
  await vi.waitFor(() => expect(text()).toContain("not answered"));
  expect(text()).not.toContain("refused");

  unmountAll();
  mount(() => <PendingChange of={{ ...change, state: "expired" }} reread={rereadWith(new Refusal("busy"))} describe={(c) => c} />);
  button("Read again").click();
  await vi.waitFor(() => expect(text()).toContain("refused: busy"));
});
