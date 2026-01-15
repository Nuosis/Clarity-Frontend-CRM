/**
 * Financial Records API Client
 *
 * This module provides access to financial records (customer billing/sales) via Supabase RPCs.
 * All operations use Supabase as the single source of truth.
 *
 * Key RPC Functions:
 * - get_financial_records: Query with filters (date range, customer, billing status)
 * - get_unpaid_records: Unbilled records query
 * - get_monthly_summary: Monthly aggregations
 * - get_quarterly_summary: Quarterly aggregations
 * - get_yearly_summary: Yearly aggregations
 * - create_financial_record: Create new record
 * - mark_records_billed: Bulk billing update
 */

import { getSupabaseClient } from '../services/supabaseService';
import { getOrganizationId, hasOrganizationContext } from '../services/dataService';
import { convertSupabaseToFileMaker, convertFileMakerToSupabase } from '../utils/dateUtils';

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

// Date conversion functions are now imported from dateUtils
// convertSupabaseToFileMaker: YYYY-MM-DD → MM/DD/YYYY
// convertFileMakerToSupabase: MM/DD/YYYY → YYYY-MM-DD

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
 * Helper function to normalize Supabase RPC response to expected format
 * Transforms Supabase customer_sales schema to match FileMaker response shape for backward compatibility
 * @param {Array} records - Supabase RPC response records
 * @returns {Object} Normalized response matching FileMaker format
 */
function normalizeFinancialRecords(records) {
    if (!records || !Array.isArray(records)) {
        return {
            response: {
                data: []
            }
        };
    }

    // Transform each record from Supabase format to FileMaker-compatible format
    const transformedRecords = records.map(record => ({
        // FileMaker compatibility wrapper
        fieldData: {
            __ID: record.financial_id, // Map financial_id to __ID for backward compatibility
            _custID: record.customer_id,
            _projectID: null, // Supabase schema doesn't have project_id
            DateStart: convertSupabaseToFileMaker(record.date), // Convert YYYY-MM-DD to MM/DD/YYYY
            Billable_Time_Rounded: record.quantity,
            Hourly_Rate: record.unit_price,
            'Customers::Name': record.customer_name,
            f_billed: record.inv_id ? 1 : 0, // Convert inv_id to f_billed (0 = unbilled, 1 = billed)
            product_name: record.product_name,
            total_price: record.total_price,
            // Additional Supabase fields
            financial_id: record.financial_id,
            inv_id: record.inv_id,
            created_at: record.created_at,
            updated_at: record.updated_at
        },
        recordId: record.id // Supabase id for updates
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
 * @param {string} projectId - Optional project ID to filter by (ignored - not supported in Supabase schema)
 * @returns {Promise} Promise resolving to the financial records data
 */
export async function fetchFinancialRecords(timeframe, customerId = null, projectId = null) {
    validateParams({ timeframe }, ['timeframe']);

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    if (projectId) {
        console.warn('[FinancialRecords] projectId filtering is not supported in Supabase schema - ignoring parameter');
    }

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

        // Call get_financial_records RPC
        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_customer_id: customerId || null,
            p_billed_only: billedOnly
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch financial records: ${error.message}`);
        }

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
    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const { data, error } = await supabase.rpc('get_unpaid_records', {
            p_organization_id: organizationId,
            p_customer_id: customerId || null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch unpaid records: ${error.message}`);
        }

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const startDate = `${year}-${month.padStart(2, '0')}-01`;

        // Last day of month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_customer_id: customerId || null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch monthly records: ${error.message}`);
        }

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

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

        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_customer_id: customerId || null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch quarterly records: ${error.message}`);
        }

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_customer_id: customerId || null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch yearly records: ${error.message}`);
        }

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for year ${year}`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching yearly records:', error);
        throw error;
    }
}

/**
 * Fetches a financial record by its recordId (Supabase id)
 * @param {string} recordId - The Supabase id of the record to fetch
 * @returns {Promise} Promise resolving to the financial record data
 */
export async function fetchFinancialRecordByRecordId(recordId) {
    validateParams({ recordId }, ['recordId']);

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        // Use get_financial_records without date filters, then filter by id in JS
        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: null,
            p_end_date: null,
            p_customer_id: null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch financial record: ${error.message}`);
        }

        // Filter by recordId (Supabase id)
        const record = data?.find(r => r.id === recordId);

        if (!record) {
            console.warn(`[FinancialRecords] Record not found: ${recordId}`);
            return normalizeFinancialRecords([]);
        }

        return normalizeFinancialRecords([record]);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching financial record by recordId:', error);
        throw error;
    }
}

/**
 * Fetches a financial record by its UUID (financial_id field)
 * @param {string} financialId - The UUID (financial_id) of the record to fetch
 * @returns {Promise} Promise resolving to the financial record data
 */
export async function fetchFinancialRecordByUUID(financialId) {
    validateParams({ financialId }, ['financialId']);

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        // Use get_financial_records without date filters, then filter by financial_id in JS
        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: null,
            p_end_date: null,
            p_customer_id: null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch financial record: ${error.message}`);
        }

        // Filter by financial_id
        const record = data?.find(r => r.financial_id === financialId);

        if (!record) {
            console.warn(`[FinancialRecords] Record not found: ${financialId}`);
            return normalizeFinancialRecords([]);
        }

        return normalizeFinancialRecords([record]);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching financial record by UUID:', error);
        throw error;
    }
}

/**
 * Updates the billed status for a financial record by its recordId (Supabase id)
 * Uses mark_records_billed RPC to set invoice ID
 * @param {string} recordId - The Supabase id of the record to update
 * @param {number} billedStatus - The billed status (0 = not billed, 1 = billed)
 * @returns {Promise} Promise resolving to the update result
 */
export async function updateFinancialRecordBilledStatus(recordId, billedStatus = 1) {
    validateParams({ recordId, billedStatus }, ['recordId', 'billedStatus']);

    const supabase = getSupabaseClient();

    try {
        // Convert billedStatus to invoice ID
        const invoiceId = billedStatus === 1 ? 'BILLED' : null;

        if (invoiceId === null) {
            // To mark as unbilled, set inv_id to NULL
            const { data, error } = await supabase
                .from('customer_sales')
                .update({ inv_id: null, updated_at: new Date().toISOString() })
                .eq('id', recordId)
                .select();

            if (error) {
                console.error('[FinancialRecords] Update error:', error);
                throw new Error(`Failed to update billed status: ${error.message}`);
            }

            console.log('[FinancialRecords] Marked record as unbilled:', recordId);

            return {
                response: {
                    modId: '1',
                    recordId: recordId
                }
            };
        }

        // Use mark_records_billed RPC for setting invoiceId
        const { data, error } = await supabase.rpc('mark_records_billed', {
            p_record_ids: [recordId],
            p_invoice_id: invoiceId
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to update billed status: ${error.message}`);
        }

        console.log('[FinancialRecords] Updated billed status for record:', recordId, 'affected:', data);

        return {
            response: {
                modId: data.toString(),
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
 * Uses mark_records_billed RPC
 * @param {Array} recordIds - Array of Supabase ids to update
 * @param {number} billedStatus - The billed status (0 = not billed, 1 = billed)
 * @returns {Promise} Promise resolving to the bulk update results
 */
export async function bulkUpdateFinancialRecordsBilledStatus(recordIds, billedStatus = 1) {
    validateParams({ recordIds, billedStatus }, ['recordIds', 'billedStatus']);

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
        throw new Error('recordIds must be a non-empty array');
    }

    const supabase = getSupabaseClient();

    try {
        // Convert billedStatus to invoice ID
        const invoiceId = billedStatus === 1 ? 'BILLED' : null;

        if (invoiceId === null) {
            // To mark as unbilled, set inv_id to NULL
            const { data, error } = await supabase
                .from('customer_sales')
                .update({ inv_id: null, updated_at: new Date().toISOString() })
                .in('id', recordIds)
                .select();

            if (error) {
                console.error('[FinancialRecords] Bulk update error:', error);
                throw new Error(`Failed to bulk update billed status: ${error.message}`);
            }

            const updatedCount = data?.length || 0;
            console.log(`[FinancialRecords] Marked ${updatedCount} records as unbilled`);

            return {
                success: true,
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
        }

        // Use mark_records_billed RPC
        const { data, error } = await supabase.rpc('mark_records_billed', {
            p_record_ids: recordIds,
            p_invoice_id: invoiceId
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to bulk update billed status: ${error.message}`);
        }

        const updatedCount = data || 0;
        console.log(`[FinancialRecords] Bulk updated ${updatedCount} records as billed`);

        return {
            success: updatedCount === recordIds.length,
            totalRecords: recordIds.length,
            successCount: updatedCount,
            errorCount: recordIds.length - updatedCount,
            results: recordIds.map((id, index) => ({
                recordId: id,
                success: index < updatedCount,
                result: { recordId: id, modId: '1' }
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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        console.log(`[FinancialRecords] Fetching records for date range: ${startDate} to ${endDate}`);

        const { data, error } = await supabase.rpc('get_financial_records', {
            p_organization_id: organizationId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_customer_id: null,
            p_billed_only: null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch records for date range: ${error.message}`);
        }

        console.log(`[FinancialRecords] Fetched ${data?.length || 0} records for date range`);

        return normalizeFinancialRecords(data);

    } catch (error) {
        console.error('[FinancialRecords] Error fetching records for date range:', error);
        throw error;
    }
}

/**
 * Creates a new financial record using Supabase RPC
 * @param {Object} params - Financial record parameters
 * @param {string} params.financialId - Unique identifier (UUID v4)
 * @param {string} params.customerId - Customer foreign key (UUID)
 * @param {string} params.productName - Product/service name (format: CUSTOMERCAPS:ProjectFirstWord)
 * @param {number} params.quantity - Billable hours (must be > 0)
 * @param {number} params.unitPrice - Hourly rate (must be >= 0)
 * @param {string} params.date - Record date in YYYY-MM-DD format
 * @param {string} [params.productId=null] - Optional product foreign key (UUID)
 * @returns {Promise<string>} Promise resolving to the created record's ID (UUID)
 */
export async function createFinancialRecord(params) {
    validateParams(
        params,
        ['financialId', 'customerId', 'productName', 'quantity', 'unitPrice', 'date']
    );

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    // Validation
    if (!params.productName || params.productName.trim() === '') {
        throw new Error('Product name is required and cannot be empty');
    }

    if (params.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
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

        const { data, error } = await supabase.rpc('create_financial_record', {
            p_financial_id: params.financialId,
            p_organization_id: organizationId,
            p_customer_id: params.customerId,
            p_product_name: params.productName,
            p_quantity: params.quantity,
            p_unit_price: params.unitPrice,
            p_date: params.date,
            p_product_id: params.productId || null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to create financial record: ${error.message}`);
        }

        console.log('[FinancialRecords] Financial record created successfully, ID:', data);

        return data; // Returns the created record's ID

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const { data, error } = await supabase.rpc('get_monthly_summary', {
            p_organization_id: organizationId,
            p_year: parseInt(year, 10),
            p_customer_id: customerId || null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch monthly summary: ${error.message}`);
        }

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const quarterNum = parseInt(quarter, 10);
        if (quarterNum < 1 || quarterNum > 4) {
            throw new Error('Quarter must be between 1 and 4');
        }

        const { data, error } = await supabase.rpc('get_quarterly_summary', {
            p_organization_id: organizationId,
            p_year: parseInt(year, 10),
            p_quarter: quarterNum,
            p_customer_id: customerId || null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch quarterly summary: ${error.message}`);
        }

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

    const supabase = getSupabaseClient();
    const organizationId = getRequiredOrganizationId();

    try {
        const { data, error } = await supabase.rpc('get_yearly_summary', {
            p_organization_id: organizationId,
            p_year: parseInt(year, 10),
            p_customer_id: customerId || null
        });

        if (error) {
            console.error('[FinancialRecords] RPC error:', error);
            throw new Error(`Failed to fetch yearly summary: ${error.message}`);
        }

        console.log(`[FinancialRecords] Fetched yearly summary for ${year}`);

        return data;

    } catch (error) {
        console.error('[FinancialRecords] Error fetching yearly summary:', error);
        throw error;
    }
}
