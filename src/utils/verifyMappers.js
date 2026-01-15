/**
 * Mapper Verification Script
 *
 * Run with: node src/utils/verifyMappers.js
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
    validateFinancialRecord
} from './dataMappers.js';

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`✅ ${description}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ ${description}`);
        console.error(`   ${error.message}`);
        testsFailed++;
    }
}

function assertEqual(actual, expected, message = '') {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`${message}\n  Expected: ${expectedStr}\n  Got: ${actualStr}`);
    }
}

console.log('\n🧪 Testing Data Mappers\n');
console.log('='.repeat(60));

// Date Conversion Tests
console.log('\n📅 Date Conversion Tests');
console.log('-'.repeat(60));

test('convertDateToISO: MM/DD/YYYY -> YYYY-MM-DD', () => {
    assertEqual(convertDateToISO('01/15/2026'), '2026-01-15');
    assertEqual(convertDateToISO('12/31/2025'), '2025-12-31');
    assertEqual(convertDateToISO('5/3/2026'), '2026-05-03');
});

test('convertDateToISO: handles ISO dates', () => {
    assertEqual(convertDateToISO('2026-01-15'), '2026-01-15');
    assertEqual(convertDateToISO('2026-01-15T10:30:00'), '2026-01-15');
});

test('convertDateToISO: handles invalid dates', () => {
    assertEqual(convertDateToISO(''), null);
    assertEqual(convertDateToISO(null), null);
    assertEqual(convertDateToISO('invalid'), null);
});

test('convertDateToFileMaker: YYYY-MM-DD -> MM/DD/YYYY', () => {
    assertEqual(convertDateToFileMaker('2026-01-15'), '01/15/2026');
    assertEqual(convertDateToFileMaker('2025-12-31'), '12/31/2025');
});

// Boolean Conversion Tests
console.log('\n🔄 Boolean Conversion Tests');
console.log('-'.repeat(60));

test('convertToBoolean: truthy values', () => {
    assertEqual(convertToBoolean('1'), true);
    assertEqual(convertToBoolean(1), true);
    assertEqual(convertToBoolean('true'), true);
    assertEqual(convertToBoolean(true), true);
});

test('convertToBoolean: falsy values', () => {
    assertEqual(convertToBoolean('0'), false);
    assertEqual(convertToBoolean(0), false);
    assertEqual(convertToBoolean(''), false);
    assertEqual(convertToBoolean(null), false);
});

test('convertToFileMakerBoolean: boolean to 0/1', () => {
    assertEqual(convertToFileMakerBoolean(true), 1);
    assertEqual(convertToFileMakerBoolean(false), 0);
});

// Numeric Tests
console.log('\n🔢 Numeric Conversion Tests');
console.log('-'.repeat(60));

test('safeParseFloat: valid numbers', () => {
    assertEqual(safeParseFloat('123.45'), 123.45);
    assertEqual(safeParseFloat(123.45), 123.45);
    assertEqual(safeParseFloat('0'), 0);
});

test('safeParseFloat: invalid values with defaults', () => {
    assertEqual(safeParseFloat(''), 0);
    assertEqual(safeParseFloat(null), 0);
    assertEqual(safeParseFloat('invalid'), 0);
    assertEqual(safeParseFloat('', 100), 100);
});

test('roundToTwoDecimals: rounding', () => {
    assertEqual(roundToTwoDecimals(123.456), 123.46);
    assertEqual(roundToTwoDecimals(123.454), 123.45);
    assertEqual(roundToTwoDecimals(123.5), 123.5);
});

// Product Name Formatting
console.log('\n🏷️  Product Name Formatting Tests');
console.log('-'.repeat(60));

test('formatProductName: standard cases', () => {
    assertEqual(
        formatProductName('Clarity Business Solutions', 'Development Work'),
        'CLARITYBUSINESSSOLUTIONS:Development'
    );
    assertEqual(
        formatProductName('ABC Corporation', 'Website Redesign Project'),
        'ABCCORPORATION:Website'
    );
    assertEqual(
        formatProductName('Smith & Co.', 'Marketing Campaign'),
        'SMITHCO:Marketing'
    );
});

// Financial Record Mapping
console.log('\n💰 Financial Record Mapping Tests');
console.log('-'.repeat(60));

test('mapFinancialRecordToBackend: FileMaker -> Backend', () => {
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

    const result = mapFinancialRecordToBackend(fmRecord, 'org-123');

    assertEqual(result.financial_id, 'abc123-def456');
    assertEqual(result.organization_id, 'org-123');
    assertEqual(result.customer_id, 'cust-123');
    assertEqual(result.product_name, 'CLARITYBUSINESSSOLUTIONS:Development');
    assertEqual(result.quantity, 5.5);
    assertEqual(result.unit_price, 100.00);
    assertEqual(result.total_price, 550.00);
    assertEqual(result.date, '2026-01-15');
    assertEqual(result.inv_id, null);
});

test('mapFinancialRecordToBackend: billed status mapping', () => {
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

    const result = mapFinancialRecordToBackend(fmRecordBilled, 'org-123');
    assertEqual(result.inv_id, 'MIGRATED');
});

test('mapFinancialRecordToBackend: calculates total correctly', () => {
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

    const result = mapFinancialRecordToBackend(fmRecord, 'org-123');
    assertEqual(result.total_price, 919.92); // 7.33 * 125.50 = 919.915 -> 919.92
});

test('mapFinancialRecordToFileMaker: Backend -> FileMaker', () => {
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

    assertEqual(result.recordId, 'record-123');
    assertEqual(result.fieldData.__ID, 'abc123-def456');
    assertEqual(result.fieldData._custID, 'cust-123');
    assertEqual(result.fieldData.DateStart, '01/15/2026');
    assertEqual(result.fieldData.Billable_Time_Rounded, 5.5);
    assertEqual(result.fieldData.Hourly_Rate, 100.00);
    assertEqual(result.fieldData.f_billed, 0);
});

// Task Mapping
console.log('\n📋 Task Mapping Tests');
console.log('-'.repeat(60));

test('mapTaskToBackend: FileMaker -> Backend', () => {
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
            due_date: '01/20/2026'
        }
    };

    const result = mapTaskToBackend(fmTask);

    assertEqual(result.id, 'task-123');
    assertEqual(result.project_id, 'proj-123');
    assertEqual(result.completed, false);
    assertEqual(result.due_date, '2026-01-20');
});

test('mapTaskToFileMaker: Backend -> FileMaker', () => {
    const backendTask = {
        id: 'task-123',
        project_id: 'proj-123',
        customer_id: 'cust-123',
        staff_id: 'staff-123',
        task: 'Complete feature',
        completed: true,
        priority: 'high',
        due_date: '2026-01-20'
    };

    const result = mapTaskToFileMaker(backendTask);

    assertEqual(result.recordId, 'task-123');
    assertEqual(result.fieldData.f_completed, 1);
    assertEqual(result.fieldData.due_date, '01/20/2026');
});

// Timer Mapping
console.log('\n⏱️  Timer Mapping Tests');
console.log('-'.repeat(60));

test('mapTimerToBackend: FileMaker -> Backend', () => {
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
            Billable_Time_Rounded: '2.0'
        }
    };

    const result = mapTimerToBackend(fmTimer);

    assertEqual(result.id, 'timer-123');
    assertEqual(result.task_id, 'task-123');
    assertEqual(result.start_time, '2026-01-15T10:30:00');
    assertEqual(result.end_time, '2026-01-15T12:30:00');
    assertEqual(result.work_performed, 'Developed feature');
    assertEqual(result.billable_time, 2.0);
});

// Validation Tests
console.log('\n✅ Validation Tests');
console.log('-'.repeat(60));

test('validateFinancialRecord: valid record passes', () => {
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
    assertEqual(errors.length, 0, 'Should have no validation errors');
});

test('validateFinancialRecord: missing fields fail', () => {
    const invalidRecord = {
        quantity: 5.0,
        unit_price: 100.0,
        total_price: 500.0
    };

    const errors = validateFinancialRecord(invalidRecord);
    if (errors.length === 0) {
        throw new Error('Should have validation errors for missing fields');
    }
});

test('validateFinancialRecord: negative values fail', () => {
    const invalidRecord = {
        financial_id: 'abc123',
        organization_id: 'org-123',
        customer_id: 'cust-123',
        date: '2026-01-15',
        quantity: -5.0,
        unit_price: 100.0,
        total_price: 500.0
    };

    const errors = validateFinancialRecord(invalidRecord);
    const hasQuantityError = errors.some(e => e.includes('quantity must be non-negative'));
    if (!hasQuantityError) {
        throw new Error('Should have error for negative quantity');
    }
});

test('validateFinancialRecord: incorrect total fails', () => {
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
    const hasTotalError = errors.some(e => e.includes('total_price mismatch'));
    if (!hasTotalError) {
        throw new Error('Should have error for incorrect total_price');
    }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Summary:`);
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   📈 Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}
