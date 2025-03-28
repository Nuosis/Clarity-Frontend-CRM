import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { validateFinancialRecordData } from '../../services/financialService';

/**
 * Modal component for editing financial records
 * @param {Object} props - Component props
 * @param {Object} props.record - Record to edit
 * @param {function} props.onClose - Function to call when modal is closed
 * @param {function} props.onSave - Function to call when record is saved
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Record modal component
 */
function RecordModal({ record, onClose, onSave, darkMode = false }) {
  const [formData, setFormData] = useState({
    id: '',
    recordId: '',
    customerId: '',
    customerName: '',
    projectId: '',
    projectName: '',
    hours: 0,
    rate: 0,
    date: '',
    billed: false,
    description: ''
  });
  
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when record changes
  useEffect(() => {
    if (record) {
      setFormData({
        id: record.id || '',
        recordId: record.recordId || '',
        customerId: record.customerId || '',
        customerName: record.customerName || '',
        projectId: record.projectId || '',
        projectName: record.projectName || '',
        hours: record.hours || 0,
        rate: record.rate || 0,
        date: record.date ? new Date(record.date).toISOString().split('T')[0] : '',
        billed: record.billed || false,
        description: record.description || ''
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
    const validation = validateFinancialRecordData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setIsSaving(true);
    setErrors([]);
    
    try {
      // Calculate amount based on hours and rate
      const updatedRecord = {
        ...formData,
        hours: parseFloat(formData.hours),
        rate: parseFloat(formData.rate),
        amount: parseFloat(formData.hours) * parseFloat(formData.rate)
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
            Edit Financial Record
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
                  id="customerName"
                  name="customerName"
                  value={formData.customerName}
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
                  id="projectName"
                  name="projectName"
                  value={formData.projectName}
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
            
            {/* Hours and Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label 
                  htmlFor="hours" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Hours
                </label>
                <input
                  type="number"
                  id="hours"
                  name="hours"
                  value={formData.hours}
                  onChange={handleChange}
                  step="0.25"
                  min="0"
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
                  htmlFor="rate" 
                  className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Hourly Rate
                </label>
                <input
                  type="number"
                  id="rate"
                  name="rate"
                  value={formData.rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
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
                className={`
                  mt-1 block w-full rounded-md px-3 py-2 text-sm border
                  ${darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'}
                `}
              />
            </div>
            
            {/* Description */}
            <div>
              <label 
                htmlFor="description" 
                className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className={`
                  mt-1 block w-full rounded-md px-3 py-2 text-sm border
                  ${darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'}
                `}
              />
            </div>
            
            {/* Billed Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="billed"
                name="billed"
                checked={formData.billed}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label 
                htmlFor="billed" 
                className={`ml-2 block text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Mark as Billed
              </label>
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
  darkMode: PropTypes.bool
};

export default RecordModal;