import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

function CustomerHeader({
  customer,
  stats,
  onNewProject,
  onShowActivityReport,
  onEditProspect,
  isProspect = false
}) {
  const { darkMode } = useTheme();
  
  return (
    <div className={`
      border-b pb-4
      ${darkMode ? 'border-gray-700' : 'border-gray-200'}
    `}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">
              {isProspect ? 'Prospect: ' : ''}{customer.Name}
            </h2>
            {isProspect && customer.Industry && (
              <span className={`
                px-3 py-1 rounded-full text-sm font-medium
                ${darkMode
                  ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                }
              `}>
                {customer.Industry}
              </span>
            )}
          </div>
          <div className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {customer.Email && (
              <span className="mr-4">
                {customer.Email}
              </span>
            )}
            {customer.Phone && (
              <span className="mr-4">{customer.Phone}</span>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          {!isProspect ? (
            <>
              <button
                onClick={onShowActivityReport}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                Activity Report
              </button>
              <button
                onClick={onNewProject}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                New Project
              </button>
            </>
          ) : (
            <button
              onClick={onEditProspect}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className={`
            p-3 rounded-lg
            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
          `}>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Active Projects
            </div>
            <div className="text-2xl font-semibold mt-1">
              {stats.open}
            </div>
          </div>
          <div className={`
            p-3 rounded-lg
            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
          `}>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Unbilled Hours
            </div>
            <div className="text-2xl font-semibold mt-1">
              {stats.unbilledHours}
            </div>
          </div>
          <div className={`
            p-3 rounded-lg
            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
          `}>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Total Sales
            </div>
            <div className="text-2xl font-semibold mt-1">
              ${typeof stats.totalSales === 'number' ? stats.totalSales.toFixed(2) : stats.totalSales || '0.00'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

CustomerHeader.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string
  }).isRequired,
  stats: PropTypes.shape({
    open: PropTypes.number,
    unbilledHours: PropTypes.string,
    totalSales: PropTypes.number
  }),
  onNewProject: PropTypes.func,
  onShowActivityReport: PropTypes.func,
  onEditProspect: PropTypes.func,
  isProspect: PropTypes.bool
};

export default CustomerHeader;