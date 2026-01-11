# Edge Cases Documentation - Customers Migration

## Document Purpose

This document identifies and documents edge cases, failure scenarios, and exceptional conditions that must be handled during the Customers feature migration from FileMaker to Supabase. Each edge case includes detection methods, impact analysis, recommended handling strategies, and validation procedures.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Task Reference**: TSK0010 - Document edge cases
**Dependencies**: TSK0002 (Current implementation), TSK0005 (API contracts), TSK0009 (Migration plan)

---

## Table of Contents

1. [Concurrent Updates & Race Conditions](#concurrent-updates--race-conditions)
2. [Partial Failures & Transaction Rollback](#partial-failures--transaction-rollback)
3. [Network Issues & Retry Logic](#network-issues--retry-logic)
4. [Orphaned Records & Data Cleanup](#orphaned-records--data-cleanup)
5. [Duplicate Detection & Uniqueness](#duplicate-detection--uniqueness)
6. [Data Validation Edge Cases](#data-validation-edge-cases)
7. [ID Reconciliation Edge Cases](#id-reconciliation-edge-cases)
8. [Organization Scoping Edge Cases](#organization-scoping-edge-cases)
9. [Performance Degradation Scenarios](#performance-degradation-scenarios)
10. [Security & Authorization Edge Cases](#security--authorization-edge-cases)

---

## Concurrent Updates & Race Conditions

### Edge Case 1: Simultaneous Customer Updates

**Scenario**: Two users edit the same customer record at the same time

**Timeline**:
```
T0 (10:00:00): User A fetches customer { name: "Acme Corp", email: "old@acme.com", updated_at: "2026-01-10T09:00:00Z" }
T1 (10:00:05): User B fetches customer { name: "Acme Corp", email: "old@acme.com", updated_at: "2026-01-10T09:00:00Z" }
T2 (10:02:00): User A saves { name: "Acme Corporation" } → updated_at becomes "2026-01-10T10:02:00Z"
T3 (10:03:00): User B saves { email: "new@acme.com" } → overwrites User A's name change
```

**Current Behavior** (FileMaker):
- Last write wins (no conflict detection)
- User A's name change is lost
- No warning to User B about concurrent modification

**Impact**:
- **Severity**: High
- **Frequency**: Low (depends on team size and concurrent usage patterns)
- **Data Loss**: Yes - silent data overwrite

**Detection**:
```sql
-- Query to detect recent concurrent updates (within 5 seconds)
SELECT
  c1.id,
  c1.business_name,
  c1.updated_at as first_update,
  c2.updated_at as second_update,
  EXTRACT(EPOCH FROM (c2.updated_at - c1.updated_at)) as seconds_between
FROM customers c1
JOIN customers c2 ON c1.id = c2.id
WHERE c2.updated_at > c1.updated_at
  AND EXTRACT(EPOCH FROM (c2.updated_at - c1.updated_at)) < 5
ORDER BY seconds_between ASC;
```

**Recommended Solution**: Optimistic Locking with HTTP Precondition Headers

**Backend Implementation**:
```python
@router.patch("/api/customers/{customer_id}")
async def update_customer(
    customer_id: UUID,
    update_data: CustomerUpdate,
    if_unmodified_since: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user)
):
    # Fetch current customer
    customer = await db.query(Customer).filter_by(id=customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Optimistic locking check
    if if_unmodified_since:
        client_timestamp = parse_http_date(if_unmodified_since)
        if customer.updated_at > client_timestamp:
            return JSONResponse(
                status_code=412,
                content={
                    "success": false,
                    "error": {
                        "code": "PRECONDITION_FAILED",
                        "message": "Customer was modified by another user",
                        "details": {
                            "client_timestamp": client_timestamp.isoformat(),
                            "server_timestamp": customer.updated_at.isoformat(),
                            "modified_by": customer.last_modified_by
                        }
                    }
                }
            )

    # Proceed with update...
```

**Frontend Implementation**:
```javascript
// src/api/customers.js
export async function updateCustomer(customerId, data, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': generateAuthHeader()
  };

  // Include If-Unmodified-Since header for optimistic locking
  if (options.ifUnmodifiedSince) {
    headers['If-Unmodified-Since'] = new Date(options.ifUnmodifiedSince).toUTCString();
  }

  try {
    const response = await backendAPI.patch(`/api/customers/${customerId}`, data, { headers });
    return response.data;
  } catch (error) {
    if (error.response?.status === 412) {
      // Handle conflict - show merge dialog
      throw new ConflictError(error.response.data);
    }
    throw error;
  }
}

// src/hooks/useCustomer.js
const handleCustomerUpdate = async (customerId, updates) => {
  try {
    const result = await updateCustomer(customerId, updates, {
      ifUnmodifiedSince: selectedCustomer.updated_at
    });

    setCustomers(prev => prev.map(c => c.id === customerId ? result : c));
    showSnackbar('Customer updated successfully', 'success');
  } catch (error) {
    if (error instanceof ConflictError) {
      // Fetch latest version
      const latestCustomer = await fetchCustomerById(customerId);

      // Show merge dialog
      setConflictDialog({
        open: true,
        localChanges: updates,
        serverVersion: latestCustomer,
        onResolve: (mergedData) => handleCustomerUpdate(customerId, mergedData)
      });
    } else {
      showSnackbar('Failed to update customer', 'error');
    }
  }
};
```

**Validation**:
- [ ] Two users edit same customer simultaneously
- [ ] Second save returns 412 Precondition Failed
- [ ] Frontend shows merge dialog with both versions
- [ ] User can choose which changes to keep
- [ ] Final merged update succeeds

**Code References**:
- Backend: New endpoint implementation required
- Frontend: `src/api/customers.js:44-57`, `src/hooks/useCustomer.js:112-177`

---

### Edge Case 2: Concurrent Create with Same Email

**Scenario**: Two users create different customers with the same email address simultaneously

**Timeline**:
```
T0: User A starts creating "Acme Corp" with email "contact@acme.com"
T1: User B starts creating "Acme Industries" with email "contact@acme.com"
T2: User A saves (inserts into customer_email)
T3: User B saves (attempts to insert into customer_email)
```

**Current Behavior** (FileMaker):
- FileMaker allows duplicate emails (no unique constraint)
- Both customers created successfully
- Database inconsistency with duplicate emails

**Target Behavior** (Supabase):
- Unique constraint on `customer_email.email` prevents duplicate
- Second insert fails with constraint violation
- Transaction rollback ensures customer record also deleted

**Impact**:
- **Severity**: Medium
- **Frequency**: Low (depends on duplicate email probability)
- **User Experience**: Second user sees error, must use different email

**Detection**:
```sql
-- Check for duplicate emails in Supabase
SELECT email, COUNT(*) as customer_count, ARRAY_AGG(customer_id) as customer_ids
FROM customer_email
GROUP BY email
HAVING COUNT(*) > 1;
```

**Recommended Solution**: Unique Constraint + Transaction Rollback

**Backend Implementation**:
```python
@router.post("/api/customers")
async def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    async with db.begin():  # Start transaction
        try:
            # Check for duplicate email BEFORE inserting customer
            if customer_data.emails:
                for email_data in customer_data.emails:
                    existing_email = await db.query(CustomerEmail).filter_by(
                        email=email_data.email
                    ).first()

                    if existing_email:
                        return JSONResponse(
                            status_code=409,
                            content={
                                "success": false,
                                "error": {
                                    "code": "DUPLICATE_EMAIL",
                                    "message": f"Email '{email_data.email}' is already registered",
                                    "details": {
                                        "email": email_data.email,
                                        "existing_customer_id": str(existing_email.customer_id)
                                    }
                                }
                            }
                        )

            # Insert customer
            customer = Customer(**customer_data.dict(exclude={'emails', 'phones', 'addresses'}))
            db.add(customer)
            await db.flush()

            # Insert emails
            for email_data in customer_data.emails:
                email = CustomerEmail(customer_id=customer.id, **email_data.dict())
                db.add(email)

            # Commit transaction (all-or-nothing)
            await db.commit()

            return {"success": true, "data": customer}

        except IntegrityError as e:
            await db.rollback()
            # Handle constraint violation
            if 'customer_email_email_key' in str(e):
                return JSONResponse(status_code=409, content={
                    "success": false,
                    "error": {
                        "code": "DUPLICATE_EMAIL",
                        "message": "Email address already exists"
                    }
                })
            raise
```

**Frontend Handling**:
```javascript
// src/hooks/useCustomer.js
const handleCustomerCreate = async (customerData) => {
  try {
    const newCustomer = await createCustomer(customerData);
    setCustomers(prev => [...prev, newCustomer]);
    showSnackbar('Customer created successfully', 'success');
  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL') {
      setError({
        field: 'email',
        message: `Email ${error.details.email} is already registered`,
        action: {
          label: 'View Existing Customer',
          onClick: () => handleCustomerSelect(error.details.existing_customer_id)
        }
      });
    }
  }
};
```

**Validation**:
- [ ] Create customer with email "test@example.com"
- [ ] Simultaneously create another customer with same email
- [ ] Second request fails with 409 Conflict
- [ ] First customer created successfully
- [ ] Second customer NOT created (transaction rolled back)
- [ ] User sees helpful error message with link to existing customer

---

## Partial Failures & Transaction Rollback

### Edge Case 3: Customer Created, Email Insert Fails

**Scenario**: Customer record inserted successfully, but related email insert fails

**Failure Point**:
```python
# Transaction flow
async with db.begin():
    # Step 1: Insert customer (SUCCESS)
    customer = Customer(id=uuid, business_name="Acme Corp")
    db.add(customer)
    await db.flush()

    # Step 2: Insert email (FAILURE - duplicate constraint violation)
    email = CustomerEmail(customer_id=customer.id, email="duplicate@example.com")
    db.add(email)  # Raises IntegrityError

    # Transaction automatically rolled back
```

**Without Transaction**:
- Customer record created in `customers` table
- Email insert fails
- **Orphaned customer** with no contact information
- Inconsistent database state

**With Transaction** (Required):
- Both operations wrapped in single transaction
- If email insert fails, customer insert is rolled back
- Database remains consistent
- Returns error to user before any data committed

**Impact**:
- **Severity**: Critical (without transaction), Low (with transaction)
- **Frequency**: Low (depends on duplicate email probability)
- **Data Corruption**: Yes (without transaction), No (with transaction)

**Recommended Solution**: Database Transactions (ACID)

**Backend Implementation**:
```python
@router.post("/api/customers")
async def create_customer(customer_data: CustomerCreate, db: Session = Depends(get_db)):
    async with db.begin():  # Start transaction
        try:
            # All database operations within this block are transactional
            customer = Customer(**customer_data.dict(exclude={'emails', 'phones', 'addresses'}))
            db.add(customer)
            await db.flush()  # Get customer ID without committing

            # Insert related records
            for email_data in customer_data.emails:
                email = CustomerEmail(customer_id=customer.id, **email_data.dict())
                db.add(email)

            for phone_data in customer_data.phones:
                phone = CustomerPhone(customer_id=customer.id, **phone_data.dict())
                db.add(phone)

            for address_data in customer_data.addresses:
                address = CustomerAddress(customer_id=customer.id, **address_data.dict())
                db.add(address)

            # Commit transaction (all operations succeed together or all fail together)
            await db.commit()

            return {"success": true, "data": customer}

        except IntegrityError as e:
            # Automatic rollback on exception (no cleanup needed)
            await db.rollback()
            raise HTTPException(status_code=409, detail="Constraint violation")

        except Exception as e:
            # Automatic rollback on any exception
            await db.rollback()
            raise HTTPException(status_code=500, detail="Internal error")
```

**Validation**:
```python
# Test case: Verify rollback on email constraint violation
async def test_customer_create_rollback():
    # Create existing email
    existing_email = CustomerEmail(email="test@example.com", customer_id=uuid4())
    db.add(existing_email)
    await db.commit()

    # Attempt to create customer with duplicate email
    try:
        await create_customer(CustomerCreate(
            business_name="Test Corp",
            emails=[{"email": "test@example.com", "is_primary": true}]
        ))
    except HTTPException as e:
        assert e.status_code == 409

    # Verify customer was NOT created (rollback successful)
    customer_count = await db.query(Customer).filter_by(business_name="Test Corp").count()
    assert customer_count == 0, "Customer should have been rolled back"
```

**Code References**:
- Backend API implementation required (transaction handling)
- Supabase client: Database transactions via SQL or RPC functions

---

### Edge Case 4: Supabase Update Succeeds, FileMaker Sync Fails (Dual-Write Period)

**Scenario**: During dual-write period, backend updates Supabase successfully but FileMaker sync fails

**Failure Point**:
```python
# Dual-write flow (during migration phase)
async def update_customer_dual_write(customer_id, data):
    # Step 1: Update Supabase (SUCCESS)
    supabase_result = await supabase.table('customers').update(data).eq('id', customer_id).execute()

    # Step 2: Sync to FileMaker (FAILURE - network timeout, FM server down, etc.)
    try:
        fm_result = await filemaker_api.update(customer_id, data)
    except Exception as e:
        # Supabase already updated - cannot rollback
        # FileMaker NOT updated - data divergence
        logger.error(f"FileMaker sync failed after Supabase update: {e}")
        # What now?
```

**Impact**:
- **Severity**: High (data divergence between systems)
- **Frequency**: Medium (depends on network reliability, FileMaker uptime)
- **Data Consistency**: Broken (Supabase has new data, FileMaker has old data)

**Current Behavior** (Migration Plan):
- Dual-write failures logged to console
- No retry mechanism
- No reconciliation process
- Data divergence persists indefinitely

**Recommended Solution**: Retry Queue + Reconciliation Job

**Backend Implementation**:
```python
# Dual-write queue for failed FileMaker syncs
class DualWriteQueue:
    def __init__(self):
        self.queue_table = 'dual_write_queue'

    async def enqueue_failed_sync(self, operation_type, customer_id, data, error):
        """Add failed FileMaker sync to retry queue"""
        await supabase.table(self.queue_table).insert({
            'operation_type': operation_type,
            'customer_id': customer_id,
            'data': data,
            'error': str(error),
            'retry_count': 0,
            'status': 'pending',
            'created_at': datetime.now()
        }).execute()

    async def process_queue(self):
        """Background job to retry failed syncs"""
        pending = await supabase.table(self.queue_table).select('*').eq('status', 'pending').execute()

        for item in pending.data:
            try:
                # Retry FileMaker sync
                await filemaker_api.update(item['customer_id'], item['data'])

                # Mark as completed
                await supabase.table(self.queue_table).update({
                    'status': 'completed',
                    'completed_at': datetime.now()
                }).eq('id', item['id']).execute()

            except Exception as e:
                # Increment retry count, exponential backoff
                retry_count = item['retry_count'] + 1
                if retry_count > 5:
                    status = 'failed_permanent'
                else:
                    status = 'pending'

                await supabase.table(self.queue_table).update({
                    'retry_count': retry_count,
                    'status': status,
                    'last_error': str(e),
                    'last_retry_at': datetime.now()
                }).eq('id', item['id']).execute()

# Update endpoint with retry queue
@router.patch("/api/customers/{customer_id}")
async def update_customer(customer_id: UUID, data: CustomerUpdate):
    # Update Supabase first
    supabase_result = await supabase.table('customers').update(data.dict()).eq('id', customer_id).execute()

    # Attempt FileMaker sync
    try:
        fm_result = await filemaker_api.update(customer_id, data.dict())
    except Exception as e:
        # Queue for retry instead of failing entire operation
        await dual_write_queue.enqueue_failed_sync('update', customer_id, data.dict(), e)
        logger.warning(f"FileMaker sync queued for retry: {e}")

    return {"success": true, "data": supabase_result.data}
```

**Cron Job Setup** (Background retry processing):
```python
# Run every 5 minutes
@app.on_event("startup")
async def schedule_dual_write_retry():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(dual_write_queue.process_queue, 'interval', minutes=5)
    scheduler.start()
```

**Validation**:
- [ ] Simulate FileMaker API failure (network timeout)
- [ ] Verify Supabase updated successfully
- [ ] Verify failed sync added to retry queue
- [ ] Verify background job processes queue
- [ ] Verify FileMaker updated on retry
- [ ] Verify queue item marked as completed

**Code References**:
- Migration plan: `.devflow/tasks/customers-migration-requirements/migration-plan.md:369-443`
- Dual-write service: `src/services/dualWriteService.js`

---

## Network Issues & Retry Logic

### Edge Case 5: Request Timeout During Customer Create

**Scenario**: Frontend sends customer create request, but network times out before receiving response

**Timeline**:
```
T0: Frontend sends POST /api/customers with data
T1: Backend receives request, starts processing
T2: Backend inserts customer into database
T3: Backend prepares response
T4: Network timeout (frontend gives up waiting)
T5: Backend sends response (but frontend already disconnected)
```

**Problem**: Customer Created, But Frontend Doesn't Know

**Impact**:
- **Severity**: High (user may retry, creating duplicate customer)
- **Frequency**: Low-Medium (depends on network reliability)
- **User Experience**: Confusing (user sees error, but customer was created)

**Without Idempotency**:
```
User clicks "Save" → timeout
User clicks "Save" again → second customer created with same data
Result: Duplicate customers
```

**Recommended Solution**: Idempotency Keys

**Frontend Implementation**:
```javascript
// src/api/customers.js
import { v4 as uuidv4 } from 'uuid';

export async function createCustomer(customerData) {
  // Generate idempotency key (unique per create operation)
  const idempotencyKey = `customer-create-${Date.now()}-${uuidv4()}`;

  const response = await backendAPI.post('/api/customers', customerData, {
    headers: {
      'Idempotency-Key': idempotencyKey,
      'Authorization': generateAuthHeader()
    },
    timeout: 30000  // 30 second timeout
  });

  return response.data;
}

// Retry logic
export async function createCustomerWithRetry(customerData, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createCustomer(customerData);
    } catch (error) {
      lastError = error;

      // Retry only on network errors (not validation errors)
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        console.warn(`Create attempt ${attempt} failed, retrying...`);
        await delay(1000 * attempt);  // Exponential backoff
        continue;
      }

      // Don't retry on validation errors
      throw error;
    }
  }

  throw lastError;
}
```

**Backend Implementation**:
```python
# Idempotency cache (Redis or in-memory)
idempotency_cache = {}  # In production, use Redis with TTL

@router.post("/api/customers")
async def create_customer(
    customer_data: CustomerCreate,
    idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Check idempotency cache
    if idempotency_key and idempotency_key in idempotency_cache:
        # Return cached response (customer already created)
        logger.info(f"Idempotent request detected: {idempotency_key}")
        return idempotency_cache[idempotency_key]

    # Create customer (normal flow)
    async with db.begin():
        customer = Customer(**customer_data.dict())
        db.add(customer)
        await db.commit()

    response = {"success": true, "data": customer.to_dict()}

    # Cache response for 24 hours
    if idempotency_key:
        idempotency_cache[idempotency_key] = response
        # In Redis: redis.setex(idempotency_key, 86400, json.dumps(response))

    return response
```

**Validation**:
- [ ] Send create request with idempotency key
- [ ] Verify customer created
- [ ] Send same request again (simulate retry)
- [ ] Verify second request returns same response
- [ ] Verify only one customer created (no duplicate)

**Code References**:
- API contracts: `.devflow/tasks/customers-migration-requirements/api-contracts.md:427-649`

---

### Edge Case 6: Network Partition During Batch Migration

**Scenario**: Batch migration script is importing 500 customers, network fails after customer 250

**Timeline**:
```
T0: Start batch migration (500 customers)
T1: Customers 1-250 imported successfully
T2: Network partition occurs
T3: Customers 251-500 fail to import
T4: Network restored
T5: Resume migration?
```

**Problem**: Partial Migration State

**Impact**:
- **Severity**: High (incomplete migration, data inconsistency)
- **Frequency**: Low (depends on network stability during migration window)
- **Recovery Complexity**: High (need to track progress, resume from checkpoint)

**Recommended Solution**: Checkpoint-Based Migration with Progress Tracking

**Migration Script Implementation**:
```python
# migration_script.py
import asyncio
import json
from dataclasses import dataclass
from typing import List

@dataclass
class MigrationCheckpoint:
    total_customers: int
    processed: int
    created: int
    skipped: int
    failed: int
    last_processed_id: Optional[str]
    errors: List[dict]

class CustomerMigrator:
    def __init__(self, batch_size=50, checkpoint_file='migration_checkpoint.json'):
        self.batch_size = batch_size
        self.checkpoint_file = checkpoint_file
        self.checkpoint = self.load_checkpoint()

    def load_checkpoint(self) -> MigrationCheckpoint:
        """Load migration progress from checkpoint file"""
        try:
            with open(self.checkpoint_file, 'r') as f:
                data = json.load(f)
                return MigrationCheckpoint(**data)
        except FileNotFoundError:
            return MigrationCheckpoint(
                total_customers=0,
                processed=0,
                created=0,
                skipped=0,
                failed=0,
                last_processed_id=None,
                errors=[]
            )

    def save_checkpoint(self):
        """Save migration progress to checkpoint file"""
        with open(self.checkpoint_file, 'w') as f:
            json.dump(self.checkpoint.__dict__, f, indent=2)

    async def migrate_customers(self, filemaker_customers: List[dict]):
        """Migrate customers with checkpoint-based resume capability"""
        self.checkpoint.total_customers = len(filemaker_customers)

        # Skip already processed customers
        if self.checkpoint.last_processed_id:
            start_index = next((i for i, c in enumerate(filemaker_customers)
                               if c['__ID'] == self.checkpoint.last_processed_id), 0) + 1
            filemaker_customers = filemaker_customers[start_index:]
            print(f"Resuming from customer {start_index} / {self.checkpoint.total_customers}")

        # Process in batches
        for i in range(0, len(filemaker_customers), self.batch_size):
            batch = filemaker_customers[i:i+self.batch_size]

            try:
                # Send batch to backend API
                response = await api.post('/api/customers/batch', {
                    'customers': batch,
                    'options': {'skip_duplicates': True, 'return_errors': True}
                })

                # Update checkpoint
                self.checkpoint.processed += len(batch)
                self.checkpoint.created += response['data']['summary']['created']
                self.checkpoint.skipped += response['data']['summary']['skipped']
                self.checkpoint.failed += response['data']['summary']['failed']
                self.checkpoint.last_processed_id = batch[-1]['__ID']
                self.checkpoint.errors.extend(response['data']['errors'])

                # Save checkpoint after each batch
                self.save_checkpoint()

                print(f"Progress: {self.checkpoint.processed}/{self.checkpoint.total_customers} " +
                      f"({self.checkpoint.created} created, {self.checkpoint.failed} failed)")

            except Exception as e:
                # Network error - checkpoint already saved, can resume later
                print(f"Error processing batch: {e}")
                print(f"Checkpoint saved. Resume later from customer {self.checkpoint.last_processed_id}")
                raise

        print("Migration complete!")
        return self.checkpoint

# Usage
async def main():
    migrator = CustomerMigrator(batch_size=50)

    # Fetch FileMaker customers
    fm_customers = await fetch_all_filemaker_customers()

    try:
        result = await migrator.migrate_customers(fm_customers)
        print(f"Migration successful: {result.created} customers created, {result.failed} failed")
    except Exception as e:
        print(f"Migration interrupted: {e}")
        print("Run script again to resume from checkpoint")

if __name__ == "__main__":
    asyncio.run(main())
```

**Checkpoint File Format** (`migration_checkpoint.json`):
```json
{
  "total_customers": 500,
  "processed": 250,
  "created": 245,
  "skipped": 3,
  "failed": 2,
  "last_processed_id": "uuid-customer-250",
  "errors": [
    {
      "customer_id": "uuid-123",
      "error": "DUPLICATE_EMAIL",
      "details": {"email": "duplicate@example.com"}
    }
  ]
}
```

**Resume Migration**:
```bash
# First run (interrupted at customer 250)
python migration_script.py

# Second run (resumes from customer 251)
python migration_script.py
```

**Validation**:
- [ ] Start migration of 500 customers
- [ ] Simulate network failure after 250 customers
- [ ] Verify checkpoint file saved with progress
- [ ] Resume migration script
- [ ] Verify migration continues from customer 251
- [ ] Verify total customers created equals expected (no duplicates)

---

## Orphaned Records & Data Cleanup

### Edge Case 7: Customer Deleted in FileMaker, Orphaned in Supabase

**Scenario**: During dual-write period, customer deleted in FileMaker but Supabase delete fails or is not implemented

**Current State** (Dual-Write Analysis):
- FileMaker DELETE operation does NOT sync to Supabase
- Code Reference: `src/hooks/useCustomer.js:217-243` (FileMaker-only delete)

**Impact**:
- **Severity**: Medium (orphaned records accumulate)
- **Frequency**: Low (depends on customer deletion rate)
- **Database Bloat**: Yes (customer + related records remain in Supabase)

**Detection**:
```sql
-- Find customers in Supabase that don't exist in FileMaker
-- (Assumes FileMaker export available for comparison)
WITH filemaker_customers AS (
  SELECT unnest(ARRAY['fm-uuid-1', 'fm-uuid-2', ...]) AS id
)
SELECT s.id, s.business_name, s.created_at, s.updated_at
FROM customers s
LEFT JOIN filemaker_customers fm ON fm.id = s.id
WHERE fm.id IS NULL
  AND s.organization_id = 'org-uuid';
```

**Recommended Solution**: Cascading Deletes + Reconciliation Job

**Schema Enforcement** (Foreign Key Cascades):
```sql
-- Ensure all related tables have ON DELETE CASCADE
ALTER TABLE customer_email DROP CONSTRAINT customer_email_customer_id_fkey;
ALTER TABLE customer_email ADD CONSTRAINT customer_email_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_phone DROP CONSTRAINT customer_phone_customer_id_fkey;
ALTER TABLE customer_phone ADD CONSTRAINT customer_phone_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_address DROP CONSTRAINT customer_address_customer_id_fkey;
ALTER TABLE customer_address ADD CONSTRAINT customer_address_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_contacts DROP CONSTRAINT customer_contacts_customer_id_fkey;
ALTER TABLE customer_contacts ADD CONSTRAINT customer_contacts_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
```

**Backend Delete Endpoint**:
```python
@router.delete("/api/customers/{customer_id}")
async def delete_customer(
    customer_id: UUID,
    hard_delete: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = await db.query(Customer).filter_by(id=customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if hard_delete:
        # Hard delete (CASCADE will delete related records automatically)
        await db.delete(customer)
        await db.commit()
        return Response(status_code=204)
    else:
        # Soft delete (set deleted_at timestamp)
        customer.deleted_at = datetime.now()
        await db.commit()
        return {
            "success": true,
            "data": {
                "id": customer_id,
                "deleted_at": customer.deleted_at,
                "message": "Customer soft-deleted. Can be restored within 30 days."
            }
        }
```

**Reconciliation Job** (Daily cleanup of orphaned records):
```python
# Run daily to find and report orphaned Supabase customers
async def find_orphaned_customers():
    """Compare FileMaker vs Supabase to identify orphaned records"""

    # Fetch all FileMaker customer IDs
    fm_customers = await filemaker_api.fetch_all_customers()
    fm_ids = set([c['__ID'] for c in fm_customers])

    # Fetch all Supabase customer IDs
    sb_customers = await supabase.table('customers').select('id').execute()
    sb_ids = set([c['id'] for c in sb_customers.data])

    # Find orphans (in Supabase but not in FileMaker)
    orphaned_ids = sb_ids - fm_ids

    if orphaned_ids:
        logger.warning(f"Found {len(orphaned_ids)} orphaned customers in Supabase")

        # Log orphaned customers for review
        orphaned_customers = await supabase.table('customers').select('*').in_('id', list(orphaned_ids)).execute()

        for customer in orphaned_customers.data:
            logger.info(f"Orphaned customer: {customer['id']} - {customer['business_name']}")

        # Auto-delete orphans older than 30 days
        cutoff_date = datetime.now() - timedelta(days=30)
        for customer in orphaned_customers.data:
            if datetime.fromisoformat(customer['created_at']) < cutoff_date:
                logger.info(f"Auto-deleting orphaned customer: {customer['id']}")
                await supabase.table('customers').delete().eq('id', customer['id']).execute()

    return {
        "total_filemaker": len(fm_ids),
        "total_supabase": len(sb_ids),
        "orphaned_count": len(orphaned_ids),
        "orphaned_ids": list(orphaned_ids)
    }
```

**Validation**:
- [ ] Delete customer in FileMaker (during dual-write period)
- [ ] Verify customer remains in Supabase (orphaned)
- [ ] Run reconciliation job
- [ ] Verify orphan detected and logged
- [ ] Wait 30 days (or mock date)
- [ ] Run reconciliation job again
- [ ] Verify orphan auto-deleted (CASCADE deletes related records)

**Code References**:
- Migration plan (schema changes): `.devflow/tasks/customers-migration-requirements/migration-plan.md:116-134`
- Dual-write analysis (delete gap): `.devflow/tasks/customers-migration-requirements/dual-write-analysis.md:250-274`

---

### Edge Case 8: Orphaned Related Records (Email/Phone/Address Without Customer)

**Scenario**: Customer deleted, but related records remain due to missing CASCADE constraints

**Current Schema State** (from Supabase schema doc):
- `customer_phone` and `customer_address` **missing** ON DELETE CASCADE
- Deleting customer leaves orphaned phones and addresses

**Detection**:
```sql
-- Find orphaned emails (customer_email has CASCADE)
SELECT COUNT(*) AS orphaned_emails
FROM customer_email ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE c.id IS NULL;

-- Find orphaned phones (NO CASCADE - will have orphans)
SELECT COUNT(*) AS orphaned_phones
FROM customer_phone cp
LEFT JOIN customers c ON c.id = cp.customer_id
WHERE c.id IS NULL;

-- Find orphaned addresses (NO CASCADE - will have orphans)
SELECT COUNT(*) AS orphaned_addresses
FROM customer_address ca
LEFT JOIN customers c ON c.id = ca.customer_id
WHERE c.id IS NULL;
```

**Impact**:
- **Severity**: Medium (database bloat, referential integrity violation)
- **Frequency**: Medium (every customer hard delete)
- **Storage Impact**: Low per orphan, but accumulates over time

**Recommended Solution**: Add CASCADE Constraints + Cleanup Script

**Schema Fix**:
```sql
-- Add missing CASCADE constraints
-- (CRITICAL: Include in backend change request)

ALTER TABLE customer_phone DROP CONSTRAINT customer_phone_customer_id_fkey;
ALTER TABLE customer_phone ADD CONSTRAINT customer_phone_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_address DROP CONSTRAINT customer_address_customer_id_fkey;
ALTER TABLE customer_address ADD CONSTRAINT customer_address_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
```

**One-Time Cleanup Script** (Remove existing orphans):
```sql
-- Cleanup orphaned phones
DELETE FROM customer_phone
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Cleanup orphaned addresses
DELETE FROM customer_address
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Cleanup orphaned emails (shouldn't exist, but verify)
DELETE FROM customer_email
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Cleanup orphaned contacts
DELETE FROM customer_contacts
WHERE customer_id NOT IN (SELECT id FROM customers);
```

**Validation**:
- [ ] Run cleanup script before adding CASCADE constraints
- [ ] Verify orphaned records deleted
- [ ] Add CASCADE constraints via migration
- [ ] Delete a customer
- [ ] Verify related emails/phones/addresses also deleted automatically

**Code References**:
- Supabase schema: `.devflow/tasks/customers-migration-requirements/supabase-schema.md`
- Migration plan (schema changes): `.devflow/tasks/customers-migration-requirements/migration-plan.md:116-134`

---

## Duplicate Detection & Uniqueness

### Edge Case 9: Duplicate Email Addresses Across Customers

**Scenario**: User attempts to create customer with email that already exists for another customer

**Current State**:
- FileMaker: No unique constraint on email (duplicates allowed)
- Supabase: Unique constraint on `customer_email.email` (duplicates blocked)

**Problem**: Schema Mismatch Between Systems

**Impact**:
- **Severity**: High (migration will fail for customers with duplicate emails)
- **Frequency**: Medium (depends on data quality in FileMaker)
- **User Experience**: Create/update operations fail with constraint violation

**Detection** (Pre-Migration):
```sql
-- Find duplicate emails in FileMaker export
SELECT email, COUNT(*) AS customer_count, ARRAY_AGG(__ID) AS customer_ids
FROM filemaker_customers_export
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY customer_count DESC;

-- Sample result:
-- email                  | customer_count | customer_ids
-- ----------------------|----------------|---------------------------
-- info@acme.com         | 3              | [uuid-1, uuid-2, uuid-3]
-- contact@example.com   | 2              | [uuid-4, uuid-5]
```

**Impact on Migration**:
- First customer with email "info@acme.com" imports successfully
- Second customer import fails with `DUPLICATE_EMAIL` error
- Third customer import also fails
- Migration incomplete

**Recommended Solution**: Pre-Migration Deduplication + Decision Logic

**Strategy 1: Keep Only Primary Email, Discard Duplicates**
```python
def deduplicate_emails(filemaker_customers):
    """Keep first occurrence of each email, discard rest"""
    seen_emails = set()
    deduplicated = []

    for customer in filemaker_customers:
        email = customer.get('Email', '').lower().strip()

        if email and email in seen_emails:
            # Duplicate email - skip or mark as secondary
            customer['Email'] = None  # Don't import duplicate email
            logger.warning(f"Duplicate email {email} for customer {customer['__ID']}, skipping email")
        elif email:
            seen_emails.add(email)

        deduplicated.append(customer)

    return deduplicated
```

**Strategy 2: Change Unique Constraint to Allow Duplicates**
```sql
-- Option: Remove unique constraint (NOT RECOMMENDED)
ALTER TABLE customer_email DROP CONSTRAINT customer_email_email_key;

-- Better option: Change constraint to unique per customer (allow same email for multiple customers)
ALTER TABLE customer_email DROP CONSTRAINT customer_email_email_key;
CREATE UNIQUE INDEX idx_customer_email_unique ON customer_email(customer_id, email);
-- Now same email can be used for different customers
```

**Strategy 3: Append Suffix to Duplicate Emails**
```python
def deduplicate_emails_with_suffix(filemaker_customers):
    """Append suffix to duplicate emails (e.g., email+1@example.com)"""
    email_counts = {}

    for customer in filemaker_customers:
        email = customer.get('Email', '').lower().strip()

        if email:
            if email in email_counts:
                # Duplicate - append suffix
                email_counts[email] += 1
                local, domain = email.split('@')
                customer['Email'] = f"{local}+{email_counts[email]}@{domain}"
                logger.warning(f"Duplicate email {email}, changing to {customer['Email']}")
            else:
                email_counts[email] = 0

    return filemaker_customers
```

**Validation**:
- [ ] Export FileMaker customers
- [ ] Run duplicate detection query
- [ ] Apply deduplication strategy
- [ ] Re-run duplicate detection (should be 0)
- [ ] Import to Supabase
- [ ] Verify no constraint violations

**Code References**:
- Data model mapping: `.devflow/tasks/customers-migration-requirements/data-model-mapping.md`
- Migration plan: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1002-1061`

---

### Edge Case 10: Duplicate Business Names

**Scenario**: Two customers with identical business name (e.g., "Acme Corp")

**Current State**:
- FileMaker: No unique constraint on business name (duplicates allowed)
- Supabase: No unique constraint on business_name (duplicates allowed)

**Problem**: Ambiguity in UI (which "Acme Corp" did user select?)

**Impact**:
- **Severity**: Low (functional, but poor UX)
- **Frequency**: High (common business names like "Smith Consulting")
- **User Experience**: Confusing (users see multiple identical names in dropdown)

**Recommended Solution**: Display Disambiguation Info in UI

**Frontend Implementation**:
```javascript
// src/components/customers/CustomerList.jsx
function CustomerListItem({ customer }) {
  return (
    <div className="customer-list-item">
      <div className="customer-name">{customer.business_name}</div>

      {/* Show disambiguation info if duplicate name exists */}
      <div className="customer-meta text-muted">
        {customer.primary_contact_name && (
          <span>Contact: {customer.primary_contact_name}</span>
        )}
        {customer.emails?.[0] && (
          <span> • {customer.emails[0].email}</span>
        )}
        {customer.phones?.[0] && (
          <span> • {customer.phones[0].phone}</span>
        )}
      </div>
    </div>
  );
}

// Autocomplete with disambiguation
function CustomerAutocomplete({ onSelect }) {
  return (
    <Autocomplete
      options={customers}
      getOptionLabel={(customer) => customer.business_name}
      renderOption={(props, customer) => (
        <li {...props}>
          <div>
            <strong>{customer.business_name}</strong>
            <div className="text-muted">
              {customer.emails?.[0]?.email || customer.phones?.[0]?.phone || customer.id.slice(0, 8)}
            </div>
          </div>
        </li>
      )}
      onChange={(event, value) => onSelect(value)}
    />
  );
}
```

**Backend Enhancement**: Add duplicate detection flag
```python
@router.get("/api/customers")
async def list_customers(...):
    # Fetch customers
    customers = await db.query(Customer).all()

    # Flag duplicates
    name_counts = {}
    for customer in customers:
        name_counts[customer.business_name] = name_counts.get(customer.business_name, 0) + 1

    # Add has_duplicate flag
    for customer in customers:
        customer.has_duplicate_name = name_counts[customer.business_name] > 1

    return customers
```

**Validation**:
- [ ] Create two customers with same business name
- [ ] Verify both appear in list with disambiguation info
- [ ] Search for business name
- [ ] Verify autocomplete shows both options with unique identifiers
- [ ] Select one customer
- [ ] Verify correct customer selected (by ID)

---

## Data Validation Edge Cases

### Edge Case 11: Invalid Email Formats in FileMaker

**Scenario**: FileMaker contains emails that don't match RFC 5322 format

**Examples of Invalid Emails**:
- `user@` (missing domain)
- `@example.com` (missing local part)
- `user @example.com` (space in email)
- `user@example` (no TLD)
- `plaintext` (not an email)

**Impact on Migration**:
- **Severity**: Medium (migration fails or imports invalid data)
- **Frequency**: Low-Medium (depends on data quality and validation in FileMaker)

**Detection**:
```python
import re

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

def validate_filemaker_emails(filemaker_customers):
    """Find customers with invalid email formats"""
    invalid_emails = []

    for customer in filemaker_customers:
        email = customer.get('Email', '').strip()

        if email and not re.match(EMAIL_REGEX, email):
            invalid_emails.append({
                'customer_id': customer['__ID'],
                'business_name': customer['Name'],
                'invalid_email': email
            })

    return invalid_emails

# Sample result:
# [
#   {'customer_id': 'uuid-1', 'business_name': 'Acme Corp', 'invalid_email': 'user@'},
#   {'customer_id': 'uuid-2', 'business_name': 'Test Inc', 'invalid_email': 'plaintext'}
# ]
```

**Recommended Solution**: Pre-Migration Validation + Cleanup

**Strategy 1: Skip Invalid Emails**
```python
def clean_emails(filemaker_customers):
    """Remove invalid emails, log warnings"""
    for customer in filemaker_customers:
        email = customer.get('Email', '').strip()

        if email and not re.match(EMAIL_REGEX, email):
            logger.warning(f"Invalid email '{email}' for customer {customer['__ID']}, skipping email")
            customer['Email'] = None  # Don't import invalid email

    return filemaker_customers
```

**Strategy 2: Attempt Auto-Correction**
```python
def autocorrect_emails(filemaker_customers):
    """Attempt to fix common email issues"""
    for customer in filemaker_customers:
        email = customer.get('Email', '').strip()

        if not email:
            continue

        # Remove spaces
        email = email.replace(' ', '')

        # Add missing .com (if ends with @domain)
        if email.count('@') == 1 and '.' not in email.split('@')[1]:
            email += '.com'

        # Validate corrected email
        if re.match(EMAIL_REGEX, email):
            customer['Email'] = email
        else:
            logger.warning(f"Could not auto-correct email '{customer['Email']}' for customer {customer['__ID']}")
            customer['Email'] = None

    return filemaker_customers
```

**Backend Validation** (Defense in Depth):
```python
from pydantic import EmailStr, validator

class CustomerEmailCreate(BaseModel):
    email: EmailStr  # Pydantic validates email format
    is_primary: bool = False

    @validator('email')
    def normalize_email(cls, v):
        return v.lower().strip()
```

**Validation**:
- [ ] Create FileMaker export with invalid emails
- [ ] Run email validation script
- [ ] Verify invalid emails detected
- [ ] Run cleanup script
- [ ] Verify invalid emails removed or corrected
- [ ] Import to Supabase
- [ ] Verify all emails pass Pydantic validation

---

### Edge Case 12: Missing Required Address Fields

**Scenario**: FileMaker customer has Address but missing City or State

**Current Schema**:
- FileMaker: City and State are optional
- Supabase: City and State are **NOT NULL** (required)

**Problem**: Cannot import addresses with missing City/State

**Detection**:
```sql
-- Find FileMaker customers with partial addresses
SELECT __ID, Name, Address, City, State
FROM filemaker_customers_export
WHERE Address IS NOT NULL
  AND (City IS NULL OR State IS NULL);
```

**Recommended Solution**: Skip Address Creation (Don't Import Partial Addresses)

**Migration Transform**:
```python
def transform_address(customer):
    """Only create address if required fields present"""
    address_line1 = customer.get('Address', '').strip()
    city = customer.get('City', '').strip()
    state = customer.get('State', '').strip()

    # Skip address if City or State missing
    if not city or not state:
        logger.warning(f"Skipping address for customer {customer['__ID']}: missing City or State")
        return None

    return {
        'address_line1': address_line1,
        'city': city,
        'state': state,
        'postal_code': customer.get('PostalCode', ''),
        'country': customer.get('Country', '')
    }

# Usage in migration
for customer in filemaker_customers:
    address = transform_address(customer)

    if address:
        # Create address record
        await db.table('customer_address').insert({
            'customer_id': customer['__ID'],
            **address
        }).execute()
    # else: Customer imported without address
```

**Alternative: Make City/State Nullable** (requires schema change):
```sql
-- Backend change request required
ALTER TABLE customer_address ALTER COLUMN city DROP NOT NULL;
ALTER TABLE customer_address ALTER COLUMN state DROP NOT NULL;
```

**Validation**:
- [ ] Export FileMaker customers
- [ ] Find customers with partial addresses
- [ ] Run migration transform
- [ ] Verify addresses with City+State imported
- [ ] Verify addresses without City or State skipped
- [ ] Verify customers still created (just without address)

**Code References**:
- Data model mapping: `.devflow/tasks/customers-migration-requirements/data-model-mapping.md`
- Migration plan: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1557-1604`

---

## ID Reconciliation Edge Cases

### Edge Case 13: FileMaker `__ID` Not a Valid UUID

**Scenario**: FileMaker customer has invalid or missing `__ID` field

**Examples**:
- `__ID` is empty string
- `__ID` is NULL
- `__ID` is not a valid UUID format (e.g., "customer-123" instead of "uuid-format")

**Impact on Migration**:
- **Severity**: Critical (cannot map to Supabase `customers.id`)
- **Frequency**: Very Low (FileMaker should enforce UUID generation)

**Detection**:
```python
import uuid

def validate_filemaker_ids(filemaker_customers):
    """Find customers with invalid UUIDs"""
    invalid_ids = []

    for customer in filemaker_customers:
        customer_id = customer.get('__ID', '').strip()

        # Check if missing
        if not customer_id:
            invalid_ids.append({
                'customer': customer,
                'error': 'MISSING_ID',
                'message': '__ID field is empty'
            })
            continue

        # Check if valid UUID format
        try:
            uuid.UUID(customer_id)
        except ValueError:
            invalid_ids.append({
                'customer': customer,
                'error': 'INVALID_UUID_FORMAT',
                'message': f'__ID "{customer_id}" is not a valid UUID'
            })

    return invalid_ids
```

**Recommended Solution**: Generate New UUID if Invalid

**Migration Transform**:
```python
import uuid

def ensure_valid_uuid(customer):
    """Ensure customer has valid UUID, generate if missing"""
    customer_id = customer.get('__ID', '').strip()

    # Validate existing UUID
    try:
        uuid.UUID(customer_id)
        return customer_id  # Valid UUID, use as-is
    except ValueError:
        # Invalid or missing - generate new UUID
        new_id = str(uuid.uuid4())
        logger.warning(f"Customer {customer.get('Name')} has invalid __ID '{customer_id}', generating new UUID: {new_id}")

        # Store mapping for reference
        await db.table('filemaker_id_mapping').insert({
            'supabase_customer_id': new_id,
            'filemaker_invalid_id': customer_id,
            'filemaker_name': customer.get('Name'),
            'migrated_at': datetime.now()
        }).execute()

        return new_id
```

**ID Mapping Table** (for audit trail):
```sql
CREATE TABLE filemaker_id_mapping (
  supabase_customer_id UUID PRIMARY KEY REFERENCES customers(id),
  filemaker_invalid_id TEXT,
  filemaker_name TEXT,
  migrated_at TIMESTAMPTZ DEFAULT now()
);
```

**Validation**:
- [ ] Create FileMaker export with invalid UUIDs
- [ ] Run UUID validation script
- [ ] Verify invalid UUIDs detected
- [ ] Run migration with UUID generation
- [ ] Verify new UUIDs generated for invalid records
- [ ] Verify mapping table contains old ID → new ID mapping

---

### Edge Case 14: FileMaker `__ID` Conflicts with Existing Supabase Customer

**Scenario**: During migration, FileMaker `__ID` matches an existing Supabase customer created via web app

**Timeline**:
```
T0: Web app user creates customer → Supabase ID: uuid-abc-123
T1: FileMaker has customer with __ID: uuid-abc-123 (collision!)
T2: Migration attempts to import FileMaker customer
T3: Constraint violation (duplicate primary key)
```

**Impact**:
- **Severity**: Low (UUID collision extremely unlikely, but possible)
- **Frequency**: Very Low (probability of collision ~1 in 2^122)

**Detection**:
```python
async def detect_id_conflicts(filemaker_customers):
    """Check if any FileMaker __IDs already exist in Supabase"""
    fm_ids = [c['__ID'] for c in filemaker_customers]

    # Query Supabase for existing IDs
    existing = await supabase.table('customers').select('id').in_('id', fm_ids).execute()
    existing_ids = set([c['id'] for c in existing.data])

    conflicts = [c for c in filemaker_customers if c['__ID'] in existing_ids]

    return conflicts
```

**Recommended Solution**: Skip Conflicting Customers or Merge

**Strategy 1: Skip Conflicting Customers**
```python
async def migrate_customers_with_conflict_detection(filemaker_customers):
    conflicts = await detect_id_conflicts(filemaker_customers)

    if conflicts:
        logger.warning(f"Found {len(conflicts)} ID conflicts, skipping these customers")
        for conflict in conflicts:
            logger.warning(f"Conflict: {conflict['__ID']} - {conflict['Name']}")

    # Filter out conflicts
    safe_customers = [c for c in filemaker_customers if c['__ID'] not in [cf['__ID'] for cf in conflicts]]

    # Proceed with migration
    await migrate_customers_batch(safe_customers)
```

**Strategy 2: Merge Conflicting Customers**
```python
async def merge_conflicting_customers(filemaker_customer, supabase_customer):
    """Merge FileMaker data into existing Supabase customer"""
    logger.info(f"Merging FileMaker customer {filemaker_customer['__ID']} with existing Supabase customer")

    # Update Supabase customer with FileMaker data
    await supabase.table('customers').update({
        'business_name': filemaker_customer['Name'],  # Prefer FileMaker data
        'financial_data': {
            'charge_rate': filemaker_customer.get('chargeRate'),
            'prepay_amount': filemaker_customer.get('f_prePay')
        }
        # Merge other fields...
    }).eq('id', filemaker_customer['__ID']).execute()
```

**Validation**:
- [ ] Create customer in Supabase with ID uuid-test-123
- [ ] Create FileMaker export with customer __ID: uuid-test-123
- [ ] Run conflict detection
- [ ] Verify conflict detected
- [ ] Run migration with conflict handling
- [ ] Verify conflicting customer skipped (or merged based on strategy)

---

## Organization Scoping Edge Cases

### Edge Case 15: Customer Without Organization Assignment

**Scenario**: FileMaker customer has no organization mapping (organization_id is NULL)

**Current Schema**:
- Supabase `customers.organization_id` is **nullable**
- RLS policies filter by organization_id
- Customers with NULL organization_id are **invisible** to all users

**Impact on Migration**:
- **Severity**: High (imported customers invisible to users)
- **Frequency**: High (FileMaker has no organization concept)

**Recommended Solution**: Default Organization Assignment

**Strategy 1: Create "Legacy FileMaker" Organization**
```python
async def ensure_default_organization():
    """Create default organization for FileMaker customers"""

    # Check if default org exists
    default_org = await supabase.table('organizations').select('*').eq('name', 'Legacy FileMaker Customers').execute()

    if not default_org.data:
        # Create default organization
        org = await supabase.table('organizations').insert({
            'id': str(uuid.uuid4()),
            'name': 'Legacy FileMaker Customers',
            'created_at': datetime.now()
        }).execute()

        return org.data[0]['id']
    else:
        return default_org.data[0]['id']

# Migration script
async def migrate_customers(filemaker_customers):
    default_org_id = await ensure_default_organization()

    for customer in filemaker_customers:
        await supabase.table('customers').insert({
            'id': customer['__ID'],
            'business_name': customer['Name'],
            'organization_id': default_org_id,  # Assign to default org
            # ...
        }).execute()
```

**Strategy 2: Assign Based on User Performing Migration**
```python
async def migrate_customers(filemaker_customers, current_user):
    """Assign customers to organization of user performing migration"""

    org_id = current_user.organization_id

    for customer in filemaker_customers:
        await supabase.table('customers').insert({
            'id': customer['__ID'],
            'business_name': customer['Name'],
            'organization_id': org_id,  # Use current user's org
            # ...
        }).execute()
```

**Post-Migration Reassignment**:
```sql
-- Admin can reassign customers to correct organizations later
UPDATE customers
SET organization_id = 'correct-org-uuid'
WHERE organization_id = 'default-org-uuid'
  AND id IN (SELECT unnest(ARRAY['customer-uuid-1', 'customer-uuid-2', ...]));
```

**Validation**:
- [ ] Run migration with organization assignment
- [ ] Verify all customers have organization_id set
- [ ] Log in as user from assigned organization
- [ ] Verify customers visible in list
- [ ] Log in as user from different organization
- [ ] Verify customers NOT visible (RLS working)

**Code References**:
- Migration plan: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1606-1646`
- Authorization doc: `.devflow/tasks/customers-migration-requirements/authorization.md`

---

## Performance Degradation Scenarios

### Edge Case 16: Large Batch Import Timeout

**Scenario**: Importing 500+ customers in single batch request exceeds timeout

**Timeline**:
```
T0: Send POST /api/customers/batch with 500 customers
T1: Backend starts processing batch
T2: 300 customers imported successfully
T3: Request timeout (30 seconds)
T4: Backend continues processing (orphaned request)
T5: Frontend shows error, but backend may complete
```

**Impact**:
- **Severity**: Medium (partial import, unclear state)
- **Frequency**: Medium (depends on batch size configuration)

**Recommended Solution**: Chunked Batch Processing + Progress Tracking

**Frontend Implementation**:
```javascript
// src/services/migrationService.js
async function importCustomersInChunks(customers, chunkSize = 50) {
  const chunks = [];
  for (let i = 0; i < customers.length; i += chunkSize) {
    chunks.push(customers.slice(i, i + chunkSize));
  }

  const results = {
    total: customers.length,
    processed: 0,
    created: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} customers)`);

    try {
      const response = await api.post('/api/customers/batch', {
        customers: chunk,
        options: { skip_duplicates: true, return_errors: true }
      });

      results.processed += chunk.length;
      results.created += response.data.summary.created;
      results.failed += response.data.summary.failed;
      results.errors.push(...response.data.errors);

    } catch (error) {
      console.error(`Chunk ${i + 1} failed:`, error);
      results.failed += chunk.length;
      results.errors.push({
        chunk: i + 1,
        error: error.message
      });
    }

    // Progress callback
    onProgress({
      ...results,
      percentage: Math.round((i + 1) / chunks.length * 100)
    });
  }

  return results;
}
```

**Backend Optimization**:
```python
@router.post("/api/customers/batch")
async def batch_create_customers(
    batch_data: CustomerBatchCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Enforce batch size limit
    if len(batch_data.customers) > 200:
        raise HTTPException(
            status_code=400,
            detail="Batch size exceeds maximum (200 customers per request)"
        )

    # Process batch synchronously (for small batches)
    if len(batch_data.customers) <= 50:
        return await process_batch_sync(batch_data.customers, db)

    # Process batch asynchronously (for large batches)
    else:
        job_id = str(uuid.uuid4())

        # Start background task
        background_tasks.add_task(
            process_batch_async,
            job_id,
            batch_data.customers,
            db
        )

        return {
            "success": true,
            "data": {
                "job_id": job_id,
                "status": "processing",
                "message": "Batch processing started",
                "status_url": f"/api/customers/batch/{job_id}/status"
            }
        }
```

**Validation**:
- [ ] Import 500 customers in chunks of 50
- [ ] Verify all chunks process successfully
- [ ] Verify total customers created = 500
- [ ] Verify no timeout errors
- [ ] Verify progress updates shown to user

---

## Security & Authorization Edge Cases

### Edge Case 17: Cross-Organization Customer Access Attempt

**Scenario**: User from Organization A attempts to access customer from Organization B

**Attack Vector**:
```javascript
// User from Org A tries to fetch customer from Org B
fetch('/api/customers/org-b-customer-uuid', {
  headers: { 'Authorization': 'Bearer org-a-user-token' }
});
```

**Without RLS**:
- Backend query: `SELECT * FROM customers WHERE id = 'org-b-customer-uuid'`
- Result: Customer data returned (security breach!)

**With RLS** (Required):
- Backend query includes: `WHERE id = 'org-b-customer-uuid' AND organization_id = 'org-a-uuid'`
- Result: No rows returned (RLS policy blocks access)
- Response: 404 Not Found (don't reveal existence)

**Recommended Solution**: Row-Level Security (RLS) Policies

**Supabase RLS Policy**:
```sql
-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view customers in their organization
CREATE POLICY "Users can view customers in their organization"
  ON customers FOR SELECT
  TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Policy: Users can only insert customers in their organization
CREATE POLICY "Users can insert customers in their organization"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Policy: Users can only update customers in their organization
CREATE POLICY "Users can update customers in their organization"
  ON customers FOR UPDATE
  TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Policy: Users can only delete customers in their organization
CREATE POLICY "Users can delete customers in their organization"
  ON customers FOR DELETE
  TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
```

**Backend Enforcement** (Defense in Depth):
```python
@router.get("/api/customers/{customer_id}")
async def get_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_user)
):
    # RLS automatically filters by organization_id
    customer = await db.query(Customer).filter_by(id=customer_id).first()

    if not customer:
        # Return 404 (not 403) to avoid revealing existence of customer in other org
        raise HTTPException(status_code=404, detail="Customer not found")

    # Double-check organization scoping (paranoid validation)
    if customer.organization_id != current_user.organization_id:
        logger.warning(f"RLS bypass attempt: User {current_user.id} tried to access customer {customer_id} from org {customer.organization_id}")
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer
```

**Validation (Security Test)**:
```python
async def test_cross_org_access():
    # Create two organizations
    org_a = await create_organization("Org A")
    org_b = await create_organization("Org B")

    # Create users in each org
    user_a = await create_user("user-a@example.com", org_a.id)
    user_b = await create_user("user-b@example.com", org_b.id)

    # Create customer in Org B
    customer_b = await create_customer("Customer B", org_b.id)

    # Attempt to access customer_b as user_a (should fail)
    response = await api.get(
        f"/api/customers/{customer_b.id}",
        headers={"Authorization": f"Bearer {user_a.token}"}
    )

    assert response.status_code == 404, "Cross-org access should be blocked"

    # Verify user_b CAN access customer_b
    response = await api.get(
        f"/api/customers/{customer_b.id}",
        headers={"Authorization": f"Bearer {user_b.token}"}
    )

    assert response.status_code == 200, "Same-org access should succeed"
```

**Code References**:
- Authorization doc: `.devflow/tasks/customers-migration-requirements/authorization.md`
- Migration plan (RLS policies): `.devflow/tasks/customers-migration-requirements/migration-plan.md:146-183`

---

## Summary Matrix

| Edge Case ID | Scenario | Severity | Frequency | Recommended Solution | Validation Required |
|--------------|----------|----------|-----------|---------------------|---------------------|
| EC01 | Concurrent customer updates | High | Low | Optimistic locking (If-Unmodified-Since) | ✅ |
| EC02 | Concurrent create with same email | Medium | Low | Unique constraint + transaction rollback | ✅ |
| EC03 | Customer created, email insert fails | Critical | Low | Database transactions (ACID) | ✅ |
| EC04 | Supabase update succeeds, FileMaker fails | High | Medium | Retry queue + reconciliation job | ✅ |
| EC05 | Request timeout during create | High | Low-Medium | Idempotency keys | ✅ |
| EC06 | Network partition during batch migration | High | Low | Checkpoint-based migration | ✅ |
| EC07 | Customer deleted in FileMaker, orphaned in Supabase | Medium | Low | Cascading deletes + reconciliation | ✅ |
| EC08 | Orphaned related records | Medium | Medium | Add CASCADE constraints + cleanup | ✅ |
| EC09 | Duplicate email addresses | High | Medium | Pre-migration deduplication | ✅ |
| EC10 | Duplicate business names | Low | High | UI disambiguation | ✅ |
| EC11 | Invalid email formats | Medium | Low-Medium | Pre-migration validation + cleanup | ✅ |
| EC12 | Missing address City/State | Medium | Medium | Skip partial addresses | ✅ |
| EC13 | Invalid FileMaker UUID | Critical | Very Low | Generate new UUID + mapping table | ✅ |
| EC14 | FileMaker ID conflicts with Supabase | Low | Very Low | Skip or merge conflicting customers | ✅ |
| EC15 | Customer without organization | High | High | Default organization assignment | ✅ |
| EC16 | Large batch import timeout | Medium | Medium | Chunked processing + progress tracking | ✅ |
| EC17 | Cross-organization access attempt | Critical | Low | RLS policies + backend validation | ✅ |

---

## Document Status

**Status**: ✅ Complete - Ready for Implementation
**Next Steps**:
1. Backend team implements recommended solutions
2. Create integration tests for each edge case
3. Add edge case handling to migration scripts
4. Update error handling in frontend code
5. Document edge case recovery procedures in runbook

**Related Documents**:
- [Migration Plan](./migration-plan.md) - Overall migration strategy
- [API Contracts](./api-contracts.md) - Endpoint specifications
- [Dual-Write Analysis](./dual-write-analysis.md) - Current sync behavior
- [Authorization Requirements](./authorization.md) - Security policies

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Author**: Claude Code (Autonomous Agent)
**Approved By**: Pending Review
