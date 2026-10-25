/** Where an arrow, Home or End moves in a list of `count`, wrapping; `undefined` for any other key. */
export function arrowTo(
  key: string,
  here: number,
  count: number,
  forward: "ArrowDown" | "ArrowRight",
): number | undefined {
  const back = forward === "ArrowDown" ? "ArrowUp" : "ArrowLeft";
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key !== forward && key !== back) return undefined;
  return (here + (key === forward ? 1 : -1) + count) % count;
}
