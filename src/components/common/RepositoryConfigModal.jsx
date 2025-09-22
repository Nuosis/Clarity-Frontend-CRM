import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { parseGitHubUrl } from '../../utils/githubUtils';

/**
 * RepositoryConfigModal - Modal for configuring GitHub repository settings
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Function} props.onSave - Callback when repository config is saved
 * @param {Object} props.initialConfig - Initial repository configuration
 * @param {boolean} props.darkMode - Dark mode flag
 */
const RepositoryConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
  darkMode = false
}) => {
  const [formData, setFormData] = useState({
    url: initialConfig.url || '',
    owner: initialConfig.owner || '',
    repo: initialConfig.repo || ''
  });
  const [errors, setErrors] = useState({});
  const [inputMethod, setInputMethod] = useState('url'); // 'url' or 'manual'

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (inputMethod === 'url') {
      if (!formData.url.trim()) {
        newErrors.url = 'GitHub URL is required';
      } else {
        const parsed = parseGitHubUrl(formData.url);
        if (!parsed?.isGitHub) {
          newErrors.url = 'Please enter a valid GitHub repository URL';
        }
      }
    } else {
      if (!formData.owner.trim()) {
        newErrors.owner = 'Repository owner is required';
      }
      if (!formData.repo.trim()) {
        newErrors.repo = 'Repository name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, inputMethod]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }

    // Auto-parse URL if provided
    if (field === 'url' && value.trim()) {
      const parsed = parseGitHubUrl(value);
      if (parsed?.isGitHub) {
        setFormData(prev => ({
          ...prev,
          owner: parsed.owner,
          repo: parsed.repo
        }));
      }
    }
  }, [errors]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    let config;
    if (inputMethod === 'url') {
      const parsed = parseGitHubUrl(formData.url);
      config = {
        url: formData.url,
        owner: parsed.owner,
        repo: parsed.repo
      };
    } else {
      config = {
        owner: formData.owner,
        repo: formData.repo,
        url: `https://github.com/${formData.owner}/${formData.repo}`
      };
    }

    onSave(config);
  }, [formData, inputMethod, validateForm, onSave]);

  const handleClose = useCallback(() => {
    setFormData({
      url: '',
      owner: '',
      repo: ''
    });
    setErrors({});
    setInputMethod('url');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        w-full max-w-md mx-4 rounded-lg shadow-xl
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-medium">Configure Repository</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Input Method Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Configuration Method</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="url"
                  checked={inputMethod === 'url'}
                  onChange={(e) => setInputMethod(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">GitHub URL</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="manual"
                  checked={inputMethod === 'manual'}
                  onChange={(e) => setInputMethod(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Owner/Repo</span>
              </label>
            </div>
          </div>

          {/* URL Input */}
          {inputMethod === 'url' && (
            <div className="space-y-2">
              <label htmlFor="url" className="block text-sm font-medium">
                GitHub Repository URL
              </label>
              <input
                type="url"
                id="url"
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                placeholder="https://github.com/owner/repository"
                className={`
                  w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                  ${errors.url ? 'border-red-500' : ''}
                `}
              />
              {errors.url && (
                <p className="text-red-500 text-sm">{errors.url}</p>
              )}
            </div>
          )}

          {/* Manual Input */}
          {inputMethod === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="owner" className="block text-sm font-medium">
                  Repository Owner
                </label>
                <input
                  type="text"
                  id="owner"
                  value={formData.owner}
                  onChange={(e) => handleInputChange('owner', e.target.value)}
                  placeholder="username or organization"
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    ${errors.owner ? 'border-red-500' : ''}
                  `}
                />
                {errors.owner && (
                  <p className="text-red-500 text-sm">{errors.owner}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="repo" className="block text-sm font-medium">
                  Repository Name
                </label>
                <input
                  type="text"
                  id="repo"
                  value={formData.repo}
                  onChange={(e) => handleInputChange('repo', e.target.value)}
                  placeholder="repository-name"
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    ${errors.repo ? 'border-red-500' : ''}
                  `}
                />
                {errors.repo && (
                  <p className="text-red-500 text-sm">{errors.repo}</p>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {((inputMethod === 'url' && formData.url) || (inputMethod === 'manual' && formData.owner && formData.repo)) && (
            <div className={`
              p-3 rounded-md text-sm
              ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
            `}>
              <div className="font-medium mb-1">Repository Preview:</div>
              <div className="text-blue-500">
                {inputMethod === 'url' 
                  ? formData.url 
                  : `https://github.com/${formData.owner}/${formData.repo}`
                }
              </div>
              {formData.owner && formData.repo && (
                <div className="mt-1 text-xs opacity-75">
                  Owner: {formData.owner} • Repository: {formData.repo}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={`
                px-4 py-2 text-sm font-medium rounded-md border
                ${darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

RepositoryConfigModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialConfig: PropTypes.shape({
    url: PropTypes.string,
    owner: PropTypes.string,
    repo: PropTypes.string
  }),
  darkMode: PropTypes.bool
};

export default RepositoryConfigModal;