let sheet: CSSStyleSheet | undefined;

/**
 * Applies token values at runtime as one adopted stylesheet, replaced on each
 * call: `tokens` on `:root`, and `darkTokens` wherever `data-app-scheme` asks
 * for the dark palette. A browser without adopted stylesheets gets `tokens`
 * inline on `<html>`, and no dark set. Values are not checked, and a `url(` in
 * one is fetched, so pass only tokens the app trusts.
 */
export function applyTheme(tokens: Record<string, string>, darkTokens: Record<string, string> = {}): void {
  if (!document.adoptedStyleSheets) {
    declare(document.documentElement.style, tokens);
    return;
  }
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  // Declared one by one, so a value the parser cannot close stays in its own property.
  sheet.replaceSync(
    ':root {}\n@media (prefers-color-scheme: dark) { :root:where([data-app-scheme~="dark"]) {} }\n' +
      ':root:where([data-app-scheme="dark"]) {}',
  );
  const [light, followed, forced] = sheet.cssRules as unknown as [CSSStyleRule, CSSMediaRule, CSSStyleRule];
  declare(light.style, tokens);
  declare((followed.cssRules[0] as CSSStyleRule).style, darkTokens);
  declare(forced.style, darkTokens);
}

function declare(style: CSSStyleDeclaration, tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens)) style.setProperty(name, value);
}
