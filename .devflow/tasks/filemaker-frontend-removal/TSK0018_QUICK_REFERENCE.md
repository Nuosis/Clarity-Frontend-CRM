# TSK0018: Remove fm-gofer Dependency - Quick Reference

## What Was Done

✅ Removed `fm-gofer` package from dependencies
✅ Deprecated `mailjetService.js` with clear error messages
✅ Build verified successful
✅ No active fm-gofer imports remain

## Current Status

### Email Sending: ⚠️ TEMPORARILY UNAVAILABLE

```javascript
// mailjetService.js functions now return errors:

await sendEmailWithAttachment(options)
// Returns: { success: false, error: 'Email sending functionality is temporarily unavailable...' }

await isMailjetConfigured()
// Returns: false (with console warning)

await getMailJetConfig()
// Returns: { auth: { apiKey: '', secretKey: '' }, senderEmail: '', senderName: '' }
```

### Affected Features

- ❌ Proposal email sending (`proposalEmailService.js`)
- ❌ Activity report emails (`ActivityReportModal.jsx`)

## Migration Path

### Required: Backend API Endpoint

```bash
POST /api/email/send
Content-Type: application/json
Authorization: Bearer {HMAC-signature}.{timestamp}

{
  "to": "customer@example.com",
  "toName": "Customer Name",
  "subject": "Email Subject",
  "text": "Plain text",
  "html": "<html>HTML content</html>",
  "from": {
    "email": "sender@example.com",
    "name": "Sender Name"
  },
  "attachments": [...]
}
```

### Next Steps

1. **Backend Team**: Create email sending endpoint
2. **Frontend Team**: Update `mailjetService.js` to call backend API
3. **QA**: Test proposal and activity report emails
4. **Cleanup**: Remove deprecation warnings

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Removed fm-gofer dependency |
| `package-lock.json` | Updated (npm install) |
| `src/services/mailjetService.js` | Deprecated, stubbed FileMaker calls |

## Build Status

```bash
npm run build
# ✓ built in 2.58s
# No fm-gofer errors
```

## Key Decisions

1. **Service Deprecated, Not Deleted**: Prevents build breaks while signaling unavailability
2. **Clear Error Messages**: Users/devs will see explicit "temporarily unavailable" messages
3. **Migration Path Documented**: Backend API spec included in completion summary
4. **No Feature Flag**: External integration doesn't need feature flag - direct deprecation

## Related Tasks

- **Previous**: TSK0017 (Delete FileMaker API files)
- **Next**: TSK0019 (Remove FileMaker environment variables)
- **Dependency**: Backend email API implementation (not yet scheduled)
