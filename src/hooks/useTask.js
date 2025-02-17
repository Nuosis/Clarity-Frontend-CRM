import { useState, useCallback, useEffect } from 'react';
import {
    fetchTasksForProject,
    createTask,
    updateTask,
    updateTaskStatus,
    startTaskTimer,
    stopTaskTimer,
    fetchTaskTimers,
    updateTaskNotes,
    fetchActiveProjectTasks,
    fetchTaskNotes,
    fetchTaskLinks
} from '../api';
import {
    processTaskData,
    processTimerRecords,
    calculateTotalTaskTime,
    validateTaskData,
    formatTaskForFileMaker,
    calculateTaskStats,
    isValidTimerAdjustment,
    sortTasks,
    processTaskNotes,
    processTaskLinks
} from '../services';

/**
 * Hook for managing task state and operations
 */
export function useTask(projectId = null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [timer, setTimer] = useState({
        recordId: null,
        TimeStart: null,
        isPaused: false,
        pauseStartTime: null,
        totalPauseTime: 0,
        adjustment: 0
    });
    const [timerRecords, setTimerRecords] = useState([]);
    const [taskNotes, setTaskNotes] = useState([]);
    const [taskLinks, setTaskLinks] = useState([]);
    const [stats, setStats] = useState(null);

    // Load tasks when projectId changes
    useEffect(() => {
        if (projectId) {
            loadTasks(projectId);
        }
    }, [projectId]);

    // Update stats when tasks or timer records change
    useEffect(() => {
        if (tasks.length > 0) {
            setStats(calculateTaskStats(tasks, timerRecords));
        }
    }, [tasks, timerRecords]);

    /**
     * Loads tasks for a project
     */
    const loadTasks = useCallback(async (projId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchTasksForProject(projId);
            const processedTasks = processTaskData(result);
            const sortedTasks = sortTasks(processedTasks);
            
            setTasks(sortedTasks);
        } catch (err) {
            setError(err.message);
            console.error('Error loading tasks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Loads task details including notes and links
     */
    const loadTaskDetails = useCallback(async (taskId) => {
        try {
            setLoading(true);
            setError(null);

            const [timerResult, notesResult, linksResult] = await Promise.all([
                fetchTaskTimers(taskId),
                fetchTaskNotes(taskId),
                fetchTaskLinks(taskId)
            ]);

            const processedTimers = processTimerRecords(timerResult);
            const processedNotes = processTaskNotes(notesResult);
            const processedLinks = processTaskLinks(linksResult);

            setTimerRecords(processedTimers);
            setTaskNotes(processedNotes);
            setTaskLinks(processedLinks);

            return {
                timers: processedTimers,
                notes: processedNotes,
                links: processedLinks
            };
        } catch (err) {
            setError(err.message);
            console.error('Error loading task details:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Selects a task and loads its details
     */
    const handleTaskSelect = useCallback(async (taskId) => {
        try {
            setLoading(true);
            setError(null);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                throw new Error('Task not found');
            }
            
            const details = await loadTaskDetails(taskId);
            setSelectedTask(task);

            return {
                task,
                ...details
            };
        } catch (err) {
            setError(err.message);
            console.error('Error selecting task:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [tasks, loadTaskDetails]);

    /**
     * Creates a new task
     */
    const handleTaskCreate = useCallback(async (taskData) => {
        try {
            setLoading(true);
            setError(null);
            
            const validation = validateTaskData(taskData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatTaskForFileMaker(taskData);
            const result = await createTask(formattedData);
            
            // Add new task to local state
            const newTask = processTaskData({
                response: { data: [{ fieldData: { ...formattedData, __ID: result.recordId } }] }
            })[0];
            
            setTasks(prevTasks => sortTasks([...prevTasks, newTask]));
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error creating task:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Updates an existing task
     */
    const handleTaskUpdate = useCallback(async (taskId, taskData) => {
        try {
            setLoading(true);
            setError(null);
            
            const validation = validateTaskData(taskData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatTaskForFileMaker(taskData);
            const result = await updateTask(taskId, formattedData);
            
            // Update local state
            setTasks(prevTasks => 
                sortTasks(
                    prevTasks.map(task => 
                        task.id === taskId
                            ? { ...task, ...taskData }
                            : task
                    )
                )
            );
            
            // Update selected task if it's the one being updated
            if (selectedTask?.id === taskId) {
                setSelectedTask(prev => ({ ...prev, ...taskData }));
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error updating task:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTask]);

    /**
     * Updates task completion status
     */
    const handleTaskStatusChange = useCallback(async (taskId, completed) => {
        try {
            setLoading(true);
            setError(null);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                throw new Error('Task not found');
            }
            const result = await updateTaskStatus(task.recordId, completed);
            
            // Update local state
            setTasks(prevTasks => 
                sortTasks(
                    prevTasks.map(task => 
                        task.id === taskId
                            ? { ...task, isCompleted: completed }
                            : task
                    )
                )
            );
            
            // Update selected task if it's the one being updated
            if (selectedTask?.id === taskId) {
                setSelectedTask(prev => ({ ...prev, isCompleted: completed }));
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error updating task status:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTask]);

    /**
     * Timer operations
     */
    const handleTimerStart = useCallback(async (task = null) => {
        try {
            const taskToUse = task || selectedTask;
            if (!taskToUse) {
                throw new Error('No task selected');
            }
            
            const result = await startTaskTimer(taskToUse.id, taskToUse);
            setTimer({
                recordId: result.response.recordId,
                TimeStart: new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                isPaused: false,
                pauseStartTime: null,
                totalPauseTime: 0,
                adjustment: 0
            });
        } catch (err) {
            setError(err.message);
            console.error('Error starting timer:', err);
            throw err;
        }
    }, [selectedTask]);

    const handleTimerStop = useCallback(async (saveImmediately = false, description = '') => {
        try {
            if (!timer?.recordId) {
                throw new Error('No active timer');
            }

            // If currently paused, add the final pause duration
            let finalPauseTime = Math.round(timer.totalPauseTime);
            if (timer.isPaused && timer.pauseStartTime) {
                finalPauseTime += Math.round((new Date() - timer.pauseStartTime) / 1000);
            }

            // Calculate final adjustment including pauses and manual adjustments
            const finalAdjustment = Math.round(finalPauseTime + (timer.adjustment || 0));
            
            await stopTaskTimer(timer.recordId, description, saveImmediately, finalAdjustment);
            
            // Reload timer records
            if (selectedTask) {
                const timerResult = await fetchTaskTimers(selectedTask.id);
                setTimerRecords(processTimerRecords(timerResult));
            }
            
            setTimer({
                recordId: null,
                startTime: null,
                isPaused: false,
                pauseStartTime: null,
                totalPauseTime: 0,
                adjustment: 0
            });
        } catch (err) {
            setError(err.message);
            console.error('Error stopping timer:', err);
            throw err;
        }
    }, [timer, selectedTask]);

    const handleTimerPause = useCallback(() => {
        if (!timer?.recordId) {
            throw new Error('No active timer');
        }
        
        setTimer(prev => {
            if (prev.isPaused) {
                // Resuming - calculate and add pause duration to total
                const pauseDuration = (new Date() - prev.pauseStartTime) / 1000;
                return {
                    ...prev,
                    isPaused: false,
                    pauseStartTime: null,
                    totalPauseTime: prev.totalPauseTime + pauseDuration
                };
            } else {
                // Pausing - store pause start time
                return {
                    ...prev,
                    isPaused: true,
                    pauseStartTime: new Date()
                };
            }
        });
    }, [timer]);

    const handleTimerAdjust = useCallback((minutes) => {
        if (!timer?.recordId) {
            throw new Error('No active timer');
        }
        
        if (!isValidTimerAdjustment(minutes)) {
            throw new Error('Invalid timer adjustment');
        }
        
        setTimer(prev => ({
            ...prev,
            adjustment: prev.adjustment + (minutes * 60) // Convert minutes to seconds
        }));
    }, [timer]);

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
        
        // Getters
        activeTasks: tasks.filter(task => !task.isCompleted),
        completedTasks: tasks.filter(task => task.isCompleted),
        
        // Task actions
        loadTasks,
        handleTaskSelect,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        
        // Timer actions
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
            }
        }
    };
}