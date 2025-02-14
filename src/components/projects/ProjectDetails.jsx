import React from 'react';
import { useTheme } from '../layout/AppLayout';
import TaskList from '../tasks/TaskList';

export default function ProjectDetails({
  project,
  onTaskSelect = () => {},
  onStatusChange = () => {},
  onTaskCreate = () => {},
  onTaskUpdate = () => {},
  onTaskStatusChange = () => {}
}) {
  const { darkMode } = useTheme();

  const statusColors = {
    Open: 'text-green-600 dark:text-green-400',
    Closed: 'text-red-600 dark:text-red-400'
  };

  return (
    <div className="space-y-8">
      {/* Project Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {project.projectName}
          </h2>
          <select
            value={project.status}
            onChange={(e) => onStatusChange(project.__ID, e.target.value)}
            className={`
              px-3 py-1 rounded-md text-sm font-medium
              ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
              border
              ${statusColors[project.status]}
            `}
          >
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {project.estOfTime && (
            <span className="mr-4">Estimated Time: {project.estOfTime}</span>
          )}
          <span>Created: {new Date(project['~creationTimestamp']).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tasks Section */}
      <div>
        <TaskList
          tasks={project.tasks || []}
          projectId={project.__ID}
          onTaskSelect={onTaskSelect}
          onTaskStatusChange={onTaskStatusChange}
          onTaskCreate={onTaskCreate}
          onTaskUpdate={onTaskUpdate}
        />
      </div>

      {/* Project Objectives */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Objectives</h3>
        {project.objectives?.length > 0 ? (
          <div className="space-y-4">
            {project.objectives.map(objective => (
              <div
                key={objective.__ID}
                className={`
                  p-4 rounded-lg
                  ${darkMode ? 'bg-gray-800' : 'bg-white'}
                  border ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                `}
              >
                <h4 className="font-medium mb-2">{objective.projectObjective}</h4>
                
                {/* Objective Steps */}
                {objective.steps?.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Steps
                    </h5>
                    <ul className="space-y-2">
                      {objective.steps.map(step => (
                        <li
                          key={step.__ID}
                          className={`
                            flex items-center
                            ${step.f_completed ? 'line-through opacity-50' : ''}
                          `}
                        >
                          <span className="text-sm">{step.projectObjectiveStep}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No objectives defined for this project
          </div>
        )}
      </div>

      {/* Project Resources */}
      <div className="grid grid-cols-2 gap-6">
        {/* Links */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Links</h3>
          {project.links?.length > 0 ? (
            <div className="space-y-2">
              {project.links.map(link => (
                <a
                  key={link.__ID}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    block p-2 rounded
                    ${darkMode 
                      ? 'text-blue-400 hover:bg-gray-800' 
                      : 'text-blue-600 hover:bg-gray-100'
                    }
                  `}
                >
                  {link.title || link.url}
                </a>
              ))}
            </div>
          ) : (
            <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No links available
            </div>
          )}
        </div>

        {/* Images */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Images</h3>
          {project.images?.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {project.images.map(image => (
                <div
                  key={image.__ID}
                  className={`
                    aspect-square rounded-lg overflow-hidden
                    border ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                  `}
                >
                  <img
                    src={image.url}
                    alt={image.title || 'Project image'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No images available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}