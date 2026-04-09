import crypto from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), KEY_LENGTH).toString('hex');
}

export function verifyPassword(password, salt, expectedHash) {
  const hashed = hashPassword(password, salt);

  const hashedBuffer = Buffer.from(hashed, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (hashedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedBuffer, expectedBuffer);
}
