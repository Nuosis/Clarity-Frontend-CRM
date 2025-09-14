import FMGofer from 'fm-gofer';
import axios from 'axios';
import { backendConfig } from '../config';
import { getViteEnv } from '../utils/env';

// Initialize web viewer communication
let bridgeInitialized = false;

if (typeof window !== "undefined") {
    window.addEventListener('message', (event) => {
        if (event.data.type === 'FM_BRIDGE_READY') {
            const timestamp = new Date().toISOString();
            console.log(`[FileMaker Bridge ${timestamp}] Received FM_BRIDGE_READY event`, {
                wasInitialized: bridgeInitialized,
                stack: new Error().stack
            });
            
            if (!bridgeInitialized) {
                window.FileMaker = event.data.api;
                bridgeInitialized = true;
                console.log(`[FileMaker Bridge ${timestamp}] Bridge initialized for the first time`);
            }
        }
    });
}

/**
 * Detect if we're running in FileMaker or web app environment
 * @returns {boolean} True if FileMaker environment, false if web app
 */
function isFileMakerEnvironment() {
    // Check for FileMaker bridge availability
    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
    const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
    
    return hasFMGofer || hasFileMaker;
}

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
async function generateBackendAuthHeader(payload = '') {
    const secretKey = getViteEnv('VITE_SECRET_KEY');
    
    if (!secretKey) {
        console.warn('[FileMaker] SECRET_KEY not available. Using development mode.');
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer dev-token.${timestamp}`;
    }
    
    // Check if Web Crypto API is available
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.warn('[FileMaker] Web Crypto API not available. Using fallback auth.');
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer fallback-token.${timestamp}`;
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    
    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
        const messageData = encoder.encode(message);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const signatureHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        return `Bearer ${signatureHex}.${timestamp}`;
    } catch (error) {
        console.warn('[FileMaker] Crypto operation failed, using fallback:', error);
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer fallback-token.${timestamp}`;
    }
}

/**
 * Convert FileMaker-style parameters to backend API call
 * @param {Object} params - FileMaker-style parameters
 * @returns {Promise<Object>} Backend API response
 */
async function callBackendAPI(params) {
    const { layout, action, query, recordId, data, fieldData } = params;
    // Use fieldData if data is not provided (for consistency with FileMaker API)
    let requestData = data || fieldData;
    
    console.log('[FileMaker] Calling backend API:', { layout, action, recordId });
    
    try {
        let url, method, queryParams;
        console.log("try is called")
        // Map FileMaker actions to HTTP requests
        switch (action) {
            case 'read':
                if (recordId) {
                    // Get specific record
                    url = `/filemaker/${layout}/records/${recordId}`;
                    method = 'GET';
                } else if (query && query.length > 0) {
                    // Find records with query
                    url = `/filemaker/${layout}/_find`;
                    method = 'POST';
                    requestData = { query };
                } else {
                    // Get all records
                    url = `/filemaker/${layout}/records`;
                    method = 'GET';
                    queryParams = { limit: 100 };
                }
                break;
                
            case 'create':
                console.log("create ...")
                url = `/filemaker/${layout}/records`;
                method = 'POST';
                console.log('[FileMaker] Create case - requestData:', requestData);
                // Ensure requestData is set for create operations
                if (!requestData && fieldData) {
                    requestData = fieldData;
                    console.log('[FileMaker] Fixed requestData from fieldData:', requestData);
                }
                break;
                
            case 'update':
                url = `/filemaker/${layout}/records/${recordId}`;
                method = 'PATCH';
                // requestData is already set above
                break;
                
            case 'delete':
                url = `/filemaker/${layout}/records/${recordId}`;
                method = 'DELETE';
                break;
                
            default:
                throw new Error(`Unsupported FileMaker action: ${action}`);
        }
        
        // Prepare request config
        const config = {
            method,
            url: `${backendConfig.baseUrl}${url}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Add request data or query params
        if (requestData) {
            // For backend API, wrap data in 'fields' object for CREATE and UPDATE operations
            if (action === 'create' || action === 'update') {
                config.data = { fields: requestData };
            } else {
                config.data = requestData;
            }
        }
        
        // Add authentication header (calculate signature using the actual payload being sent)
        const payload = config.data ? JSON.stringify(config.data) : '';
        config.headers.Authorization = await generateBackendAuthHeader(payload);
        if (queryParams) {
            config.params = queryParams;
        }
        
        console.log('[FileMaker] Backend API request:', {
            method,
            url: config.url,
            hasData: !!requestData,
            hasParams: !!queryParams
        });
        
        // Make the request
        const response = await axios(config);
        
        console.log('[FileMaker] Backend API response:', response.status);
        console.log('[FileMaker] Backend API response data:', response.data);
        
        // For CREATE operations, ensure we have the proper FileMaker response format
        if (action === 'create') {
            return {
                response: {
                    recordId: response.data.record_id || response.data.recordId || response.data.id,
                    data: response.data.data || response.data,
                    dataInfo: response.data.dataInfo || {}
                },
                messages: response.data.messages || [{ code: '0', message: 'OK' }]
            };
        }
        
        // Return response in FileMaker-compatible format for other operations
        return {
            response: {
                data: response.data.data || response.data,
                dataInfo: response.data.dataInfo || {},
                messages: response.data.messages || [{ code: '0', message: 'OK' }]
            }
        };
        
    } catch (error) {
        console.error('[FileMaker] Backend API error:', error);
        
        // Enhanced error handling to prevent [object Object] display
        let errorMessage = 'Backend API call failed';
        
        if (error.response?.data) {
            // Handle different error response formats
            if (typeof error.response.data === 'string') {
                errorMessage += `: ${error.response.data}`;
            } else if (error.response.data.detail) {
                errorMessage += `: ${error.response.data.detail}`;
            } else if (error.response.data.message) {
                errorMessage += `: ${error.response.data.message}`;
            } else if (error.response.data.error) {
                errorMessage += `: ${error.response.data.error}`;
            } else {
                // If it's an object but no known error fields, stringify it
                errorMessage += `: ${JSON.stringify(error.response.data)}`;
            }
        } else if (error.message) {
            errorMessage += `: ${error.message}`;
        } else {
            // Fallback for any other error format
            errorMessage += `: ${String(error)}`;
        }
        
        throw new Error(errorMessage);
    }
}

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
 * Handles both FileMaker and web app environments automatically
 * Routes to appropriate backend based on environment detection
 */
export async function fetchDataFromFileMaker(params, attempt = 0, isAsync = true) {
    const timestamp = new Date().toISOString();
    console.log(`[FileMaker API ${timestamp}] Fetching data:`, { params });
    
    // Check if we have app environment context available
    const appElement = document.querySelector('[data-app-environment]');
    const appEnvironment = appElement?.getAttribute('data-app-environment');
    
    // Use app environment context if available, otherwise fall back to detection
    const useFileMakerBridge = appEnvironment === 'filemaker' ||
        (appEnvironment === null && isFileMakerEnvironment());
    
    if (useFileMakerBridge) {
        console.log('[FileMaker] Using FileMaker native bridge');
        return await handleFileMakerNativeCall(params, attempt, isAsync);
    } else {
        console.log('[FileMaker] Using backend API for web app environment');
        return await callBackendAPI(params);
    }
}

/**
 * Handle FileMaker native calls (original implementation)
 * @param {Object} params - FileMaker parameters
 * @param {number} attempt - Retry attempt number
 * @param {boolean} isAsync - Whether to use async operations
 * @returns {Promise<Object>} FileMaker response
 */
async function handleFileMakerNativeCall(params, attempt = 0, isAsync = true) {
    return new Promise((resolve, reject) => {
        if (attempt >= 30) { // 30 retries = 3 seconds
            const error = new Error("FileMaker object is unavailable after 3 seconds");
            error.code = "TIMEOUT";
            reject(error);
            return;
        }

        if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
            setTimeout(() => {
                handleFileMakerNativeCall(params, attempt + 1, isAsync)
                    .then(resolve)
                    .catch(reject);
            }, 100);
            return;
        }

        try {
            const formattedParams = formatParams(params);
            const param = JSON.stringify(formattedParams);
            const layout = formattedParams.layout;
            
            // Special case for returnRecords calls
            if (formattedParams.callBackName === "returnRecords") {
                FileMaker.PerformScript("JS * Fetch Data", param);
                resolve({ status: "pending" }); // Resolve immediately, actual data comes through callback
            } else if (formattedParams.callBackName === "returnContext") {
                FileMaker.PerformScript("JS * Fetch Data", param);
                resolve({ status: "pending" }); // Resolve immediately, actual data comes through callback
            } else if (isAsync) {
                // Use FMGofer for async operations (default)
                FMGofer.PerformScript("JS * Fetch Data", param)
                    .then(result => handleScriptResult(layout, result, resolve, reject))
                    .catch(error => {
                        console.error("FileMaker script error:", error);
                        const scriptError = new Error(error.message || String(error));
                        scriptError.code = "SCRIPT_ERROR";
                        scriptError.originalError = error;
                        reject(scriptError);
                    });
            } else {
                // Use FileMaker.PerformScript for sync operations
                try {
                    const result = FileMaker.PerformScript("JS * Fetch Data", param);
                    handleScriptResult(layout, result, resolve, reject);
                } catch (error) {
                    console.error("FileMaker script error:", error);
                    const scriptError = new Error(error.message || String(error));
                    scriptError.code = "SCRIPT_ERROR";
                    scriptError.originalError = error;
                    reject(scriptError);
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
function handleScriptResult(layout, result, resolve, reject) {
    if (!result) {
        const error = new Error("FileMaker returned null result");
        error.code = "NULL_RESULT";
        reject(error);
        return;
    }
    
    const parsedResult = JSON.parse(result);
    //console.log(`FileMaker ${layout} response:`, parsedResult);
    
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
        
        // Create a new error object with standardized format
        const formattedError = new Error(error.message || String(error));
        formattedError.error = true;
        formattedError.code = error.code || 'UNKNOWN_ERROR';
        formattedError.details = error.details;
        throw formattedError;
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
    RECORDS: 'dapiRecords',
    NOTES: 'devNotes',
    LINKS: 'devLinks',
    IMAGES: 'devImages',
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

/**
 * Initializes QuickBooks for a specific customer
 * Sends unbilled records to QB for processing
 *
 * @param {Object|string} params - Either a customer ID string or an object with customer and record details
 * @param {string} params.custId - The ID of the customer to process in QuickBooks
 * @param {Array} [params.records] - Array of record IDs to process in QuickBooks (legacy format)
 * @param {Object} [params.recordsByProject] - Object mapping project IDs to arrays of record IDs
 * @returns {Promise} A promise that resolves when the script completes
 */
export async function initializeQuickBooks(params) {
    // Handle both string (backward compatibility) and object formats
    const isObject = typeof params === 'object' && params !== null;
    const customerId = isObject ? params.custId : params;
    
    console.log("QuickBooks initialization details:", {
        customerId,
        isObject,
        paramsType: typeof params,
        hasRecordsByProject: isObject && !!params.recordsByProject,
        recordsByProjectKeys: isObject ? Object.keys(params.recordsByProject || {}) : []
    });
    
    if (!customerId) {
        throw new Error('Customer ID is required for QuickBooks initialization');
    }
    
    return new Promise((resolve, reject) => {
        try {
            if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
                const error = new Error("FileMaker object is unavailable");
                error.code = "FM_UNAVAILABLE";
                reject(error);
                return;
            }
            
            // Prepare the payload based on the input format
            let payload;
            if (isObject) {
                // New format: pass an object with customer ID and record IDs (grouped by project or flat)
                payload = JSON.stringify(params);
            } else {
                // Legacy format: just pass the customer ID as a string
                payload = customerId;
            }
            
            console.log("Sending QuickBooks payload:", payload);
            
            try {
                // Call the FileMaker script with the payload
                FileMaker.PerformScript("Initialize QB via JS", payload);
            } catch (scriptError) {
                console.error("Error executing FileMaker script:", scriptError);
                throw scriptError;
            }
            
            // Since this is a fire-and-forget operation, resolve immediately
            resolve({ status: "success", message: "QuickBooks initialization requested" });
        } catch (error) {
            console.error("Error initializing QuickBooks:", error);
            error.code = "QB_INIT_ERROR";
            reject(error);
        }
    });
}