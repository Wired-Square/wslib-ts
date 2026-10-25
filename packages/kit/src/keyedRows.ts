import { createEffect } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

/**
 * A fetched list a refetch updates in place by `key`, so an unchanged row
 * keeps its DOM, and with it focus and an open menu. `fetched` is a signal, not
 * a resource: reading an errored resource throws, here inside the effect.
 */
export function keyedRows<T extends object>(fetched: () => T[] | undefined, key: keyof T & string): () => T[] {
  const [rows, setRows] = createStore<{ list: T[] }>({ list: [] });
  createEffect(() => setRows("list", reconcile(fetched() ?? [], { key })));
  return () => rows.list;
}
