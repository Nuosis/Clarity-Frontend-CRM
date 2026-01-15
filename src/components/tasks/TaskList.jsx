import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useTask } from '../../hooks/useTask';
import { useNote } from '../../hooks/useNote';
import { useLink } from '../../hooks/useLink';
import { useAppState } from '../../context/AppStateContext';
import { formatDuration } from '../../services/taskService';
import { useSnackBar } from '../../context/SnackBarContext';
import TextInput from '../global/TextInput';
import ErrorBoundary from '../ErrorBoundary';
import TaskTimer from './TaskTimer';
import TaskForm from './TaskForm';

// Memoized task item component
const TaskItem = React.memo(function TaskItem({
    task,
    darkMode,
    onStatusChange,
    onExpand,
    taskNotes,
    taskLinks,
    timerRecords,
    isLoading,
    handleTimerStart,
    handleTaskSelect,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleCreateLink,
    handleLoadMoreNotes,
    notesPagination,
    notesLoading
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const { showError } = useSnackBar();

    const toggleExpand = useCallback(async () => {
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);

        if (newExpandedState) {
            await onExpand(task.id);
        }
    }, [isExpanded, task.id, onExpand]);

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
                    <h4 className="font-medium">{task.title || task.task}</h4>
                </div>
                <div className="flex items-center">
                    {!task.isCompleted && (
                        <button
                            onClick={async () => {
                                try {
                                    const { task: selectedTask } = await handleTaskSelect(task.id);
                                    await handleTimerStart(selectedTask);
                                } catch (error) {
                                    showError('Error starting timer');
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
                                            {taskNotes.map(note => {
                                                const isEditing = editingNoteId === note.id;
                                                return isEditing ? (
                                                    <div key={note.id} className="space-y-1">
                                                        <textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className={`
                                                                w-full p-1 text-sm rounded border resize-none
                                                                ${darkMode
                                                                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                                                                    : 'bg-white border-gray-300 text-gray-900'}
                                                            `}
                                                            rows={2}
                                                        />
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await handleUpdateNote(note.id, { content: editContent.trim() });
                                                                        await onExpand(task.id);
                                                                        setEditingNoteId(null);
                                                                        setEditContent('');
                                                                    } catch (error) {
                                                                        showError('Error updating note');
                                                                    }
                                                                }}
                                                                disabled={!editContent.trim()}
                                                                className="px-2 py-0.5 text-xs bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingNoteId(null);
                                                                    setEditContent('');
                                                                }}
                                                                className={`
                                                                    px-2 py-0.5 text-xs rounded
                                                                    ${darkMode
                                                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                                                                `}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={note.id} className="flex justify-between items-start group">
                                                        <p className={`
                                                            text-sm pl-2 border-l-2 flex-1
                                                            ${darkMode
                                                                ? 'text-gray-400 border-gray-700'
                                                                : 'text-gray-600 border-gray-200'}
                                                        `}>
                                                            {note.content}
                                                        </p>
                                                        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingNoteId(note.id);
                                                                    setEditContent(note.content);
                                                                }}
                                                                className={`
                                                                    px-1 py-0.5 text-xs rounded
                                                                    ${darkMode
                                                                        ? 'text-blue-400 hover:bg-gray-700'
                                                                        : 'text-blue-600 hover:bg-blue-50'}
                                                                `}
                                                                data-testid={`edit-task-note-${note.id}`}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (window.confirm('Delete this note?')) {
                                                                        try {
                                                                            await handleDeleteNote(note.id);
                                                                            await onExpand(task.id);
                                                                        } catch (error) {
                                                                            showError('Error deleting note');
                                                                        }
                                                                    }
                                                                }}
                                                                className={`
                                                                    px-1 py-0.5 text-xs rounded
                                                                    ${darkMode
                                                                        ? 'text-red-400 hover:bg-gray-700'
                                                                        : 'text-red-600 hover:bg-red-50'}
                                                                `}
                                                                data-testid={`delete-task-note-${note.id}`}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {notesPagination?.hasMore && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => handleLoadMoreNotes(task.id)}
                                                disabled={notesLoading}
                                                data-testid="load-more-task-notes"
                                                className={`
                                                    w-full px-3 py-1 text-xs rounded-md transition-colors
                                                    ${darkMode
                                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}
                                                    ${notesLoading ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                            >
                                                {notesLoading ? 'Loading...' : 'Load More Notes'}
                                            </button>
                                        </div>
                                    )}
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
                                    {taskLinks.map(link => {
                                        // Support both 'url' (frontend format) and 'link' (backend format)
                                        const linkUrl = link.url || link.link;
                                        const displayText = link.title || linkUrl;
                                        return (
                                            <a
                                                key={link.id}
                                                href={linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`
                                                    text-sm block hover:underline
                                                    ${darkMode ? 'text-blue-400' : 'text-blue-600'}
                                                `}
                                            >
                                                {displayText}
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                            {timerRecords?.length > 0 && (
                                <>
                                    <div className={`
                                        text-sm space-y-1
                                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                    `}>
                                        <div>
                                            <span className="font-medium">Total Time:</span> {formatDuration(timerRecords.reduce((total, record) => total + ((record.duration || 0) * 60), 0))}
                                        </div>
                                        {timerRecords.some(r => r.status === 'active' || r.status === 'paused') && (
                                            <div className={`
                                                font-medium
                                                ${timerRecords.some(r => r.status === 'active') ? 'text-green-500' : 'text-yellow-500'}
                                            `}>
                                                {timerRecords.some(r => r.status === 'active') ? '● Timer Running' : '⏸ Timer Paused'}
                                            </div>
                                        )}
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
                                    onClick={() => onStatusChange(task.recordId, !task.isCompleted)}
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
                                    onSubmit={async (note) => {
                                        try {
                                            await handleCreateNote(task.id, note);
                                            await onExpand(task.id);
                                            setShowNoteInput(false);
                                        } catch (error) {
                                            showError('Error creating note');
                                        }
                                    }}
                                    onCancel={() => setShowNoteInput(false)}
                                />
                            )}
                            {showLinkInput && (
                                <TextInput
                                    title="Add Link"
                                    placeholder="Enter URL..."
                                    submitLabel="Create"
                                    onSubmit={async (url) => {
                                        try {
                                            await handleCreateLink(task.id, url);
                                            await onExpand(task.id);
                                            setShowLinkInput(false);
                                        } catch (error) {
                                            showError('Error creating link');
                                        }
                                    }}
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
        title: PropTypes.string, // New backend field
        task: PropTypes.string, // Legacy FileMaker field
        notes: PropTypes.string,
        isCompleted: PropTypes.bool.isRequired,
        recordId: PropTypes.string
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    onExpand: PropTypes.func.isRequired,
    taskNotes: PropTypes.array,
    taskLinks: PropTypes.array,
    timerRecords: PropTypes.array,
    isLoading: PropTypes.bool,
    handleTimerStart: PropTypes.func.isRequired,
    handleTaskSelect: PropTypes.func.isRequired,
    handleCreateNote: PropTypes.func.isRequired,
    handleUpdateNote: PropTypes.func.isRequired,
    handleDeleteNote: PropTypes.func.isRequired,
    handleCreateLink: PropTypes.func.isRequired,
    handleLoadMoreNotes: PropTypes.func.isRequired,
    notesPagination: PropTypes.object,
    notesLoading: PropTypes.bool
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
    handleTaskSelect,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleCreateLink,
    handleLoadMoreNotes,
    notesPagination,
    notesLoading
}) {
    if (!tasks?.length) {
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
                {tasks?.map(task => (
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
                        handleCreateNote={handleCreateNote}
                        handleUpdateNote={handleUpdateNote}
                        handleDeleteNote={handleDeleteNote}
                        handleCreateLink={handleCreateLink}
                        handleLoadMoreNotes={handleLoadMoreNotes}
                        notesPagination={notesPagination}
                        notesLoading={notesLoading}
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
    handleTaskSelect: PropTypes.func.isRequired,
    handleCreateNote: PropTypes.func.isRequired,
    handleUpdateNote: PropTypes.func.isRequired,
    handleDeleteNote: PropTypes.func.isRequired,
    handleCreateLink: PropTypes.func.isRequired,
    handleLoadMoreNotes: PropTypes.func.isRequired,
    notesPagination: PropTypes.object,
    notesLoading: PropTypes.bool
};
function TaskList({
    projectId = null,
    customerId = null,
    onTaskStatusChange = () => {},
    onTaskUpdate = () => {}
}) {
    const { darkMode } = useTheme();
    const { user, selectedProject } = useAppState();
    const [showCompleted, setShowCompleted] = useState(false);
    const [showNewTaskForm, setShowNewTaskForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [allTaskNotes, setAllTaskNotes] = useState([]);

    // Get customer_id from props, selectedProject, or fallback
    const effectiveCustomerId = customerId || selectedProject?.customer_id || selectedProject?._custID;

    const {
        handleTaskSelect,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        taskNotes,
        taskLinks,
        timerRecords,
        loading: taskLoading,
        selectedTask,
        timer,
        activeTasks,
        completedTasks
    } = useTask(projectId);

    const {
        handleNoteCreate,
        handleNoteUpdate,
        handleNoteDelete,
        handleFetchNotes,
        getPagination,
        loading: noteLoading
    } = useNote();

    const {
        handleLinkCreate,
        loading: linkLoading
    } = useLink();

    const loading = taskLoading || noteLoading|| linkLoading;

    // Get pagination for currently selected task
    const notesPagination = selectedTask ? getPagination('task', selectedTask.id) : null;

    // Update allTaskNotes when taskNotes changes
    React.useEffect(() => {
        if (taskNotes) {
            setAllTaskNotes(taskNotes);
        }
    }, [taskNotes]);

    // Memoized handlers
    const handleLoadMoreNotes = useCallback(async (taskId) => {
        try {
            const moreNotes = await handleFetchNotes('task', taskId, { append: true });
            if (moreNotes && moreNotes.length > 0) {
                setAllTaskNotes(prev => [...prev, ...moreNotes]);
            }
        } catch (error) {
            console.error('Error loading more notes:', error);
        }
    }, [handleFetchNotes]);

    const handleCreateNote = useCallback(async (fkId, noteContent) => {
        try {
            console.log("new note called for task ... ",{fkId, noteContent})
            // Use new signature with explicit 'task' entity type
            const result = await handleNoteCreate('task', fkId, noteContent, 'general');
            if (result) {
                await handleTaskSelect(fkId);
            }
            return result;
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }, [handleNoteCreate, handleTaskSelect]);

    const handleUpdateNote = useCallback(async (noteId, data) => {
        try {
            console.log("update note called for task ... ", { noteId, data })
            const result = await handleNoteUpdate(noteId, data);
            return result;
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }, [handleNoteUpdate]);

    const handleDeleteNote = useCallback(async (noteId) => {
        try {
            console.log("delete note called for task ... ", { noteId })
            const result = await handleNoteDelete(noteId);
            return result;
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }, [handleNoteDelete]);

    const handleCreateLink = useCallback(async (taskId, url) => {
        try {
            console.log("new link called for task ... ", { taskId, url })
            // Create link with task_id parent type (third parameter)
            const result = await handleLinkCreate(taskId, url, 'task');
            if (result) {
                await handleTaskSelect(taskId);
            }
            return result;
        } catch (error) {
            console.error('Error creating link for task:', error);
            throw error;
        }
    }, [handleLinkCreate, handleTaskSelect]);

    const handleEdit = useCallback(async (taskData) => {
        try {
            await handleTaskUpdate(taskData.id, taskData);
            onTaskUpdate(taskData.id, taskData);
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }, [handleTaskUpdate, onTaskUpdate]);

    const handleStatusChange = useCallback(async (taskId, completed) => {
        try {
            await handleTaskStatusChange(taskId, completed);
            onTaskStatusChange(taskId, completed);
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }, [handleTaskStatusChange, onTaskStatusChange]);

    const handleNewTask = useCallback(async (taskData) => {
        if (!projectId || !effectiveCustomerId) {
            console.error('Missing required fields for task creation:', {
                projectId,
                customerId: effectiveCustomerId
            });
            return;
        }

        try {
            await handleTaskCreate(taskData);
            setShowNewTaskForm(false);
        } catch (error) {
            console.error('Error creating task:', error);
            // Error is handled in TaskForm component
            throw error;
        }
    }, [projectId, effectiveCustomerId, handleTaskCreate]);

    const handleEditTask = useCallback(async (taskData) => {
        try {
            await handleTaskUpdate(taskData.id, taskData);
            setEditingTask(null);
            onTaskUpdate(taskData.id, taskData);
        } catch (error) {
            console.error('Error updating task:', error);
            // Error is handled in TaskForm component
            throw error;
        }
    }, [handleTaskUpdate, onTaskUpdate]);

    return (
        <div className="space-y-6">
            {/* Header with New Task Button */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Tasks</h3>
                <button
                    onClick={() => setShowNewTaskForm(true)}
                    className="px-4 py-2 mr-5 bg-primary text-white rounded-md hover:bg-primary-hover"
                    disabled={!projectId || !effectiveCustomerId}
                >
                    New Task
                </button>
            </div>

            {/* New Task Form */}
            {showNewTaskForm && projectId && effectiveCustomerId && (
                <TaskForm
                    projectId={projectId}
                    customerId={effectiveCustomerId}
                    staffId={user?.userID}
                    onSubmit={handleNewTask}
                    onCancel={() => setShowNewTaskForm(false)}
                />
            )}

            {/* Edit Task Form */}
            {editingTask && projectId && effectiveCustomerId && (
                <TaskForm
                    projectId={projectId}
                    customerId={effectiveCustomerId}
                    staffId={user?.userID}
                    task={editingTask}
                    onSubmit={handleEditTask}
                    onCancel={() => setEditingTask(null)}
                />
            )}

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
                tasks={activeTasks || []}
                darkMode={darkMode}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onExpand={handleTaskSelect}
                taskNotes={allTaskNotes}
                taskLinks={taskLinks}
                timerRecords={timerRecords}
                isLoading={loading}
                emptyMessage="No active tasks"
                handleTimerStart={handleTimerStart}
                handleTaskSelect={handleTaskSelect}
                handleCreateNote={handleCreateNote}
                handleUpdateNote={handleUpdateNote}
                handleDeleteNote={handleDeleteNote}
                handleCreateLink={handleCreateLink}
                handleLoadMoreNotes={handleLoadMoreNotes}
                notesPagination={notesPagination}
                notesLoading={noteLoading}
            />

            {/* Completed Tasks Toggle */}
            {completedTasks?.length > 0 && (
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
                            tasks={completedTasks || []}
                            darkMode={darkMode}
                            onEdit={handleEdit}
                            onStatusChange={handleStatusChange}
                            onExpand={handleTaskSelect}
                            taskNotes={allTaskNotes}
                            taskLinks={taskLinks}
                            timerRecords={timerRecords}
                            isLoading={loading}
                            emptyMessage="No completed tasks"
                            handleTimerStart={handleTimerStart}
                            handleTaskSelect={handleTaskSelect}
                            handleCreateNote={handleCreateNote}
                            handleUpdateNote={handleUpdateNote}
                            handleDeleteNote={handleDeleteNote}
                            handleCreateLink={handleCreateLink}
                            handleLoadMoreNotes={handleLoadMoreNotes}
                            notesPagination={notesPagination}
                            notesLoading={noteLoading}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

TaskList.propTypes = {
    projectId: PropTypes.string,
    customerId: PropTypes.string,
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