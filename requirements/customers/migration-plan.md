# Migration Plan

This document outlines the strategy for migrating the Customers feature from FileMaker to Supabase, including data backfill, ID reconciliation, cutover approach, validation, and rollback procedures.

## Migration Overview

**Scope**: Migrate ~50+ customers from FileMaker `devCustomers` layout to Supabase `customers` and related tables

**Duration Estimate**: 2-4 weeks (includes backend implementation, data migration, frontend refactor, testing)

**Risk Level**: Medium
- Customers are core entity (dependencies: projects, tasks, financial records)
- Dual-write already partially implemented (reduces risk)
- Rollback possible via feature flag

## Migration Phases

### Phase 1: Backend Preparation (Week 1)
1. Implement schema changes (add `is_active`, `primary_contact_name`, constraints)
2. Implement RLS policies for all customer tables
3. Create backend API endpoints (REST or RPC functions)
4. Write data migration scripts
5. Set up staging environment for testing

### Phase 2: Data Backfill (Week 2)
1. Export all customers from FileMaker
2. Transform and validate data
3. Import to Supabase (staging first, then production)
4. Validate data integrity (counts, relationships, field values)
5. Create ID mapping table for reference

### Phase 3: Frontend Refactor (Week 2-3)
1. Update API layer to use backend endpoints (keep FileMaker as fallback)
2. Add feature flag for gradual rollout
3. Update hooks and services to handle new data structure
4. Update UI components as needed
5. Test all user workflows

### Phase 4: Validation & Cutover (Week 3-4)
1. Enable feature flag for internal users (testing)
2. Monitor errors, performance, data consistency
3. Gradual rollout to external users (10% → 50% → 100%)
4. Full cutover (disable FileMaker integration for customers)
5. Monitor for 1 week, address issues
6. Archive FileMaker data (keep for 30 days as backup)

### Phase 5: Cleanup (Week 4+)
1. Remove FileMaker API calls from `src/api/customers.js`
2. Remove dual-write logic from `useCustomer.js`
3. Remove FileMaker-specific code (formatCustomerForFileMaker, etc.)
4. Update documentation
5. Archive FileMaker data (permanent)

## Data Backfill Strategy

### Step 1: Export FileMaker Data

**Method**: FileMaker Data API + Script

```bash
# Export all customers from FileMaker
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devCustomers/_find" \
  -H "Authorization: Bearer {fm_token}" \
  -H "Content-Type: application/json" \
  -d '{"query": [{"__ID": "*"}]}' \
  > filemaker_customers_export.json
```

**Expected Output**:
```json
{
  "response": {
    "data": [
      {
        "fieldData": {
          "__ID": "uuid-1",
          "Name": "Customer 1",
          "Email": "customer1@example.com",
          "Phone": "+1 (555) 123-4567",
          "f_active": "1",
          "Address": "123 Main St",
          "City": "San Francisco",
          "State": "CA",
          "PostalCode": "94105",
          "Country": "USA",
          "ContactPerson": "John Doe",
          "~creationTimestamp": "2023-01-15T10:30:00",
          "~modificationTimestamp": "2023-12-01T14:45:00"
        },
        "recordId": "42"
      },
      ...
    ]
  }
}
```

### Step 2: Transform Data

**Script**: `scripts/migrate-customers.js`

```javascript
const fs = require('fs');

// Read FileMaker export
const fmData = JSON.parse(fs.readFileSync('filemaker_customers_export.json', 'utf8'));

// Transform to Supabase format
const customers = fmData.response.data.map(record => {
  const { fieldData } = record;

  return {
    // Customers table
    customer: {
      id: fieldData.__ID, // Use FileMaker UUID as Supabase ID
      business_name: fieldData.Name,
      primary_contact_name: fieldData.ContactPerson || null,
      is_active: fieldData.f_active === "1",
      type: 'CUSTOMER',
      organization_id: 'YOUR_ORG_ID', // Set appropriately
      created_at: fieldData['~creationTimestamp'],
      updated_at: fieldData['~modificationTimestamp']
    },

    // Related tables
    emails: fieldData.Email ? [{
      email: fieldData.Email,
      is_primary: true,
      email_type: 'work'
    }] : [],

    phones: fieldData.Phone ? [{
      phone: fieldData.Phone,
      is_primary: true,
      phone_type: 'office'
    }] : [],

    addresses: (fieldData.City && fieldData.State) ? [{
      address_line1: fieldData.Address || '',
      city: fieldData.City || '',
      state: fieldData.State || '',
      postal_code: fieldData.PostalCode || '',
      country: fieldData.Country || ''
    }] : []
  };
});

// Write transformed data
fs.writeFileSync('supabase_customers_import.json', JSON.stringify(customers, null, 2));
```

### Step 3: Validate Data

**Validation Checks**:
1. All FileMaker customers have valid UUIDs
2. No duplicate UUIDs
3. All customers have `business_name` (required)
4. Email and phone formats are valid
5. No orphaned records (all have organization_id)

```javascript
function validateCustomers(customers) {
  const errors = [];
  const seenIds = new Set();

  customers.forEach((c, idx) => {
    // Check UUID
    if (!c.customer.id || !isValidUUID(c.customer.id)) {
      errors.push(`Customer ${idx}: Invalid or missing ID`);
    }

    // Check for duplicates
    if (seenIds.has(c.customer.id)) {
      errors.push(`Customer ${idx}: Duplicate ID ${c.customer.id}`);
    }
    seenIds.add(c.customer.id);

    // Check required fields
    if (!c.customer.business_name || c.customer.business_name.trim() === '') {
      errors.push(`Customer ${idx}: Missing business_name`);
    }

    // Check email format
    c.emails.forEach((email, emailIdx) => {
      if (!isValidEmail(email.email)) {
        errors.push(`Customer ${idx}, Email ${emailIdx}: Invalid format`);
      }
    });

    // Check phone format
    c.phones.forEach((phone, phoneIdx) => {
      if (!isValidPhone(phone.phone)) {
        errors.push(`Customer ${idx}, Phone ${phoneIdx}: Invalid format`);
      }
    });
  });

  return errors;
}
```

### Step 4: Import to Supabase

**Method 1: Backend Batch API** (Recommended)

```bash
# Use batch create endpoint
curl -X POST "https://api.claritybusinesssolutions.ca/api/customers/batch" \
  -H "Authorization: Bearer {hmac_signature}.{timestamp}" \
  -H "Content-Type: application/json" \
  -d @supabase_customers_import.json
```

**Method 2: Direct SQL Import** (Faster, requires service role access)

```sql
-- Import customers
INSERT INTO customers (id, business_name, primary_contact_name, is_active, type, organization_id, created_at, updated_at)
VALUES
  ('uuid-1', 'Customer 1', 'John Doe', true, 'CUSTOMER', 'org-uuid', '2023-01-15T10:30:00Z', '2023-12-01T14:45:00Z'),
  ('uuid-2', 'Customer 2', 'Jane Smith', true, 'CUSTOMER', 'org-uuid', '2023-02-01T09:00:00Z', '2023-12-05T16:20:00Z'),
  ...
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  updated_at = EXCLUDED.updated_at;

-- Link to organization
INSERT INTO customer_organization (customer_id, organization_id)
SELECT id, organization_id FROM customers
ON CONFLICT DO NOTHING;

-- Import emails
INSERT INTO customer_email (customer_id, email, is_primary, email_type)
VALUES
  ('uuid-1', 'customer1@example.com', true, 'work'),
  ...
ON CONFLICT DO NOTHING;

-- Import phones
INSERT INTO customer_phone (customer_id, phone, is_primary, phone_type)
VALUES
  ('uuid-1', '+1 (555) 123-4567', true, 'office'),
  ...
ON CONFLICT DO NOTHING;

-- Import addresses
INSERT INTO customer_address (customer_id, address_line1, city, state, postal_code, country)
VALUES
  ('uuid-1', '123 Main St', 'San Francisco', 'CA', '94105', 'USA'),
  ...
ON CONFLICT DO NOTHING;
```

### Step 5: Validate Import

**Validation Queries**:

```sql
-- Check counts
SELECT 'Customers' AS entity, COUNT(*) AS count FROM customers WHERE organization_id = 'org-uuid'
UNION ALL
SELECT 'Emails', COUNT(*) FROM customer_email WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid')
UNION ALL
SELECT 'Phones', COUNT(*) FROM customer_phone WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid')
UNION ALL
SELECT 'Addresses', COUNT(*) FROM customer_address WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid');

-- Expected:
-- Customers: 50+
-- Emails: ~45 (some customers may not have emails)
-- Phones: ~48
-- Addresses: ~40

-- Check for orphaned emails (no matching customer)
SELECT * FROM customer_email
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Expected: 0 rows

-- Check for customers without org link
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM customer_organization);
-- Expected: 0 rows

-- Check for duplicate emails per customer
SELECT customer_id, email, COUNT(*)
FROM customer_email
GROUP BY customer_id, email
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

## ID Reconciliation

### FileMaker → Supabase ID Mapping

**Strategy**: Use FileMaker `__ID` (UUID) as Supabase `customers.id` directly

**Advantages**:
- No additional mapping table needed
- Consistent IDs across systems during transition
- Simplifies queries and debugging

**Implementation**:
```javascript
// During backfill
const supabaseCustomer = {
  id: fileMakerCustomer.__ID, // Direct mapping
  business_name: fileMakerCustomer.Name,
  ...
};
```

**FileMaker `recordId` Handling**:
- `recordId` is FileMaker-internal (not portable)
- **Do NOT migrate** `recordId` to Supabase
- Update frontend to use `__ID` consistently instead of `recordId`

### ID Mapping Table (Optional, for Reference)

If needed for backward compatibility or debugging:

```sql
CREATE TABLE filemaker_id_mapping (
  filemaker_id UUID PRIMARY KEY,           -- FileMaker __ID
  filemaker_record_id INTEGER,             -- FileMaker recordId (internal)
  supabase_id UUID REFERENCES customers(id),
  entity_type TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fm_mapping_record_id ON filemaker_id_mapping(filemaker_record_id);
```

**Populate Mapping Table**:
```sql
INSERT INTO filemaker_id_mapping (filemaker_id, filemaker_record_id, supabase_id, entity_type)
SELECT
  c.id AS filemaker_id,
  NULL AS filemaker_record_id, -- Not available in Supabase export
  c.id AS supabase_id,
  'customer'
FROM customers c
WHERE c.organization_id = 'org-uuid';
```

## Cutover Approach

### Option 1: Feature Flag (Recommended)

**Gradual Rollout**:
1. Implement backend API + data migration
2. Add feature flag in frontend: `VITE_USE_SUPABASE_CUSTOMERS`
3. Update `src/api/customers.js` to route based on flag:

```javascript
// src/api/customers.js
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE_CUSTOMERS === 'true';

export async function fetchCustomers() {
  if (USE_SUPABASE) {
    return await backendAPI.get('/api/customers', { params: { include_related: true } });
  } else {
    // FileMaker fallback
    return handleFileMakerOperation(async () => {
      return await fetchDataFromFileMaker({
        layout: Layouts.CUSTOMERS,
        action: Actions.READ,
        query: [{ "__ID": "*" }]
      });
    });
  }
}
```

4. Enable flag for internal testing (set `VITE_USE_SUPABASE_CUSTOMERS=true` in `.env.development`)
5. If successful, enable in production `.env` for 10% of users (A/B testing)
6. Gradually increase rollout: 10% → 25% → 50% → 100%
7. Remove FileMaker fallback code after 100% rollout

**Advantages**:
- Safe, gradual rollout
- Easy rollback (disable flag)
- Can test in production with real users
- Monitor errors and performance per cohort

**Disadvantages**:
- More complex code (dual paths)
- Requires A/B testing infrastructure (or manual flag per user)

### Option 2: Hard Cutover (Higher Risk)

**One-Time Switch**:
1. Implement backend API + data migration
2. Test thoroughly in staging
3. Schedule maintenance window (e.g., late Friday night)
4. Deploy backend changes
5. Run data migration script
6. Deploy frontend changes (remove FileMaker code entirely)
7. Monitor for issues
8. Rollback if critical issues found (within 24 hours)

**Advantages**:
- Simpler code (single path)
- Faster cleanup
- Clear cutover point

**Disadvantages**:
- Higher risk (all users affected simultaneously)
- Difficult rollback (requires redeployment)
- Downtime during cutover (unless blue-green deployment)

## Data Validation & Reconciliation

### Post-Migration Validation

**Automated Checks** (run daily for 1 week after cutover):

```javascript
// scripts/validate-migration.js
async function validateMigration() {
  const errors = [];

  // 1. Count check
  const fmCount = await getFileMakerCustomerCount();
  const sbCount = await getSupabaseCustomerCount();
  if (fmCount !== sbCount) {
    errors.push(`Count mismatch: FM=${fmCount}, SB=${sbCount}`);
  }

  // 2. Spot-check 10 random customers
  const randomIds = await getRandomCustomerIds(10);
  for (const id of randomIds) {
    const fmCustomer = await fetchFileMakerCustomerById(id);
    const sbCustomer = await fetchSupabaseCustomerById(id);

    if (fmCustomer.Name !== sbCustomer.business_name) {
      errors.push(`Name mismatch for ${id}: FM="${fmCustomer.Name}", SB="${sbCustomer.business_name}"`);
    }

    if (fmCustomer.f_active !== (sbCustomer.is_active ? "1" : "0")) {
      errors.push(`Active status mismatch for ${id}`);
    }
  }

  // 3. Check for orphaned records
  const orphanedEmails = await query('SELECT * FROM customer_email WHERE customer_id NOT IN (SELECT id FROM customers)');
  if (orphanedEmails.length > 0) {
    errors.push(`Found ${orphanedEmails.length} orphaned emails`);
  }

  return errors;
}
```

**Manual Validation**:
1. Review audit logs for unexpected operations
2. Check error logs for migration-related issues
3. Compare customer lists visually (UI vs FileMaker)
4. Verify financial records still link correctly (customer_sales.customer_id)

### Reconciliation Process

If discrepancies found after migration:

1. **Identify Scope**: How many customers affected? Which fields?
2. **Root Cause**: Was it migration script error, timing issue, or data corruption?
3. **Remediation Options**:
   - **Option A**: Re-run migration for affected customers (if few)
   - **Option B**: Manual correction in Supabase (if very few)
   - **Option C**: Full rollback and re-migration (if widespread)
4. **Document Issues**: Update migration script to prevent recurrence

## Rollback Procedures

### Rollback Within 24 Hours (Feature Flag Approach)

**Trigger**: Critical bugs, data corruption, performance issues

**Steps**:
1. Disable feature flag: `VITE_USE_SUPABASE_CUSTOMERS=false`
2. Redeploy frontend (or restart if env vars are hot-reloaded)
3. All users revert to FileMaker immediately
4. Investigate and fix issues in Supabase
5. Re-enable flag when ready

**Data Implications**:
- Any new customers created in Supabase-only mode are lost (if FileMaker not dual-written)
- Need to manually sync changes made during Supabase-enabled period

### Rollback After 24 Hours (Partial Migration)

**Trigger**: Major issues discovered after rollout complete

**Steps**:
1. Revert frontend code to previous version (git revert + deploy)
2. Users revert to FileMaker
3. Export Supabase changes made since cutover (new customers, updates)
4. Import changes back to FileMaker (manual or script)
5. Fix issues and re-plan migration

**Complexity**: High - requires bi-directional sync

### Full Rollback (Last Resort)

**Trigger**: Unrecoverable data corruption, complete system failure

**Steps**:
1. Restore FileMaker from backup (if data was modified)
2. Revert all frontend and backend code changes
3. Drop Supabase customer tables (or mark as archived)
4. Re-assess migration strategy

**Note**: This should be extremely rare with proper testing and gradual rollout.

## Timeline & Milestones

### Week 1: Backend Preparation
- [ ] Schema changes deployed to staging
- [ ] RLS policies implemented and tested
- [ ] Backend API endpoints implemented (REST or RPC)
- [ ] Migration scripts written and tested on dummy data
- [ ] Staging environment validated

**Milestone**: Backend ready for data migration

### Week 2: Data Migration
- [ ] FileMaker data exported
- [ ] Data transformed and validated
- [ ] Data imported to Supabase staging
- [ ] Validation checks passed (counts, integrity, spot-checks)
- [ ] Data imported to Supabase production
- [ ] Production validation checks passed

**Milestone**: Data successfully migrated to Supabase

### Week 3: Frontend Refactor
- [ ] API layer updated with feature flag
- [ ] Hooks and services updated
- [ ] UI components tested (all CRUD operations)
- [ ] Feature flag enabled for internal users
- [ ] Internal testing complete (no critical bugs)

**Milestone**: Frontend ready for rollout

### Week 4: Rollout & Cleanup
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Monitoring: errors, performance, data consistency
- [ ] 100% of users on Supabase
- [ ] Monitor for 1 week (no critical issues)
- [ ] Remove FileMaker code from frontend
- [ ] Archive FileMaker data
- [ ] Documentation updated

**Milestone**: Migration complete, FileMaker deprecated for customers

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Test on staging first, validate counts, keep FM backup |
| ID conflicts | Medium | Medium | Use FM UUID as Supabase ID, validate uniqueness |
| Performance degradation | Medium | Medium | Load test backend API, add indexes, monitor queries |
| Incomplete dual-write | Medium | High | Audit existing dual-write code, ensure all operations covered |
| User disruption | Low | High | Gradual rollout, feature flag for instant rollback |
| Relationship integrity | Medium | High | Validate foreign keys (projects, tasks, financial), run integrity checks |
| Timezone issues | Low | Medium | Test timestamp conversions, verify FM and SB use same timezone |
| Missing fields | Low | Medium | Complete field audit, map all FM fields to Supabase |

## Success Criteria

- ✅ 100% of FileMaker customers migrated to Supabase (verified counts match)
- ✅ All related data (emails, phones, addresses) migrated correctly
- ✅ No data loss (spot-checks on random sample of 50 customers)
- ✅ All user workflows functional (create, read, update, delete, toggle status)
- ✅ Performance acceptable (customer list < 500ms, detail view < 200ms)
- ✅ No critical bugs reported by users
- ✅ RLS policies enforced (users can only see their org's customers)
- ✅ Rollback plan tested and documented
- ✅ FileMaker code removed from frontend (cleanup complete)

## Post-Migration Monitoring

**Metrics to Track** (for 30 days post-migration):
- Customer CRUD operation latency (p50, p95, p99)
- Error rates (by operation type)
- Database query performance (slow query log)
- User-reported issues (tickets related to customers)
- Data consistency checks (daily automated validation)

**Alerting Thresholds**:
- Error rate > 1% for any customer operation
- Latency p95 > 1000ms
- Data inconsistency detected (count mismatch, orphaned records)

**Escalation**: If any threshold breached, investigate immediately and consider rollback if critical.

## Lessons Learned

After migration complete, document:
1. What went well
2. What could be improved
3. Issues encountered and how resolved
4. Recommendations for future migrations (Projects, Tasks, etc.)

**Share with team** to improve subsequent feature migrations.
