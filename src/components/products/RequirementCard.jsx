import React from 'react';
import PropTypes from 'prop-types';
import RequirementFieldBuilder from './RequirementFieldBuilder';

function RequirementCard({
  requirement,
  index,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
  onFieldsChange,
  darkMode
}) {
  const handleChange = (field, value) => {
    onChange(field, value);
  };

  const getTypeBadgeColor = (type) => {
    return type === 'list'
      ? darkMode ? 'bg-blue-600' : 'bg-blue-500'
      : darkMode ? 'bg-purple-600' : 'bg-purple-500';
  };

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-all duration-200
        ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
      `}
    >
      {/* Header - Always Visible */}
      <div
        className={`
          p-4 cursor-pointer transition-colors duration-200
          ${darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}
        `}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* Expand/Collapse Icon */}
            <svg
              className={`
                w-5 h-5 transition-transform duration-200
                ${isExpanded ? 'transform rotate-90' : ''}
                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
              `}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            {/* Title or Input */}
            {!isExpanded ? (
              <div className="flex items-center space-x-3 flex-1">
                <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {requirement.name || 'Untitled Requirement'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getTypeBadgeColor(requirement.type)}`}>
                  {requirement.type || 'list'}
                </span>
                {requirement.required && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                    Required
                  </span>
                )}
                {requirement.fields && requirement.fields.length > 0 && (
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {requirement.fields.length} field{requirement.fields.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={requirement.name || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  handleChange('name', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Requirement Name"
                className={`
                  flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                `}
              />
            )}
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-3 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title="Remove requirement"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* Description */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <textarea
              value={requirement.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="What is this requirement for?"
              rows="2"
              className={`
                w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              `}
            />
          </div>

          {/* Type and Required */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Requirement Type
              </label>
              <select
                value={requirement.type || 'list'}
                onChange={(e) => handleChange('type', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                `}
              >
                <option value="list">List (Multiple Items)</option>
                <option value="form">Form (Single Entry)</option>
              </select>
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {requirement.type === 'list'
                  ? 'Customer can add multiple entries (e.g., transfer destinations)'
                  : 'Customer fills out once (e.g., business hours)'}
              </p>
            </div>

            <div className="flex items-start">
              <label className="flex items-center cursor-pointer mt-8">
                <input
                  type="checkbox"
                  checked={requirement.required || false}
                  onChange={(e) => handleChange('required', e.target.checked)}
                  className="mr-2 w-4 h-4"
                />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Required (customer must complete)
                </span>
              </label>
            </div>
          </div>

          {/* Fields Builder */}
          <div className={`border-t pt-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <RequirementFieldBuilder
              fields={requirement.fields || []}
              onChange={onFieldsChange}
              darkMode={darkMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}

RequirementCard.propTypes = {
  requirement: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
    fields: PropTypes.array
  }).isRequired,
  index: PropTypes.number.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onFieldsChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default RequirementCard;
