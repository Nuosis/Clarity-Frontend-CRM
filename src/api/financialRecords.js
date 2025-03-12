import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

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
 * Helper function to get quarter months
 * @param {string} quarter - The quarter (1-4)
 * @param {string} year - The year
 * @returns {Array} Array of month objects for the quarter
 */
function getQuarterMonths(quarter, year) {
    const startMonth = (parseInt(quarter) - 1) * 3 + 1;
    return [
        { "month": startMonth.toString(), "year": year },
        { "month": (startMonth + 1).toString(), "year": year },
        { "month": (startMonth + 2).toString(), "year": year }
    ];
}

/**
 * Helper function to get year months
 * @param {string} year - The year
 * @returns {Array} Array of month objects for the year
 */
function getYearMonths(year) {
    return Array.from({ length: 12 }, (_, i) => ({
        "month": (i + 1).toString(),
        "year": year
    }));
}

/**
 * Builds query parameters for financial records
 * @param {Object} options - Query options
 * @returns {Array} Array of query parameters
 */
function buildFinancialQuery(options = {}) {
    const query = [];
    
    // Add date-based filters
    if (options.month && options.year) {
        query.push({ "month": options.month, "year": options.year });
    }
    
    // Add payment status filter
    if (options.paymentStatus !== undefined) {
        query.push({ "f_billed": options.paymentStatus.toString() });
    }
    
    // Add customer filter
    if (options.customerId) {
        query.push({ "customers_Projects::_custID": options.customerId });
    }
    
    // Add project filter
    if (options.projectId) {
        query.push({ "_projectID": options.projectId });
    }
    
    return query;
}

/**
 * Fetches financial records based on timeframe and optional filters
 * @param {string} timeframe - The timeframe to fetch ("thisMonth", "unpaid", "lastMonth", "thisQuarter", "thisYear")
 * @param {string} customerId - Optional customer ID to filter by
 * @param {string} projectId - Optional project ID to filter by
 * @returns {Promise} Promise resolving to the financial records data
 */
export async function fetchFinancialRecords(timeframe, customerId = null, projectId = null) {
    validateParams({ timeframe }, ['timeframe']);
    
    return handleFileMakerOperation(async () => {
        let query = [];
        
        switch (timeframe.toLowerCase()) {
            case 'today': {
                // Get current date and format it as MM/DD/YYYY for FileMaker
                const now = new Date();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const year = now.getFullYear();
                const formattedDate = `${month}/${day}/${year}`;
                
                query = [{
                    "DateStart": formattedDate,
                    ...(customerId && { "customers_Projects::_custID": customerId }),
                    ...(projectId && { "_projectID": projectId })
                }];
                break;
            }
            case 'thisweek': {
                const { week, year } = getCurrentDateInfo();
                query = [{
                    "weekNo": week,
                    "year": year,
                    ...(customerId && { "customers_Projects::_custID": customerId }),
                    ...(projectId && { "_projectID": projectId })
                }];
                break;
            }
            case 'thismonth': {
                const { month, year } = getCurrentDateInfo();
                query = buildFinancialQuery({ month, year, customerId, projectId });
                break;
            }
            case 'unpaid': {
                query = buildFinancialQuery({ paymentStatus: 0, customerId, projectId });
                break;
            }
            case 'lastmonth': {
                const { month, year } = getLastMonthInfo();
                query = buildFinancialQuery({ month, year, customerId, projectId });
                break;
            }
            case 'thisquarter': {
                // Get current date info
                const now = new Date();
                const currentMonth = now.getMonth() + 1; // 1-12
                const currentYear = now.getFullYear();
                
                // Calculate the last three completed months
                const lastThreeMonths = [];
                for (let i = 1; i <= 3; i++) {
                    let month = currentMonth - i;
                    let year = currentYear;
                    
                    // Adjust for previous year if needed
                    if (month <= 0) {
                        month += 12;
                        year -= 1;
                    }
                    
                    lastThreeMonths.push({
                        "month": month.toString(),
                        "year": year.toString()
                    });
                }
                
                // Get the same three months from the previous year
                const previousYearMonths = lastThreeMonths.map(monthObj => ({
                    "month": monthObj.month,
                    "year": (parseInt(monthObj.year) - 1).toString()
                }));
                
                // Combine both sets of months
                const allMonths = [...lastThreeMonths, ...previousYearMonths];
                
                console.log("API - Last three months:", JSON.stringify(lastThreeMonths));
                console.log("API - Previous year months:", JSON.stringify(previousYearMonths));
                console.log("API - All months:", JSON.stringify(allMonths));
                
                query = allMonths.map(monthObj => ({
                    ...monthObj,
                    ...(customerId && { "customers_Projects::_custID": customerId }),
                    ...(projectId && { "_projectID": projectId })
                }));
                break;
            }
            case 'thisyear': {
                const { year } = getCurrentDateInfo();
                const currentYear = parseInt(year);
                const lastYear = currentYear - 1;
                
                // Get months for current year
                const currentYearMonths = getYearMonths(year);
                
                // Get months for last year
                const lastYearMonths = getYearMonths(lastYear.toString());
                
                // Combine both sets of months
                const allMonths = [...currentYearMonths, ...lastYearMonths];
                
                query = allMonths.map(monthObj => ({
                    ...monthObj,
                    ...(customerId && { "customers_Projects::_custID": customerId }),
                    ...(projectId && { "_projectID": projectId })
                }));
                break;
            }
            default:
                throw new Error(`Invalid timeframe: ${timeframe}`);
        }
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches unpaid financial records for a customer
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the unpaid financial records data
 */
export async function fetchUnpaidRecords(customerId = null) {
    return handleFileMakerOperation(async () => {
        const query = buildFinancialQuery({ paymentStatus: 0, customerId });
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
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
    
    return handleFileMakerOperation(async () => {
        const query = buildFinancialQuery({ month, year, customerId });
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
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
    
    return handleFileMakerOperation(async () => {
        const months = getQuarterMonths(quarter, year);
        const query = months.map(monthObj => ({
            ...monthObj,
            ...(customerId && { "customers_Projects::_custID": customerId })
        }));
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches records for a specific year
 * @param {string} year - The year
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Promise} Promise resolving to the yearly financial records data
 */
export async function fetchYearlyRecords(year, customerId = null) {
    validateParams({ year }, ['year']);
    
    return handleFileMakerOperation(async () => {
        const months = getYearMonths(year);
        const query = months.map(monthObj => ({
            ...monthObj,
            ...(customerId && { "customers_Projects::_custID": customerId })
        }));
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}