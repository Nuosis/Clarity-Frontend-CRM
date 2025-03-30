import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';

function ProjectList({
    projects = [],
    onProjectSelect = () => {},
    onProjectRemove = null,
    maxHeight = "400px"
}) {
    const { darkMode } = useTheme();
    const { setLoading } = useAppStateOperations();
    const [sortConfig, setSortConfig] = useState({
        key: 'customerName',
        direction: 'asc'
    });
    const [expandedCustomers, setExpandedCustomers] = useState({});

    // Debug log to understand project structure
    useEffect(() => {
        if (projects.length > 0) {
            console.log('Project structure sample:', projects[0]);
        }
    }, [projects]);

    // Group projects by customer name and status
    const groupedProjects = useMemo(() => {
        const groups = {};
        
        projects.forEach(project => {
            // Extract customer name from various possible locations in the data structure
            let customerName = 'Unknown Customer';
            
            if (project.fieldData && project.fieldData.Customers__Name) {
                customerName = project.fieldData.Customers__Name;
            } else if (project.Customers__Name) {
                customerName = project.Customers__Name;
            } else if (project.fieldData && project.fieldData['Customers::Name']) {
                customerName = project.fieldData['Customers::Name'];
            } else if (project['Customers::Name']) {
                customerName = project['Customers::Name'];
            }
            
            // Don't log here to avoid infinite loop
            
            // Create customer group if it doesn't exist
            if (!groups[customerName]) {
                groups[customerName] = {
                    customerName,
                    open: [],
                    closed: []
                };
            }
            
            // Add project to appropriate status group
            const status = project.status || project.fieldData?.status || 'Unknown';
            if (status.toLowerCase() === 'open') {
                groups[customerName].open.push(project);
            } else {
                groups[customerName].closed.push(project);
            }
        });
        
        return groups;
    }, [projects]);

    // Get sorted customer names
    const sortedCustomers = useMemo(() => {
        return Object.values(groupedProjects).sort((a, b) => {
            if (sortConfig.key === 'customerName') {
                const comparison = a.customerName.localeCompare(b.customerName);
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            } else if (sortConfig.key === 'totalProjects') {
                const aTotal = a.open.length + a.closed.length;
                const bTotal = b.open.length + b.closed.length;
                return sortConfig.direction === 'asc' ? aTotal - bTotal : bTotal - aTotal;
            } else if (sortConfig.key === 'openProjects') {
                return sortConfig.direction === 'asc' ? a.open.length - b.open.length : b.open.length - a.open.length;
            }
            return 0;
        });
    }, [groupedProjects, sortConfig]);

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

    // Toggle customer expansion
    const toggleCustomerExpansion = (customerName) => {
        setExpandedCustomers(prev => ({
            ...prev,
            [customerName]: !prev[customerName]
        }));
    };

    if (projects.length === 0) {
        return (
            <div className={`
                text-center py-8 rounded-lg border
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-400' 
                    : 'bg-gray-50 border-gray-200 text-gray-500'}
            `}>
                No projects assigned to this team
            </div>
        );
    }

    return (
        <div className={`
            rounded-lg border overflow-hidden
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
            <div style={{ maxHeight }} className="overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                        <tr>
                            <th 
                                scope="col" 
                                className={`
                                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                                `}
                                onClick={() => requestSort('customerName')}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Customer</span>
                                    <span>{getSortDirectionIndicator('customerName')}</span>
                                </div>
                            </th>
                            <th 
                                scope="col" 
                                className={`
                                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                                `}
                                onClick={() => requestSort('totalProjects')}
                            >
                                <div className="flex items-center justify-end space-x-1">
                                    <span>Total</span>
                                    <span>{getSortDirectionIndicator('totalProjects')}</span>
                                </div>
                            </th>
                            <th 
                                scope="col" 
                                className={`
                                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                                `}
                                onClick={() => requestSort('openProjects')}
                            >
                                <div className="flex items-center justify-end space-x-1">
                                    <span>Open</span>
                                    <span>{getSortDirectionIndicator('openProjects')}</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className={`
                        divide-y
                        ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}
                    `}>
                        {sortedCustomers.map(customer => (
                            <React.Fragment key={customer.customerName}>
                                <tr
                                    onClick={() => toggleCustomerExpansion(customer.customerName)}
                                    className={`
                                        cursor-pointer transition-colors
                                        ${expandedCustomers[customer.customerName]
                                            ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50')
                                            : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}
                                        ${darkMode ? 'text-gray-200' : 'text-gray-900'}
                                    `}
                                >
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex items-center">
                                            <span className="mr-2">
                                                {expandedCustomers[customer.customerName] ? '▼' : '▶'}
                                            </span>
                                            <span>{customer.customerName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        {customer.open.length + customer.closed.length}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        {customer.open.length}
                                    </td>
                                </tr>
                                
                                {/* Expanded projects for this customer */}
                                {expandedCustomers[customer.customerName] && (
                                    <tr className={darkMode ? 'bg-gray-900' : 'bg-gray-50'}>
                                        <td colSpan="3" className="px-0 py-0">
                                            <div className="p-3">
                                                {/* Open Projects */}
                                                {customer.open.length > 0 && (
                                                    <div className="mb-4">
                                                        <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                            Open Projects ({customer.open.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {customer.open.map(project => (
                                                                <div
                                                                    key={project.id}
                                                                    className={`
                                                                        p-2 rounded flex justify-between items-center
                                                                        ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}
                                                                        cursor-pointer
                                                                    `}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        console.log('Project clicked:', project);
                                                                        setLoading(true);
                                                                        
                                                                        // Ensure project has the correct ID format
                                                                        const projectWithCorrectId = {
                                                                            ...project,
                                                                            __ID: project.__ID || project.id || project.recordId
                                                                        };
                                                                        
                                                                        // Call onProjectSelect with the project data
                                                                        onProjectSelect(projectWithCorrectId);
                                                                        console.log('onProjectSelect called with:', projectWithCorrectId);
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                            {project.projectName}
                                                                        </div>
                                                                        {project.estOfTime && (
                                                                            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                                Est: {project.estOfTime}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {onProjectRemove && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onProjectRemove(project.id);
                                                                            }}
                                                                            className={`
                                                                                p-1 rounded-md
                                                                                ${darkMode
                                                                                    ? 'text-gray-400 hover:bg-red-900 hover:text-white'
                                                                                    : 'text-gray-500 hover:bg-red-100 hover:text-red-700'}
                                                                            `}
                                                                            title="Remove from team"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Closed Projects */}
                                                {customer.closed.length > 0 && (
                                                    <div>
                                                        <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                            Closed Projects ({customer.closed.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {customer.closed.map(project => (
                                                                <div
                                                                    key={project.id}
                                                                    className={`
                                                                        p-2 rounded flex justify-between items-center
                                                                        ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}
                                                                        cursor-pointer
                                                                    `}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        console.log('Closed project clicked:', project);
                                                                        setLoading(true);
                                                                        
                                                                        // Ensure project has the correct ID format
                                                                        const projectWithCorrectId = {
                                                                            ...project,
                                                                            __ID: project.__ID || project.id || project.recordId
                                                                        };
                                                                        
                                                                        // Call onProjectSelect with the project data
                                                                        onProjectSelect(projectWithCorrectId);
                                                                        console.log('onProjectSelect called for closed project with:', projectWithCorrectId);
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                            {project.projectName}
                                                                        </div>
                                                                        {project.estOfTime && (
                                                                            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                                Est: {project.estOfTime}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {onProjectRemove && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onProjectRemove(project.id);
                                                                            }}
                                                                            className={`
                                                                                p-1 rounded-md
                                                                                ${darkMode
                                                                                    ? 'text-gray-400 hover:bg-red-900 hover:text-white'
                                                                                    : 'text-gray-500 hover:bg-red-100 hover:text-red-700'}
                                                                            `}
                                                                            title="Remove from team"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

ProjectList.propTypes = {
    projects: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            projectName: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            estOfTime: PropTypes.string,
            objectives: PropTypes.array,
            tasks: PropTypes.array
        })
    ),
    onProjectSelect: PropTypes.func,
    onProjectRemove: PropTypes.func,
    maxHeight: PropTypes.string
};

export default React.memo(ProjectList);