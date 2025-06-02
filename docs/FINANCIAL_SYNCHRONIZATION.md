# Financial Synchronization System

## Overview

The Financial Synchronization System ensures that records in devRecords (FileMaker) match what is registered in customer_sales (Supabase) for given date ranges. When records don't match, they are automatically updated to reflect what is in devRecords, maintaining data consistency across systems.

## Architecture

### Core Components

1. **FinancialSyncService** (`src/services/financialSyncService.js`)
   - Core synchronization logic
   - Comparison algorithms
   - Data transformation utilities

2. **useFinancialSync Hook** (`src/hooks/useFinancialSync.js`)
   - React hook for managing sync state
   - Provides convenient methods for common operations
   - Handles loading states and error management

3. **FinancialSyncPanel Component** (`src/components/financial/FinancialSyncPanel.jsx`)
   - User interface for managing synchronization
   - Preview functionality
   - Status monitoring and history

## Key Features

### Data Synchronization
- **Bidirectional Comparison**: Compares devRecords with customer_sales records
- **Smart Matching**: Uses financial_id to link records between systems
- **Conflict Resolution**: Always prioritizes devRecords as the source of truth
- **Batch Operations**: Efficiently processes multiple records

### User Interface
- **Status Dashboard**: Real-time sync status for date ranges
- **Preview Mode**: Shows what changes will be made before applying them
- **Quick Actions**: One-click sync for current/previous months
- **History Tracking**: Maintains record of sync operations

### Safety Features
- **Dry Run Mode**: Preview changes without applying them
- **Error Handling**: Comprehensive error reporting and recovery
- **Validation**: Data validation before sync operations
- **Rollback Support**: Detailed logging for troubleshooting

## Usage

### Basic Integration

```jsx
import { FinancialSyncPanel } from '../components/financial';
import { useFinancialSync } from '../hooks';

function FinancialDashboard() {
  const { syncStatus, performSync } = useFinancialSync();
  
  const handleSyncComplete = (result) => {
    console.log('Sync completed:', result);
    // Refresh your financial data
  };

  return (
    <div>
      <FinancialSyncPanel onSyncComplete={handleSyncComplete} />
    </div>
  );
}
```

### Programmatic Sync

```jsx
import { useFinancialSync } from '../hooks';

function MyComponent() {
  const { performSync, checkSyncStatus } = useFinancialSync();
  
  const handleSync = async () => {
    // Check status first
    const status = await checkSyncStatus('2024-01-01', '2024-01-31');
    
    if (!status.data.status.inSync) {
      // Perform sync
      const result = await performSync('2024-01-01', '2024-01-31', {
        deleteOrphaned: false
      });
      
      if (result.success) {
        console.log('Sync completed successfully');
      }
    }
  };
}
```

### Service-Level Usage

```javascript
import { synchronizeFinancialRecords } from '../services/financialSyncService';

// Direct service usage
const syncResult = await synchronizeFinancialRecords(
  organizationId,
  '2024-01-01',
  '2024-01-31',
  {
    dryRun: false,
    deleteOrphaned: true
  }
);
```

## API Reference

### FinancialSyncService

#### `synchronizeFinancialRecords(organizationId, startDate, endDate, options)`

Synchronizes devRecords with customer_sales for a date range.

**Parameters:**
- `organizationId` (string): The organization ID
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format
- `options` (object): Sync options
  - `dryRun` (boolean): Preview mode, default false
  - `deleteOrphaned` (boolean): Delete orphaned records, default false

**Returns:**
```javascript
{
  success: boolean,
  summary: {
    devRecordsCount: number,
    customerSalesCount: number,
    toCreate: number,
    toUpdate: number,
    toDelete: number,
    unchanged: number
  },
  changes: {
    created: Array,
    updated: Array,
    deleted: Array,
    errors: Array
  },
  dryRun: boolean
}
```

#### `getFinancialSyncStatus(organizationId, startDate, endDate)`

Gets synchronization status without making changes.

**Returns:**
```javascript
{
  success: boolean,
  status: {
    inSync: boolean,
    devRecordsCount: number,
    customerSalesCount: number,
    recordsToCreate: number,
    recordsToUpdate: number,
    recordsToDelete: number,
    unchangedRecords: number
  },
  details: {
    toCreate: Array,
    toUpdate: Array,
    toDelete: Array
  }
}
```

### useFinancialSync Hook

#### State Properties
- `loading` (boolean): Current loading state
- `error` (string|null): Current error message
- `syncStatus` (object|null): Last sync status check result
- `lastSyncResult` (object|null): Result of last sync operation

#### Methods
- `checkSyncStatus(startDate, endDate)`: Check sync status for date range
- `previewSync(startDate, endDate, options)`: Preview sync changes
- `performSync(startDate, endDate, options)`: Perform actual sync
- `syncCurrentMonth(options)`: Quick sync for current month
- `syncPreviousMonth(options)`: Quick sync for previous month
- `syncMonth(year, month, options)`: Sync specific month

## Data Flow

### 1. Data Fetching
```
devRecords (FileMaker) ←→ FinancialSyncService ←→ customer_sales (Supabase)
```

### 2. Comparison Process
1. Fetch devRecords for date range from FileMaker
2. Fetch customer_sales for date range from Supabase
3. Create lookup maps using financial_id
4. Identify records to create, update, or delete
5. Generate change summary

### 3. Synchronization Process
1. Create missing customer_sales records from devRecords
2. Update existing customer_sales records to match devRecords
3. Optionally delete orphaned customer_sales records
4. Update customer and organization relationships
5. Return detailed results

## Record Matching Logic

### Primary Key Matching
Records are matched using the `financial_id` field:
- devRecords use their internal ID
- customer_sales records store this ID in the `financial_id` column

### Data Transformation
When creating/updating customer_sales records:

```javascript
// Product name formatting
const productName = `${customerNameFormatted}:${projectNameFirstWord}`;

// Customer name formatting (capital letters and numbers only)
const customerNameFormatted = customerName.replace(/[^A-Z0-9]/g, '');

// Project name (first word only)
const projectNameFirstWord = projectName.split(' ')[0];
```

### Field Mapping
| devRecord Field | customer_sales Field | Transformation |
|----------------|---------------------|----------------|
| `id` | `financial_id` | Direct mapping |
| `hours` | `quantity` | Number conversion |
| `rate` | `unit_price` | Number conversion |
| `amount` | `total_price` | Number conversion |
| `date` | `date` | Date formatting |
| `customerName` + `projectName` | `product_name` | Formatted string |

## Error Handling

### Common Errors
1. **Missing Organization ID**: Ensure user has valid organization
2. **Invalid Date Range**: Check date format and range validity
3. **FileMaker Connection**: Verify FileMaker API availability
4. **Supabase Connection**: Check database connectivity
5. **Data Validation**: Ensure required fields are present

### Error Recovery
- Partial sync failures are logged but don't stop the entire process
- Individual record errors are collected and reported
- Rollback information is maintained for troubleshooting

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Records are processed in batches to avoid memory issues
2. **Efficient Queries**: Uses indexed fields for fast lookups
3. **Minimal Data Transfer**: Only fetches required fields
4. **Connection Pooling**: Reuses database connections

### Recommended Limits
- **Date Range**: Limit to 3 months for optimal performance
- **Record Count**: Process up to 1000 records per sync operation
- **Concurrent Syncs**: Avoid running multiple syncs simultaneously

## Monitoring and Logging

### Sync Metrics
- Records processed per second
- Success/failure rates
- Data consistency scores
- Performance benchmarks

### Logging Levels
- **INFO**: Normal sync operations
- **WARN**: Data inconsistencies found
- **ERROR**: Sync failures and exceptions
- **DEBUG**: Detailed operation traces

## Best Practices

### When to Sync
1. **Daily**: Automated sync for previous day's records
2. **Monthly**: Full month sync at month-end
3. **On-Demand**: When data discrepancies are detected
4. **Before Reporting**: Ensure data consistency before generating reports

### Sync Strategy
1. **Start Small**: Begin with single-day ranges
2. **Preview First**: Always preview changes before applying
3. **Monitor Results**: Check sync results and error logs
4. **Backup Data**: Maintain backups before large sync operations

### Data Quality
1. **Validate Sources**: Ensure both systems have clean data
2. **Handle Duplicates**: Check for duplicate records before sync
3. **Maintain Relationships**: Verify customer-organization links
4. **Regular Audits**: Perform periodic data quality checks

## Troubleshooting

### Common Issues

#### Sync Status Shows "Out of Sync" but No Changes Needed
- Check date formatting in both systems
- Verify timezone handling
- Review field mapping configuration

#### Records Not Creating
- Verify organization ID is correct
- Check customer creation permissions
- Ensure required fields are present in devRecords

#### Performance Issues
- Reduce date range size
- Check database connection stability
- Monitor memory usage during sync

#### Data Inconsistencies
- Review field mapping rules
- Check data transformation logic
- Verify source data quality

### Debug Mode
Enable debug logging to trace sync operations:

```javascript
const result = await synchronizeFinancialRecords(
  organizationId,
  startDate,
  endDate,
  { dryRun: true, debug: true }
);
```

## Future Enhancements

### Planned Features
1. **Real-time Sync**: WebSocket-based live synchronization
2. **Conflict Resolution**: Advanced conflict resolution strategies
3. **Audit Trail**: Complete change history tracking
4. **Automated Scheduling**: Cron-based sync scheduling
5. **Performance Analytics**: Detailed performance metrics

### Integration Opportunities
1. **Notification System**: Email/SMS alerts for sync events
2. **Dashboard Widgets**: Sync status in main dashboard
3. **API Endpoints**: REST API for external integrations
4. **Mobile Support**: Mobile app sync capabilities

## Security Considerations

### Data Protection
- All sync operations use encrypted connections
- Sensitive data is masked in logs
- Access controls limit sync permissions
- Audit logs track all sync activities

### Authentication
- User authentication required for all operations
- Organization-level access controls
- API key management for service accounts
- Session timeout handling

## Support

For issues or questions regarding the Financial Synchronization System:

1. Check the troubleshooting section above
2. Review error logs for specific error messages
3. Test with smaller date ranges to isolate issues
4. Contact the development team with detailed error information

## Version History

### v1.0.0 (Current)
- Initial implementation
- Basic sync functionality
- Preview mode support
- Error handling and logging
- React component integration