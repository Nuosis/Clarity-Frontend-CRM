import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

// Memoized task item component
const TaskItem = React.memo(function TaskItem({
    task,
    darkMode,
    onEdit,
    onStatusChange,
    onSelect
}) {
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
                        onClick={() => onEdit(task)}
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
                        onClick={() => onStatusChange(task.id, !task.isCompleted)}
                        className={`
                            p-2 rounded-md text-sm
                            ${darkMode 
                                ? 'bg-gray-700 hover:bg-gray-600' 
                                : 'bg-gray-100 hover:bg-gray-200'}
                        `}
                    >
                        {task.isCompleted ? 'Reopen' : 'Complete'}
                    </button>
                    {!task.isCompleted && (
                        <button
                            onClick={() => onSelect(task)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Start Timer
                        </button>
                    )}
                </div>
            </div>
            {(task.description || task.notes) && (
                <div className="mt-2 space-y-2">
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
                    {task.notes && (
                        <p className={`
                            text-sm
                            ${task.isCompleted
                                ? (darkMode ? 'text-gray-500' : 'text-gray-400')
                                : (darkMode ? 'text-gray-400' : 'text-gray-600')}
                            ${task.isCompleted ? 'line-through' : ''}
                        `}>
                            <span className="font-medium">Notes:</span> {task.notes}
                        </p>
                    )}
                </div>
            )}
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
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