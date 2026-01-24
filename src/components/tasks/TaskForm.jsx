import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { validateTaskData } from '../../services/taskService';
import { sanitizeText, FIELD_LIMITS } from '../../utils/inputSanitization';

/**
 * TaskForm - Create or edit task with full validation
 *
 * Supports both new backend schema and FileMaker legacy fields
 * Displays field-level validation errors from backend
 */
function TaskForm({
  projectId,
  customerId,
  staffId,
  task = null, // For editing existing tasks
  onSubmit,
  onCancel
}) {
  const { darkMode } = useTheme();
  const isEdit = !!task;

  // Form state - using new backend field names
  const [formData, setFormData] = useState({
    title: task?.title || task?.task || '',
    task_type: task?.task_type || task?.type || '',
    notes: task?.notes || '',
    priority: task?.priority || 3,
    status: task?.status || 'pending',
    estimated_hours: task?.estimated_hours || '',
    due_date: task?.due_date || ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Priority options matching new backend schema (1-5 integers)
  const priorityOptions = [
    { value: 1, label: 'Highest', description: 'Urgent - immediate attention' },
    { value: 2, label: 'High', description: 'Important - high priority' },
    { value: 3, label: 'Normal', description: 'Standard priority' },
    { value: 4, label: 'Low', description: 'Can wait' },
    { value: 5, label: 'Lowest', description: 'Future work' }
  ];

  // Status options matching new backend enum
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const dataToValidate = {
      title: formData.title,
      project_id: projectId,
      customer_id: customerId,
      priority: formData.priority,
      status: formData.status
    };

    // Add optional fields only if provided
    if (staffId) dataToValidate.staff_id = staffId;
    if (formData.task_type) dataToValidate.task_type = formData.task_type;
    if (formData.notes) dataToValidate.notes = formData.notes;
    if (formData.estimated_hours) dataToValidate.estimated_hours = formData.estimated_hours;
    if (formData.due_date) dataToValidate.due_date = formData.due_date;

    const validation = validateTaskData(dataToValidate, { isUpdate: isEdit });

    if (!validation.isValid) {
      setErrors(validation.fieldErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData = {
        // New backend field names
        project_id: projectId,
        customer_id: customerId,
        title: formData.title.trim(),
        priority: formData.priority,
        status: formData.status,

        // Legacy FileMaker field names for backward compatibility
        _projectID: projectId,
        _custID: customerId,
        taskName: formData.title.trim(),
        task: formData.title.trim()
      };

      // Add optional fields only if provided
      if (staffId) {
        taskData.staff_id = staffId;
        taskData._staffID = staffId; // Legacy field
      }
      if (formData.task_type) {
        taskData.task_type = formData.task_type;
        taskData.type = formData.task_type; // Legacy field
      }
      if (formData.notes) {
        taskData.notes = formData.notes;
      }
      if (formData.estimated_hours) {
        taskData.estimated_hours = parseFloat(formData.estimated_hours);
      }
      if (formData.due_date) {
        taskData.due_date = formData.due_date;
      }

      // For edits, include the task ID
      if (isEdit && task?.id) {
        taskData.id = task.id;
      }

      await onSubmit(taskData);
    } catch (error) {
      console.error('[TaskForm] Submit error:', error);

      // Parse backend validation errors if present
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;

        // Handle array of validation errors (FastAPI format)
        if (Array.isArray(detail)) {
          const fieldErrors = {};
          detail.forEach(err => {
            const field = err.loc?.[err.loc.length - 1] || 'general';
            fieldErrors[field] = err.msg;
          });
          setErrors(fieldErrors);
        }
        // Handle string detail
        else if (typeof detail === 'string') {
          setErrors({ general: detail });
        }
      } else if (error.message) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Failed to save task. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800' : 'bg-white'}
      `}>
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? 'Edit Task' : 'Create New Task'}
        </h3>

        {/* General error message */}
        {errors.general && (
          <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700">
            <p className="text-red-700 dark:text-red-200 text-sm">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Task Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              maxLength={FIELD_LIMITS.TASK_TITLE}
              placeholder="Enter task title..."
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.title ? 'border-red-500' : ''}
              `}
              autoFocus
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value))}
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.priority ? 'border-red-500' : ''}
              `}
              disabled={isSubmitting}
            >
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
            {errors.priority && (
              <p className="text-red-500 text-xs mt-1">{errors.priority}</p>
            )}
          </div>

          {/* Status */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.status ? 'border-red-500' : ''}
              `}
              disabled={isSubmitting}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="text-red-500 text-xs mt-1">{errors.status}</p>
            )}
          </div>

          {/* Task Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Task Type
            </label>
            <input
              type="text"
              value={formData.task_type}
              onChange={(e) => handleChange('task_type', e.target.value)}
              maxLength={FIELD_LIMITS.TASK_TYPE}
              placeholder="e.g., Development, Design, Review..."
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.task_type ? 'border-red-500' : ''}
              `}
              disabled={isSubmitting}
            />
            {errors.task_type && (
              <p className="text-red-500 text-xs mt-1">{errors.task_type}</p>
            )}
          </div>

          {/* Estimated Hours */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Estimated Hours
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.estimated_hours}
              onChange={(e) => handleChange('estimated_hours', e.target.value)}
              placeholder="0.0"
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.estimated_hours ? 'border-red-500' : ''}
              `}
              disabled={isSubmitting}
            />
            {errors.estimated_hours && (
              <p className="text-red-500 text-xs mt-1">{errors.estimated_hours}</p>
            )}
          </div>

          {/* Due Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => handleChange('due_date', e.target.value)}
              className={`
                w-full p-2 rounded-md border
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.due_date ? 'border-red-500' : ''}
              `}
              disabled={isSubmitting}
            />
            {errors.due_date && (
              <p className="text-red-500 text-xs mt-1">{errors.due_date}</p>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              maxLength={FIELD_LIMITS.TASK_NOTES}
              placeholder="Additional task details..."
              className={`
                w-full p-2 rounded-md border resize-none
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'}
                ${errors.notes ? 'border-red-500' : ''}
              `}
              rows={4}
              disabled={isSubmitting}
            />
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {formData.notes.length} / {FIELD_LIMITS.TASK_NOTES} characters
            </div>
            {errors.notes && (
              <p className="text-red-500 text-xs mt-1">{errors.notes}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className={`
                px-4 py-2 rounded-md
                ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-200 hover:bg-gray-300'}
              `}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || isSubmitting}
              className={`
                px-4 py-2 bg-primary text-white rounded-md
                ${formData.title.trim() && !isSubmitting ? 'hover:bg-primary-hover' : 'opacity-50 cursor-not-allowed'}
              `}
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

TaskForm.propTypes = {
  projectId: PropTypes.string.isRequired,
  customerId: PropTypes.string.isRequired,
  staffId: PropTypes.string,
  task: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    task: PropTypes.string, // Legacy field
    task_type: PropTypes.string,
    type: PropTypes.string, // Legacy field
    notes: PropTypes.string,
    priority: PropTypes.number,
    status: PropTypes.string,
    estimated_hours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    due_date: PropTypes.string
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default React.memo(TaskForm);
