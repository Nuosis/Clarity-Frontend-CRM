import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import TaskList from '../tasks/TaskList';

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
    title: PropTypes.string.isRequired,
    items: PropTypes.array,
    renderItem: PropTypes.func.isRequired,
    darkMode: PropTypes.bool.isRequired,
    emptyMessage: PropTypes.string.isRequired
};

function ProjectDetails({
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

    // Memoized handlers
    const handleStatusChange = useCallback((e) => {
        onStatusChange(project.id, e.target.value);
    }, [project.id, onStatusChange]);

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

    return (
        <div className="space-y-8 h-[calc(100vh)] overflow-y-auto">
            {/* Project Header */}
            <div className={`
                border-b pb-4
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                        {project.projectName}
                    </h2>
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
                </div>
                <div className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {project.estOfTime && (
                        <span className="mr-4">Estimated Time: {project.estOfTime}</span>
                    )}
                    <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className={`
                        p-3 rounded-lg
                        ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                    `}>
                        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Total Hours
                        </div>
                        <div className="text-2xl font-semibold mt-1">
                            {project.stats.totalHours}
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
                            {project.stats.unbilledHours}
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
                            {Math.round(project.objectives.reduce(
                                (total, obj) => total + (obj.completed ? 1 : 0),
                                0
                            ) / project.objectives.length * 100) || 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Tasks Section */}
            <TaskList
                tasks={project.tasks || []}
                projectId={project.id}
                onTaskSelect={onTaskSelect}
                onTaskStatusChange={onTaskStatusChange}
                onTaskCreate={onTaskCreate}
                onTaskUpdate={onTaskUpdate}
            />

            {/* Notes Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <button
                        onClick={() => console.log('Add new note')}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                    >
                        New Note
                    </button>
                </div>
                {project.notes?.length > 0 && (
                    <div className="space-y-4">
                        {project.notes.map(note => (
                            <div
                                key={note.id}
                                className={`
                                    p-4 rounded-lg border
                                    ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                                `}
                            >
                                <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{note.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Links Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Links</h3>
                    <button
                        onClick={() => console.log('Add new link')}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                    >
                        New Link
                    </button>
                </div>
                {project.links?.length > 0 && (
                    <ResourceGrid
                        title="Links"
                        items={project.links}
                        renderItem={renderLink}
                        darkMode={darkMode}
                    />
                )}
            </div>

            {/* Objectives Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
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

        </div>
    );
}

ProjectDetails.propTypes = {
    project: PropTypes.shape({
        id: PropTypes.string.isRequired,
        projectName: PropTypes.string.isRequired,
        status: PropTypes.oneOf(['Open', 'Closed']).isRequired,
        estOfTime: PropTypes.string,
        createdAt: PropTypes.string.isRequired,
        tasks: PropTypes.array,
        objectives: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            objective: PropTypes.string.isRequired,
            steps: PropTypes.arrayOf(PropTypes.shape({
                id: PropTypes.string.isRequired,
                step: PropTypes.string.isRequired,
                completed: PropTypes.bool.isRequired
            })).isRequired
        })),
        links: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            title: PropTypes.string
        })),
        images: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            title: PropTypes.string
        })),
        stats: PropTypes.shape({
            totalHours: PropTypes.number.isRequired,
            unbilledHours: PropTypes.number.isRequired
        }).isRequired
    }).isRequired,
    onTaskSelect: PropTypes.func,
    onStatusChange: PropTypes.func,
    onTaskCreate: PropTypes.func,
    onTaskUpdate: PropTypes.func,
    onTaskStatusChange: PropTypes.func
};

export default React.memo(ProjectDetails);
