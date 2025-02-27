import React, { useMemo, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProject } from '../../hooks/useProject';
import { useNote } from '../../hooks/useNote';
import { useLink } from '../../hooks/useLink';
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
    project
}) {
    const { darkMode } = useTheme();
    const [showNewNoteInput, setShowNewNoteInput] = useState(false);
    const [showNewLinkInput, setShowNewLinkInput] = useState(false);
    const { handleNoteCreate, loading: noteLoading } = useNote();
    const { handleLinkCreate, loading: linkLoading } = useLink();
    const { loadProjectDetails } = useProject();
    console.log("Project in ProjectDetails:", project);

    // Calculate project stats using service
    const stats = useMemo(() => {
        if (!project?.stats) return null;
        return project.stats;
    }, [project]);

    // Memoized handlers
    const handleStatusChange = useCallback((e) => {
        if (project?.__ID) {
            onStatusChange(project.__ID, e.target.value);
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
        <div className="space-y-8 h-[calc(100vh)] overflow-y-auto">
            {/* Project Header */}
            <div className={`
                border-b pb-4 mt-6
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                        {project?.projectName}
                    </h2>
                    {project?.status && (
                        <select
                            value={project.status}
                            onChange={handleStatusChange}
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
                    )}
                </div>
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

            {/* Tasks Section */}
            {project?.__ID && (
                <TaskList
                    tasks={tasks}
                    projectId={project.__ID}
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
                                        const result = await handleNoteCreate(project.__ID, noteContent);
                                        if (result) {
                                            await loadProjectDetails(project.__ID);
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
                                        const result = await handleLinkCreate(project.__ID, url);
                                        if (result) {
                                            await loadProjectDetails(project.__ID);
                                            setShowNewLinkInput(false);
                                        }
                                    } catch (error) {
                                        console.error('Error creating link:', error);
                                    }
                                }}
                                onCancel={() => setShowNewLinkInput(false)}
                            />
                        </div>
                    )}
                    {project.links?.length > 0 && (
                        <ResourceGrid
                            items={project.links}
                            renderItem={renderLink}
                            darkMode={darkMode}
                            emptyMessage="No links added yet"
                        />
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
    project: PropTypes.shape({
        __ID: PropTypes.string.isRequired,
        projectName: PropTypes.string.isRequired,
        status: PropTypes.string,
        estOfTime: PropTypes.string,
        createdAt: PropTypes.string,
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
