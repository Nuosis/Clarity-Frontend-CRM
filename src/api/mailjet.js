import axios from 'axios';
import { backendConfig } from '../config';
import { generateBackendAuthHeader } from './fileMaker';
import { isValidEmail } from '../utils/validation';

/**
 * Send email via Mailjet using the Python backend API
 * @param {Object} options - Email options
 * @param {Object} options.from_email - Sender information
 * @param {string} options.from_email.email - Sender email address
 * @param {string} options.from_email.name - Sender name
 * @param {Array} options.to - Array of recipient objects
 * @param {string} options.to[].email - Recipient email address
 * @param {string} options.to[].name - Recipient name
 * @param {string} options.subject - Email subject
 * @param {string} options.html_part - HTML content of the email
 * @param {string} options.text_part - Plain text content of the email
 * @returns {Promise<Object>} Response from Mailjet API
 */
export async function sendEmail(options) {
  try {
    const {
      from_email = {
        email: 'info@claritybusinesssolutions.ca',
        name: 'Clarity Business Solutions'
      },
      to,
      subject,
      html_part,
      text_part = 'Email from Clarity Business Solutions'
    } = options;

    // Validate required fields
    if (!to || !Array.isArray(to) || to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    if (!html_part) {
      throw new Error('Email HTML content is required');
    }

    // Validate email addresses
    if (!isValidEmail(from_email.email)) {
      throw new Error('Invalid sender email address');
    }

    for (const recipient of to) {
      if (!isValidEmail(recipient.email)) {
        throw new Error(`Invalid recipient email address: ${recipient.email}`);
      }
    }

    // Prepare request payload
    const payload = {
      from_email,
      to,
      subject,
      html_part,
      text_part
    };

    // Generate authentication header
    const authHeader = await generateBackendAuthHeader(JSON.stringify(payload));

    // Make API request
    const response = await axios.post(
      `${backendConfig.baseUrl}/mailjet/send-email`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      }
    );

    console.log('[Mailjet] Email sent successfully:', response.data);
    return response.data;

  } catch (error) {
    console.error('[Mailjet] Error sending email:', error);

    // Enhanced error handling - throw errors instead of returning success/failure objects
    let errorMessage = 'Failed to send email';

    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        errorMessage += `: ${error.response.data}`;
      } else if (error.response.data.detail) {
        errorMessage += `: ${error.response.data.detail}`;
      } else if (error.response.data.message) {
        errorMessage += `: ${error.response.data.message}`;
      } else if (error.response.data.error) {
        errorMessage += `: ${error.response.data.error}`;
      } else {
        errorMessage += `: ${JSON.stringify(error.response.data)}`;
      }
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}