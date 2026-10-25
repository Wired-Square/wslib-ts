import { Show } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

export interface TableProps {
  head: JSX.Element;
  children: JSX.Element;
}

/** A list table that scrolls inside its wrapper rather than widening the page. */
export function Table(props: TableProps) {
  return (
    <div class="app-table-scroll">
      <table class="app-table">
        <thead>
          <tr>{props.head}</tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}

export interface TrProps {
  /** Still true, but already dealt with. */
  dim?: boolean;
  children: JSX.Element;
}

export function Tr(props: TrProps) {
  return <tr class={props.dim ? "app-table__dim" : undefined}>{props.children}</tr>;
}

export interface ThProps {
  right?: boolean;
  /** Read aloud and not shown, for a column of controls. */
  unseen?: boolean;
  children?: JSX.Element;
}

export function Th(props: ThProps) {
  return (
    <th scope="col" class={props.right ? "app-table__right" : undefined}>
      <Show when={props.unseen} fallback={props.children}>
        <span class="app-visually-hidden">{props.children}</span>
      </Show>
    </th>
  );
}

export interface TdProps {
  right?: boolean;
  muted?: boolean;
  /** The column the row is identified by. */
  strong?: boolean;
  /** Tabular figures on one line. */
  numeric?: boolean;
  /** The row's controls, hung off the right edge. */
  controls?: boolean;
  children?: JSX.Element;
}

export function Td(props: TdProps) {
  return (
    <td
      class={cx(
        props.right && "app-table__right",
        props.muted && "app-table__muted",
        props.strong && "app-table__strong",
        props.numeric && "app-table__numeric",
        props.controls && "app-table__actions",
      )}
    >
      {props.children}
    </td>
  );
}
