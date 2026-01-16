/**
 * Task Fixtures - New Backend API Format
 *
 * These fixtures match the TaskResponse and TaskCreate models
 * from the backend API specification.
 */

export const mockTask = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    title: 'Implement user authentication',
    task_type: 'feature',
    notes: 'Add JWT-based authentication with refresh tokens',
    is_completed: false,
    status: 'active',
    priority: 3,
    estimated_hours: '8.0',
    actual_hours: null,
    due_date: '2026-01-20',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z'
};

export const mockCompletedTask = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    title: 'Fix login bug',
    task_type: 'bug',
    notes: 'Fixed session timeout issue',
    is_completed: true,
    status: 'completed',
    priority: 1,
    estimated_hours: '2.0',
    actual_hours: '2.0',
    due_date: '2026-01-15',
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-15T14:00:00Z'
};

export const mockTasksList = [
    mockTask,
    mockCompletedTask,
    {
        id: '550e8400-e29b-41d4-a716-446655440002',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
        customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
        staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
        title: 'Update documentation',
        notes: null,
        task_type: 'documentation',
        priority: 2,
        status: 'active',
        is_completed: false,
        estimated_hours: 4.0,
        due_date: '2026-01-22',
        created_at: '2026-01-14T11:00:00Z',
        updated_at: '2026-01-14T11:00:00Z'
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440003',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
        customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
        staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
        title: 'Performance optimization',
        notes: 'Reduce API response time by 50%',
        task_type: 'improvement',
        priority: 4,
        status: 'active',
        is_completed: false,
        estimated_hours: 12.0,
        due_date: null,
        created_at: '2026-01-12T08:00:00Z',
        updated_at: '2026-01-14T16:00:00Z'
    }
];

export const mockTaskCreatePayload = {
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    title: 'New task',
    notes: 'Task details',
    task_type: 'feature',
    priority: 3,
    status: 'active',
    estimated_hours: 5.0,
    due_date: '2026-01-25'
};

export const mockTaskUpdatePayload = {
    title: 'Updated task title',
    notes: 'Updated notes',
    priority: 1,
    status: 'active',
    estimated_hours: 6.0
};
