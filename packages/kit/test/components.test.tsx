import { expect, test, vi } from "vitest";

import { Button, FeedStatus, IconSet, Menu, MenuItem, MenuItemUnavailable, NothingYet, Notice, TabButton, Tabs, TextArea, Tick, Toggle, Views, viewOf } from "../src/index";
import { mount } from "../src/testing";
import { forcedColours, read, rule, sourceFiles } from "./css";

test("a hovered button's edge highlights, in its own fill's edge on primary and danger, easing in except under reduced motion", () => {
  const css = read("kit.css");
  const hovered = ':hover:not(:disabled, [aria-disabled="true"])';
  expect(rule(css, `.app-btn${hovered}`)).toMatch(/border-color: var\(--app-accent\);/);
  expect(rule(css, `.app-btn--plain${hovered}`)).not.toMatch(/border-color/);
  expect(rule(css, `.app-btn--primary${hovered}`)).toMatch(/border-color: var\(--app-accent-edge\);/);
  expect(rule(css, `.app-btn--danger${hovered}`)).toMatch(/border-color: var\(--app-alert-edge\);/);
  expect(rule(css, ".app-btn:focus-visible")).not.toMatch(/border/);
  expect(rule(css, ".app-btn")).toMatch(/transition:[^;]*border-color 100ms/);
  expect(rule(css, `.app-btn--danger${hovered}`)).toMatch(/filter: /);
  expect(rule(css, `.app-btn--danger${hovered}`)).toMatch(/background: var\(--app-alert\);/);
  expect(rule(css, ".app-btn")).toMatch(/transition:[^;]*filter 100ms/);
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n {2}\.app-btn \{\n {4}transition: none;/);
  expect(read("theme.css")).toMatch(/:root \{[^}]*--app-accent-edge: [^}]*--app-alert-edge: /);
});

test("the kit's controls share a line-height, a select is drawn but native under forced colours, and a pressed pill is raised", () => {
  const css = read("kit.css");
  const shared = /line-height: var\(--app-control-line-height\);/;
  expect(rule(css, ".app-btn")).toMatch(shared);
  expect(rule(css, ".app-field__input")).toMatch(shared);
  expect(rule(css, "select.app-field__input")).toMatch(/appearance: none;[^}]*background-image:/);
  expect(rule(forcedColours(css), "select.app-field__input")).toMatch(/appearance: auto;\s*background-image: none;/);
  const ring = css.lastIndexOf(
    ":is(.app-field__input, .app-btn, .app-tab, .app-menu__item, .app-popover__option, .app-switch, .app-search__clear):focus-visible",
  );
  expect(ring, "the forced-colours ring follows every outline: none it overrides").toBeGreaterThan(
    css.lastIndexOf("outline: none"),
  );
  expect(css.slice(ring)).toMatch(/^[^}]*outline: 2px solid Highlight;/);
  expect(rule(css, ".app-field__input:disabled")).toMatch(/background-color:/);
  expect(rule(css, ".app-tick__box")).toMatch(/inline-size: 1rem;[^}]*accent-color: var\(--app-accent\);/);
  expect(rule(css, ".app-section__head:not(:has(.app-section__blurb))")).toMatch(/align-items: center;/);
  expect(rule(css, ".app-table :where(th, td)")).toMatch(/vertical-align: baseline;/);
  expect(rule(css, ".app-table__actions .app-btn")).toMatch(/padding-block: /);
  expect(rule(css, ".app-tab[data-label]::after")).toMatch(
    /content: attr\(data-label\);[^}]*visibility: hidden;[^}]*font-weight: 600;/,
  );
  expect(css).toMatch(/\n\.app-tablist--pill \.app-tab\[aria-selected="true"\],\n\.app-tablist--pill \.app-tab\[aria-pressed="true"\] \{/);
  expect(read("theme.css")).toMatch(/:root \{[^}]*--app-control-line-height: /);
});

test("under forced colours, disabled, selected and live states keep a system colour rather than vanishing into CanvasText", () => {
  const forced = forcedColours(read("kit.css"));
  const selected = ':is([aria-selected="true"], [aria-pressed="true"]';
  expect(rule(forced, '.app-btn[aria-disabled="true"]')).toMatch(/color: GrayText;/);
  expect(rule(forced, ".app-field__input:disabled")).toMatch(/color: GrayText;/);
  expect(rule(forced, '.app-menu__item:is(:disabled, [aria-disabled="true"])')).toMatch(/color: GrayText;/);
  expect(rule(read("kit.css"), '.app-menu__item:is(:disabled, [aria-disabled="true"])')).toMatch(/color: var\(--app-text-muted\);/);
  expect(rule(forced, `.app-tab${selected}, [aria-current="page"])`)).toMatch(/border-color: Highlight;/);
  expect(rule(forced, `.app-tab:not([aria-selected="true"], [aria-pressed="true"], [aria-current="page"])`)).toMatch(
    /border-block-end-style: none;/,
  );
  for (const onHighlight of [
    `.app-tablist--pill .app-tab${selected})`,
    '.app-popover__option[aria-selected="true"]',
    '.app-menu__item[aria-current="page"]',
  ]) {
    expect(rule(forced, onHighlight), onHighlight).toMatch(/forced-color-adjust: none;\s*background: Highlight;\s*color: HighlightText;/);
  }
  expect(rule(forced, ".app-pulse")).toMatch(/background: CanvasText;/);
});

test("app-muted keeps the line's size inside a line of text and as a whole description or cell, after the rule that sets it small", () => {
  const css = read("kit.css");
  const small = css.indexOf("\n.app-muted {");
  const inherits = css.indexOf("\n:where(p, li, dd, td, th, label) .app-muted,\n:where(dd, td, th).app-muted {\n  font-size: inherit;");
  expect(small).toBeGreaterThanOrEqual(0);
  expect(inherits).toBeGreaterThan(small);
});

test("kit.css styles no class the components do not draw", () => {
  const css = read("kit.css");
  const sources = sourceFiles().filter((file) => file.endsWith(".tsx")).map(read).join("\n");
  const drawn = new Set([...sources.matchAll(/app-[a-z0-9_-]+[a-z0-9]/g)].map(([name]) => name));
  const styled = new Set([...css.matchAll(/\.(app-[a-z0-9_-]+)/g)].map(([, name]) => name!));
  expect([...styled].filter((name) => !drawn.has(name) && !sources.includes(name.replace(/--[a-z]+$/, "--")))).toEqual([]);
});

test("Toggle is a switch named by aria-label, styled by the kit's class", () => {
  const root = mount(() => <Toggle label="Port 2" checked onChange={() => {}} />);
  const input = root.querySelector("input")!;
  expect(input.getAttribute("role")).toBe("switch");
  expect(input.className).toBe("app-switch");
  expect(input.getAttribute("aria-label")).toBe("Port 2");
  expect(input.checked).toBe(true);
});

test("Views is a pill strip of tabs over the one panel its selection names, the first for an unknown one", () => {
  const views = [
    { id: "served", label: "Served", panel: () => "the served panel" },
    { id: "trusted", label: "Trusted", panel: () => "the trusted panel" },
  ] as const;
  expect(viewOf(views, "trusted")).toBe("trusted");
  expect(viewOf(views, "nope")).toBe("served");
  expect(viewOf(views, undefined)).toBe("served");
  const sharing = [views[0], { ...views[1], also: [{ id: "pinned", label: "Pinned" }] }];
  expect(viewOf(sharing, "pinned"), "a pill in also is selected, not the first view").toBe("pinned");

  const root = mount(() => <Views aria-label="Certificates" group="certs" views={views} selected="nope" onChange={() => {}} />);
  expect(root.querySelector("[role=tablist]")!.className).toBe("app-tablist app-tablist--pill");
  expect(root.querySelector("#tab-certs-served")!.getAttribute("aria-selected")).toBe("true");
  expect(root.textContent).toContain("the served panel");
  expect(root.textContent).not.toContain("the trusted panel");
});

test("a tab, and a TabButton labelled in words, carry the label that reserves their selected width", () => {
  const strip = mount(() => (
    <Tabs aria-label="Sections" tabs={[{ id: "a", label: "Audit trail" }]} selected="a" onChange={() => {}} />
  ));
  const tab = strip.querySelector("button")!;
  expect([tab.className, tab.dataset.label, tab.textContent]).toEqual(["app-tab", "Audit trail", "Audit trail"]);
  expect(strip.querySelector("[role=tablist]")!.className, "no variant keeps the plain strip").toBe("app-tablist");

  const button = mount(() => <TabButton selected>Errors</TabButton>).querySelector("button")!;
  expect([button.dataset.label, button.getAttribute("aria-pressed"), button.textContent]).toEqual(["Errors", "true", "Errors"]);
});

test("Tick hangs its label and hint beside a box the kit styles", () => {
  const root = mount(() => <Tick label="Accounts" hint="every password" checked onChange={() => {}} />);
  expect(root.innerHTML).toMatch(
    /^<p><label class="app-tick__label"><input type="checkbox" class="app-tick__box"[^>]*><span>Accounts<small> — every password<\/small><\/span><\/label><\/p>$/,
  );
  expect(root.querySelector("input")!.checked).toBe(true);
});

test("NothingYet shows its label under a picture a screen reader skips, and a note only when given one", () => {
  const bare = mount(() => <NothingYet label="No widgets yet" />);
  const svg = bare.querySelector("svg")!;
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.getAttribute("stroke")).toBe("currentColor");
  expect(bare.innerHTML).not.toMatch(/role="img"|aria-label/);
  expect(bare.innerHTML).toContain('<p class="app-nothing-yet__label">No widgets yet</p>');
  expect(bare.innerHTML).not.toContain("app-nothing-yet__note");

  const noted = mount(() => <NothingYet label="No widgets yet" note="Commission one to watch it." />);
  expect(noted.innerHTML).toContain('No widgets yet</p><p class="app-nothing-yet__note">Commission one to watch it.</p>');
});

test("a current MenuItem says so on the menu item itself, drawn bold as a selected option is, and another does not", () => {
  const html = mount(() => (
    <>
      <MenuItem current onSelect={() => {}}>Here</MenuItem>
      <MenuItem onSelect={() => {}}>There</MenuItem>
    </>
  )).innerHTML;
  expect(html).toMatch(/^<button [^>]*role="menuitem"[^>]*aria-current="page"[^>]*>Here<\/button><button (?![^>]*aria-current)[^>]*>There<\/button>$/);
  expect(rule(read("kit.css"), '.app-menu__item[aria-current="page"]')).toMatch(/font-weight: 600;/);
});

test("an opened Menu focuses its current item, and its first when none is current", () => {
  const cases: [current: number | undefined, focused: string][] = [[1, "Two"], [undefined, "One"]];
  for (const [current, focused] of cases) {
    const root = mount(() => (
      <Menu aria-label="Apps">
        <MenuItem current={current === 0} onSelect={() => {}}>One</MenuItem>
        <MenuItem current={current === 1} onSelect={() => {}}>Two</MenuItem>
        <MenuItem onSelect={() => {}}>Three</MenuItem>
      </Menu>
    ));
    root.querySelector<HTMLElement>(".app-menu__trigger")!.click();
    expect(document.activeElement!.textContent).toBe(focused);
  }
});

test("MenuItemUnavailable is a focusable menu item that says why it is unavailable", () => {
  const html = mount(() => <MenuItemUnavailable why="scan the card first">Set network…</MenuItemUnavailable>).innerHTML;
  expect(html).toMatch(/^<button [^>]*role="menuitem"/);
  expect(html).toMatch(/aria-disabled="true"/);
  expect(html, "a disabled button cannot take focus").not.toMatch(/ disabled[ >=]|tabindex="-1"/);
  expect(html).toMatch(/>Set network… <small>— scan the card first<\/small><\/button>$/);
});

test("MenuItemUnavailable without a why is greyed with no reason after its label", () => {
  const html = mount(() => <MenuItemUnavailable>Delete…</MenuItemUnavailable>).innerHTML;
  expect(html).toMatch(/^<button [^>]*aria-disabled="true"[^>]*>Delete…<\/button>$/);
});

test("a Notice given nothing draws nothing, and one given words draws them in its tone's live region", () => {
  for (const nothing of [undefined, null, false, true, "", [], [undefined, ""]]) {
    expect(mount(() => <Notice tone="bad">{nothing}</Notice>).innerHTML, String(nothing)).toBe("");
  }
  expect(mount(() => <Notice tone="bad">The server refused.</Notice>).innerHTML).toBe(
    '<div class="app-notice app-notice--bad" role="alert">The server refused.</div>',
  );
});

test("FeedStatus counts the age of the last event up each second, and stops when unmounted", () => {
  vi.useFakeTimers({ now: 100_000 });
  const root = mount(() => <FeedStatus live heard={97_000} />);
  expect(root.textContent).toBe("Live · 3s ago");
  vi.advanceTimersByTime(2_000);
  expect(root.textContent).toBe("Live · 5s ago");
});

test("an IconSet replaces the glyphs it names below it, keeping the outer set's others", () => {
  const root = mount(() => (
    <IconSet icons={{ more: () => "…", empty: () => <i>outer</i> }}>
      <IconSet icons={{ empty: () => <b>inner</b> }}>
        <Menu aria-label="Actions">{null}</Menu>
        <NothingYet label="Nothing" />
      </IconSet>
    </IconSet>
  ));
  expect(root.querySelector(".app-menu__trigger")!.textContent).toBe("…");
  expect(root.querySelector(".app-nothing-yet")!.innerHTML).toMatch(/^<b>inner<\/b>/);

  const plain = mount(() => <Menu aria-label="Actions">{null}</Menu>);
  expect(plain.querySelector('.app-menu__trigger > svg[viewBox="0 0 24 24"] > circle')!.namespaceURI).toBe("http://www.w3.org/2000/svg");
  expect(rule(read("kit.css"), ".app-menu__trigger > svg")).toMatch(/margin-block: calc\(\(var\(--app-control-line-height\) - 1\) \* 0\.5em\);/);
});

test("a Menu given chevron draws IconSet's chevron after its face, out of its name, and one without draws none", () => {
  const trigger = (root: HTMLElement) => root.querySelector<HTMLElement>(".app-menu__trigger")!;
  const plain = trigger(mount(() => <Menu aria-label="admin, Admin, account" trigger="admin">{null}</Menu>));
  const marked = trigger(mount(() => <Menu aria-label="admin, Admin, account" trigger="admin" chevron>{null}</Menu>));
  expect(plain.querySelector(".app-menu__chevron")).toBeNull();
  expect(marked.getAttribute("aria-label")).toBe(plain.getAttribute("aria-label"));
  expect(marked.innerHTML).toMatch(/^admin<span class="app-menu__chevron" aria-hidden="true"><svg [^>]*viewBox="0 0 24 24"/);
  expect(rule(read("kit.css"), '.app-menu__trigger[aria-expanded="true"] .app-menu__chevron')).toMatch(/rotate: 180deg;/);

  const own = trigger(mount(() => (
    <IconSet icons={{ chevron: () => "▾" }}>
      <Menu aria-label="Actions" chevron>{null}</Menu>
    </IconSet>
  )));
  expect(own.querySelector(".app-menu__chevron")!.textContent).toBe("▾");
});

test("buttons and fields take their padding and font size from the density tokens, which default to today's 37.2px", () => {
  const css = read("kit.css");
  const theme = read("theme.css");
  expect(rule(css, ".app-btn")).toMatch(
    /font-size: var\(--app-control-text\);[^}]*padding: var\(--app-control-pad-y\) calc\(var\(--app-control-pad-x\) \+ 0\.25rem\);/,
  );
  expect(rule(css, ".app-btn--icon")).toMatch(/padding: var\(--app-control-pad-y\);/);
  expect(rule(css, ".app-field__input")).toMatch(
    /font-size: var\(--app-control-text\);[^}]*padding: var\(--app-control-pad-y\) var\(--app-control-pad-x\);/,
  );

  const token = (name: string) => theme.match(new RegExp(`\\n  --app-${name}: ([^;]+);`))![1];
  expect([token("control-pad-y"), token("control-pad-x"), token("control-text")]).toEqual(["0.5rem", "0.65rem", "1em"]);
  const rem = (value: string) => Number(value.replace(/r?em$/, "")) * 16;
  const height = rem(token("control-text")!) * Number(token("control-line-height")) + 2 * rem(token("control-pad-y")!) + 2;
  expect(height).toBeCloseTo(37.2);
});

test("a disabled primary button's text reads its own token, the accent's contrast by default", () => {
  const disabled = rule(read("kit.css"), ".app-btn--primary:disabled,\n.app-btn--primary[aria-disabled=\"true\"]");
  expect(disabled).toMatch(/color: var\(--app-accent-disabled-contrast\);[^}]*background: var\(--app-accent-disabled\);/);
  expect(read("theme.css")).toMatch(/:root \{[^}]*--app-accent-disabled-contrast: var\(--app-accent-contrast\);/);
});

test("a prose TextArea is in the body font at its own height, and the default one stays monospace and tall", () => {
  const pasted = mount(() => <TextArea label="Key" />).querySelector("textarea")!;
  const prose = mount(() => <TextArea label="Notes" variant="prose" />).querySelector("textarea")!;
  expect(pasted.className).toBe("app-field__input app-field__input--multiline");
  expect(prose.className).toBe("app-field__input app-field__input--prose");
  const css = read("kit.css");
  expect(rule(css, ".app-field__input--multiline")).toMatch(/min-height: 9rem;[^}]*font-family: var\(--app-font-mono\);/);
  expect(rule(css, ".app-field__input--prose")).not.toMatch(/min-height|font-family|font-size/);
});

test("a link button is underlined text in the line's own font, with no box even on hover, and keeps the buttons' ring", () => {
  const button = mount(() => <Button tone="link">resend the code</Button>).querySelector("button")!;
  expect(button.className).toBe("app-btn app-btn--link");
  const css = read("kit.css");
  expect(rule(css, ".app-btn--link")).toMatch(
    /display: inline;\s*padding: 0;\s*border-color: transparent;\s*background: transparent;\s*font-size: inherit;\s*font-weight: inherit;\s*line-height: inherit;\s*text-decoration: underline;/,
  );
  expect(rule(css, ".app-btn--link")).not.toMatch(/color: var/);
  expect(rule(css, '.app-btn--link:hover:not(:disabled, [aria-disabled="true"])')).toMatch(
    /border-color: transparent;\s*background: transparent;/,
  );
});
