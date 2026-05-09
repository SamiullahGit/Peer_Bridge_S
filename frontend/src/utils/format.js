// Misc formatters reused across pages.

export function tagTone(tag) {
  if (tag === 'Academic Help')        return 'blush';
  if (tag === 'Career & Internships') return 'lav';
  if (tag === 'Resources')            return 'mint';
  if (tag === 'Events & Societies')   return 'peach';
  return 'lav';
}

export function tagPalette(tag) {
  const map = {
    'Academic Help'        : ['#FEF3C7', '#92400E'],
    'Career & Internships' : ['#EDE9FE', '#5B21B6'],
    'Resources'            : ['#D1FAE5', '#065F46'],
    'Events & Societies'   : ['#FFE4CC', '#9A3412'],
  };
  return map[tag] || ['#F3F4F6', '#374151'];
}

// URL -> <a> string. Used inside dangerouslySetInnerHTML for post bodies.
export function linkifyHTML(text) {
  if (!text) return '';
  return text.replace(/(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer" style="color:var(--blue);text-decoration:underline">$1</a>');
}

export function formatFileSize(bytes) {
  if (!bytes)               return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
