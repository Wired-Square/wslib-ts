import { createSignal } from "solid-js";

import { createAction } from "./action";
import { keyedRows } from "./keyedRows";

export interface PagedList<T> {
  rows: () => T[];
  /** The server's word that there is another page, never a guess from a full one. */
  hasMore: () => boolean;
  /** Fetch page one again, keeping the rows that are still there; supersedes whatever is in flight. */
  refresh: () => Promise<void>;
  /** Fetch the next page and append it; dropped while anything is in flight. */
  more: () => Promise<void>;
  pending: () => boolean;
  failed: () => string | undefined;
  /** Whether page one has ever arrived; before it, an empty list means nothing yet. */
  started: () => boolean;
  /** Edit the loaded rows without fetching, which would drop every page past the first. */
  mutate: (update: (rows: T[]) => T[]) => void;
}

/**
 * A list that grows behind an opaque cursor. Nothing is fetched until
 * `refresh`. `key` is what a row is known by across a refresh; `null` for rows
 * with no identity, which a refresh rebuilds.
 */
export function createPagedList<T extends object, C = string>(
  fetchPage: (cursor: C | null) => Promise<{ items: T[]; next: C | null }>,
  key: (keyof T & string) | null,
): PagedList<T> {
  const [fetched, setFetched] = createSignal<T[]>([]);
  const [next, setNext] = createSignal<C | null>(null);
  const [started, setStarted] = createSignal(false);
  const fetching = createAction({ supersede: true });

  const refresh = () =>
    fetching.run(
      () => fetchPage(null),
      (page) => {
        setFetched(page.items);
        setNext(() => page.next);
        setStarted(true);
      },
    );

  const more = async () => {
    const cursor = next();
    if (fetching.pending() || cursor === null) return;
    await fetching.run(
      () => fetchPage(cursor),
      (page) => {
        setFetched((have) => [...have, ...page.items]);
        setNext(() => page.next);
      },
    );
  };

  return {
    rows: key === null ? fetched : keyedRows(fetched, key),
    hasMore: () => next() !== null,
    refresh,
    more,
    pending: fetching.pending,
    failed: fetching.failed,
    started,
    mutate: (update) => {
      setFetched(update);
    },
  };
}
