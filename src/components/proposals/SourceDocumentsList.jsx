import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import {
  DocumentTextIcon,
  PhotoIcon,
  TableCellsIcon,
  FolderIcon,
  PaperClipIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { fetchRepositoryContents } from '../../store/slices/documentationSlice';
import { parseGitHubUrl } from '../../utils/githubUtils';
import SourceDocumentViewerModal from './SourceDocumentViewerModal';

/**
 * SourceDocumentsList component - displays and manages source documents from GitHub repository
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onAddSource - Callback for adding new source
 * @param {Function} props.onDeleteSource - Callback for deleting source
 */
const SourceDocumentsList = ({ project, darkMode, onAddSource, onDeleteSource }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sourceDocuments, setSourceDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  // Get GitHub repository info from project links
  const repositoryInfo = useMemo(() => {
    const links = project?.links || [];
    const githubLink = links.find(link => {
      const parsed = parseGitHubUrl(link.url);
      return parsed?.isGitHub;
    });
    
    if (!githubLink) return null;
    
    const parsed = parseGitHubUrl(githubLink.url);
    return parsed?.isGitHub ? { owner: parsed.owner, repo: parsed.repo } : null;
  }, [project?.links]);

  // Redux state for documentation
  const { contents } = useSelector(state => state.documentation);

  // Load source documents from GitHub repository
  const loadSourceDocuments = useCallback(async () => {
    // INVESTIGATION LOGGING - Repository Info Analysis
    console.log('[SourceDocumentsList] Repository Info Investigation:', {
      timestamp: new Date().toISOString(),
      repositoryInfo,
      repositoryInfoType: typeof repositoryInfo,
      repositoryInfoKeys: repositoryInfo ? Object.keys(repositoryInfo) : null,
      hasOwner: repositoryInfo?.owner,
      hasRepo: repositoryInfo?.repo,
      projectLinks: project?.links
    });

    if (!repositoryInfo) {
      console.log('[SourceDocumentsList] No Repository Info:', {
        timestamp: new Date().toISOString(),
        reason: 'repositoryInfo is null/undefined'
      });
      setError('No GitHub repository linked to this project');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // INVESTIGATION LOGGING - Dispatch Execution
      const dispatchParams = {
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        path: 'ai_docs/context/source_docs'
      };
      

      // Fetch contents from ai_docs/context/source_docs/
      const result = await dispatch(fetchRepositoryContents(dispatchParams)).unwrap();
      
    } catch (err) {
      setError(err.message || 'Failed to load source documents');
    } finally {
      setLoading(false);
    }
  }, [dispatch, repositoryInfo, project?.links]);

  // Update source documents when contents change
  useEffect(() => {
    const sourceDocsPath = 'ai_docs/context/source_docs';
    
    // The Redux state structure is: contents[path].contents (array of files)
    // Based on the logs, we need to access contents.contents directly
    let sourceDocsContents = null;
    
    if (contents && contents[sourceDocsPath] && contents[sourceDocsPath].contents) {
      // Standard path-based access with nested contents
      sourceDocsContents = contents[sourceDocsPath].contents;
    } else if (contents && contents.contents) {
      // Direct access to contents.contents (from logs)
      sourceDocsContents = contents.contents;
    }
    
    if (sourceDocsContents && Array.isArray(sourceDocsContents)) {
      // Filter out directories and system files (.gitkeep, .DS_Store, etc.)
      const documents = sourceDocsContents.filter(item =>
        item &&
        item.type === 'file' &&
        !item.name.startsWith('.') &&
        !item.name.endsWith('.gitkeep') &&
        !item.name.endsWith('.DS_Store')
      );
      
      setSourceDocuments(documents);
    } else {
      setSourceDocuments([]);
    }
  }, [contents]);

  // Load documents on component mount
  useEffect(() => {
    if (repositoryInfo) {
      loadSourceDocuments();
    }
  }, [repositoryInfo, loadSourceDocuments]);

  const handleRefresh = useCallback(() => {
    loadSourceDocuments();
  }, [loadSourceDocuments]);

  const handleDeleteDocument = useCallback((document) => {
    if (onDeleteSource) {
      onDeleteSource(document);
    }
  }, [onDeleteSource]);

  const formatFileSize = useCallback((size) => {
    if (!size) return 'Unknown size';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const getFileIcon = useCallback((fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
      case 'md':
        return <DocumentTextIcon className="h-5 w-5" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <PhotoIcon className="h-5 w-5" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <TableCellsIcon className="h-5 w-5" />;
      case 'eml':
      case 'msg':
        return <DocumentTextIcon className="h-5 w-5" />;
      default:
        return <PaperClipIcon className="h-5 w-5" />;
    }
  }, []);

  const handleDocumentClick = useCallback((document) => {
    setSelectedDocument(document);
    setShowViewer(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setShowViewer(false);
    setSelectedDocument(null);
  }, []);

  if (!repositoryInfo) {
    return (
      <div className={`
        text-center py-6 border-2 border-dashed rounded-lg
        ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}
      `}>
        <p>No GitHub repository linked to this project</p>
        <p className="text-sm mt-1">Create a GitHub repository in the Documents tab to manage source documents</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium">Source Documents</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`
              px-3 py-1 text-sm rounded flex items-center gap-1
              ${loading
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-gray-500 text-white hover:bg-gray-600'
              }
            `}
            title="Refresh source documents"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>Loading...</span>
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
                <span>Refresh</span>
              </>
            )}
          </button>
          <button
            onClick={onAddSource}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Add Source
          </button>
        </div>
      </div>

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

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Loading source documents...</p>
          </div>
        </div>
      ) : sourceDocuments.length > 0 ? (
        <div className="space-y-2">
          {sourceDocuments.map((document) => (
            <div
              key={document.sha}
              className={`
                p-3 border rounded-lg flex items-center justify-between cursor-pointer
                ${darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-white border-gray-300 hover:bg-gray-50'}
              `}
              onClick={() => handleDocumentClick(document)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">{getFileIcon(document.name)}</div>
                <div>
                  <h5 className="font-medium">{document.name}</h5>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatFileSize(document.size)}
                    {document.download_url && (
                      <span className="ml-2">
                        <a
                          href={document.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </a>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(document);
                  }}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  title="Remove"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`
          text-center py-6 border-2 border-dashed rounded-lg
          ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}
        `}>
          <p>No source documents found</p>
        </div>
      )}

      {/* Document Viewer Modal */}
      <SourceDocumentViewerModal
        isOpen={showViewer}
        onClose={handleCloseViewer}
        document={selectedDocument}
        darkMode={darkMode}
      />
    </div>
  );
};

SourceDocumentsList.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      url: PropTypes.string.isRequired,
      title: PropTypes.string
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onAddSource: PropTypes.func.isRequired,
  onDeleteSource: PropTypes.func.isRequired
};

export default SourceDocumentsList;