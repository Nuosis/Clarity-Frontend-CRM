/**
 * Axios Mock for Testing
 *
 * Intercepts axios API calls and returns mock responses
 * Simulates backend API behavior
 */

import {
    mockTasksApi
} from './tasksApi';

const axios = {
    create: jest.fn(() => axios),
    defaults: {
        headers: {
            common: {}
        }
    },
    interceptors: {
        request: {
            use: jest.fn(),
            eject: jest.fn()
        },
        response: {
            use: jest.fn(),
            eject: jest.fn()
        }
    },

    // GET requests
    get: jest.fn((url, config) => {
        console.log('[Axios Mock] GET:', url, config?.params);

        // Tasks endpoints
        if (url.includes('/tasks')) {
            if (config?.params?.project_id) {
                return Promise.resolve({
                    data: mockTasksApi.fetchTasksForProject(config.params.project_id),
                    status: 200,
                    statusText: 'OK'
                });
            }
        }

        // Time entries - active timer
        if (url.includes('/time-entries/active')) {
            const staffId = config?.params?.staff_id;
            return mockTasksApi.getActiveTimer(staffId).then(timer => {
                if (!timer) {
                    // Simulate 404 for no active timer
                    return Promise.reject({
                        response: {
                            status: 404,
                            data: { detail: 'No active timer found' }
                        }
                    });
                }
                return Promise.resolve({
                    data: timer,
                    status: 200,
                    statusText: 'OK'
                });
            });
        }

        // Time entries - list with filters
        if (url.includes('/time-entries') && !url.includes('/active')) {
            return mockTasksApi.fetchTaskTimers(config?.params || {}).then(timers => ({
                data: timers,
                status: 200,
                statusText: 'OK'
            }));
        }

        return Promise.reject({
            response: {
                status: 404,
                data: { detail: 'Not found' }
            }
        });
    }),

    // POST requests
    post: jest.fn((url, data, config) => {
        console.log('[Axios Mock] POST:', url, data);

        // Create task
        if (url.includes('/tasks') && !url.includes('/time-entries')) {
            return mockTasksApi.createTask(data)
                .then(task => ({
                    data: task,
                    status: 201,
                    statusText: 'Created'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 400,
                        data: { detail: error.message }
                    }
                }));
        }

        // Start timer
        if (url.includes('/time-entries/start')) {
            return mockTasksApi.startTimer(data)
                .then(timer => ({
                    data: timer,
                    status: 201,
                    statusText: 'Created'
                }))
                .catch(error => {
                    const status = error.status || 400;
                    return Promise.reject({
                        response: {
                            status,
                            data: error.response?.data || { detail: error.message }
                        }
                    });
                });
        }

        // Stop timer
        const stopMatch = url.match(/\/time-entries\/([^/]+)\/stop/);
        if (stopMatch) {
            const entryId = stopMatch[1];
            // Check if project is fixed-price (simulate via data flag for testing)
            const isFixedPrice = data?._test_fixed_price || false;
            return mockTasksApi.stopTimer(entryId, data, isFixedPrice)
                .then(response => ({
                    data: response,
                    status: 200,
                    statusText: 'OK'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 400,
                        data: { detail: error.message }
                    }
                }));
        }

        // Pause timer
        const pauseMatch = url.match(/\/time-entries\/([^/]+)\/pause/);
        if (pauseMatch) {
            const entryId = pauseMatch[1];
            return mockTasksApi.pauseTimer(entryId)
                .then(timer => ({
                    data: timer,
                    status: 200,
                    statusText: 'OK'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 400,
                        data: { detail: error.message }
                    }
                }));
        }

        // Resume timer
        const resumeMatch = url.match(/\/time-entries\/([^/]+)\/resume/);
        if (resumeMatch) {
            const entryId = resumeMatch[1];
            return mockTasksApi.resumeTimer(entryId)
                .then(timer => ({
                    data: timer,
                    status: 200,
                    statusText: 'OK'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 400,
                        data: { detail: error.message }
                    }
                }));
        }

        return Promise.reject({
            response: {
                status: 404,
                data: { detail: 'Not found' }
            }
        });
    }),

    // PATCH requests
    patch: jest.fn((url, data, config) => {
        console.log('[Axios Mock] PATCH:', url, data);

        // Update task
        const taskMatch = url.match(/\/tasks\/([^/]+)/);
        if (taskMatch) {
            const taskId = taskMatch[1];
            return mockTasksApi.updateTask(taskId, data)
                .then(task => ({
                    data: task,
                    status: 200,
                    statusText: 'OK'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 400,
                        data: { detail: error.message }
                    }
                }));
        }

        return Promise.reject({
            response: {
                status: 404,
                data: { detail: 'Not found' }
            }
        });
    }),

    // DELETE requests
    delete: jest.fn((url, config) => {
        console.log('[Axios Mock] DELETE:', url);

        // Delete task
        const taskMatch = url.match(/\/tasks\/([^/]+)/);
        if (taskMatch) {
            const taskId = taskMatch[1];
            return mockTasksApi.deleteTask(taskId)
                .then(result => ({
                    data: result,
                    status: 204,
                    statusText: 'No Content'
                }))
                .catch(error => Promise.reject({
                    response: {
                        status: 404,
                        data: { detail: error.message }
                    }
                }));
        }

        return Promise.reject({
            response: {
                status: 404,
                data: { detail: 'Not found' }
            }
        });
    }),

    // PUT requests
    put: jest.fn((url, data, config) => {
        console.log('[Axios Mock] PUT:', url, data);
        return Promise.reject({
            response: {
                status: 404,
                data: { detail: 'Not found' }
            }
        });
    }),

    // Request interceptor
    request: jest.fn((config) => {
        return Promise.resolve(config);
    })
};

export default axios;
