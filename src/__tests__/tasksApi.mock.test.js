/**
 * Tasks API Mock Tests
 *
 * Tests for mock implementations simulating backend API behavior
 */

import {
    mockTasksApi
} from '../__mocks__/tasksApi';
import {
    mockTask,
    mockTasksList,
    mockActiveTimer,
    mockTaskCreatePayload
} from '../__fixtures__';
import {
    setupTestEnvironment,
    cleanupTestEnvironment,
    assertTaskShape,
    assertTimerShape
} from '../__mocks__/testUtils';

describe('Tasks API Mocks', () => {
    beforeEach(() => {
        setupTestEnvironment();
    });

    afterEach(() => {
        cleanupTestEnvironment();
    });

    describe('Task Operations', () => {
        describe('fetchTasksForProject', () => {
            it('should fetch tasks for a project', async () => {
                const projectId = 'aa0e8400-e29b-41d4-a716-446655440111';
                const tasks = await mockTasksApi.fetchTasksForProject(projectId);

                expect(Array.isArray(tasks)).toBe(true);
                expect(tasks.length).toBeGreaterThan(0);
                tasks.forEach(task => {
                    expect(task.project_id).toBe(projectId);
                    assertTaskShape(task);
                });
            });

            it('should throw error if project_id is missing', async () => {
                await expect(mockTasksApi.fetchTasksForProject(null))
                    .rejects.toThrow('project_id is required');
            });
        });

        describe('createTask', () => {
            it('should create a new task', async () => {
                const newTask = await mockTasksApi.createTask(mockTaskCreatePayload);

                assertTaskShape(newTask);
                expect(newTask.title).toBe(mockTaskCreatePayload.title);
                expect(newTask.project_id).toBe(mockTaskCreatePayload.project_id);
                expect(newTask.is_completed).toBe(false);
                expect(newTask.status).toBe('active');
            });

            it('should throw error if title is missing', async () => {
                const invalidData = { ...mockTaskCreatePayload, title: '' };
                await expect(mockTasksApi.createTask(invalidData))
                    .rejects.toThrow('title is required');
            });

            it('should throw error if project_id is missing', async () => {
                const invalidData = { ...mockTaskCreatePayload, project_id: null };
                await expect(mockTasksApi.createTask(invalidData))
                    .rejects.toThrow('project_id is required');
            });

            it('should validate priority range', async () => {
                const invalidData = { ...mockTaskCreatePayload, priority: 10 };
                await expect(mockTasksApi.createTask(invalidData))
                    .rejects.toThrow('priority must be between 1 and 5');
            });
        });

        describe('updateTask', () => {
            it('should update an existing task', async () => {
                const taskId = mockTasksList[0].id;
                const updateData = { title: 'Updated title', priority: 1 };

                const updatedTask = await mockTasksApi.updateTask(taskId, updateData);

                assertTaskShape(updatedTask);
                expect(updatedTask.id).toBe(taskId);
                expect(updatedTask.title).toBe('Updated title');
                expect(updatedTask.priority).toBe(1);
            });

            it('should throw error if task not found', async () => {
                await expect(mockTasksApi.updateTask('nonexistent-id', {}))
                    .rejects.toThrow('Task not found');
            });
        });

        describe('updateTaskStatus', () => {
            it('should toggle task completion status', async () => {
                const taskId = mockTasksList[0].id;

                const completedTask = await mockTasksApi.updateTaskStatus(taskId, true);
                expect(completedTask.is_completed).toBe(true);
                expect(completedTask.status).toBe('completed');

                const activeTask = await mockTasksApi.updateTaskStatus(taskId, false);
                expect(activeTask.is_completed).toBe(false);
                expect(activeTask.status).toBe('active');
            });
        });

        describe('deleteTask', () => {
            it('should delete a task', async () => {
                const taskId = mockTasksList[0].id;
                const result = await mockTasksApi.deleteTask(taskId);

                expect(result.success).toBe(true);

                // Verify task is deleted
                const tasks = await mockTasksApi.fetchTasksForProject(mockTasksList[0].project_id);
                expect(tasks.find(t => t.id === taskId)).toBeUndefined();
            });
        });
    });

    describe('Timer Operations', () => {
        describe('startTimer', () => {
            it('should start a timer', async () => {
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };

                const timer = await mockTasksApi.startTimer(startData);

                assertTimerShape(timer);
                expect(timer.task_id).toBe(startData.task_id);
                expect(timer.staff_id).toBe(startData.staff_id);
                expect(timer.status).toBe('active');
                expect(timer.end_time).toBeNull();
            });

            it('should prevent concurrent timers for same staff', async () => {
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };

                // Start first timer
                await mockTasksApi.startTimer(startData);

                // Try to start second timer
                const startData2 = {
                    ...startData,
                    task_id: mockTasksList[1].id
                };

                try {
                    await mockTasksApi.startTimer(startData2);
                    fail('Should have thrown concurrency error');
                } catch (error) {
                    expect(error.message).toContain('already has an active timer');
                    expect(error.status).toBe(409);
                    expect(error.response.data.existing_timer).toBeDefined();
                }
            });

            it('should validate required fields', async () => {
                await expect(mockTasksApi.startTimer({}))
                    .rejects.toThrow('task_id is required');

                await expect(mockTasksApi.startTimer({ task_id: 'test' }))
                    .rejects.toThrow('staff_id is required');
            });
        });

        describe('stopTimer', () => {
            it('should stop timer and create financial record', async () => {
                // Start a timer
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };
                const timer = await mockTasksApi.startTimer(startData);

                // Wait a bit
                await new Promise(resolve => setTimeout(resolve, 100));

                // Stop the timer
                const stopData = {
                    description: 'Completed work',
                    adjustment_seconds: 360
                };
                const result = await mockTasksApi.stopTimer(timer.id, stopData);

                expect(result.time_entry).toBeDefined();
                expect(result.time_entry.status).toBe('completed');
                expect(result.time_entry.description).toBe('Completed work');
                expect(result.time_entry.billable_hours).toBeGreaterThan(0);

                expect(result.financial_record).toBeDefined();
                expect(result.financial_record.quantity).toBe(result.time_entry.billable_hours);
                expect(result.financial_record.total_price).toBeGreaterThan(0);
            });

            it('should not create financial record for fixed-price projects', async () => {
                // Start a timer
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };
                const timer = await mockTasksApi.startTimer(startData);

                // Stop with fixed-price flag
                const stopData = {
                    description: 'Completed work',
                    adjustment_seconds: 0
                };
                const result = await mockTasksApi.stopTimer(timer.id, stopData, true);

                expect(result.time_entry).toBeDefined();
                expect(result.time_entry.status).toBe('completed');
                expect(result.financial_record).toBeNull();
            });
        });

        describe('pauseTimer', () => {
            it('should pause an active timer', async () => {
                // Start a timer
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };
                const timer = await mockTasksApi.startTimer(startData);

                // Pause the timer
                const pausedTimer = await mockTasksApi.pauseTimer(timer.id);

                expect(pausedTimer.status).toBe('paused');
                expect(pausedTimer.pause_time).toBeDefined();
            });

            it('should throw error if timer is not active', async () => {
                await expect(mockTasksApi.pauseTimer('nonexistent-id'))
                    .rejects.toThrow('Timer not found');
            });
        });

        describe('resumeTimer', () => {
            it('should resume a paused timer', async () => {
                // Start and pause a timer
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
                    is_billable: true
                };
                const timer = await mockTasksApi.startTimer(startData);
                const pausedTimer = await mockTasksApi.pauseTimer(timer.id);

                // Resume the timer
                const resumedTimer = await mockTasksApi.resumeTimer(pausedTimer.id);

                expect(resumedTimer.status).toBe('active');
                expect(resumedTimer.resume_time).toBeDefined();
                expect(resumedTimer.pause_duration_seconds).toBeGreaterThan(0);
            });
        });

        describe('getActiveTimer', () => {
            it('should return active timer for staff', async () => {
                const staffId = 'cc0e8400-e29b-41d4-a716-446655440333';

                // Start a timer
                const startData = {
                    task_id: mockTasksList[0].id,
                    staff_id: staffId,
                    is_billable: true
                };
                const timer = await mockTasksApi.startTimer(startData);

                // Get active timer
                const activeTimer = await mockTasksApi.getActiveTimer(staffId);

                expect(activeTimer).toBeDefined();
                expect(activeTimer.id).toBe(timer.id);
                expect(activeTimer.status).toBe('active');
            });

            it('should return null if no active timer', async () => {
                const staffId = 'different-staff-id';
                const activeTimer = await mockTasksApi.getActiveTimer(staffId);

                expect(activeTimer).toBeNull();
            });
        });

        describe('fetchTaskTimers', () => {
            it('should fetch timers with filters', async () => {
                const taskId = mockTasksList[0].id;
                const timers = await mockTasksApi.fetchTaskTimers({ task_id: taskId });

                expect(Array.isArray(timers)).toBe(true);
            });

            it('should filter by status', async () => {
                const timers = await mockTasksApi.fetchTaskTimers({ status: 'completed' });

                expect(Array.isArray(timers)).toBe(true);
                timers.forEach(timer => {
                    expect(timer.status).toBe('completed');
                });
            });
        });
    });
});
