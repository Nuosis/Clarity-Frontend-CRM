import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from './AppLayout';
import { calculateRecordsUnbilledHours } from '../../services/projectService';
import { useProject } from '../../hooks/useProject';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';

// Memoized customer list item
const CustomerListItem = React.memo(function CustomerListItem({
    customer,
    isSelected,
    darkMode,
    onSelect,
    onStatusToggle
}) {
    const handleStatusToggle = (e) => {
        e.stopPropagation();
        onStatusToggle(customer.id, !customer.isActive);
    };

    return (
        <div
            onClick={() => onSelect(customer)}
            className={`
                p-4 cursor-pointer border-b last:border-b-0
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                ${isSelected 
                    ? (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                    : (darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                ${customer.isActive 
                    ? ''
                    : (darkMode ? 'opacity-50' : 'opacity-60')}
            `}
        >
            <div className="flex items-center">
                <h3 className={`
                    font-medium
                    ${isSelected
                        ? (darkMode ? 'text-white' : 'text-gray-900')
                        : (darkMode ? 'text-gray-300' : 'text-gray-700')}
                `}>
                    {customer.Name}
                </h3>
            </div>
        </div>
    );
});

CustomerListItem.propTypes = {
    customer: PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        isActive: PropTypes.bool.isRequired
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onStatusToggle: PropTypes.func.isRequired
};

function Sidebar({
    customers,
    selectedCustomer = null,
    customerStats = null,
    onCustomerSelect,
    onCustomerStatusToggle
}) {
    const { darkMode } = useTheme();
    const { projects, projectRecords } = useProject();
    const { showFinancialActivity } = useAppState();
    const { setShowFinancialActivity } = useAppStateOperations();
    //console.log(projectRecords)

    // Memoize customer grouping and stats
    const { activeCustomers, inactiveCustomers, stats } = useMemo(() => {
        // Calculate stats
        const unbilledHours = calculateRecordsUnbilledHours(projectRecords, true); // true for current month only

        // Group customers
        const groups = customers.reduce((acc, customer) => {
            if (customer.isActive) {
                acc.activeCustomers.push(customer);
            } else {
                acc.inactiveCustomers.push(customer);
            }
            return acc;
        }, { activeCustomers: [], inactiveCustomers: [] });
        
        // Destructure from groups
        const { activeCustomers } = groups;

        return {
            ...groups,
            stats: {
                active: activeCustomers.length,
                unbilledHours
            }
        };
    }, [customers, projects, projectRecords]);

    return (
        <div className={`
            w-64 h-screen flex-shrink-0 border-r flex flex-col
            ${darkMode ? 'bg-gray-950 border-gray-700' : 'bg-gray-50 border-gray-200'}
        `}>
            {/* Header */}
            <div className={`
                p-4 border-b
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <h2 className={`
                    text-lg font-semibold
                    ${darkMode ? 'text-white' : 'text-gray-900'}
                `}>
                    Customers
                </h2>
                {stats && (
                    <div className={`
                        mt-2 text-sm
                        ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                        <span className="font-medium">{stats.active}</span> active,{' '}
                        <span className="font-medium">{stats.unbilledHours}</span> unbilled hours
                    </div>
                )}
                
                {/* Financial Activity Button */}
                <button
                    onClick={() => setShowFinancialActivity(true)}
                    className={`
                        mt-4 w-full flex items-center justify-center px-4 py-2 rounded-md
                        ${showFinancialActivity
                            ? (darkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800')
                            : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                    `}
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Financial Activity
                </button>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto">
                {/* Customer List */}
                {activeCustomers.length > 0 && activeCustomers.map(customer => (
                    <CustomerListItem
                        key={customer.id}
                        customer={customer}
                        isSelected={selectedCustomer?.id === customer.id}
                        darkMode={darkMode}
                        onSelect={() => onCustomerSelect(customer)}
                        onStatusToggle={onCustomerStatusToggle}
                    />
                ))}

                {inactiveCustomers.length > 0 && inactiveCustomers.map(customer => (
                    <CustomerListItem
                        key={customer.id}
                        customer={customer}
                        isSelected={selectedCustomer?.id === customer.id}
                        darkMode={darkMode}
                        onSelect={() => onCustomerSelect(customer)}
                        onStatusToggle={onCustomerStatusToggle}
                    />
                ))}

                {/* Empty State */}
                {customers.length === 0 && (
                    <div className={`
                        p-4 text-center
                        ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                        No customers found
                    </div>
                )}
            </div>
        </div>
    );
}

Sidebar.propTypes = {
    customers: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        isActive: PropTypes.bool.isRequired
    })).isRequired,
    selectedCustomer: PropTypes.shape({
        id: PropTypes.string.isRequired
    }),
    customerStats: PropTypes.shape({
        total: PropTypes.number.isRequired,
        active: PropTypes.number.isRequired,
        inactive: PropTypes.number.isRequired,
        activePercentage: PropTypes.number.isRequired
    }),
    onCustomerSelect: PropTypes.func.isRequired,
    onCustomerStatusToggle: PropTypes.func.isRequired
};

export default React.memo(Sidebar);