import { config } from '../config/index.js';
import { BadRequestError } from '../errors/app.error.js';

const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
]);

const PRIVATE_IP_PREFIXES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

/**
 * Validates and normalizes target URL to prevent SSRF and security exploits.
 * @param {string} rawUrl
 * @returns {string} normalized URL
 */
export function validateAndSanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new BadRequestError('URL is required and must be a non-empty string');
  }

  const trimmed = rawUrl.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestError('Invalid URL format');
  }

  // Enforce HTTP / HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Prevent loopback and metadata endpoints
  if (DISALLOWED_HOSTNAMES.has(hostname)) {
    throw new BadRequestError('URLs targeting local or metadata addresses are not permitted');
  }

  // In production, block private IP ranges
  if (config.isProduction) {
    for (const prefix of PRIVATE_IP_PREFIXES) {
      if (prefix.test(hostname)) {
        throw new BadRequestError('URLs pointing to internal private network addresses are not permitted');
      }
    }
  }

  // Prevent circular redirects pointing back to this service
  try {
    const serviceUrl = new URL(config.server.baseUrl);
    if (parsed.origin === serviceUrl.origin) {
      throw new BadRequestError('Cannot shorten a URL from this service domain');
    }
  } catch {
    // Ignore if base URL is unparseable
  }

  // Enforce max URL length (standard URL length limit)
  if (trimmed.length > 2048) {
    throw new BadRequestError('URL exceeds maximum permitted length of 2048 characters');
  }

  return parsed.toString();
}

