import { For } from "solid-js";

import { Notice } from "./Notice";

export interface WarningsProps {
  of: string[];
}

export function Warnings(props: WarningsProps) {
  return <For each={props.of}>{(warning) => <Notice tone="warn">{warning}</Notice>}</For>;
}
