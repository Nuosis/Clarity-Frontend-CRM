import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useTask } from '../../hooks/useTask';

// Memoized task item component
const TaskItem = React.memo(function TaskItem({
    task,
    darkMode,
    onEdit,
    onStatusChange,
    onSelect
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { handleTaskSelect, taskNotes, taskLinks, timerRecords } = useTask();

    const toggleExpand = useCallback(async () => {
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);
        
        if (newExpandedState) {
            setIsLoading(true);
            try {
                await handleTaskSelect(task.id);
            } catch (error) {
                console.error('Error loading task details:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [isExpanded, task.id, handleTaskSelect]);

    return (
        <div
            className={`
                p-4 rounded-lg border
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                transition-colors duration-150
            `}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 space-x-3">
                    <button
                        onClick={toggleExpand}
                        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={isExpanded ? 'Collapse task details' : 'Expand task details'}
                    >
                        <svg
                            className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                    <div>
                        <h4 className="font-medium">{task.task}</h4>
                        {task.type && (
                            <span className={`
                                text-sm px-2 py-1 rounded-full
                                ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                            `}>
                                {task.type}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center">
                    {!task.isCompleted && (
                        <button
                            onClick={() => onSelect(task)}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            Start Timer
                        </button>
                    )}
                </div>
            </div>
            <div className={`
                overflow-hidden transition-all duration-200 ease-in-out
                ${isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}
            `}>
                <div className="space-y-2">
                    {isLoading ? (
                        <div className={`
                            text-sm
                            ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            Loading task details...
                        </div>
                    ) : (
                        <>
                            {task.description && (
                                <p className={`
                                    text-sm
                                    ${task.isCompleted
                                        ? (darkMode ? 'text-gray-500' : 'text-gray-400')
                                        : (darkMode ? 'text-gray-400' : 'text-gray-600')}
                                    ${task.isCompleted ? 'line-through' : ''}
                                `}>
                                    {task.description}
                                </p>
                            )}
                            {taskNotes?.length > 0 && (
                                <div className="space-y-1">
                                    <h5 className={`
                                        text-sm font-medium
                                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                    `}>
                                        Notes
                                    </h5>
                                    {taskNotes.map(note => (
                                        <p key={note.id} className={`
                                            text-sm pl-2 border-l-2
                                            ${darkMode 
                                                ? 'text-gray-400 border-gray-700' 
                                                : 'text-gray-600 border-gray-200'}
                                        `}>
                                            {note.content}
                                        </p>
                                    ))}
                                </div>
                            )}
                            {taskLinks?.length > 0 && (
                                <div className="space-y-1">
                                    <h5 className={`
                                        text-sm font-medium
                                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                    `}>
                                        Links
                                    </h5>
                                    {taskLinks.map(link => (
                                        <a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`
                                                text-sm block hover:underline
                                                ${darkMode ? 'text-blue-400' : 'text-blue-600'}
                                            `}
                                        >
                                            {link.url}
                                        </a>
                                    ))}
                                </div>
                            )}
                            {timerRecords?.length > 0 && (
                                <div className={`
                                    text-sm
                                    ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                `}>
                                    <span className="font-medium">Time Records:</span> {timerRecords.length} entries
                                </div>
                            )}
                            <button
                                onClick={() => onStatusChange(task.id, !task.isCompleted)}
                                className={`
                                    p-2 rounded-md text-sm w-full text-left
                                    ${darkMode 
                                        ? 'bg-gray-700 hover:bg-gray-600' 
                                        : 'bg-gray-100 hover:bg-gray-200'}
                                `}
                            >
                                {task.isCompleted ? 'Reopen Task' : 'Mark as Complete'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

TaskItem.propTypes = {
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        type: PropTypes.string,
        description: PropTypes.string,
        notes: PropTypes.string,
        isCompleted: PropTypes.bool.isRequired
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired
};

// Memoized task section component
const TaskSection = React.memo(function TaskSection({
    title,
    tasks,
    darkMode,
    onEdit,
    onStatusChange,
    onSelect,
    emptyMessage
}) {
    if (tasks.length === 0) {
        return (
            <div className={`
                text-center py-8 rounded-lg border
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-400' 
                    : 'bg-gray-50 border-gray-200 text-gray-500'}
            `}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div>
            <h4 className={`
                text-sm font-medium mb-3
                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
            `}>
                {title}
            </h4>
            <div className="space-y-2">
                {tasks.map(task => (
                    <TaskItem
                        key={task.id}
                        task={task}
                        darkMode={darkMode}
                        onEdit={onEdit}
                        onStatusChange={onStatusChange}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
});

TaskSection.propTypes = {
    title: PropTypes.string.isRequired,
    tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired,
    emptyMessage: PropTypes.string.isRequired
};

function TaskList({
    tasks = [],
    projectId = null,
    onTaskSelect = () => {},
    onTaskStatusChange = () => {},
    onTaskCreate = () => {},
    onTaskUpdate = () => {}
}) {
    const { darkMode } = useTheme();
    const [showCompleted, setShowCompleted] = useState(false);

    // Memoized task grouping
    const { activeTasks, completedTasks } = useMemo(() => {
        return tasks.reduce((acc, task) => {
            if (task.isCompleted) {
                acc.completedTasks.push(task);
            } else {
                acc.activeTasks.push(task);
            }
            return acc;
        }, { activeTasks: [], completedTasks: [] });
    }, [tasks]);

    // Memoized handlers
    const handleEdit = useCallback((task) => {
        onTaskUpdate(task.id, task);
    }, [onTaskUpdate]);

    const handleStatusChange = useCallback((taskId, completed) => {
        onTaskStatusChange(taskId, completed);
    }, [onTaskStatusChange]);

    const handleSelect = useCallback((task) => {
        onTaskSelect(task);
    }, [onTaskSelect]);

    return (
        <div className="space-y-6">
            {/* Header with New Task Button */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Tasks</h3>
                <button
                    onClick={() => onTaskCreate({ projectId })}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                >
                    New Task
                </button>
            </div>

            {/* Active Tasks */}
            <TaskSection
                title="Active Tasks"
                tasks={activeTasks}
                darkMode={darkMode}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onSelect={handleSelect}
                emptyMessage="No active tasks"
            />

            {/* Completed Tasks Toggle */}
            {completedTasks.length > 0 && (
                <div className="space-y-4">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className={`
                            text-sm px-3 py-1 rounded-md
                            ${darkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}
                        `}
                    >
                        {showCompleted ? 'Hide' : 'Show'} Completed Tasks ({completedTasks.length})
                    </button>
                    
                    {showCompleted && (
                        <TaskSection
                            title="Completed Tasks"
                            tasks={completedTasks}
                            darkMode={darkMode}
                            onEdit={handleEdit}
                            onStatusChange={handleStatusChange}
                            onSelect={handleSelect}
                            emptyMessage="No completed tasks"
                        />
                    )}
                </div>
            )}
        </div>
    );
}

TaskList.propTypes = {
    tasks: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            task: PropTypes.string.isRequired,
            type: PropTypes.string,
            description: PropTypes.string,
            notes: PropTypes.string,
            isCompleted: PropTypes.bool.isRequired
        })
    ),
    projectId: PropTypes.string,
    onTaskSelect: PropTypes.func,
    onTaskStatusChange: PropTypes.func,
    onTaskCreate: PropTypes.func,
    onTaskUpdate: PropTypes.func
};

TaskList.defaultProps = {
    tasks: [],
    projectId: null,
    onTaskSelect: () => {},
    onTaskStatusChange: () => {},
    onTaskCreate: () => {},
    onTaskUpdate: () => {}
};

export default React.memo(TaskList);