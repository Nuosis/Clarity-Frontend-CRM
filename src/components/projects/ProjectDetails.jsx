import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useTeamContext } from '../../context/TeamContext';
import ProjectTasksTab from './ProjectTasksTab';
import ProjectObjectivesTab from './ProjectObjectivesTab';
import ProjectNotesTab from './ProjectNotesTab';
import ProjectLinksTab from './ProjectLinksTab';
import ProjectTeamTab from './ProjectTeamTab';
import ProjectProposalsTab from '../proposals/ProjectProposalsTab';

function ProjectDetails({
  projectId,
  tasks = [],
  onTaskSelect = () => {},
  onStatusChange = () => {},
  onTaskCreate = () => {},
  onTaskUpdate = () => {},
  onTaskStatusChange = () => {},
  onDelete = () => {},
  onTeamChange = () => Promise.resolve(), // Ensure it returns a Promise
  onObjectiveCreate = () => {},
  project
}) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('proposal'); // Default to proposal tab
  const [localProject, setLocalProject] = useState(project);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Use TeamContext instead of props
  const teamContext = useTeamContext();
  // Get teams and loadTeams from context with fallbacks
  const { loadTeams = (() => Promise.resolve([])) } = teamContext || {};
  
  // Load teams when component mounts
  useEffect(() => {
    if (loadTeams && typeof loadTeams === 'function') {
      loadTeams().catch(err => {
        console.error('Error loading teams:', err);
      });
    }
  }, [loadTeams]);
  
  // Update local project state when the project prop changes
  useEffect(() => {
    setLocalProject(project);
  }, [project]);

  // Show loading state
  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* Project Header */}
      <div className={`
        border-b pb-4
        ${darkMode ? 'border-gray-700' : 'border-gray-200'}
      `}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {project?.projectName}
          </h2>
          <div className="flex items-center space-x-4">
            {/* Status Toggle */}
            {project?.status && (
              <div className="flex items-center">
                <button
                  onClick={() => {
                    console.log("Toggle clicked");
                    
                    // Use localProject if available, otherwise fall back to project
                    const currentProject = localProject || project;
                    
                    // Get the new status
                    const newStatus = currentProject.status === "Open" ? "Closed" : "Open";
                    console.log("New status:", newStatus);
                    
                    // Get the recordId
                    const recordId = currentProject?.recordId;
                    console.log("Project recordId:", recordId);
                    
                    if (recordId) {
                      // Create a copy of the project with the updated status for optimistic UI update
                      const updatedProject = { ...currentProject, status: newStatus };
                      
                      // Optimistically update the UI by setting the local project state
                      setLocalProject(updatedProject);
                      
                      // Call onStatusChange with the recordId and new status
                      console.log("Calling onStatusChange with:", recordId, newStatus);
                      onStatusChange(recordId, newStatus).catch(error => {
                        // If there's an error, revert the optimistic update
                        console.error("Error updating status:", error);
                        setLocalProject(currentProject);
                      });
                    } else {
                      console.error("Could not find a valid recordId in the project object");
                    }
                  }}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full
                    ${(localProject || project).status === "Open"
                      ? "bg-green-500"
                      : "bg-red-500"}
                    transition-colors duration-200 ease-in-out focus:outline-none
                  `}
                  aria-pressed={(localProject || project).status === "Open"}
                  aria-label="Toggle project status"
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white
                      transition-transform duration-200 ease-in-out
                      ${(localProject || project).status === "Open" ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>
            )}
            
            {/* Delete Button (Trash Can Icon) */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-800 focus:outline-none"
              aria-label="Delete project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className={`
            fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50
          `}>
            <div className={`
              p-6 rounded-lg shadow-lg max-w-md w-full
              ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
              <h3 className="text-xl font-bold mb-4">Delete Project</h3>
              <p className="mb-6">
                Are you sure you want to delete this project? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (project?.id) {
                      await onDelete(project.id);
                      setShowDeleteConfirm(false);
                      // The project has been deleted, so we don't need to do anything else here
                      // The parent component will handle navigating back to the customer details
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <div className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {project?.estOfTime && (
            <span className="mr-4">Estimated Time: {project.estOfTime}</span>
          )}
          {project?.createdAt && (
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
          )}
        </div>

        {project?.stats && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className={`
              p-3 rounded-lg
              ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
            `}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Total Hours
              </div>
              <div className="text-2xl font-semibold mt-1">
                {(Number(project.stats.totalHours) || 0).toFixed(1)}
              </div>
            </div>
            <div className={`
              p-3 rounded-lg
              ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
            `}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Unbilled Hours
              </div>
              <div className="text-2xl font-semibold mt-1">
                {(Number(project.stats.unbilledHours) || 0).toFixed(1)}
              </div>
            </div>
            <div className={`
              p-3 rounded-lg
              ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
            `}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Completion
              </div>
              <div className="text-2xl font-semibold mt-1">
                {project.stats.completion || 0}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex mb-4 border-b">
        {/* Proposal Tab - NEW FIRST TAB */}
        <button
          onClick={() => setActiveTab('proposal')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'proposal'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Proposal
          {activeTab === 'proposal' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {/* Team Tab - MOVED TO SECOND */}
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'team'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Team
          {activeTab === 'team' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {/* Objectives Tab - MOVED TO THIRD */}
        <button
          onClick={() => setActiveTab('objectives')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'objectives'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Objectives
          {activeTab === 'objectives' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {/* Tasks Tab - MOVED TO FOURTH */}
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'tasks'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Tasks
          {activeTab === 'tasks' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {/* Notes Tab - MOVED TO FIFTH */}
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'notes'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Notes
          {activeTab === 'notes' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {/* Links Tab - MOVED TO SIXTH */}
        <button
          onClick={() => setActiveTab('links')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'links'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Links
          {activeTab === 'links' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {/* Proposal Tab - NEW */}
        {activeTab === 'proposal' && project && (
          <ProjectProposalsTab
            project={project}
            darkMode={darkMode}
            localProject={localProject}
            setLocalProject={setLocalProject}
          />
        )}
        
        {/* Tasks Tab */}
        {activeTab === 'tasks' && project?.id && (
          <ProjectTasksTab
            projectId={project.id}
            tasks={tasks}
            onTaskSelect={onTaskSelect}
            onTaskStatusChange={onTaskStatusChange}
            onTaskCreate={onTaskCreate}
            onTaskUpdate={onTaskUpdate}
          />
        )}

        {/* Objectives Tab */}
        {activeTab === 'objectives' && project && (
          <ProjectObjectivesTab
            project={project}
            darkMode={darkMode}
            onCreateObjective={onObjectiveCreate}
          />
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && project && (
          <ProjectNotesTab
            project={project}
            darkMode={darkMode}
          />
        )}

        {/* Links Tab */}
        {activeTab === 'links' && project && (
          <ProjectLinksTab
            project={project}
            darkMode={darkMode}
            localProject={localProject}
            setLocalProject={setLocalProject}
          />
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <ProjectTeamTab
            project={project}
            darkMode={darkMode}
            localProject={localProject}
            setLocalProject={setLocalProject}
            onTeamChange={onTeamChange}
          />
        )}
      </div>
    </div>
  );
}

ProjectDetails.propTypes = {
  projectId: PropTypes.string.isRequired,
  tasks: PropTypes.arrayOf(PropTypes.object),
  onTaskSelect: PropTypes.func,
  onStatusChange: PropTypes.func,
  onTaskCreate: PropTypes.func,
  onTaskUpdate: PropTypes.func,
  onTaskStatusChange: PropTypes.func,
  onDelete: PropTypes.func,
  onTeamChange: PropTypes.func,
  project: PropTypes.shape({
    id: PropTypes.string,
    recordId: PropTypes.string.isRequired,
    projectName: PropTypes.string.isRequired,
    status: PropTypes.string,
    estOfTime: PropTypes.string,
    createdAt: PropTypes.string,
    _teamID: PropTypes.string,
    stats: PropTypes.shape({
      totalHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      unbilledHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      completion: PropTypes.number
    }),
    notes: PropTypes.arrayOf(PropTypes.object),
    links: PropTypes.arrayOf(PropTypes.object),
    objectives: PropTypes.arrayOf(PropTypes.object)
  }).isRequired
};

export default React.memo(ProjectDetails);
