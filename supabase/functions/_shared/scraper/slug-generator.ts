export function generateSlug(title: string, venueSlug: string): string {
  const base = `${title}-${venueSlug}`
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
  return base;
}
