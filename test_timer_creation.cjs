#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');

// Get SECRET_KEY from environment or use a test key
const SECRET_KEY = process.env.VITE_SECRET_KEY || 'test-secret-key';

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {string} Authorization header
 */
function generateAuthHeader(payload = '') {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(message)
        .digest('hex');
    
    return `Bearer ${signature}.${timestamp}`;
}

/**
 * Make authenticated API call
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object} data - Request data
 * @returns {Promise<Object>} API response
 */
function makeAPICall(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const payload = data ? JSON.stringify(data) : '';
        const authHeader = generateAuthHeader(payload);
        
        const options = {
            hostname: 'api.claritybusinesssolutions.ca',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Headers:`, res.headers);
                console.log(`Response: ${responseData}`);
                
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsedData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (payload) {
            req.write(payload);
        }
        
        req.end();
    });
}

async function testTimerCreation() {
    console.log('Testing timer record creation...');
    console.log('Using SECRET_KEY:', SECRET_KEY ? 'Present' : 'Missing');
    
    // Test data from the error logs
    const timerData = {
        fields: {
            DateStart: "07/09/2025",
            TimeStart: "11:11:11",
            _custID: "E2927B30-1C1F-47B4-BF4A-77BCF1BE74C9",
            _projectID: "264F981F-0B6A-4122-BF19-B0C568AFF843",
            _staffID: "AFBE7D6F-C707-4C34-943D-70D7DF68B48F",
            _taskID: "6EFEA85D-61B1-4BA9-A1C0-E9EA01492EDD"
        }
    };

    try {
        // First test health endpoint
        console.log('\n=== Testing Health Endpoint ===');
        const healthResponse = await makeAPICall('/health', 'GET');
        console.log('Health check result:', healthResponse);

        // Test authenticated health endpoint
        console.log('\n=== Testing Authenticated Health Endpoint ===');
        const authHealthResponse = await makeAPICall('/health', 'POST');
        console.log('Authenticated health check result:', authHealthResponse);

        // Test timer creation
        console.log('\n=== Testing Timer Creation ===');
        const timerResponse = await makeAPICall('/filemaker/dapiRecords/records', 'POST', timerData);
        console.log('Timer creation result:', timerResponse);

    } catch (error) {
        console.error('Error during API test:', error);
    }
}

// Run the test
testTimerCreation();