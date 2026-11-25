export const MAX_VAULT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_VAULT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'mp3', 'mp4'] as const;

export const ALLOWED_VAULT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'audio/mpeg',
  'audio/mp3',
  'video/mp4',
]);

/**
 * Sanitize plain-text user inputs (chat messages, folder titles, profile names, notes)
 * to neutralize XSS payloads, HTML tags, script protocols, and control characters.
 */
export function sanitizeUserText(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    // Remove null bytes & non-printable ASCII control chars except newline/tab
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Strip script/style blocks completely
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Strip remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Neutralize javascript:/vbscript:/data: pseudo-protocols
    .replace(/\b(?:javascript|vbscript|data)\s*:/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize uploaded file names to remove path traversal, HTML/script chars, and unsafe symbols.
 */
export function sanitizeFileName(rawName: string): string {
  const base = rawName.split(/[\\/]/).pop() || 'file';
  const cleaned = base
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120);
  return cleaned || 'study_file';
}

/**
 * Validate a file before uploading to Supabase Storage bucket `nexlive-vault`.
 * Enforces allowed types (pdf, jpg/jpeg, png, mp3, mp4) and 50MB max size client-side.
 * Single-interface shape (not a discriminated union) so `tsc --noEmit` passes
 * even without `strictNullChecks`, and fresh clones lint clean.
 */
export interface VaultCheck {
  valid: boolean;
  safeName: string;
  ext: string;
  error: string;
}

export function validateVaultFile(file: {
  name: string;
  size: number;
  type: string;
}): VaultCheck {
  const safeName = sanitizeFileName(file.name);
  const parts = safeName.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';

  if (!(ALLOWED_VAULT_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      valid: false,
      safeName,
      ext,
      error: `Unsupported file type ".${ext || 'unknown'}". Allowed formats: PDF, JPG, PNG, MP3, MP4 only.`,
    };
  }

  const normalizedMime = (file.type || '').toLowerCase().trim();
  if (normalizedMime && !ALLOWED_VAULT_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      safeName,
      ext,
      error: `Blocked MIME type "${normalizedMime}". Only PDF, JPG, PNG, MP3, and MP4 files are permitted.`,
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, safeName, ext, error: 'File appears to be empty.' };
  }

  if (file.size > MAX_VAULT_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      safeName,
      ext,
      error: `File is ${mb} MB, which exceeds the strict 50 MB upload limit for nexlive-vault.`,
    };
  }

  return { valid: true, safeName, ext, error: '' };
}

/**
 * Strict HTTPS-only URL sanitizer for external storage/resource links.
 */
export function sanitizeHttpsUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Enforce PWA registration only on HTTPS (or localhost during local dev).
 */
export function isSecurePwaContext(protocol: string, hostname: string): boolean {
  if (protocol === 'https:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return false;
}
