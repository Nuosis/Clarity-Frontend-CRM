import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

function CustomerTabs({ customer }) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('sales');
  
  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex mb-4">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 font-medium focus:outline-none important! relative ${
            activeTab === 'sales'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Sales
          {activeTab === 'sales' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('communication')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'communication'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Communication
          {activeTab === 'communication' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'settings'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Settings
          {activeTab === 'settings' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
      </div>
      
      {/* Tab Content */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {/* Customer Sales Tab */}
        {activeTab === 'sales' && (
          <div>
            <h4 className="text-lg font-medium mb-4">Products and Services</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Product/Service
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">Website Development</td>
                    <td className="px-6 py-4 whitespace-nowrap">04/15/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">1</td>
                    <td className="px-6 py-4 whitespace-nowrap">$2,500.00</td>
                    <td className="px-6 py-4 whitespace-nowrap">$2,500.00</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">SEO Package</td>
                    <td className="px-6 py-4 whitespace-nowrap">04/20/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">1</td>
                    <td className="px-6 py-4 whitespace-nowrap">$750.00</td>
                    <td className="px-6 py-4 whitespace-nowrap">$750.00</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">Maintenance Hours</td>
                    <td className="px-6 py-4 whitespace-nowrap">04/22/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">5</td>
                    <td className="px-6 py-4 whitespace-nowrap">$125.00</td>
                    <td className="px-6 py-4 whitespace-nowrap">$625.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Customer Communication Tab */}
        {activeTab === 'communication' && (
          <div>
            <h4 className="text-lg font-medium mb-4">Communication Logs</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Subject
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/25/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Email</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customer.Email || 'john@example.com'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Project Update</td>
                    <td className="px-6 py-4">Sent weekly progress report on website development</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/23/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Phone</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customer.Phone || '555-123-4567'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Requirements Clarification</td>
                    <td className="px-6 py-4">Discussed additional requirements for the contact form</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/20/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Email</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customer.Email || 'john@example.com'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Invoice #1234</td>
                    <td className="px-6 py-4">Sent invoice for initial payment</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Customer Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h4 className="text-lg font-medium mb-4">Customer Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium mb-2">Billing Information</h5>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Billable Currency</label>
                    <div className="text-base">USD</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Billing Address</label>
                    <div className="text-base">
                      {customer.Address || '123 Business St.'}<br />
                      {customer.City || 'San Francisco'}, {customer.State || 'CA'} {customer.PostalCode || '94103'}<br />
                      {customer.Country || 'USA'}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Payment Terms</label>
                    <div className="text-base">Net 30</div>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-2">Contact Information</h5>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Primary Contact</label>
                    <div className="text-base">John Smith</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <div className="text-base">{customer.Email || 'john@example.com'}</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <div className="text-base">{customer.Phone || '555-123-4567'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

CustomerTabs.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Address: PropTypes.string,
    City: PropTypes.string,
    State: PropTypes.string,
    PostalCode: PropTypes.string,
    Country: PropTypes.string
  }).isRequired
};

export default CustomerTabs;