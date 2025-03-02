import React from 'react';
import PropTypes from 'prop-types';

/**
 * Timeframe selection dropdown for financial data
 * @param {Object} props - Component props
 * @param {string} props.value - Current timeframe value
 * @param {function} props.onChange - Function to call when timeframe changes
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Timeframe selector component
 */
function TimeframeSelector({ value, onChange, darkMode }) {
  const timeframes = [
    { value: 'today', label: 'Today' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'unpaid', label: 'Unbilled' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' }
  ];

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex items-center space-x-2">
      <label 
        htmlFor="timeframe-select" 
        className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        Timeframe:
      </label>
      <select
        id="timeframe-select"
        value={value}
        onChange={handleChange}
        className={`
          rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500
          ${darkMode 
            ? 'bg-gray-700 border-gray-600 text-white' 
            : 'bg-white border-gray-300 text-gray-900'}
        `}
      >
        {timeframes.map(timeframe => (
          <option key={timeframe.value} value={timeframe.value}>
            {timeframe.label}
          </option>
        ))}
      </select>
    </div>
  );
}

TimeframeSelector.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

TimeframeSelector.defaultProps = {
  darkMode: false
};

export default React.memo(TimeframeSelector);