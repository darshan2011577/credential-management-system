import { AUDIT_CONFIG } from '@credential-manager/config';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /bearer/i,
  /auth.*tag/i,
  /ciphertext/i,
  /encryption.*key/i,
  /private.*key/i,
  /public.*key/i,
  /hash/i,
  /salt/i,
  /iv$/i,
  /cookie/i,
  /authorization/i,
  /smtp.*pass/i,
  /redis.*pass/i,
  /mongodb.*uri/i,
];

/**
 * Checks whether a property key matches any known prohibited sensitive keywords.
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.toLowerCase().replace(/[-_]/g, '');

  // Exact match against prohibited list
  if (AUDIT_CONFIG.prohibitedMetadataKeys.some((prohibited) => normalized.includes(prohibited.replace(/[-_]/g, '')))) {
    return true;
  }

  // Regex pattern matching
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively scrubs and sanitizes audit metadata.
 * Prohibited keys and secrets are replaced with "[REDACTED]".
 * Deep recursion is capped at maxDepth (6) to prevent circular references.
 */
export function sanitizeAuditMetadata(
  input: unknown,
  depth: number = 0
): Record<string, unknown> | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }

  if (typeof input !== 'object' || depth > 6) {
    return undefined;
  }

  if (Array.isArray(input)) {
    return {
      items: input.slice(0, 50).map((item) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeAuditMetadata(item, depth + 1);
        }
        if (typeof item === 'string') {
          return item.length > 200 ? `${item.substring(0, 200)}...` : item;
        }
        return item;
      }),
    };
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(input as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED_SECRET]';
      continue;
    }

    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string') {
      // Sanitize string length
      result[key] = value.length > 1000 ? `${value.substring(0, 1000)}...` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'object') {
      result[key] = sanitizeAuditMetadata(value, depth + 1);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
