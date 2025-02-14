import React, { useState } from 'react';
import { useTheme } from '../layout/AppLayout';
import TaskForm from './TaskForm';

export default function TaskList({
  tasks = [],
  projectId = null,
  onTaskSelect = () => {},
  onTaskStatusChange = () => {},
  onTaskCreate = () => {},
  onTaskUpdate = () => {}
}) {
  const { darkMode } = useTheme();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Group tasks by status
  const activeTasks = tasks.filter(task => !task.f_completed);
  const completedTasks = tasks.filter(task => task.f_completed);

  const handleTaskSubmit = (taskData) => {
    if (taskData.__ID) {
      onTaskUpdate(taskData);
    } else {
      onTaskCreate(taskData);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        isOpen={showTaskForm}
        onClose={() => {
          setShowTaskForm(false);
          setEditingTask(null);
        }}
        onSubmit={handleTaskSubmit}
        projectId={projectId}
      />

      {/* Header with New Task Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tasks</h3>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowTaskForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          New Task
        </button>
      </div>

      {/* Active Tasks */}
      <div>
        <h4 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Active Tasks
        </h4>
        {activeTasks.length > 0 ? (
          <div className="space-y-2">
            {activeTasks.map(task => (
              <div
                key={task.__ID}
                className={`
                  p-4 rounded-lg border
                  ${darkMode 
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                  transition-colors duration-150
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{task.task}</h4>
                    {task.type && (
                      <span className={`
                        text-sm px-2 py-1 rounded-full
                        ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                      `}>
                        {task.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditTask(task)}
                      className={`
                        p-2 rounded-md text-sm
                        ${darkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'}
                      `}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onTaskStatusChange(task.__ID, true)}
                      className={`
                        p-2 rounded-md text-sm
                        ${darkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'}
                      `}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => onTaskSelect(task)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Start Timer
                    </button>
                  </div>
                </div>
                {(task.description || task.notes) && (
                  <div className="mt-2 space-y-2">
                    {task.description && (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {task.description}
                      </p>
                    )}
                    {task.notes && (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="font-medium">Notes:</span> {task.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`
            text-center py-8 rounded-lg border
            ${darkMode 
              ? 'bg-gray-800 border-gray-700 text-gray-400' 
              : 'bg-gray-50 border-gray-200 text-gray-500'}
          `}>
            No active tasks
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h4 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Completed Tasks
          </h4>
          <div className="space-y-2">
            {completedTasks.map(task => (
              <div
                key={task.__ID}
                className={`
                  p-4 rounded-lg border
                  ${darkMode 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className={`
                      font-medium mb-1 line-through
                      ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      {task.task}
                    </h4>
                    {task.type && (
                      <span className={`
                        text-sm px-2 py-1 rounded-full
                        ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                      `}>
                        {task.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditTask(task)}
                      className={`
                        p-2 rounded-md text-sm
                        ${darkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'}
                      `}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onTaskStatusChange(task.__ID, false)}
                      className={`
                        p-2 rounded-md text-sm
                        ${darkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-gray-100 hover:bg-gray-200'}
                      `}
                    >
                      Reopen
                    </button>
                  </div>
                </div>
                {(task.description || task.notes) && (
                  <div className="mt-2 space-y-2">
                    {task.description && (
                      <p className={`
                        text-sm line-through
                        ${darkMode ? 'text-gray-500' : 'text-gray-400'}
                      `}>
                        {task.description}
                      </p>
                    )}
                    {task.notes && (
                      <p className={`
                        text-sm line-through
                        ${darkMode ? 'text-gray-500' : 'text-gray-400'}
                      `}>
                        <span className="font-medium">Notes:</span> {task.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}