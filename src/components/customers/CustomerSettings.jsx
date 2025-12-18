import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppState } from '../../context/AppStateContext';
import { useSupabaseCustomer } from '../../hooks/useSupabaseCustomer';
import { useCustomer } from '../../hooks/useCustomer';
import { useSnackBar } from '../../context/SnackBarContext';
import { query, insert, update, remove } from '../../services/supabaseService';
import { toE164, formatPhoneDisplay, formatPhoneInput, isValidPhone } from '../../utils/phoneUtils';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../../config.js';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function CustomerSettings({ customer }) {
  const { darkMode } = useTheme();
  const { user, customerDetails } = useAppState();
  const { updateCustomerInSupabase } = useSupabaseCustomer();
  const { handleCustomerUpdate } = useCustomer();
  const { showError } = useSnackBar();

  // State for customer data
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    Name: '',
    Email: '',
    Phone: '',
    PhoneType: '',
    Address: '',
    City: '',
    State: '',
    PostalCode: '',
    Country: ''
  });

  // State for VAPI Testing flag
  const [vapiTesting, setVapiTesting] = useState(false);

  // State for additional contacts
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  // State for adding new contacts
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState('Business');
  const [newAddress, setNewAddress] = useState({
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  });

  // Load customer data when customer changes
  useEffect(() => {
    if (customer) {
      setFormData({
        Name: customer.Name || customer.business_name || '',
        Email: customer.Email || '',
        Phone: customer.Phone || customer.phone || '',
        PhoneType: customer.PhoneType || '',
        Address: customer.Address || '',
        City: customer.City || '',
        State: customer.State || '',
        PostalCode: customer.PostalCode || '',
        Country: customer.Country || ''
      });
    }
  }, [customer]);

  // Update formData.Phone and PhoneType when primary phone is loaded from Supabase
  useEffect(() => {
    if (phones.length > 0 && !isEditing) {
      const primaryPhone = phones.find(p => p.is_primary);
      if (primaryPhone) {
        setFormData(prev => ({
          ...prev,
          Phone: primaryPhone.phone,
          PhoneType: primaryPhone.type || ''
        }));
      }
    }
  }, [phones, isEditing]);

  // Load additional contact information from Supabase
  useEffect(() => {
    // Try both __ID (FileMaker) and id (Supabase UUID)
    const customerId = customer?.__ID || customer?.id;
    if (customerId) {
      loadContactInformation(customerId);
    }
  }, [customer?.__ID, customer?.id]);

  const loadContactInformation = async (customerId) => {
    setIsLoadingContacts(true);
    try {
      // Load emails
      const emailsResult = await query('customer_email', {
        select: '*',
        filter: {
          column: 'customer_id',
          operator: 'eq',
          value: customerId
        }
      });
      if (emailsResult.success && emailsResult.data) {
        setEmails(emailsResult.data);
      }

      // Load phones
      const phonesResult = await query('customer_phone', {
        select: '*',
        filter: {
          column: 'customer_id',
          operator: 'eq',
          value: customerId
        }
      });
      if (phonesResult.success && phonesResult.data) {
        setPhones(phonesResult.data);
      }

      // Load addresses
      const addressesResult = await query('customer_address', {
        select: '*',
        filter: {
          column: 'customer_id',
          operator: 'eq',
          value: customerId
        }
      });
      if (addressesResult.success && addressesResult.data) {
        setAddresses(addressesResult.data);
      }

      // Load VAPI Testing setting using direct Supabase client
      const { data: vapiSetting, error: vapiError } = await supabase
        .from('customer_settings')
        .select('*')
        .eq('customer_id', customerId)
        .eq('type', 'VAPI_TEST')
        .maybeSingle();

      if (!vapiError && vapiSetting) {
        const value = vapiSetting.data;
        setVapiTesting(value === true || value === 'true' || value === '1');
      } else {
        setVapiTesting(false);
      }
    } catch (error) {
      console.error('Error loading contact information:', error);
      showError('Failed to load contact information');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    const customerId = customer?.__ID || customer?.id;
    if (!customer || !customerId) {
      showError('Customer ID not found');
      return;
    }

    // Validate phone if provided
    if (formData.Phone && !isValidPhone(formData.Phone)) {
      showError('Please enter a valid phone number');
      return;
    }

    setIsSaving(true);
    try {
      // Convert phone to E.164 format if provided
      const dataToSave = {
        ...formData,
        Phone: formData.Phone ? toE164(formData.Phone) : formData.Phone
      };

      // Update customer in both FileMaker and Supabase
      await handleCustomerUpdate(customerId, dataToSave);

      showError('Customer information updated successfully');
      setIsEditing(false);

      // Update form data with formatted phone for display
      if (dataToSave.Phone) {
        setFormData(prev => ({ ...prev, Phone: formatPhoneDisplay(dataToSave.Phone) }));
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      showError(`Failed to update customer: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveVapiTestingSetting = async (customerId, value) => {
    try {
      // Check if setting already exists using direct Supabase client
      const { data: existingSetting, error: queryError } = await supabase
        .from('customer_settings')
        .select('id')
        .eq('customer_id', customerId)
        .eq('type', 'VAPI_TEST')
        .maybeSingle();

      if (queryError) {
        throw new Error(`Failed to query settings: ${queryError.message}`);
      }

      const settingData = value.toString();

      if (existingSetting) {
        // Update existing setting
        const { error: updateError } = await supabase
          .from('customer_settings')
          .update({ data: settingData })
          .eq('id', existingSetting.id);

        if (updateError) {
          throw new Error(`Failed to update setting: ${updateError.message}`);
        }
      } else {
        // Insert new setting
        const { error: insertError } = await supabase
          .from('customer_settings')
          .insert([{
            id: crypto.randomUUID(),
            customer_id: customerId,
            type: 'VAPI_TEST',
            data: settingData
          }]);

        if (insertError) {
          throw new Error(`Failed to insert setting: ${insertError.message}`);
        }
      }
    } catch (error) {
      console.error('Error saving VAPI Testing setting:', error);
      throw error;
    }
  };

  const handleVapiTestingToggle = async (checked) => {
    const customerId = customer?.__ID || customer?.id;
    if (!customerId) return;

    // Optimistically update UI
    setVapiTesting(checked);

    try {
      await saveVapiTestingSetting(customerId, checked);
      showError(`VAPI Testing ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating VAPI Testing:', error);
      showError(`Failed to update VAPI Testing: ${error.message}`);
      // Revert on error
      setVapiTesting(!checked);
    }
  };

  const handleAddEmail = async () => {
    const customerId = customer?.__ID || customer?.id;
    if (!newEmail || !customerId) return;

    try {
      const result = await insert('customer_email', {
        customer_id: customerId,
        email: newEmail,
        is_primary: emails.length === 0
      });

      if (result.success) {
        showError('Email added successfully');
        setNewEmail('');
        setShowAddEmail(false);
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to add email: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding email:', error);
      showError('Failed to add email');
    }
  };

  const handleRemoveEmail = async (emailId) => {
    const customerId = customer?.__ID || customer?.id;
    try {
      const result = await remove('customer_email', {
        column: 'id',
        operator: 'eq',
        value: emailId
      });

      if (result.success) {
        showError('Email removed successfully');
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to remove email: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing email:', error);
      showError('Failed to remove email');
    }
  };

  const handleTogglePrimaryEmail = async (emailId) => {
    const customerId = customer?.__ID || customer?.id;
    try {
      // Set all emails to non-primary
      for (const email of emails) {
        await update('customer_email',
          { is_primary: email.id === emailId },
          {
            column: 'id',
            operator: 'eq',
            value: email.id
          }
        );
      }

      showError('Primary email updated');
      await loadContactInformation(customerId);
    } catch (error) {
      console.error('Error updating primary email:', error);
      showError('Failed to update primary email');
    }
  };

  const handleAddPhone = async () => {
    const customerId = customer?.__ID || customer?.id;
    if (!newPhone || !customerId) return;

    // Validate phone number
    if (!isValidPhone(newPhone)) {
      showError('Please enter a valid phone number');
      return;
    }

    try {
      // Convert to E.164 format for storage
      const e164Phone = toE164(newPhone);

      const result = await insert('customer_phone', {
        customer_id: customerId,
        phone: e164Phone,
        is_primary: phones.length === 0,
        type: newPhoneType || 'Business'
      });

      if (result.success) {
        showError('Phone added successfully');
        setNewPhone('');
        setNewPhoneType('Business');
        setShowAddPhone(false);
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to add phone: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding phone:', error);
      showError('Failed to add phone');
    }
  };

  const handleRemovePhone = async (phoneId) => {
    const customerId = customer?.__ID || customer?.id;
    try {
      const result = await remove('customer_phone', {
        column: 'id',
        operator: 'eq',
        value: phoneId
      });

      if (result.success) {
        showError('Phone removed successfully');
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to remove phone: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing phone:', error);
      showError('Failed to remove phone');
    }
  };

  const handleTogglePrimaryPhone = async (phoneId) => {
    const customerId = customer?.__ID || customer?.id;
    try {
      // Set all phones to non-primary
      for (const phone of phones) {
        await update('customer_phone',
          { is_primary: phone.id === phoneId },
          {
            column: 'id',
            operator: 'eq',
            value: phone.id
          }
        );
      }

      showError('Primary phone updated');
      await loadContactInformation(customerId);
    } catch (error) {
      console.error('Error updating primary phone:', error);
      showError('Failed to update primary phone');
    }
  };

  const handleAddAddress = async () => {
    const customerId = customer?.__ID || customer?.id;
    if (!customerId) return;

    try {
      const result = await insert('customer_address', {
        customer_id: customerId,
        ...newAddress
      });

      if (result.success) {
        showError('Address added successfully');
        setNewAddress({
          address_line1: '',
          city: '',
          state: '',
          postal_code: '',
          country: ''
        });
        setShowAddAddress(false);
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to add address: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding address:', error);
      showError('Failed to add address');
    }
  };

  const handleRemoveAddress = async (addressId) => {
    const customerId = customer?.__ID || customer?.id;
    try {
      const result = await remove('customer_address', {
        column: 'id',
        operator: 'eq',
        value: addressId
      });

      if (result.success) {
        showError('Address removed successfully');
        await loadContactInformation(customerId);
      } else {
        showError(`Failed to remove address: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing address:', error);
      showError('Failed to remove address');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-medium">Customer Information</h4>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
          >
            Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setIsEditing(false);
                // Reset form data
                setFormData({
                  Name: customer.Name || '',
                  Email: customer.Email || '',
                  Phone: customer.Phone || customer.phone || '',
                  PhoneType: customer.PhoneType || '',
                  Address: customer.Address || '',
                  City: customer.City || '',
                  State: customer.State || '',
                  PostalCode: customer.PostalCode || '',
                  Country: customer.Country || ''
                });
              }}
              className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div>
          <h5 className="font-medium mb-3">Basic Information</h5>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Customer Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="Name"
                  value={formData.Name}
                  onChange={handleInputChange}
                  className={`w-full p-2 rounded-md border ${
                    darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                  }`}
                />
              ) : (
                <div className="text-base">{formData.Name || 'N/A'}</div>
              )}
            </div>

            {/* VAPI Testing Flag */}
            <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vapiTesting}
                  onChange={(e) => handleVapiTestingToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm font-medium">VAPI Testing</span>
              </label>
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Enable VAPI testing for this customer (saves automatically)
              </p>
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div>
          <h5 className="font-medium mb-3">Primary Contact</h5>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  name="Email"
                  value={formData.Email}
                  onChange={handleInputChange}
                  className={`w-full p-2 rounded-md border ${
                    darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                  }`}
                />
              ) : (
                <div className="text-base">{formData.Email || 'N/A'}</div>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Phone</label>
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="tel"
                    name="Phone"
                    value={formData.Phone}
                    onChange={(e) => {
                      const formatted = formatPhoneInput(e.target.value);
                      setFormData(prev => ({ ...prev, Phone: formatted }));
                    }}
                    placeholder="(555) 123-4567"
                    className={`w-full p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                  <input
                    type="text"
                    name="PhoneType"
                    value={formData.PhoneType}
                    onChange={handleInputChange}
                    placeholder="Type (e.g., Cell, SMS, Business)"
                    className={`w-full p-2 rounded-md border text-sm ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              ) : (
                <div className="text-base flex items-center gap-2">
                  {formatPhoneDisplay(formData.Phone) || 'N/A'}
                  {formData.PhoneType && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {formData.PhoneType}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h5 className="font-medium mb-3">Primary Address</h5>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Street Address</label>
              {isEditing ? (
                <input
                  type="text"
                  name="Address"
                  value={formData.Address}
                  onChange={handleInputChange}
                  className={`w-full p-2 rounded-md border ${
                    darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                  }`}
                />
              ) : (
                <div className="text-base">{formData.Address || 'N/A'}</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="City"
                    value={formData.City}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                ) : (
                  <div className="text-base">{formData.City || 'N/A'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="State"
                    value={formData.State}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                ) : (
                  <div className="text-base">{formData.State || 'N/A'}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Postal Code</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="PostalCode"
                    value={formData.PostalCode}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                ) : (
                  <div className="text-base">{formData.PostalCode || 'N/A'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="Country"
                    value={formData.Country}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                ) : (
                  <div className="text-base">{formData.Country || 'N/A'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Emails & Phones (Combined) */}
        <div className="space-y-6">
          {/* Additional Emails */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-medium">Additional Emails</h5>
              <button
                onClick={() => setShowAddEmail(true)}
                className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                title="Add email"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              {isLoadingContacts ? (
                <div className="text-sm">Loading...</div>
              ) : emails.length === 0 ? (
                <div className="text-sm text-gray-500">No additional emails</div>
              ) : (
                <div className="space-y-2">
                  {emails.map((email) => (
                    <div key={email.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{email.email}</span>
                        {email.is_primary && (
                          <span className="text-xs px-2 py-0.5 bg-primary text-white rounded">Primary</span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        {!email.is_primary && (
                          <button
                            onClick={() => handleTogglePrimaryEmail(email.id)}
                            className={`p-1 text-xs rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                            title="Set as primary"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveEmail(email.id)}
                          className={`p-1 text-red-500 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAddEmail && (
                <div className="mt-3 flex space-x-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`flex-1 p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    onClick={handleAddEmail}
                    className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEmail(false);
                      setNewEmail('');
                    }}
                    className={`px-3 py-2 rounded-md ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Additional Phones */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-medium">Additional Phones</h5>
              <button
                onClick={() => setShowAddPhone(true)}
                className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                title="Add phone"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              {isLoadingContacts ? (
                <div className="text-sm">Loading...</div>
              ) : phones.length === 0 ? (
                <div className="text-sm text-gray-500">No additional phones</div>
              ) : (
                <div className="space-y-2">
                  {phones.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatPhoneDisplay(phone.phone)}</span>
                        {phone.type && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {phone.type}
                          </span>
                        )}
                        {phone.is_primary && (
                          <span className="text-xs px-2 py-0.5 bg-primary text-white rounded">Primary</span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        {!phone.is_primary && (
                          <button
                            onClick={() => handleTogglePrimaryPhone(phone.id)}
                            className={`p-1 text-xs rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                            title="Set as primary"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          onClick={() => handleRemovePhone(phone.id)}
                          className={`p-1 text-red-500 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAddPhone && (
                <div className="mt-3 space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => {
                        const formatted = formatPhoneInput(e.target.value);
                        setNewPhone(formatted);
                      }}
                      placeholder="(555) 123-4567"
                      className={`flex-1 p-2 rounded-md border ${
                        darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                      }`}
                    />
                    <input
                      type="text"
                      value={newPhoneType}
                      onChange={(e) => setNewPhoneType(e.target.value)}
                      placeholder="Type"
                      className={`w-24 p-2 rounded-md border text-sm ${
                        darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddPhone}
                      className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPhone(false);
                        setNewPhone('');
                        setNewPhoneType('Business');
                      }}
                      className={`px-3 py-2 rounded-md ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Addresses */}
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-medium">Additional Addresses</h5>
            <button
              onClick={() => setShowAddAddress(true)}
              className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
              title="Add address"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            {isLoadingContacts ? (
              <div className="text-sm">Loading...</div>
            ) : addresses.length === 0 ? (
              <div className="text-sm text-gray-500">No additional addresses</div>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div key={address.id} className={`p-3 rounded ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                    <div className="flex justify-between">
                      <div>
                        <div>{address.address_line1}</div>
                        <div>{address.city}, {address.state} {address.postal_code}</div>
                        <div>{address.country}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveAddress(address.id)}
                        className={`p-1 text-red-500 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showAddAddress && (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={newAddress.address_line1}
                  onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                  placeholder="Street Address"
                  className={`w-full p-2 rounded-md border ${
                    darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                  }`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    placeholder="City"
                    className={`p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                  <input
                    type="text"
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    placeholder="State"
                    className={`p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newAddress.postal_code}
                    onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                    placeholder="Postal Code"
                    className={`p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                  <input
                    type="text"
                    value={newAddress.country}
                    onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                    placeholder="Country"
                    className={`p-2 rounded-md border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddAddress}
                    className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                  >
                    Add Address
                  </button>
                  <button
                    onClick={() => {
                      setShowAddAddress(false);
                      setNewAddress({
                        address_line1: '',
                        city: '',
                        state: '',
                        postal_code: '',
                        country: ''
                      });
                    }}
                    className={`px-3 py-2 rounded-md ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

CustomerSettings.propTypes = {
  customer: PropTypes.object.isRequired
};

export default CustomerSettings;
