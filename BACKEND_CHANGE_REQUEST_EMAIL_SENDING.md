# Backend Change Request: Email Sending API

**Request ID**: BCR-EMAIL-001
**Status**: PENDING
**Priority**: MEDIUM
**Created**: 2026-01-16
**Related Task**: TSK0018 (Remove fm-gofer dependency)

## Summary

Create a backend API endpoint for sending emails via Mailjet with attachment support. This replaces the deprecated FileMaker-based email sending functionality that was removed during the FileMaker frontend removal project.

## Business Context

The frontend currently uses `mailjetService.js` which relied on FileMaker scripts to send emails. With FileMaker integration removed (TSK0018), we need a direct backend API for email sending.

**Affected Features**:
1. **Proposal Email Sending**: Send proposals to customers via email
2. **Activity Report Emails**: Email customer activity reports as PDF attachments

These features are currently **broken** and need backend support to restore functionality.

## Requirements

### API Endpoint Specification

**Endpoint**: `POST /api/email/send`

**Authentication**: HMAC-SHA256 (same as other backend endpoints)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {organization_id}
```

**Request Body**:
```json
{
  "to": "customer@example.com",
  "toName": "Customer Name",
  "subject": "Email Subject",
  "text": "Plain text email content",
  "html": "<html><body>HTML email content</body></html>",
  "from": {
    "email": "sender@claritybusinesssolutions.ca",
    "name": "Sender Name"
  },
  "attachments": [
    {
      "filename": "proposal.pdf",
      "contentType": "application/pdf",
      "base64Content": "JVBERi0xLjQK..."
    }
  ]
}
```

**Field Specifications**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient email address (validated) |
| `toName` | string | No | Recipient display name |
| `subject` | string | Yes | Email subject line |
| `text` | string | Yes | Plain text email body |
| `html` | string | No | HTML email body (fallback to `text` if not provided) |
| `from.email` | string | No | Sender email (default: from config) |
| `from.name` | string | No | Sender name (default: from config) |
| `attachments` | array | No | Array of attachment objects |
| `attachments[].filename` | string | Yes (if attachments) | Attachment filename |
| `attachments[].contentType` | string | Yes (if attachments) | MIME type (e.g., "application/pdf") |
| `attachments[].base64Content` | string | Yes (if attachments) | Base64-encoded file content |

**Success Response** (200 OK):
```json
{
  "success": true,
  "messageId": "1234567890",
  "status": "sent",
  "timestamp": "2026-01-16T12:00:00Z"
}
```

**Error Responses**:

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_EMAIL` | Invalid email address format |
| 400 | `MISSING_REQUIRED_FIELD` | Missing required field (to, subject, text) |
| 400 | `INVALID_ATTACHMENT` | Invalid attachment format or size |
| 401 | `UNAUTHORIZED` | Invalid HMAC signature or missing auth |
| 403 | `FORBIDDEN` | Organization mismatch or insufficient permissions |
| 500 | `MAILJET_API_ERROR` | Mailjet API returned error |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

**Error Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "Invalid recipient email address: not-an-email",
    "details": {
      "field": "to",
      "value": "not-an-email"
    }
  }
}
```

### Backend Implementation Requirements

1. **Mailjet Integration**
   - Use existing Mailjet API credentials from backend environment
   - Support Mailjet API v3.1 send endpoint
   - Handle Mailjet-specific error responses

2. **Configuration**
   - Read Mailjet API key and secret from environment variables
   - Set default sender email and name from configuration
   - Support per-organization sender override (future enhancement)

3. **Validation**
   - Email address format validation (RFC 5322)
   - Attachment size limits (e.g., 10MB per attachment, 25MB total)
   - Content type whitelist for attachments (PDF, images, text)
   - Maximum recipients per request (e.g., 10)

4. **Security**
   - Organization scoping (only send from authenticated org)
   - Rate limiting (e.g., 100 emails per hour per organization)
   - Audit logging (who sent what to whom)
   - Prevent email injection attacks

5. **Error Handling**
   - Graceful Mailjet API error handling
   - Retry logic for transient failures (optional)
   - Detailed error messages for debugging
   - Log errors to backend logging system

6. **Testing**
   - Unit tests for email validation
   - Integration tests with Mailjet sandbox
   - Mock tests for error scenarios
   - Test with various attachment types

### Environment Variables

Required backend environment variables:

```bash
MAILJET_API_KEY=your-api-key-here
MAILJET_SECRET_KEY=your-secret-key-here
MAILJET_DEFAULT_SENDER_EMAIL=noreply@claritybusinesssolutions.ca
MAILJET_DEFAULT_SENDER_NAME=Clarity Business Solutions
MAILJET_MAX_ATTACHMENT_SIZE=10485760  # 10MB in bytes
MAILJET_MAX_TOTAL_SIZE=26214400       # 25MB in bytes
MAILJET_RATE_LIMIT=100                # Emails per hour per org
```

## Frontend Impact

### Files to Update

1. **`src/services/mailjetService.js`**
   - Replace deprecated FileMaker calls with backend API calls
   - Update `sendEmailWithAttachment()` to use `/api/email/send`
   - Update `isMailjetConfigured()` to check backend availability
   - Remove deprecation warnings
   - Update JSDoc comments

2. **`src/services/proposalEmailService.js`**
   - No changes required (uses mailjetService functions)

3. **`src/components/customers/ActivityReportModal.jsx`**
   - No changes required (uses mailjetService functions)

### Frontend Implementation Example

```javascript
// src/services/mailjetService.js (updated)
import { generateBackendAuthHeader } from '../api/dataService';

export async function sendEmailWithAttachment(options) {
  try {
    // Validate email
    if (!isValidEmail(options.to)) {
      return {
        success: false,
        error: `Invalid recipient email address: "${options.to}"`
      };
    }

    // Prepare request
    const payload = {
      to: options.to,
      toName: options.customerName,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      from: {
        email: options.senderEmail,
        name: options.senderName
      },
      attachments: options.attachment ? [{
        filename: options.attachment.filename,
        contentType: 'application/pdf',
        base64Content: options.attachment.content
      }] : []
    };

    // Call backend API
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': generateBackendAuthHeader()
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to send email');
    }

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

export async function isMailjetConfigured() {
  try {
    // Check if backend email endpoint is available
    const response = await fetch('/api/email/health', {
      headers: {
        'Authorization': generateBackendAuthHeader()
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Error checking Mailjet configuration:', error);
    return false;
  }
}
```

## Testing Requirements

### Backend Tests

1. **Unit Tests**
   - Email validation logic
   - Attachment size validation
   - Base64 decoding
   - Error message formatting

2. **Integration Tests**
   - Send email via Mailjet sandbox
   - Send email with PDF attachment
   - Handle Mailjet API errors
   - Verify organization scoping

3. **Security Tests**
   - HMAC authentication validation
   - Organization isolation
   - Rate limiting
   - Input sanitization

### Frontend Tests

1. **Component Tests**
   - Proposal email flow
   - Activity report email flow
   - Error handling and user feedback

2. **E2E Tests**
   - Send proposal email end-to-end
   - Send activity report with PDF
   - Handle email send failures gracefully

## Migration Steps

### Phase 1: Backend Development
1. Backend team implements `/api/email/send` endpoint
2. Add Mailjet credentials to backend environment
3. Deploy to staging environment
4. Run backend integration tests

### Phase 2: Frontend Integration
1. Update `mailjetService.js` to use backend API
2. Remove deprecation warnings
3. Test locally against staging backend
4. Create pull request with changes

### Phase 3: Testing & Validation
1. QA tests proposal email sending
2. QA tests activity report emails
3. Verify error handling and edge cases
4. Load testing for rate limits

### Phase 4: Production Deployment
1. Deploy backend changes to production
2. Deploy frontend changes to production
3. Monitor error logs for issues
4. Verify email delivery with test accounts

## Acceptance Criteria

- [ ] Backend endpoint `/api/email/send` deployed and functional
- [ ] Endpoint supports all required fields and validation
- [ ] HMAC authentication working correctly
- [ ] Organization scoping enforced
- [ ] Rate limiting implemented
- [ ] Error handling comprehensive and tested
- [ ] Frontend `mailjetService.js` updated to use backend API
- [ ] Proposal email sending restored and working
- [ ] Activity report email sending restored and working
- [ ] All tests passing (unit, integration, E2E)
- [ ] Documentation updated (API docs, CLAUDE.md)
- [ ] Monitoring and alerts configured

## Rollback Plan

If issues arise after deployment:

1. **Frontend Rollback**
   - Revert mailjetService.js changes
   - Re-add deprecation warnings
   - Notify users email sending is unavailable

2. **Backend Rollback**
   - Disable `/api/email/send` endpoint
   - Investigate issues in staging
   - Fix and redeploy

## Dependencies

### Backend Dependencies
- Mailjet Python SDK or direct API integration
- Existing HMAC authentication middleware
- Organization context extraction from JWT
- Rate limiting infrastructure (if not existing)

### Frontend Dependencies
- Existing `generateBackendAuthHeader()` function
- Vite `/api` proxy configuration (already exists)

## Timeline Estimate

| Phase | Duration | Owner |
|-------|----------|-------|
| Backend Development | 2-3 days | Backend Team |
| Backend Testing | 1 day | Backend Team |
| Frontend Integration | 1 day | Frontend Team |
| QA Testing | 1 day | QA Team |
| Production Deployment | 1 day | DevOps |
| **Total** | **6-7 days** | - |

## Questions for Backend Team

1. Are Mailjet credentials already available in backend environment?
2. Is rate limiting infrastructure available or needs to be built?
3. Should we support email templates (future enhancement)?
4. Should we log all sent emails in database for audit trail?
5. Any concerns about attachment size limits (10MB reasonable)?
6. Should we support BCC/CC recipients?
7. Need to support reply-to address?

## Additional Notes

- This replaces FileMaker-based email sending removed in TSK0018
- Email validation and HTML template functions are already available in frontend
- Frontend is ready to integrate once backend endpoint is available
- Consider future enhancements: email templates, scheduled sending, delivery tracking

## Related Documentation

- **TSK0018 Completion Summary**: `.devflow/tasks/filemaker-frontend-removal/TSK0018_COMPLETION_SUMMARY.md`
- **Mailjet API Docs**: https://dev.mailjet.com/email/guides/send-api-v31/
- **HMAC Authentication**: Backend API documentation (OpenAPI spec)
