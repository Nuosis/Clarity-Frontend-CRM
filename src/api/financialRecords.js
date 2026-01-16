/**
 * Financial Records API Client
 *
 * This module provides access to financial records (customer billing/sales) via Backend API.
 * All operations use environment-aware routing through dataService.
 *
 * Backend API Endpoints:
 * - GET /api/financial-records/query: Query with filters (date range, customer, billing status)
 * - GET /api/financial-records/unpaid: Unbilled records query
 * - GET /api/financial-records/summary/monthly: Monthly aggregations
 * - GET /api/financial-records/summary/quarterly: Quarterly aggregations
 * - GET /api/financial-records/summary/yearly: Yearly aggregations
 * - POST /api/financial-records/create: Create new record
 * - PATCH /api/financial-records/mark-billed: Bulk billing update
 *
 * Migration Status:
 * - ✅ Migrated from Supabase RPC to Backend API (TSK0009)
 * - ✅ Environment-aware routing via dataService
 * - ✅ HMAC authentication for backend requests
 * - ✅ Organization scoping via JWT
 */

import { dataService, getOrganizationId, hasOrganizationContext } from '../services/dataService';
import { convertSupabaseToFileMaker } from '../utils/dateUtils';

/**
 * Helper function to validate required parameters
 * @param {Object} params - Parameters to validate
 * @param {Array} required - Required parameter names
 * @throws {Error} If a required parameter is missing
 */
function validateParams(params, required) {
    for (const param of required) {
        if (params[param] === undefined || params[param] === null) {
            throw new Error(`Missing required parameter: ${param}`);
        }
    }
}

/**
 * Helper function to get organization ID with validation
 * @returns {string} Organization ID
 * @throws {Error} If organization context is missing
 */
function getRequiredOrganizationId() {
    if (!hasOrganizationContext()) {
        throw new Error('Organization context is required for financial records operations');
    }
    const orgId = getOrganizationId();
    if (!orgId) {
        throw new Error('Organization ID is missing from context');
    }
    return orgId;
}

// Date conversion function imported from dateUtils
// convertSupabaseToFileMaker: YYYY-MM-DD → MM/DD/YYYY (UI compatibility)

/**
 * Helper function to get current date information
 * @returns {Object} Object containing current date, week, month, quarter, and year
 */
function getCurrentDateInfo() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString(); // JavaScript months are 0-indexed
    const year = now.getFullYear().toString();
    const quarter = Math.ceil((now.getMonth() + 1) / 3).toString();

    // Get current date in YYYY-MM-DD format
    const date = now.toISOString().split('T')[0];

    // Get current week number
    // ISO week starts on Monday, so we need to adjust
    const dayOfWeek = now.getDay() || 7; // Convert Sunday (0) to 7
    const thursdayDate = new Date(now);
    thursdayDate.setDate(now.getDate() - dayOfWeek + 4); // Find the Thursday of this week
    const firstDayOfYear = new Date(thursdayDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((thursdayDate - firstDayOfYear) / 86400000) + 1) / 7);

    return {
        date,
        week: weekNumber.toString(),
        month,
        year,
        quarter
    };
}

/**
 * Helper function to get last month's date information
 * @returns {Object} Object containing last month and its year
 */
function getLastMonthInfo() {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const month = (now.getMonth() + 1).toString(); // JavaScript months are 0-indexed
    const year = now.getFullYear().toString();

    return { month, year };
}

/**
 * Helper function to normalize Backend API response to expected format
 * Transforms backend API FinancialRecordResponse schema to legacy field structure
 * for backward compatibility with existing service layer (billableHoursService.js)
 * @param {Array} records - Backend API response records (FinancialRecordResponse[])
 * @returns {Object} Normalized response with fieldData wrapper
 */
function normalizeFinancialRecords(records) {
    if (!records || !Array.isArray(records)) {
        return {
            response: {
                data: []
            }
        };
    }

    // Transform each record to legacy fieldData structure expected by billableHoursService
    const transformedRecords = records.map(record => ({
        // Legacy fieldData wrapper for backward compatibility with existing services
        fieldData: {
            __ID: record.financial_id, // Legacy field name (UUID)
            _custID: record.customer_id, // Customer UUID
            _projectID: record.project_id || null, // Project UUID (now supported in backend API)
            DateStart: convertSupabaseToFileMaker(record.date), // UI expects MM/DD/YYYY format
            Billable_Time_Rounded: parseFloat(record.quantity) || 0, // Backend returns string
            Hourly_Rate: parseFloat(record.unit_price) || 0, // Backend returns string
            'Customers::Name': null, // Not included in backend response (requires join)
            f_billed: record.inv_id ? 1 : 0, // Legacy billed flag (0 = unbilled, 1 = billed)
            product_name: record.product_name,
            total_price: parseFloat(record.total_price) || 0, // Backend returns string
            // Include backend native fields for components that can use them directly
            financial_id: record.financial_id,
            inv_id: record.inv_id,
            billing_status: record.billing_status, // 'billed' | 'unbilled'
            created_at: record.created_at,
            updated_at: record.updated_at,
            time_entry_id: record.time_entry_id, // New field from backend
            configuration_data: record.configuration_data // New field from backend
        },
        recordId: record.id // Backend record ID (UUID) for updates
    }));

    return {
        response: {
            data: transformedRecords
        }
    };
}

/**
 * Fetches financial records based on timeframe and optional filters
 * @param {string} timeframe - The timeframe to fetch ("today", "thisWeek", "thisMonth", "unpaid", "lastMonth", "thisQuarter", "thisYear")
 * @param {string} customerId - Optional customer ID to filter by
 * @param {string} projectId - Optional project ID to filter by (now supported in backend API)
 * @returns {Promise} Promise resolving to the financial records data
 */
export async function fetchFinancialRecords(timeframe, customerId = null, projectId = null) {
    validateParams({ timeframe }, ['timeframe']);

    try {
        let startDate = null;
        let endDate = null;
        let billedOnly = null;

        const now = new Date();
        const currentYear = now.getFullYear();

        switch (timeframe.toLowerCase()) {
            case 'today': {
                const today = now.toISOString().split('T')[0];
                startDate = today;
                endDate = today;
                break;
            }
            case 'thisweek': {
                // Get start of week (Monday)
                const dayOfWeek = now.getDay() || 7; // Sunday = 7
                const mondayDate = new Date(now);
                mondayDate.setDate(now.getDate() - dayOfWeek + 1);
                startDate = mondayDate.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
                break;
            }
            case 'thismonth': {
                const { month, year } = getCurrentDateInfo();
                startDate = `${year}-${month.padStart(2, '0')}-01`;

                // Last day of month
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                break;
            }
            case 'unpaid': {
                billedOnly = false; // Only unbilled records
                break;
            }
            case 'lastmonth': {
                const { month, year } = getLastMonthInfo();
                startDate = `${year}-${month.padStart(2, '0')}-01`;

                // Last day of month
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                break;
            }
            case 'thisquarter': {
                // Get current quarter
                const currentMonth = now.getMonth() + 1; // 1-12

                // Calculate the last three completed months
                const lastThreeMonths = [];
                for (let i = 1; i <= 3; i++) {
                    let month = currentMonth - i;
                    let year = currentYear;

                    if (month <= 0) {
                        month += 12;
                        year -= 1;
                    }

                    lastThreeMonths.push({ month, year });
                }

                // Get the earliest date (start of oldest month)
                const earliestMonth = lastThreeMonths[lastThreeMonths.length - 1];
                startDate = `${earliestMonth.year}-${earliestMonth.month.toString().padStart(2, '0')}-01`;

                // Get the latest date (end of most recent month)
                const latestMonth = lastThreeMonths[0];
                const lastDay = new Date(latestMonth.year, latestMonth.month, 0).getDate();
                endDate = `${latestMonth.year}-${latestMonth.month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

                console.log('[FinancialRecords] Quarter range:', { startDate, endDate, lastThreeMonths });
                break;
            }
            case 'thisyear': {
                // Current year + last year
                startDate = `${currentYear - 1}-01-01`;
                endDate = `${currentYear}-12-31`;
                break;
            }
            default:
                throw new Error(`Invalid timeframe: ${timeframe}`);
        }

        // Build query parameters for backend API
        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (customerId) params.customer_id = customerId;
        if (projectId) params.project_id = projectId;
        if (billedOnly !== null) params.billed_only = billedOnly;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/query', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for timeframe: ${timeframe}`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching financial records:', error);
        throw error;
    }
}

/**
 * Fetches unpaid financial records for a customer
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the unpaid financial records data
 */
export async function fetchUnpaidRecords(customerId = null) {
    try {
        // Build query parameters for backend API
        const params = {};
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/unpaid', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} unpaid records`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching unpaid records:', error);
        throw error;
    }
}

/**
 * Fetches records for a specific month
 * @param {string} month - The month (1-12)
 * @param {string} year - The year
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the monthly financial records data
 */
export async function fetchMonthlyRecords(month, year, customerId = null) {
    validateParams({ month, year }, ['month', 'year']);

    try {
        const startDate = `${year}-${month.padStart(2, '0')}-01`;

        // Last day of month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        // Build query parameters for backend API
        const params = {
            start_date: startDate,
            end_date: endDate
        };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/query', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for month ${month}/${year}`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching monthly records:', error);
        throw error;
    }
}

/**
 * Fetches records for a specific quarter
 * @param {string} quarter - The quarter (1-4)
 * @param {string} year - The year
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the quarterly financial records data
 */
export async function fetchQuarterlyRecords(quarter, year, customerId = null) {
    validateParams({ quarter, year }, ['quarter', 'year']);

    try {
        const quarterNum = parseInt(quarter);
        if (quarterNum < 1 || quarterNum > 4) {
            throw new Error('Quarter must be between 1 and 4');
        }

        // Calculate quarter date range
        const startMonth = (quarterNum - 1) * 3 + 1;
        const endMonth = startMonth + 2;

        const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(year), endMonth, 0).getDate();
        const endDate = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        // Build query parameters for backend API
        const params = {
            start_date: startDate,
            end_date: endDate
        };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/query', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for Q${quarter} ${year}`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching quarterly records:', error);
        throw error;
    }
}

/**
 * Fetches records for a specific year
 * @param {string} year - The year
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the yearly financial records data
 */
export async function fetchYearlyRecords(year, customerId = null) {
    validateParams({ year }, ['year']);

    try {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Build query parameters for backend API
        const params = {
            start_date: startDate,
            end_date: endDate
        };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/query', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for year ${year}`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching yearly records:', error);
        throw error;
    }
}

/**
 * Fetches a financial record by its recordId (Backend record ID / UUID)
 * @deprecated Backend API doesn't have a specific get-by-ID endpoint. Use fetchRecordsForDateRange or fetchFinancialRecords instead.
 * @param {string} recordId - The backend record ID (UUID) of the record to fetch
 * @returns {Promise} Promise resolving to the financial record data
 */
export async function fetchFinancialRecordByRecordId(recordId) {
    console.warn('[FinancialRecords] fetchFinancialRecordByRecordId is deprecated. Consider using fetchRecordsForDateRange or fetchFinancialRecords instead.');
    validateParams({ recordId }, ['recordId']);

    try {
        // Backend API doesn't have a specific get-by-ID endpoint
        // Fetch all records and filter client-side (not efficient, but maintains backward compatibility)
        const allRecords = await dataService.get('/api/financial-records/query', {});

        // Filter by recordId (backend record ID)
        const matchingRecords = allRecords.filter(r => r.id === recordId);

        if (matchingRecords.length === 0) {
            console.warn(`[FinancialRecords] Record not found: ${recordId}`);
            return normalizeFinancialRecords([]);
        }

        return normalizeFinancialRecords(matchingRecords);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching financial record by recordId:', error);
        throw error;
    }
}

/**
 * Fetches a financial record by its UUID (financial_id field)
 * @deprecated Backend API doesn't have a specific get-by-ID endpoint. Use fetchRecordsForDateRange or fetchFinancialRecords instead.
 * @param {string} financialId - The UUID (financial_id) of the record to fetch
 * @returns {Promise} Promise resolving to the financial record data
 */
export async function fetchFinancialRecordByUUID(financialId) {
    console.warn('[FinancialRecords] fetchFinancialRecordByUUID is deprecated. Consider using fetchRecordsForDateRange or fetchFinancialRecords instead.');
    validateParams({ financialId }, ['financialId']);

    try {
        // Backend API doesn't have a specific get-by-ID endpoint
        // Fetch all records and filter client-side (not efficient, but maintains backward compatibility)
        const allRecords = await dataService.get('/api/financial-records/query', {});

        // Filter by financial_id
        const matchingRecords = allRecords.filter(r => r.financial_id === financialId);

        if (matchingRecords.length === 0) {
            console.warn(`[FinancialRecords] Record not found: ${financialId}`);
            return normalizeFinancialRecords([]);
        }

        return normalizeFinancialRecords(matchingRecords);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching financial record by UUID:', error);
        throw error;
    }
}

/**
 * Updates the billed status for a financial record by its recordId (Backend record ID)
 * Uses backend API mark-billed endpoint to set invoice ID
 * @param {string} recordId - The backend record ID (UUID) of the record to update
 * @param {number} billedStatus - The billed status (0 = not billed, 1 = billed)
 * @returns {Promise} Promise resolving to the update result
 */
export async function updateFinancialRecordBilledStatus(recordId, billedStatus = 1) {
    validateParams({ recordId, billedStatus }, ['recordId', 'billedStatus']);

    try {
        // Convert billedStatus to invoice ID
        const invoiceId = billedStatus === 1 ? 'BILLED' : 'UNBILLED';

        // Build request body for backend API
        const requestBody = {
            record_ids: [recordId],
            invoice_id: invoiceId
        };

        // Call backend API via dataService
        const data = await dataService.patch('/api/financial-records/mark-billed', requestBody);

        console.log('[FinancialRecords] Updated billed status for record:', recordId, 'response:', data);

        // Return in legacy format for backward compatibility
        return {
            response: {
                modId: '1',
                recordId: recordId
            }
        };

    } catch (error) {
        console.error('[FinancialRecords] Error updating billed status:', error);
        throw error;
    }
}

/**
 * Updates the billed status for multiple financial records in bulk
 * Uses backend API mark-billed endpoint
 * @param {Array} recordIds - Array of backend record IDs (UUIDs) to update
 * @param {number} billedStatus - The billed status (0 = not billed, 1 = billed)
 * @returns {Promise} Promise resolving to the bulk update results
 */
export async function bulkUpdateFinancialRecordsBilledStatus(recordIds, billedStatus = 1) {
    validateParams({ recordIds, billedStatus }, ['recordIds', 'billedStatus']);

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
        throw new Error('recordIds must be a non-empty array');
    }

    try {
        // Convert billedStatus to invoice ID
        const invoiceId = billedStatus === 1 ? 'BILLED' : 'UNBILLED';

        // Build request body for backend API
        const requestBody = {
            record_ids: recordIds,
            invoice_id: invoiceId
        };

        // Call backend API via dataService
        const data = await dataService.patch('/api/financial-records/mark-billed', requestBody);

        const updatedCount = Array.isArray(data) ? data.length : 0;
        console.log(`[FinancialRecords] Bulk updated ${updatedCount} records as ${billedStatus === 1 ? 'billed' : 'unbilled'}`);

        // Return in legacy format for backward compatibility
        return {
            success: updatedCount === recordIds.length,
            totalRecords: recordIds.length,
            successCount: updatedCount,
            errorCount: recordIds.length - updatedCount,
            results: recordIds.map((id, index) => ({
                recordId: id,
                success: index < updatedCount,
                result: index < updatedCount ? data[index] : null
            })),
            errors: []
        };

    } catch (error) {
        console.error('[FinancialRecords] Error in bulk update:', error);
        throw error;
    }
}

/**
 * Fetches financial records for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise} Promise resolving to the financial records data
 */
export async function fetchRecordsForDateRange(startDate, endDate) {
    validateParams({ startDate, endDate }, ['startDate', 'endDate']);

    try {
        console.log(`[FinancialRecords] Fetching records for date range: ${startDate} to ${endDate}`);

        // Build query parameters for backend API
        const params = {
            start_date: startDate,
            end_date: endDate
        };

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/query', params);

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for date range`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching records for date range:', error);
        throw error;
    }
}

/**
 * Creates a new financial record using Backend API
 * @param {Object} params - Financial record parameters
 * @param {string} params.financialId - Unique identifier (UUID v4)
 * @param {string} params.customerId - Customer foreign key (UUID)
 * @param {string} params.productName - Product/service name (format: CUSTOMERCAPS:ProjectFirstWord)
 * @param {number} params.quantity - Billable hours (must be >= 0)
 * @param {number} params.unitPrice - Hourly rate (must be >= 0)
 * @param {string} params.date - Record date in YYYY-MM-DD format
 * @param {string} [params.productId=null] - Optional product foreign key (UUID)
 * @param {string} [params.projectId=null] - Optional project foreign key (UUID)
 * @returns {Promise<Object>} Promise resolving to the created financial record
 */
export async function createFinancialRecord(params) {
    validateParams(
        params,
        ['financialId', 'customerId', 'productName', 'quantity', 'unitPrice', 'date']
    );

    // Validation
    if (!params.productName || params.productName.trim() === '') {
        throw new Error('Product name is required and cannot be empty');
    }

    if (params.quantity < 0) {
        throw new Error('Quantity cannot be negative');
    }

    if (params.unitPrice < 0) {
        throw new Error('Unit price cannot be negative');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.date)) {
        throw new Error('Date must be in YYYY-MM-DD format');
    }

    try {
        console.log('[FinancialRecords] Creating financial record:', {
            financial_id: params.financialId,
            customer_id: params.customerId,
            product_name: params.productName,
            quantity: params.quantity,
            unit_price: params.unitPrice,
            date: params.date
        });

        // Build request body for backend API
        const requestBody = {
            financial_id: params.financialId,
            customer_id: params.customerId,
            product_name: params.productName,
            quantity: params.quantity.toString(), // Backend expects string
            unit_price: params.unitPrice.toString(), // Backend expects string
            date: params.date,
            product_id: params.productId || null,
            project_id: params.projectId || null
        };

        // Call backend API via dataService
        const data = await dataService.post('/api/financial-records/create', requestBody);

        console.log('[FinancialRecords] Financial record created successfully:', data);

        return data; // Returns the created FinancialRecordResponse object

    } catch (error) {
        console.error('[FinancialRecords] Error creating financial record:', error);
        throw error;
    }
}

/**
 * Fetches monthly summary aggregations for a given year
 * @param {number} year - The year to query (e.g., 2026)
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to monthly summary data
 */
export async function fetchMonthlySummary(year, customerId = null) {
    validateParams({ year }, ['year']);

    try {
        // Build query parameters for backend API
        const params = { year: parseInt(year, 10) };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/summary/monthly', params);

        console.log(`[FinancialRecords] Fetched monthly summary for year ${year}: ${data?.length || 0} months`);

        return data;

    } catch (error) {
        console.error('[FinancialRecords] Error fetching monthly summary:', error);
        throw error;
    }
}

/**
 * Fetches quarterly summary aggregations
 * @param {number} year - The year to query
 * @param {number} quarter - The quarter number (1-4)
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to quarterly summary data
 */
export async function fetchQuarterlySummary(year, quarter, customerId = null) {
    validateParams({ year, quarter }, ['year', 'quarter']);

    try {
        const quarterNum = parseInt(quarter, 10);
        if (quarterNum < 1 || quarterNum > 4) {
            throw new Error('Quarter must be between 1 and 4');
        }

        // Build query parameters for backend API
        const params = {
            year: parseInt(year, 10),
            quarter: quarterNum
        };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/summary/quarterly', params);

        console.log(`[FinancialRecords] Fetched quarterly summary for Q${quarter} ${year}`);

        return data;

    } catch (error) {
        console.error('[FinancialRecords] Error fetching quarterly summary:', error);
        throw error;
    }
}

/**
 * Fetches yearly summary aggregations
 * @param {number} year - The year to query
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to yearly summary data
 */
export async function fetchYearlySummary(year, customerId = null) {
    validateParams({ year }, ['year']);

    try {
        // Build query parameters for backend API
        const params = { year: parseInt(year, 10) };
        if (customerId) params.customer_id = customerId;

        // Call backend API via dataService
        const data = await dataService.get('/api/financial-records/summary/yearly', params);

        console.log(`[FinancialRecords] Fetched yearly summary for ${year}`);

        return data;

    } catch (error) {
        console.error('[FinancialRecords] Error fetching yearly summary:', error);
        throw error;
    }
}
