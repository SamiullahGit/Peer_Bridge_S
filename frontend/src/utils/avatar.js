// Deterministic avatar palette + initials helper.

const PALETTES = [
  ['#fde8f0', '#f5b8ce'],
  ['#c7d9ff', '#8ea8e8'],
  ['#d4f1e3', '#7fc9a4'],
  ['#ffe4cc', '#e8a76f'],
  ['#e9d7fb', '#b48de0'],
  ['#fff4b8', '#e6c84d'],
];

function strHash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name = '?') {
  const parts = name.split(' ');
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function avatarColors(name = '?') {
  return PALETTES[strHash(name) % PALETTES.length];
}
