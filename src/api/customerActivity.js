import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Utility functions for formatting
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

function formatHours(hours) {
    return `${hours.toFixed(2)} hrs`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

/**
 * Calculates the amount based on hours and rate
 * @param {string|number} hours - Billable hours
 * @param {string|number} rate - Hourly rate
 * @returns {number} Calculated amount
 */
function calculateAmount(hours, rate) {
    const parsedHours = parseFloat(hours || 0);
    const parsedRate = parseFloat(rate || 0);
    return parsedHours * parsedRate;
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
 * Processes raw customer activity data from FileMaker
 * @param {Object} data - Raw data from FileMaker
 * @returns {Array} Processed activity records
 */
export function processActivityData(data) {
    if (!data?.response?.data) {
        console.error("processActivityData: Missing data.response.data", data);
        return [];
    }

    console.log("Processing activity data. First record sample:",
        data.response.data[0] ? JSON.stringify(data.response.data[0].fieldData, null, 2) : "No records");
    
    return data.response.data.map(record => {
        const fieldData = record.fieldData;
        const hourlyRate = fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || 0;
        const projectName = fieldData["customers_Projects::projectName"] || fieldData["customers_Projects::Name"] || "Unknown Project";
        
        return {
            id: fieldData.__ID,
            recordId: record.recordId,
            customerId: fieldData["_custID"],
            customerName: fieldData["Customers::Name"] || "Unknown Customer",
            projectId: fieldData._projectID,
            projectName: projectName,
            amount: calculateAmount(fieldData.Billable_Time_Rounded, hourlyRate),
            hours: parseFloat(fieldData.Billable_Time_Rounded || 0),
            rate: parseFloat(hourlyRate),
            date: fieldData.DateStart,
            month: parseInt(fieldData.month || 0),
            year: parseInt(fieldData.year || 0),
            billed: fieldData.f_billed === "1" || fieldData.f_billed === 1,
            description: fieldData["Work Performed"] || "",
            createdAt: fieldData['~creationTimestamp'],
            modifiedAt: fieldData['~ModificationTimestamp'] || fieldData['~modificationTimestamp']
        };
    });
}

/**
 * Formats activity record data for display
 * @param {Object} record - Activity record
 * @returns {Object} Formatted activity data
 */
export function formatActivityRecordForDisplay(record) {
    return {
        id: record.id,
        recordId: record.recordId,
        customerId: record.customerId,
        customerName: record.customerName,
        projectId: record.projectId,
        projectName: record.projectName,
        amount: formatCurrency(record.amount),
        rawAmount: record.amount,
        hours: formatHours(record.hours),
        rawHours: record.hours,
        rate: formatCurrency(record.rate),
        date: formatDate(record.date),
        rawDate: record.date,
        month: record.month,
        year: record.year,
        status: record.billed ? 'Billed' : 'Unbilled',
        billed: record.billed,
        description: record.description,
        created: formatDateTime(record.createdAt),
        modified: formatDateTime(record.modifiedAt)
    };
}

/**
 * Fetches customer activity data with proper AND query structure
 * @param {string} timeframe - The timeframe to fetch ("unbilled", "lastMonth", "custom")
 * @param {string} customerId - Customer ID to filter by (required)
 * @param {Object} dateRange - Optional date range for custom timeframe
 * @returns {Promise} Promise resolving to the customer activity data
 */
export async function fetchCustomerActivityData(timeframe, customerId, dateRange = null) {
    validateParams({ timeframe, customerId }, ['timeframe', 'customerId']);
    
    console.log("[DEBUG] fetchCustomerActivityData called with:", {
        timeframe,
        customerId,
        dateRange
    });
    
    return handleFileMakerOperation(async () => {
        let query = [];
        
        switch (timeframe.toLowerCase()) {
            case 'unbilled': {
                // Create a single query object with both conditions (AND query)
                query = [{
                    "f_billed": "0",
                    "_custID": customerId
                }];
                break;
            }
            case 'lastmonth': {
                const { month, year } = getLastMonthInfo();
                // Create a single query object with all conditions (AND query)
                query = [{
                    "month": month,
                    "year": year,
                    "_custID": customerId
                }];
                break;
            }
            case 'custom': {
                if (!dateRange || !dateRange.start || !dateRange.end) {
                    // Fallback to unbilled if date range is incomplete
                    query = [{
                        "f_billed": "0",
                        "_custID": customerId
                    }];
                } else {
                    // Parse the date range
                    const startDate = new Date(dateRange.start);
                    const endDate = new Date(dateRange.end);
                    
                    console.log("[DEBUG] Custom date range:", {
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    });
                    
                    // Extract year, month from start and end dates
                    const startYear = startDate.getFullYear();
                    const startMonth = startDate.getMonth() + 1; // JavaScript months are 0-indexed
                    const endYear = endDate.getFullYear();
                    const endMonth = endDate.getMonth() + 1;
                    
                    // Format dates for FileMaker (MM/DD/YYYY)
                    const formattedStartDate = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}/${startDate.getFullYear()}`;
                    const formattedEndDate = `${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}/${endDate.getFullYear()}`;
                    
                    // Create a query that filters by customer ID and date range
                    // Using the PRC332 table fields: DateStart, month, year
                    query = [{
                        "_custID": customerId,
                        // Use a date range query for DateStart
                        // FileMaker Data API supports operators like "..." for date ranges
                        "DateStart": `${formattedStartDate}...${formattedEndDate}`,
                    }];
                    
                    console.log("[DEBUG] Custom date range query:", JSON.stringify(query));
                }
                break;
            }
            default:
                throw new Error(`Invalid timeframe for customer activity: ${timeframe}`);
        }
        
        console.log("[DEBUG] Customer activity query:", JSON.stringify(query));
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates an activity record in FileMaker
 * @param {Object} record - The updated record data
 * @returns {Promise} Promise resolving to the update result
 */
export async function updateActivityRecord(record) {
    validateParams({ record }, ['record']);
    
    console.log("[DEBUG] Updating activity record:", record);
    console.log("[DEBUG] Work Performed value:", record.product_name);
    
    return handleFileMakerOperation(async () => {
        // Prepare the data for FileMaker update
        // We need to map the RecordModal format back to FileMaker field names
        const fieldData = {
            // Required fields for identification
            __ID: record.id,
            
            // Fields that can be updated
            "Work Performed": record.product_name || "",
            Billable_Time_Rounded: record.quantity.toString(),
            Hourly_Rate: record.unit_price.toString(),
            
            // Mark as billed if needed
            f_billed: record.inv_id !== null ? "1" : "0"
        };
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.UPDATE,
            UUID: record.id,
            data: {
                fieldData
            },
            recordId: record.recordId
        };
        
        console.log("[DEBUG] Update params:", JSON.stringify(params));
        console.log("[DEBUG] FileMaker fieldData:", fieldData);
        
        return await fetchDataFromFileMaker(params);
    });
}