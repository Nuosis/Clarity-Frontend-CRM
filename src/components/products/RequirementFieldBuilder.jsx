import React from 'react';
import PropTypes from 'prop-types';
import FieldDefinitionRow from './FieldDefinitionRow';

function RequirementFieldBuilder({ fields, onChange, darkMode }) {
  const handleFieldChange = (index, property, value) => {
    const newFields = [...fields];
    newFields[index] = {
      ...newFields[index],
      [property]: value
    };
    onChange(newFields);
  };

  const handleAddField = () => {
    const newField = {
      id: crypto.randomUUID(),
      key: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: ''
    };
    onChange([...fields, newField]);
  };

  const handleRemoveField = (index) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Field Definitions {fields.length > 0 && `(${fields.length})`}
        </h4>
      </div>

      {fields.length === 0 ? (
        <div className={`
          p-6 rounded-md border-2 border-dashed text-center
          ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}
        `}>
          <svg
            className={`mx-auto h-12 w-12 mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No fields defined yet
          </p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Click "Add Field" below to create your first field
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id || index}>
              <div className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Field {index + 1}
              </div>
              <FieldDefinitionRow
                field={field}
                index={index}
                onChange={handleFieldChange}
                onRemove={handleRemoveField}
                darkMode={darkMode}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddField}
        className={`
          mt-3 w-full px-4 py-2 border-2 border-dashed rounded-md text-sm font-medium
          transition-colors duration-200
          ${darkMode
            ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 hover:bg-gray-700'
            : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'}
        `}
      >
        + Add Field
      </button>
    </div>
  );
}

RequirementFieldBuilder.propTypes = {
  fields: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    key: PropTypes.string,
    label: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
    placeholder: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string)
  })).isRequired,
  onChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default RequirementFieldBuilder;
