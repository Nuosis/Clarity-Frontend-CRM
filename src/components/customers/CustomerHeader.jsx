import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

function CustomerHeader({ 
  customer, 
  stats, 
  onNewProject, 
  onShowActivityReport 
}) {
  const { darkMode } = useTheme();
  
  return (
    <div className={`
      border-b pb-4
      ${darkMode ? 'border-gray-700' : 'border-gray-200'}
    `}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{customer.Name}</h2>
          <div className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {customer.Email && (
              <span className="mr-4">
                {customer.Email}
              </span>
            )}
            {customer.Phone && (
              <span>{customer.Phone}</span>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
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
              {stats.unbilledHours} hrs
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
              ${stats.totalSales || '0.00'}
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
    Phone: PropTypes.string
  }).isRequired,
  stats: PropTypes.shape({
    open: PropTypes.number,
    unbilledHours: PropTypes.string,
    totalSales: PropTypes.number
  }),
  onNewProject: PropTypes.func.isRequired,
  onShowActivityReport: PropTypes.func.isRequired
};

export default CustomerHeader;