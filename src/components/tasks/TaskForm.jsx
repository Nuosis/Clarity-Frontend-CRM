import React, { useState, useEffect } from 'react';
import { useTheme } from '../layout/AppLayout';

export default function TaskForm({
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
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      _projectID: projectId,
      __ID: task?.__ID
    });
  };

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
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Task Name *
            </label>
            <input
              type="text"
              value={formData.task}
              onChange={(e) => setFormData(prev => ({ ...prev, task: e.target.value }))}
              required
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
              `}
              placeholder="Enter task name"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Type
            </label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
              `}
              placeholder="Enter task type"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
              `}
              placeholder="Enter task description"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className={`
                w-full p-2 rounded-md border
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
              `}
              placeholder="Enter task notes"
            />
          </div>

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