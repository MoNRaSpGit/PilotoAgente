export function normalizeWebUserName(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function sanitizeWebDisplayName(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isValidWebUserName(value = '') {
  const name = sanitizeWebDisplayName(value);
  return /^[A-Za-z0-9._\-\s]{3,40}$/.test(name);
}