import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from './AppLayout';

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

    // Memoize customer grouping
    const { activeCustomers, inactiveCustomers } = useMemo(() => {
        return customers.reduce((acc, customer) => {
            if (customer.isActive) {
                acc.activeCustomers.push(customer);
            } else {
                acc.inactiveCustomers.push(customer);
            }
            return acc;
        }, { activeCustomers: [], inactiveCustomers: [] });
    }, [customers]);

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
                {customerStats && (
                    <div className={`
                        mt-2 text-sm
                        ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                        <span className="font-medium">{customerStats.active}</span> active,{' '}
                        <span className="font-medium">{customerStats.total}</span> total
                    </div>
                )}
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