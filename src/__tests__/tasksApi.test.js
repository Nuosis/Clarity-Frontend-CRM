/**
 * Tasks API Unit Tests
 *
 * Tests for src/api/tasks.js covering:
 * - New endpoints (pause/resume/getActiveTimer/fetchTaskTimers)
 * - HMAC authentication
 * - Error handling
 * - Request/response mapping
 * - Backend API integration
 */

import axios from 'axios';
import * as tasksApi from '../api/tasks';
import * as dataService from '../services/dataService';
import { backendConfig } from '../config';

// Mock axios
jest.mock('axios');

// Mock dataService module
jest.mock('../services/dataService', () => ({
    generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-signature.1234567890'),
    getOrganizationId: jest.fn().mockReturnValue('123e4567-e89b-12d3-a456-426614174000'),
    hasOrganizationContext: jest.fn().mockReturnValue(true),
    getAuthenticationContext: jest.fn().mockReturnValue({
        isAuthenticated: true,
        user: { supabaseOrgID: '123e4567-e89b-12d3-a456-426614174000' }
    })
}));

// Mock config
jest.mock('../config', () => ({
    backendConfig: {
        baseUrl: 'https://api.claritybusinesssolutions.ca'
    }
}));

describe('Tasks API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Set environment variable for Web Crypto API
        global.crypto = {
            subtle: {
                importKey: jest.fn(),
                sign: jest.fn()
            }
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('HMAC Authentication', () => {
        it('should include HMAC authorization header in GET requests', async () => {
            const mockResponse = { data: [] };
            axios.get.mockResolvedValue(mockResponse);

            await tasksApi.fetchTasksForProject('test-project-id');

            expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith('');
            expect(axios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-signature.1234567890'
                    })
                })
            );
        });

        it('should include HMAC authorization header in POST requests with payload', async () => {
            const mockResponse = { data: { id: 'task-1' } };
            const taskData = { title: 'Test Task', project_id: 'proj-1' };
            axios.post.mockResolvedValue(mockResponse);

            await tasksApi.createTask(taskData);

            expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith(
                JSON.stringify(taskData)
            );
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                taskData,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-signature.1234567890'
                    })
                })
            );
        });

        it('should include HMAC authorization header in PATCH requests', async () => {
            const mockResponse = { data: { id: 'task-1', title: 'Updated' } };
            const updateData = { title: 'Updated' };
            axios.patch.mockResolvedValue(mockResponse);

            await tasksApi.updateTask('task-1', updateData);

            expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith(
                JSON.stringify(updateData)
            );
            expect(axios.patch).toHaveBeenCalledWith(
                expect.any(String),
                updateData,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-signature.1234567890'
                    })
                })
            );
        });

        it('should include HMAC authorization header in DELETE requests', async () => {
            const mockResponse = { data: { success: true } };
            axios.delete.mockResolvedValue(mockResponse);

            await tasksApi.deleteTask('task-1');

            expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith('');
            expect(axios.delete).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-signature.1234567890'
                    })
                })
            );
        });
    });

    describe('Task CRUD Operations', () => {
        describe('fetchTasksForProject', () => {
            it('should fetch tasks for a project', async () => {
                const mockTasks = [
                    { id: 'task-1', title: 'Task 1', project_id: 'proj-1' },
                    { id: 'task-2', title: 'Task 2', project_id: 'proj-1' }
                ];
                axios.get.mockResolvedValue({ data: mockTasks });

                const result = await tasksApi.fetchTasksForProject('proj-1');

                expect(result).toEqual(mockTasks);
                expect(axios.get).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/tasks`,
                    expect.objectContaining({
                        params: { project_id: 'proj-1' }
                    })
                );
            });

        });

        describe('createTask', () => {
            it('should create a new task', async () => {
                const newTask = {
                    title: 'New Task',
                    project_id: 'proj-1',
                    priority: 3
                };
                const mockResponse = {
                    id: 'task-1',
                    ...newTask,
                    created_at: '2024-01-15T10:00:00Z'
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.createTask(newTask);

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/tasks`,
                    newTask,
                    expect.any(Object)
                );
            });

            it('should include Content-Type header', async () => {
                const newTask = { title: 'Test', project_id: 'proj-1' };
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.createTask(newTask);

                expect(axios.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(Object),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json'
                        })
                    })
                );
            });
        });

        describe('updateTask', () => {
            it('should update an existing task', async () => {
                const updateData = { title: 'Updated Title', priority: 1 };
                const mockResponse = {
                    id: 'task-1',
                    ...updateData,
                    updated_at: '2024-01-15T10:00:00Z'
                };
                axios.patch.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.updateTask('task-1', updateData);

                expect(result).toEqual(mockResponse);
                expect(axios.patch).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/tasks/task-1`,
                    updateData,
                    expect.any(Object)
                );
            });
        });

        describe('updateTaskStatus', () => {
            it('should toggle task completion status', async () => {
                const mockResponse = {
                    id: 'task-1',
                    is_completed: true,
                    status: 'completed'
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.updateTaskStatus('task-1', true);

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/tasks/task-1/toggle-completion`,
                    null,
                    expect.any(Object)
                );
            });

            it('should send empty payload with HMAC', async () => {
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.updateTaskStatus('task-1', true);

                expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith('');
            });
        });

        describe('deleteTask', () => {
            it('should delete a task', async () => {
                const mockResponse = { success: true };
                axios.delete.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.deleteTask('task-1');

                expect(result).toEqual(mockResponse);
                expect(axios.delete).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/tasks/task-1`,
                    expect.any(Object)
                );
            });
        });
    });

    describe('Timer Operations', () => {
        describe('startTaskTimer', () => {
            it('should start a timer with correct payload', async () => {
                const selectedTask = {
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };
                const mockResponse = {
                    id: 'timer-1',
                    task_id: 'task-1',
                    staff_id: 'staff-1',
                    status: 'active'
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.startTaskTimer('task-1', selectedTask);

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/start`,
                    {
                        task_id: 'task-1',
                        staff_id: 'staff-1',
                        is_billable: true
                    },
                    expect.any(Object)
                );
            });

            it('should handle staff_id field name variations', async () => {
                const selectedTask = {
                    staff_id: 'staff-1', // Using staff_id instead of _staffID
                    _projectID: 'proj-1'
                };
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.startTaskTimer('task-1', selectedTask);

                expect(axios.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        staff_id: 'staff-1'
                    }),
                    expect.any(Object)
                );
            });

            it('should stringify payload for HMAC', async () => {
                const selectedTask = { _staffID: 'staff-1', _projectID: 'proj-1' };
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.startTaskTimer('task-1', selectedTask);

                const expectedPayload = JSON.stringify({
                    task_id: 'task-1',
                    staff_id: 'staff-1',
                    is_billable: true
                });
                expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith(expectedPayload);
            });
        });

        describe('stopTaskTimer', () => {
            it('should stop timer with description and adjustment', async () => {
                const mockResponse = {
                    time_entry: {
                        id: 'timer-1',
                        status: 'completed',
                        billable_hours: 2.5
                    },
                    financial_record: {
                        id: 'fin-1',
                        quantity: 2.5,
                        total_price: 250.00
                    }
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.stopTaskTimer(
                    'timer-1',
                    'Completed work',
                    false,
                    360
                );

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/timer-1/stop`,
                    {
                        description: 'Completed work',
                        adjustment_seconds: 360
                    },
                    expect.any(Object)
                );
            });

            it('should use default description when saveImmediately is true', async () => {
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.stopTaskTimer('timer-1', '', true, 0);

                expect(axios.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        description: 'Time logged'
                    }),
                    expect.any(Object)
                );
            });

            it('should default adjustment_seconds to 0', async () => {
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.stopTaskTimer('timer-1', 'Work done');

                expect(axios.post).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        adjustment_seconds: 0
                    }),
                    expect.any(Object)
                );
            });
        });

        describe('pauseTimer', () => {
            it('should pause an active timer', async () => {
                const mockResponse = {
                    id: 'timer-1',
                    status: 'paused',
                    pause_time: '2024-01-15T10:30:00Z'
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.pauseTimer('timer-1');

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/timer-1/pause`,
                    null,
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer test-signature.1234567890',
                            'Content-Type': 'application/json'
                        })
                    })
                );
            });

            it('should send empty payload', async () => {
                axios.post.mockResolvedValue({ data: {} });

                await tasksApi.pauseTimer('timer-1');

                expect(dataService.generateBackendAuthHeader).toHaveBeenCalledWith('');
            });

        });

        describe('resumeTimer', () => {
            it('should resume a paused timer', async () => {
                const mockResponse = {
                    id: 'timer-1',
                    status: 'active',
                    resume_time: '2024-01-15T10:35:00Z',
                    pause_duration_seconds: 300
                };
                axios.post.mockResolvedValue({ data: mockResponse });

                const result = await tasksApi.resumeTimer('timer-1');

                expect(result).toEqual(mockResponse);
                expect(axios.post).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/timer-1/resume`,
                    null,
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer test-signature.1234567890',
                            'Content-Type': 'application/json'
                        })
                    })
                );
            });
        });

        describe('getActiveTimer', () => {
            it('should fetch active timer for staff member', async () => {
                const mockTimer = {
                    id: 'timer-1',
                    staff_id: 'staff-1',
                    status: 'active'
                };
                axios.get.mockResolvedValue({ data: mockTimer });

                const result = await tasksApi.getActiveTimer('staff-1');

                expect(result).toEqual(mockTimer);
                expect(axios.get).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/active`,
                    expect.objectContaining({
                        params: { staff_id: 'staff-1' }
                    })
                );
            });

            it('should handle optional staff_id parameter', async () => {
                axios.get.mockResolvedValue({ data: {} });

                await tasksApi.getActiveTimer();

                expect(axios.get).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries/active`,
                    expect.objectContaining({
                        params: {}
                    })
                );
            });

            it('should return null on 404 error', async () => {
                const error = new Error('Not found');
                error.response = { status: 404 };
                axios.get.mockRejectedValue(error);

                const result = await tasksApi.getActiveTimer('staff-1');

                expect(result).toBeNull();
            });

            it('should throw error on non-404 errors', async () => {
                const error = new Error('Server error');
                error.response = { status: 500, data: { detail: 'Internal error' } };
                axios.get.mockRejectedValue(error);

                await expect(tasksApi.getActiveTimer('staff-1')).rejects.toThrow();
            });
        });

        describe('fetchTaskTimers', () => {
            it('should fetch timers for a task', async () => {
                const mockTimers = [
                    { id: 'timer-1', task_id: 'task-1', status: 'completed' },
                    { id: 'timer-2', task_id: 'task-1', status: 'completed' }
                ];
                axios.get.mockResolvedValue({ data: mockTimers });

                const result = await tasksApi.fetchTaskTimers('task-1');

                expect(result).toEqual(mockTimers);
                expect(axios.get).toHaveBeenCalledWith(
                    `${backendConfig.baseUrl}/time-entries`,
                    expect.objectContaining({
                        params: { task_id: 'task-1' }
                    })
                );
            });

            it('should apply filters', async () => {
                axios.get.mockResolvedValue({ data: [] });

                const filters = {
                    project_id: 'proj-1',
                    staff_id: 'staff-1',
                    status: 'completed'
                };

                await tasksApi.fetchTaskTimers('task-1', filters);

                expect(axios.get).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        params: {
                            task_id: 'task-1',
                            ...filters
                        }
                    })
                );
            });

            it('should handle empty filters', async () => {
                axios.get.mockResolvedValue({ data: [] });

                await tasksApi.fetchTaskTimers('task-1', {});

                expect(axios.get).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        params: { task_id: 'task-1' }
                    })
                );
            });
        });
    });

    describe('Error Handling', () => {
        describe('handleApiError', () => {
            it('should handle validation errors (array format)', async () => {
                const error = new Error('Validation failed');
                error.response = {
                    data: {
                        detail: [
                            { loc: ['body', 'title'], msg: 'field required' },
                            { loc: ['body', 'project_id'], msg: 'field required' }
                        ]
                    }
                };
                axios.post.mockRejectedValue(error);

                await expect(tasksApi.createTask({})).rejects.toThrow(
                    'Validation error: body.title: field required, body.project_id: field required'
                );
            });

            it('should handle string detail errors', async () => {
                const error = new Error('Error');
                error.response = {
                    data: { detail: 'Task not found' }
                };
                axios.get.mockRejectedValue(error);

                await expect(tasksApi.fetchTasksForProject('proj-1')).rejects.toThrow('Task not found');
            });

            it('should handle message field errors', async () => {
                const error = new Error('Error');
                error.response = {
                    data: { message: 'Unauthorized access' }
                };
                axios.post.mockRejectedValue(error);

                await expect(tasksApi.createTask({})).rejects.toThrow('Unauthorized access');
            });

            it('should handle error field errors', async () => {
                const error = new Error('Error');
                error.response = {
                    data: { error: 'Database connection failed' }
                };
                axios.get.mockRejectedValue(error);

                await expect(tasksApi.fetchTasksForProject('proj-1')).rejects.toThrow(
                    'Database connection failed'
                );
            });

            it('should handle string response data', async () => {
                const error = new Error('Error');
                error.response = {
                    data: 'Bad request'
                };
                axios.post.mockRejectedValue(error);

                await expect(tasksApi.createTask({})).rejects.toThrow('Bad request');
            });

            it('should handle errors without response', async () => {
                const error = new Error('Network error');
                axios.get.mockRejectedValue(error);

                await expect(tasksApi.fetchTasksForProject('proj-1')).rejects.toThrow('Network error');
            });

            it('should handle non-Error objects', async () => {
                const error = new Error('Unknown error');
                error.response = {
                    data: { detail: { code: 'UNKNOWN', message: 'Something went wrong' } }
                };
                axios.post.mockRejectedValue(error);

                await expect(tasksApi.createTask({})).rejects.toThrow();
            });

            it('should log errors before throwing', async () => {
                const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
                const error = new Error('Test error');
                error.response = { data: { detail: 'Test error' } };
                axios.get.mockRejectedValue(error);

                await expect(tasksApi.fetchTasksForProject('proj-1')).rejects.toThrow();
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[Tasks API] Fetch tasks for project failed:',
                    expect.any(Error)
                );

                consoleErrorSpy.mockRestore();
            });
        });

        it('should handle timeout errors', async () => {
            const error = new Error('timeout of 10000ms exceeded');
            axios.get.mockRejectedValue(error);

            await expect(tasksApi.fetchTasksForProject('proj-1')).rejects.toThrow(
                'timeout of 10000ms exceeded'
            );
        });

        it('should handle network errors', async () => {
            const error = new Error('Network Error');
            error.code = 'ECONNREFUSED';
            axios.post.mockRejectedValue(error);

            await expect(tasksApi.createTask({})).rejects.toThrow('Network Error');
        });
    });

    describe('Request/Response Mapping', () => {
        it('should correctly map task data to API request', async () => {
            const taskData = {
                title: 'Test Task',
                project_id: 'proj-1',
                priority: 3,
                description: 'Test description',
                due_date: '2024-12-31'
            };
            axios.post.mockResolvedValue({ data: {} });

            await tasksApi.createTask(taskData);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                taskData,
                expect.any(Object)
            );
        });

        it('should return response data directly', async () => {
            const mockResponseData = {
                id: 'task-1',
                title: 'Task 1',
                created_at: '2024-01-15T10:00:00Z'
            };
            axios.post.mockResolvedValue({ data: mockResponseData });

            const result = await tasksApi.createTask({ title: 'Task 1' });

            expect(result).toEqual(mockResponseData);
        });

        it('should handle complex response structures', async () => {
            const mockResponse = {
                time_entry: { id: 'timer-1' },
                financial_record: { id: 'fin-1' }
            };
            axios.post.mockResolvedValue({ data: mockResponse });

            const result = await tasksApi.stopTaskTimer('timer-1', 'Done');

            expect(result).toEqual(mockResponse);
            expect(result.time_entry).toBeDefined();
            expect(result.financial_record).toBeDefined();
        });
    });

    describe('Console Logging', () => {
        it('should log successful operations', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            axios.post.mockResolvedValue({ data: { id: 'task-1' } });

            await tasksApi.createTask({ title: 'Test' });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[Tasks API] Creating task:',
                expect.any(Object)
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[Tasks API] Task created successfully:',
                expect.any(Object)
            );

            consoleLogSpy.mockRestore();
        });

        it('should log timer operations', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            axios.post.mockResolvedValue({ data: { id: 'timer-1' } });

            await tasksApi.startTaskTimer('task-1', { _staffID: 'staff-1' });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[Tasks API] Starting timer for task:',
                'task-1'
            );

            consoleLogSpy.mockRestore();
        });
    });

});
