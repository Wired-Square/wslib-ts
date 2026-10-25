import { createRenderEffect, createSignal, mergeProps } from "solid-js";
import { expect, test } from "vitest";

import { Field, Menu, MenuItemUnavailable, Notice, Select, TextArea, Views, routed } from "../src/index";
import type { Routed } from "../src/index";
import { button, mount, text, type } from "../src/testing";

const CAPS_LOCK = "Caps Lock is on";

const press = (input: Element, kind: "keydown" | "keyup", capsLock: boolean) =>
  input.dispatchEvent(new KeyboardEvent(kind, { bubbles: true, modifierCapsLock: capsLock }));

const pointAt = (input: Element, capsLock: boolean) =>
  input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, modifierCapsLock: capsLock }));

const focus = (input: Element, kind: "focusin" | "focusout") => input.dispatchEvent(new FocusEvent(kind, { bubbles: true }));

test("a password field says Caps Lock is on while it is, and stops on blur or when it goes off", () => {
  const root = mount(() => <Field label="Password" type="password" hint="At least 12 characters." />);
  const input = root.querySelector("input")!;
  const status = root.querySelector("[role=status]")!;
  const shown = () => !status.classList.contains("app-visually-hidden") && status.textContent === CAPS_LOCK;
  const describing = () =>
    (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)!.textContent)
      .join(" | ");

  expect(shown()).toBe(false);
  expect(describing()).toBe("At least 12 characters.");

  pointAt(input, true);
  expect(shown(), "a pointer that never focused the field").toBe(false);
  focus(input, "focusin");
  expect(shown(), "the pointer that focused it").toBe(true);

  press(input, "keydown", true);
  expect(describing()).toBe(`At least 12 characters. | ${CAPS_LOCK}`);
  press(input, "keyup", false);
  expect(shown()).toBe(false);
  expect(describing()).toBe("At least 12 characters.");

  pointAt(input, true);
  expect(shown()).toBe(true);
  focus(input, "focusout");
  expect(shown()).toBe(false);
  focus(input, "focusin");
  expect(shown(), "blur forgot the key").toBe(false);
});

test("a field that is not a password has no Caps Lock notice", () => {
  const root = mount(() => <Field label="Username" />);
  const input = root.querySelector("input")!;
  focus(input, "focusin");
  press(input, "keydown", true);
  expect(root.querySelector("[role=status]")).toBeNull();
  expect(input.hasAttribute("aria-describedby")).toBe(false);
});

test("Field and TextArea hand onValue what is typed, and Select what is chosen, after the caller's own handler", () => {
  const heard: string[] = [];
  const onValue = (value: string) => heard.push(`onValue ${value}`);
  mount(() => (
    <>
      <Field label="Field" onInput={() => heard.push("onInput")} onValue={onValue} />
      <TextArea label="TextArea" onInput={() => heard.push("onInput")} onValue={onValue} />
      <Select label="Select" onChange={() => heard.push("onChange")} onValue={onValue}>
        <option value="operator">operator</option>
      </Select>
    </>
  ));
  type("Field", "operator");
  type("TextArea", "operator");
  const select = document.querySelector("select")!;
  select.value = "operator";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(heard).toEqual(["onInput", "onValue operator", "onInput", "onValue operator", "onChange", "onValue operator"]);
});

test("Views over a lone view draws its panel alone, built once, with no strip of one", () => {
  const [draft, setDraft] = createSignal(false);
  let builds = 0;
  const root = mount(() => (
    <Views
      aria-label="Backup"
      group="backup"
      views={[{ id: "take", label: "Take", panel: () => (builds++, draft() ? "a draft" : "the take panel") }]}
      selected={undefined}
      onChange={() => {}}
    />
  ));
  expect(root.textContent).toBe("the take panel");
  expect(root.querySelector("[role=tablist]")).toBeNull();
  setDraft(true);
  expect(builds, "a signal read as the panel is built does not rebuild it").toBe(1);
});

test("a routed screen shows the view its host routes and tells the host of a choice, and mounted alone chooses for itself", () => {
  const views = [
    { id: "take", label: "Take", panel: () => "the take panel" },
    { id: "restore", label: "Restore", panel: () => "the restore panel" },
  ];
  const Screen = (props: Routed) => <Views {...mergeProps({ "aria-label": "Backup", group: "backup", views }, routed(props))} />;

  const [view, setView] = createSignal<string>();
  const told: string[] = [];
  const hosted = mount(() => <Screen view={view()} onView={(id) => told.push(id)} />);
  button("Restore").click();
  expect(told).toEqual(["restore"]);
  expect(hosted.textContent, "the host has not moved yet").toContain("the take panel");
  setView("restore");
  expect(hosted.textContent).toContain("the restore panel");
  hosted.remove();

  const alone = mount(() => <Screen />);
  expect(alone.textContent).toContain("the take panel");
  button("Restore").click();
  expect(alone.textContent).toContain("the restore panel");
});

test("the pills a view names in also share its one panel, mounted once across them and handed the id selected", () => {
  const [selected, setSelected] = createSignal("devices");
  let mounts = 0;
  const seen: string[] = [];
  const root = mount(() => (
    <Views
      aria-label="Monitoring"
      group="monitoring"
      views={[
        {
          id: "devices",
          label: "Devices",
          also: [{ id: "discovery", label: "Discovery" }],
          panel: (shown) => {
            mounts++;
            createRenderEffect(() => seen.push(shown()));
            return "the shared panel";
          },
        },
        { id: "log", label: "Log", panel: () => "the log panel" },
      ]}
      selected={selected()}
      onChange={setSelected}
    />
  ));
  const tab = button("Discovery");
  const panel = () => root.querySelector("[role=tabpanel]:not([hidden])")!;

  tab.click();
  expect(mounts).toBe(1);
  expect(seen).toEqual(["devices", "discovery"]);
  expect(tab.getAttribute("aria-selected")).toBe("true");
  expect(panel().id).toBe(tab.getAttribute("aria-controls"));
  expect(panel().getAttribute("aria-labelledby")).toBe(tab.id);

  button("Log").click();
  expect(text()).toContain("the log panel");
  expect(text()).not.toContain("the shared panel");
  button("Devices").click();
  expect(mounts, "left and come back to, it mounts again").toBe(2);
});

test("a Notice appears when its words do and goes when they are gone", () => {
  const [why, setWhy] = createSignal<string>();
  const root = mount(() => <Notice tone="bad">{why()}</Notice>);
  const shown = () => [...root.querySelectorAll("[role=alert]")].map((n) => n.textContent);
  expect(shown()).toEqual([]);
  setWhy("The server refused.");
  expect(shown()).toEqual(["The server refused."]);
  setWhy(undefined);
  expect(shown()).toEqual([]);
});

test("choosing a MenuItemUnavailable does nothing, with a why or without", () => {
  for (const why of ["scan the card first", undefined]) {
    const root = mount(() => (
      <Menu aria-label="Actions">
        <MenuItemUnavailable {...(why ? { why } : {})}>Delete…</MenuItemUnavailable>
      </Menu>
    ));
    root.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")!.click();
    const item = root.querySelector<HTMLButtonElement>("[role=menuitem]")!;
    item.click();
    expect(root.querySelector("[aria-haspopup=menu]")!.getAttribute("aria-expanded"), "the menu stays open").toBe("true");
    expect(item.isConnected).toBe(true);
    root.remove();
  }
});
