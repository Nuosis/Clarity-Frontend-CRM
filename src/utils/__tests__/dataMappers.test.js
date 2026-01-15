/**
 * Data Mappers Test Suite
 *
 * Tests transformation functions between FileMaker and Backend API formats
 */

import {
    convertDateToISO,
    convertDateToFileMaker,
    convertToBoolean,
    convertToFileMakerBoolean,
    safeParseFloat,
    roundToTwoDecimals,
    formatProductName,
    mapFinancialRecordToBackend,
    mapFinancialRecordToFileMaker,
    mapTaskToBackend,
    mapTaskToFileMaker,
    mapTimerToBackend,
    mapTimerToFileMaker,
    validateFinancialRecord,
    mapBatchToBackend,
    mapBatchToFileMaker
} from '../dataMappers';

describe('Date Conversion Functions', () => {
    describe('convertDateToISO', () => {
        it('should convert MM/DD/YYYY to YYYY-MM-DD', () => {
            expect(convertDateToISO('01/15/2026')).toBe('2026-01-15');
            expect(convertDateToISO('12/31/2025')).toBe('2025-12-31');
            expect(convertDateToISO('5/3/2026')).toBe('2026-05-03');
        });

        it('should handle already ISO formatted dates', () => {
            expect(convertDateToISO('2026-01-15')).toBe('2026-01-15');
            expect(convertDateToISO('2026-01-15T10:30:00')).toBe('2026-01-15');
        });

        it('should return null for invalid dates', () => {
            expect(convertDateToISO('')).toBeNull();
            expect(convertDateToISO(null)).toBeNull();
            expect(convertDateToISO('invalid')).toBeNull();
            expect(convertDateToISO('13/01/2026')).toBeNull();
        });
    });

    describe('convertDateToFileMaker', () => {
        it('should convert YYYY-MM-DD to MM/DD/YYYY', () => {
            expect(convertDateToFileMaker('2026-01-15')).toBe('01/15/2026');
            expect(convertDateToFileMaker('2025-12-31')).toBe('12/31/2025');
        });

        it('should handle already FileMaker formatted dates', () => {
            expect(convertDateToFileMaker('01/15/2026')).toBe('01/15/2026');
        });

        it('should return null for invalid dates', () => {
            expect(convertDateToFileMaker('')).toBeNull();
            expect(convertDateToFileMaker(null)).toBeNull();
        });
    });
});

describe('Boolean Conversion Functions', () => {
    describe('convertToBoolean', () => {
        it('should convert truthy values to true', () => {
            expect(convertToBoolean('1')).toBe(true);
            expect(convertToBoolean(1)).toBe(true);
            expect(convertToBoolean('true')).toBe(true);
            expect(convertToBoolean(true)).toBe(true);
        });

        it('should convert falsy values to false', () => {
            expect(convertToBoolean('0')).toBe(false);
            expect(convertToBoolean(0)).toBe(false);
            expect(convertToBoolean('false')).toBe(false);
            expect(convertToBoolean(false)).toBe(false);
            expect(convertToBoolean('')).toBe(false);
            expect(convertToBoolean(null)).toBe(false);
        });
    });

    describe('convertToFileMakerBoolean', () => {
        it('should convert true to 1', () => {
            expect(convertToFileMakerBoolean(true)).toBe(1);
        });

        it('should convert false to 0', () => {
            expect(convertToFileMakerBoolean(false)).toBe(0);
        });
    });
});

describe('Numeric Functions', () => {
    describe('safeParseFloat', () => {
        it('should parse valid numbers', () => {
            expect(safeParseFloat('123.45')).toBe(123.45);
            expect(safeParseFloat(123.45)).toBe(123.45);
            expect(safeParseFloat('0')).toBe(0);
        });

        it('should return default for invalid values', () => {
            expect(safeParseFloat('')).toBe(0);
            expect(safeParseFloat(null)).toBe(0);
            expect(safeParseFloat(undefined)).toBe(0);
            expect(safeParseFloat('invalid')).toBe(0);
            expect(safeParseFloat('', 100)).toBe(100);
        });
    });

    describe('roundToTwoDecimals', () => {
        it('should round to 2 decimal places', () => {
            expect(roundToTwoDecimals(123.456)).toBe(123.46);
            expect(roundToTwoDecimals(123.454)).toBe(123.45);
            expect(roundToTwoDecimals(123.5)).toBe(123.5);
            expect(roundToTwoDecimals(123)).toBe(123);
        });
    });
});

describe('Product Name Formatting', () => {
    describe('formatProductName', () => {
        it('should format customer and project names correctly', () => {
            expect(formatProductName('Clarity Business Solutions', 'Development Work'))
                .toBe('CLARITYBUSINESSSOLUTIONS:Development');

            expect(formatProductName('ABC Corporation', 'Website Redesign Project'))
                .toBe('ABCCORPORATION:Website');

            expect(formatProductName('Smith & Co.', 'Marketing Campaign'))
                .toBe('SMITHCO:Marketing');

            expect(formatProductName('123 Industries', 'Server Maintenance'))
                .toBe('123INDUSTRIES:Server');
        });

        it('should handle empty inputs', () => {
            expect(formatProductName('', 'Project')).toBe('');
            expect(formatProductName('Customer', '')).toBe('');
            expect(formatProductName(null, null)).toBe('');
        });
    });
});

describe('Financial Record Mappers', () => {
    const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';

    describe('mapFinancialRecordToBackend', () => {
        it('should map FileMaker financial record to backend format', () => {
            const fmRecord = {
                fieldData: {
                    __ID: 'abc123-def456',
                    _custID: 'cust-123',
                    DateStart: '01/15/2026',
                    Billable_Time_Rounded: '5.5',
                    Hourly_Rate: '100.00',
                    'Customers::Name': 'Clarity Business Solutions',
                    'customers_Projects::projectName': 'Development Work',
                    f_billed: '0',
                    '~creationTimestamp': '2026-01-15T10:00:00Z',
                    '~modificationTimestamp': '2026-01-15T12:00:00Z'
                }
            };

            const result = mapFinancialRecordToBackend(fmRecord, mockOrganizationId);

            expect(result).toEqual({
                financial_id: 'abc123-def456',
                organization_id: mockOrganizationId,
                customer_id: 'cust-123',
                product_id: null,
                product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
                quantity: 5.5,
                unit_price: 100.00,
                total_price: 550.00,
                date: '2026-01-15',
                inv_id: null,
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T12:00:00Z',
                configuration_data: null
            });
        });

        it('should map billed status correctly', () => {
            const fmRecordBilled = {
                fieldData: {
                    __ID: 'abc123',
                    _custID: 'cust-123',
                    DateStart: '01/15/2026',
                    Billable_Time_Rounded: '5.5',
                    Hourly_Rate: '100.00',
                    'Customers::Name': 'Test',
                    'customers_Projects::projectName': 'Project',
                    f_billed: '1'
                }
            };

            const result = mapFinancialRecordToBackend(fmRecordBilled, mockOrganizationId);
            expect(result.inv_id).toBe('MIGRATED');
        });

        it('should calculate total price correctly', () => {
            const fmRecord = {
                fieldData: {
                    __ID: 'abc123',
                    _custID: 'cust-123',
                    DateStart: '01/15/2026',
                    Billable_Time_Rounded: '7.33',
                    Hourly_Rate: '125.50',
                    'Customers::Name': 'Test',
                    'customers_Projects::projectName': 'Project',
                    f_billed: '0'
                }
            };

            const result = mapFinancialRecordToBackend(fmRecord, mockOrganizationId);
            expect(result.total_price).toBe(919.92); // 7.33 * 125.50 rounded to 2 decimals
        });
    });

    describe('mapFinancialRecordToFileMaker', () => {
        it('should map backend financial record to FileMaker format', () => {
            const backendRecord = {
                id: 'record-123',
                financial_id: 'abc123-def456',
                customer_id: 'cust-123',
                product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
                quantity: 5.5,
                unit_price: 100.00,
                total_price: 550.00,
                date: '2026-01-15',
                inv_id: null,
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T12:00:00Z'
            };

            const result = mapFinancialRecordToFileMaker(backendRecord);

            expect(result).toEqual({
                recordId: 'record-123',
                fieldData: {
                    __ID: 'abc123-def456',
                    _custID: 'cust-123',
                    DateStart: '01/15/2026',
                    Billable_Time_Rounded: 5.5,
                    Hourly_Rate: 100.00,
                    f_billed: 0,
                    product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
                    '~creationTimestamp': '2026-01-15T10:00:00Z',
                    '~modificationTimestamp': '2026-01-15T12:00:00Z'
                }
            });
        });

        it('should map billed records correctly', () => {
            const backendRecord = {
                id: 'record-123',
                financial_id: 'abc123',
                customer_id: 'cust-123',
                product_name: 'TEST:Project',
                quantity: 5.5,
                unit_price: 100.00,
                total_price: 550.00,
                date: '2026-01-15',
                inv_id: 'QB-12345',
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T12:00:00Z'
            };

            const result = mapFinancialRecordToFileMaker(backendRecord);
            expect(result.fieldData.f_billed).toBe(1);
        });
    });
});

describe('Task Mappers', () => {
    describe('mapTaskToBackend', () => {
        it('should map FileMaker task to backend format', () => {
            const fmTask = {
                fieldData: {
                    __ID: 'task-123',
                    _projectID: 'proj-123',
                    _custID: 'cust-123',
                    _staffID: 'staff-123',
                    task: 'Complete feature',
                    notes: 'Some notes',
                    f_completed: '0',
                    priority: 'high',
                    due_date: '01/20/2026',
                    '~creationTimestamp': '2026-01-15T10:00:00Z',
                    '~modificationTimestamp': '2026-01-15T12:00:00Z'
                }
            };

            const result = mapTaskToBackend(fmTask);

            expect(result).toEqual({
                id: 'task-123',
                project_id: 'proj-123',
                customer_id: 'cust-123',
                staff_id: 'staff-123',
                task: 'Complete feature',
                notes: 'Some notes',
                completed: false,
                priority: 'high',
                due_date: '2026-01-20',
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T12:00:00Z'
            });
        });
    });

    describe('mapTaskToFileMaker', () => {
        it('should map backend task to FileMaker format', () => {
            const backendTask = {
                id: 'task-123',
                project_id: 'proj-123',
                customer_id: 'cust-123',
                staff_id: 'staff-123',
                task: 'Complete feature',
                notes: 'Some notes',
                completed: true,
                priority: 'high',
                due_date: '2026-01-20',
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T12:00:00Z'
            };

            const result = mapTaskToFileMaker(backendTask);

            expect(result.fieldData.f_completed).toBe(1);
            expect(result.fieldData.__ID).toBe('task-123');
            expect(result.fieldData.due_date).toBe('01/20/2026');
        });
    });
});

describe('Timer Mappers', () => {
    describe('mapTimerToBackend', () => {
        it('should map FileMaker timer to backend format', () => {
            const fmTimer = {
                fieldData: {
                    __ID: 'timer-123',
                    _taskID: 'task-123',
                    _staffID: 'staff-123',
                    _projectID: 'proj-123',
                    _custID: 'cust-123',
                    DateStart: '01/15/2026',
                    TimeStart: '10:30:00',
                    TimeEnd: '12:30:00',
                    'Work Performed': 'Developed feature',
                    TimeAdjust: '0',
                    Billable_Time_Rounded: '2.0',
                    '~creationTimestamp': '2026-01-15T10:00:00Z',
                    '~modificationTimestamp': '2026-01-15T12:00:00Z'
                }
            };

            const result = mapTimerToBackend(fmTimer);

            expect(result.id).toBe('timer-123');
            expect(result.start_time).toBe('2026-01-15T10:30:00');
            expect(result.end_time).toBe('2026-01-15T12:30:00');
            expect(result.work_performed).toBe('Developed feature');
            expect(result.billable_time).toBe(2.0);
        });
    });
});

describe('Validation Functions', () => {
    describe('validateFinancialRecord', () => {
        it('should pass validation for valid record', () => {
            const validRecord = {
                financial_id: 'abc123',
                organization_id: 'org-123',
                customer_id: 'cust-123',
                date: '2026-01-15',
                quantity: 5.0,
                unit_price: 100.0,
                total_price: 500.0
            };

            const errors = validateFinancialRecord(validRecord);
            expect(errors).toEqual([]);
        });

        it('should fail validation for missing required fields', () => {
            const invalidRecord = {
                quantity: 5.0,
                unit_price: 100.0,
                total_price: 500.0
            };

            const errors = validateFinancialRecord(invalidRecord);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors).toContain('financial_id is required');
            expect(errors).toContain('organization_id is required');
            expect(errors).toContain('customer_id is required');
            expect(errors).toContain('date is required');
        });

        it('should fail validation for negative values', () => {
            const invalidRecord = {
                financial_id: 'abc123',
                organization_id: 'org-123',
                customer_id: 'cust-123',
                date: '2026-01-15',
                quantity: -5.0,
                unit_price: -100.0,
                total_price: 500.0
            };

            const errors = validateFinancialRecord(invalidRecord);
            expect(errors).toContain('quantity must be non-negative');
            expect(errors).toContain('unit_price must be non-negative');
        });

        it('should fail validation for incorrect total price', () => {
            const invalidRecord = {
                financial_id: 'abc123',
                organization_id: 'org-123',
                customer_id: 'cust-123',
                date: '2026-01-15',
                quantity: 5.0,
                unit_price: 100.0,
                total_price: 600.0 // Should be 500.0
            };

            const errors = validateFinancialRecord(invalidRecord);
            expect(errors.some(e => e.includes('total_price mismatch'))).toBe(true);
        });
    });
});

describe('Batch Mapping Functions', () => {
    const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';

    describe('mapBatchToBackend', () => {
        it('should map array of FileMaker records', () => {
            const fmRecords = [
                {
                    fieldData: {
                        __ID: 'task-1',
                        _projectID: 'proj-1',
                        task: 'Task 1',
                        f_completed: '0'
                    }
                },
                {
                    fieldData: {
                        __ID: 'task-2',
                        _projectID: 'proj-2',
                        task: 'Task 2',
                        f_completed: '1'
                    }
                }
            ];

            const result = mapBatchToBackend(fmRecords, mapTaskToBackend);

            expect(result.length).toBe(2);
            expect(result[0].id).toBe('task-1');
            expect(result[0].completed).toBe(false);
            expect(result[1].id).toBe('task-2');
            expect(result[1].completed).toBe(true);
        });

        it('should handle empty arrays', () => {
            const result = mapBatchToBackend([], mapTaskToBackend);
            expect(result).toEqual([]);
        });

        it('should filter out null results from failed mappings', () => {
            const fmRecords = [
                { fieldData: { __ID: 'task-1', task: 'Valid' } },
                null,
                { fieldData: { __ID: 'task-2', task: 'Valid' } }
            ];

            const result = mapBatchToBackend(fmRecords, (record) => {
                if (!record) throw new Error('Invalid record');
                return mapTaskToBackend(record);
            });

            expect(result.length).toBe(2);
        });
    });

    describe('mapBatchToFileMaker', () => {
        it('should map array of backend records', () => {
            const backendRecords = [
                {
                    id: 'task-1',
                    task: 'Task 1',
                    completed: false
                },
                {
                    id: 'task-2',
                    task: 'Task 2',
                    completed: true
                }
            ];

            const result = mapBatchToFileMaker(backendRecords, mapTaskToFileMaker);

            expect(result.length).toBe(2);
            expect(result[0].recordId).toBe('task-1');
            expect(result[0].fieldData.f_completed).toBe(0);
            expect(result[1].recordId).toBe('task-2');
            expect(result[1].fieldData.f_completed).toBe(1);
        });
    });
});
