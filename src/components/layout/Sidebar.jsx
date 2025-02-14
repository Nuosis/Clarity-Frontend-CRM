import React from 'react';
import { useTheme } from './AppLayout';

export default function Sidebar({ 
  customers = [], 
  selectedCustomer = null,
  onCustomerSelect = () => {}
}) {
  const { darkMode } = useTheme();

  // Group customers by active status
  const activeCustomers = customers.filter(c => c.fieldData.f_active === 1);
  const inactiveCustomers = customers.filter(c => c.fieldData.f_active !== 1);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Customers
        </h1>
      </div>

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto">
        {/* Active customers */}
        <div className="p-2">
          <h2 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Active
          </h2>
          {activeCustomers.map(customer => (
            <CustomerItem
              key={customer.fieldData.__ID}
              customer={customer}
              isSelected={selectedCustomer?.fieldData.__ID === customer.fieldData.__ID}
              onClick={() => onCustomerSelect(customer)}
              isActive={true}
            />
          ))}
        </div>

        {/* Inactive customers */}
        {inactiveCustomers.length > 0 && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <h2 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Inactive
            </h2>
            {inactiveCustomers.map(customer => (
              <CustomerItem
                key={customer.fieldData.__ID}
                customer={customer}
                isSelected={selectedCustomer?.fieldData.__ID === customer.fieldData.__ID}
                onClick={() => onCustomerSelect(customer)}
                isActive={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerItem({ customer, isSelected, onClick, isActive }) {
  const { darkMode } = useTheme();
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2 rounded-md mb-1
        transition-colors duration-150 ease-in-out
        ${isSelected 
          ? 'bg-blue-100 dark:bg-blue-900' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }
        ${isActive 
          ? 'text-gray-900 dark:text-white' 
          : 'text-gray-500 dark:text-gray-400'
        }
      `}
    >
      <div className="truncate text-sm font-medium">
        {customer.fieldData.Name}
      </div>
      {customer.fieldData.OBSI_ClientNo && (
        <div className={`
          text-xs truncate
          ${isActive 
            ? 'text-gray-500 dark:text-gray-400' 
            : 'text-gray-400 dark:text-gray-500'
          }
        `}>
          #{customer.fieldData.OBSI_ClientNo}
        </div>
      )}
    </button>
  );
}