import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../layout/AppLayout';
import { useSnackBar } from '../../context/SnackBarContext';
import { updateRepositoryFile, clearFileOperationError } from '../../store/slices/documentationSlice';

/**
 * Modal component for editing file content in a GitHub repository
 * @param {Object} props - Component props
 * @param {Object} props.file - File object with path, content, and sha
 * @param {string} props.owner - Repository owner
 * @param {string} props.repo - Repository name
 * @param {string} props.branch - Branch name
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close modal handler
 * @param {Function} props.onSuccess - Success callback
 */
const FileEditModal = ({ 
  file, 
  owner, 
  repo, 
  branch = 'main',
  isOpen, 
  onClose,
  onSuccess
}) => {
  const { darkMode } = useTheme();
  const { showError, showSuccess } = useSnackBar();
  const dispatch = useDispatch();
  
  const { fileOperationLoading, fileOperationError } = useSelector(state => state.documentation);
  
  // Form state
  const [formData, setFormData] = useState({
    content: '',
    commitMessage: ''
  });
  
  // Reset form when modal opens or file changes
  useEffect(() => {
    if (isOpen && file) {
      // Decode base64 content if it exists
      const decodedContent = file.content ? atob(file.content) : '';
      setFormData({
        content: decodedContent,
        commitMessage: `Update ${file.path}`
      });
    }
  }, [isOpen, file]);
  
  // Clear errors when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(clearFileOperationError());
    }
  }, [isOpen, dispatch]);
  
  // Handle form input changes
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      showError('File content cannot be empty');
      return;
    }
    
    if (!formData.commitMessage.trim()) {
      showError('Commit message is required');
      return;
    }
    
    try {
      const updateData = {
        owner,
        repo,
        path: file.path,
        content: formData.content,
        message: formData.commitMessage,
        sha: file.sha,
        branch
      };
      
      const result = await dispatch(updateRepositoryFile(updateData));
      
      if (updateRepositoryFile.fulfilled.match(result)) {
        showSuccess(`File ${file.path} updated successfully`);
        onSuccess?.();
        onClose();
      } else {
        showError(result.payload || 'Failed to update file');
      }
    } catch (error) {
      showError(`Error updating file: ${error.message}`);
    }
  }, [formData, file, owner, repo, branch, dispatch, showError, showSuccess, onSuccess, onClose]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen || !file) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className={`
        w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
        p-6 mx-4 flex flex-col
      `}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Edit File</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {file.path}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
            disabled={fileOperationLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Error Display */}
        {fileOperationError && (
          <div className={`
            p-3 rounded-md mb-4
            ${darkMode ? 'bg-red-900/20 border border-red-700 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}
          `}>
            {fileOperationError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          {/* Commit Message */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Commit Message
            </label>
            <input
              type="text"
              value={formData.commitMessage}
              onChange={(e) => handleInputChange('commitMessage', e.target.value)}
              className={`
                w-full px-3 py-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
              placeholder="Describe your changes..."
              required
              disabled={fileOperationLoading}
            />
          </div>
          
          {/* File Content */}
          <div className="flex-1 flex flex-col mb-4">
            <label className="block text-sm font-medium mb-2">
              File Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              className={`
                flex-1 min-h-[400px] px-3 py-2 rounded-md border font-mono text-sm
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none
              `}
              placeholder="Enter file content..."
              required
              disabled={fileOperationLoading}
            />
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-4 py-2 rounded-md
                ${darkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                transition-colors duration-150
              `}
              disabled={fileOperationLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`
                px-4 py-2 rounded-md text-white transition-colors duration-150
                ${fileOperationLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'}
              `}
              disabled={fileOperationLoading}
            >
              {fileOperationLoading ? 'Updating...' : 'Update File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

FileEditModal.propTypes = {
  file: PropTypes.shape({
    path: PropTypes.string.isRequired,
    content: PropTypes.string,
    sha: PropTypes.string.isRequired
  }),
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  branch: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};

export default FileEditModal;