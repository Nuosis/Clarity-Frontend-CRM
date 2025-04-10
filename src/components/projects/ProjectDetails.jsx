import React, { useMemo, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProject } from '../../hooks/useProject';
import { useNote } from '../../hooks/useNote';
import { useLink } from '../../hooks/useLink';
import { useTeamContext } from '../../context/TeamContext';
import TaskList from '../tasks/TaskList';
import TextInput from '../global/TextInput';

// Memoized objective component
const Objective = React.memo(function Objective({
    objective,
    darkMode
}) {
    const completion = useMemo(() => {
        if (!objective.steps.length) return 0;
        const completed = objective.steps.filter(step => step.completed).length;
        return Math.round((completed / objective.steps.length) * 100);
    }, [objective.steps]);

    return (
        <div className={`
            p-4 rounded-lg border
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{objective.objective}</h4>
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {completion}% Complete
                </span>
            </div>
            
            {objective.steps?.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Steps
                    </h5>
                    <ul className="space-y-2">
                        {objective.steps.map(step => (
                            <li
                                key={step.id}
                                className={`
                                    flex items-center
                                    ${step.completed ? 'line-through opacity-50' : ''}
                                `}
                            >
                                <span className="text-sm">{step.step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
});

Objective.propTypes = {
    objective: PropTypes.shape({
        objective: PropTypes.string.isRequired,
        steps: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            step: PropTypes.string.isRequired,
            completed: PropTypes.bool.isRequired
        })).isRequired
    }).isRequired,
    darkMode: PropTypes.bool.isRequired
};

// Memoized resource grid component
const ResourceGrid = React.memo(function ResourceGrid({
    title,
    items,
    renderItem,
    darkMode,
    emptyMessage
}) {
    if (!items?.length) {
        return (
            <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="grid grid-cols-2 gap-4">
                {items.map(renderItem)}
            </div>
        </div>
    );
});

ResourceGrid.propTypes = {
    title: PropTypes.string,
    items: PropTypes.array,
    renderItem: PropTypes.func.isRequired,
    darkMode: PropTypes.bool.isRequired,
    emptyMessage: PropTypes.string.isRequired
};

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
    project
}) {
    const { darkMode } = useTheme();
    const [showNewNoteInput, setShowNewNoteInput] = useState(false);
    const [showNewLinkInput, setShowNewLinkInput] = useState(false);
    const [localProject, setLocalProject] = useState(project);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const { handleNoteCreate, loading: noteLoading } = useNote();
    const { handleLinkCreate, loading: linkLoading } = useLink();
    const { loadProjectDetails } = useProject();
    
    // Use TeamContext instead of props
    const teamContext = useTeamContext();
    // Get teams and loadTeams from context with fallbacks
    const { teams = [], loadTeams = (() => Promise.resolve([])) } = teamContext || {};
    
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
    
    // Update local project state when the project prop changes
    useEffect(() => {
        setLocalProject(project);
    }, [project]);
    

    // Calculate project stats using service
    const stats = useMemo(() => {
        if (!project?.stats) return null;
        return project.stats;
    }, [project]);

    // Memoized handlers
    const handleStatusChange = useCallback((e) => {
        if (project?.recordId) {
            onStatusChange(project.recordId, e.target.value);
        }
    }, [project, onStatusChange]);

    // Memoized renderers
    const renderLink = useCallback((link) => (
        <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
                block p-2 rounded
                ${darkMode
                    ? 'text-blue-400 hover:bg-gray-800'
                    : 'text-blue-600 hover:bg-gray-100'}
            `}
        >
            {link.title || link.url}
        </a>
    ), [darkMode]);

    const renderImage = useCallback((image) => (
        <div
            key={image.id}
            className={`
                aspect-square rounded-lg overflow-hidden border
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}
        >
            <img
                src={image.url}
                alt={image.title || 'Project image'}
                className="w-full h-full object-cover"
            />
        </div>
    ), [darkMode]);

    // Show loading state
    if (!project) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const statusColors = {
        Open: 'text-green-600 dark:text-green-400',
        Closed: 'text-red-600 dark:text-red-400'
    };

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

                {stats && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total Hours
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {(Number(stats.totalHours) || 0).toFixed(1)}
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
                                {(Number(stats.unbilledHours) || 0).toFixed(1)}
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
                                {stats.completion || 0}%
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Team Section */}
            <div className="mt-6 mb-8">
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
            </div>

            {/* Tasks Section */}
            {project?.id && (
                <TaskList
                    tasks={tasks}
                    projectId={project.id}
                    onTaskSelect={onTaskSelect}
                    onTaskStatusChange={onTaskStatusChange}
                    onTaskCreate={onTaskCreate}
                    onTaskUpdate={onTaskUpdate}
                />
            )}

            {/* Notes Section */}
            {project && (
                <div>
                    <div className="flex justify-between items-center mb-4 pr-5">
                        <h3 className="text-lg font-semibold">Notes</h3>
                        <button
                            onClick={() => setShowNewNoteInput(true)}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                            disabled={noteLoading}
                        >
                            {noteLoading ? 'Adding...' : 'New Note'}
                        </button>
                    </div>
                    {showNewNoteInput && (
                        <div className="mb-4">
                            <TextInput
                                title="Add Note"
                                placeholder="Enter your note..."
                                submitLabel="Create"
                                onSubmit={async (noteContent) => {
                                    try {
                                        const result = await handleNoteCreate(project.recordId, noteContent);
                                        if (result) {
                                            await loadProjectDetails(project.recordId);
                                            setShowNewNoteInput(false);
                                        }
                                    } catch (error) {
                                        console.error('Error creating note:', error);
                                    }
                                }}
                                onCancel={() => setShowNewNoteInput(false)}
                            />
                        </div>
                    )}
                    {project.notes?.length > 0 && (
                        <div className="space-y-4">
                            {project.notes.map(note => (
                                <div
                                    key={note.fieldData.__ID}
                                    className={`
                                        p-4 rounded-lg border
                                        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                                    `}
                                >
                                    <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{note.fieldData.note}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Links Section */}
            {project && (
                <div>
                    <div className="flex justify-between items-center mb-4 pr-5">
                        <h3 className="text-lg font-semibold">Links</h3>
                        <button
                            onClick={() => setShowNewLinkInput(true)}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                            disabled={linkLoading}
                        >
                            {linkLoading ? 'Adding...' : 'New Link'}
                        </button>
                    </div>
                    {showNewLinkInput && (
                        <div className="mb-4">
                            <TextInput
                                title="Add Link"
                                placeholder="Enter URL..."
                                submitLabel="Create"
                                onSubmit={async (url) => {
                                    try {
                                        // Create a temporary link object with a temporary ID
                                        const tempLink = {
                                            id: `temp-${Date.now()}`,
                                            url: url.trim(),
                                            title: new URL(url.trim()).hostname
                                        };
                                        
                                        // Optimistically update the UI by adding the new link to the local project state
                                        const updatedProject = {
                                            ...localProject || project,
                                            links: [...(localProject?.links || project?.links || []), tempLink]
                                        };
                                        setLocalProject(updatedProject);
                                        
                                        // Hide the input form
                                        setShowNewLinkInput(false);
                                        
                                        // Make the actual API call
                                        const result = await handleLinkCreate(project.__ID, url);
                                        
                                        if (result) {
                                            // On success, refresh the project details to get the actual link data
                                            await loadProjectDetails(project.__ID);
                                        } else {
                                            // If the API call failed, revert the optimistic update
                                            const revertedLinks = (localProject?.links || project?.links || [])
                                                .filter(link => link.id !== tempLink.id);
                                            
                                            setLocalProject({
                                                ...localProject || project,
                                                links: revertedLinks
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Error creating link:', error);
                                        
                                        // If there's an error, revert the optimistic update
                                        if (localProject?.links) {
                                            const revertedLinks = localProject.links
                                                .filter(link => !link.id.startsWith('temp-'));
                                            
                                            setLocalProject({
                                                ...localProject,
                                                links: revertedLinks
                                            });
                                        }
                                    }
                                }}
                                onCancel={() => setShowNewLinkInput(false)}
                            />
                        </div>
                    )}
                    {(localProject?.links || project?.links)?.length > 0 ? (
                        <ResourceGrid
                            items={localProject?.links || project?.links}
                            renderItem={renderLink}
                            darkMode={darkMode}
                            emptyMessage="No links added yet"
                        />
                    ) : (
                        <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            No links added yet
                        </div>
                    )}
                </div>
            )}

            {/* Objectives Section */}
            {project && (
                <div>
                    <div className="flex justify-between items-center mb-4 pr-5">
                        <h3 className="text-lg font-semibold">Objectives</h3>
                        <button
                            onClick={() => console.log('Add new objective')}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            New Objective
                        </button>
                    </div>
                    {project.objectives?.length > 0 && (
                        <div className="space-y-4">
                            {project.objectives.map(objective => (
                                <Objective
                                    key={objective.id}
                                    objective={objective}
                                    darkMode={darkMode}
                                />
                            ))}
                        </div>
                    )}
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
        notes: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            content: PropTypes.string.isRequired
        })),
        links: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            title: PropTypes.string
        })),
        objectives: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            objective: PropTypes.string.isRequired,
            steps: PropTypes.arrayOf(PropTypes.shape({
                id: PropTypes.string.isRequired,
                step: PropTypes.string.isRequired,
                completed: PropTypes.bool.isRequired
            }))
        }))
    }).isRequired
};

export default React.memo(ProjectDetails);
