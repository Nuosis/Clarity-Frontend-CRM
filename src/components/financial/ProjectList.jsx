import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Project list component for displaying financial data by project
 * @param {Object} props - Component props
 * @param {Object} props.projects - Projects data grouped by project ID
 * @param {string|null} props.selectedProjectId - Currently selected project ID
 * @param {function} props.onProjectSelect - Function to call when a project is selected
 * @param {function} props.onEditRecord - Function to call when a record is edited
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Project list component
 */
function ProjectList({ projects, selectedProjectId = null, onProjectSelect, onEditRecord, darkMode = false }) {
  // Debug logs
  console.log("ProjectList rendering with props:", {
    projectsCount: Object.keys(projects).length,
    selectedProjectId
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'totalAmount',
    direction: 'desc'
  });

  // Convert projects object to array for sorting
  const projectsArray = Object.values(projects);

  // Sort projects based on current sort configuration
  const sortedProjects = React.useMemo(() => {
    return [...projectsArray].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [projectsArray, sortConfig]);

  // Handle sort request
  const requestSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Get sort direction indicator
  const getSortDirectionIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  };

  // Format hours for display
  const formatHours = (hours) => {
    return `${hours.toFixed(2)} hrs`;
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className={`
        px-4 py-3 border-b
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Projects
        </h3>
      </div>
      
      {projectsArray.length === 0 ? (
        <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No project data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('projectName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Project</span>
                    <span>{getSortDirectionIndicator('projectName')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('totalAmount')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Amount</span>
                    <span>{getSortDirectionIndicator('totalAmount')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('totalHours')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Hours</span>
                    <span>{getSortDirectionIndicator('totalHours')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={`
              divide-y
              ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}
            `}>
              {sortedProjects.map(project => (
                <React.Fragment key={project.projectId}>
                  <tr 
                    onClick={() => onProjectSelect(project.projectId)}
                    className={`
                      cursor-pointer transition-colors
                      ${selectedProjectId === project.projectId 
                        ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50') 
                        : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}
                      ${darkMode ? 'text-gray-200' : 'text-gray-900'}
                    `}
                  >
                    <td className="px-4 py-3 text-sm">
                      {project.projectName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(project.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(project.totalHours)}
                    </td>
                  </tr>
                  
                  {/* Records for selected project */}
                  {selectedProjectId === project.projectId && (
                    <tr className={darkMode ? 'bg-gray-900' : 'bg-gray-50'}>
                      <td colSpan="3" className="px-0 py-0">
                        <div className="max-h-80 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
                              <tr>
                                <th className={`
                                  px-4 py-2 text-left text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Date
                                </th>
                                <th className={`
                                  px-4 py-2 text-left text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Description
                                </th>
                                <th className={`
                                  px-4 py-2 text-right text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Hours
                                </th>
                                <th className={`
                                  px-4 py-2 text-right text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Amount
                                </th>
                                <th className={`
                                  px-4 py-2 text-center text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Status
                                </th>
                                <th className={`
                                  px-4 py-2 text-center text-xs font-medium uppercase tracking-wider
                                  ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className={`
                              divide-y
                              ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}
                            `}>
                              {project.records.map(record => (
                                <tr 
                                  key={record.id}
                                  className={darkMode ? 'text-gray-300' : 'text-gray-800'}
                                >
                                  <td className="px-4 py-2 text-xs">
                                    {new Date(record.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-2 text-xs max-w-xs truncate">
                                    {record.description}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-right">
                                    {formatHours(record.hours)}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-right">
                                    {formatCurrency(record.amount)}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-center">
                                    <span className={`
                                      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                      ${record.billed 
                                        ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                                        : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                                    `}>
                                      {record.billed ? 'Billed' : 'Unbilled'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditRecord(record);
                                      }}
                                      className={`
                                        inline-flex items-center px-2 py-1 border rounded-md text-xs font-medium
                                        ${darkMode 
                                          ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}
                                      `}
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

ProjectList.propTypes = {
  projects: PropTypes.object.isRequired,
  selectedProjectId: PropTypes.string,
  onProjectSelect: PropTypes.func.isRequired,
  onEditRecord: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(ProjectList);