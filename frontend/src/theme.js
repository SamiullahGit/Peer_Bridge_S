// Global theme controller. Sets data-theme on <html> and persists the
// choice. Default is 'light' (preserves the existing look); users opt into
// 'dark' via the toggle. Call initTheme() once, before render.

const KEY = 'pb_theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(KEY) || 'light'; } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', saved);
}
