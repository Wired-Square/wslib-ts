import { Refusal as CoreRefusal, refusalMessage, unanswered } from "@wired-square/kit/core";
import { Form, Refusal } from "@wired-square/kit";
import { expect, test, vi } from "vitest";

import { button, mount, text } from "../src/testing";

test("the root and core share one Refusal, so either's is recognised by the other", async () => {
  expect(Refusal).toBe(CoreRefusal);
  expect(unanswered(new Refusal("nothing answered", { unanswered: true }))).toBe(true);
  expect(refusalMessage(new Refusal("ask another administrator"))).toBe("ask another administrator");

  mount(() => (
    <Form
      act={() => {
        throw new CoreRefusal("the interval must be a whole number of seconds");
      }}
    >
      {null}
    </Form>
  ));
  button("Save").click();
  await vi.waitFor(() => expect(text()).toContain("the interval must be a whole number of seconds"));
});
