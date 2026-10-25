import { createEffect, createMemo, createSignal, on } from "solid-js";
import type { Accessor } from "solid-js";

export interface Selection<T> {
  selected: Accessor<Set<string>>;
  /** The visible items that are selected. */
  selectedItems: Accessor<T[]>;
  isSelected: (key: string) => boolean;
  toggle: (key: string) => void;
  clear: () => void;
  /** Every visible item, or none when all of them are already selected. */
  toggleAll: () => void;
  allSelected: Accessor<boolean>;
  someSelected: Accessor<boolean>;
}

/**
 * Many of `visible` chosen at once, by `keyOf` (null for a row that cannot be
 * chosen). Cleared whenever `resetOn` changes: pass the resource, so a refetch
 * drops keys that may no longer mean the same row.
 */
export function createSelection<T>(
  visible: Accessor<T[]>,
  keyOf: (item: T) => string | null,
  resetOn: Accessor<unknown>,
): Selection<T> {
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const clear = () => setSelected(new Set<string>());
  createEffect(on(resetOn, clear, { defer: true }));

  const keys = () => visible().flatMap((item) => keyOf(item) || []);
  const isSelected = (key: string) => selected().has(key);
  const selectedItems = createMemo(() =>
    visible().filter((item) => {
      const key = keyOf(item);
      return !!key && isSelected(key);
    }),
  );
  const allSelected = () => {
    const all = keys();
    return all.length > 0 && all.every(isSelected);
  };

  return {
    selected,
    selectedItems,
    isSelected,
    toggle: (key) =>
      setSelected((was) => {
        const now = new Set(was);
        if (!now.delete(key)) now.add(key);
        return now;
      }),
    clear,
    toggleAll: () => (allSelected() ? clear() : setSelected(new Set(keys()))),
    allSelected,
    someSelected: () => keys().some(isSelected),
  };
}
