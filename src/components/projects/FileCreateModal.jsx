import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../layout/AppLayout';
import { useSnackBar } from '../../context/SnackBarContext';
import { createRepositoryFile, clearFileOperationError } from '../../store/slices/documentationSlice';

/**
 * Modal component for creating a new file in a GitHub repository
 * @param {Object} props - Component props
 * @param {string} props.owner - Repository owner
 * @param {string} props.repo - Repository name
 * @param {string} props.branch - Branch name
 * @param {string} props.currentPath - Current directory path
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close modal handler
 * @param {Function} props.onSuccess - Success callback
 */
const FileCreateModal = ({ 
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
    fileName: '',
    content: '',
    commitMessage: '',
    uploadMode: false
  });
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        fileName: '.md',
        content: '',
        commitMessage: 'Create new file',
        uploadMode: false
      });
    }
  }, [isOpen]);
  
  // Update commit message when file name changes
  useEffect(() => {
    if (formData.fileName && formData.fileName !== '.md') {
      const fileName = formData.fileName.startsWith('.') ? formData.fileName.slice(1) : formData.fileName;
      setFormData(prev => ({
        ...prev,
        commitMessage: `Create ${fileName}`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        commitMessage: 'Create new file'
      }));
    }
  }, [formData.fileName]);
  
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
  
  // Handle file upload
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      
      // For binary files, convert ArrayBuffer to base64
      if (content instanceof ArrayBuffer) {
        const bytes = new Uint8Array(content);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        content = btoa(binary);
      }
      
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        content: content,
        uploadMode: true
      }));
    };
    
    // Determine if file is binary or text
    const textFileTypes = ['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.css', '.scss', '.html', '.xml', '.py', '.java', '.c', '.cpp', '.h', '.php', '.rb', '.go', '.rs', '.sh', '.sql'];
    const isTextFile = textFileTypes.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (isTextFile) {
      reader.readAsText(file);
    } else {
      // For binary files (PDFs, images, etc.)
      reader.readAsArrayBuffer(file);
    }
  }, []);
  
  // Toggle between upload and manual entry modes
  const toggleUploadMode = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      uploadMode: !prev.uploadMode,
      fileName: prev.uploadMode ? '.md' : prev.fileName,
      content: prev.uploadMode ? '' : prev.content
    }));
  }, []);
  
  // Validate file name
  const validateFileName = useCallback((name) => {
    if (!name.trim()) {
      return 'File name is required';
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
      return 'File name contains invalid characters';
    }
    
    // Check for reserved names
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = name.split('.')[0];
    if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
      return 'File name is reserved';
    }
    
    // Check for leading/trailing spaces or dots
    if (name !== name.trim() || name.endsWith('.')) {
      return 'File name cannot start/end with spaces or end with a dot';
    }
    
    // Check for directory separators
    if (name.includes('/') || name.includes('\\')) {
      return 'File name cannot contain directory separators';
    }
    
    return null;
  }, []);
  
  // Get file extension for syntax highlighting hint
  const getFileType = useCallback((fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const typeMap = {
      'js': 'JavaScript',
      'jsx': 'React JSX',
      'ts': 'TypeScript',
      'tsx': 'React TSX',
      'md': 'Markdown',
      'json': 'JSON',
      'yml': 'YAML',
      'yaml': 'YAML',
      'css': 'CSS',
      'scss': 'SCSS',
      'html': 'HTML',
      'xml': 'XML',
      'py': 'Python',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'h': 'C Header',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'sh': 'Shell Script',
      'sql': 'SQL',
      'txt': 'Text'
    };
    return typeMap[ext] || 'Plain Text';
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const fileNameError = validateFileName(formData.fileName);
    if (fileNameError) {
      showError(fileNameError);
      return;
    }
    
    if (!formData.commitMessage.trim()) {
      showError('Commit message is required');
      return;
    }
    
    try {
      // Construct the full file path
      const filePath = currentPath 
        ? `${currentPath}/${formData.fileName}`.replace(/\/+/g, '/')
        : formData.fileName;
      
      const createData = {
        owner,
        repo,
        path: filePath,
        content: formData.content,
        message: formData.commitMessage,
        branch
      };
      
      const result = await dispatch(createRepositoryFile(createData));
      
      if (createRepositoryFile.fulfilled.match(result)) {
        showSuccess(`File "${formData.fileName}" created successfully`);
        onSuccess?.();
        onClose();
      } else {
        showError(result.payload || 'Failed to create file');
      }
    } catch (error) {
      showError(`Error creating file: ${error.message}`);
    }
  }, [formData, currentPath, owner, repo, branch, dispatch, showError, showSuccess, onSuccess, onClose, validateFileName]);
  
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
  
  const fileNameError = formData.fileName ? validateFileName(formData.fileName) : null;
  const fileType = formData.fileName ? getFileType(formData.fileName) : 'Plain Text';
  
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
            <h2 className="text-xl font-bold">Create New File</h2>
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
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          {/* Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Creation Mode</h3>
              <button
                type="button"
                onClick={toggleUploadMode}
                className={`
                  px-3 py-1 rounded-md text-sm transition-colors duration-150
                  ${formData.uploadMode
                    ? darkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                `}
                disabled={fileOperationLoading}
              >
                {formData.uploadMode ? 'Switch to Manual Entry' : 'Upload File'}
              </button>
            </div>
          </div>

          {/* File Upload Section */}
          {formData.uploadMode && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Upload File
              </label>
              <input
                type="file"
                onChange={handleFileUpload}
                className={`
                  w-full px-3 py-2 rounded-md border
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20
                `}
                accept=".md,.txt,.js,.jsx,.ts,.tsx,.json,.yml,.yaml,.css,.scss,.html,.xml,.py,.java,.c,.cpp,.h,.php,.rb,.go,.rs,.sh,.sql"
                disabled={fileOperationLoading}
              />
              <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Supported formats: Markdown, Text, Code files, and more
              </p>
            </div>
          )}

          {/* File Name and Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                File Name
              </label>
              <input
                type="text"
                value={formData.fileName}
                onChange={(e) => handleInputChange('fileName', e.target.value)}
                className={`
                  w-full px-3 py-2 rounded-md border
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                  ${fileNameError ? 'border-red-500' : ''}
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20
                `}
                placeholder="example.md"
                required
                disabled={fileOperationLoading || formData.uploadMode}
              />
              {fileNameError && (
                <p className="mt-1 text-sm text-red-500">{fileNameError}</p>
              )}
              {formData.uploadMode && (
                <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Filename will be set automatically when you upload a file
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                File Type
              </label>
              <div className={`
                px-3 py-2 rounded-md border text-sm
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-300'
                  : 'bg-gray-50 border-gray-300 text-gray-600'}
              `}>
                {fileType}
              </div>
            </div>
          </div>
          
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
              placeholder="Describe the new file..."
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
                flex-1 min-h-[300px] px-3 py-2 rounded-md border font-mono text-sm
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none
              `}
              placeholder="Enter file content..."
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
                ${fileOperationLoading || fileNameError
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'}
              `}
              disabled={fileOperationLoading || !!fileNameError}
            >
              {fileOperationLoading ? 'Creating...' : 'Create File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

FileCreateModal.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  branch: PropTypes.string,
  currentPath: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};

export default FileCreateModal;