import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

// Memoized form field component
const FormField = React.memo(function FormField({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    darkMode,
    rows
}) {
    const inputClasses = `
        w-full p-2 rounded-md border
        ${darkMode 
            ? 'bg-gray-700 border-gray-600 text-white' 
            : 'bg-white border-gray-300 text-gray-900'}
    `;

    return (
        <div>
            <label className="block text-sm font-medium mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {type === 'textarea' ? (
                <textarea
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    rows={rows || 3}
                    className={inputClasses}
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={inputClasses}
                />
            )}
        </div>
    );
});

FormField.propTypes = {
    label: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['text', 'textarea']),
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    required: PropTypes.bool,
    darkMode: PropTypes.bool.isRequired,
    rows: PropTypes.number
};

function TaskForm({
    task = null,
    isOpen = false,
    onClose = () => {},
    onSubmit = () => {},
    projectId = null
}) {
    const { darkMode } = useTheme();
    const [formData, setFormData] = useState({
        task: '',
        type: '',
        description: '',
        notes: ''
    });
    const [errors, setErrors] = useState({});

    // Reset form when task changes
    useEffect(() => {
        if (task) {
            setFormData({
                task: task.task || '',
                type: task.type || '',
                description: task.description || '',
                notes: task.notes || ''
            });
        } else {
            setFormData({
                task: '',
                type: '',
                description: '',
                notes: ''
            });
        }
        setErrors({});
    }, [task]);

    // Memoized handlers
    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Clear error for changed field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        
        if (!formData.task.trim()) {
            newErrors.task = 'Task name is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        
        if (validateForm()) {
            onSubmit({
                ...formData,
                _projectID: projectId,
                __ID: task?.__ID
            });
        }
    }, [formData, projectId, task, onSubmit, validateForm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
                w-full max-w-2xl mx-4 p-6 rounded-lg
                ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">
                        {task ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`
                            p-2 rounded-md hover:bg-opacity-80
                            ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}
                        `}
                    >
                        <span className="sr-only">Close</span>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Task Name */}
                    <FormField
                        label="Task Name"
                        value={formData.task}
                        onChange={(e) => handleChange('task', e.target.value)}
                        placeholder="Enter task name"
                        required
                        darkMode={darkMode}
                    />
                    {errors.task && (
                        <p className="text-sm text-red-500 mt-1">{errors.task}</p>
                    )}

                    {/* Task Type */}
                    <FormField
                        label="Type"
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        placeholder="Enter task type"
                        darkMode={darkMode}
                    />

                    {/* Description */}
                    <FormField
                        label="Description"
                        type="textarea"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="Enter task description"
                        darkMode={darkMode}
                    />

                    {/* Notes */}
                    <FormField
                        label="Notes"
                        type="textarea"
                        value={formData.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder="Enter task notes"
                        darkMode={darkMode}
                    />

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
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
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {task ? 'Update Task' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

TaskForm.propTypes = {
    task: PropTypes.shape({
        __ID: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        type: PropTypes.string,
        description: PropTypes.string,
        notes: PropTypes.string
    }),
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    onSubmit: PropTypes.func,
    projectId: PropTypes.string
};

TaskForm.defaultProps = {
    task: null,
    isOpen: false,
    onClose: () => {},
    onSubmit: () => {},
    projectId: null
};

export default React.memo(TaskForm);