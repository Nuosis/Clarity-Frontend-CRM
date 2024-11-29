import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

const AddTask = ({ isOpen, onClose, onSubmit, defaultProjectId }) => {
  const [task, setTask] = useState('');
  const [priority, setPriority] = useState('active');
  const [selectedProject, setSelectedProject] = useState(defaultProjectId || '');
  const [isOptionPressed, setIsOptionPressed] = useState(false);
  const [errors, setErrors] = useState({});
  
  const projectData = useSelector(state => state.project.projectData);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Alt') {
        setIsOptionPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        setIsOptionPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Group projects by customer
  const groupedProjects = projectData?.reduce((acc, project) => {
    const customerName = project.fieldData['Customers::Name'];
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(project);
    return acc;
  }, {}) || {};

  // Sort customers alphabetically
  const sortedCustomers = Object.keys(groupedProjects).sort();

  const validateForm = () => {
    const newErrors = {};
    if (!task.trim()) {
      newErrors.task = 'Task description is required';
    }
    if (!selectedProject) {
      newErrors.project = 'Project selection is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    onSubmit({ 
      task, 
      priority, 
      projectId: selectedProject,
      shouldActivate: isOptionPressed
    });
    
    handleClose();
  };

  const handleClose = () => {
    setTask('');
    setPriority('active');
    setSelectedProject(defaultProjectId || '');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">Add New Task</h2>
        <div className="mb-4">
          <input
            type="text"
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              setErrors({ ...errors, task: '' });
            }}
            placeholder="Task description"
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 ${
              errors.task ? 'border-red-500' : ''
            }`}
            required
          />
          {errors.task && (
            <p className="text-red-500 text-sm mt-1">{errors.task}</p>
          )}
        </div>
        <div className="mb-4">
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setErrors({ ...errors, project: '' });
            }}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white ${
              errors.project ? 'border-red-500' : ''
            }`}
            required
          >
            <option value="">Select Project</option>
            {sortedCustomers.map(customerName => (
              <optgroup key={customerName} label={customerName}>
                {groupedProjects[customerName]
                  .sort((a, b) => a.fieldData.projectName.localeCompare(b.fieldData.projectName))
                  .map(project => (
                    <option key={project.fieldData["__ID"]} value={project.fieldData["__ID"]}>
                      {project.fieldData.projectName}
                    </option>
                  ))
                }
              </optgroup>
            ))}
          </select>
          {errors.project && (
            <p className="text-red-500 text-sm mt-1">{errors.project}</p>
          )}
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
          required
        >
          <option value="active">Active</option>
          <option value="next">Next</option>
          <option value="shelved">Backlog</option>
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
          >
            {isOptionPressed ? 'Add and Activate' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTask;
