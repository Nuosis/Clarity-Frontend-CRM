/**
 * Financial Record Fixtures - New Backend API Format
 *
 * These fixtures match the FinancialRecordResponse model
 * from the backend API specification.
 */

export const mockFinancialRecord = {
    id: '770e8400-e29b-41d4-a716-446655440000',
    financial_id: '880e8400-e29b-41d4-a716-446655440000',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    product_id: null,
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
    quantity: '5.5',
    unit_price: '100.00',
    total_price: '550.00',
    date: '2026-01-15',
    inv_id: null,
    billing_status: 'unbilled',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    time_entry_id: null,
    configuration_data: null
};

export const mockBilledFinancialRecord = {
    id: '770e8400-e29b-41d4-a716-446655440001',
    financial_id: '880e8400-e29b-41d4-a716-446655440001',
    organization_id: '123e4567-e89b-12d3-a456-426614174000',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    product_id: 'prod-123',
    project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
    product_name: 'CUSTOMER:Project',
    quantity: '8.0',
    unit_price: '125.00',
    total_price: '1000.00',
    date: '2026-01-14',
    inv_id: 'QB-12345',
    billing_status: 'billed',
    created_at: '2026-01-14T10:00:00Z',
    updated_at: '2026-01-14T16:00:00Z',
    time_entry_id: '660e8400-e29b-41d4-a716-446655440002',
    configuration_data: null
};

export const mockFinancialRecordsList = [
    mockFinancialRecord,
    mockBilledFinancialRecord,
    {
        id: '770e8400-e29b-41d4-a716-446655440002',
        financial_id: '880e8400-e29b-41d4-a716-446655440002',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
        product_id: null,
        project_id: 'aa0e8400-e29b-41d4-a716-446655440111',
        product_name: 'CUSTOMER:Marketing',
        quantity: '3.0',
        unit_price: '150.00',
        total_price: '450.00',
        date: '2026-01-13',
        inv_id: null,
        billing_status: 'unbilled',
        created_at: '2026-01-13T09:00:00Z',
        updated_at: '2026-01-13T09:00:00Z',
        time_entry_id: null,
        configuration_data: null
    }
];

export const mockFinancialRecordCreatePayload = {
    financial_id: 'fin-new-001',
    customer_id: 'bb0e8400-e29b-41d4-a716-446655440222',
    product_name: 'CUSTOMER:Development',
    quantity: 4.0,
    unit_price: 100.00,
    total_price: 400.00,
    date: '2026-01-15'
};

// Legacy FileMaker format for backward compatibility testing
export const mockFileMakerFinancialRecord = {
    recordId: 'fm-fin-123',
    fieldData: {
        __ID: 'fin-001',
        _custID: 'bb0e8400-e29b-41d4-a716-446655440222',
        DateStart: '01/15/2026',
        Billable_Time_Rounded: '5.5',
        Hourly_Rate: '100.00',
        'Customers::Name': 'Clarity Business Solutions',
        'customers_Projects::projectName': 'Development Work',
        f_billed: '0',
        product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
        '~creationTimestamp': '2026-01-15T10:00:00Z',
        '~modificationTimestamp': '2026-01-15T10:00:00Z'
    }
};

// Financial record validation errors
export const mockFinancialRecordValidationErrors = {
    detail: [
        {
            loc: ['body', 'customer_id'],
            msg: 'field required',
            type: 'value_error.missing'
        },
        {
            loc: ['body', 'quantity'],
            msg: 'ensure this value is greater than or equal to 0',
            type: 'value_error.number.not_ge'
        },
        {
            loc: ['body', 'total_price'],
            msg: 'total_price mismatch: expected 400.00, got 500.00',
            type: 'value_error'
        }
    ]
};
