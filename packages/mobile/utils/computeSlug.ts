export function computeSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // spaces → -
    .replace(/[^a-z0-9-]/g, "") // remove anything that's not letter/number/-
    .replace(/-+/g, "-") // collapse multiple dashes
    .replace(/^-+|-+$/g, "");
}
