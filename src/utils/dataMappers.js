/**
 * Data Mappers - Transform between FileMaker and Backend API data shapes
 *
 * This module provides transformation functions for converting data between:
 * - FileMaker layout format (recordId, fieldData, __ID)
 * - Backend API format (UUID primary keys, snake_case fields)
 *
 * Handles:
 * - ID conversions (recordId/__ID → UUID)
 * - Field name transformations (camelCase ↔ snake_case, custom mappings)
 * - Type conversions (string booleans → real booleans, numeric strings → numbers)
 * - Date format conversions (MM/DD/YYYY ↔ YYYY-MM-DD)
 * - Nested object flattening/expansion
 */

/**
 * Utility Functions
 */

/**
 * Convert date from FileMaker format (MM/DD/YYYY) to ISO format (YYYY-MM-DD)
 * @param {string} dateString - Date in MM/DD/YYYY format
 * @returns {string|null} Date in YYYY-MM-DD format or null if invalid
 */
export function convertDateToISO(dateString) {
    if (!dateString || dateString === '' || dateString === null) {
        return null;
    }

    // Handle already ISO formatted dates
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return dateString.split('T')[0]; // Strip time if present
    }

    const parts = dateString.split('/');
    if (parts.length !== 3) {
        console.warn('[DataMapper] Invalid date format:', dateString);
        return null;
    }

    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];

    // Basic validation
    if (parseInt(month) < 1 || parseInt(month) > 12) {
        console.warn('[DataMapper] Invalid month:', month);
        return null;
    }

    return `${year}-${month}-${day}`;
}

/**
 * Convert date from ISO format (YYYY-MM-DD) to FileMaker format (MM/DD/YYYY)
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string|null} Date in MM/DD/YYYY format or null if invalid
 */
export function convertDateToFileMaker(dateString) {
    if (!dateString || dateString === '' || dateString === null) {
        return null;
    }

    // Handle already FileMaker formatted dates
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dateString)) {
        return dateString;
    }

    const parts = dateString.split('T')[0].split('-');
    if (parts.length !== 3) {
        console.warn('[DataMapper] Invalid ISO date format:', dateString);
        return null;
    }

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    return `${month}/${day}/${year}`;
}

/**
 * Convert string boolean to real boolean
 * @param {string|number|boolean} value - Value to convert
 * @returns {boolean} Boolean value
 */
export function convertToBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === '1' || value === 1 || value === 'true' || value === true) {
        return true;
    }

    return false;
}

/**
 * Convert boolean to FileMaker numeric format (0 or 1)
 * @param {boolean} value - Boolean value
 * @returns {number} 0 or 1
 */
export function convertToFileMakerBoolean(value) {
    return value ? 1 : 0;
}

/**
 * Safely parse float with fallback
 * @param {string|number} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed number or default
 */
export function safeParseFloat(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Round to 2 decimal places
 * @param {number} value - Number to round
 * @returns {number} Rounded number
 */
export function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
}

/**
 * Format product name from customer and project names
 * @param {string} customerName - Customer business name
 * @param {string} projectName - Project name
 * @returns {string} Formatted product name (CUSTOMERCAPS:ProjectFirstWord)
 */
export function formatProductName(customerName, projectName) {
    if (!customerName || !projectName) {
        return '';
    }

    // Convert to uppercase, then extract letters and numbers only
    const customerCaps = customerName.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

    // Get first word of project name
    const projectFirstWord = projectName.split(' ')[0];

    // Combine with colon separator
    return `${customerCaps}:${projectFirstWord}`;
}

/**
 * Financial Records Mappers
 */

/**
 * Map FileMaker financial record to Backend API format
 * @param {Object} fmRecord - FileMaker record with fieldData structure
 * @param {string} organizationId - Organization UUID
 * @returns {Object} Backend API financial record format
 */
export function mapFinancialRecordToBackend(fmRecord, organizationId) {
    const fieldData = fmRecord.fieldData || fmRecord;

    // Extract values with safe fallbacks
    const quantity = safeParseFloat(fieldData.Billable_Time_Rounded || fieldData.quantity, 0);
    const unitPrice = safeParseFloat(
        fieldData.Hourly_Rate || fieldData['Customers::chargeRate'] || fieldData.unit_price,
        0
    );
    const totalPrice = roundToTwoDecimals(quantity * unitPrice);

    // Format product name
    const customerName = fieldData['Customers::Name'] || fieldData.customer_name || '';
    const projectName = fieldData['customers_Projects::projectName'] || fieldData.project_name || '';
    const productName = formatProductName(customerName, projectName);

    // Map billed status
    let invId = null;
    if (fieldData.f_billed === '1' || fieldData.f_billed === 1 || fieldData.f_billed === true) {
        invId = 'MIGRATED';
    } else if (fieldData.inv_id) {
        invId = fieldData.inv_id;
    }

    return {
        financial_id: fieldData.__ID || fieldData.financial_id,
        organization_id: organizationId,
        customer_id: fieldData._custID || fieldData.customer_id,
        product_id: fieldData.product_id || null,
        product_name: productName || fieldData.product_name,
        quantity: roundToTwoDecimals(quantity),
        unit_price: roundToTwoDecimals(unitPrice),
        total_price: totalPrice,
        date: convertDateToISO(fieldData.DateStart || fieldData.date),
        inv_id: invId,
        created_at: fieldData['~creationTimestamp'] || fieldData.created_at || new Date().toISOString(),
        updated_at: fieldData['~modificationTimestamp'] || fieldData.updated_at || new Date().toISOString(),
        configuration_data: fieldData.configuration_data || null
    };
}

/**
 * Map Backend API financial record to FileMaker format
 * @param {Object} backendRecord - Backend API record
 * @returns {Object} FileMaker record format with fieldData
 */
export function mapFinancialRecordToFileMaker(backendRecord) {
    // Determine billed status from inv_id
    const fBilled = backendRecord.inv_id ? 1 : 0;

    return {
        recordId: backendRecord.id,
        fieldData: {
            __ID: backendRecord.financial_id,
            _custID: backendRecord.customer_id,
            DateStart: convertDateToFileMaker(backendRecord.date),
            Billable_Time_Rounded: backendRecord.quantity,
            Hourly_Rate: backendRecord.unit_price,
            f_billed: fBilled,
            product_name: backendRecord.product_name,
            '~creationTimestamp': backendRecord.created_at,
            '~modificationTimestamp': backendRecord.updated_at
        }
    };
}

/**
 * Task Mappers
 */

/**
 * Map FileMaker task to Backend API format
 * @param {Object} fmTask - FileMaker task record
 * @returns {Object} Backend API task format
 */
export function mapTaskToBackend(fmTask) {
    const fieldData = fmTask.fieldData || fmTask;

    return {
        id: fieldData.__ID || fieldData.id,
        project_id: fieldData._projectID || fieldData.project_id,
        customer_id: fieldData._custID || fieldData.customer_id,
        staff_id: fieldData._staffID || fieldData.staff_id,
        task: fieldData.task,
        notes: fieldData.notes,
        completed: convertToBoolean(fieldData.f_completed || fieldData.completed),
        priority: fieldData.priority,
        due_date: convertDateToISO(fieldData.due_date || fieldData.dueDate),
        created_at: fieldData['~creationTimestamp'] || fieldData.created_at,
        updated_at: fieldData['~modificationTimestamp'] || fieldData.updated_at
    };
}

/**
 * Map Backend API task to FileMaker format
 * @param {Object} backendTask - Backend API task
 * @returns {Object} FileMaker task format
 */
export function mapTaskToFileMaker(backendTask) {
    return {
        recordId: backendTask.id,
        fieldData: {
            __ID: backendTask.id,
            _projectID: backendTask.project_id,
            _custID: backendTask.customer_id,
            _staffID: backendTask.staff_id,
            task: backendTask.task,
            notes: backendTask.notes,
            f_completed: convertToFileMakerBoolean(backendTask.completed),
            priority: backendTask.priority,
            due_date: convertDateToFileMaker(backendTask.due_date),
            '~creationTimestamp': backendTask.created_at,
            '~modificationTimestamp': backendTask.updated_at
        }
    };
}

/**
 * Timer/Record Mappers
 */

/**
 * Map FileMaker timer record to Backend API format
 * @param {Object} fmTimer - FileMaker timer/record
 * @returns {Object} Backend API timer format
 */
export function mapTimerToBackend(fmTimer) {
    const fieldData = fmTimer.fieldData || fmTimer;

    // Combine DateStart and TimeStart
    let startTime = null;
    if (fieldData.DateStart && fieldData.TimeStart) {
        const date = convertDateToISO(fieldData.DateStart);
        startTime = `${date}T${fieldData.TimeStart}`;
    }

    // Combine DateStart and TimeEnd (if timer is stopped)
    let endTime = null;
    if (fieldData.DateStart && fieldData.TimeEnd) {
        const date = convertDateToISO(fieldData.DateStart);
        endTime = `${date}T${fieldData.TimeEnd}`;
    }

    return {
        id: fieldData.__ID || fieldData.id,
        task_id: fieldData._taskID || fieldData.task_id,
        staff_id: fieldData._staffID || fieldData.staff_id,
        project_id: fieldData._projectID || fieldData.project_id,
        customer_id: fieldData._custID || fieldData.customer_id,
        start_time: startTime || fieldData.start_time,
        end_time: endTime || fieldData.end_time,
        work_performed: fieldData['Work Performed'] || fieldData.work_performed,
        time_adjust: safeParseFloat(fieldData.TimeAdjust || fieldData.time_adjust, 0),
        billable_time: safeParseFloat(fieldData.Billable_Time_Rounded || fieldData.billable_time, 0),
        created_at: fieldData['~creationTimestamp'] || fieldData.created_at,
        updated_at: fieldData['~modificationTimestamp'] || fieldData.updated_at
    };
}

/**
 * Map Backend API timer to FileMaker format
 * @param {Object} backendTimer - Backend API timer
 * @returns {Object} FileMaker timer format
 */
export function mapTimerToFileMaker(backendTimer) {
    // Extract date and time from ISO timestamps
    let dateStart = null;
    let timeStart = null;
    let timeEnd = null;

    if (backendTimer.start_time) {
        const startDateTime = new Date(backendTimer.start_time);
        dateStart = convertDateToFileMaker(startDateTime.toISOString().split('T')[0]);
        timeStart = startDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    if (backendTimer.end_time) {
        const endDateTime = new Date(backendTimer.end_time);
        timeEnd = endDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    return {
        recordId: backendTimer.id,
        fieldData: {
            __ID: backendTimer.id,
            _taskID: backendTimer.task_id,
            _staffID: backendTimer.staff_id,
            _projectID: backendTimer.project_id,
            _custID: backendTimer.customer_id,
            DateStart: dateStart,
            TimeStart: timeStart,
            TimeEnd: timeEnd,
            'Work Performed': backendTimer.work_performed,
            TimeAdjust: backendTimer.time_adjust,
            Billable_Time_Rounded: backendTimer.billable_time,
            '~creationTimestamp': backendTimer.created_at,
            '~modificationTimestamp': backendTimer.updated_at
        }
    };
}

/**
 * Customer Mappers
 */

/**
 * Map FileMaker customer to Backend API format
 * @param {Object} fmCustomer - FileMaker customer record
 * @returns {Object} Backend API customer format
 */
export function mapCustomerToBackend(fmCustomer) {
    const fieldData = fmCustomer.fieldData || fmCustomer;

    return {
        id: fieldData.__ID || fieldData.id,
        business_name: fieldData.Name || fieldData.business_name,
        contact_name: fieldData.contact_name,
        email: fieldData.email,
        phone: fieldData.phone,
        address: fieldData.address,
        active: convertToBoolean(fieldData.f_active || fieldData.active),
        charge_rate: safeParseFloat(fieldData.chargeRate || fieldData.charge_rate, 0),
        created_at: fieldData['~creationTimestamp'] || fieldData.created_at,
        updated_at: fieldData['~modificationTimestamp'] || fieldData.updated_at
    };
}

/**
 * Map Backend API customer to FileMaker format
 * @param {Object} backendCustomer - Backend API customer
 * @returns {Object} FileMaker customer format
 */
export function mapCustomerToFileMaker(backendCustomer) {
    return {
        recordId: backendCustomer.id,
        fieldData: {
            __ID: backendCustomer.id,
            Name: backendCustomer.business_name,
            contact_name: backendCustomer.contact_name,
            email: backendCustomer.email,
            phone: backendCustomer.phone,
            address: backendCustomer.address,
            f_active: convertToFileMakerBoolean(backendCustomer.active),
            chargeRate: backendCustomer.charge_rate,
            '~creationTimestamp': backendCustomer.created_at,
            '~modificationTimestamp': backendCustomer.updated_at
        }
    };
}

/**
 * Project Mappers
 */

/**
 * Map FileMaker project to Backend API format
 * @param {Object} fmProject - FileMaker project record
 * @returns {Object} Backend API project format
 */
export function mapProjectToBackend(fmProject) {
    const fieldData = fmProject.fieldData || fmProject;

    return {
        id: fieldData.__ID || fieldData.id,
        customer_id: fieldData._custID || fieldData.customer_id,
        team_id: fieldData._teamID || fieldData.team_id,
        project_name: fieldData.projectName || fieldData.project_name,
        description: fieldData.description,
        status: fieldData.status,
        start_date: convertDateToISO(fieldData.start_date || fieldData.startDate),
        end_date: convertDateToISO(fieldData.end_date || fieldData.endDate),
        created_at: fieldData['~creationTimestamp'] || fieldData.created_at,
        updated_at: fieldData['~modificationTimestamp'] || fieldData.updated_at
    };
}

/**
 * Map Backend API project to FileMaker format
 * @param {Object} backendProject - Backend API project
 * @returns {Object} FileMaker project format
 */
export function mapProjectToFileMaker(backendProject) {
    return {
        recordId: backendProject.id,
        fieldData: {
            __ID: backendProject.id,
            _custID: backendProject.customer_id,
            _teamID: backendProject.team_id,
            projectName: backendProject.project_name,
            description: backendProject.description,
            status: backendProject.status,
            start_date: convertDateToFileMaker(backendProject.start_date),
            end_date: convertDateToFileMaker(backendProject.end_date),
            '~creationTimestamp': backendProject.created_at,
            '~modificationTimestamp': backendProject.updated_at
        }
    };
}

/**
 * Batch Mapping Functions
 */

/**
 * Map array of FileMaker records to Backend format
 * @param {Array} fmRecords - Array of FileMaker records
 * @param {Function} mapperFunction - Mapper function to use
 * @param {...any} args - Additional arguments for mapper
 * @returns {Array} Array of Backend records
 */
export function mapBatchToBackend(fmRecords, mapperFunction, ...args) {
    if (!Array.isArray(fmRecords)) {
        console.warn('[DataMapper] mapBatchToBackend received non-array:', fmRecords);
        return [];
    }

    return fmRecords.map(record => {
        try {
            return mapperFunction(record, ...args);
        } catch (error) {
            console.error('[DataMapper] Error mapping record:', error, record);
            return null;
        }
    }).filter(record => record !== null);
}

/**
 * Map array of Backend records to FileMaker format
 * @param {Array} backendRecords - Array of Backend records
 * @param {Function} mapperFunction - Mapper function to use
 * @returns {Array} Array of FileMaker records
 */
export function mapBatchToFileMaker(backendRecords, mapperFunction) {
    if (!Array.isArray(backendRecords)) {
        console.warn('[DataMapper] mapBatchToFileMaker received non-array:', backendRecords);
        return [];
    }

    return backendRecords.map(record => {
        try {
            return mapperFunction(record);
        } catch (error) {
            console.error('[DataMapper] Error mapping record:', error, record);
            return null;
        }
    }).filter(record => record !== null);
}

/**
 * Generic Response Mappers
 */

/**
 * Map FileMaker response to standardized format
 * @param {Object} fmResponse - FileMaker API response
 * @returns {Object} Standardized response format
 */
export function mapFileMakerResponse(fmResponse) {
    if (!fmResponse || !fmResponse.response) {
        console.warn('[DataMapper] Invalid FileMaker response:', fmResponse);
        return {
            data: [],
            error: null,
            metadata: {}
        };
    }

    return {
        data: fmResponse.response.data || [],
        error: fmResponse.messages?.[0]?.code !== '0' ? fmResponse.messages : null,
        metadata: {
            dataInfo: fmResponse.response.dataInfo || {},
            recordId: fmResponse.response.recordId
        }
    };
}

/**
 * Map Backend API response to standardized format
 * @param {Object} backendResponse - Backend API response
 * @returns {Object} Standardized response format
 */
export function mapBackendResponse(backendResponse) {
    // Backend responses are typically already in good shape
    // but we standardize the structure
    return {
        data: backendResponse.data || backendResponse,
        error: backendResponse.error || null,
        metadata: {
            count: backendResponse.count,
            total: backendResponse.total
        }
    };
}

/**
 * Validation Helpers
 */

/**
 * Validate financial record data
 * @param {Object} record - Financial record to validate
 * @returns {Array<string>} Array of validation errors (empty if valid)
 */
export function validateFinancialRecord(record) {
    const errors = [];

    if (!record.financial_id) errors.push('financial_id is required');
    if (!record.organization_id) errors.push('organization_id is required');
    if (!record.customer_id) errors.push('customer_id is required');
    if (!record.date) errors.push('date is required');
    if (record.quantity == null) errors.push('quantity is required');
    if (record.unit_price == null) errors.push('unit_price is required');
    if (record.total_price == null) errors.push('total_price is required');

    if (record.quantity < 0) errors.push('quantity must be non-negative');
    if (record.unit_price < 0) errors.push('unit_price must be non-negative');

    // Validate total price calculation
    const expectedTotal = roundToTwoDecimals(record.quantity * record.unit_price);
    const actualTotal = roundToTwoDecimals(record.total_price);
    if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        errors.push(`total_price mismatch: expected ${expectedTotal}, got ${actualTotal}`);
    }

    return errors;
}

/**
 * Export all mapper functions
 */
export default {
    // Utility functions
    convertDateToISO,
    convertDateToFileMaker,
    convertToBoolean,
    convertToFileMakerBoolean,
    safeParseFloat,
    roundToTwoDecimals,
    formatProductName,

    // Financial record mappers
    mapFinancialRecordToBackend,
    mapFinancialRecordToFileMaker,

    // Task mappers
    mapTaskToBackend,
    mapTaskToFileMaker,

    // Timer mappers
    mapTimerToBackend,
    mapTimerToFileMaker,

    // Customer mappers
    mapCustomerToBackend,
    mapCustomerToFileMaker,

    // Project mappers
    mapProjectToBackend,
    mapProjectToFileMaker,

    // Batch mappers
    mapBatchToBackend,
    mapBatchToFileMaker,

    // Response mappers
    mapFileMakerResponse,
    mapBackendResponse,

    // Validation
    validateFinancialRecord
};
