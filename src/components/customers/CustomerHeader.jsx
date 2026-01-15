import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { query } from '../../services/supabaseService';
import { formatPhoneDisplay } from '../../utils/phoneUtils';
import { extractPrimaryContact, extractPrimaryAddress } from '../../services/customerService';

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
  const [nestedContacts, setNestedContacts] = useState({
    emails: [],
    phones: [],
    addresses: [],
    loading: true
  });

  // Load VAPI Testing flag and nested contact data
  useEffect(() => {
    const loadCustomerData = async () => {
      const customerId = customer?.__ID || customer?.id;
      if (!customerId) return;

      try {
        // Load VAPI Testing flag
        const settingsResult = await query('customer_settings', {
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

        if (settingsResult.success && settingsResult.data && settingsResult.data.length > 0) {
          const setting = settingsResult.data[0];
          const value = setting.data;
          setVapiTesting(value === true || value === 'true' || value === '1');
        } else {
          setVapiTesting(false);
        }

        // Load nested contact information from backend/Supabase
        const [emailsResult, phonesResult, addressesResult] = await Promise.all([
          query('customer_email', {
            select: '*',
            filter: { column: 'customer_id', operator: 'eq', value: customerId }
          }),
          query('customer_phone', {
            select: '*',
            filter: { column: 'customer_id', operator: 'eq', value: customerId }
          }),
          query('customer_address', {
            select: '*',
            filter: { column: 'customer_id', operator: 'eq', value: customerId }
          })
        ]);

        setNestedContacts({
          emails: emailsResult.success && emailsResult.data ? emailsResult.data : [],
          phones: phonesResult.success && phonesResult.data ? phonesResult.data : [],
          addresses: addressesResult.success && addressesResult.data ? addressesResult.data : [],
          loading: false
        });
      } catch (error) {
        console.error('Error loading customer data:', error);
        setVapiTesting(false);
        setNestedContacts({ emails: [], phones: [], addresses: [], loading: false });
      }
    };

    loadCustomerData();
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
            {(() => {
              // Determine contact information based on data source
              let displayEmail = null;
              let displayPhone = null;
              let additionalEmailsCount = 0;
              let additionalPhonesCount = 0;

              if (!nestedContacts.loading && (nestedContacts.emails.length > 0 || nestedContacts.phones.length > 0)) {
                // Use nested backend data if available
                displayEmail = extractPrimaryContact(nestedContacts.emails, 'email');
                displayPhone = extractPrimaryContact(nestedContacts.phones, 'phone');
                additionalEmailsCount = nestedContacts.emails.length > 1 ? nestedContacts.emails.length - 1 : 0;
                additionalPhonesCount = nestedContacts.phones.length > 1 ? nestedContacts.phones.length - 1 : 0;
              } else {
                // Fallback to flat FileMaker data
                displayEmail = customer.Email;
                displayPhone = customer.Phone;
              }

              return (
                <>
                  {displayEmail && (
                    <span className="mr-4 inline-flex items-center gap-1">
                      <span>{displayEmail}</span>
                      {additionalEmailsCount > 0 && (
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full font-medium
                          ${darkMode
                            ? 'bg-blue-900/30 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                          }
                        `} title={`${additionalEmailsCount} additional email${additionalEmailsCount > 1 ? 's' : ''}`}>
                          +{additionalEmailsCount}
                        </span>
                      )}
                    </span>
                  )}
                  {displayPhone && (
                    <span className="mr-4 inline-flex items-center gap-1">
                      <span>{formatPhoneDisplay(displayPhone)}</span>
                      {additionalPhonesCount > 0 && (
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full font-medium
                          ${darkMode
                            ? 'bg-blue-900/30 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                          }
                        `} title={`${additionalPhonesCount} additional phone${additionalPhonesCount > 1 ? 's' : ''}`}>
                          +{additionalPhonesCount}
                        </span>
                      )}
                    </span>
                  )}
                  {!displayEmail && !displayPhone && !nestedContacts.loading && (
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                      No contact information
                    </span>
                  )}
                </>
              );
            })()}
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