import {
    fetchTasksForProject,
    fetchTaskTimers,
    fetchTaskNotes,
    fetchTaskLinks,
    createTask as createTaskAPI,
    updateTask as updateTaskAPI,
    updateTaskStatus as updateTaskStatusAPI,
    startTaskTimer as startTaskTimerAPI,
    stopTaskTimer as stopTaskTimerAPI,
    pauseTimer as pauseTimerAPI,
    resumeTimer as resumeTimerAPI,
    getActiveTimer as getActiveTimerAPI
} from '../api/tasks';
import { fetchFinancialRecordByRecordId, createFinancialRecord } from '../api/financialRecords';
import { createSaleFromFinancialRecord } from './salesService';
import { getSupabaseClient } from './supabaseService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Loads tasks for a project with processing and sorting
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Processed and sorted tasks
 */
export async function loadProjectTasks(projectId) {
    const data = await fetchTasksForProject(projectId);
    //console.log('Raw data from FileMaker:', data);
    const processedTasks = processTaskData(data);
    //console.log('Processed tasks:', processedTasks);
    const sortedTasks = sortTasks(processedTasks);
    //console.log('Sorted tasks:', sortedTasks);
    return sortedTasks;
}

/**
 * Loads all details for a task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task details including timers, notes, and links
 */
export async function loadTaskDetails(taskId) {
    const [timerResult, notesResult, linksResult] = await Promise.all([
        fetchTaskTimers(taskId),
        fetchTaskNotes(taskId),
        fetchTaskLinks(taskId)
    ]);

    return {
        timers: processTimerRecords(timerResult),
        notes: processTaskNotes(notesResult),
        links: processTaskLinks(linksResult, taskId, 'filemaker')
    };
}

/**
 * Starts a timer with validation and concurrency control
 * Checks for existing active timer before starting new one
 * @param {Object} task - Task to start timer for
 * @param {string} staffId - Staff ID (optional, defaults to task._staffID)
 * @returns {Promise<Object>} Created timer record
 * @throws {Error} If task is invalid or staff already has active timer
 */
export async function startTimer(task, staffId = null) {
    if (!task?.id) {
        throw new Error('Invalid task for timer');
    }

    const effectiveStaffId = staffId || task._staffID || task.staff_id;
    if (!effectiveStaffId) {
        throw new Error('Staff ID is required to start timer');
    }

    console.log('[Task Service] Starting timer for task:', task.id, 'staff:', effectiveStaffId);

    // Check for existing active timer (backend enforces this, but we check for better UX)
    try {
        const activeTimer = await getActiveTimerAPI(effectiveStaffId);
        if (activeTimer) {
            console.warn('[Task Service] Staff already has active timer:', activeTimer);
            throw new Error('You already have an active timer running. Please stop or pause it before starting a new one.');
        }
    } catch (error) {
        // If error is not about existing timer, log it but continue
        // (backend will handle idempotency check)
        if (!error.message.includes('active timer')) {
            console.warn('[Task Service] Error checking active timer:', error);
        } else {
            throw error; // Re-throw if it's about existing timer
        }
    }

    try {
        const result = await startTaskTimerAPI(task.id, task);
        console.log('[Task Service] Timer started successfully:', result);
        return result;
    } catch (error) {
        console.error('[Task Service] Failed to start timer:', error);

        // Handle concurrency error from backend
        if (error.message.includes('already has an active timer') || error.message.includes('409')) {
            throw new Error('You already have an active timer running. Please stop or pause it before starting a new one.');
        }

        throw error;
    }
}

/**
 * Helper function to format product name for financial records
 * Format: CUSTOMERCAPS:ProjectFirstWord
 * @param {string} customerName - Customer business name
 * @param {string} projectName - Project name
 * @returns {string} Formatted product name
 */
function formatProductName(customerName, projectName) {
    // Extract only capital letters and numbers from customer name
    const customerCaps = customerName.replace(/[^A-Z0-9]/g, '').trim() || 'CUSTOMER';

    // Get first word from project name
    const projectFirstWord = projectName.split(/\s+/)[0] || 'Project';

    return `${customerCaps}:${projectFirstWord}`;
}

/**
 * Helper function to create financial record from time entry data
 * Uses Supabase create_financial_record RPC
 * @param {Object} timeEntry - Time entry data from backend
 * @param {string} organizationId - Organization ID
 * @returns {Promise<string>} Financial record ID
 * @throws {Error} If required data is missing or creation fails
 */
async function createFinancialRecordFromTimeEntry(timeEntry, organizationId) {
    console.log('[Task Service] Creating financial record from time entry:', timeEntry.id);

    // Validate time entry has required data
    if (!timeEntry.customer_id) {
        throw new Error('Time entry missing customer_id - cannot create financial record');
    }

    if (!timeEntry.is_billable) {
        console.log('[Task Service] ⚠ Time entry is not billable - skipping financial record creation');
        return null;
    }

    if (!timeEntry.duration_minutes || timeEntry.duration_minutes <= 0) {
        console.log('[Task Service] ⚠ Time entry has no duration - skipping financial record creation');
        return null;
    }

    // Calculate billable hours (convert minutes to hours with 2 decimal places)
    const billableHours = Math.round((timeEntry.duration_minutes / 60) * 100) / 100;

    // Get unit price (hourly rate)
    const unitPrice = timeEntry.hourly_rate || 0;

    if (unitPrice <= 0) {
        console.warn('[Task Service] ⚠ Hourly rate is 0 or negative - financial record will have $0 amount');
    }

    // Need to fetch customer and project names for product_name format
    // Fetch from Supabase
    const supabase = getSupabaseClient();

    try {
        // Fetch customer name
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('business_name')
            .eq('id', timeEntry.customer_id)
            .single();

        if (customerError || !customer) {
            console.error('[Task Service] ✗ Failed to fetch customer:', customerError);
            throw new Error(`Customer not found: ${timeEntry.customer_id}`);
        }

        // Fetch project name if available
        let projectName = 'Project';
        if (timeEntry.project_id) {
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('name, projectName')
                .eq('id', timeEntry.project_id)
                .single();

            if (!projectError && project) {
                projectName = project.name || project.projectName || 'Project';
            } else {
                console.warn('[Task Service] ⚠ Failed to fetch project name, using default');
            }
        }

        // Format product name
        const productName = formatProductName(customer.business_name, projectName);

        // Generate financial ID
        const financialId = uuidv4();

        // Get current date in YYYY-MM-DD format
        const date = new Date().toISOString().split('T')[0];

        console.log('[Task Service] Creating financial record with params:', {
            financialId,
            customerId: timeEntry.customer_id,
            productName,
            quantity: billableHours,
            unitPrice,
            date
        });

        // Create financial record using Supabase RPC
        const recordId = await createFinancialRecord({
            financialId,
            customerId: timeEntry.customer_id,
            productName,
            quantity: billableHours,
            unitPrice,
            date,
            productId: null
        });

        console.log('[Task Service] ✓ Financial record created successfully, ID:', recordId);

        return recordId;

    } catch (error) {
        console.error('[Task Service] ✗ Failed to create financial record:', error);
        throw error;
    }
}

/**
 * Stops a timer with validation and adjustments
 * Creates financial record using Supabase create_financial_record RPC
 * Fixed-price projects are detected automatically and no financial record is created
 *
 * @param {Object} params - Timer stop parameters
 * @param {string} params.recordId - Timer entry ID (UUID for backend, recordId for FileMaker)
 * @param {string} [params.description=''] - Work performed description
 * @param {boolean} [params.saveImmediately=false] - Save without description
 * @param {number} [params.totalPauseTime=0] - Total pause duration in seconds
 * @param {number} [params.adjustment=0] - Manual adjustment in seconds
 * @param {string} organizationId - Organization ID for financial record creation
 * @returns {Promise<Object>} Updated timer record with financial record if created
 * @throws {Error} If timer record is invalid or stop operation fails
 */
export async function stopTimer(params, organizationId = null) {
    if (!params?.recordId) {
        throw new Error('Invalid timer record');
    }

    // Validate adjustment is in 6-minute increments
    const adjustmentMinutes = (params.adjustment || 0) / 60;
    if (adjustmentMinutes % 6 !== 0) {
        throw new Error('Time adjustment must be in 6-minute (0.1 hour) increments');
    }

    console.log('[Task Service] ========== STOP TIMER START ==========');
    console.log('[Task Service] Stopping timer:', params.recordId);
    console.log('[Task Service] Description:', params.description || '(none)');
    console.log('[Task Service] Save immediately:', params.saveImmediately);
    console.log('[Task Service] Total pause time:', params.totalPauseTime || 0, 'seconds');
    console.log('[Task Service] Adjustment:', params.adjustment || 0, 'seconds');
    console.log('[Task Service] Total adjustment:', (params.totalPauseTime || 0) + (params.adjustment || 0), 'seconds');

    // Get organization ID
    const orgId = organizationId || (window.state?.user?.supabaseOrgID);
    if (!orgId) {
        console.warn('[Task Service] ⚠ No organization ID found - financial record creation may fail');
    }

    let retryCount = 0;
    const maxRetries = 2;
    let lastError = null;

    // Retry loop for backend API calls
    while (retryCount <= maxRetries) {
        try {
            // Stop the timer - backend handles time entry update
            const result = await stopTaskTimerAPI(
                params.recordId,
                params.description,
                params.saveImmediately,
                (params.totalPauseTime || 0) + (params.adjustment || 0)
            );

            console.log('[Task Service] Timer stopped successfully on attempt', retryCount + 1);

            // Backend API returns structured response with time_entry and optionally financial_record
            if (result?.time_entry) {
                console.log('[Task Service] Backend API response received');
                console.log('[Task Service] Time entry ID:', result.time_entry.id);
                console.log('[Task Service] Duration minutes:', result.time_entry.duration_minutes);
                console.log('[Task Service] Is billable:', result.time_entry.is_billable);
                console.log('[Task Service] Status:', result.time_entry.status);

                // Check if backend already created a financial record
                if (result.financial_record) {
                    console.log('[Task Service] ✓ Financial record already created by backend');
                    console.log('[Task Service] Financial record ID:', result.financial_record.id);
                } else if (result.time_entry.is_billable && orgId) {
                    // Backend didn't create financial record - create one via RPC
                    console.log('[Task Service] Creating financial record via RPC...');

                    try {
                        const financialRecordId = await createFinancialRecordFromTimeEntry(
                            result.time_entry,
                            orgId
                        );

                        if (financialRecordId) {
                            console.log('[Task Service] ✓ Financial record created via RPC, ID:', financialRecordId);
                            // Add financial_record to result for consistency
                            result.financial_record = { id: financialRecordId };
                        } else {
                            console.log('[Task Service] ⚠ No financial record created (non-billable or fixed-price)');
                        }
                    } catch (financialError) {
                        console.error('[Task Service] ✗ Failed to create financial record via RPC:', financialError);
                        // Don't fail the timer stop - financial record creation is non-critical
                        console.warn('[Task Service] Timer stopped but financial record creation failed');
                    }
                } else {
                    console.log('[Task Service] ⚠ No financial record created');
                    if (!result.time_entry.is_billable) {
                        console.log('[Task Service] Reason: Non-billable time entry');
                    } else if (!orgId) {
                        console.log('[Task Service] Reason: Missing organization ID');
                    }
                }

                console.log('[Task Service] ========== STOP TIMER SUCCESS ==========');
                return result;
            }

            // FileMaker legacy response handling
            if (result && result.response) {
                console.log('[Task Service] FileMaker legacy response received');
                console.log('[Task Service] Processing FileMaker financial record sync...');

                try {
                    // Get the organization ID from the parameter or from the global state
                    const orgId = organizationId || (window.state?.user?.supabaseOrgID);

                    if (!orgId) {
                        console.warn('[Task Service] ⚠ No organization ID found, skipping sales record creation');
                        console.log('[Task Service] ========== STOP TIMER SUCCESS (no sync) ==========');
                        return result;
                    }

                    console.log('[Task Service] Organization ID:', orgId);

                    // Declare financialId variable
                    let financialId;
                    let isFixedPrice = false;

                    try {
                        console.log('[Task Service] Fetching financial record by recordId:', params.recordId);
                        const financialRecord = await fetchFinancialRecordByRecordId(params.recordId);

                        if (financialRecord && financialRecord.response && financialRecord.response.data && financialRecord.response.data.length > 0) {
                            financialId = financialRecord.response.data[0].fieldData.__ID;
                            console.log('[Task Service] Found financial ID:', financialId);

                            // Check if this is a fixed-price project
                            const fixedPrice = parseFloat(financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0);
                            console.log('[Task Service] Project fixed price value:', fixedPrice);

                            if (fixedPrice > 0) {
                                console.log('[Task Service] ⚠ Fixed-price project detected (fixedPrice =', fixedPrice, ')');
                                console.log('[Task Service] Skipping sales record creation for fixed-price project');
                                isFixedPrice = true;
                                financialId = null; // Prevent sales record creation
                            }
                        } else {
                            console.warn('[Task Service] ⚠ No financial record found in response');
                        }
                    } catch (fetchError) {
                        console.error('[Task Service] ✗ Error fetching financial record by recordId:', fetchError);
                        console.error('[Task Service] Stack trace:', fetchError.stack);
                    }

                    if (financialId) {
                        // Create a sales record in Supabase
                        console.log('[Task Service] Creating sales record for financial record:', financialId);
                        await createSaleFromFinancialRecord(financialId, orgId);
                        console.log('[Task Service] ✓ Sales record created successfully');
                    } else {
                        if (isFixedPrice) {
                            console.log('[Task Service] ⚠ No sales record created: Fixed-price project');
                        } else {
                            console.warn('[Task Service] ⚠ No sales record created: Financial record ID not found');
                        }
                    }

                    console.log('[Task Service] ========== STOP TIMER SUCCESS ==========');
                    return result;
                } catch (error) {
                    console.error('[Task Service] ✗ Error in FileMaker sales record sync:', error);
                    console.error('[Task Service] Stack trace:', error.stack);
                    // Don't throw the error, as we still want to return the timer stop result
                    // Timer was stopped successfully, sync failure is non-critical
                    console.log('[Task Service] Timer stopped but sales sync failed - returning result anyway');
                    console.log('[Task Service] ========== STOP TIMER PARTIAL SUCCESS ==========');
                    return result;
                }
            }

            // Unknown response format
            console.warn('[Task Service] ⚠ Unexpected response format:', result);
            console.log('[Task Service] ========== STOP TIMER SUCCESS (unexpected format) ==========');
            return result;

        } catch (error) {
            lastError = error;
            retryCount++;

            console.error('[Task Service] ✗ Stop timer attempt', retryCount, 'failed:', error.message);

            if (retryCount <= maxRetries) {
                // Retry with exponential backoff
                const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                console.log('[Task Service] Retrying in', delayMs, 'ms...');
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    // All retries exhausted
    console.error('[Task Service] ✗✗✗ All stop timer attempts failed after', maxRetries + 1, 'tries');
    console.error('[Task Service] Final error:', lastError?.message);
    console.error('[Task Service] Stack trace:', lastError?.stack);
    console.log('[Task Service] ========== STOP TIMER FAILED ==========');
    throw lastError || new Error('Failed to stop timer after multiple attempts');
}

/**
 * Pauses an active timer
 * Only supported in backend mode (not FileMaker)
 *
 * @param {string} entryId - Timer entry ID
 * @returns {Promise<Object>} Updated timer record with paused status
 * @throws {Error} If timer is not in active state or pause fails
 */
export async function pauseTimer(entryId) {
    if (!entryId) {
        throw new Error('Timer entry ID is required');
    }

    console.log('[Task Service] Pausing timer:', entryId);

    try {
        const result = await pauseTimerAPI(entryId);
        console.log('[Task Service] Timer paused successfully:', result);
        return result;
    } catch (error) {
        console.error('[Task Service] Failed to pause timer:', error);

        // Provide user-friendly error messages
        if (error.message.includes('must be active')) {
            throw new Error('Timer must be active to pause. It may already be paused or completed.');
        }
        if (error.message.includes('not supported in FileMaker')) {
            throw new Error('Pause/resume is only available in the web version, not in FileMaker.');
        }

        throw error;
    }
}

/**
 * Resumes a paused timer
 * Only supported in backend mode (not FileMaker)
 *
 * @param {string} entryId - Timer entry ID
 * @returns {Promise<Object>} Updated timer record with active status
 * @throws {Error} If timer is not in paused state or resume fails
 */
export async function resumeTimer(entryId) {
    if (!entryId) {
        throw new Error('Timer entry ID is required');
    }

    console.log('[Task Service] Resuming timer:', entryId);

    try {
        const result = await resumeTimerAPI(entryId);
        console.log('[Task Service] Timer resumed successfully:', result);
        return result;
    } catch (error) {
        console.error('[Task Service] Failed to resume timer:', error);

        // Provide user-friendly error messages
        if (error.message.includes('must be paused')) {
            throw new Error('Timer must be paused to resume. It may be active or already completed.');
        }
        if (error.message.includes('not supported in FileMaker')) {
            throw new Error('Pause/resume is only available in the web version, not in FileMaker.');
        }

        throw error;
    }
}

/**
 * Gets the active timer for a staff member
 * Useful for restoring timer state on app load
 *
 * @param {string} staffId - Staff member ID (optional, defaults to current user)
 * @returns {Promise<Object|null>} Active timer record or null if no active timer
 */
export async function getActiveTimer(staffId = null) {
    console.log('[Task Service] Getting active timer for staff:', staffId || 'current user');

    try {
        const result = await getActiveTimerAPI(staffId);
        if (result) {
            console.log('[Task Service] Found active timer:', result);
        } else {
            console.log('[Task Service] No active timer found');
        }
        return result;
    } catch (error) {
        console.error('[Task Service] Error getting active timer:', error);
        // Return null on error (no active timer)
        return null;
    }
}

/**
 * Task data processing and business logic
 */

/**
 * Processes raw task data from backend API or FileMaker
 * Handles both backend response (array of Task objects) and FileMaker response format
 *
 * @param {Array|Object} data - Raw task data (array from backend or FileMaker response object)
 * @returns {Array} Processed task records
 */
export function processTaskData(data) {
    console.log('[Task Service] Processing task data');

    // Backend API returns array directly
    if (Array.isArray(data)) {
        console.log('[Task Service] Processing tasks from backend:', data.length);
        return data.map(task => {
            return {
                id: task.id,
                recordId: task.filemaker_record_id || task.id, // Use UUID as fallback
                // Include both 'task' (legacy) and 'title' (new) for backward compatibility
                task: task.title || task.name || task.task,
                title: task.title || task.name || task.task,
                type: task.task_type || task.type || 'General',
                isCompleted: task.is_completed || false,
                createdAt: task.created_at,
                modifiedAt: task.updated_at,
                _projectID: task.project_id,
                _staffID: task.staff_id,
                description: task.description,
                dueDate: task.due_date,
                priority: task.priority,
                status: task.status
            };
        });
    }

    // FileMaker response handling
    if (!data?.response?.data) {
        console.log('[Task Service] No data to process, returning empty array');
        return [];
    }

    console.log('[Task Service] Processing tasks from FileMaker:', data.response.data.length);
    const processed = data.response.data.map(task => {
        return {
            id: task.fieldData.__ID,
            recordId: task.recordId,
            task: task.fieldData.task,
            title: task.fieldData.task, // Also include title for consistency with new schema
            type: task.fieldData.type,
            isCompleted: task.fieldData.f_completed === "1" || task.fieldData.f_completed === 1,
            createdAt: task.fieldData['~creationTimestamp'],
            modifiedAt: task.fieldData['~modificationTimestamp'],
            _projectID: task.fieldData._projectID,
            _staffID: task.fieldData._staffID
        };
    });

    console.log('[Task Service] Processed tasks:', processed.length);
    return processed;
}

/**
 * Processes timer records for a task
 * Handles both backend API response (array of TimeEntry objects) and FileMaker response
 *
 * @param {Array|Object} timerRecords - Raw timer records (array from backend or FileMaker response object)
 * @returns {Array} Processed timer records with duration calculations
 */
export function processTimerRecords(timerRecords) {
    // Backend API returns array directly
    if (Array.isArray(timerRecords)) {
        console.log('[Task Service] Processing timer records from backend:', timerRecords.length);
        return timerRecords.map(record => {
            return {
                id: record.id,
                recordId: record.filemaker_record_id || record.id, // Use UUID as fallback
                startTime: record.start_time ? new Date(record.start_time) : null,
                endTime: record.end_time ? new Date(record.end_time) : null,
                description: record.description || '',
                duration: record.duration_minutes ? parseFloat(record.duration_minutes) / 60 : 0, // Convert to hours
                status: record.status || 'active',
                pauseDuration: record.pause_duration_seconds || 0,
                adjustmentSeconds: record.adjustment_seconds || 0,
                isBillable: record.is_billable,
                billableAmount: record.billable_amount,
                hourlyRate: record.hourly_rate
            };
        });
    }

    // FileMaker response handling
    if (!timerRecords?.response?.data) {
        return [];
    }

    console.log('[Task Service] Processing timer records from FileMaker:', timerRecords.response.data.length);
    return timerRecords.response.data.map(record => {
        // Convert time strings (e.g. "1:30:00 PM") to Date objects
        const startTimeStr = record.fieldData.startTime;
        const endTimeStr = record.fieldData.endTime;

        // Create a Date object for today with the specified time
        const today = new Date();
        const startTime = startTimeStr ? new Date(today.toDateString() + ' ' + startTimeStr) : null;
        const endTime = endTimeStr ? new Date(today.toDateString() + ' ' + endTimeStr) : null;

        return {
            id: record.fieldData.__ID,
            recordId: record.recordId,
            startTime,
            endTime,
            description: record.fieldData["Work Performed"] || '',
            duration: record.fieldData.Billable_Time_Rounded,
            status: endTimeStr ? 'completed' : 'active',
            pauseDuration: 0, // FileMaker doesn't track pause
            adjustmentSeconds: record.fieldData.TimeAdjust || 0,
            isBillable: true // FileMaker assumes billable
        };
    });
}

/**
 * Processes notes for a task
 * Environment-aware: Handles both backend API and FileMaker responses
 * @param {Object|Array} data - Raw notes data (Array from backend, Object from FileMaker)
 * @returns {Array} Processed notes
 */
export function processTaskNotes(data) {
    // Backend API returns array directly (already transformed by noteService)
    if (Array.isArray(data)) {
        return data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // FileMaker returns nested object structure
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(note => ({
            id: note.fieldData.__ID,
            recordId: note.recordId,
            content: note.fieldData.note,
            type: note.fieldData.type || 'general',
            createdAt: note.fieldData['~CreationTimestamp'],
            modifiedAt: note.fieldData['~ModificationTimestamp'],
            createdBy: note.fieldData['~CreatedBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by creation date, newest first
}

/**
 * Processes links for a task
 * Handles both FileMaker (response.data) and backend API formats
 * Backend uses explicit foreign keys (task_id), FileMaker uses polymorphic _fkID
 * @param {Object|Array} data - Raw links data (FileMaker wrapped or backend array)
 * @param {string} taskId - Task ID (required for filtering backend results)
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed links
 */
export function processTaskLinks(data, taskId, source = 'filemaker') {
    // Backend API format: array directly or wrapped in data property
    if (source === 'backend') {
        const linksArray = Array.isArray(data) ? data : (data?.data || []);

        // Filter links by task_id and transform to frontend format
        return linksArray
            .filter(link => link.task_id === taskId)
            .map(link => {
                // Generate title from URL hostname if not provided
                let title = link.title;
                if (!title && link.link) {
                    try {
                        title = new URL(link.link).hostname;
                    } catch {
                        title = link.link;
                    }
                }

                return {
                    id: link.id,
                    url: link.link,
                    title: title,
                    customerId: link.customer_id,
                    organizationId: link.organization_id,
                    projectId: link.project_id,
                    taskId: link.task_id,
                    createdAt: link.created_at,
                    updatedAt: link.updated_at
                };
            })
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // FileMaker format: response.data with fieldData
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(link => {
            // Generate title from URL if not provided
            let title = link.fieldData.title;
            if (!title && link.fieldData.link) {
                try {
                    title = new URL(link.fieldData.link).hostname;
                } catch {
                    title = link.fieldData.link;
                }
            }

            return {
                id: link.fieldData.__ID,
                recordId: link.recordId,
                url: link.fieldData.link,
                title: title,
                createdAt: link.fieldData['~creationTimestamp'],
                modifiedAt: link.fieldData['~modificationTimestamp']
            };
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Formats duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
        return `${remainingMinutes}m`;
    }
    
    return remainingMinutes === 0 
        ? `${hours}h` 
        : `${hours}h ${remainingMinutes}m`;
}

/**
 * Task field definitions with validation rules
 * Updated to match new backend schema from TaskCreate API model
 *
 * Backend Required Fields: project_id, customer_id, title
 * Backend Optional Fields: staff_id, task_type, notes, is_completed, status, priority, estimated_hours, due_date, filemaker_task_id
 *
 * Note: organization_id is NOT sent to backend - it's inferred from authenticated user context
 */
export const TASK_FIELDS = {
    // Required fields (backend API)
    title: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 255,
        validate: (value) => {
            if (!value?.trim()) return 'Task title is required';
            if (value.length > 255) return 'Task title must be less than 255 characters';
            return null;
        }
    },
    project_id: {
        required: true,
        type: 'string',
        validate: (value) => {
            if (!value) return 'Project ID is required';
            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return uuidRegex.test(value) ? null : 'Project ID must be a valid UUID';
        }
    },
    customer_id: {
        required: true,
        type: 'string',
        validate: (value) => {
            if (!value) return 'Customer ID is required';
            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return uuidRegex.test(value) ? null : 'Customer ID must be a valid UUID';
        }
    },

    // Optional fields (backend API)
    staff_id: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return uuidRegex.test(value) ? null : 'Staff ID must be a valid UUID';
        }
    },
    task_type: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            if (value.length > 255) return 'Task type must be less than 255 characters';
            return null;
        }
    },
    notes: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            return null; // No length limit in backend schema
        }
    },
    is_completed: {
        required: false,
        type: 'boolean',
        validate: (value) => {
            if (value === undefined || value === null) return null;
            return typeof value === 'boolean' ? null : 'Completion status must be a boolean';
        }
    },
    status: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
            return validStatuses.includes(value) ? null : `Status must be one of: ${validStatuses.join(', ')}`;
        }
    },
    priority: {
        required: false,
        type: 'number',
        validate: (value) => {
            if (value === undefined || value === null) return null;
            if (!Number.isInteger(value)) return 'Priority must be an integer';
            return (value >= 1 && value <= 5) ? null : 'Priority must be between 1 and 5';
        }
    },
    estimated_hours: {
        required: false,
        type: 'number',
        validate: (value) => {
            if (value === undefined || value === null) return null;
            // Backend accepts both number and string pattern
            if (typeof value === 'string') {
                const pattern = /^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$/;
                if (!pattern.test(value)) return 'Estimated hours must be a valid number';
                const parsed = parseFloat(value);
                if (isNaN(parsed) || parsed < 0) return 'Estimated hours must be positive';
                return null;
            }
            if (typeof value !== 'number' || isNaN(value)) return 'Estimated hours must be a number';
            if (value < 0) return 'Estimated hours must be positive';
            return null;
        }
    },
    due_date: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            // ISO date format validation (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(value)) return 'Due date must be in YYYY-MM-DD format';
            const date = new Date(value);
            return !isNaN(date.getTime()) ? null : 'Due date must be a valid date';
        }
    },
    filemaker_task_id: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            return null; // No specific validation needed
        }
    }
};

/**
 * Validates task data before creation/update
 * @param {Object} data - Task data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.isUpdate - Whether this is an update operation
 * @param {boolean} options.partial - Whether to allow partial data (only validate provided fields)
 * @returns {Object} Validation result { isValid, errors, fieldErrors }
 */
export function validateTaskData(data, { isUpdate = false, partial = false } = {}) {
    const errors = [];
    const fieldErrors = {};

    // Check if data is provided
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Invalid task data provided'],
            fieldErrors: {}
        };
    }

    // Validate each field according to rules
    Object.entries(TASK_FIELDS).forEach(([field, rules]) => {
        // Skip validation for fields not provided in partial validation
        if (partial && !(field in data)) return;

        // Skip immutable fields for updates (project_id, customer_id)
        if (isUpdate && ['project_id', 'customer_id'].includes(field)) return;

        const value = data[field];

        // Required field validation
        if (rules.required && !isUpdate && !partial) {
            if (value === undefined || value === null || value === '') {
                fieldErrors[field] = `${field} is required`;
                return;
            }
        }

        // Skip validation if value is not provided and field is optional
        if (!rules.required && (value === undefined || value === null)) return;

        // Type checking - special handling for boolean fields
        if (value !== undefined && value !== null) {
            // For boolean fields, accept both boolean and number (for backward compatibility)
            if (rules.type === 'boolean') {
                if (typeof value !== 'boolean' && typeof value !== 'number') {
                    fieldErrors[field] = `${field} must be a boolean`;
                    return;
                }
            } else if (typeof value !== rules.type) {
                fieldErrors[field] = `${field} must be a ${rules.type}`;
                return;
            }

            // Custom field validation
            if (rules.validate) {
                const validationError = rules.validate(value);
                if (validationError) {
                    fieldErrors[field] = validationError;
                }
            }
        }
    });

    // Add field errors to main errors array
    Object.values(fieldErrors).forEach(error => {
        errors.push(error);
    });

    return {
        isValid: errors.length === 0,
        errors,
        fieldErrors
    };
}

/**
 * Formats task data for display
 * @param {Object} task - Task record
 * @param {Array} timerRecords - Associated timer records
 * @param {Array} notes - Associated notes
 * @param {Array} links - Associated links
 * @returns {Object} Formatted task data
 */
export function formatTaskForDisplay(task, timerRecords = [], notes = [], links = []) {
    const totalTime = calculateTotalTaskTime(timerRecords);
    
    return {
        id: task.id,
        recordId: task.recordId,
        description: task.task,
        type: task.type || 'General',
        status: task.isCompleted ? 'Completed' : 'Active',
        totalTime: formatDuration(totalTime),
        created: new Date(task.createdAt).toLocaleDateString(),
        modified: new Date(task.modifiedAt).toLocaleDateString(),
        notes: notes || [],
        links: links || [],
        timerCount: timerRecords.length
    };
}

/**
 * Creates a new task with proper validation and formatting
 * Supports both new backend field names and legacy FileMaker field names for backward compatibility
 *
 * @param {Object} params - Task creation parameters
 * @param {string} params.projectId|params.project_id|params._projectID - Project ID (UUID)
 * @param {string} params.customerId|params.customer_id - Customer ID (UUID)
 * @param {string} params.staffId|params.staff_id|params._staffID - Staff ID (UUID, optional)
 * @param {string} params.taskName|params.title - Task title
 * @param {string} [params.type|params.task_type] - Task type (optional)
 * @param {number|string} [params.priority=3] - Task priority (1-5, defaults to 3)
 * @param {string} [params.notes] - Task notes (optional)
 * @param {string} [params.status="pending"] - Task status (optional)
 * @param {boolean} [params.is_completed=false] - Completion status (optional)
 * @param {number} [params.estimated_hours] - Estimated hours (optional)
 * @param {string} [params.due_date] - Due date in YYYY-MM-DD format (optional)
 * @returns {Promise<Object>} Created task data
 */
export async function createNewTask(params) {
    if (!params || typeof params !== 'object') {
        throw new Error('Invalid task parameters');
    }

    // Support both old and new field name formats for backward compatibility
    const projectId = params.project_id || params._projectID || params.projectId;
    const customerId = params.customer_id || params.customerId;
    const staffId = params.staff_id || params._staffID || params.staffId;
    const taskTitle = params.title || params.taskName;
    const taskType = params.task_type || params.type;
    const notes = params.notes;
    const status = params.status || 'pending';
    const isCompleted = params.is_completed !== undefined ? params.is_completed : false;
    const dueDate = params.due_date;
    const estimatedHours = params.estimated_hours;

    // Handle priority conversion: old format was string ("active", "high", "low"), new format is integer (1-5)
    let priority = params.priority !== undefined ? params.priority : 3; // Default to 3 (medium)
    if (typeof priority === 'string') {
        // Convert legacy string priority to integer
        const priorityMap = { 'high': 1, 'active': 3, 'low': 5 };
        priority = priorityMap[priority.toLowerCase()] || 3;
    }

    // Validate required fields
    if (!projectId || !customerId || !taskTitle) {
        throw new Error('Project ID, Customer ID, and Task Title are required');
    }

    // Prepare task data for backend API
    const taskData = {
        project_id: projectId,
        customer_id: customerId,
        title: taskTitle.trim(),
        is_completed: isCompleted,
        status: status,
        priority: priority
    };

    // Add optional fields if provided
    if (staffId) taskData.staff_id = staffId;
    if (taskType) taskData.task_type = taskType;
    if (notes) taskData.notes = notes;
    if (estimatedHours !== undefined) taskData.estimated_hours = estimatedHours;
    if (dueDate) taskData.due_date = dueDate;

    // Validate task data against backend schema
    const validation = validateTaskData(taskData, { partial: false });
    if (!validation.isValid) {
        console.error('[Task Service] Validation failed:', validation.errors);
        throw new Error(validation.errors[0]); // Throw first error
    }

    try {
        console.log('[Task Service] Creating task with data:', taskData);

        // Create task through API (backend or FileMaker based on USE_BACKEND_API flag in api/tasks.js)
        const result = await createTaskAPI(taskData);

        console.log('[Task Service] Task created successfully:', result);
        return result;
    } catch (error) {
        console.error('[Task Service] Error in createNewTask:', error);
        throw error;
    }
}

/**
 * Task operations with business logic
 */

/**
 * Updates a task with validation and state management
 * @param {string} taskId - Task ID to update
 * @param {Object} taskData - New task data
 * @returns {Promise<Object>} Updated task data
 */
export async function updateExistingTask(taskId, taskData) {
    // Validate task data
    const validation = validateTaskData(taskData, {
        isUpdate: true,
        partial: true
    });
    if (!validation.isValid) {
        throw new Error(validation.errors[0]);
    }

    // Update task through API
    return await updateTaskAPI(taskId, formatTaskForFileMaker(taskData));
}

/**
 * Updates a task's completion status
 * @param {string} taskId - Task ID to update
 * @param {boolean} completed - New completion status
 * @returns {Promise<Object>} Updated task data
 */
export async function updateTaskCompletionStatus(taskId, completed) {
    return await updateTaskStatusAPI(taskId, completed);
}

/**
 * Timer operations with business logic
 */

/**
 * Starts a timer for a task
 * @param {Object} task - Task to start timer for
 * @returns {Promise<Object>} Created timer record
 */
export async function startNewTaskTimer(task) {
    if (!task) {
        throw new Error('No task selected');
    }
    
    return await startTaskTimerAPI(task.id, task);
}

/**
 * Stops a timer with adjustments
 * @param {Object} params - Timer stop parameters
 * @param {string} params.recordId - Timer record ID
 * @param {string} [params.description=''] - Work description
 * @param {boolean} [params.saveImmediately=false] - Whether to save without description
 * @param {number} [params.totalPauseTime=0] - Total pause time in seconds
 * @param {number} [params.adjustment=0] - Manual adjustment in seconds
 * @returns {Promise<Object>} Updated timer record
 */
export async function stopExistingTaskTimer({
    recordId,
    description = '',
    saveImmediately = false,
    totalPauseTime = 0,
    adjustment = 0
}) {
    if (!recordId) {
        throw new Error('No active timer');
    }

    const finalAdjustment = Math.round(totalPauseTime + adjustment);
    return await stopTaskTimerAPI(recordId, description, saveImmediately, finalAdjustment);
}

/**
 * Formats task data for FileMaker
 * @param {Object} data - Task data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatTaskForFileMaker(data) {
    // Pass through the data as-is since it's already in FileMaker format
    return data;
}

// Helper functions

/**
 * Groups tasks by completion status
 * @param {Array} tasks - Array of task records
 * @returns {Object} Grouped tasks { active, completed }
 */
export function groupTasksByStatus(tasks) {
    //console.log('Grouping tasks:', tasks);
    const groups = {
        active: [],
        completed: []
    };
    
    if (!tasks?.length) {
        //console.log('No tasks to group, returning empty groups');
        return groups;
    }

    tasks.forEach(task => {
        //console.log('Processing task:', task);
        const key = task.isCompleted ? 'completed' : 'active';
        groups[key].push(task);
    });
    
    return groups;
}

/**
 * Calculates task statistics
 * @param {Array} tasks - Array of task records
 * @param {Array} timerRecords - Array of timer records
 * @returns {Object} Task statistics
 */
export function calculateTaskStats(tasks, timerRecords) {
    if (!tasks?.length) {
        return {
            total: 0,
            active: 0,
            completed: 0,
            completionRate: 0,
            totalTimeSpent: '0m',
            averageTimePerTask: '0m'
        };
    }

    const grouped = groupTasksByStatus(tasks);
    const totalTime = calculateTotalTaskTime(timerRecords);
    
    return {
        total: tasks.length,
        active: grouped.active.length,
        completed: grouped.completed.length,
        completionRate: Math.round((grouped.completed.length / tasks.length) * 100) || 0,
        totalTimeSpent: formatDuration(totalTime),
        averageTimePerTask: formatDuration(Math.round(totalTime / tasks.length)) || '0m'
    };
}

/**
 * Validates timer adjustment
 * Business rule: Only allow adjustments in 6-minute (0.1 hour) increments
 *
 * @param {number} minutes - Minutes to adjust
 * @returns {boolean} Whether the adjustment is valid
 */
export function isValidTimerAdjustment(minutes) {
    // Only allow adjustments in 6-minute increments
    return minutes % 6 === 0;
}

/**
 * Validates timer adjustment in seconds
 * Business rule: Only allow adjustments in 360-second (6-minute / 0.1 hour) increments
 *
 * @param {number} seconds - Seconds to adjust
 * @returns {boolean} Whether the adjustment is valid
 */
export function isValidTimerAdjustmentSeconds(seconds) {
    // Only allow adjustments in 360-second (6-minute) increments
    return seconds % 360 === 0;
}

/**
 * Rounds adjustment to nearest valid increment
 * Rounds to nearest 6-minute increment
 *
 * @param {number} minutes - Minutes to round
 * @returns {number} Rounded minutes
 */
export function roundToValidAdjustment(minutes) {
    return Math.round(minutes / 6) * 6;
}

/**
 * Rounds adjustment in seconds to nearest valid increment
 * Rounds to nearest 360-second (6-minute) increment
 *
 * @param {number} seconds - Seconds to round
 * @returns {number} Rounded seconds
 */
export function roundToValidAdjustmentSeconds(seconds) {
    return Math.round(seconds / 360) * 360;
}

/**
 * Calculates total time from timer records
 * @param {Array} timerRecords - Array of timer records
 * @returns {number} Total time in minutes
 */
export function calculateTotalTaskTime(timerRecords) {
    if (!timerRecords?.length) {
        return 0;
    }
    
    return timerRecords.reduce((total, record) => {
        // Convert hours to minutes since duration comes from FileMaker in hours
        return total + ((record.duration || 0) * 60);
    }, 0);
}

/**
 * Sorts tasks by priority and status
 * @param {Array} tasks - Array of task records
 * @returns {Array} Sorted task records
 */
export function sortTasks(tasks) {
    if (!tasks?.length) {
        return [];
    }

    return [...tasks].sort((a, b) => {
        // Active tasks first
        if (a.isCompleted !== b.isCompleted) {
            return a.isCompleted ? 1 : -1;
        }
        // Then by creation date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

/**
 * Extracts financial record from stop timer response
 * Backend returns financial record when timer is stopped on billable project
 *
 * @param {Object} stopTimerResponse - Response from stopTaskTimer
 * @returns {Object|null} Financial record or null if not created
 */
export function extractFinancialRecord(stopTimerResponse) {
    if (!stopTimerResponse) {
        return null;
    }

    // Backend API response structure
    if (stopTimerResponse.financial_record) {
        console.log('[Task Service] Extracted financial record from backend response');
        return stopTimerResponse.financial_record;
    }

    // No financial record in response
    return null;
}

/**
 * Extracts time entry from stop timer response
 *
 * @param {Object} stopTimerResponse - Response from stopTaskTimer
 * @returns {Object|null} Time entry or null
 */
export function extractTimeEntry(stopTimerResponse) {
    if (!stopTimerResponse) {
        return null;
    }

    // Backend API response structure
    if (stopTimerResponse.time_entry) {
        return stopTimerResponse.time_entry;
    }

    // FileMaker response structure
    if (stopTimerResponse.response) {
        return stopTimerResponse.response;
    }

    return null;
}

/**
 * Formats financial record for display
 *
 * @param {Object} financialRecord - Financial record from backend
 * @returns {Object} Formatted display data
 */
export function formatFinancialRecordForDisplay(financialRecord) {
    if (!financialRecord) {
        return null;
    }

    return {
        id: financialRecord.id,
        amount: parseFloat(financialRecord.amount || 0).toFixed(2),
        hours: parseFloat(financialRecord.hours || 0).toFixed(2),
        rate: parseFloat(financialRecord.rate || 0).toFixed(2),
        date: financialRecord.date,
        description: financialRecord.description,
        status: financialRecord.status || 'unbilled',
        isBillable: financialRecord.is_billable
    };
}

/**
 * Calculates timer statistics including pause time
 *
 * @param {Object} timeEntry - Time entry record
 * @returns {Object} Timer statistics
 */
export function calculateTimerStats(timeEntry) {
    if (!timeEntry) {
        return {
            totalSeconds: 0,
            pauseSeconds: 0,
            adjustmentSeconds: 0,
            billableSeconds: 0,
            billableMinutes: 0,
            billableHours: 0
        };
    }

    const startTime = timeEntry.start_time ? new Date(timeEntry.start_time) : null;
    const endTime = timeEntry.end_time ? new Date(timeEntry.end_time) : new Date();
    const totalSeconds = startTime ? Math.floor((endTime - startTime) / 1000) : 0;
    const pauseSeconds = timeEntry.pause_duration_seconds || 0;
    const adjustmentSeconds = timeEntry.adjustment_seconds || 0;
    const billableSeconds = Math.max(0, totalSeconds - pauseSeconds + adjustmentSeconds);
    const billableMinutes = Math.round(billableSeconds / 60);
    const billableHours = billableMinutes / 60;

    return {
        totalSeconds,
        pauseSeconds,
        adjustmentSeconds,
        billableSeconds,
        billableMinutes,
        billableHours: billableHours.toFixed(2)
    };
}