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
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <h3 className={`
                        font-medium
                        ${isSelected 
                            ? (darkMode ? 'text-white' : 'text-gray-900')
                            : (darkMode ? 'text-gray-300' : 'text-gray-700')}
                    `}>
                        {customer.Name}
                    </h3>
                    {customer.Email && (
                        <p className={`
                            text-sm mt-1
                            ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                        `}>
                            {customer.Email}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleStatusToggle}
                    className={`
                        ml-2 p-1 rounded-full
                        ${customer.isActive
                            ? (darkMode ? 'bg-green-500' : 'bg-green-600')
                            : (darkMode ? 'bg-gray-600' : 'bg-gray-400')}
                        hover:opacity-80 transition-opacity
                    `}
                >
                    <span className="sr-only">
                        {customer.isActive ? 'Deactivate' : 'Activate'} customer
                    </span>
                    <div className={`
                        w-2 h-2 rounded-full
                        ${customer.isActive ? 'bg-white' : 'bg-gray-200'}
                    `} />
                </button>
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
    selectedCustomer,
    customerStats,
    onCustomerSelect,
    onCustomerStatusToggle
}) {
    const { darkMode } = useTheme();

    // Memoize customer grouping
    const { activeCustomers, inactiveCustomers } = useMemo(() => {
        return customers.reduce((acc, customer) => {
            if (customer.fieldData.f_active === "1" || customer.fieldData.f_active === 1) {
                acc.activeCustomers.push(customer);
            } else {
                acc.inactiveCustomers.push(customer);
            }
            return acc;
        }, { activeCustomers: [], inactiveCustomers: [] });
    }, [customers]);

    return (
        <div className={`
            w-64 flex-shrink-0 border-r overflow-hidden flex flex-col
            ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}
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
                {/* Active Customers */}
                {activeCustomers.length > 0 && (
                    <div>
                        <div className={`
                            px-4 py-2 text-xs font-medium
                            ${darkMode ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-50'}
                        `}>
                            Active Customers
                        </div>
                        {activeCustomers.map(customer => (
                            <CustomerListItem
                                key={customer.fieldData.__ID}
                                customer={{
                                    id: customer.fieldData.__ID,
                                    Name: customer.fieldData.Name,
                                    Email: customer.fieldData.Email,
                                    isActive: true
                                }}
                                isSelected={selectedCustomer?.fieldData.__ID === customer.fieldData.__ID}
                                darkMode={darkMode}
                                onSelect={() => onCustomerSelect(customer)}
                                onStatusToggle={onCustomerStatusToggle}
                            />
                        ))}
                    </div>
                )}

                {/* Inactive Customers */}
                {inactiveCustomers.length > 0 && (
                    <div>
                        <div className={`
                            px-4 py-2 text-xs font-medium
                            ${darkMode ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-50'}
                        `}>
                            Inactive Customers
                        </div>
                        {inactiveCustomers.map(customer => (
                            <CustomerListItem
                                key={customer.fieldData.__ID}
                                customer={{
                                    id: customer.fieldData.__ID,
                                    Name: customer.fieldData.Name,
                                    Email: customer.fieldData.Email,
                                    isActive: false
                                }}
                                isSelected={selectedCustomer?.fieldData.__ID === customer.fieldData.__ID}
                                darkMode={darkMode}
                                onSelect={() => onCustomerSelect(customer)}
                                onStatusToggle={onCustomerStatusToggle}
                            />
                        ))}
                    </div>
                )}

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
        fieldData: PropTypes.shape({
            __ID: PropTypes.string.isRequired,
            Name: PropTypes.string.isRequired,
            Email: PropTypes.string,
            f_active: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.number
            ]).isRequired
        }).isRequired
    })).isRequired,
    selectedCustomer: PropTypes.shape({
        fieldData: PropTypes.shape({
            __ID: PropTypes.string.isRequired
        }).isRequired
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

Sidebar.defaultProps = {
    selectedCustomer: null,
    customerStats: null
};

export default React.memo(Sidebar);