/**
 * GitHub API module
 * Minimal client for repository creation workflow.
 * Reuses dataService (axios with HMAC auth + env-aware routing).
 */

import { dataService } from '../services/dataService';

/**
 * Check if a GitHub repository exists
 * GET /api/github/repositories/check?owner=...&repo=...
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
  const query = { owner, repo };
  return dataService.get('/api/github/repositories/check', query);
}

/**
 * Get GitHub repository metadata
 * GET /api/github/repositories/info?owner=...&repo=...
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @returns {Promise<RepoInfo>}
 *
 * @example
 * const info = await getRepositoryInfo({ owner: 'claritybiz', repo: 'app' });
 * // info: { full_name: 'claritybiz/app', default_branch: 'main', ... }
 */
export async function getRepositoryInfo({ owner, repo }) {
  const query = { owner, repo };
  return dataService.get('/api/github/repositories/info', query);
}

/**
 * Create a GitHub repository
 * POST /api/github/repositories
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
  return dataService.post('/api/github/repositories', body);
}