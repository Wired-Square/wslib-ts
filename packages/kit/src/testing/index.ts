/**
 * For an app's vitest suite over the kit, in jsdom: name
 * `@wired-square/kit/testing/setup` in `setupFiles`, mount a screen, and find
 * what a person would by its words.
 */
export { mount, unmountAll } from "./mount";
export type { MountOptions, Wrapped, YieldingMountOptions } from "./mount";

export function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`no button reading "${text}"`);
  return found;
}

/** The input the label reading `label` names. */
export function field(label: string): HTMLInputElement {
  const found = [...document.querySelectorAll("label")].find((l) => l.textContent?.trim() === label);
  const input = found && (document.getElementById(found.htmlFor) ?? found.querySelector("input"));
  if (!input) throw new Error(`no field labelled "${label}"`);
  return input as HTMLInputElement;
}

/** `value` typed into the field labelled `label`, as one input event. */
export function type(label: string, value: string) {
  const input = field(label);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export const text = () => document.body.textContent ?? "";
