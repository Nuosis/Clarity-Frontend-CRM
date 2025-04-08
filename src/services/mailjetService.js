/**
 * Mailjet Email Service
 * 
 * This service provides functionality to send emails with attachments using the Mailjet API.
 */

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
 * @returns {Promise<Object>} - Response from Mailjet API
 */
export async function sendEmailWithAttachment(options) {
  try {
    // Check if required environment variables are set
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
      throw new Error('Mailjet API credentials are not configured');
    }

    // Prepare the request to Mailjet API
    const mailjet = require('node-mailjet').connect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_SECRET_KEY
    );

    // Create the email request
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_SENDER_EMAIL || 'noreply@example.com',
            Name: process.env.MAILJET_SENDER_NAME || 'CRM System'
          },
          To: [
            {
              Email: options.to,
              Name: options.customerName || options.to
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
    });

    // Send the email
    const response = await request;
    return {
      success: true,
      data: response.body
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
 * Check if Mailjet service is properly configured
 * 
 * @returns {boolean} - True if Mailjet is configured, false otherwise
 */
export function isMailjetConfigured() {
  return !!(process.env.MAILJET_API_KEY && 
           process.env.MAILJET_SECRET_KEY && 
           process.env.MAILJET_SENDER_EMAIL);
}