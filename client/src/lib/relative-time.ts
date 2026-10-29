export function formatPostedAgo(value: string | null | undefined): string {
  if (!value) return "recently";

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "recently";

  const elapsedDays = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (elapsedDays === 0) return "today";
  if (elapsedDays === 1) return "1 day ago";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  if (elapsedDays < 14) return "1 week ago";
  if (elapsedDays < 30) return `${Math.floor(elapsedDays / 7)} weeks ago`;
  if (elapsedDays < 60) return "1 month ago";
  return `${Math.floor(elapsedDays / 30)} months ago`;
}
