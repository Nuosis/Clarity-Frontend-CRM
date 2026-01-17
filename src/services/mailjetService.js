/**
 * Mailjet Email Service
 *
 * **DEPRECATED**: This service is deprecated as of FileMaker removal (TSK0018).
 * Email functionality needs to be migrated to a backend API endpoint.
 *
 * **Current Status**:
 * - FileMaker integration removed
 * - Service stubbed to prevent build errors
 * - All email functions will return errors until backend integration is complete
 *
 * **Migration Path**:
 * 1. Backend team: Create /api/email/send endpoint with Mailjet integration
 * 2. Frontend: Replace this service with backend API calls
 * 3. See: BACKEND_CHANGE_REQUEST_EMAIL_SENDING.md (to be created)
 *
 * This service provides functionality to send emails with attachments using the Mailjet API.
 *
 * @deprecated Use backend API email endpoint instead (when available)
 */

// FileMaker integration removed - fm-gofer dependency eliminated
// import FMGofer from 'fm-gofer'; // REMOVED - TSK0018
console.warn("[DEPRECATED] mailjetService.js: FileMaker email integration removed. Email sending functionality requires backend API migration.");
/**
 * Fetch Mailjet configuration using the FileMaker FMGofer.Performscript call.
 * This function calls the default FileMaker script 'JS * Fetch Data' with action 'returnMailJetConfig'
 * to retrieve a JSON string containing the Mailjet configuration.
 *
 * @deprecated FileMaker integration removed - needs backend API replacement
 * @returns {Promise<Object>} - Parsed configuration object with keys such as apiKey, secret, senderEmail, and senderName.
 */
async function getMailJetConfig() {
  console.error('[DEPRECATED] getMailJetConfig: FileMaker integration removed. Cannot fetch Mailjet config.');
  return {
    auth: { apiKey: '', secretKey: '' },
    senderEmail: '',
    senderName: ''
  };
}

/**
 * Send an email with a PDF attachment using Mailjet
 *
 * @deprecated FileMaker integration removed - needs backend API replacement
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
 * @returns {Promise<Object>} - Response from Mailjet API (currently returns error)
 */
export async function sendEmailWithAttachment(options) {
  try {
    // Validate recipient email address
    if (!isValidEmail(options.to)) {
      return {
        success: false,
        error: `Invalid recipient email address: "${options.to || ''}"`
      };
    }
    
    // Fetch configuration from FileMaker using FMGofer.Performscript
    const config = await getMailJetConfig();

    // Retrieve API keys and sender defaults from the configuration
    const apiKey = config.auth.apiKey || '';
    const secretKey = config.auth.secretKey || '';

    // Check if required API keys are available
    if (!apiKey || !secretKey) {
      throw new Error('Mailjet API credentials are not configured');
    }
    
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
    
    // DEPRECATED: FileMaker integration removed (TSK0018)
    // Email sending functionality needs backend API migration
    console.error('[DEPRECATED] sendEmailWithAttachment: FileMaker integration removed. Email not sent.');
    return {
      success: false,
      error: 'Email sending functionality is temporarily unavailable. FileMaker integration has been removed and backend API migration is pending.'
    };
  } catch (error) {
    console.error('Error sending email with Mailjet:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

/**
 * Validates an email address format
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if email is valid, false otherwise
 */
export function isValidEmail(email) {
  if (!email) return false;
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if Mailjet service is properly configured
 *
 * @deprecated FileMaker integration removed - needs backend API replacement
 * @returns {Promise<boolean>} - True if Mailjet is configured, false otherwise (currently always returns false)
 */
export async function isMailjetConfigured() {
  console.warn('[DEPRECATED] isMailjetConfigured: FileMaker integration removed. Always returns false.');
  return false;
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
