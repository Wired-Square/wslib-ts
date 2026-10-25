import { For, createSignal } from "solid-js";
import { chooseScheme } from "@wired-square/kit/core";
import type { Scheme } from "@wired-square/kit/core";

import { IconButton } from "./Button";
import { useIcons } from "./icons";
import type { KitIcons } from "./icons";

const LABELS: Record<Scheme, string> = {
  system: "System colour scheme",
  light: "Light colour scheme",
  dark: "Dark colour scheme",
};

const ALL = Object.keys(LABELS) as Scheme[];

const GLYPHS: Record<Scheme, keyof KitIcons> = {
  system: "schemeSystem",
  light: "schemeLight",
  dark: "schemeDark",
};

function appliedScheme(): Scheme {
  const applied = document.documentElement.getAttribute("data-app-scheme");
  if (applied === "light dark") return "system";
  return applied === "dark" ? "dark" : "light";
}

/** One glyph per scheme in `choices`, the one `<html>` carries pressed; keeps a choice through `chooseScheme`. */
export function SchemePicker(props: { choices?: readonly Scheme[] }) {
  const icons = useIcons();
  const [chosen, setChosen] = createSignal(appliedScheme());
  return (
    <div role="group" aria-label="Colour scheme" class="app-scheme-picker">
      <For each={props.choices ?? ALL}>
        {(scheme) => (
          <IconButton
            label={LABELS[scheme]}
            aria-pressed={chosen() === scheme}
            onClick={() => {
              chooseScheme(scheme);
              setChosen(scheme);
            }}
          >
            {icons[GLYPHS[scheme]]()}
          </IconButton>
        )}
      </For>
    </div>
  );
}
