/**
 * GitHub URL Utilities
 *
 * Phase 1: Detect and parse GitHub repository URLs (github.com only).
 * Supported formats:
 *  - HTTPS: https://github.com/owner/repo(.git)
 *  - SSH scp-like: git@github.com:owner/repo(.git)
 *  - SSH URL: ssh://git@github.com/owner/repo(.git)
 *  - git+ssh URL: git+ssh://git@github.com/owner/repo(.git)
 *
 * Notes:
 *  - Only URLs are supported in Phase 1 (no "owner/repo" shorthand).
 *  - Enterprise hosts are out of scope (strictly github.com).
 *  - No side effects; pure functions; no external dependencies.
 */

const GITHUB_HOST = 'github.com';

// Patterns for supported URL formats (Phase 1)
const HTTPS_RE = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[\/?#].*)?$/i;
const SCP_LIKE_RE = /^git@github\.com:([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[\/?#].*)?$/i;
const SSH_URL_RE = /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[\/?#].*)?$/i;
const GIT_PLUS_SSH_RE = /^git\+ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[\/?#].*)?$/i;

// Internal: create a standardized result object
const createResult = ({
  isGitHub = false,
  owner = null,
  repo = null,
  host = null,
  type = null,
  normalizedUrl = null,
  error = null
} = {}) => ({
  isGitHub,
  owner,
  repo,
  host,
  type,
  normalizedUrl,
  error
});

// Internal: sanitize strings (trim and remove surrounding slashes)
const clean = (s) => (typeof s === 'string' ? s.trim().replace(/^\/+|\/+$/g, '') : '');

// Validation patterns (approximate GitHub constraints)
const OWNER_ALLOWED_RE = /^[A-Za-z0-9-]{1,39}$/;
const REPO_ALLOWED_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Check if a string is a valid GitHub owner (user/org) name.
 * Constraints (approximate):
 *  - 1..39 chars, alphanumeric or hyphen
 *  - cannot start or end with hyphen
 *
 * @param {string} owner - Candidate owner string
 * @returns {boolean} True if owner is valid
 * @example
 * isValidOwner('octocat') // true
 * isValidOwner('-bad') // false
 */
export const isValidOwner = (owner) => {
  const o = clean(owner);
  if (!OWNER_ALLOWED_RE.test(o)) return false;
  if (o.startsWith('-') || o.endsWith('-')) return false;
  return true;
};

/**
 * Check if a string is a valid GitHub repository name.
 * Constraints (approximate):
 *  - 1..100 chars
 *  - allowed: letters, numbers, dot, underscore, hyphen
 *
 * @param {string} repo - Candidate repository name
 * @returns {boolean} True if repo is valid
 * @example
 * isValidRepo('Hello-World') // true
 * isValidRepo('bad/name') // false
 */
export const isValidRepo = (repo) => {
  let r = clean(repo);
  // Strip .git for validation only
  r = r.replace(/\.git$/i, '');
  return REPO_ALLOWED_RE.test(r);
};

/**
 * Normalize owner and repo by trimming, removing extra slashes,
 * and stripping a trailing ".git" from repo if present.
 * Preserves original casing.
 *
 * @param {string} owner - Owner string
 * @param {string} repo - Repo string
 * @returns {{ owner: string, repo: string }} Normalized parts
 * @example
 * normalizeOwnerRepo(' octocat ', ' Hello-World.git ')
 * // => { owner: 'octocat', repo: 'Hello-World' }
 */
export const normalizeOwnerRepo = (owner, repo) => {
  const o = clean(owner);
  let r = clean(repo).replace(/\.git$/i, '');
  return { owner: o, repo: r };
};

// Internal: core parsing routine
const parseCore = (input) => {
  if (typeof input !== 'string') {
    return createResult({ error: 'Input must be a string' });
  }
  const raw = input.trim();
  if (!raw) {
    return createResult({ error: 'Input is empty' });
  }

  let m;
  if ((m = raw.match(GIT_PLUS_SSH_RE))) {
    const { owner, repo } = normalizeOwnerRepo(m[1], m[2]);
    const host = GITHUB_HOST;
    const type = 'git+ssh';
    if (!isValidOwner(owner)) {
      return createResult({ host, type, error: 'Invalid owner segment' });
    }
    if (!isValidRepo(repo)) {
      return createResult({ host, type, error: 'Invalid repo segment' });
    }
    const normalizedUrl = `https://${host}/${owner}/${repo}`;
    return createResult({ isGitHub: true, owner, repo, host, type, normalizedUrl });
  }

  if ((m = raw.match(SSH_URL_RE))) {
    const { owner, repo } = normalizeOwnerRepo(m[1], m[2]);
    const host = GITHUB_HOST;
    const type = 'ssh_url';
    if (!isValidOwner(owner)) {
      return createResult({ host, type, error: 'Invalid owner segment' });
    }
    if (!isValidRepo(repo)) {
      return createResult({ host, type, error: 'Invalid repo segment' });
    }
    const normalizedUrl = `https://${host}/${owner}/${repo}`;
    return createResult({ isGitHub: true, owner, repo, host, type, normalizedUrl });
  }

  if ((m = raw.match(SCP_LIKE_RE))) {
    const { owner, repo } = normalizeOwnerRepo(m[1], m[2]);
    const host = GITHUB_HOST;
    const type = 'ssh';
    if (!isValidOwner(owner)) {
      return createResult({ host, type, error: 'Invalid owner segment' });
    }
    if (!isValidRepo(repo)) {
      return createResult({ host, type, error: 'Invalid repo segment' });
    }
    const normalizedUrl = `https://${host}/${owner}/${repo}`;
    return createResult({ isGitHub: true, owner, repo, host, type, normalizedUrl });
  }

  if ((m = raw.match(HTTPS_RE))) {
    const { owner, repo } = normalizeOwnerRepo(m[1], m[2]);
    const host = GITHUB_HOST;
    const type = 'https';
    if (!isValidOwner(owner)) {
      return createResult({ host, type, error: 'Invalid owner segment' });
    }
    if (!isValidRepo(repo)) {
      return createResult({ host, type, error: 'Invalid repo segment' });
    }
    const normalizedUrl = `https://${host}/${owner}/${repo}`;
    return createResult({ isGitHub: true, owner, repo, host, type, normalizedUrl });
  }

  // If it looks like a URL but not github.com, surface a clearer error
  try {
    const u = new URL(raw);
    if (u.host && u.host.toLowerCase() !== GITHUB_HOST) {
      return createResult({ host: u.host, error: 'Unsupported host: only github.com is supported in Phase 1' });
    }
  } catch {
    // Non-URL inputs (e.g., scp-like that did not match) fall through
  }

  return createResult({ error: 'Not a recognized GitHub repository URL (Phase 1 expects github.com URLs only)' });
};

/**
 * Determine whether the input is a GitHub repository URL (Phase 1 formats).
 *
 * Supported:
 *  - https://github.com/owner/repo(.git)
 *  - git@github.com:owner/repo(.git)
 *  - ssh://git@github.com/owner/repo(.git)
 *  - git+ssh://git@github.com/owner/repo(.git)
 *
 * @param {string} input - Candidate URL (whitespace tolerated)
 * @returns {boolean} True if input is a supported GitHub repo URL
 * @example
 * detectGitHubUrl('https://github.com/octocat/Hello-World') // true
 * detectGitHubUrl('git@github.com:octocat/Hello-World.git') // true
 * detectGitHubUrl('octocat/Hello-World') // false (Phase 1 excludes shorthand)
 */
export const detectGitHubUrl = (input) => {
  const res = parseCore(input);
  return !!res.isGitHub;
};

/**
 * Parse a GitHub repository URL and return structured details.
 * Never throws; returns a result with error field when invalid.
 *
 * @param {string} input - URL to parse (whitespace tolerated)
 * @returns {{
 *   isGitHub: boolean,
 *   owner: string|null,
 *   repo: string|null,
 *   host: string|null,
 *   type: ('https'|'ssh'|'ssh_url'|'git+ssh'|null),
 *   normalizedUrl: string|null,
 *   error: string|null
 * }}
 * @example
 * parseGitHubUrl('ssh://git@github.com/octocat/Hello-World.git')
 * // => { isGitHub: true, owner: 'octocat', repo: 'Hello-World', host: 'github.com', type: 'ssh_url', normalizedUrl: 'https://github.com/octocat/Hello-World', error: null }
 */
export const parseGitHubUrl = (input) => parseCore(input);