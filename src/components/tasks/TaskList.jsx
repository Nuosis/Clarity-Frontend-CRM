import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useTask } from '../../hooks/useTask';
import { formatDuration } from '../../services/taskService';
import { createNote } from '../../services/noteService';
import { createLink } from '../../services/linkService';
import TextInput from '../global/TextInput';
import ErrorBoundary from '../ErrorBoundary';
import TaskTimer from './TaskTimer';

// Memoized task item component
const TaskItem = React.memo(function TaskItem({
    task,
    darkMode,
    onEdit,
    onStatusChange,
    onExpand,
    taskNotes,
    taskLinks,
    timerRecords,
    isLoading,
    handleTimerStart,
    handleTaskSelect
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);

    const handleNoteSubmit = async (note) => {
        try {
            await createNote(task.id, note);
            await onExpand(task.id); // Refresh task details
            setShowNoteInput(false);
        } catch (error) {
            console.error('Error creating note:', error);
        }
    };

    const handleLinkSubmit = async (url) => {
        try {
            await createLink(task.id, url);
            await onExpand(task.id); // Refresh task details
            setShowLinkInput(false);
        } catch (error) {
            console.error('Error creating link:', error);
        }
    };

    const toggleExpand = useCallback(async () => {
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);
        
        if (newExpandedState) {
            await onExpand(task.id);
        }
    }, [isExpanded, task.id, onExpand]);

    console.log({timerRecords})

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
                            onClick={async () => {
                                try {
                                    const { task: selectedTask } = await handleTaskSelect(task.id);
                                    await handleTimerStart(selectedTask);
                                } catch (error) {
                                    console.error('Error starting timer:', error);
                                }
                            }}
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
                                <div>
                                    <h5 className={`
                                        text-sm font-medium mb-2
                                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                    `}>
                                        Notes
                                    </h5>
                                    <div className="max-h-[105px] overflow-y-auto pr-2">
                                        <div className="space-y-2">
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
                                    </div>
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
                                <>
                                    <div className={`
                                        text-sm
                                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                    `}>
                                        <span className="font-medium">Total Time:</span> {formatDuration(timerRecords.reduce((total, record) => total + ((record.duration || 0) * 60), 0))}
                                    </div>
                                </>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowNoteInput(true)}
                                    className={`
                                        p-2 rounded-md text-sm flex-1
                                        ${darkMode
                                            ? 'bg-gray-700 hover:bg-gray-600'
                                            : 'bg-gray-100 hover:bg-gray-200'}
                                    `}
                                >
                                    New Note
                                </button>
                                <button
                                    onClick={() => setShowLinkInput(true)}
                                    className={`
                                        p-2 rounded-md text-sm flex-1
                                        ${darkMode
                                            ? 'bg-gray-700 hover:bg-gray-600'
                                            : 'bg-gray-100 hover:bg-gray-200'}
                                    `}
                                >
                                    New Link
                                </button>
                                <button
                                    onClick={() => onStatusChange(task.id, !task.isCompleted)}
                                    className={`
                                        p-2 rounded-md text-sm flex-1
                                        ${darkMode
                                            ? 'bg-gray-700 hover:bg-gray-600'
                                            : 'bg-gray-100 hover:bg-gray-200'}
                                    `}
                                >
                                    {task.isCompleted ? 'Reopen Task' : 'Mark as Complete'}
                                </button>
                            </div>
                            {showNoteInput && (
                                <TextInput
                                    title="Add Note"
                                    placeholder="Enter your note..."
                                    submitLabel="Create"
                                    onSubmit={handleNoteSubmit}
                                    onCancel={() => setShowNoteInput(false)}
                                />
                            )}
                            {showLinkInput && (
                                <TextInput
                                    title="Add Link"
                                    placeholder="Enter URL..."
                                    submitLabel="Create"
                                    onSubmit={handleLinkSubmit}
                                    onCancel={() => setShowLinkInput(false)}
                                />
                            )}
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
    onEdit: PropTypes.func.isRequired, // Called with task object including type: 'note' or 'link'
    onStatusChange: PropTypes.func.isRequired,
    onExpand: PropTypes.func.isRequired,
    taskNotes: PropTypes.array,
    taskLinks: PropTypes.array,
    timerRecords: PropTypes.array,
    isLoading: PropTypes.bool,
    handleTimerStart: PropTypes.func.isRequired,
    handleTaskSelect: PropTypes.func.isRequired
};

// Memoized task section component
const TaskSection = React.memo(function TaskSection({
    title,
    tasks,
    darkMode,
    onEdit,
    onStatusChange,
    onExpand,
    taskNotes,
    taskLinks,
    timerRecords,
    isLoading,
    emptyMessage,
    handleTimerStart,
    handleTaskSelect
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
                        onExpand={onExpand}
                        taskNotes={taskNotes}
                        taskLinks={taskLinks}
                        timerRecords={timerRecords}
                        isLoading={isLoading}
                        handleTimerStart={handleTimerStart}
                        handleTaskSelect={handleTaskSelect}
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
    onExpand: PropTypes.func.isRequired,
    taskNotes: PropTypes.array,
    taskLinks: PropTypes.array,
    timerRecords: PropTypes.array,
    isLoading: PropTypes.bool,
    emptyMessage: PropTypes.string.isRequired,
    handleTimerStart: PropTypes.func.isRequired,
    handleTaskSelect: PropTypes.func.isRequired
};

function TaskList({
    tasks = [],
    projectId = null,
    onTaskStatusChange = () => {},
    onTaskCreate = () => {},
    onTaskUpdate = () => {}
}) {
    const { darkMode } = useTheme();
    const [showCompleted, setShowCompleted] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const {
        handleTaskSelect,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        taskNotes,
        taskLinks,
        timerRecords,
        loading,
        selectedTask,
        timer
    } = useTask(projectId);

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

    const handleExpand = useCallback(async (taskId) => {
        setExpandedTaskId(taskId);
        try {
            await handleTaskSelect(taskId);
        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }, [handleTaskSelect]);

    // Memoized handlers
    const handleEdit = useCallback((task) => {
        onTaskUpdate(task.id, task);
    }, [onTaskUpdate]);

    const handleStatusChange = useCallback((taskId, completed) => {
        onTaskStatusChange(taskId, completed);
    }, [onTaskStatusChange]);

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

            {/* Timer */}
            {timer?.recordId && selectedTask && (
                <div className="mb-6">
                    <TaskTimer
                        task={selectedTask}
                        timer={timer}
                        onStart={handleTimerStart}
                        onPause={handleTimerPause}
                        onStop={handleTimerStop}
                        onAdjust={handleTimerAdjust}
                    />
                </div>
            )}

            {/* Active Tasks */}
            <TaskSection
                title="Active Tasks"
                tasks={activeTasks}
                darkMode={darkMode}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onExpand={handleExpand}
                taskNotes={taskNotes}
                taskLinks={taskLinks}
                timerRecords={timerRecords}
                isLoading={loading}
                emptyMessage="No active tasks"
                handleTimerStart={handleTimerStart}
                handleTaskSelect={handleTaskSelect}
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
                            onExpand={handleExpand}
                            taskNotes={taskNotes}
                            taskLinks={taskLinks}
                            timerRecords={timerRecords}
                            isLoading={loading}
                            emptyMessage="No completed tasks"
                            handleTimerStart={handleTimerStart}
                            handleTaskSelect={handleTaskSelect}
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
    onTaskStatusChange: PropTypes.func,
    onTaskCreate: PropTypes.func,
    onTaskUpdate: PropTypes.func
};

export default React.memo(function WrappedTaskList(props) {
    return (
        <ErrorBoundary>
            <TaskList {...props} />
        </ErrorBoundary>
    );
});