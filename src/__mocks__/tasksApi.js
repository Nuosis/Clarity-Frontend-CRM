/**
 * Mock Tasks API Implementation
 *
 * Simulates backend API behavior including:
 * - Validation
 * - Business logic
 * - Error responses
 * - State management
 */

import {
    mockTask,
    mockTasksList,
    mockActiveTimer,
    mockPausedTimer,
    mockCompletedTimer,
    mockStopTimerResponse,
    mockStopTimerResponseFixedPrice,
    mockTimerConcurrencyError,
    mockTimerValidationErrors,
    mockFinancialRecord
} from '../__fixtures__';

// In-memory state for mocking
let tasks = [...mockTasksList];
let timers = [mockCompletedTimer];
let activeTimersByStaff = new Map(); // staffId -> timerId
let financialRecords = [];

/**
 * Reset mock state (useful for test cleanup)
 */
export function resetMockState() {
    tasks = [...mockTasksList];
    timers = [mockCompletedTimer];
    activeTimersByStaff = new Map();
    financialRecords = [];
}

/**
 * Simulate network delay
 */
function delay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate UUID for testing
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Mock: Fetch tasks for project
 */
export async function mockFetchTasksForProject(projectId) {
    await delay();

    if (!projectId) {
        throw new Error('Validation error: project_id is required');
    }

    return tasks.filter(task => task.project_id === projectId);
}

/**
 * Mock: Create task
 */
export async function mockCreateTask(data) {
    await delay();

    // Validation
    if (!data.title) {
        throw new Error('Validation error: title is required');
    }
    if (!data.project_id) {
        throw new Error('Validation error: project_id is required');
    }
    if (data.priority && (data.priority < 1 || data.priority > 5)) {
        throw new Error('Validation error: priority must be between 1 and 5');
    }

    const newTask = {
        id: generateUUID(),
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        ...data,
        is_completed: false,
        status: data.status || 'active',
        priority: data.priority || 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    tasks.push(newTask);
    return newTask;
}

/**
 * Mock: Update task
 */
export async function mockUpdateTask(taskId, data) {
    await delay();

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    // Validation
    if (data.priority && (data.priority < 1 || data.priority > 5)) {
        throw new Error('Validation error: priority must be between 1 and 5');
    }

    const updatedTask = {
        ...tasks[taskIndex],
        ...data,
        updated_at: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;
    return updatedTask;
}

/**
 * Mock: Update task status (toggle completion)
 */
export async function mockUpdateTaskStatus(taskId, isCompleted) {
    await delay();

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    const updatedTask = {
        ...tasks[taskIndex],
        is_completed: isCompleted,
        status: isCompleted ? 'completed' : 'active',
        updated_at: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;
    return updatedTask;
}

/**
 * Mock: Delete task
 */
export async function mockDeleteTask(taskId) {
    await delay();

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    tasks.splice(taskIndex, 1);
    return { success: true };
}

/**
 * Mock: Start timer with idempotency check
 */
export async function mockStartTimer(data) {
    await delay();

    // Validation
    if (!data.task_id) {
        throw new Error('Validation error: task_id is required');
    }
    if (!data.staff_id) {
        throw new Error('Validation error: staff_id is required');
    }

    // Concurrency check - one active timer per staff
    if (activeTimersByStaff.has(data.staff_id)) {
        const existingTimerId = activeTimersByStaff.get(data.staff_id);
        const existingTimer = timers.find(t => t.id === existingTimerId);

        const error = new Error('Staff member already has an active timer');
        error.status = 409;
        error.response = {
            data: {
                ...mockTimerConcurrencyError,
                existing_timer: existingTimer
            }
        };
        throw error;
    }

    // Find task to get project and customer IDs
    const task = tasks.find(t => t.id === data.task_id);
    if (!task) {
        throw new Error('Task not found');
    }

    const newTimer = {
        id: generateUUID(),
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        task_id: data.task_id,
        staff_id: data.staff_id,
        project_id: task.project_id,
        customer_id: task.customer_id,
        start_time: new Date().toISOString(),
        end_time: null,
        pause_time: null,
        resume_time: null,
        pause_duration_seconds: 0,
        adjustment_seconds: 0,
        billable_hours: null,
        hourly_rate: 100.00,
        description: null,
        status: 'active',
        is_billable: data.is_billable !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    timers.push(newTimer);
    activeTimersByStaff.set(data.staff_id, newTimer.id);

    return newTimer;
}

/**
 * Mock: Stop timer with financial record creation
 */
export async function mockStopTimer(entryId, data, projectIsFixedPrice = false) {
    await delay();

    const timerIndex = timers.findIndex(t => t.id === entryId);
    if (timerIndex === -1) {
        throw new Error('Timer not found');
    }

    const timer = timers[timerIndex];

    // Validate timer is active or paused
    if (timer.status === 'completed') {
        throw new Error('Timer is already stopped');
    }

    // Calculate billable hours
    const endTime = data.end_time || new Date().toISOString();
    const startTime = new Date(timer.start_time);
    const end = new Date(endTime);
    const durationMs = end - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    const pauseHours = (timer.pause_duration_seconds || 0) / 3600;
    const adjustmentHours = (data.adjustment_seconds || 0) / 3600;
    const billableHours = Math.max(0, durationHours - pauseHours + adjustmentHours);

    // Update timer
    const updatedTimer = {
        ...timer,
        end_time: endTime,
        description: data.description || timer.description,
        adjustment_seconds: data.adjustment_seconds || 0,
        billable_hours: parseFloat(billableHours.toFixed(2)),
        status: 'completed',
        updated_at: new Date().toISOString()
    };

    timers[timerIndex] = updatedTimer;
    activeTimersByStaff.delete(timer.staff_id);

    // Create financial record if billable and not fixed-price
    let financialRecord = null;
    if (timer.is_billable && !projectIsFixedPrice) {
        financialRecord = {
            id: generateUUID(),
            organization_id: timer.organization_id,
            financial_id: `fin-${generateUUID().slice(0, 8)}`,
            customer_id: timer.customer_id,
            product_id: null,
            product_name: 'CUSTOMER:Project',
            quantity: billableHours,
            unit_price: timer.hourly_rate,
            total_price: parseFloat((billableHours * timer.hourly_rate).toFixed(2)),
            date: endTime.split('T')[0],
            inv_id: null,
            configuration_data: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        financialRecords.push(financialRecord);
    }

    return {
        time_entry: updatedTimer,
        financial_record: financialRecord
    };
}

/**
 * Mock: Pause timer
 */
export async function mockPauseTimer(entryId) {
    await delay();

    const timerIndex = timers.findIndex(t => t.id === entryId);
    if (timerIndex === -1) {
        throw new Error('Timer not found');
    }

    const timer = timers[timerIndex];

    if (timer.status !== 'active') {
        throw new Error(`Cannot pause timer with status: ${timer.status}`);
    }

    const updatedTimer = {
        ...timer,
        pause_time: new Date().toISOString(),
        status: 'paused',
        updated_at: new Date().toISOString()
    };

    timers[timerIndex] = updatedTimer;
    return updatedTimer;
}

/**
 * Mock: Resume timer
 */
export async function mockResumeTimer(entryId) {
    await delay();

    const timerIndex = timers.findIndex(t => t.id === entryId);
    if (timerIndex === -1) {
        throw new Error('Timer not found');
    }

    const timer = timers[timerIndex];

    if (timer.status !== 'paused') {
        throw new Error(`Cannot resume timer with status: ${timer.status}`);
    }

    // Calculate pause duration
    const pauseTime = new Date(timer.pause_time);
    const resumeTime = new Date();
    const pauseDurationMs = resumeTime - pauseTime;
    const pauseDurationSeconds = Math.floor(pauseDurationMs / 1000);

    const updatedTimer = {
        ...timer,
        resume_time: resumeTime.toISOString(),
        pause_duration_seconds: (timer.pause_duration_seconds || 0) + pauseDurationSeconds,
        status: 'active',
        updated_at: resumeTime.toISOString()
    };

    timers[timerIndex] = updatedTimer;
    return updatedTimer;
}

/**
 * Mock: Get active timer for staff
 */
export async function mockGetActiveTimer(staffId) {
    await delay();

    if (!staffId) {
        // Return null if no staff ID (simulates 404)
        return null;
    }

    const activeTimerId = activeTimersByStaff.get(staffId);
    if (!activeTimerId) {
        return null;
    }

    const activeTimer = timers.find(t => t.id === activeTimerId);
    return activeTimer || null;
}

/**
 * Mock: Fetch task timers
 */
export async function mockFetchTaskTimers(filters = {}) {
    await delay();

    let filteredTimers = [...timers];

    if (filters.task_id) {
        filteredTimers = filteredTimers.filter(t => t.task_id === filters.task_id);
    }

    if (filters.staff_id) {
        filteredTimers = filteredTimers.filter(t => t.staff_id === filters.staff_id);
    }

    if (filters.project_id) {
        filteredTimers = filteredTimers.filter(t => t.project_id === filters.project_id);
    }

    if (filters.status) {
        filteredTimers = filteredTimers.filter(t => t.status === filters.status);
    }

    if (filters.start_date) {
        filteredTimers = filteredTimers.filter(t =>
            t.start_time >= filters.start_date
        );
    }

    if (filters.end_date) {
        filteredTimers = filteredTimers.filter(t =>
            t.start_time <= filters.end_date
        );
    }

    // Sort by start_time descending (newest first)
    filteredTimers.sort((a, b) =>
        new Date(b.start_time) - new Date(a.start_time)
    );

    return filteredTimers;
}

/**
 * Export all mocks as named exports
 */
export const mockTasksApi = {
    fetchTasksForProject: mockFetchTasksForProject,
    createTask: mockCreateTask,
    updateTask: mockUpdateTask,
    updateTaskStatus: mockUpdateTaskStatus,
    deleteTask: mockDeleteTask,
    startTimer: mockStartTimer,
    stopTimer: mockStopTimer,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    getActiveTimer: mockGetActiveTimer,
    fetchTaskTimers: mockFetchTaskTimers,
    resetMockState
};
