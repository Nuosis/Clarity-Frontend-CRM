import FMGofer from 'fm-gofer';

/**
 * Formats parameters for FileMaker API calls
 * Ensures consistent parameter structure and version
 */
export function formatParams(params) {
    const formattedParams = {
        ...params,
        version: "vLatest",
        layout: params.layouts || params.layout // Handle both formats
    };
    
    // Remove layouts if present (we use layout consistently)
    delete formattedParams.layouts;
    
    return formattedParams;
}

/**
 * Main function to interact with FileMaker
 * Handles retries, error handling, and response formatting
 */
export async function fetchDataFromFileMaker(params, attempt = 0, isAsync = true) {
    console.log("Attempting to fetch data from FileMaker");
    
    return new Promise((resolve, reject) => {
        if (attempt >= 10) {
            const error = new Error("FileMaker object is unavailable after 1 second");
            error.code = "TIMEOUT";
            reject(error);
            return;
        }

        if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
            setTimeout(() => {
                fetchDataFromFileMaker(params, attempt + 1, isAsync)
                    .then(resolve)
                    .catch(reject);
            }, 100);
            return;
        }

        try {
            const formattedParams = formatParams(params);
            console.log("Formatted params:", formattedParams);
            
            const param = JSON.stringify(formattedParams);
            
            if (isAsync) {
                // Use FMGofer for async operations (default)
                FMGofer.PerformScript("JS * Fetch Data", param)
                    .then(result => handleScriptResult(result, resolve, reject))
                    .catch(error => {
                        console.error("FileMaker script error:", error);
                        error.code = "SCRIPT_ERROR";
                        reject(error);
                    });
            } else {
                // Use FileMaker.PerformScript for sync operations
                try {
                    const result = FileMaker.PerformScript("JS * Fetch Data", param);
                    handleScriptResult(result, resolve, reject);
                } catch (error) {
                    console.error("FileMaker script error:", error);
                    error.code = "SCRIPT_ERROR";
                    reject(error);
                }
            }
        } catch (error) {
            console.error("Error preparing FileMaker request:", error);
            error.code = "PREPARATION_ERROR";
            reject(error);
        }
    });
}

// Helper function to handle script results consistently
function handleScriptResult(result, resolve, reject) {
    if (!result) {
        const error = new Error("FileMaker returned null result");
        error.code = "NULL_RESULT";
        reject(error);
        return;
    }
    
    const parsedResult = JSON.parse(result);
    console.log("FileMaker response:", parsedResult);
    
    if (parsedResult.error) {
        const error = new Error(parsedResult.message || "Unknown FileMaker error");
        error.code = "FM_ERROR";
        error.details = parsedResult.details;
        reject(error);
        return;
    }
    
    resolve(parsedResult);
}

/**
 * Error handler wrapper for FileMaker operations
 * Provides consistent error handling across all API calls
 */
export async function handleFileMakerOperation(operation) {
    try {
        return await operation();
    } catch (error) {
        console.error(`FileMaker operation failed: ${error.message}`, {
            code: error.code,
            details: error.details
        });
        
        // Rethrow with standardized format
        throw {
            error: true,
            message: error.message,
            code: error.code,
            details: error.details
        };
    }
}

/**
 * Validates required parameters for FileMaker operations
 */
export function validateParams(params, required = []) {
    const missing = required.filter(param => !params[param]);
    if (missing.length > 0) {
        throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
}

/**
 * Constants for FileMaker layouts
 */
export const Layouts = {
    CUSTOMERS: 'devCustomers',
    PROJECTS: 'devProjects',
    TASKS: 'devTasks',
    RECORDS: 'devRecords',
    PROJECT_IMAGES: 'devProjectImages',
    PROJECT_LINKS: 'devProjectLinks',
    PROJECT_OBJECTIVES: 'devProjectObjectives',
    PROJECT_OBJ_STEPS: 'devProjectObjSteps'
};

/**
 * Constants for FileMaker actions
 */
export const Actions = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    METADATA: 'metaData',
    DUPLICATE: 'duplicate'
};