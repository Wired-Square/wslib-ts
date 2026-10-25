import { For, Show, children, createMemo, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

import { arrowTo } from "./keys";

export interface Tab<T extends string> {
  id: T;
  label: string;
}

export interface TabsProps<T extends string> {
  tabs: readonly Tab<T>[];
  selected: T;
  onChange: (id: T) => void;
  "aria-label": string;
  /** Which strip these ids belong to, when a screen has two. */
  group?: string;
  /** `pill` for a strip of views inside one screen. */
  variant?: "pill";
}

const scoped = (group: string | undefined, id: string) => (group ? `${group}-${id}` : id);

/**
 * A tab strip. Arrows, Home and End move the selection, and only the selected
 * tab is tabbable, so Tab leaves the strip for the panel.
 */
export function Tabs<T extends string>(props: TabsProps<T>) {
  const move: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (e) => {
    const here = props.tabs.findIndex((t) => t.id === props.selected);
    const to = arrowTo(e.key, here, props.tabs.length, "ArrowRight");
    if (to === undefined) return;
    e.preventDefault();
    props.onChange(props.tabs[to]!.id);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[to]?.focus();
  };

  return (
    <div
      role="tablist"
      class={cx("app-tablist", props.variant && `app-tablist--${props.variant}`)}
      aria-label={props["aria-label"]}
      onKeyDown={move}
    >
      <For each={props.tabs}>
        {(t) => (
          <button
            type="button"
            role="tab"
            class="app-tab"
            data-label={t.label}
            id={`tab-${scoped(props.group, t.id)}`}
            aria-controls={`panel-${scoped(props.group, t.id)}`}
            aria-selected={props.selected === t.id}
            tabindex={props.selected === t.id ? 0 : -1}
            onClick={() => props.onChange(t.id)}
          >
            {t.label}
          </button>
        )}
      </For>
    </div>
  );
}

export interface TabPanelProps<T extends string> {
  id: T;
  selected: T;
  group?: string;
  children: JSX.Element;
}

/** Not rendered unless selected, so nothing in an unselected panel is focusable or submitted. */
export function TabPanel<T extends string>(props: TabPanelProps<T>) {
  return (
    <Show when={props.selected === props.id}>
      <div
        role="tabpanel"
        class="app-tabpanel"
        id={`panel-${scoped(props.group, props.id)}`}
        aria-labelledby={`tab-${scoped(props.group, props.id)}`}
      >
        {props.children}
      </div>
    </Show>
  );
}

export interface TabButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** A tab's look for a filter, which owns no panel and so says `aria-pressed`. */
export function TabButton(props: TabButtonProps) {
  const [own, rest] = splitProps(props, ["selected", "class", "children"]);
  const label = children(() => own.children);
  const text = () => {
    const resolved = label();
    return typeof resolved === "string" ? resolved : undefined;
  };
  return (
    <button {...rest} type="button" class={cx("app-tab", own.class)} data-label={text()} aria-pressed={own.selected}>
      {label()}
    </button>
  );
}

/**
 * False until one of `tabs` is first selected, then true: a resource's source
 * that fetches when its tab is first reached, and never again for a switch.
 */
export function latched<T>(selected: () => T, ...tabs: T[]): () => boolean {
  return createMemo<boolean>((was) => was || tabs.includes(selected()), false);
}
