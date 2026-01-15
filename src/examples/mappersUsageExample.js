/**
 * Data Mappers Usage Examples
 *
 * This file demonstrates how to integrate the data mappers
 * into various parts of the application.
 *
 * NOTE: This is an example file for reference only.
 * Do not import this file directly in production code.
 */

import { dataService } from '../services/dataService';
import { fetchDataFromFileMaker } from '../api/fileMaker';
import {
    mapFinancialRecordToBackend,
    mapFinancialRecordToFileMaker,
    mapTaskToBackend,
    mapTaskToFileMaker,
    mapBatchToBackend,
    mapBatchToFileMaker,
    validateFinancialRecord
} from '../utils/dataMappers';

/**
 * Example 1: Migrating Financial Records from FileMaker to Backend
 *
 * Use case: One-time migration of historical data
 */
export async function exampleMigrateFinancialRecords(organizationId) {
    console.log('[Example] Starting financial records migration...');

    try {
        // Step 1: Fetch all unbilled records from FileMaker
        const fmResponse = await fetchDataFromFileMaker({
            layout: 'dapiRecords',
            action: 'read',
            query: [{ "f_billed": "0" }] // Only unbilled records
        });

        const fmRecords = fmResponse.response.data || [];
        console.log(`[Example] Fetched ${fmRecords.length} records from FileMaker`);

        // Step 2: Transform to backend format using batch mapper
        const backendRecords = mapBatchToBackend(
            fmRecords,
            mapFinancialRecordToBackend,
            organizationId
        );

        console.log(`[Example] Transformed ${backendRecords.length} records`);

        // Step 3: Validate all records
        const validRecords = [];
        const invalidRecords = [];

        for (const record of backendRecords) {
            const errors = validateFinancialRecord(record);
            if (errors.length === 0) {
                validRecords.push(record);
            } else {
                invalidRecords.push({
                    financial_id: record.financial_id,
                    errors
                });
            }
        }

        console.log(`[Example] Valid: ${validRecords.length}, Invalid: ${invalidRecords.length}`);

        // Step 4: Insert valid records to backend
        if (validRecords.length > 0) {
            // Process in batches of 100 to avoid overwhelming the API
            const batchSize = 100;
            let insertedCount = 0;

            for (let i = 0; i < validRecords.length; i += batchSize) {
                const batch = validRecords.slice(i, i + batchSize);

                try {
                    await Promise.all(
                        batch.map(record =>
                            dataService.post('/financial-records', record)
                        )
                    );

                    insertedCount += batch.length;
                    console.log(`[Example] Inserted batch ${i / batchSize + 1}: ${batch.length} records`);
                } catch (error) {
                    console.error(`[Example] Error inserting batch:`, error);
                }
            }

            console.log(`[Example] Migration complete: ${insertedCount} records inserted`);
        }

        // Step 5: Report invalid records
        if (invalidRecords.length > 0) {
            console.warn('[Example] Failed to migrate the following records:');
            invalidRecords.forEach(({ financial_id, errors }) => {
                console.warn(`  - Record ${financial_id}:`, errors);
            });
        }

        return {
            total: fmRecords.length,
            valid: validRecords.length,
            invalid: invalidRecords.length,
            inserted: validRecords.length
        };

    } catch (error) {
        console.error('[Example] Migration failed:', error);
        throw error;
    }
}

/**
 * Example 2: Dual-Write Pattern
 *
 * Use case: During transition period, write to both FileMaker and Backend
 */
export async function exampleCreateFinancialRecordDualWrite(fmRecord, organizationId) {
    console.log('[Example] Creating financial record with dual-write...');

    try {
        // Step 1: Transform FileMaker record to backend format
        const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);

        // Step 2: Validate before writing
        const errors = validateFinancialRecord(backendRecord);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Step 3: Write to backend first (single source of truth)
        const backendResponse = await dataService.post('/financial-records', backendRecord);

        console.log('[Example] Wrote to backend:', backendResponse.id);

        // Step 4: Write to FileMaker for backward compatibility
        const fmCreateResponse = await fetchDataFromFileMaker({
            layout: 'dapiRecords',
            action: 'create',
            fieldData: fmRecord.fieldData
        });

        console.log('[Example] Wrote to FileMaker:', fmCreateResponse.response.recordId);

        return {
            backend_id: backendResponse.id,
            filemaker_record_id: fmCreateResponse.response.recordId,
            financial_id: backendRecord.financial_id
        };

    } catch (error) {
        console.error('[Example] Dual-write failed:', error);
        throw error;
    }
}

/**
 * Example 3: Reading from Backend and Displaying in FileMaker Format
 *
 * Use case: Frontend expects FileMaker format, but data comes from Backend
 */
export async function exampleFetchFinancialRecordsForDisplay(organizationId, startDate, endDate) {
    console.log('[Example] Fetching financial records for display...');

    try {
        // Step 1: Fetch from backend API
        const backendRecords = await dataService.get('/financial-records', {
            organization_id: organizationId,
            start_date: startDate,
            end_date: endDate
        });

        console.log(`[Example] Fetched ${backendRecords.length} records from backend`);

        // Step 2: Transform to FileMaker format for UI components
        // (if UI components still expect FileMaker structure)
        const fmFormattedRecords = mapBatchToFileMaker(
            backendRecords,
            mapFinancialRecordToFileMaker
        );

        console.log(`[Example] Transformed ${fmFormattedRecords.length} records to FileMaker format`);

        return fmFormattedRecords;

    } catch (error) {
        console.error('[Example] Fetch failed:', error);
        throw error;
    }
}

/**
 * Example 4: Updating Records with Mapper
 *
 * Use case: Update a record from FileMaker UI, write to backend
 */
export async function exampleUpdateFinancialRecord(recordId, updates, organizationId) {
    console.log('[Example] Updating financial record...');

    try {
        // Step 1: Fetch current record from backend
        const currentRecord = await dataService.get(`/financial-records/${recordId}`);

        // Step 2: Apply updates
        const updatedRecord = {
            ...currentRecord,
            ...updates
        };

        // Step 3: Validate updated record
        const errors = validateFinancialRecord(updatedRecord);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Step 4: Update in backend
        const response = await dataService.put(`/financial-records/${recordId}`, updatedRecord);

        console.log('[Example] Updated record:', response.id);

        return response;

    } catch (error) {
        console.error('[Example] Update failed:', error);
        throw error;
    }
}

/**
 * Example 5: Task Migration
 *
 * Use case: Migrate tasks from FileMaker to Backend
 */
export async function exampleMigrateTasks(projectId) {
    console.log('[Example] Migrating tasks for project...');

    try {
        // Step 1: Fetch tasks from FileMaker
        const fmResponse = await fetchDataFromFileMaker({
            layout: 'devTasks',
            action: 'read',
            query: [{ "_projectID": projectId }]
        });

        const fmTasks = fmResponse.response.data || [];
        console.log(`[Example] Fetched ${fmTasks.length} tasks from FileMaker`);

        // Step 2: Transform to backend format
        const backendTasks = mapBatchToBackend(fmTasks, mapTaskToBackend);

        console.log(`[Example] Transformed ${backendTasks.length} tasks`);

        // Step 3: Insert to backend
        const insertedTasks = await Promise.all(
            backendTasks.map(task =>
                dataService.post('/tasks', task)
            )
        );

        console.log(`[Example] Migrated ${insertedTasks.length} tasks`);

        return insertedTasks;

    } catch (error) {
        console.error('[Example] Task migration failed:', error);
        throw error;
    }
}

/**
 * Example 6: Incremental Sync
 *
 * Use case: Sync only new/modified records since last sync
 */
export async function exampleIncrementalSync(organizationId, lastSyncDate) {
    console.log('[Example] Starting incremental sync...');

    try {
        // Step 1: Fetch records modified since last sync from FileMaker
        const fmResponse = await fetchDataFromFileMaker({
            layout: 'dapiRecords',
            action: 'read',
            query: [
                {
                    "~modificationTimestamp": `>=${lastSyncDate}`,
                    "_custID": "*" // All customers
                }
            ]
        });

        const fmRecords = fmResponse.response.data || [];
        console.log(`[Example] Found ${fmRecords.length} modified records`);

        if (fmRecords.length === 0) {
            console.log('[Example] No records to sync');
            return { synced: 0 };
        }

        // Step 2: Transform to backend format
        const backendRecords = mapBatchToBackend(
            fmRecords,
            mapFinancialRecordToBackend,
            organizationId
        );

        // Step 3: Upsert to backend (insert or update based on financial_id)
        let syncedCount = 0;

        for (const record of backendRecords) {
            try {
                // Check if record exists
                const existing = await dataService.get('/financial-records', {
                    financial_id: record.financial_id
                });

                if (existing && existing.length > 0) {
                    // Update existing record
                    await dataService.put(`/financial-records/${existing[0].id}`, record);
                    console.log(`[Example] Updated record ${record.financial_id}`);
                } else {
                    // Insert new record
                    await dataService.post('/financial-records', record);
                    console.log(`[Example] Inserted record ${record.financial_id}`);
                }

                syncedCount++;

            } catch (error) {
                console.error(`[Example] Failed to sync record ${record.financial_id}:`, error);
            }
        }

        console.log(`[Example] Incremental sync complete: ${syncedCount} records synced`);

        return { synced: syncedCount };

    } catch (error) {
        console.error('[Example] Incremental sync failed:', error);
        throw error;
    }
}

/**
 * Example 7: Validation Before Submission
 *
 * Use case: Validate user input before creating financial record
 */
export function exampleValidateBeforeSubmit(formData, organizationId) {
    console.log('[Example] Validating form data...');

    // Transform form data to backend format
    const record = mapFinancialRecordToBackend(
        {
            fieldData: {
                __ID: formData.id,
                _custID: formData.customerId,
                DateStart: formData.date,
                Billable_Time_Rounded: formData.hours,
                Hourly_Rate: formData.rate,
                'Customers::Name': formData.customerName,
                'customers_Projects::projectName': formData.projectName,
                f_billed: formData.billed ? '1' : '0'
            }
        },
        organizationId
    );

    // Validate
    const errors = validateFinancialRecord(record);

    if (errors.length > 0) {
        console.error('[Example] Validation errors:', errors);
        return {
            valid: false,
            errors,
            record: null
        };
    }

    console.log('[Example] Validation passed');
    return {
        valid: true,
        errors: [],
        record
    };
}

/**
 * Example 8: Error Recovery Pattern
 *
 * Use case: Gracefully handle mapping errors in batch operations
 */
export async function exampleBatchWithErrorRecovery(fmRecords, organizationId) {
    console.log('[Example] Processing batch with error recovery...');

    const results = {
        success: [],
        failed: []
    };

    for (const fmRecord of fmRecords) {
        try {
            // Transform
            const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);

            // Validate
            const errors = validateFinancialRecord(backendRecord);
            if (errors.length > 0) {
                throw new Error(`Validation failed: ${errors.join(', ')}`);
            }

            // Insert
            const response = await dataService.post('/financial-records', backendRecord);

            results.success.push({
                financial_id: backendRecord.financial_id,
                backend_id: response.id
            });

        } catch (error) {
            results.failed.push({
                financial_id: fmRecord.fieldData?.__ID || 'unknown',
                error: error.message
            });

            console.error('[Example] Failed to process record:', error);
        }
    }

    console.log(`[Example] Batch complete: ${results.success.length} success, ${results.failed.length} failed`);

    return results;
}

/**
 * Example 9: Integration with React Component
 *
 * Use case: Fetch and display financial records in a React component
 */
export async function exampleFetchForReactComponent(organizationId, filters) {
    console.log('[Example] Fetching data for React component...');

    try {
        // Fetch from backend
        const backendRecords = await dataService.get('/financial-records', {
            organization_id: organizationId,
            ...filters
        });

        // Transform to format expected by UI
        // (assuming UI components are being updated to accept backend format)
        return backendRecords.map(record => ({
            id: record.id,
            financialId: record.financial_id,
            customerId: record.customer_id,
            productName: record.product_name,
            hours: record.quantity,
            rate: record.unit_price,
            total: record.total_price,
            date: record.date,
            billed: !!record.inv_id,
            invoiceId: record.inv_id
        }));

    } catch (error) {
        console.error('[Example] Fetch for component failed:', error);
        throw error;
    }
}

/**
 * Example 10: Custom Validation Rules
 *
 * Use case: Add business-specific validation on top of base validation
 */
export function exampleCustomValidation(record, businessRules) {
    console.log('[Example] Running custom validation...');

    // Run base validation
    const baseErrors = validateFinancialRecord(record);

    const customErrors = [];

    // Business rule: No work on weekends
    if (businessRules.noWeekends) {
        const date = new Date(record.date);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            customErrors.push('Work on weekends is not allowed');
        }
    }

    // Business rule: Maximum hours per day
    if (businessRules.maxHoursPerDay && record.quantity > businessRules.maxHoursPerDay) {
        customErrors.push(`Hours exceed maximum of ${businessRules.maxHoursPerDay} per day`);
    }

    // Business rule: Minimum rate
    if (businessRules.minRate && record.unit_price < businessRules.minRate) {
        customErrors.push(`Rate below minimum of ${businessRules.minRate}`);
    }

    const allErrors = [...baseErrors, ...customErrors];

    if (allErrors.length > 0) {
        console.error('[Example] Validation failed:', allErrors);
        return { valid: false, errors: allErrors };
    }

    console.log('[Example] Custom validation passed');
    return { valid: true, errors: [] };
}

// Export all examples
export default {
    exampleMigrateFinancialRecords,
    exampleCreateFinancialRecordDualWrite,
    exampleFetchFinancialRecordsForDisplay,
    exampleUpdateFinancialRecord,
    exampleMigrateTasks,
    exampleIncrementalSync,
    exampleValidateBeforeSubmit,
    exampleBatchWithErrorRecovery,
    exampleFetchForReactComponent,
    exampleCustomValidation
};
