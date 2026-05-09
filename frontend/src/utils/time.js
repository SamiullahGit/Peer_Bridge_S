// Tiny "X minutes ago" formatter, identical to the one used across
// the vanilla pages.

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const sec = Math.floor((Date.now() - d) / 1000);

  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
