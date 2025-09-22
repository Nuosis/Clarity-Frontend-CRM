import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { createRepositoryFromTemplate, validateRepositoryUrl } from '../../api/github';
import { createLink } from '../../api/links';
import { parseGitHubUrl } from '../../utils/githubUtils';
import { fetchRepositoryContents, clearContentsError, fetchFileContent } from '../../store/slices/documentationSlice';
import DocumentationFileList from './DocumentationFileList';
import DocumentationViewer from './DocumentationViewer';
import FileEditModal from './FileEditModal';
import FolderCreateModal from './FolderCreateModal';
import FileCreateModal from './FileCreateModal';

/**
 * Project Documents Tab component - handles project documentation and GitHub repository
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Object} props.localProject - Local project state
 * @param {Function} props.setLocalProject - Local project state setter
 */
function ProjectDocumentsTab({ project, darkMode, localProject, setLocalProject }) {
  const dispatch = useDispatch();
  const [githubCreating, setGithubCreating] = useState(false);
  const [githubError, setGithubError] = useState(null);
  const [githubRepo, setGithubRepo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Modal state management
  const [showFileEditModal, setShowFileEditModal] = useState(false);
  const [showFolderCreateModal, setShowFolderCreateModal] = useState(false);
  const [showFileCreateModal, setShowFileCreateModal] = useState(false);

  // Redux state for documentation
  const {
    contents: repositoryContents,
    currentFile,
    loading: documentationLoading,
    error: documentationError,
    fileOperationLoading,
    fileOperationError,
    lastOperation
  } = useSelector(state => state.documentation);

  // Check if there's already a GitHub link in the project
  const existingGitHubLink = useMemo(() => {
    const links = (localProject?.links || project?.links) || [];
    return links.find(link => {
      const parsed = parseGitHubUrl(link.url);
      return parsed?.isGitHub;
    });
  }, [localProject?.links, project?.links]);

  // Extract repository info from GitHub link
  const repositoryInfo = useMemo(() => {
    const repoUrl = githubRepo?.url || existingGitHubLink?.url;
    if (!repoUrl) return null;
    
    const parsed = parseGitHubUrl(repoUrl);
    return parsed?.isGitHub ? { owner: parsed.owner, repo: parsed.repo } : null;
  }, [githubRepo?.url, existingGitHubLink?.url]);

  // Callback handlers for documentation components
  const handleLoadDocumentation = useCallback(() => {
    if (repositoryInfo) {
      dispatch(fetchRepositoryContents({
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        path: 'ai_docs/context'
      }));
    }
  }, [dispatch, repositoryInfo]);

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
  }, []);

  const handleClearError = useCallback(() => {
    dispatch(clearContentsError());
  }, [dispatch]);

  // Modal handlers
  const handleOpenFileEditModal = useCallback(() => {
    if (selectedFile && repositoryInfo) {
      // Fetch file content before opening modal
      dispatch(fetchFileContent({
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        path: selectedFile.path,
        ref: 'main'
      }));
      setShowFileEditModal(true);
    }
  }, [selectedFile, repositoryInfo, dispatch]);

  const handleCloseFileEditModal = useCallback(() => {
    setShowFileEditModal(false);
  }, []);

  const handleOpenFolderCreateModal = useCallback(() => {
    console.log('handleOpenFolderCreateModal called');
    console.log('repositoryInfo:', repositoryInfo);
    console.log('Current showFolderCreateModal state:', showFolderCreateModal);
    setShowFolderCreateModal(true);
    console.log('After setState - showFolderCreateModal should be true');
  }, [repositoryInfo, showFolderCreateModal]);

  const handleCloseFolderCreateModal = useCallback(() => {
    setShowFolderCreateModal(false);
  }, []);

  const handleOpenFileCreateModal = useCallback(() => {
    setShowFileCreateModal(true);
  }, []);

  const handleCloseFileCreateModal = useCallback(() => {
    setShowFileCreateModal(false);
  }, []);

  // Success handlers for modal operations
  const handleFileOperationSuccess = useCallback(() => {
    // Refresh the repository contents after successful operation
    if (repositoryInfo) {
      dispatch(fetchRepositoryContents({
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        path: 'ai_docs/context'
      }));
    }
  }, [repositoryInfo, dispatch]);

  const handleCreateGitHubRepo = useCallback(async () => {
    setGithubCreating(true);
    setGithubError(null);

    try {
      // Extract customer name from various possible locations in the data structure
      let customerName = 'customer';
      
      if (project.fieldData && project.fieldData.Customers__Name) {
        customerName = project.fieldData.Customers__Name;
      } else if (project.Customers__Name) {
        customerName = project.Customers__Name;
      } else if (project.fieldData && project.fieldData['Customers::Name']) {
        customerName = project.fieldData['Customers::Name'];
      } else if (project['Customers::Name']) {
        customerName = project['Customers::Name'];
      } else if (project.customer?.name) {
        customerName = project.customer.name;
      } else if (project.customerName) {
        customerName = project.customerName;
      }

      // Extract project name - use projectName field which is standard across the codebase
      const projectName = project.projectName || project.title || project.name || `project_${project.id || Date.now()}`;
      
      // Generate repository name following the expected pattern: {customer}_{project}
      const repoName = `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      console.log('[GitHub Repo Creation] Starting process:', {
        customerName,
        projectName,
        repoName,
        projectData: {
          id: project.id,
          projectName: project.projectName,
          customerFields: {
            'Customers::Name': project['Customers::Name'],
            'fieldData.Customers::Name': project.fieldData?.['Customers::Name'],
            'Customers__Name': project.Customers__Name,
            'fieldData.Customers__Name': project.fieldData?.Customers__Name,
            'customer.name': project.customer?.name,
            'customerName': project.customerName
          }
        }
      });
      
      // First, check if repository already exists
      const repoUrl = `https://github.com/Nuosis/${repoName}`;
      console.log('[GitHub Repo Creation] Checking if repository exists:', { repoUrl });
      
      const validationResult = await validateRepositoryUrl({ url: repoUrl });
      console.log('[GitHub Repo Creation] Repository validation result:', {
        result: validationResult,
        exists: validationResult?.exists,
        owner: validationResult?.owner,
        repo: validationResult?.repo
      });
      
      let repoResult;
      
      if (validationResult?.exists === true) {
        console.log('[GitHub Repo Creation] Repository already exists, skipping creation');
        // Repository exists, construct result object to match creation response format
        repoResult = {
          url: repoUrl,
          html_url: repoUrl,
          name: repoName,
          full_name: `Nuosis/${repoName}`,
          owner: validationResult.owner || 'Nuosis',
          repo: validationResult.repo || repoName,
          private: validationResult.private || true
        };
      } else {
        console.log('[GitHub Repo Creation] Repository does not exist (exists=false), creating new repository');
        // Create repository from template
        console.log('[GitHub Repo Creation] Calling createRepositoryFromTemplate with params:', {
          name: repoName,
          description: `Development repository for ${customerName} - ${projectName}`,
          private: true
        });
        
        repoResult = await createRepositoryFromTemplate({
          name: repoName,
          description: `Development repository for ${customerName} - ${projectName}`,
          private: true
        });
      }

      console.log('[GitHub Repo Creation] Repository creation result:', {
        result: repoResult,
        resultType: typeof repoResult,
        hasSuccess: 'success' in repoResult,
        hasData: 'data' in repoResult,
        hasError: 'error' in repoResult,
        keys: Object.keys(repoResult || {})
      });

      // Handle both GitHub API format (html_url, full_name) and backend API format (url, owner, repo)
      const hasGitHubFormat = repoResult && (repoResult.html_url || repoResult.full_name);
      const hasBackendFormat = repoResult && repoResult.url && (repoResult.owner || repoResult.repo);
      
      if (hasGitHubFormat || hasBackendFormat) {
        const repoUrl = repoResult.html_url || repoResult.url;
        const repoName = repoResult.full_name || (repoResult.owner && repoResult.repo ? `${repoResult.owner}/${repoResult.repo}` : repoResult.name);
        
        console.log('[GitHub Repo Creation] Repository created successfully:', {
          url: repoUrl,
          name: repoName,
          format: hasGitHubFormat ? 'GitHub API' : 'Backend API',
          originalResponse: repoResult
        });
        
        // Create project link with only supported parameters (_fkID and link)
        console.log('[GitHub Repo Creation] Creating project link with params:', {
          project_id: project.id,
          url: repoUrl
        });
        
        const linkResult = await createLink({
          project_id: project.id,
          url: repoUrl
        });

        console.log('[GitHub Repo Creation] Link creation result:', {
          result: linkResult,
          resultType: typeof linkResult,
          hasSuccess: 'success' in linkResult,
          hasData: 'data' in linkResult,
          hasError: 'error' in linkResult,
          keys: Object.keys(linkResult || {})
        });

        if (linkResult && linkResult.success) {
          console.log('[GitHub Repo Creation] Project link created successfully');
        } else {
          console.warn('[GitHub Repo Creation] Repository created but failed to add project link:', {
            linkResult,
            error: linkResult?.error || 'Unknown link creation error'
          });
        }
        
        // Update GitHub repo state
        setGithubRepo({
          url: repoUrl,
          name: repoResult.repo || repoResult.name,
          full_name: repoName
        });
        
        console.log('[GitHub Repo Creation] GitHub repo state updated');
      } else {
        console.error('[GitHub Repo Creation] Repository creation failed or returned unexpected format:', {
          repoResult,
          expectedFields: ['html_url + full_name', 'url + owner/repo'],
          actualFields: Object.keys(repoResult || {})
        });
        
        // Check if it's an error response
        if (repoResult && repoResult.error) {
          throw new Error(repoResult.error);
        } else if (repoResult && repoResult.message) {
          throw new Error(repoResult.message);
        } else {
          throw new Error('Repository creation returned unexpected response format');
        }
      }
    } catch (err) {
      console.error('[GitHub Repo Creation] Error occurred:', {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        errorName: err.name,
        errorType: typeof err
      });
      
      const errorMessage = err.message || 'Failed to create GitHub repository';
      setGithubError(`Error creating GitHub repository: ${errorMessage}`);
    } finally {
      setGithubCreating(false);
      console.log('[GitHub Repo Creation] Process completed');
    }
  }, [project]);

  // Debug logging
  console.log('ProjectDocumentsTab render:', {
    repositoryInfo,
    showFolderCreateModal,
    showFileCreateModal,
    showFileEditModal,
    existingGitHubLink: existingGitHubLink?.url,
    githubRepo: githubRepo?.url,
    // Additional debugging for repositoryInfo calculation
    githubRepoUrl: githubRepo?.url,
    existingGitHubLinkUrl: existingGitHubLink?.url,
    repoUrl: githubRepo?.url || existingGitHubLink?.url,
    projectLinks: (localProject?.links || project?.links) || [],
    allLinks: project?.links,
    localProjectLinks: localProject?.links
  });

  return (
    <div className="space-y-6">
      {/* GitHub Integration Section */}
      <div>
        <h4 className="text-md font-medium mb-4">GitHub Repository</h4>
        
        {githubRepo || existingGitHubLink ? (
          /* GitHub Linked State */
          <div className={`
            p-4 border rounded-lg
            ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-green-50 border-green-200'}
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`
                  w-3 h-3 rounded-full mr-3
                  ${darkMode ? 'bg-green-400' : 'bg-green-500'}
                `}></div>
                <div>
                  <p className="font-medium text-green-700">GitHub Repository Linked</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {githubRepo?.name || existingGitHubLink?.title || new URL(existingGitHubLink?.url || '').pathname.split('/').pop()}
                  </p>
                </div>
              </div>
              <a
                href={githubRepo?.url || existingGitHubLink?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                View Repository
              </a>
            </div>
          </div>
        ) : (
          /* GitHub Creation State - only show if no existing GitHub link */
          <div className={`
            p-4 border rounded-lg
            ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
          `}>
            <div className="text-center">
              <p className={`mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Create a GitHub repository for this project to enable development team collaboration.
              </p>
              
              {githubError && (
                <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                  {githubError}
                </div>
              )}
              
              <button
                onClick={handleCreateGitHubRepo}
                disabled={githubCreating}
                className={`
                  px-4 py-2 rounded-md text-white font-medium
                  ${githubCreating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                  }
                `}
              >
                {githubCreating ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Repository...
                  </span>
                ) : (
                  'Create GitHub Repository'
                )}
              </button>
              
              <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Repository will be created from template: Nuosis/clarity-repo-template
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Project Documentation Section */}
      <div>
        <h4 className="text-md font-medium mb-4">Project Documentation</h4>
        
        {repositoryInfo ? (
          <div className="flex gap-6">
            {/* File Browser - Sidebar Style */}
            <div className={`
              border rounded-lg flex-shrink-0 w-64
              ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
            `}>
              <div className={`
                px-4 py-3 border-b flex items-center justify-between
                ${darkMode ? 'border-gray-600 bg-gray-750' : 'border-gray-200 bg-gray-50'}
              `}>
                <div></div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenFolderCreateModal();
                    }}
                    className={`
                      px-2 py-1 text-sm rounded flex items-center gap-1
                      bg-blue-500 text-white hover:bg-blue-600 cursor-pointer
                    `}
                    title="New Folder"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      <line x1="12" y1="11" x2="12" y2="17"></line>
                      <line x1="9" y1="14" x2="15" y2="14"></line>
                    </svg>
                    <span className="sr-only">New Folder</span>
                  </button>
                  <button
                    onClick={handleOpenFileCreateModal}
                    className={`
                      px-2 py-1 text-sm rounded flex items-center gap-1
                      bg-blue-500 text-white hover:bg-blue-600
                    `}
                    title="New File"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="12" y1="18" x2="12" y2="12"></line>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                    <span className="sr-only">New File</span>
                  </button>
                  <button
                    onClick={handleLoadDocumentation}
                    disabled={documentationLoading}
                    className={`
                      px-2 py-1 text-sm rounded flex items-center gap-1
                      ${documentationLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                      }
                    `}
                    title="Load Documentation"
                  >
                    {documentationLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span className="sr-only">Loading...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <polyline points="1 20 1 14 7 14"></polyline>
                          <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        <span className="sr-only">Load Docs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                {documentationError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span>{documentationError}</span>
                      <button
                        onClick={handleClearError}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                
                <DocumentationFileList
                  owner={repositoryInfo.owner}
                  repo={repositoryInfo.repo}
                  gitRef="main"
                  onFileSelect={handleFileSelect}
                  onDirectoryChange={(path) => console.log('Directory changed:', path)}
                />
              </div>
            </div>
            
            {/* File Viewer - Takes remaining space */}
            <div className={`
              border rounded-lg flex-1
              ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
            `}>
              <div className={`
                px-4 py-3 border-b flex items-center justify-between
                ${darkMode ? 'border-gray-600 bg-gray-750' : 'border-gray-200 bg-gray-50'}
              `}>
                <h5 className="font-medium">
                  {selectedFile ? selectedFile.name : 'Select a file to view'}
                </h5>
                
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenFileEditModal}
                      className={`
                        px-2 py-1 text-sm rounded flex items-center gap-1
                        bg-blue-500 text-white hover:bg-blue-600
                      `}
                      title="Edit File"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span className="sr-only">Edit File</span>
                    </button>
                    <button
                      onClick={() => console.log('Delete file:', selectedFile.name)}
                      className={`
                        px-2 py-1 text-sm rounded flex items-center gap-1
                        bg-red-500 text-white hover:bg-red-600
                      `}
                      title="Delete File"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      <span className="sr-only">Delete File</span>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <DocumentationViewer
                  owner={repositoryInfo.owner}
                  repo={repositoryInfo.repo}
                  filePath={selectedFile}
                  gitRef="main"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={`
            text-center py-6 border-2 border-dashed rounded-lg
            ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}
          `}>
            <p>Create a GitHub repository to access project documentation</p>
            <p className="text-sm mt-1">Documentation will be loaded from the ai_docs/context directory</p>
          </div>
        )}
      </div>

      {/* File Management Modals */}
      {showFileEditModal && selectedFile && repositoryInfo && (
        <FileEditModal
          isOpen={showFileEditModal}
          onClose={handleCloseFileEditModal}
          owner={repositoryInfo.owner}
          repo={repositoryInfo.repo}
          filePath={selectedFile.path}
          fileName={selectedFile.name}
          branch="main"
          onSuccess={handleFileOperationSuccess}
          darkMode={darkMode}
        />
      )}

      {showFolderCreateModal && repositoryInfo && (
        <FolderCreateModal
          isOpen={showFolderCreateModal}
          onClose={handleCloseFolderCreateModal}
          owner={repositoryInfo.owner}
          repo={repositoryInfo.repo}
          currentPath="ai_docs/context"
          branch="main"
          onSuccess={handleFileOperationSuccess}
        />
      )}

      {showFileCreateModal && repositoryInfo && (
        <FileCreateModal
          isOpen={showFileCreateModal}
          onClose={handleCloseFileCreateModal}
          owner={repositoryInfo.owner}
          repo={repositoryInfo.repo}
          currentPath="ai_docs/context"
          branch="main"
          onSuccess={handleFileOperationSuccess}
        />
      )}
    </div>
  );
}

ProjectDocumentsTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    projectName: PropTypes.string,
    title: PropTypes.string,
    name: PropTypes.string,
    fieldData: PropTypes.object,
    Customers__Name: PropTypes.string,
    'Customers::Name': PropTypes.string,
    customer: PropTypes.shape({
      name: PropTypes.string
    }),
    customerName: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      title: PropTypes.string
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.shape({
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      title: PropTypes.string
    }))
  }),
  setLocalProject: PropTypes.func.isRequired
};

export default ProjectDocumentsTab;