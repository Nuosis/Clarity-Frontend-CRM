/**
 * Environment helpers to safely access Vite env in Jest/Node.
 * Uses eval to avoid static parsing of import.meta in non-ESM contexts.
 */

export function getViteEnv(key, defaultValue = undefined) {
  try {
    const vite = (0, eval)('import.meta');
    const val = vite?.env?.[key];
    return val ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined) ?? defaultValue;
  } catch {
    return (typeof process !== 'undefined' ? process.env?.[key] : undefined) ?? defaultValue;
  }
}

export function isTestEnv() {
  try {
    const vite = (0, eval)('import.meta');
    const mode = vite?.env?.MODE || vite?.env?.NODE_ENV;
    if (mode) return mode === 'test';
  } catch {
    // ignore
  }
  if (typeof process !== 'undefined') {
    if (process.env?.NODE_ENV === 'test') return true;
    if (process.env?.JEST_WORKER_ID != null) return true;
  }
  return false;
}

export function getViteEnvObject() {
  try {
    const vite = (0, eval)('import.meta');
    return vite?.env ?? {};
  } catch {
    return typeof process !== 'undefined' ? (process.env ?? {}) : {};
  }
}