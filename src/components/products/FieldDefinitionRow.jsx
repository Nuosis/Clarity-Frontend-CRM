import React from 'react';
import PropTypes from 'prop-types';

function FieldDefinitionRow({ field, index, onChange, onRemove, darkMode }) {
  const handleChange = (property, value) => {
    onChange(index, property, value);
  };

  const validateKey = (key) => {
    // Check if key is snake_case (lowercase letters, numbers, underscores only)
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
    return snakeCaseRegex.test(key);
  };

  const isKeyValid = !field.key || validateKey(field.key);

  return (
    <div className={`
      p-4 rounded-md border mb-3
      ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
    `}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Field Key */}
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Field Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={field.key || ''}
            onChange={(e) => handleChange('key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder="field_name"
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              ${!isKeyValid ? 'border-red-500' : ''}
            `}
          />
          {!isKeyValid && (
            <p className="text-xs text-red-500 mt-1">Must be lowercase, underscore separated</p>
          )}
        </div>

        {/* Field Label */}
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Display Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={field.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Field Label"
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
            `}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* Field Type */}
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Field Type <span className="text-red-500">*</span>
          </label>
          <select
            value={field.type || 'text'}
            onChange={(e) => handleChange('type', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
            `}
          >
            <option value="text">Text</option>
            <option value="textarea">Long Text</option>
            <option value="number">Number</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="select">Select/Dropdown</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </div>

        {/* Required Checkbox */}
        <div className="flex items-end">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={field.required || false}
              onChange={(e) => handleChange('required', e.target.checked)}
              className="mr-2 w-4 h-4"
            />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Required Field
            </span>
          </label>
        </div>

        {/* Remove Button */}
        <div className="flex items-end justify-end">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Placeholder (for text-based types) */}
      {['text', 'textarea', 'number', 'phone', 'email'].includes(field.type) && (
        <div className="mb-3">
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Placeholder Text (Optional)
          </label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            placeholder="e.g., Enter your phone number..."
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
            `}
          />
        </div>
      )}

      {/* Options (for select type) */}
      {field.type === 'select' && (
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Options (comma-separated) <span className="text-red-500">*</span>
          </label>
          <textarea
            value={Array.isArray(field.options) ? field.options.join(', ') : ''}
            onChange={(e) => {
              const optionsArray = e.target.value
                .split(',')
                .map(opt => opt.trim())
                .filter(opt => opt.length > 0);
              handleChange('options', optionsArray);
            }}
            placeholder="Option 1, Option 2, Option 3"
            rows="2"
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
            `}
          />
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Separate each option with a comma
          </p>
        </div>
      )}
    </div>
  );
}

FieldDefinitionRow.propTypes = {
  field: PropTypes.shape({
    id: PropTypes.string,
    key: PropTypes.string,
    label: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
    placeholder: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  index: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default FieldDefinitionRow;
