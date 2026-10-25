import { Match, Show, Switch } from "solid-js";
import type { Accessor, JSX, Resource } from "solid-js";

import { Button } from "./Button";
import { Notice } from "./Notice";
import { refusalMessage } from "./refusal";

/** A screen's one resource: reading, refused with a Try again, or handed on narrowed. */
export function Loaded<T>(props: {
  of: Resource<T>;
  refetch: () => unknown;
  /** What is being read, for the line shown until it arrives. */
  reading: string;
  children: (value: Accessor<T>) => JSX.Element;
}) {
  return (
    <>
      <Switch>
        <Match when={props.of.loading}>
          <Notice tone="neutral">Reading {props.reading}…</Notice>
        </Match>
        <Match when={props.of.error}>
          <Notice tone="bad">
            {refusalMessage(props.of.error)}{" "}
            <Button tone="plain" onClick={() => void props.refetch()}>
              Try again
            </Button>
          </Notice>
        </Match>
      </Switch>
      {/* Calling an errored resource throws, so `error` is read first. */}
      <Show when={props.of.error ? undefined : props.of()}>{props.children}</Show>
    </>
  );
}
