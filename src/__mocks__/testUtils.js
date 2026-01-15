/**
 * Test Utilities
 *
 * Helper functions for testing with new backend API mocks
 */

import { mockTasksApi } from './tasksApi';

/**
 * Setup test environment before each test
 */
export function setupTestEnvironment() {
    // Reset mock state
    mockTasksApi.resetMockState();

    // Clear all mocks
    jest.clearAllMocks();
}

/**
 * Cleanup test environment after each test
 */
export function cleanupTestEnvironment() {
    mockTasksApi.resetMockState();
    jest.clearAllMocks();
}

/**
 * Create a mock authenticated user context
 */
export function createMockUserContext(overrides = {}) {
    return {
        userId: 'cc0e8400-e29b-41d4-a716-446655440333',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        ...overrides
    };
}

/**
 * Create a mock project context
 */
export function createMockProjectContext(overrides = {}) {
    return {
        projectId: 'aa0e8400-e29b-41d4-a716-446655440111',
        customerId: 'bb0e8400-e29b-41d4-a716-446655440222',
        projectName: 'Test Project',
        isFixedPrice: false,
        hourlyRate: 100.00,
        ...overrides
    };
}

/**
 * Wait for async operations
 */
export function waitFor(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate API error
 */
export function createApiError(status, message, details = null) {
    const error = new Error(message);
    error.response = {
        status,
        statusText: getStatusText(status),
        data: {
            detail: details || message
        }
    };
    return error;
}

/**
 * Get HTTP status text
 */
function getStatusText(status) {
    const statusTexts = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        409: 'Conflict',
        422: 'Unprocessable Entity',
        500: 'Internal Server Error'
    };
    return statusTexts[status] || 'Unknown';
}

/**
 * Create validation error response (FastAPI format)
 */
export function createValidationError(field, message, type = 'value_error') {
    return {
        detail: [
            {
                loc: ['body', field],
                msg: message,
                type
            }
        ]
    };
}

/**
 * Assert task matches expected shape
 */
export function assertTaskShape(task) {
    expect(task).toHaveProperty('id');
    expect(task).toHaveProperty('organization_id');
    expect(task).toHaveProperty('project_id');
    expect(task).toHaveProperty('customer_id');
    expect(task).toHaveProperty('title');
    expect(task).toHaveProperty('status');
    expect(task).toHaveProperty('is_completed');
    expect(task).toHaveProperty('priority');
    expect(task).toHaveProperty('created_at');
    expect(task).toHaveProperty('updated_at');
}

/**
 * Assert timer matches expected shape
 */
export function assertTimerShape(timer) {
    expect(timer).toHaveProperty('id');
    expect(timer).toHaveProperty('organization_id');
    expect(timer).toHaveProperty('task_id');
    expect(timer).toHaveProperty('staff_id');
    expect(timer).toHaveProperty('project_id');
    expect(timer).toHaveProperty('customer_id');
    expect(timer).toHaveProperty('start_time');
    expect(timer).toHaveProperty('status');
    expect(timer).toHaveProperty('is_billable');
    expect(timer).toHaveProperty('hourly_rate');
    expect(timer).toHaveProperty('created_at');
    expect(timer).toHaveProperty('updated_at');
}

/**
 * Assert financial record matches expected shape
 */
export function assertFinancialRecordShape(record) {
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('organization_id');
    expect(record).toHaveProperty('financial_id');
    expect(record).toHaveProperty('customer_id');
    expect(record).toHaveProperty('product_name');
    expect(record).toHaveProperty('quantity');
    expect(record).toHaveProperty('unit_price');
    expect(record).toHaveProperty('total_price');
    expect(record).toHaveProperty('date');
    expect(record).toHaveProperty('created_at');
    expect(record).toHaveProperty('updated_at');
}
