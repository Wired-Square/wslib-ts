import { For, Show, createSignal } from "solid-js";
import type { Accessor, JSX } from "solid-js";

import { TabPanel, Tabs } from "./Tabs";
import type { Tab } from "./Tabs";

export interface View<T extends string> extends Tab<T> {
  /** Given the id selected, which differs from `id` only when `also` names it. */
  panel: (selected: Accessor<T>) => JSX.Element;
  /** More pills over this one panel, which stays mounted while any of them is selected. */
  also?: readonly Tab<T>[];
}

export interface ViewsProps<T extends string> {
  views: readonly View<T>[];
  selected: string | undefined;
  onChange: (id: T) => void;
  "aria-label": string;
  /** Required: a screen's views sit inside the app's own tabs. */
  group: string;
}

type Pills<T extends string> = Tab<T> & Pick<View<T>, "also">;

const pillsOf = <T extends string>(view: Pills<T>): readonly Tab<T>[] => [view, ...(view.also ?? [])];

/** The pill `id` names, in a view's `also` or not, or the first view where it names none. */
export function viewOf<T extends string>(views: readonly Pills<T>[], id: string | undefined): T {
  return (views.flatMap(pillsOf).find((pill) => pill.id === id) ?? views[0]!).id;
}

/**
 * A pill strip over one panel per view; a lone pill is its panel alone.
 * Controlled, so route the view as an optional parameter of one route: two
 * routes remount the screen on the first switch and lose its focus.
 */
export function Views<T extends string>(props: ViewsProps<T>) {
  const pills = () => props.views.flatMap(pillsOf);
  const selected = () => viewOf(props.views, props.selected);
  const answers = (view: View<T>) => pillsOf(view).some((pill) => pill.id === selected());
  return (
    <Show
      when={pills().length > 1}
      fallback={
        <Show when={props.views[0]} keyed>
          {(view) => view.panel(selected)}
        </Show>
      }
    >
      <div class="app-views">
        <Tabs
          variant="pill"
          aria-label={props["aria-label"]}
          group={props.group}
          tabs={pills()}
          selected={selected()}
          onChange={props.onChange}
        />
        <For each={props.views}>
          {(view) => (
            // Named for the selected pill while it answers, so the panel stays mounted across them.
            <TabPanel group={props.group} id={answers(view) ? selected() : view.id} selected={selected()}>
              {view.panel(selected)}
            </TabPanel>
          )}
        </For>
      </div>
    </Show>
  );
}

export interface Routed {
  view?: string | undefined;
  onView?: (id: string) => void;
}

/** `Views`'s `selected` and `onChange`: the host's route, or the screen's own choice when mounted alone. */
export function routed(props: Routed) {
  const [own, setOwn] = createSignal<string>();
  return {
    get selected() {
      return props.view ?? own();
    },
    onChange: (id: string) => (props.onView ?? setOwn)(id),
  };
}
