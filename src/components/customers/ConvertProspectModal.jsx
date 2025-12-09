import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSnackBar } from '../../context/SnackBarContext';
import useProspect from '../../hooks/useProspect';
import * as prospectService from '../../services/prospectService';

/**
 * Modal for converting a prospect to a customer
 * Shows validation warnings and confirms user intent before conversion
 * @param {Object} props - Component props
 * @param {Object} props.prospect - The prospect to convert
 * @param {Function} props.onClose - Function to call when modal is closed
 * @param {Function} props.onSuccess - Function to call after successful conversion
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 */
function ConvertProspectModal({ prospect, onClose, onSuccess, darkMode = false }) {
  const { showError, showSuccess } = useSnackBar();
  const { handleProspectConvert } = useProspect();
  
  const [converting, setConverting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initial validation check - validation only, no conversion
  const handleInitialCheck = useCallback(async () => {
    setConverting(true);
    try {
      // Validate prospect data using service directly
      const validation = prospectService.validateProspectForConversion(prospect);
      
      if (validation.warnings.length > 0) {
        // Show validation warnings and require confirmation
        setValidationResult(validation);
        setShowConfirmation(true);
      } else {
        // No warnings, proceed with conversion
        await performConversion();
      }
    } catch (error) {
      console.error('Validation check failed:', error);
      showError(`Validation failed: ${error.message}`);
    } finally {
      setConverting(false);
    }
  }, [prospect, showError]);

  // Perform the actual conversion
  const performConversion = useCallback(async () => {
    setConverting(true);
    try {
      const result = await handleProspectConvert(prospect.id);
      
      if (result.success) {
        showSuccess('Prospect converted to customer successfully');
        if (onSuccess) {
          onSuccess(result.result);
        }
        onClose();
      } else {
        showError(`Conversion failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      showError(`Conversion failed: ${error.message}`);
    } finally {
      setConverting(false);
    }
  }, [prospect.id, handleProspectConvert, showSuccess, showError, onSuccess, onClose]);

  // Proceed with conversion despite warnings
  const handleConfirmConversion = useCallback(async () => {
    await performConversion();
  }, [performConversion]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-lg w-full mx-4
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Convert Prospect to Customer
          </h2>
          <button
            onClick={onClose}
            disabled={converting}
            className={`
              p-1 rounded-full
              ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
              ${converting ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {!showConfirmation ? (
          <div>
            <div className="mb-6">
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                You are about to convert <strong>{prospect.Name}</strong> from a prospect to a customer.
              </p>
              <div className={`p-4 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <h3 className="font-medium mb-2">Prospect Details:</h3>
                <ul className={`space-y-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <li><strong>Name:</strong> {prospect.Name}</li>
                  {prospect.Email && <li><strong>Email:</strong> {prospect.Email}</li>}
                  {prospect.Phone && <li><strong>Phone:</strong> {prospect.Phone}</li>}
                  {prospect.Industry && <li><strong>Industry:</strong> {prospect.Industry}</li>}
                </ul>
              </div>
              <p className={`mt-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This will create a FileMaker customer record and update the Supabase record type to CUSTOMER.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={converting}
                className={`
                  px-4 py-2 rounded-md
                  ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                  ${converting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitialCheck}
                disabled={converting}
                className={`
                  px-4 py-2 rounded-md text-white
                  ${converting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {converting ? 'Converting...' : 'Convert to Customer'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Validation Warnings */}
            <div className="mb-6">
              {validationResult?.warnings && validationResult.warnings.length > 0 && (
                <div className={`p-4 rounded-md mb-4 ${darkMode ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border`}>
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="font-medium text-yellow-800 mb-2">Warnings</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                The conversion can proceed despite these warnings. The prospect will be converted to a customer with the available information.
              </p>
            </div>

            {/* Confirmation Actions */}
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={converting}
                className={`
                  px-4 py-2 rounded-md
                  ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                  ${converting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConversion}
                disabled={converting}
                className={`
                  px-4 py-2 rounded-md text-white
                  ${converting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {converting ? 'Converting...' : 'Proceed Anyway'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ConvertProspectModal.propTypes = {
  prospect: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  darkMode: PropTypes.bool
};

export default React.memo(ConvertProspectModal);