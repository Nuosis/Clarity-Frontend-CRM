import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { createCustomer } from '../../api/customers';
import { useSnackBar } from '../../context/SnackBarContext';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';
import { useSupabaseCustomer } from '../../hooks/useSupabaseCustomer';
import { useCustomer } from '../../hooks/useCustomer';

/**
 * Customer form component for creating a new customer
 * @param {Object} props - Component props
 * @param {function} props.onClose - Function to call when the form is closed
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Customer form component
 */
function CustomerForm({ onClose, darkMode = false }) {
  const { showError } = useSnackBar();
  const { setLoading, setSelectedCustomer } = useAppStateOperations();
  const { user } = useAppState();
  const { createCustomerInSupabase } = useSupabaseCustomer();
  const { loadCustomers, handleCustomerSelect } = useCustomer();
  
  // Form state
  const [formData, setFormData] = useState({
    // Basic Information
    Name: '',
    OBSI_ClientNo: '',
    
    // Contact Information
    Email: '',
    phone: '',
    
    // Financial Information
    chargeRate: '',
    f_USD: false,
    f_EUR: false,
    f_prePay: 0,
    fundsAvailable: 0,
    
    // Database Information
    dbPath: '',
    dbUserName: '',
    dbPasword: '',
    
    // Hidden fields
    f_active: true,
  });
  
  // Form validation state
  const [errors, setErrors] = useState({});
  
  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  // Handle number input change
  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numValue = value === '' ? 0 : parseFloat(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: numValue
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
    
    // Required fields
    if (!formData.Name.trim()) {
      newErrors.Name = 'Name is required';
    }
    
    if (!formData.Email.trim()) {
      newErrors.Email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.Email)) {
      newErrors.Email = 'Email is invalid';
    }
    
    if (!formData.chargeRate) {
      newErrors.chargeRate = 'Charge rate is required';
    } else if (isNaN(formData.chargeRate) || parseFloat(formData.chargeRate) <= 0) {
      newErrors.chargeRate = 'Charge rate must be a positive number';
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
      
      // Prepare data for submission
      const customerData = {
        ...formData,
        __ID: uuidv4(), // Generate a unique ID
        f_active: formData.f_active ? "1" : "0", // Convert boolean to string for FileMaker
        f_USD: formData.f_USD ? "1" : "0",
        f_EUR: formData.f_EUR ? "1" : "0",
        // Rename OBSI_ClientNo to match FileMaker field name
        "OBSI ClientNo": formData.OBSI_ClientNo,
      };
      
      // Remove the underscore version
      delete customerData.OBSI_ClientNo;
      
      // 1. Create customer in FileMaker first
      const fileMakerResult = await createCustomer(customerData);
      console.log('FileMaker customer created:', fileMakerResult);
      
      // 2. Create customer in Supabase after successful FileMaker creation
      if (user && user.supabaseOrgID) {
        try {
          const supabaseCustomerData = {
            Name: customerData.Name,
            Email: customerData.Email || null,
            Phone: customerData.phone || null, // Use capital P to match Supabase hook expectation
            fileMakerUUID: customerData.__ID, // Pass FileMaker UUID to be used as Supabase ID
            // Include any other relevant fields for Supabase
          };
          
          const supabaseResult = await createCustomerInSupabase(supabaseCustomerData, user);
          if (supabaseResult && supabaseResult.success) {
            console.log('Supabase customer created:', supabaseResult.data);
          } else {
            console.warn('Failed to create customer in Supabase:', supabaseResult?.error);
            // Don't fail the entire operation if Supabase creation fails
          }
        } catch (supabaseError) {
          console.error('Error creating customer in Supabase:', supabaseError);
          // Don't fail the entire operation if Supabase creation fails
        }
      }
      
      // 3. Refresh customer list and select the new customer
      await loadCustomers();
      
      // 4. Find and select the newly created customer
      // After refreshing the customer list, find the customer by the FileMaker UUID we generated
      if (fileMakerResult && fileMakerResult.response && fileMakerResult.response.data) {
        // Wait a moment for the customer list to be fully refreshed
        setTimeout(async () => {
          try {
            // The customer should now be in the refreshed list, select it by the UUID we generated
            await handleCustomerSelect(customerData.__ID);
          } catch (error) {
            console.warn('Could not auto-select newly created customer:', error);
            // Don't fail the entire operation if selection fails
          }
        }, 100);
      }
      
      showError('Customer created successfully');
      onClose();
    } catch (error) {
      console.error('Error creating customer:', error);
      showError(`Error creating customer: ${error.message}`);
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
          <h2 className="text-xl font-semibold">Create New Customer</h2>
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
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="Name"
                  value={formData.Name}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Name ? 'border-red-500' : ''}
                  `}
                  placeholder="Customer name"
                />
                {errors.Name && <p className="mt-1 text-red-500 text-sm">{errors.Name}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  OBSI Client No
                </label>
                <input
                  type="text"
                  name="OBSI_ClientNo"
                  value={formData.OBSI_ClientNo}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="OBSI client number"
                />
              </div>
            </div>
          </div>
          
          {/* Contact Information Section */}
          <div className="mb-6">
            <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="Email"
                  value={formData.Email}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.Email ? 'border-red-500' : ''}
                  `}
                  placeholder="customer@example.com"
                />
                {errors.Email && <p className="mt-1 text-red-500 text-sm">{errors.Email}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>
          
          {/* Financial Information Section */}
          <div className="mb-6">
            <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              Financial Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Charge Rate <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="chargeRate"
                  value={formData.chargeRate}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.chargeRate ? 'border-red-500' : ''}
                  `}
                  placeholder="Hourly rate"
                  step="0.01"
                  min="0"
                />
                {errors.chargeRate && <p className="mt-1 text-red-500 text-sm">{errors.chargeRate}</p>}
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="f_USD"
                    name="f_USD"
                    checked={formData.f_USD}
                    onChange={handleChange}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="f_USD" className="ml-2">
                    USD Currency
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="f_EUR"
                    name="f_EUR"
                    checked={formData.f_EUR}
                    onChange={handleChange}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="f_EUR" className="ml-2">
                    EUR Currency
                  </label>
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Pre-Pay Amount
                </label>
                <input
                  type="number"
                  name="f_prePay"
                  value={formData.f_prePay}
                  onChange={handleNumberChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Pre-pay amount"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Funds Available
                </label>
                <input
                  type="number"
                  name="fundsAvailable"
                  value={formData.fundsAvailable}
                  onChange={handleNumberChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Available funds"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>
          
          {/* Database Information Section */}
          <div className="mb-6">
            <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              Database Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Database Path
                </label>
                <input
                  type="text"
                  name="dbPath"
                  value={formData.dbPath}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Path to database"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Database Username
                </label>
                <input
                  type="text"
                  name="dbUserName"
                  value={formData.dbUserName}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Database username"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Database Password
                </label>
                <input
                  type="password"
                  name="dbPasword"
                  value={formData.dbPasword}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Database password"
                />
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
              Create Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CustomerForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(CustomerForm);