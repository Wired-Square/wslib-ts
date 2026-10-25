export function cx(...names: (string | false | undefined | null)[]): string {
  return names.filter(Boolean).join(" ");
}
