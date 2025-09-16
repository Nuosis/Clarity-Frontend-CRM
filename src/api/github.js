/**
 * GitHub API module
 * Minimal client for repository creation workflow.
 * Reuses dataService (axios with HMAC auth + env-aware routing).
 */

import { dataService } from '../services/dataService';

/**
 * Validate a GitHub repository URL
 * GET /github/repositories/validate?url=...
 *
 * @param {Object} params
 * @param {string} params.url - GitHub repository URL to validate
 * @returns {Promise<{ exists: boolean, owner?: string, repo?: string, private?: boolean }>}
 *
 * @example
 * const result = await validateRepositoryUrl({ url: 'https://github.com/claritybiz/app' });
 * // result: { exists: true, owner: 'claritybiz', repo: 'app', private: true }
 */
export async function validateRepositoryUrl({ url }) {
  const query = { url };
  return dataService.get('/github/repositories/validate', query);
}

/**
 * Check if a GitHub repository exists (legacy compatibility)
 * Uses validateRepositoryUrl internally with constructed URL
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @returns {Promise<{ exists: boolean, private?: boolean }>}
 *
 * @example
 * const result = await checkRepositoryExists({ owner: 'claritybiz', repo: 'app' });
 * // result: { exists: true, private: true }
 */
export async function checkRepositoryExists({ owner, repo }) {
  const url = `https://github.com/${owner}/${repo}`;
  const result = await validateRepositoryUrl({ url });
  return {
    exists: result.exists,
    private: result.private
  };
}

/**
 * Get GitHub repository metadata
 * Uses validateRepositoryUrl to get basic info (no separate metadata endpoint available)
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @returns {Promise<RepoInfo>}
 *
 * @example
 * const info = await getRepositoryInfo({ owner: 'claritybiz', repo: 'app' });
 * // info: { exists: true, owner: 'claritybiz', repo: 'app', private: true }
 */
export async function getRepositoryInfo({ owner, repo }) {
  const url = `https://github.com/${owner}/${repo}`;
  return validateRepositoryUrl({ url });
}

/**
 * Create a GitHub repository
 * POST /github/repositories
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - New repository name
 * @param {string} [params.description] - Optional description
 * @param {'public'|'private'} [params.visibility] - Repo visibility
 * @returns {Promise<RepoInfo>}
 *
 * @example
 * const repo = await createRepository({
 *   owner: 'claritybiz',
 *   repo: 'new-repo',
 *   description: 'Clarity project repo',
 *   visibility: 'private'
 * });
 */
export async function createRepository({ owner, repo, description, visibility }) {
  const body = { owner, repo };
  if (typeof description !== 'undefined') body.description = description;
  if (typeof visibility !== 'undefined') body.visibility = visibility;
  return dataService.post('/github/repositories', body);
}