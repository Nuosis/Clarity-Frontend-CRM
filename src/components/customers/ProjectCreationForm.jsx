import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

function ProjectCreationForm({ 
  customer, 
  onSubmit, 
  onCancel 
}) {
  const { darkMode } = useTheme();
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('billable'); // Default to billable
  const [value, setValue] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [errors, setErrors] = useState({});

  // Set default dates based on project type
  useEffect(() => {
    const today = new Date();
    
    if (projectType === 'billable') {
      // For billable: dateStart defaults to the creation date
      setDateStart(today.toISOString().split('T')[0]);
    } else if (projectType === 'fixed') {
      // For fixed cost: dateStart is null
      setDateStart('');
    } else if (projectType === 'subscription') {
      // For subscription: dateStart defaults to the 1st of the current month
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateStart(firstOfMonth.toISOString().split('T')[0]);
    }
  }, [projectType]);

  const validate = () => {
    const newErrors = {};
    
    if (!projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    }
    
    if ((projectType === 'fixed' || projectType === 'subscription') && 
        (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0)) {
      newErrors.value = 'Value is required and must be a positive number';
    }
    
    if (projectType === 'subscription' && !dateStart) {
      newErrors.dateStart = 'Start date is required for subscription projects';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    const projectData = {
      customerId: customer.id,
      customerName: customer.Name,
      name: projectName,
      projectName: projectName,
      _custID: customer.id,
      // Set the appropriate fields based on project type
      isFixedPrice: projectType === 'fixed',
      isSubscription: projectType === 'subscription',
      value: (projectType === 'fixed' || projectType === 'subscription') ? parseFloat(value) : 0,
      dateStart: dateStart || null
    };
    
    onSubmit(projectData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-md w-full mx-4
        ${darkMode ? 'bg-gray-800' : 'bg-white'}
      `}>
        <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
        <form onSubmit={handleSubmit}>
          {/* Project Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.projectName ? 'border-red-500' : ''}
              `}
              autoFocus
            />
            {errors.projectName && (
              <p className="text-red-500 text-xs mt-1">{errors.projectName}</p>
            )}
          </div>
          
          {/* Project Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Project Type
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="projectType"
                  value="billable"
                  checked={projectType === 'billable'}
                  onChange={() => setProjectType('billable')}
                  className="mr-1"
                />
                <span>Billable</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="projectType"
                  value="fixed"
                  checked={projectType === 'fixed'}
                  onChange={() => setProjectType('fixed')}
                  className="mr-1"
                />
                <span>Fixed Cost</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="projectType"
                  value="subscription"
                  checked={projectType === 'subscription'}
                  onChange={() => setProjectType('subscription')}
                  className="mr-1"
                />
                <span>Subscription</span>
              </label>
            </div>
          </div>
          
          {/* Value Field (only for fixed cost and subscription) */}
          {(projectType === 'fixed' || projectType === 'subscription') && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Value {projectType === 'fixed' ? '(Total)' : '(Monthly)'}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                min="0"
                step="0.01"
                className={`
                  w-full p-2 rounded-md border
                  ${darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'}
                  ${errors.value ? 'border-red-500' : ''}
                `}
              />
              {errors.value && (
                <p className="text-red-500 text-xs mt-1">{errors.value}</p>
              )}
            </div>
          )}
          
          {/* Start Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Start Date {projectType === 'fixed' ? '(Optional)' : ''}
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.dateStart ? 'border-red-500' : ''}
              `}
            />
            {errors.dateStart && (
              <p className="text-red-500 text-xs mt-1">{errors.dateStart}</p>
            )}
          </div>
          
          {/* Buttons */}
          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className={`
                px-4 py-2 rounded-md
                ${darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-gray-200 hover:bg-gray-300'}
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!projectName.trim()}
              className={`
                px-4 py-2 bg-primary text-white rounded-md
                ${projectName.trim() ? 'hover:bg-primary-hover' : 'opacity-50 cursor-not-allowed'}
              `}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ProjectCreationForm.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default ProjectCreationForm;