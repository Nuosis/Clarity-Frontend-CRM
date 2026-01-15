import React from 'react';
import PropTypes from 'prop-types';

/**
 * Pagination controls component for navigating paginated lists
 * @param {Object} props - Component props
 * @param {Object} props.pagination - Pagination metadata
 * @param {number} props.pagination.total - Total number of records
 * @param {number} props.pagination.limit - Records per page
 * @param {number} props.pagination.offset - Current offset
 * @param {boolean} props.pagination.has_more - Whether more records exist
 * @param {function} props.onPageChange - Callback when page changes (receives new offset)
 * @param {function} props.onLimitChange - Callback when limit changes (receives new limit)
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {boolean} props.loading - Whether data is loading
 * @returns {JSX.Element} Pagination controls component
 */
function PaginationControls({
  pagination,
  onPageChange,
  onLimitChange,
  darkMode = false,
  loading = false
}) {
  const { total, limit, offset, has_more } = pagination;

  // Calculate current page and total pages
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startRecord = total === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + limit, total);

  // Check if navigation is possible
  const canGoPrevious = offset > 0;
  const canGoNext = has_more || (offset + limit < total);

  const handlePrevious = () => {
    if (canGoPrevious && !loading) {
      const newOffset = Math.max(0, offset - limit);
      onPageChange(newOffset);
    }
  };

  const handleNext = () => {
    if (canGoNext && !loading) {
      const newOffset = offset + limit;
      onPageChange(newOffset);
    }
  };

  const handleFirst = () => {
    if (canGoPrevious && !loading) {
      onPageChange(0);
    }
  };

  const handleLast = () => {
    if (canGoNext && !loading && totalPages > 0) {
      const lastOffset = (totalPages - 1) * limit;
      onPageChange(lastOffset);
    }
  };

  const handleLimitChange = (e) => {
    if (!loading) {
      const newLimit = parseInt(e.target.value, 10);
      onLimitChange(newLimit);
    }
  };

  return (
    <div className={`
      border-t px-4 py-2
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
    `}>
      {/* Page size selector */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <label
            htmlFor="page-size"
            className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Per page:
          </label>
          <select
            id="page-size"
            value={limit}
            onChange={handleLimitChange}
            disabled={loading}
            className={`
              text-xs rounded px-2 py-1 border
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300 text-gray-700'}
              ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        {/* Record count */}
        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {total > 0 ? (
            <>
              {startRecord}-{endRecord} of {total}
            </>
          ) : (
            'No records'
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {/* First page button */}
          <button
            onClick={handleFirst}
            disabled={!canGoPrevious || loading}
            title="First page"
            className={`
              p-1 rounded transition-colors
              ${!canGoPrevious || loading
                ? 'opacity-30 cursor-not-allowed'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Previous page button */}
          <button
            onClick={handlePrevious}
            disabled={!canGoPrevious || loading}
            title="Previous page"
            className={`
              p-1 rounded transition-colors
              ${!canGoPrevious || loading
                ? 'opacity-30 cursor-not-allowed'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Page indicator */}
        <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {totalPages > 0 ? (
            <>Page {currentPage} of {totalPages}</>
          ) : (
            'Page 1 of 1'
          )}
        </div>

        <div className="flex items-center space-x-1">
          {/* Next page button */}
          <button
            onClick={handleNext}
            disabled={!canGoNext || loading}
            title="Next page"
            className={`
              p-1 rounded transition-colors
              ${!canGoNext || loading
                ? 'opacity-30 cursor-not-allowed'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Last page button */}
          <button
            onClick={handleLast}
            disabled={!canGoNext || loading}
            title="Last page"
            className={`
              p-1 rounded transition-colors
              ${!canGoNext || loading
                ? 'opacity-30 cursor-not-allowed'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-2 flex items-center justify-center">
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

PaginationControls.propTypes = {
  pagination: PropTypes.shape({
    total: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
    offset: PropTypes.number.isRequired,
    has_more: PropTypes.bool
  }).isRequired,
  onPageChange: PropTypes.func.isRequired,
  onLimitChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
  loading: PropTypes.bool
};

export default React.memo(PaginationControls);
