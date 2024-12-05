import React from 'react';
import ProjectSelect from './ProjectSelect';

const TaskForm = ({
  taskDescription,
  selectedProject,
  priority,
  isModified,
  onDescriptionChange,
  onProjectChange,
  onPriorityChange,
  onCancel,
  onSubmit
}) => {
  return (
    <>
      <input
        type="text"
        value={taskDescription}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Task description"
        className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
      />
      
      <ProjectSelect
        selectedProject={selectedProject}
        onChange={onProjectChange}
      />
      
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
      >
        <option value="active">Active</option>
        <option value="next">Next</option>
        <option value="shelved">Backlog</option>
      </select>
      
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-cyan-800 border border-cyan-800 rounded hover:bg-gray-100"
        >
          {isModified ? 'Cancel' : 'Close'}
        </button>
        {isModified && (
          <button
            onClick={onSubmit}
            className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
          >
            Update Task
          </button>
        )}
      </div>
    </>
  );
};

export default TaskForm;
