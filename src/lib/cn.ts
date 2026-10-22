/** Joins truthy class names. Tokens make conflicting utilities rare, so no merge step is needed. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
