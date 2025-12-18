import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { query } from '../../services/supabaseService';

function CustomerHeader({
  customer,
  stats,
  onNewProject,
  onShowActivityReport,
  onEditProspect,
  onConvertToCustomer,
  isProspect = false
}) {
  const { darkMode } = useTheme();
  const [vapiTesting, setVapiTesting] = useState(false);

  // Load VAPI Testing flag
  useEffect(() => {
    const loadVapiTestingFlag = async () => {
      const customerId = customer?.__ID || customer?.id;
      if (!customerId) return;

      try {
        const result = await query('customer_settings', {
          select: '*',
          filter: [
            {
              column: 'customer_id',
              operator: 'eq',
              value: customerId
            },
            {
              column: 'type',
              operator: 'eq',
              value: 'VAPI_TEST'
            }
          ]
        });

        if (result.success && result.data && result.data.length > 0) {
          const setting = result.data[0];
          const value = setting.data;
          setVapiTesting(value === true || value === 'true' || value === '1');
        } else {
          setVapiTesting(false);
        }
      } catch (error) {
        console.error('Error loading VAPI Testing flag:', error);
        setVapiTesting(false);
      }
    };

    loadVapiTestingFlag();
  }, [customer?.__ID, customer?.id]);
  
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
            {vapiTesting && (
              <span className={`
                px-3 py-1 rounded-full text-sm font-medium
                ${darkMode
                  ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                  : 'bg-green-100 text-green-700 border border-green-200'
                }
              `}>
                VAPI Testing
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
            <>
              <button
                onClick={onConvertToCustomer}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Convert to Customer
              </button>
              <button
                onClick={onEditProspect}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                Edit
              </button>
            </>
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
  onConvertToCustomer: PropTypes.func,
  isProspect: PropTypes.bool
};

export default CustomerHeader;