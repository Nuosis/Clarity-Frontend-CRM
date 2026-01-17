import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { createCustomer, updateCustomer } from '../../api/customers';
import { useSnackBar } from '../../context/SnackBarContext';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useCustomer } from '../../hooks/useCustomer';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../../services/dataService';

/**
 * Customer form component for creating/editing customers
 * Supports both FileMaker flat model and backend relational model
 * @param {Object} props - Component props
 * @param {Object} props.customer - Existing customer data for edit mode (optional)
 * @param {function} props.onClose - Function to call when the form is closed
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Customer form component
 */
function CustomerForm({ customer = null, onClose, darkMode = false }) {
  const { showError } = useSnackBar();
  const { setLoading } = useAppStateOperations();
  const { loadCustomers, handleCustomerSelect } = useCustomer();

  const isEditMode = Boolean(customer);
  const env = getEnvironmentContext();

  // Form state - Basic Information
  const [formData, setFormData] = useState({
    business_name: '',
    primary_contact_name: '',
    type: 'CUSTOMER',
    is_active: true,

    // Legacy FileMaker fields (for backward compatibility)
    OBSI_ClientNo: '',
    chargeRate: '',
    f_USD: false,
    f_EUR: false,
    f_prePay: 0,
    fundsAvailable: 0,
    dbPath: '',
    dbUserName: '',
    dbPasword: '',
  });

  // Nested contact arrays
  const [emails, setEmails] = useState([{ email: '', is_primary: true, email_type: 'work' }]);
  const [phones, setPhones] = useState([{ phone: '', is_primary: true, phone_type: 'office' }]);
  const [addresses, setAddresses] = useState([{
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    is_primary: true
  }]);
  
  // Form validation state
  const [errors, setErrors] = useState({});

  // Initialize form with existing customer data in edit mode
  useEffect(() => {
    if (customer) {
      setFormData({
        business_name: customer.business_name || customer.Name || '',
        primary_contact_name: customer.primary_contact_name || customer.ContactPerson || '',
        type: customer.type || 'CUSTOMER',
        is_active: customer.is_active ?? (customer.f_active === "1" || customer.f_active === 1),
        OBSI_ClientNo: customer.OBSI_ClientNo || customer['OBSI ClientNo'] || '',
        chargeRate: customer.chargeRate || '',
        f_USD: customer.f_USD === "1" || customer.f_USD === true,
        f_EUR: customer.f_EUR === "1" || customer.f_EUR === true,
        f_prePay: customer.f_prePay || 0,
        fundsAvailable: customer.fundsAvailable || 0,
        dbPath: customer.dbPath || '',
        dbUserName: customer.dbUserName || '',
        dbPasword: customer.dbPasword || '',
      });

      // Initialize emails
      if (customer.emails && Array.isArray(customer.emails) && customer.emails.length > 0) {
        setEmails(customer.emails.map(e => ({
          id: e.id,
          email: e.email || '',
          is_primary: e.is_primary ?? false,
          email_type: e.email_type || 'work'
        })));
      } else if (customer.Email) {
        // FileMaker flat format
        setEmails([{ email: customer.Email, is_primary: true, email_type: 'work' }]);
      }

      // Initialize phones
      if (customer.phones && Array.isArray(customer.phones) && customer.phones.length > 0) {
        setPhones(customer.phones.map(p => ({
          id: p.id,
          phone: p.phone || '',
          is_primary: p.is_primary ?? false,
          phone_type: p.phone_type || 'office'
        })));
      } else if (customer.Phone || customer.phone) {
        // FileMaker flat format
        setPhones([{ phone: customer.Phone || customer.phone, is_primary: true, phone_type: 'office' }]);
      }

      // Initialize addresses
      if (customer.addresses && Array.isArray(customer.addresses) && customer.addresses.length > 0) {
        setAddresses(customer.addresses.map(a => ({
          id: a.id,
          address_line1: a.address_line1 || '',
          address_line2: a.address_line2 || '',
          city: a.city || '',
          state: a.state || '',
          postal_code: a.postal_code || '',
          country: a.country || '',
          is_primary: a.is_primary ?? false
        })));
      } else if (customer.Address || customer.City || customer.State) {
        // FileMaker flat format
        setAddresses([{
          address_line1: customer.Address || '',
          address_line2: '',
          city: customer.City || '',
          state: customer.State || '',
          postal_code: customer.PostalCode || '',
          country: customer.Country || '',
          is_primary: true
        }]);
      }
    }
  }, [customer]);

  // Handle basic field changes
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

  // Email management functions
  const addEmail = () => {
    setEmails([...emails, { email: '', is_primary: false, email_type: 'work' }]);
  };

  const removeEmail = (index) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index);
      // Ensure at least one is primary
      if (!newEmails.some(e => e.is_primary)) {
        newEmails[0].is_primary = true;
      }
      setEmails(newEmails);
    }
  };

  const updateEmail = (index, field, value) => {
    const newEmails = [...emails];
    newEmails[index][field] = value;

    // If marking as primary, unmark others
    if (field === 'is_primary' && value === true) {
      newEmails.forEach((e, i) => {
        if (i !== index) e.is_primary = false;
      });
    }

    setEmails(newEmails);
  };

  // Phone management functions
  const addPhone = () => {
    setPhones([...phones, { phone: '', is_primary: false, phone_type: 'office' }]);
  };

  const removePhone = (index) => {
    if (phones.length > 1) {
      const newPhones = phones.filter((_, i) => i !== index);
      // Ensure at least one is primary
      if (!newPhones.some(p => p.is_primary)) {
        newPhones[0].is_primary = true;
      }
      setPhones(newPhones);
    }
  };

  const updatePhone = (index, field, value) => {
    const newPhones = [...phones];
    newPhones[index][field] = value;

    // If marking as primary, unmark others
    if (field === 'is_primary' && value === true) {
      newPhones.forEach((p, i) => {
        if (i !== index) p.is_primary = false;
      });
    }

    setPhones(newPhones);
  };

  // Address management functions
  const addAddress = () => {
    setAddresses([...addresses, {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_primary: false
    }]);
  };

  const removeAddress = (index) => {
    if (addresses.length > 1) {
      const newAddresses = addresses.filter((_, i) => i !== index);
      // Ensure at least one is primary
      if (!newAddresses.some(a => a.is_primary)) {
        newAddresses[0].is_primary = true;
      }
      setAddresses(newAddresses);
    }
  };

  const updateAddress = (index, field, value) => {
    const newAddresses = [...addresses];
    newAddresses[index][field] = value;

    // If marking as primary, unmark others
    if (field === 'is_primary' && value === true) {
      newAddresses.forEach((a, i) => {
        if (i !== index) a.is_primary = false;
      });
    }

    setAddresses(newAddresses);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Required field: business_name
    if (!formData.business_name.trim()) {
      newErrors.business_name = 'Business name is required';
    }

    // Validate emails
    emails.forEach((emailObj, index) => {
      if (emailObj.email && !/\S+@\S+\.\S+/.test(emailObj.email)) {
        newErrors[`email_${index}`] = 'Invalid email format';
      }
    });

    // Validate phones
    phones.forEach((phoneObj, index) => {
      if (phoneObj.phone && !/^\+?[\d\s-()]+$/.test(phoneObj.phone)) {
        newErrors[`phone_${index}`] = 'Invalid phone format';
      }
    });

    // Legacy validation for FileMaker environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
      if (formData.chargeRate && (isNaN(formData.chargeRate) || parseFloat(formData.chargeRate) <= 0)) {
        newErrors.chargeRate = 'Charge rate must be a positive number';
      }
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

      // Filter out empty contacts
      const validEmails = emails.filter(e => e.email && e.email.trim());
      const validPhones = phones.filter(p => p.phone && p.phone.trim());
      const validAddresses = addresses.filter(a =>
        (a.address_line1 && a.address_line1.trim()) ||
        (a.city && a.city.trim()) ||
        (a.state && a.state.trim())
      );

      // Prepare data based on environment
      if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
        // Web app environment - use backend API format
        const customerData = {
          business_name: formData.business_name,
          primary_contact_name: formData.primary_contact_name || null,
          type: formData.type,
          is_active: formData.is_active,
          emails: validEmails.map(e => ({
            ...(e.id && { id: e.id }),
            email: e.email,
            is_primary: e.is_primary,
            email_type: e.email_type
          })),
          phones: validPhones.map(p => ({
            ...(p.id && { id: p.id }),
            phone: p.phone,
            is_primary: p.is_primary,
            phone_type: p.phone_type
          })),
          addresses: validAddresses.map(a => ({
            ...(a.id && { id: a.id }),
            address_line1: a.address_line1,
            address_line2: a.address_line2 || null,
            city: a.city,
            state: a.state,
            postal_code: a.postal_code || null,
            country: a.country || null,
            is_primary: a.is_primary
          }))
        };

        if (isEditMode) {
          // Update existing customer
          await updateCustomer(customer.id || customer.__ID, customerData);
          showError('Customer updated successfully');
        } else {
          // Create new customer
          const result = await createCustomer(customerData);
          showError('Customer created successfully');

          // Auto-select newly created customer
          if (result && result.id) {
            setTimeout(async () => {
              try {
                await handleCustomerSelect(result.id);
              } catch (error) {
                console.warn('Could not auto-select newly created customer:', error);
              }
            }, 100);
          }
        }
      } else {
        // FileMaker environment - use flat format
        const primaryEmail = validEmails.find(e => e.is_primary) || validEmails[0];
        const primaryPhone = validPhones.find(p => p.is_primary) || validPhones[0];
        const primaryAddress = validAddresses.find(a => a.is_primary) || validAddresses[0] || {};

        const fileMakerData = {
          Name: formData.business_name,
          ContactPerson: formData.primary_contact_name || '',
          Email: primaryEmail?.email || '',
          phone: primaryPhone?.phone || '',
          Address: primaryAddress.address_line1 || '',
          City: primaryAddress.city || '',
          State: primaryAddress.state || '',
          PostalCode: primaryAddress.postal_code || '',
          Country: primaryAddress.country || '',
          f_active: formData.is_active ? "1" : "0",
          // Legacy fields
          "OBSI ClientNo": formData.OBSI_ClientNo || '',
          chargeRate: formData.chargeRate || '',
          f_USD: formData.f_USD ? "1" : "0",
          f_EUR: formData.f_EUR ? "1" : "0",
          f_prePay: formData.f_prePay,
          fundsAvailable: formData.fundsAvailable,
          dbPath: formData.dbPath || '',
          dbUserName: formData.dbUserName || '',
          dbPasword: formData.dbPasword || ''
        };

        if (isEditMode) {
          // Update existing customer
          const customerId = customer.recordId || customer.id || customer.__ID;
          await updateCustomer(customerId, fileMakerData);
          showError('Customer updated successfully');
        } else {
          // Create new customer
          fileMakerData.__ID = uuidv4();
          const fileMakerResult = await createCustomer(fileMakerData);
          console.log('FileMaker customer created:', fileMakerResult);

          // Auto-select newly created customer
          if (fileMakerResult && fileMakerResult.response && fileMakerResult.response.data) {
            setTimeout(async () => {
              try {
                await handleCustomerSelect(fileMakerData.__ID);
              } catch (error) {
                console.warn('Could not auto-select newly created customer:', error);
              }
            }, 100);
          }

          showError('Customer created successfully');
        }
      }

      // Refresh customer list
      await loadCustomers();
      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} customer:`, error);
      showError(`Error ${isEditMode ? 'updating' : 'creating'} customer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isEditMode ? 'Edit Customer' : 'Create New Customer'}
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
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    ${errors.business_name ? 'border-red-500' : ''}
                  `}
                  placeholder="Business/Customer name"
                />
                {errors.business_name && <p className="mt-1 text-red-500 text-sm">{errors.business_name}</p>}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Primary Contact Name
                </label>
                <input
                  type="text"
                  name="primary_contact_name"
                  value={formData.primary_contact_name}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={`
                    w-full p-2 rounded-md border
                    ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  `}
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="PROSPECT">Prospect</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 rounded"
                />
                <label htmlFor="is_active" className="ml-2">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Email Addresses Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-medium pb-2 border-b flex-1 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                Email Addresses
              </h3>
              <button
                type="button"
                onClick={addEmail}
                className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                + Add Email
              </button>
            </div>
            {emails.map((emailObj, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-5">
                  <input
                    type="email"
                    value={emailObj.email}
                    onChange={(e) => updateEmail(index, 'email', e.target.value)}
                    className={`
                      w-full p-2 rounded-md border
                      ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                      ${errors[`email_${index}`] ? 'border-red-500' : ''}
                    `}
                    placeholder="email@example.com"
                  />
                  {errors[`email_${index}`] && <p className="mt-1 text-red-500 text-sm">{errors[`email_${index}`]}</p>}
                </div>
                <div className="col-span-3">
                  <select
                    value={emailObj.email_type}
                    onChange={(e) => updateEmail(index, 'email_type', e.target.value)}
                    className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                  >
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="billing">Billing</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={emailObj.is_primary}
                    onChange={(e) => updateEmail(index, 'is_primary', e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  <label className="ml-1 text-sm">Primary</label>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Phone Numbers Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-medium pb-2 border-b flex-1 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                Phone Numbers
              </h3>
              <button
                type="button"
                onClick={addPhone}
                className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                + Add Phone
              </button>
            </div>
            {phones.map((phoneObj, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-5">
                  <input
                    type="tel"
                    value={phoneObj.phone}
                    onChange={(e) => updatePhone(index, 'phone', e.target.value)}
                    className={`
                      w-full p-2 rounded-md border
                      ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                      ${errors[`phone_${index}`] ? 'border-red-500' : ''}
                    `}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors[`phone_${index}`] && <p className="mt-1 text-red-500 text-sm">{errors[`phone_${index}`]}</p>}
                </div>
                <div className="col-span-3">
                  <select
                    value={phoneObj.phone_type}
                    onChange={(e) => updatePhone(index, 'phone_type', e.target.value)}
                    className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                  >
                    <option value="office">Office</option>
                    <option value="mobile">Mobile</option>
                    <option value="fax">Fax</option>
                    <option value="home">Home</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={phoneObj.is_primary}
                    onChange={(e) => updatePhone(index, 'is_primary', e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  <label className="ml-1 text-sm">Primary</label>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  {phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Addresses Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-medium pb-2 border-b flex-1 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                Addresses
              </h3>
              <button
                type="button"
                onClick={addAddress}
                className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                + Add Address
              </button>
            </div>
            {addresses.map((addressObj, index) => (
              <div key={index} className="mb-4 p-3 border rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={addressObj.address_line1}
                      onChange={(e) => updateAddress(index, 'address_line1', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="Address Line 1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={addressObj.address_line2}
                      onChange={(e) => updateAddress(index, 'address_line2', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="Address Line 2 (optional)"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addressObj.city}
                      onChange={(e) => updateAddress(index, 'city', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addressObj.state}
                      onChange={(e) => updateAddress(index, 'state', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="State/Province"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addressObj.postal_code}
                      onChange={(e) => updateAddress(index, 'postal_code', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="Postal/Zip Code"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addressObj.country}
                      onChange={(e) => updateAddress(index, 'country', e.target.value)}
                      className={`w-full p-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="Country"
                    />
                  </div>
                  <div className="flex items-center justify-between md:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={addressObj.is_primary}
                        onChange={(e) => updateAddress(index, 'is_primary', e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      <label className="ml-2">Primary Address</label>
                    </div>
                    {addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddress(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove Address
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Legacy FileMaker Fields - Collapsible Section */}
          {env.type === ENVIRONMENT_TYPES.FILEMAKER && (
            <>
              <div className="mb-6">
                <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  Additional Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="block mb-1 font-medium">
                      Charge Rate
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
                </div>
              </div>

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
            </>
          )}

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
              {isEditMode ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CustomerForm.propTypes = {
  customer: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(CustomerForm);
