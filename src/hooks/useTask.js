import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import {
    loadProjectTasks,
    loadTaskDetails,
    createNewTask,
    updateExistingTask,
    updateTaskCompletionStatus,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    getActiveTimer,
    groupTasksByStatus,
    calculateTaskStats
} from '../services/taskService';

/**
 * Hook for managing task state and operations
 */
export function useTask(projectId = null) {
    // State management
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [timerRecords, setTimerRecords] = useState([]);
    const [taskNotes, setTaskNotes] = useState([]);
    const [taskLinks, setTaskLinks] = useState([]);
    const [stats, setStats] = useState(null);
    const [timer, setTimer] = useState(() => {
        const savedTimer = localStorage.getItem('activeTimer');
        if (savedTimer) {
            const parsed = JSON.parse(savedTimer);
            return {
                ...parsed,
                pauseStartTime: parsed.pauseStartTime ? new Date(parsed.pauseStartTime) : null
            };
        }
        return {
            recordId: null,
            TimeStart: null,
            isPaused: false,
            pauseStartTime: null,
            totalPauseTime: 0,
            adjustment: 0
        };
    });

    const { showError } = useSnackBar();

    // Restore active timer on mount
    useEffect(() => {
        const restoreActiveTimer = async () => {
            try {
                console.log('[useTask] Checking for active timer on mount');
                const activeTimer = await getActiveTimer();

                if (activeTimer) {
                    console.log('[useTask] Found active timer:', activeTimer);

                    // Restore timer state
                    const restoredTimer = {
                        id: activeTimer.id,
                        recordId: activeTimer.filemaker_record_id || activeTimer.id,
                        start_time: activeTimer.start_time,
                        startTime: activeTimer.start_time,
                        TimeStart: new Date(activeTimer.start_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        }),
                        status: activeTimer.status || 'active',
                        isPaused: activeTimer.status === 'paused',
                        pauseStartTime: activeTimer.status === 'paused' ? new Date() : null,
                        totalPauseTime: activeTimer.pause_duration_seconds || 0,
                        pause_duration_seconds: activeTimer.pause_duration_seconds || 0,
                        adjustment: activeTimer.adjustment_seconds || 0,
                        adjustment_seconds: activeTimer.adjustment_seconds || 0,
                        task_id: activeTimer.task_id
                    };

                    setTimer(restoredTimer);
                    localStorage.setItem('activeTimer', JSON.stringify(restoredTimer));

                    console.log('[useTask] Active timer restored:', restoredTimer);
                }
            } catch (err) {
                console.error('[useTask] Error restoring active timer:', err);
                // Don't show error to user - just log it
            }
        };

        restoreActiveTimer();
    }, []); // Run once on mount

    // Load tasks when projectId changes
    useEffect(() => {
        if (projectId) {
            loadTasks(projectId);
        }
    }, [projectId]);

    // Update stats when tasks or timer records change
    useEffect(() => {
        setStats(calculateTaskStats(tasks, timerRecords));
    }, [tasks, timerRecords]);

    // Task operations
    const loadTasks = useCallback(async (projId) => {
        try {
            setLoading(true);
            setError(null);
            if (!projId) {
                console.error('No project ID provided to loadTasks');
                return;
            }
            const result = await loadProjectTasks(projId);
            setTasks(result || []);
        } catch (err) {
            showError('Failed to load tasks. Please try refreshing the page.');
            console.error('Error loading tasks:', err);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const handleTaskSelect = useCallback(async (taskId) => {
        try {
            setLoading(true);
            setError(null);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                showError('Task not found');
                return null;
            }
            
            const details = await loadTaskDetails(taskId);
            setTimerRecords(details.timers);
            setTaskNotes(details.notes);
            setTaskLinks(details.links);
            setSelectedTask(task);

            return { task, ...details };
        } catch (err) {
            showError('Failed to load task details. Please try refreshing the page.');
            console.error('Error selecting task:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [tasks, showError]);

    const handleTaskCreate = useCallback(async (taskData) => {
        if (!projectId) {
            console.error('No project ID available for task creation');
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            
            // Wait for task creation to complete
            const result = await createNewTask(taskData);
            console.log('Task creation result:', result);
            // Validate the result
            if (result?.response?.data?.[0]?.recordId) {
                // Don't reload tasks, just update state directly
                setTasks(prevTasks => [...prevTasks, {
                    id: result.response.data[0].fieldData.__ID, // Use the UUID as the id
                    recordId: result.response.data[0].recordId,
                    task: taskData.taskName,
                    isCompleted: false,
                    _projectID: taskData._projectID,
                    _staffID: taskData._staffID,
                    createdAt: new Date().toISOString(),
                    modifiedAt: new Date().toISOString()
                }]);
                return result;
            }
            
            throw new Error('Failed to create task: Invalid response');
        } catch (err) {
            showError(err.message);
            console.error('Error creating task:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [projectId, loadTasks, showError]);

    const handleTaskUpdate = useCallback(async (taskId, taskData) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await updateExistingTask(taskId, taskData);
            if (result) {
                setTasks(prevTasks =>
                    prevTasks.map(task =>
                        task.id === taskId
                            ? { ...task, ...taskData }
                            : task
                    )
                );
                
                if (selectedTask?.id === taskId) {
                    setSelectedTask(prev => ({ ...prev, ...taskData }));
                }
            }
            return result;
        } catch (err) {
            showError(err.message);
            console.error('Error updating task:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [selectedTask, showError]);

    const handleTaskStatusChange = useCallback(async (recordId, completed) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await updateTaskCompletionStatus(recordId, completed);
            if (result) {
                setTasks(prevTasks =>
                    prevTasks.map(task =>
                        task.recordId === recordId
                            ? { ...task, isCompleted: completed }
                            : task
                    )
                );
                
                if (selectedTask?.recordId === recordId) {
                    setSelectedTask(prev => ({ ...prev, isCompleted: completed }));
                }
            }
            return result;
        } catch (err) {
            showError(err.message);
            console.error('Error updating task status:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [selectedTask, showError]);

    const handleTimerStart = useCallback(async (task = null) => {
        try {
            const taskToUse = task || selectedTask;
            const result = await startTimer(taskToUse);
            console.log('[useTask] handleTimerStart result:', result);

            // Handle both backend API response and FileMaker response
            if (result?.id || (result?.messages && result.messages[0]?.code === '0')) {
                // Backend API response has id directly, FileMaker has messages array
                const timerId = result.id || result.response?.recordId;
                const startTime = result.start_time || new Date().toISOString();

                const newTimer = {
                    id: result.id,
                    recordId: result.response?.recordId || null,
                    start_time: startTime,
                    startTime: startTime,
                    TimeStart: new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }),
                    status: result.status || 'active',
                    isPaused: false,
                    pauseStartTime: null,
                    totalPauseTime: 0,
                    pause_duration_seconds: 0,
                    adjustment: 0,
                    adjustment_seconds: 0
                };
                setTimer(newTimer);
                localStorage.setItem('activeTimer', JSON.stringify(newTimer));
            } else {
                const errorMsg = result?.messages?.[0]?.message || 'Failed to start timer';
                throw new Error(errorMsg);
            }
        } catch (err) {
            // Provide better error messages for concurrency conflicts
            if (err.message.includes('already has an active timer') ||
                err.message.includes('concurrent timer') ||
                err.message.includes('409')) {

                // Try to fetch and restore the existing active timer
                try {
                    console.log('[useTask] Fetching existing active timer after conflict');
                    const existingTimer = await getActiveTimer();

                    if (existingTimer) {
                        console.log('[useTask] Found existing active timer:', existingTimer);

                        // Restore the existing timer state
                        const restoredTimer = {
                            id: existingTimer.id,
                            recordId: existingTimer.filemaker_record_id || existingTimer.id,
                            start_time: existingTimer.start_time,
                            startTime: existingTimer.start_time,
                            TimeStart: new Date(existingTimer.start_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            }),
                            status: existingTimer.status || 'active',
                            isPaused: existingTimer.status === 'paused',
                            pauseStartTime: existingTimer.status === 'paused' ? new Date() : null,
                            totalPauseTime: existingTimer.pause_duration_seconds || 0,
                            pause_duration_seconds: existingTimer.pause_duration_seconds || 0,
                            adjustment: existingTimer.adjustment_seconds || 0,
                            adjustment_seconds: existingTimer.adjustment_seconds || 0,
                            task_id: existingTimer.task_id
                        };

                        setTimer(restoredTimer);
                        localStorage.setItem('activeTimer', JSON.stringify(restoredTimer));

                        showError('You already have an active timer running. The existing timer has been restored.');
                    } else {
                        showError('You already have an active timer running. Please stop or pause it before starting a new one.');
                    }
                } catch (fetchErr) {
                    console.error('[useTask] Error fetching existing timer:', fetchErr);
                    showError('You already have an active timer running. Please stop or pause it before starting a new one.');
                }
            } else {
                showError(err.message);
            }
            console.error('[useTask] Error starting timer:', err);
        }
    }, [selectedTask, showError]);

    const handleTimerStop = useCallback(async (saveImmediately = false, description = '') => {
        try {
            if (!timer?.recordId) {
                showError('No active timer');
                return;
            }

            const totalPauseTime = Math.round(timer.totalPauseTime + 
                (timer.isPaused && timer.pauseStartTime 
                    ? (new Date() - timer.pauseStartTime) / 1000 
                    : 0)
            );

            await stopTimer({
                recordId: timer.recordId,
                description,
                saveImmediately,
                totalPauseTime,
                adjustment: timer.adjustment || 0
            });

            if (selectedTask) {
                const details = await loadTaskDetails(selectedTask.id);
                setTimerRecords(details.timers);
            }

            const newTimer = {
                recordId: null,
                startTime: null,
                isPaused: false,
                pauseStartTime: null,
                totalPauseTime: 0,
                adjustment: 0
            };
            setTimer(newTimer);
            localStorage.removeItem('activeTimer');
        } catch (err) {
            showError(err.message);
            console.error('Error stopping timer:', err);
        }
    }, [timer, selectedTask, showError]);

    const handleTimerPause = useCallback(async () => {
        if (!timer?.recordId && !timer?.id) {
            showError('No active timer');
            return;
        }

        try {
            const timerId = timer.id || timer.recordId;

            // Determine if we need to pause or resume based on current state
            const shouldPause = timer.status === 'active' || !timer.isPaused;

            if (shouldPause) {
                // Pause the timer via backend API
                const result = await pauseTimer(timerId);
                console.log('[useTask] Timer paused:', result);

                setTimer(prev => {
                    const newTimer = {
                        ...prev,
                        isPaused: true,
                        status: 'paused',
                        pauseStartTime: new Date()
                    };
                    localStorage.setItem('activeTimer', JSON.stringify(newTimer));
                    return newTimer;
                });
            } else {
                // Resume the timer via backend API
                const result = await resumeTimer(timerId);
                console.log('[useTask] Timer resumed:', result);

                setTimer(prev => {
                    const pauseDuration = prev.pauseStartTime
                        ? (new Date() - prev.pauseStartTime) / 1000
                        : 0;
                    const newTimer = {
                        ...prev,
                        isPaused: false,
                        status: 'active',
                        pauseStartTime: null,
                        totalPauseTime: (prev.totalPauseTime || 0) + pauseDuration
                    };
                    localStorage.setItem('activeTimer', JSON.stringify(newTimer));
                    return newTimer;
                });
            }
        } catch (err) {
            // Handle errors gracefully - fallback to local state for FileMaker mode
            console.warn('[useTask] Pause/resume not supported, using local state:', err.message);

            setTimer(prev => {
                const newTimer = prev.isPaused
                    ? {
                        ...prev,
                        isPaused: false,
                        pauseStartTime: null,
                        totalPauseTime: prev.totalPauseTime + ((new Date() - prev.pauseStartTime) / 1000)
                    }
                    : {
                        ...prev,
                        isPaused: true,
                        pauseStartTime: new Date()
                    };
                localStorage.setItem('activeTimer', JSON.stringify(newTimer));
                return newTimer;
            });
        }
    }, [timer, showError]);

    const handleTimerAdjust = useCallback((minutes) => {
        if (!timer?.recordId) {
            showError('No active timer');
            return;
        }

        setTimer(prev => {
            const newTimer = {
                ...prev,
                adjustment: prev.adjustment + (minutes * 60)
            };
            localStorage.setItem('activeTimer', JSON.stringify(newTimer));
            return newTimer;
        });
    }, [timer, showError]);

    // Get grouped tasks
    const { activeTasks, completedTasks } = useMemo(() => {
        //console.log('Tasks in useTask:', tasks);
        const grouped = groupTasksByStatus(tasks || []);
        //console.log('Grouped tasks:', grouped);
        return {
            activeTasks: grouped.active || [],
            completedTasks: grouped.completed || []
        };
    }, [tasks]);

    return {
        // State
        loading,
        error,
        tasks,
        selectedTask,
        timer,
        timerRecords,
        taskNotes,
        taskLinks,
        stats,
        activeTasks,
        completedTasks,
        
        // Task operations
        loadTasks,
        handleTaskSelect,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        
        // Timer operations
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        
        // Utilities
        clearError: () => setError(null),
        clearSelectedTask: () => {
            setSelectedTask(null);
            setTimerRecords([]);
            setTaskNotes([]);
            setTaskLinks([]);
            if (timer?.recordId) {
                handleTimerStop(true);
                localStorage.removeItem('activeTimer');
            }
        }
    };
}