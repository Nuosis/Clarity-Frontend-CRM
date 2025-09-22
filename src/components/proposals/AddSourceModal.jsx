import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { dataService } from '../../services/dataService';
import { createFile } from '../../api/github';
import { useProject } from '../../hooks/useProject';

/**
 * AddSourceModal component - modal for adding source documents (file or email)
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close modal callback
 * @param {Object} props.repositoryInfo - GitHub repository info
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onSuccess - Success callback
 */
const AddSourceModal = ({ isOpen, onClose, repositoryInfo, darkMode, onSuccess }) => {
  const { selectedProject } = useProject();
  const [sourceType, setSourceType] = useState('file');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // File upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  // Email search state
  const [emailAddress, setEmailAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [keywordTags, setKeywordTags] = useState('');
  const [emailResults, setEmailResults] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);

  const handleClose = useCallback(() => {
    // Reset all state
    setSourceType('file');
    setSelectedFiles([]);
    setEmailAddress('');
    setSearchQuery('');
    setKeywordTags('');
    setEmailResults([]);
    setSelectedEmails([]);
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback((event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleEmailSearch = useCallback(async () => {
    if (!emailAddress.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the /events endpoint for email search
      const response = await dataService.post('/events', {
        type: 'email_search',
        project_id: selectedProject?.id || null,
        email_address: emailAddress,
        search_query: searchQuery,
        keyword_tags: keywordTags.split(',').map(tag => tag.trim()).filter(Boolean)
      });

      if (response.success && response.data) {
        setEmailResults(response.data.emails || []);
        if (response.data.emails?.length === 0) {
          setError('No emails found matching your search criteria');
        }
      } else {
        setError(response.error || 'Failed to search emails');
      }
    } catch (err) {
      setError(err.message || 'Failed to search emails');
    } finally {
      setLoading(false);
    }
  }, [emailAddress, searchQuery, keywordTags, selectedProject?.id]);

  const handleEmailSelect = useCallback((email, selected) => {
    if (selected) {
      setSelectedEmails(prev => [...prev, email]);
    } else {
      setSelectedEmails(prev => prev.filter(e => e.id !== email.id));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (sourceType === 'file') {
        if (selectedFiles.length === 0) {
          setError('Please select at least one file');
          return;
        }

        // Upload files to GitHub repository using GitHub API
        const uploadPromises = selectedFiles.map(async (file) => {
          const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          const filePath = `ai_docs/context/source_docs/${file.name}`;
          
          return createFile({
            owner: repositoryInfo.owner,
            repo: repositoryInfo.repo,
            path: filePath,
            content: fileContent,
            message: `Add source document: ${file.name} for project ${selectedProject?.id || 'unknown'}`
          });
        });

        const results = await Promise.all(uploadPromises);
        console.log('File upload responses:', results);
        
        setSuccess(`Successfully uploaded ${selectedFiles.length} file(s)`);
        setTimeout(() => {
          // Call success callback with upload data to trigger refresh
          if (onSuccess) {
            onSuccess({
              type: 'file',
              files: selectedFiles.map((file, index) => ({
                name: file.name,
                path: `ai_docs/context/source_docs/${file.name}`,
                size: file.size,
                result: results[index]
              }))
            });
          }
          handleClose();
        }, 1500);
      } else if (sourceType === 'email') {
        if (selectedEmails.length === 0) {
          setError('Please select at least one email');
          return;
        }

        // Process selected emails using events endpoint
        const response = await dataService.post('/events', {
          type: 'email_process',
          project_id: selectedProject?.id || null,
          emails: selectedEmails,
          repository: repositoryInfo,
          search_context: {
            email_address: emailAddress,
            search_query: searchQuery,
            keyword_tags: keywordTags.split(',').map(tag => tag.trim()).filter(Boolean)
          }
        });

        if (response.success) {
          setSuccess(`Successfully processed ${selectedEmails.length} email(s)`);
          setTimeout(() => {
            // Call success callback with email data to trigger refresh
            if (onSuccess) {
              onSuccess({
                type: 'email',
                emails: selectedEmails,
                response: response
              });
            }
            handleClose();
          }, 1500);
        } else {
          setError(response.error || 'Failed to process emails');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to add source documents');
    } finally {
      setLoading(false);
    }
  }, [sourceType, selectedFiles, selectedEmails, repositoryInfo, selectedProject?.id, emailAddress, searchQuery, keywordTags, onSuccess, handleClose]);

  const formatFileSize = useCallback((size) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        w-full max-w-2xl mx-4 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        {/* Header */}
        <div className={`
          px-6 py-4 border-b flex items-center justify-between
          ${darkMode ? 'border-gray-600' : 'border-gray-200'}
        `}>
          <h3 className="text-lg font-semibold">Add Source Document</h3>
          <button
            onClick={handleClose}
            className={`
              w-8 h-8 flex items-center justify-center rounded-full
              ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
            `}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Source Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="file"
                  checked={sourceType === 'file'}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="mr-2"
                />
                <span>File Upload</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={sourceType === 'email'}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="mr-2"
                />
                <span>Email Content</span>
              </label>
            </div>
          </div>

          {/* File Upload Section */}
          {sourceType === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Files</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className={`
                    w-full px-3 py-2 border rounded-md
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                    }
                  `}
                  accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.eml,.msg"
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Supported formats: PDF, DOC, DOCX, TXT, MD, JPG, PNG, GIF, EML, MSG
                </p>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Selected Files ({selectedFiles.length})</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className={`
                          flex items-center justify-between p-2 border rounded
                          ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}
                        `}
                      >
                        <div>
                          <span className="text-sm font-medium">{file.name}</span>
                          <span className={`text-xs ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email Search Section */}
          {sourceType === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-md
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                    }
                  `}
                  placeholder="Enter email address to search"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Search Query (Optional)</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-md
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                    }
                  `}
                  placeholder="Natural language search (e.g., 'project requirements from last month')"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Keyword Tags (Optional)</label>
                <input
                  type="text"
                  value={keywordTags}
                  onChange={(e) => setKeywordTags(e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-md
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                    }
                  `}
                  placeholder="Comma-separated tags (e.g., 'requirements, specifications, design')"
                />
              </div>

              <button
                onClick={handleEmailSearch}
                disabled={loading || !emailAddress.trim()}
                className={`
                  px-4 py-2 rounded-md text-white font-medium
                  ${loading || !emailAddress.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }
                `}
              >
                {loading ? 'Searching...' : 'Search Emails'}
              </button>

              {/* Email Results */}
              {emailResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Found Emails ({emailResults.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {emailResults.map((email) => (
                      <div
                        key={email.id}
                        className={`
                          p-3 border rounded flex items-start space-x-3
                          ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmails.some(e => e.id === email.id)}
                          onChange={(e) => handleEmailSelect(email, e.target.checked)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <h5 className="text-sm font-medium">{email.subject}</h5>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            From: {email.from} • {new Date(email.date).toLocaleDateString()}
                          </p>
                          {email.preview && (
                            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {email.preview.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`
          px-6 py-4 border-t flex justify-end space-x-3
          ${darkMode ? 'border-gray-600' : 'border-gray-200'}
        `}>
          <button
            onClick={handleClose}
            disabled={loading}
            className={`
              px-4 py-2 border rounded-md
              ${darkMode 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }
              disabled:opacity-50
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (sourceType === 'file' && selectedFiles.length === 0) || (sourceType === 'email' && selectedEmails.length === 0)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Add Sources'}
          </button>
        </div>
      </div>
    </div>
  );
};

AddSourceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  repositoryInfo: PropTypes.shape({
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired
  }),
  darkMode: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func
};

export default AddSourceModal;