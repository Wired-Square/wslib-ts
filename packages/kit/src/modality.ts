// Only WebKit matches `:focus-visible` on focus moved by script; other engines' own heuristic is left alone.
if (typeof document !== "undefined" && navigator.vendor?.startsWith("Apple")) {
  const modality = (to: "keyboard" | "pointer") => document.documentElement.setAttribute("data-app-modality", to);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" && !e.metaKey && !e.ctrlKey) modality("keyboard");
    },
    true,
  );
  document.addEventListener("pointerdown", () => modality("pointer"), true);
}
