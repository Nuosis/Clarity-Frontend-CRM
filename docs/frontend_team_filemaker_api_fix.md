# FileMaker API Issue Resolution - Frontend Team

## Issue Summary
The `/filemaker/dapiRecords/records` endpoint was returning `{"detail":"Invalid timestamp format"}` errors. After investigation, we discovered the issue was **not** with FileMaker timestamp formats, but with the **M2M authentication token format**.

## Root Cause
The authentication token format was incorrect. The M2M authentication system expects tokens in the format `signature.timestamp`, but the token being sent had the format `timestamp.signature` (reversed).

## Solution

### ❌ Incorrect Format (what you were sending):
```json
{
  "DateStart": "2025+07+01",
  "TimeStart": "19:30:03",
  "_custID": "E2927B30-1C1F-47B4-BF4A-77BCF1BE74C9",
  "_projectID": "264F981F-0B6A-4122-BF19-B0C568AFF843",
  "_staffID": "AFBE7D6F-C707-4C34-943D-70D7DF68B48F",
  "_taskID": "6EFEA85D-61B1-4BA9-A1C0-E9EA01492EDD"
}
```

### ✅ Correct Format (what the backend expects):
```json
{
  "fields": {
    "DateStart": "07/01/2025",
    "TimeStart": "20:20:45",
    "_custID": "E2927B30-1C1F-47B4-BF4A-77BCF1BE74C9",
    "_projectID": "264F981F-0B6A-4122-BF19-B0C568AFF843",
    "_staffID": "AFBE7D6F-C707-4C34-943D-70D7DF68B48F",
    "_taskID": "6EFEA85D-61B1-4BA9-A1C0-E9EA01492EDD"
  }
}
```

## Working cURL Example
```bash
curl -X POST https://api.claritybusinesssolutions.ca/filemaker/dapiRecords/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_M2M_TOKEN_HERE" \
  -d '{
    "fields": {
      "DateStart": "07/01/2025",
      "TimeStart": "20:20:45",
      "_custID": "E2927B30-1C1F-47B4-BF4A-77BCF1BE74C9",
      "_projectID": "264F981F-0B6A-4122-BF19-B0C568AFF843",
      "_staffID": "AFBE7D6F-C707-4C34-943D-70D7DF68B48F",
      "_taskID": "6EFEA85D-61B1-4BA9-A1C0-E9EA01492EDD"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "record_id": 1916,
  "message": "Record created successfully"
}
```

## Date Format Notes
- Use `MM/dd/yyyy` format for dates (e.g., "07/01/2025")
- Use `HH:mm:ss` format for times (e.g., "20:20:45")
- The US server move is not affecting date parsing - the format above works correctly

## Authentication
- You need a proper M2M Bearer token for authentication
- The token format is: `Bearer {signature}.{timestamp}`
- Contact backend team if you need help generating tokens

## Frontend Code Changes Required
1. Wrap your data object in a `fields` property
2. Update date format from `"2025+07+01"` to `"07/01/2025"`
3. Ensure proper M2M authentication headers

## API Endpoint Details
- **URL:** `https://api.claritybusinesssolutions.ca/filemaker/dapiRecords/records`
- **Method:** POST
- **Content-Type:** `application/json`
- **Authentication:** Required (M2M Bearer token)
- **Layout:** `dapiRecords` (specified in URL path)

Let us know if you need any clarification or assistance with the implementation!