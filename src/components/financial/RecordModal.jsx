import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { validateSaleData } from '../../services/salesService';

/**
 * Modal component for editing sales records
 * @param {Object} props - Component props
 * @param {Object} props.record - Record to edit
 * @param {function} props.onClose - Function to call when modal is closed
 * @param {function} props.onSave - Function to call when record is saved
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {boolean} props.limitedEdit - Whether to limit editing to only the description field
 * @returns {JSX.Element} Record modal component
 */
function RecordModal({ record, onClose, onSave, darkMode = false, limitedEdit = false }) {
  const [formData, setFormData] = useState({
    id: '',
    customer_id: '',
    customer_name: '',
    project_id: '',
    project_name: '',
    product_id: '',
    product_name: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    date: '',
    inv_id: null
  });
  
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when record changes
  useEffect(() => {
    if (record) {
      setFormData({
        id: record.id || '',
        customer_id: record.customer_id || '',
        customer_name: record.customers?.business_name || '',
        project_id: record.project_id || '',
        project_name: record.project_name || '',
        product_id: record.product_id || '',
        product_name: record.product_name || '',
        quantity: record.quantity || 1,
        unit_price: record.unit_price || 0,
        total_price: record.total_price || 0,
        date: record.date ? new Date(record.date).toISOString().split('T')[0] : '',
        inv_id: record.inv_id
      });
    }
  }, [record]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form data
    const validation = validateSaleData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setIsSaving(true);
    setErrors([]);
    
    try {
      // Calculate total_price based on quantity and unit_price
      const updatedRecord = {
        ...formData,
        quantity: parseInt(formData.quantity, 10),
        unit_price: parseFloat(formData.unit_price),
        total_price: parseInt(formData.quantity, 10) * parseFloat(formData.unit_price)
      };
      
      await onSave(updatedRecord);
      onClose();
    } catch (error) {
      setErrors([error.message || 'Failed to save record']);
    } finally {
      setIsSaving(false);
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
            {limitedEdit ? 'Edit Work Description' : 'Edit Sales Record'}
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
            {/* Customer and Project (read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label 
                  htmlFor="customerName" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Customer
                </label>
                <input
                  type="text"
                  id="customer_name"
                  name="customer_name"
                  value={formData.customer_name}
                  readOnly
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-300' 
                      : 'bg-gray-100 border-gray-300 text-gray-700'}
                  `}
                />
              </div>
              <div>
                <label 
                  htmlFor="projectName" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Project
                </label>
                <input
                  type="text"
                  id="project_name"
                  name="project_name"
                  value={formData.project_name}
                  readOnly
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-300' 
                      : 'bg-gray-100 border-gray-300 text-gray-700'}
                  `}
                />
              </div>
            </div>
            
            {/* Product Name / Work Performed */}
            <div>
              <label
                htmlFor="product_name"
                className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {limitedEdit ? 'Work Performed' : 'Product'}
              </label>
              <input
                type="text"
                id="product_name"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                className={`
                  mt-1 block w-full rounded-md px-3 py-2 text-sm border
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'}
                `}
              />
            </div>
            
            {/* Quantity and Unit Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="quantity"
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Quantity
                </label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  step="1"
                  min="1"
                  required
                  disabled={limitedEdit}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode
                      ? (limitedEdit ? 'bg-gray-600' : 'bg-gray-700') + ' border-gray-600 text-white'
                      : (limitedEdit ? 'bg-gray-100' : 'bg-white') + ' border-gray-300 text-gray-900'}
                    ${limitedEdit ? 'cursor-not-allowed opacity-75' : ''}
                  `}
                />
              </div>
              <div>
                <label
                  htmlFor="unit_price"
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Unit Price
                </label>
                <input
                  type="number"
                  id="unit_price"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  disabled={limitedEdit}
                  className={`
                    mt-1 block w-full rounded-md px-3 py-2 text-sm border
                    ${darkMode
                      ? (limitedEdit ? 'bg-gray-600' : 'bg-gray-700') + ' border-gray-600 text-white'
                      : (limitedEdit ? 'bg-gray-100' : 'bg-white') + ' border-gray-300 text-gray-900'}
                    ${limitedEdit ? 'cursor-not-allowed opacity-75' : ''}
                  `}
                />
              </div>
            </div>
            
            {/* Date */}
            <div>
              <label
                htmlFor="date"
                className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                disabled={limitedEdit}
                className={`
                  mt-1 block w-full rounded-md px-3 py-2 text-sm border
                  ${darkMode
                    ? (limitedEdit ? 'bg-gray-600' : 'bg-gray-700') + ' border-gray-600 text-white'
                    : (limitedEdit ? 'bg-gray-100' : 'bg-white') + ' border-gray-300 text-gray-900'}
                  ${limitedEdit ? 'cursor-not-allowed opacity-75' : ''}
                `}
              />
            </div>
            
            {/* Total Price (calculated, read-only) */}
            <div>
              <label
                htmlFor="total_price"
                className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Total Price (calculated)
              </label>
              <input
                type="number"
                id="total_price"
                name="total_price"
                value={(formData.quantity * formData.unit_price).toFixed(2)}
                readOnly
                className={`
                  mt-1 block w-full rounded-md px-3 py-2 text-sm border
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-300'
                    : 'bg-gray-100 border-gray-300 text-gray-700'}
                `}
              />
            </div>
            
            {/* Invoice Status */}
            {!limitedEdit && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="invoiced"
                  name="invoiced"
                  checked={formData.inv_id !== null}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      inv_id: e.target.checked ? 'pending' : null
                    }));
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="invoiced"
                  className={`ml-2 block text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Mark as Invoiced
                </label>
              </div>
            )}
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
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`
                px-4 py-2 text-sm font-medium rounded-md
                ${darkMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'}
                ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}
              `}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

RecordModal.propTypes = {
  record: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
  limitedEdit: PropTypes.bool
};

export default RecordModal;