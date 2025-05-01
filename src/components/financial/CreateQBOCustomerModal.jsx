import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal component for creating a customer in QuickBooks Online
 * @param {Object} props - Component props
 * @param {string} props.customerName - Initial customer name
 * @param {function} props.onClose - Function to call when modal is closed
 * @param {function} props.onSave - Function to call when customer is created
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Create QBO Customer modal component
 */
function CreateQBOCustomerModal({ customerName, onClose, onSave, darkMode = false }) {
  const [formData, setFormData] = useState({
    DisplayName: customerName || '',
    CompanyName: customerName || '',
    GivenName: '',
    FamilyName: '',
    PrimaryEmailAddr: { Address: '' },
    PrimaryPhone: { FreeFormNumber: '' },
    CurrencyRef: { value: 'CAD' }
  });
  
  const [errors, setErrors] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'email') {
      setFormData(prev => ({
        ...prev,
        PrimaryEmailAddr: { Address: value }
      }));
    } else if (name === 'phone') {
      setFormData(prev => ({
        ...prev,
        PrimaryPhone: { FreeFormNumber: value }
      }));
    } else if (name === 'currency') {
      setFormData(prev => ({
        ...prev,
        CurrencyRef: { value }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    const validationErrors = [];
    if (!formData.DisplayName) validationErrors.push('Display Name is required');
    if (!formData.CompanyName) validationErrors.push('Company Name is required');
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsCreating(true);
    setErrors([]);
    
    try {
      // Prepare customer data for QBO
      // Only include CurrencyRef if it's not CAD (default)
      const customerData = {
        ...formData,
        ...(formData.CurrencyRef.value === 'CAD' ? {} : { CurrencyRef: formData.CurrencyRef })
      };
      
      await onSave(customerData);
      onClose();
    } catch (error) {
      setErrors([error.message || 'Failed to create customer']);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle modal backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div 
        className={`
          relative w-full max-w-md p-6 rounded-lg shadow-xl
          ${darkMode ? 'bg-gray-800' : 'bg-white'}
        `}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Create QuickBooks Customer
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`
              rounded-md p-1 inline-flex items-center justify-center
              ${darkMode 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
            `}
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Error messages */}
        {errors.length > 0 && (
          <div className={`
            mb-4 p-3 rounded-md
            ${darkMode ? 'bg-red-900 bg-opacity-50 text-red-200' : 'bg-red-50 text-red-800'}
          `}>
            <ul className="list-disc pl-5 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Display Name and Company Name */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label 
                  htmlFor="DisplayName" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Display Name*
                </label>
                <input
                  type="text"
                  id="DisplayName"
                  name="DisplayName"
                  value={formData.DisplayName}
                  onChange={handleChange}
                  required
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
              <div>
                <label 
                  htmlFor="CompanyName" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Company Name*
                </label>
                <input
                  type="text"
                  id="CompanyName"
                  name="CompanyName"
                  value={formData.CompanyName}
                  onChange={handleChange}
                  required
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
            </div>
            
            {/* First Name and Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="GivenName"
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  First Name
                </label>
                <input
                  type="text"
                  id="GivenName"
                  name="GivenName"
                  value={formData.GivenName}
                  onChange={handleChange}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
              <div>
                <label
                  htmlFor="FamilyName"
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="FamilyName"
                  name="FamilyName"
                  value={formData.FamilyName}
                  onChange={handleChange}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
            </div>
            
            {/* Email and Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label 
                  htmlFor="email" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.PrimaryEmailAddr.Address}
                  onChange={handleChange}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
              <div>
                <label 
                  htmlFor="phone" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.PrimaryPhone.FreeFormNumber}
                  onChange={handleChange}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                />
              </div>
            </div>
            
            {/* Currency */}
            <div>
              <label 
                className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Currency
              </label>
              <div className="flex flex-wrap gap-4">
                {['CAD', 'USD', 'EUR', 'GBP', 'AUD'].map(currency => (
                  <label key={currency} className="inline-flex items-center">
                    <input
                      type="radio"
                      name="currency"
                      value={currency}
                      checked={formData.CurrencyRef.value === currency}
                      onChange={handleChange}
                      className={`form-radio h-4 w-4 ${
                        darkMode ? 'text-blue-600' : 'text-blue-500'
                      }`}
                    />
                    <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {currency}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-4 py-2 text-sm font-medium rounded-md
                ${darkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
              `}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`
                px-4 py-2 text-sm font-medium rounded-md
                ${darkMode 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'}
                ${isCreating ? 'opacity-75 cursor-not-allowed' : ''}
              `}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateQBOCustomerModal.propTypes = {
  customerName: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default CreateQBOCustomerModal;