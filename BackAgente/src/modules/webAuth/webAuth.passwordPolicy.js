const WEAK_PASSWORDS = new Set([
  '123456',
  '12345678',
  'password',
  'qwerty',
  'admin',
  'abc123',
  '111111',
  '123123'
]);

export function validateWebPassword(password, nombre = '') {
  const value = String(password || '');
  const userName = String(nombre || '').trim().toLowerCase();

  const checks = {
    minLength: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
    notCommon: !WEAK_PASSWORDS.has(value.toLowerCase()),
    notContainingName: userName.length < 3 || !value.toLowerCase().includes(userName)
  };

  const isValid = Object.values(checks).every(Boolean);

  return {
    isValid,
    checks
  };
}
