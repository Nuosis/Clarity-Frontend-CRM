/**
 * Timer Fixtures - New Backend API Format
 *
 * These fixtures match the TimeEntryResponse model
 * from the backend /time-entries API specification.
 */

export const mockActiveTimer = {
    id: '660e8400-e29b-41d4-a716-446655440000',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    start_time: '2026-01-15T10:30:00Z',
    end_time: null,
    description: null,
    adjustment_seconds: 0,
    pause_duration_seconds: 0,
    duration_minutes: null,
    hourly_rate: '100.00',
    billable_amount: null,
    is_billable: true,
    status: 'active',
    completed_at: null,
    filemaker_record_id: null,
    created_at: '2026-01-15T10:30:00Z',
    updated_at: '2026-01-15T10:30:00Z'
};

export const mockPausedTimer = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    start_time: '2026-01-15T10:30:00Z',
    end_time: null,
    description: null,
    adjustment_seconds: 0,
    pause_duration_seconds: 600,
    duration_minutes: null,
    hourly_rate: '100.00',
    billable_amount: null,
    is_billable: true,
    status: 'paused',
    completed_at: null,
    filemaker_record_id: null,
    created_at: '2026-01-15T10:30:00Z',
    updated_at: '2026-01-15T11:15:00Z'
};

export const mockCompletedTimer = {
    id: '660e8400-e29b-41d4-a716-446655440002',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    task_id: '550e8400-e29b-41d4-a716-446655440001',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    start_time: '2026-01-15T09:00:00Z',
    end_time: '2026-01-15T11:00:00Z',
    description: 'Fixed authentication bug',
    adjustment_seconds: 360,
    pause_duration_seconds: 600,
    duration_minutes: '120.0',
    hourly_rate: '100.00',
    billable_amount: '200.00',
    is_billable: true,
    status: 'completed',
    completed_at: '2026-01-15T11:00:00Z',
    filemaker_record_id: null,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-15T11:00:00Z'
};

export const mockTimersList = [
    mockCompletedTimer,
    {
        id: '660e8400-e29b-41d4-a716-446655440003',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        task_id: '550e8400-e29b-41d4-a716-446655440002',
        staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
        project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
        customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
        start_time: '2026-01-14T14:00:00Z',
        end_time: '2026-01-14T18:00:00Z',
        description: 'Updated documentation',
        adjustment_seconds: 0,
        pause_duration_seconds: 0,
        duration_minutes: '240.0',
        hourly_rate: '100.00',
        billable_amount: '400.00',
        is_billable: true,
        status: 'completed',
        completed_at: '2026-01-14T18:00:00Z',
        filemaker_record_id: null,
        created_at: '2026-01-14T14:00:00Z',
        updated_at: '2026-01-14T18:00:00Z'
    }
];

export const mockStartTimerPayload = {
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    staff_id: 'cc0e8400-e29b-41d4-a716-446655440333',
    is_billable: true
};

export const mockStopTimerPayload = {
    description: 'Completed authentication implementation',
    adjustment_seconds: 360,
    end_time: null // defaults to now
};

export const mockStopTimerResponse = {
    time_entry: mockCompletedTimer,
    financial_record: {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        financial_id: 'fin-123',
        customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
        product_id: null,
        product_name: 'CUSTOMER:Project',
        quantity: 2.0,
        unit_price: 100.00,
        total_price: 200.00,
        date: '2026-01-15',
        inv_id: null,
        configuration_data: null,
        created_at: '2026-01-15T11:00:00Z',
        updated_at: '2026-01-15T11:00:00Z'
    }
};

export const mockStopTimerResponseFixedPrice = {
    time_entry: mockCompletedTimer,
    financial_record: null // No financial record for fixed-price projects
};

// Legacy FileMaker format for backward compatibility testing
export const mockFileMakerTimer = {
    recordId: 'fm-timer-123',
    fieldData: {
        __ID: '660e8400-e29b-41d4-a716-446655440000',
        _taskID: '550e8400-e29b-41d4-a716-446655440000',
        _staffID: 'cc0e8400-e29b-41d4-a716-446655440333',
        _projectID: 'aa0e8400-e29b-41d4-a716-446655440111',
        _custID: 'bb0e8400-e29b-41d4-a716-446655440222',
        DateStart: '01/15/2026',
        TimeStart: '10:30:00',
        TimeEnd: '',
        'Work Performed': '',
        TimeAdjust: '0',
        Billable_Time_Rounded: '',
        Hourly_Rate: '100.00',
        '~creationTimestamp': '2026-01-15T10:30:00Z',
        '~modificationTimestamp': '2026-01-15T10:30:00Z'
    }
};

// Timer concurrency error (409)
export const mockTimerConcurrencyError = {
    detail: 'Staff member already has an active timer',
    existing_timer: mockActiveTimer
};

// Timer validation errors
export const mockTimerValidationErrors = {
    detail: [
        {
            loc: ['body', 'task_id'],
            msg: 'field required',
            type: 'value_error.missing'
        },
        {
            loc: ['body', 'staff_id'],
            msg: 'field required',
            type: 'value_error.missing'
        }
    ]
};
