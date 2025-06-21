/**
 * Marketing API module for bulk email operations
 * Integrates with the backend bulk email endpoint
 */

/**
 * Create HMAC signature for authentication
 * @param {string} secret - The secret key
 * @param {string} payload - The request payload
 * @returns {Object} - Object containing signature and timestamp
 */
function createSignature(secret, payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    
    // Use Web Crypto API for HMAC-SHA256
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    ).then(key => {
        return crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(message)
        );
    }).then(signature => {
        const hexSignature = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return { signature: hexSignature, timestamp };
    });
}

/**
 * Get authentication header
 * @param {string} payload - The request payload
 * @returns {Promise<string>} - The authorization header value
 */
async function getAuthHeader(payload) {
    const secret = import.meta.env.VITE_SECRET_KEY;
    if (!secret) {
        throw new Error('VITE_SECRET_KEY environment variable not set');
    }
    
    const { signature, timestamp } = await createSignature(secret, payload);
    return `Bearer ${signature}.${timestamp}`;
}

/**
 * Parse CSV text into an array of objects
 * @param {string} csvText - The CSV content as text
 * @returns {Array} Array of recipient objects
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
    }

    // Parse header row
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
    
    // Find required columns
    const emailIndex = headers.findIndex(h => h === 'email');
    const nameIndex = headers.findIndex(h => h === 'name');
    const companyIndex = headers.findIndex(h => h === 'company');
    const phoneIndex = headers.findIndex(h => h === 'phone');

    if (emailIndex === -1) {
        throw new Error('CSV file must contain an "Email" column');
    }

    // Parse data rows
    const recipients = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
        
        if (values.length < headers.length) {
            continue; // Skip incomplete rows
        }

        const email = values[emailIndex];
        if (!email || !email.includes('@')) {
            continue; // Skip rows with invalid emails
        }

        const recipient = {
            email: email,
            name: nameIndex !== -1 ? values[nameIndex] : email.split('@')[0],
            company: companyIndex !== -1 ? values[companyIndex] : '',
            phone: phoneIndex !== -1 ? values[phoneIndex] : ''
        };

        recipients.push(recipient);
    }

    return recipients;
}

/**
 * Send information session emails to customers where f_noCom is not 1
 * @param {Array} customers - Array of customer objects with email, name, and f_noCom fields
 * @param {Object} options - Additional options for the email campaign
 * @returns {Promise<Object>} Response from the bulk email API
 */
export async function sendInformationSessionEmails(customers, options = {}) {
    try {
        // Filter customers where f_noCom is not 1 AND have valid email addresses
        const eligibleCustomers = customers.filter(customer => {
            const hasValidEmail = (customer.Email || customer.email) &&
                                 (customer.Email || customer.email).trim() !== '' &&
                                 (customer.Email || customer.email).includes('@');
            return customer.f_noCom !== 1 && hasValidEmail;
        });
        
        if (eligibleCustomers.length === 0) {
            throw new Error('No eligible customers found for email campaign (all customers have f_noCom = 1 or missing email addresses)');
        }

        // Convert customers to the format expected by the backend
        const recipients = eligibleCustomers.map(customer => {
            const email = customer.Email || customer.email;
            const name = customer.Name || customer.name;
            
            // Double-check email exists (should always be true due to filtering above)
            if (!email || email.trim() === '') {
                console.warn('Skipping customer with missing email:', name);
                return null;
            }
            
            return {
                email: email.trim(),
                name: name || email.split('@')[0],
                variables: {
                    customer_name: name?.split(' ')[0] || email.split('@')[0] || 'Valued Customer'
                }
            };
        }).filter(recipient => recipient !== null); // Remove any null entries
        
        // Final check to ensure we have recipients with emails
        if (recipients.length === 0) {
            throw new Error('No valid recipients found after filtering');
        }

        // Prepare the request payload
        const requestPayload = {
            recipients,
            subject: options.subject || "You're Invited to an Informational Session - Clarity Business Solutions",
            batch_size: options.batchSize || 10,
            delay_between_batches: options.delayBetweenBatches || 1.0
        };

        // API endpoint - try different URL format
        const apiUrl = "https://devhook.claritybusinesssolutions.app/mailjet/send-information-session-emails";
        
        // Prepare the request body
        const requestBody = JSON.stringify(requestPayload);
        
        // Get authentication header
        const authHeader = await getAuthHeader(requestBody);
        
        // Make the API call with authentication
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            data: result,
            eligibleCustomers: eligibleCustomers.length,
            totalCustomers: customers.length,
            filteredOut: customers.length - eligibleCustomers.length
        };

    } catch (error) {
        console.error('Error sending information session emails:', error);
        throw error;
    }
}

/**
 * Send information session emails to custom CSV recipients only
 * @param {Array} csvRecipients - Array of recipient objects from CSV upload
 * @param {Object} options - Additional options for the email campaign
 * @returns {Promise<Object>} Response from the bulk email API
 */
export async function sendCustomListInformationSessionEmails(csvFile, options = {}) {
    try {
        if (!csvFile) {
            throw new Error('No CSV file provided');
        }

        // Parse CSV file
        const csvText = await csvFile.text();
        const csvRecipients = parseCSV(csvText);

        if (!csvRecipients || csvRecipients.length === 0) {
            throw new Error('No recipients found in CSV file');
        }

        // Validate and format recipients
        const recipients = csvRecipients.map(recipient => {
            const email = recipient.email;
            const name = recipient.name || email.split('@')[0];
            
            if (!email || !email.includes('@')) {
                throw new Error(`Invalid email address: ${email}`);
            }
            
            return {
                email: email.trim(),
                name: name,
                variables: {
                    customer_name: recipient.customer_name || name.split(' ')[0] || email.split('@')[0]
                }
            };
        });

        // Prepare the request payload
        const requestPayload = {
            recipients,
            subject: options.subject || "You're Invited to an Informational Session - Clarity Business Solutions",
            batch_size: options.batchSize || 10,
            delay_between_batches: options.delayBetweenBatches || 1.0
        };

        // API endpoint
        const apiUrl = "https://devhook.claritybusinesssolutions.app/mailjet/send-information-session-emails";
        
        // Prepare the request body
        const requestBody = JSON.stringify(requestPayload);
        
        // Get authentication header
        const authHeader = await getAuthHeader(requestBody);
        
        // Make the API call
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            data: result,
            isCustomList: true,
            customRecipients: recipients.length
        };

    } catch (error) {
        console.error('Error sending custom list information session emails:', error);
        throw error;
    }
}

/**
 * Send test information session email to marcus@claritybusinesssolutions.ca only
 * @param {Object} options - Additional options for the email campaign
 * @returns {Promise<Object>} Response from the bulk email API
 */
export async function sendTestInformationSessionEmail(options = {}) {
    try {
        // Create test recipient for Marcus
        const testRecipient = {
            email: "marcus@claritybusinesssolutions.ca",
            name: "Marcus Swift",
            variables: {
                customer_name: "Marcus"
            }
        };

        // Prepare the request payload
        const requestPayload = {
            recipients: [testRecipient],
            subject: options.subject || "[TEST] You're Invited to an Informational Session - Clarity Business Solutions",
            batch_size: 1,
            delay_between_batches: 0
        };

        // API endpoint
        const apiUrl = "https://devhook.claritybusinesssolutions.app/mailjet/send-information-session-emails";
        
        // Prepare the request body
        const requestBody = JSON.stringify(requestPayload);
        
        // Get authentication header
        const authHeader = await getAuthHeader(requestBody);
        
        // Make the API call
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            data: result,
            isTest: true,
            testRecipient: testRecipient.email
        };

    } catch (error) {
        console.error('Error sending test information session email:', error);
        throw error;
    }
}

/**
 * Validate template before sending bulk emails
 * @param {string} templatePath - Path to the email template
 * @param {Object} sampleVariables - Sample variables for template validation
 * @returns {Promise<Object>} Validation result
 */
export async function validateEmailTemplate(templatePath, sampleVariables = {}) {
    try {
        const apiUrl = "https://devhook.claritybusinesssolutions.app/mailjet/validate-template";
        
        // Prepare the request body
        const requestBody = JSON.stringify({
            template_path: templatePath,
            sample_variables: sampleVariables
        });
        
        // Get authentication header
        const authHeader = await getAuthHeader(requestBody);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Template validation failed with status ${response.status}: ${errorText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error validating email template:', error);
        throw error;
    }
}

/**
 * Send custom bulk email campaign
 * @param {Array} recipients - Array of recipient objects
 * @param {Object} emailConfig - Email configuration (subject, template, etc.)
 * @returns {Promise<Object>} Response from the bulk email API
 */
export async function sendCustomBulkEmail(recipients, emailConfig) {
    try {
        const requestPayload = {
            subject: emailConfig.subject,
            template_path: emailConfig.templatePath,
            recipients: recipients,
            global_variables: emailConfig.globalVariables || {},
            batch_size: emailConfig.batchSize || 10,
            delay_between_batches: emailConfig.delayBetweenBatches || 1.0
        };

        const apiUrl = "https://devhook.claritybusinesssolutions.app/mailjet/send-bulk-email";
        
        // Prepare the request body
        const requestBody = JSON.stringify(requestPayload);
        
        // Get authentication header
        const authHeader = await getAuthHeader(requestBody);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error sending custom bulk email:', error);
        throw error;
    }
}

/**
 * Get campaign status
 * @param {string} campaignId - Campaign ID to check status for
 * @returns {Promise<Object>} Campaign status
 */
export async function getCampaignStatus(campaignId) {
    try {
        const apiUrl = `https://devhook.claritybusinesssolutions.app/mailjet/campaign-status/${campaignId}`;
        
        // For GET requests, use empty payload
        const authHeader = await getAuthHeader('');
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get campaign status with status ${response.status}: ${errorText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error getting campaign status:', error);
        throw error;
    }
}