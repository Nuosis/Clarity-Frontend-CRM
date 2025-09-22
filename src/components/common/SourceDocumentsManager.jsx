import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { fetchRepositoryContents } from '../../store/slices/documentationSlice';
import { parseGitHubUrl } from '../../utils/githubUtils';
import SourceDocumentsList from '../proposals/SourceDocumentsList';
import AddSourceModal from '../proposals/AddSourceModal';
import RepositoryConfigModal from './RepositoryConfigModal';

/**
 * SourceDocumentsManager - Standalone component for managing source documents
 * Can work with or without a project context by accepting repository configuration
 * @param {Object} props - Component props
 * @param {Object} props.repositoryConfig - Repository configuration
 * @param {string} props.repositoryConfig.owner - GitHub repository owner
 * @param {string} props.repositoryConfig.repo - GitHub repository name
 * @param {string} props.repositoryConfig.url - GitHub repository URL (alternative to owner/repo)
 * @param {Object} props.project - Optional project data (for backward compatibility)
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onSourceAdded - Callback when source is added
 * @param {Function} props.onSourceDeleted - Callback when source is deleted
 * @param {string} props.title - Custom title for the component
 * @param {string} props.description - Custom description for the component
 */
const SourceDocumentsManager = ({
  repositoryConfig,
  project,
  darkMode = false,
  onSourceAdded,
  onSourceDeleted,
  title = "Source Documents",
  description = "Manage source documents for your project"
}) => {
  const dispatch = useDispatch();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [error, setError] = useState(null);
  const [currentRepositoryConfig, setCurrentRepositoryConfig] = useState(repositoryConfig);

  // Determine repository info from either currentRepositoryConfig or project
  const repositoryInfo = useMemo(() => {
    // Priority 1: Direct repository config
    if (currentRepositoryConfig) {
      if (currentRepositoryConfig.owner && currentRepositoryConfig.repo) {
        return {
          owner: currentRepositoryConfig.owner,
          repo: currentRepositoryConfig.repo
        };
      }
      
      if (currentRepositoryConfig.url) {
        const parsed = parseGitHubUrl(currentRepositoryConfig.url);
        return parsed?.isGitHub ? { owner: parsed.owner, repo: parsed.repo } : null;
      }
    }

    // Priority 2: Extract from project links (backward compatibility)
    if (project?.links) {
      const githubLink = project.links.find(link => {
        const parsed = parseGitHubUrl(link.url);
        return parsed?.isGitHub;
      });
      
      if (githubLink) {
        const parsed = parseGitHubUrl(githubLink.url);
        return parsed?.isGitHub ? { owner: parsed.owner, repo: parsed.repo } : null;
      }
    }

    return null;
  }, [currentRepositoryConfig, project]);

  const handleAddSource = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
  }, []);

  const handleSourceAdded = useCallback(async (sourceData) => {
    try {
      setError(null);
      
      // Refresh the source documents list
      if (repositoryInfo) {
        await dispatch(fetchRepositoryContents({
          owner: repositoryInfo.owner,
          repo: repositoryInfo.repo,
          path: 'ai_docs/context/source_docs'
        })).unwrap();
      }

      // Close modal
      setShowAddModal(false);

      // Notify parent component
      if (onSourceAdded) {
        onSourceAdded(sourceData);
      }
    } catch (err) {
      setError(err.message || 'Failed to add source document');
    }
  }, [dispatch, repositoryInfo, onSourceAdded]);

  const handleSourceDeleted = useCallback(async (document) => {
    try {
      setError(null);
      
      // Here you would implement the actual deletion logic
      // For now, we'll just refresh the list
      if (repositoryInfo) {
        await dispatch(fetchRepositoryContents({
          owner: repositoryInfo.owner,
          repo: repositoryInfo.repo,
          path: 'ai_docs/context/source_docs'
        })).unwrap();
      }

      // Notify parent component
      if (onSourceDeleted) {
        onSourceDeleted(document);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete source document');
    }
  }, [dispatch, repositoryInfo, onSourceDeleted]);

  const handleRepositorySetup = useCallback(() => {
    setShowConfigModal(true);
  }, []);

  const handleConfigSave = useCallback((config) => {
    setCurrentRepositoryConfig(config);
    setShowConfigModal(false);
    setError(null);
  }, []);

  const handleConfigClose = useCallback(() => {
    setShowConfigModal(false);
  }, []);

  if (!repositoryInfo) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">{title}</h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {description}
            </p>
          </div>
        </div>

        {/* Repository Setup Required */}
        <div className={`
          text-center py-8 border-2 border-dashed rounded-lg
          ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}
        `}>
          <div className="space-y-4">
            <div className="text-4xl">📁</div>
            <div>
              <h4 className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                No Repository Configured
              </h4>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Configure a GitHub repository to manage source documents
              </p>
            </div>
            <button
              onClick={handleRepositorySetup}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Setup Repository
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Source Documents List */}
      <SourceDocumentsList
        project={{ links: [{ url: `https://github.com/${repositoryInfo.owner}/${repositoryInfo.repo}` }] }}
        darkMode={darkMode}
        onAddSource={handleAddSource}
        onDeleteSource={handleSourceDeleted}
      />

      {/* Add Source Modal */}
      {showAddModal && (
        <AddSourceModal
          isOpen={showAddModal}
          onClose={handleCloseAddModal}
          repositoryInfo={repositoryInfo}
          darkMode={darkMode}
          onSuccess={handleSourceAdded}
        />
      )}

      {/* Repository Configuration Modal */}
      {showConfigModal && (
        <RepositoryConfigModal
          isOpen={showConfigModal}
          onClose={handleConfigClose}
          onSave={handleConfigSave}
          initialConfig={currentRepositoryConfig}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

SourceDocumentsManager.propTypes = {
  repositoryConfig: PropTypes.shape({
    owner: PropTypes.string,
    repo: PropTypes.string,
    url: PropTypes.string
  }),
  project: PropTypes.shape({
    id: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      url: PropTypes.string.isRequired,
      title: PropTypes.string
    }))
  }),
  darkMode: PropTypes.bool,
  onSourceAdded: PropTypes.func,
  onSourceDeleted: PropTypes.func,
  title: PropTypes.string,
  description: PropTypes.string
};

export default SourceDocumentsManager;