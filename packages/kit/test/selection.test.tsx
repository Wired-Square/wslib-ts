import { createRoot, createSignal } from "solid-js";
import { expect, test } from "vitest";

import { Tick, createSelection } from "../src/index";
import { mount } from "../src/testing";

interface Row {
  id: string | null;
}

function rows(...ids: (string | null)[]) {
  const [visible, setVisible] = createSignal<Row[]>(ids.map((id) => ({ id })));
  const [fetched, setFetched] = createSignal(0);
  const selection = createRoot(() => createSelection(visible, (row) => row.id, fetched));
  return { selection, setVisible, refetch: () => setFetched((n) => n + 1) };
}

test("a selection toggles keys, and is some or all of the rows that can be chosen", () => {
  const { selection } = rows("a", "b", null);
  expect([selection.someSelected(), selection.allSelected()]).toEqual([false, false]);
  selection.toggle("a");
  expect([selection.someSelected(), selection.allSelected(), selection.isSelected("a")]).toEqual([true, false, true]);
  selection.toggle("b");
  expect(selection.allSelected(), "a row with no key is not counted").toBe(true);
  selection.toggle("a");
  expect([...selection.selected()]).toEqual(["b"]);
});

test("toggleAll selects every visible row, or clears when all are selected", () => {
  const { selection } = rows("a", "b", null);
  selection.toggleAll();
  expect([...selection.selected()]).toEqual(["a", "b"]);
  selection.toggleAll();
  expect(selection.selected().size).toBe(0);
  expect(rows().selection.allSelected(), "nothing to choose is not all chosen").toBe(false);
});

test("selectedItems are only the visible rows, and a refetch clears the selection", () => {
  const { selection, setVisible, refetch } = rows("a", "b");
  selection.toggleAll();
  setVisible([{ id: "b" }, { id: "c" }]);
  expect(selection.selectedItems()).toEqual([{ id: "b" }]);
  expect(selection.someSelected()).toBe(true);
  refetch();
  expect(selection.selected().size).toBe(0);
});

test("a mixed Tick is indeterminate, and stops being so when it is not", () => {
  const [mixed, setMixed] = createSignal(true);
  const box = mount(() => <Tick label="Select all" checked={false} mixed={mixed()} onChange={() => {}} />).querySelector("input")!;
  expect(box.indeterminate).toBe(true);
  setMixed(false);
  expect(box.indeterminate).toBe(false);
});
