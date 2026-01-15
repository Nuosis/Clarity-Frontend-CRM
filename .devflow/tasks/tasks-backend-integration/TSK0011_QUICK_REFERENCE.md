# TSK0011: Financial Record Integration - Quick Reference

## Log Output Examples

### Successful Stop (Backend API, Billable)
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: abc-123-uuid
[Task Service] Description: Fixed login bug
[Task Service] Save immediately: false
[Task Service] Total pause time: 120 seconds
[Task Service] Adjustment: 360 seconds
[Task Service] Total adjustment: 480 seconds
[Task Service] Timer stopped successfully on attempt 1
[Task Service] Backend API response received
[Task Service] Time entry ID: def-456-uuid
[Task Service] Duration minutes: 30.5
[Task Service] Is billable: true
[Task Service] Status: completed
[Task Service] ✓ Financial record created successfully
[Task Service] Financial record ID: ghi-789-uuid
[Task Service] Amount: 152.50
[Task Service] Hours: 0.51
[Task Service] Rate: 300
[Task Service] Is billable: true
[Task Service] ========== STOP TIMER SUCCESS ==========
```

### Successful Stop (Backend API, Fixed-Price)
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: abc-123-uuid
[Task Service] Description: Project work
[Task Service] Save immediately: false
[Task Service] Total pause time: 0 seconds
[Task Service] Adjustment: 0 seconds
[Task Service] Total adjustment: 0 seconds
[Task Service] Timer stopped successfully on attempt 1
[Task Service] Backend API response received
[Task Service] Time entry ID: def-456-uuid
[Task Service] Duration minutes: 45
[Task Service] Is billable: false
[Task Service] Status: completed
[Task Service] ⚠ No financial record created
[Task Service] Reason: Likely fixed-price project or non-billable time entry
[Task Service] ========== STOP TIMER SUCCESS ==========
```

### Retry After Network Error
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: abc-123-uuid
[Task Service] Description: Database optimization
[Task Service] Save immediately: true
[Task Service] Total pause time: 0 seconds
[Task Service] Adjustment: 0 seconds
[Task Service] Total adjustment: 0 seconds
[Task Service] ✗ Stop timer attempt 1 failed: Network Error
[Task Service] Retrying in 1000 ms...
[Task Service] Timer stopped successfully on attempt 2
[Task Service] Backend API response received
[Task Service] Time entry ID: def-456-uuid
[Task Service] Duration minutes: 15
[Task Service] Is billable: true
[Task Service] Status: completed
[Task Service] ✓ Financial record created successfully
[Task Service] Financial record ID: ghi-789-uuid
[Task Service] Amount: 75.00
[Task Service] Hours: 0.25
[Task Service] Rate: 300
[Task Service] Is billable: true
[Task Service] ========== STOP TIMER SUCCESS ==========
```

### FileMaker Legacy (Fixed-Price)
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: 12345
[Task Service] Description: Client meeting
[Task Service] Save immediately: false
[Task Service] Total pause time: 0 seconds
[Task Service] Adjustment: 0 seconds
[Task Service] Total adjustment: 0 seconds
[Task Service] Timer stopped successfully on attempt 1
[Task Service] FileMaker legacy response received
[Task Service] Processing FileMaker financial record sync...
[Task Service] Organization ID: org-uuid-123
[Task Service] Fetching financial record by recordId: 12345
[Task Service] Found financial ID: fin-uuid-456
[Task Service] Project fixed price value: 5000
[Task Service] ⚠ Fixed-price project detected (fixedPrice = 5000)
[Task Service] Skipping sales record creation for fixed-price project
[Task Service] ⚠ No sales record created: Fixed-price project
[Task Service] ========== STOP TIMER SUCCESS ==========
```

### Partial Failure (FileMaker, Sales Sync Failed)
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: 12345
[Task Service] Description: Development work
[Task Service] Save immediately: false
[Task Service] Total pause time: 0 seconds
[Task Service] Adjustment: 0 seconds
[Task Service] Total adjustment: 0 seconds
[Task Service] Timer stopped successfully on attempt 1
[Task Service] FileMaker legacy response received
[Task Service] Processing FileMaker financial record sync...
[Task Service] Organization ID: org-uuid-123
[Task Service] Fetching financial record by recordId: 12345
[Task Service] Found financial ID: fin-uuid-456
[Task Service] Project fixed price value: 0
[Task Service] Creating sales record for financial record: fin-uuid-456
[Task Service] ✗ Error in FileMaker sales record sync: Database connection failed
[Task Service] Stack trace: Error: Database connection failed...
[Task Service] Timer stopped but sales sync failed - returning result anyway
[Task Service] ========== STOP TIMER PARTIAL SUCCESS ==========
```

### Complete Failure After Retries
```
[Task Service] ========== STOP TIMER START ==========
[Task Service] Stopping timer: abc-123-uuid
[Task Service] Description: Code review
[Task Service] Save immediately: false
[Task Service] Total pause time: 0 seconds
[Task Service] Adjustment: 0 seconds
[Task Service] Total adjustment: 0 seconds
[Task Service] ✗ Stop timer attempt 1 failed: Network Error
[Task Service] Retrying in 1000 ms...
[Task Service] ✗ Stop timer attempt 2 failed: Network Error
[Task Service] Retrying in 2000 ms...
[Task Service] ✗ Stop timer attempt 3 failed: Network Error
[Task Service] ✗✗✗ All stop timer attempts failed after 3 tries
[Task Service] Final error: Network Error
[Task Service] Stack trace: Error: Network Error...
[Task Service] ========== STOP TIMER FAILED ==========
```

## Key Log Indicators

| Indicator | Meaning |
|-----------|---------|
| `==========` | Operation boundary (start/end) |
| `✓` | Success |
| `⚠` | Warning (non-critical) |
| `✗` | Error (non-fatal) |
| `✗✗✗` | Critical error (fatal) |

## Response Patterns

### Backend API Success
```javascript
{
  time_entry: {
    id: "uuid",
    duration_minutes: 30,
    status: "completed",
    is_billable: true
  },
  financial_record: {  // Optional
    id: "uuid",
    amount: 150.00,
    hours: 0.5,
    rate: 300
  }
}
```

### FileMaker Legacy Success
```javascript
{
  response: {
    data: [...],
    messages: [...]
  }
}
```

## Common Issues and Solutions

### Issue: Timer stops but no financial record

**Possible Causes:**
1. Fixed-price project (expected behavior)
2. Non-billable time entry (expected behavior)
3. Backend configuration issue (unexpected)

**How to diagnose:**
- Check logs for "No financial record created"
- Check "Reason: Likely fixed-price project or non-billable time entry"
- Verify project's `fixed_price` field in database

### Issue: "All stop timer attempts failed"

**Possible Causes:**
1. Network connectivity issues
2. Backend API unavailable
3. Invalid timer ID

**How to diagnose:**
- Check "Final error" message in logs
- Check network connectivity
- Verify backend health endpoint
- Verify timer ID is valid UUID

### Issue: "Timer stopped but sales sync failed"

**Possible Causes:**
1. FileMaker database connection issue
2. Organization ID missing or invalid
3. Sales record already exists

**How to diagnose:**
- Check "Error in FileMaker sales record sync" message
- Verify organization ID is set
- Check FileMaker database connectivity
- This is non-critical - timer was stopped successfully

## Debugging Tips

### Enable Verbose Logging
Logs are already comprehensive. Just open browser console (F12) and filter by `[Task Service]`.

### Check Network Tab
If retries are happening, check Network tab to see actual API responses.

### Check Backend Logs
Backend logs show financial record creation logic and fixed-price detection.

### Verify Project Configuration
```sql
SELECT id, name, fixed_price, hourly_rate
FROM projects
WHERE id = 'project-uuid';
```

## Performance Notes

- Retry delay: 1s, 2s (exponential backoff)
- Max total delay: 3 seconds
- Logging overhead: Negligible (<1ms per log)
- Backend response time: ~100-500ms typical

## Rollback Procedure

If issues are found in production:

1. Set `USE_BACKEND_API = false` in `src/api/tasks.js`
2. Rebuild and deploy
3. Falls back to FileMaker mode
4. Investigate issues with backend team
5. Fix and re-enable backend mode
