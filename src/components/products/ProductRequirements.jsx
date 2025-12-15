import React from 'react';
import PropTypes from 'prop-types';

function ProductRequirements({ requirements, darkMode }) {
  if (!requirements || requirements.length === 0) {
    return null;
  }

  const getTypeIcon = (type) => {
    if (type === 'list') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const getFieldTypeLabel = (type) => {
    const typeLabels = {
      text: 'Text',
      textarea: 'Long Text',
      number: 'Number',
      phone: 'Phone',
      email: 'Email',
      select: 'Dropdown',
      checkbox: 'Checkbox'
    };
    return typeLabels[type] || type;
  };

  return (
    <div className={`mt-6 p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Customer Requirements
      </h3>

      <div className="space-y-4">
        {requirements.map((requirement, index) => (
          <div
            key={requirement.id || index}
            className={`p-4 rounded-md border ${darkMode ? 'bg-gray-750 border-gray-600' : 'bg-white border-gray-300'}`}
          >
            {/* Requirement Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className={darkMode ? 'text-blue-400' : 'text-blue-600'}>
                  {getTypeIcon(requirement.type)}
                </div>
                <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {requirement.name}
                </h4>
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-semibold
                  ${requirement.type === 'list'
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                    : (darkMode ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white')}
                `}>
                  {requirement.type}
                </span>
                {requirement.required && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white">
                    Required
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {requirement.description && (
              <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {requirement.description}
              </p>
            )}

            {/* Fields */}
            {requirement.fields && requirement.fields.length > 0 && (
              <div className="mt-3">
                <div className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Fields ({requirement.fields.length}):
                </div>
                <div className="space-y-2">
                  {requirement.fields.map((field, fIdx) => (
                    <div
                      key={field.id || fIdx}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-md text-sm
                        ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <code className={`text-xs font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {field.key}
                        </code>
                        <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-red-500 text-xs">*</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`
                          px-2 py-0.5 rounded text-xs
                          ${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}
                        `}>
                          {getFieldTypeLabel(field.type)}
                        </span>
                        {field.type === 'select' && field.options && field.options.length > 0 && (
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ({field.options.length} options)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help text for type */}
            <div className={`mt-3 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {requirement.type === 'list'
                ? 'Customer can add multiple entries for this requirement'
                : 'Customer fills this out once during setup'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

ProductRequirements.propTypes = {
  requirements: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      key: PropTypes.string,
      label: PropTypes.string,
      type: PropTypes.string,
      required: PropTypes.bool,
      options: PropTypes.arrayOf(PropTypes.string)
    }))
  })),
  darkMode: PropTypes.bool.isRequired
};

export default ProductRequirements;
