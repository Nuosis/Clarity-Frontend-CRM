import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { createTeam } from '../../api/teams';
import { useSnackBar } from '../../context/SnackBarContext';
import { useAppStateOperations } from '../../context/AppStateContext';

/**
 * Team form component for creating a new team
 * @param {Object} props - Component props
 * @param {function} props.onClose - Function to call when the form is closed
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Team form component
 */
function TeamForm({ onClose, darkMode = false }) {
  const { showError } = useSnackBar();
  const { setLoading } = useAppStateOperations();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
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
    
    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Team name is required';
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
      const teamData = {
        ...formData,
        __ID: uuidv4(), // Generate a unique ID
      };
      
      // Create team
      await createTeam(teamData);
      
      showError('Team created successfully');
      onClose();
    } catch (error) {
      console.error('Error creating team:', error);
      showError(`Error creating team: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New Team</h2>
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
          {/* Team Information Section */}
          <div className="mb-6">
            <h3 className={`text-lg font-medium mb-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              Team Information
            </h3>
            <div>
              <label className="block mb-1 font-medium">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`
                  w-full p-2 rounded-md border
                  ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                  ${errors.name ? 'border-red-500' : ''}
                `}
                placeholder="Team name"
              />
              {errors.name && <p className="mt-1 text-red-500 text-sm">{errors.name}</p>}
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
              Create Team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

TeamForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(TeamForm);