import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useSnackBar } from '../../context/SnackBarContext';
import { useAppStateOperations } from '../../context/AppStateContext';
import useProspect from '../../hooks/useProspect';
import {
  sanitizeText,
  validateEmail,
  validatePhone,
  FIELD_LIMITS
} from '../../utils/inputSanitization';

/**
 * Prospect form component for creating or updating a prospect
 * Limited fields: name, email, phone, industry, address
 * @param {Object} props - Component props
 * @param {Object} props.prospect - Existing prospect data for update mode (optional)
 * @param {function} props.onClose - Function to call when the form is closed
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Prospect form component
 */
function ProspectForm({ prospect = null, onClose, darkMode = false }) {
  const { showError } = useSnackBar();
  const { setLoading } = useAppStateOperations();
  const { handleProspectCreate, handleProspectUpdate } = useProspect();
  
  // Determine if we're in update mode
  const isUpdateMode = Boolean(prospect);
  
  // Form state - expanded fields for prospects
  const [formData, setFormData] = useState({
    FirstName: prospect?.FirstName || '',
    LastName: prospect?.LastName || '',
    Email: prospect?.Email || '',
    Phone: prospect?.Phone || '',
    Industry: prospect?.Industry || '',
    AddressLine1: prospect?.AddressLine1 || '',
    AddressLine2: prospect?.AddressLine2 || '',
    City: prospect?.City || '',
    State: prospect?.State || '',
    PostalCode: prospect?.PostalCode || '',
    Country: prospect?.Country || ''
  });
  
  // Form validation state
  const [errors, setErrors] = useState({});
  
  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Sanitize and validate First Name
    const sanitizedFirstName = sanitizeText(formData.FirstName);
    if (!sanitizedFirstName.trim()) {
      newErrors.FirstName = 'First name is required';
    } else if (sanitizedFirstName.length > FIELD_LIMITS.GENERIC_SHORT_TEXT) {
      newErrors.FirstName = `First name must be ${FIELD_LIMITS.GENERIC_SHORT_TEXT} characters or less`;
    }

    // Sanitize and validate Last Name
    const sanitizedLastName = sanitizeText(formData.LastName);
    if (!sanitizedLastName.trim()) {
      newErrors.LastName = 'Last name is required';
    } else if (sanitizedLastName.length > FIELD_LIMITS.GENERIC_SHORT_TEXT) {
      newErrors.LastName = `Last name must be ${FIELD_LIMITS.GENERIC_SHORT_TEXT} characters or less`;
    }

    // Validate Email using utility
    const emailValidation = validateEmail(formData.Email);
    if (!emailValidation.isValid) {
      newErrors.Email = emailValidation.error;
    }

    // Validate Phone if provided
    if (formData.Phone && formData.Phone.trim()) {
      const phoneValidation = validatePhone(formData.Phone);
      if (!phoneValidation.isValid) {
        newErrors.Phone = phoneValidation.error;
      }
    }

    // Validate Industry
    if (formData.Industry && formData.Industry.length > FIELD_LIMITS.GENERIC_SHORT_TEXT) {
      newErrors.Industry = `Industry must be ${FIELD_LIMITS.GENERIC_SHORT_TEXT} characters or less`;
    }

    // Validate Address fields
    if (formData.AddressLine1 && formData.AddressLine1.length > FIELD_LIMITS.CUSTOMER_ADDRESS_LINE) {
      newErrors.AddressLine1 = `Address Line 1 must be ${FIELD_LIMITS.CUSTOMER_ADDRESS_LINE} characters or less`;
    }

    if (formData.AddressLine2 && formData.AddressLine2.length > FIELD_LIMITS.CUSTOMER_ADDRESS_LINE) {
      newErrors.AddressLine2 = `Address Line 2 must be ${FIELD_LIMITS.CUSTOMER_ADDRESS_LINE} characters or less`;
    }

    if (formData.City && formData.City.length > FIELD_LIMITS.CUSTOMER_CITY) {
      newErrors.City = `City must be ${FIELD_LIMITS.CUSTOMER_CITY} characters or less`;
    }

    if (formData.State && formData.State.length > FIELD_LIMITS.CUSTOMER_STATE) {
      newErrors.State = `State must be ${FIELD_LIMITS.CUSTOMER_STATE} characters or less`;
    }

    if (formData.PostalCode && formData.PostalCode.length > FIELD_LIMITS.CUSTOMER_POSTAL_CODE) {
      newErrors.PostalCode = `Postal Code must be ${FIELD_LIMITS.CUSTOMER_POSTAL_CODE} characters or less`;
    }

    if (formData.Country && formData.Country.length > FIELD_LIMITS.CUSTOMER_COUNTRY) {
      newErrors.Country = `Country must be ${FIELD_LIMITS.CUSTOMER_COUNTRY} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      if (isUpdateMode) {
        // Update existing prospect
        await handleProspectUpdate(prospect.id, formData);
        showError('Prospect updated successfully');
      } else {
        // Create new prospect
        await handleProspectCreate(formData);
        showError('Prospect created successfully');
      }
      
      onClose();
    } catch (error) {
      console.error(`Error ${isUpdateMode ? 'updating' : 'creating'} prospect:`, error);
      showError(`Error ${isUpdateMode ? 'updating' : 'creating'} prospect: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isUpdateMode ? 'Update Prospect' : 'Create New Prospect'}
          </h2>
          <button
            onClick={onClose}
            className={`
              p-1 rounded-full
              ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
            `}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Basic Information Section */}
          <div className="mb-6">
            <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              Prospect Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="FirstName"
                  value={formData.FirstName}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.GENERIC_SHORT_TEXT}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.FirstName ? 'border-red-500' : ''}
                  `}
                  placeholder="First name"
                />
                {errors.FirstName && <p className="mt-1 text-red-500 text-sm">{errors.FirstName}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="LastName"
                  value={formData.LastName}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.GENERIC_SHORT_TEXT}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.LastName ? 'border-red-500' : ''}
                  `}
                  placeholder="Last name"
                />
                {errors.LastName && <p className="mt-1 text-red-500 text-sm">{errors.LastName}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="Email"
                  value={formData.Email}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_EMAIL}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Email ? 'border-red-500' : ''}
                  `}
                  placeholder="prospect@example.com"
                />
                {errors.Email && <p className="mt-1 text-red-500 text-sm">{errors.Email}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Phone
                </label>
                <input
                  type="tel"
                  name="Phone"
                  value={formData.Phone}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_PHONE}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Phone ? 'border-red-500' : ''}
                  `}
                  placeholder="Phone number"
                />
                {errors.Phone && <p className="mt-1 text-red-500 text-sm">{errors.Phone}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Industry
                </label>
                <input
                  type="text"
                  name="Industry"
                  value={formData.Industry}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.GENERIC_SHORT_TEXT}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Industry ? 'border-red-500' : ''}
                  `}
                  placeholder="e.g., Technology, Healthcare"
                />
                {errors.Industry && <p className="mt-1 text-red-500 text-sm">{errors.Industry}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 font-medium">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="AddressLine1"
                  value={formData.AddressLine1}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_ADDRESS_LINE}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.AddressLine1 ? 'border-red-500' : ''}
                  `}
                  placeholder="Street address"
                />
                {errors.AddressLine1 && <p className="mt-1 text-red-500 text-sm">{errors.AddressLine1}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 font-medium">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="AddressLine2"
                  value={formData.AddressLine2}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_ADDRESS_LINE}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.AddressLine2 ? 'border-red-500' : ''}
                  `}
                  placeholder="Apartment, suite, etc. (optional)"
                />
                {errors.AddressLine2 && <p className="mt-1 text-red-500 text-sm">{errors.AddressLine2}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  City
                </label>
                <input
                  type="text"
                  name="City"
                  value={formData.City}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_CITY}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.City ? 'border-red-500' : ''}
                  `}
                  placeholder="City"
                />
                {errors.City && <p className="mt-1 text-red-500 text-sm">{errors.City}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Postal Code
                </label>
                <input
                  type="text"
                  name="PostalCode"
                  value={formData.PostalCode}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_POSTAL_CODE}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.PostalCode ? 'border-red-500' : ''}
                  `}
                  placeholder="Postal code"
                />
                {errors.PostalCode && <p className="mt-1 text-red-500 text-sm">{errors.PostalCode}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  State/Province <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="State"
                  value={formData.State}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_STATE}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.State ? 'border-red-500' : ''}
                  `}
                  placeholder="State or Province"
                />
                {errors.State && <p className="mt-1 text-red-500 text-sm">{errors.State}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Country
                </label>
                <input
                  type="text"
                  name="Country"
                  value={formData.Country}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.CUSTOMER_COUNTRY}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Country ? 'border-red-500' : ''}
                  `}
                  placeholder="Country"
                />
                {errors.Country && <p className="mt-1 text-red-500 text-sm">{errors.Country}</p>}
              </div>
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-2 mt-8">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-4 py-2 rounded-md
                ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              {isUpdateMode ? 'Update Prospect' : 'Create Prospect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ProspectForm.propTypes = {
  prospect: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string,
    Address: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(ProspectForm);