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
 * @param {string} params.name - Repository name (backend expects 'name' not 'repo')
 * @param {string} [params.description] - Optional description
 * @param {boolean} [params.private=true] - Whether repository is private
 * @param {string} [params.template] - Template repository (owner/repo format)
 * @returns {Promise<RepoInfo>}
 *
 * @example
 * const repo = await createRepository({
 *   name: 'new-repo',
 *   description: 'Clarity project repo',
 *   private: true
 * });
 */
export async function createRepository({ name, description, private: isPrivate, template }) {
  const body = { name };
  if (typeof description !== 'undefined') body.description = description;
  if (typeof isPrivate !== 'undefined') body.private = isPrivate;
  if (typeof template !== 'undefined') body.template = template;
  return dataService.post('/github/repositories', body);
}

/**
 * Create a GitHub repository from the Clarity template
 * @param {Object} params
 * @param {string} params.name - Repository name
 * @param {string} [params.description] - Optional description
 * @param {boolean} [params.private=true] - Whether repository is private
 * @returns {Promise<RepoInfo>}
 *
 * @example
 * const repo = await createRepositoryFromTemplate({
 *   name: 'customer_project',
 *   description: 'Project repository for customer',
 *   private: true
 * });
 */
export async function createRepositoryFromTemplate({ name, description, private: isPrivate = true }) {
  return createRepository({
    name,
    description,
    private: isPrivate,
    template: 'Nuosis/clarity-repo-template'
  });
}

/**
 * Get repository contents (files and directories)
 * GET /github/repositories/{owner}/{repo}/contents/{path}
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} [params.path=''] - Path within repository (empty for root)
 * @param {string} [params.ref] - Branch, tag, or commit SHA (defaults to default branch)
 * @returns {Promise<Array|Object>} Array of files/directories or single file content
 *
 * @example
 * // List root directory contents
 * const contents = await getRepositoryContents({ owner: 'claritybiz', repo: 'app' });
 *
 * // List specific directory contents
 * const docs = await getRepositoryContents({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'ai_docs/context'
 * });
 *
 * // Get specific file content
 * const file = await getRepositoryContents({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'ai_docs/context/add.md'
 * });
 */
export async function getRepositoryContents({ owner, repo, path = '', ref }) {
  const query = {};
  if (ref) query.ref = ref;
  
  const encodedPath = path ? encodeURIComponent(path) : '';
  const endpoint = `/github/repositories/${owner}/${repo}/contents/${encodedPath}`;
  
  return dataService.get(endpoint, query);
}

/**
 * Get file content from repository
 * Convenience wrapper around getRepositoryContents for single files
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path within repository
 * @param {string} [params.ref] - Branch, tag, or commit SHA (defaults to default branch)
 * @returns {Promise<Object>} File content object with decoded content
 *
 * @example
 * const fileContent = await getFileContent({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'ai_docs/context/add.md'
 * });
 * // fileContent: { name: 'add.md', content: '# Add Documentation...', ... }
 */
export async function getFileContent({ owner, repo, path, ref }) {
  return getRepositoryContents({ owner, repo, path, ref });
}

/**
 * Create a new file in repository
 * POST /github/repositories/{owner}/{repo}/contents/{path}
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to create
 * @param {string} params.content - File content (will be base64 encoded)
 * @param {string} params.message - Commit message
 * @param {string} [params.branch] - Branch to create file in (defaults to default branch)
 * @returns {Promise<Object>} File operation response
 *
 * @example
 * const result = await createFile({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'docs/new-file.md',
 *   content: '# New File\n\nContent here',
 *   message: 'Add new documentation file'
 * });
 */
export async function createFile({ owner, repo, path, content, message, branch }) {
  const body = { content, message };
  if (branch) body.branch = branch;
  
  const encodedPath = encodeURIComponent(path);
  const endpoint = `/github/repositories/${owner}/${repo}/contents/${encodedPath}`;
  
  return dataService.post(endpoint, body);
}

/**
 * Update an existing file in repository
 * PUT /github/repositories/{owner}/{repo}/contents/{path}
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to update
 * @param {string} params.content - New file content (will be base64 encoded)
 * @param {string} params.message - Commit message
 * @param {string} params.sha - Current file SHA (required for updates)
 * @param {string} [params.branch] - Branch to update file in (defaults to default branch)
 * @returns {Promise<Object>} File operation response
 *
 * @example
 * const result = await updateFile({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'docs/existing-file.md',
 *   content: '# Updated File\n\nNew content here',
 *   message: 'Update documentation file',
 *   sha: 'abc123def456...'
 * });
 */
export async function updateFile({ owner, repo, path, content, message, sha, branch }) {
  const body = { content, message, sha };
  if (branch) body.branch = branch;
  
  const encodedPath = encodeURIComponent(path);
  const endpoint = `/github/repositories/${owner}/${repo}/contents/${encodedPath}`;
  
  return dataService.put(endpoint, body);
}

/**
 * Delete a file from repository
 * DELETE /github/repositories/{owner}/{repo}/contents/{path}
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to delete
 * @param {string} params.message - Commit message
 * @param {string} params.sha - Current file SHA (required for deletion)
 * @param {string} [params.branch] - Branch to delete file from (defaults to default branch)
 * @returns {Promise<Object>} File operation response
 *
 * @example
 * const result = await deleteFile({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'docs/old-file.md',
 *   message: 'Remove outdated documentation',
 *   sha: 'abc123def456...'
 * });
 */
export async function deleteFile({ owner, repo, path, message, sha, branch }) {
  const body = { message, sha };
  if (branch) body.branch = branch;
  
  const encodedPath = encodeURIComponent(path);
  const endpoint = `/github/repositories/${owner}/${repo}/contents/${encodedPath}`;
  
  return dataService.delete(endpoint, body);
}

/**
 * Create a new folder by creating a placeholder file
 * Folders in Git are created implicitly when files are added to them
 *
 * @param {Object} params
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - Folder path to create
 * @param {string} [params.message] - Commit message
 * @param {string} [params.branch] - Branch to create folder in (defaults to default branch)
 * @returns {Promise<Object>} File operation response
 *
 * @example
 * const result = await createFolder({
 *   owner: 'claritybiz',
 *   repo: 'app',
 *   path: 'docs/new-section',
 *   message: 'Create new documentation section'
 * });
 */
export async function createFolder({ owner, repo, path, message = 'Create folder', branch }) {
  // Create a .gitkeep file to establish the folder
  const gitkeepPath = `${path}/.gitkeep`;
  const content = '# This file keeps the folder in Git\n# You can delete this file once you add other files to this folder';
  
  return createFile({
    owner,
    repo,
    path: gitkeepPath,
    content,
    message,
    branch
  });
}

/**
 * Legacy compatibility function - converts old API to new format
 * @deprecated Use createRepository or createRepositoryFromTemplate instead
 */
export async function createRepositoryLegacy({ owner, repo, description, visibility }) {
  const isPrivate = visibility === 'private';
  return createRepository({
    name: repo,
    description,
    private: isPrivate
  });
}