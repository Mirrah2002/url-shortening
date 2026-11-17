import { randomInt } from 'node:crypto';

const BASE62_CHARACTERS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const RESERVED_SHORT_CODES = new Set([
  'api',
  'health',
  'metrics',
  'ready',
  'status',
  'admin',
  'docs',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

const SHORT_CODE_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Generates a random Base62 short code of specified length.
 * @param {number} length
 * @returns {string}
 */
export function generateBase62(length = 7) {
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = randomInt(BASE62_CHARACTERS.length);
    code += BASE62_CHARACTERS[randomIndex];
  }
  return code;
}

/**
 * Validates format of custom short code and ensures it is not reserved.
 * @param {string} code
 * @returns {boolean}
 */
export function isValidCustomCode(code) {
  if (typeof code !== 'string') return false;
  if (!SHORT_CODE_REGEX.test(code)) return false;
  if (RESERVED_SHORT_CODES.has(code.toLowerCase())) return false;
  return true;
}
