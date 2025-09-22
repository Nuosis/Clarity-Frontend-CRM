import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../layout/AppLayout';
import { useSnackBar } from '../../context/SnackBarContext';
import { createRepositoryFolder, clearFileOperationError } from '../../store/slices/documentationSlice';

/**
 * Modal component for creating a new folder in a GitHub repository
 * @param {Object} props - Component props
 * @param {string} props.owner - Repository owner
 * @param {string} props.repo - Repository name
 * @param {string} props.branch - Branch name
 * @param {string} props.currentPath - Current directory path
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close modal handler
 * @param {Function} props.onSuccess - Success callback
 */
const FolderCreateModal = ({ 
  owner, 
  repo, 
  branch = 'main',
  currentPath = '',
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
    folderName: '',
    commitMessage: ''
  });
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        folderName: '',
        commitMessage: 'Create folder'
      });
    }
  }, [isOpen]);
  
  // Update commit message when folder name changes
  useEffect(() => {
    if (formData.folderName.trim()) {
      setFormData(prev => ({
        ...prev,
        commitMessage: `Create ${formData.folderName} folder`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        commitMessage: 'Create folder'
      }));
    }
  }, [formData.folderName]);
  
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
  
  // Validate folder name
  const validateFolderName = useCallback((name) => {
    if (!name.trim()) {
      return 'Folder name is required';
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
      return 'Folder name contains invalid characters';
    }
    
    // Check for reserved names
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      return 'Folder name is reserved';
    }
    
    // Check for leading/trailing spaces or dots
    if (name !== name.trim() || name.endsWith('.')) {
      return 'Folder name cannot start/end with spaces or end with a dot';
    }
    
    return null;
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const folderNameError = validateFolderName(formData.folderName);
    if (folderNameError) {
      showError(folderNameError);
      return;
    }
    
    if (!formData.commitMessage.trim()) {
      showError('Commit message is required');
      return;
    }
    
    try {
      // Construct the full folder path
      const folderPath = currentPath 
        ? `${currentPath}/${formData.folderName}`.replace(/\/+/g, '/')
        : formData.folderName;
      
      const createData = {
        owner,
        repo,
        path: folderPath,
        message: formData.commitMessage,
        branch
      };
      
      const result = await dispatch(createRepositoryFolder(createData));
      
      if (createRepositoryFolder.fulfilled.match(result)) {
        showSuccess(`Folder "${formData.folderName}" created successfully`);
        onSuccess?.();
        onClose();
      } else {
        showError(result.payload || 'Failed to create folder');
      }
    } catch (error) {
      showError(`Error creating folder: ${error.message}`);
    }
  }, [formData, currentPath, owner, repo, branch, dispatch, showError, showSuccess, onSuccess, onClose, validateFolderName]);
  
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
  
  if (!isOpen) return null;
  
  const folderNameError = formData.folderName ? validateFolderName(formData.folderName) : null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className={`
        w-full max-w-md rounded-lg shadow-xl
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
        p-6 mx-4
      `}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Create New Folder</h2>
            {currentPath && (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                in {currentPath}
              </p>
            )}
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
        
        <form onSubmit={handleSubmit}>
          {/* Folder Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={formData.folderName}
              onChange={(e) => handleInputChange('folderName', e.target.value)}
              className={`
                w-full px-3 py-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                ${folderNameError ? 'border-red-500' : ''}
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
              placeholder="Enter folder name..."
              required
              disabled={fileOperationLoading}
            />
            {folderNameError && (
              <p className="mt-1 text-sm text-red-500">{folderNameError}</p>
            )}
          </div>
          
          {/* Commit Message */}
          <div className="mb-6">
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
              placeholder="Describe the folder creation..."
              required
              disabled={fileOperationLoading}
            />
          </div>
          
          {/* Info Note */}
          <div className={`
            p-3 rounded-md mb-6 text-sm
            ${darkMode ? 'bg-blue-900/20 border border-blue-700 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}
          `}>
            <div className="flex items-start">
              <svg className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                A .gitkeep file will be created to ensure the folder is tracked by Git.
              </span>
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
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
                ${fileOperationLoading || folderNameError
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'}
              `}
              disabled={fileOperationLoading || !!folderNameError}
            >
              {fileOperationLoading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

FolderCreateModal.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  branch: PropTypes.string,
  currentPath: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};

export default FolderCreateModal;