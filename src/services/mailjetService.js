/**
 * Mailjet Email Service
 *
 * This service provides functionality to send emails with attachments using the Mailjet API.
 */
import FMGofer from 'fm-gofer';
// Direct FileMaker script call as specified by the user
console.log("[DEBUG] Using direct FileMaker script call to send emails via Mailjet");
/**
 * Fetch Mailjet configuration using the FileMaker FMGofer.Performscript call.
 * This function calls the default FileMaker script 'JS * Fetch Data' with action 'returnMailJetConfig'
 * to retrieve a JSON string containing the Mailjet configuration.
 *
 * @returns {Promise<Object>} - Parsed configuration object with keys such as apiKey, secret, senderEmail, and senderName.
 */
async function getMailJetConfig() {
  try {
    // Create a proper payload with the action key as required by FMGopher
    const payload = JSON.stringify({
      action: 'returnMailJetConfig'
    });
    
    console.log("[DEBUG] Fetching Mailjet config with payload:", payload);
    
    const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);
    const rawConfig = JSON.parse(configJson);
    
    //console.log("[INFO] Raw Mailjet config received:", rawConfig);
    
    // Get the current state to access user information
    let userEmail = '';
    let userName = '';
    
    // Try to access the global state if available
    if (typeof window !== 'undefined' && window.state && window.state.user) {
      userEmail = window.state.user.userEmail || '';
      userName = window.state.user.userName || '';
      console.log("[DEBUG] Using user info from global state:", { userEmail, userName });
    }
    
    // Structure the config in the required format with auth property
    // The raw config already has an auth property with apiKey and secret
    const structuredConfig = {
      auth: {
        apiKey: rawConfig.auth?.apiKey || '',
        secretKey: rawConfig.auth?.secret || '' // Rename secret to secretKey
      },
      senderEmail: userEmail || '',
      senderName: userName || ''
    };
    
    console.log("[DEBUG] Structured Mailjet config:", {
      hasApiKey: !!structuredConfig.auth.apiKey,
      hasSecretKey: !!structuredConfig.auth.secretKey,
      apiKey: structuredConfig.auth.apiKey ? structuredConfig.auth.apiKey.substring(0, 5) + '...' : '',
      secretKey: structuredConfig.auth.secretKey ? structuredConfig.auth.secretKey.substring(0, 5) + '...' : '',
      senderEmail: structuredConfig.senderEmail,
      senderName: structuredConfig.senderName
    });
    
    return structuredConfig;
  } catch (error) {
    console.error('Error fetching Mailjet configuration:', error);
    return {
      auth: { apiKey: '', secretKey: '' },
      senderEmail: '',
      senderName: ''
    };
  }
}

/**
 * Send an email with a PDF attachment using Mailjet
 *
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email text content
 * @param {string} options.html - Email HTML content (optional)
 * @param {Object} options.attachment - Attachment details
 * @param {string} options.attachment.filename - Attachment filename
 * @param {string} options.attachment.content - Base64-encoded attachment content
 * @param {string} options.customerName - Customer name for personalization
 * @param {string} options.senderEmail - Email address of the sender
 * @param {string} options.senderName - Name of the sender
 * @returns {Promise<Object>} - Response from Mailjet API
 */
export async function sendEmailWithAttachment(options) {
  try {
    // Fetch configuration from FileMaker using FMGofer.Performscript
    const config = await getMailJetConfig();

    // Retrieve API keys and sender defaults from the configuration
    const apiKey = config.auth.apiKey || '';
    const secretKey = config.auth.secretKey || '';

    // Check if required API keys are available
    if (!apiKey || !secretKey) {
      throw new Error('Mailjet API credentials are not configured');
    }
    
    // Prepare the request to Mailjet API using fetch
    console.log("[DEBUG] Preparing direct API call to Mailjet with keys:", {
      apiKeyPrefix: apiKey ? apiKey.substring(0, 5) + '...' : 'missing',
      secretKeyPrefix: secretKey ? secretKey.substring(0, 5) + '...' : 'missing'
    });
    
    // Create the email payload
    const payload = {
      Messages: [
        {
          From: {
            Email: options.senderEmail ||
                   config.senderEmail ||
                   'noreply@claritybusinesssolutions.ca',
            Name: options.senderName ||
                  config.senderName ||
                  'Charlie - AI Assistant'
          },
          To: [
            {
              Email: options.to,
              Name: options.customerName || null
            }
          ],
          Subject: options.subject,
          TextPart: options.text,
          HTMLPart: options.html || options.text,
          Attachments: [
            {
              ContentType: 'application/pdf',
              Filename: options.attachment.filename,
              Base64Content: options.attachment.content
            }
          ]
        }
      ]
    };
    
    console.log("[DEBUG] Making direct fetch request to Mailjet API");

    // Send the email using FileMaker script as specified by the user
    console.log("[DEBUG] Sending email to:", options.to);
    
    // Get user info from global state if available
    let userEmail = '';
    if (typeof window !== 'undefined' && window.state && window.state.user) {
      userEmail = window.state.user.userEmail || '';
    }
    
    // Create the email payload with authentication information
    const emailPayload = JSON.stringify({
      "data": payload,
      "auth": {"accountID": apiKey,"token": secretKey},
      "call": {"url" : "https://api.mailjet.com/v3.1/send","method" : "POST" }, 
    });
    
    // Create the params structure as specified
    const scriptParams = {
      action: "sendEmail",
      script: "API * Email * Send Mail via MailJet",
      params: emailPayload
    };
    
    console.log("[DEBUG] Created script parameters for email");
    console.log("[DEBUG] Calling FileMaker script:", scriptParams.script);
    
    try {
      // Call FileMaker script with FMGofer
      const responseJson = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
      console.log("[DEBUG] FileMaker script response:", responseJson);
      
      // Parse the response if it's JSON
      let responseData;
      try {
        responseData = JSON.parse(responseJson);
        console.log("[DEBUG] Parsed response:", responseData);
      } catch (parseError) {
        // If it's not JSON, use the raw response
        console.log("[DEBUG] Response is not JSON, using raw response");
        responseData = {
          success: responseJson !== null && responseJson !== undefined,
          message: responseJson
        };
      }
      
      if (responseData && !responseData.error) {
        console.log("[DEBUG] Email sent successfully");
        return {
          success: true,
          data: responseData
        };
      } else {
        throw new Error(responseData?.message || responseJson || 'Unknown error from Mailjet API');
      }
    } catch (error) {
      console.error("[ERROR] FileMaker script error:", error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  } catch (error) {
    console.error('Error sending email with Mailjet:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

/**
 * Check if Mailjet service is properly configured
 * 
 * @returns {Promise<boolean>} - True if Mailjet is configured, false otherwise
 */
export async function isMailjetConfigured() {
  const config = await getMailJetConfig();
  return !!(config.auth.apiKey && config.auth.secretKey);
}

/**
 * Creates a stylish HTML email template with the provided content
 *
 * @param {Object} options - Email content options
 * @param {string} options.title - Email title/subject
 * @param {string} options.mainText - Main email content
 * @param {string} options.buttonText - Text for the call-to-action button (optional)
 * @param {string} options.buttonUrl - URL for the call-to-action button (optional)
 * @param {string} options.footerText - Text for the email footer (optional)
 * @param {string} options.companyName - Company name for branding (optional, defaults to "Clarity Business Solutions")
 * @returns {string} - HTML email content
 */
export function createHtmlEmailTemplate(options) {
  const {
    title,
    mainText,
    buttonText,
    buttonUrl,
    footerText = "This is an automated email from our system.",
    companyName = "Clarity Business Solutions"
  } = options;
  
  // Create button HTML if buttonText and buttonUrl are provided
  const buttonHtml = buttonText && buttonUrl
    ? `<tr>
        <td align="center" style="padding: 20px 0;">
          <a href="${buttonUrl}" target="_blank" style="background-color: #004967; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            ${buttonText}
          </a>
        </td>
      </tr>`
    : '';
  
  // Create the HTML email template
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: #004967;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .email-content {
      padding: 20px;
    }
    .email-footer {
      background-color: #f5f5f5;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="margin: 0; font-size: 24px;">${title}</h1>
    </div>
    <div class="email-content">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px 0;">
            ${mainText.replace(/\n/g, '<br>')}
          </td>
        </tr>
        ${buttonHtml}
      </table>
    </div>
    <div class="email-footer">
      <p>${footerText}</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}