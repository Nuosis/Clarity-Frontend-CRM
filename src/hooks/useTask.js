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
    fetchActiveProjectTasks
} from '../api';
import {
    processTaskData,
    processTimerRecords,
    calculateTotalTaskTime,
    validateTaskData,
    formatTaskForFileMaker,
    calculateTaskStats,
    isValidTimerAdjustment,
    sortTasks
} from '../services';

/**
 * Hook for managing task state and operations
 */
export function useTask(projectId = null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [timer, setTimer] = useState(null);
    const [timerRecords, setTimerRecords] = useState([]);
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
     * Selects a task and loads its timer records
     */
    const handleTaskSelect = useCallback(async (taskId) => {
        try {
            setLoading(true);
            setError(null);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                throw new Error('Task not found');
            }
            
            const timerResult = await fetchTaskTimers(taskId);
            const processedTimers = processTimerRecords(timerResult);
            
            setSelectedTask(task);
            setTimerRecords(processedTimers);
        } catch (err) {
            setError(err.message);
            console.error('Error selecting task:', err);
        } finally {
            setLoading(false);
        }
    }, [tasks]);

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
            
            const result = await updateTaskStatus(taskId, completed);
            
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
    const handleTimerStart = useCallback(async () => {
        try {
            if (!selectedTask) {
                throw new Error('No task selected');
            }
            
            const result = await startTaskTimer(selectedTask.id);
            setTimer({
                recordId: result.recordId,
                startTime: new Date(),
                isPaused: false
            });
        } catch (err) {
            setError(err.message);
            console.error('Error starting timer:', err);
            throw err;
        }
    }, [selectedTask]);

    const handleTimerStop = useCallback(async (saveImmediately = false, description = '') => {
        try {
            if (!timer) {
                throw new Error('No active timer');
            }
            
            await stopTaskTimer(timer.recordId, description, saveImmediately);
            
            // Reload timer records
            if (selectedTask) {
                const timerResult = await fetchTaskTimers(selectedTask.id);
                setTimerRecords(processTimerRecords(timerResult));
            }
            
            setTimer(null);
        } catch (err) {
            setError(err.message);
            console.error('Error stopping timer:', err);
            throw err;
        }
    }, [timer, selectedTask]);

    const handleTimerPause = useCallback(() => {
        if (!timer) {
            throw new Error('No active timer');
        }
        
        setTimer(prev => ({
            ...prev,
            isPaused: !prev.isPaused
        }));
    }, [timer]);

    const handleTimerAdjust = useCallback((minutes) => {
        if (!isValidTimerAdjustment(minutes)) {
            throw new Error('Invalid timer adjustment');
        }
        
        setTimer(prev => ({
            ...prev,
            adjustment: (prev.adjustment || 0) + minutes
        }));
    }, []);

    return {
        // State
        loading,
        error,
        tasks,
        selectedTask,
        timer,
        timerRecords,
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
            if (timer) {
                handleTimerStop(true);
            }
        }
    };
}