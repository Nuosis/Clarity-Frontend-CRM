import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTeamContext } from '../../context/TeamContext';

function ProjectTeamTab({ project, darkMode, localProject, setLocalProject, onTeamChange }) {
  const [showTeamModal, setShowTeamModal] = useState(false);
  
  // Use TeamContext
  const teamContext = useTeamContext();
  // Get teams from context with fallbacks
  const { teams = [], teamsLoading = false } = teamContext || {};

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Assigned Team</h3>
        <button
          onClick={() => setShowTeamModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
        >
          {localProject?._teamID ? 'Change Team' : 'Assign Team'}
        </button>
      </div>
      
      {localProject?._teamID ? (
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
          {teams && teams.find(team => team && team.id === localProject._teamID) ? (
            <div className="flex items-center">
              <h4 className="font-medium">{teams.find(team => team && team.id === localProject._teamID)?.name}</h4>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Team information not available
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className={`
          text-center py-6 rounded-lg border
          ${darkMode
            ? 'bg-gray-800 border-gray-700 text-gray-400'
            : 'bg-gray-50 border-gray-200 text-gray-500'}
        `}>
          No team assigned to this project
        </div>
      )}

      {/* Team Selection Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            p-6 rounded-lg shadow-lg max-w-md w-full
            ${darkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <h3 className="text-xl font-bold mb-4">Select Team</h3>
            
            {teamsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : teams.length > 0 ? (
              <div className="max-h-60 overflow-y-auto mb-6">
                <div className="space-y-2">
                  {teams.map(team => (
                    <div
                      key={team.id}
                      onClick={() => {
                        // Create a copy of the project with the updated team
                        const updatedProject = { ...localProject, _teamID: team.id };
                        
                        // Optimistically update the UI
                        setLocalProject(updatedProject);
                        
                        // Call onTeamChange with the team ID
                        try {
                          const result = onTeamChange(localProject.recordId, team.id);
                          // Handle Promise if returned
                          if (result && typeof result.catch === 'function') {
                            result.catch(error => {
                              console.error("Error updating team:", error);
                              setLocalProject(localProject);
                            });
                          }
                        } catch (error) {
                          console.error("Error updating team:", error);
                          setLocalProject(localProject);
                        }
                        
                        // Close the modal
                        setShowTeamModal(false);
                      }}
                      className={`
                        p-3 rounded-lg border cursor-pointer
                        ${localProject?._teamID === team.id
                          ? (darkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200')
                          : (darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white border-gray-200 hover:bg-gray-50')}
                      `}
                    >
                      <div className="font-medium">{team.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No teams available
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ProjectTeamTab.propTypes = {
  project: PropTypes.shape({
    recordId: PropTypes.string.isRequired,
    _teamID: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.object,
  setLocalProject: PropTypes.func.isRequired,
  onTeamChange: PropTypes.func.isRequired
};

export default React.memo(ProjectTeamTab);