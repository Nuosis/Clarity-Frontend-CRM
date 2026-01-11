# Tasks & Timer - Migration Requirements

## Overview

This document outlines the requirements for migrating the Tasks and Timer feature from FileMaker to Supabase. Tasks and time tracking are currently FileMaker-primary, with a dual-write layer (`dualWriteService.js`) syncing timer outcomes to Supabase `customer_sales`.

## Current Implementation

**Source of Truth:** FileMaker layouts `devTasks` (tasks) and `dapiRecords` (time/financial records)

**Dual-Write Pattern:** Timer stop events write to both:
- FileMaker `dapiRecords` layout (primary)
- Supabase `customer_sales` table (synchronized copy via `dualWriteService.js`)

**Frontend Components:**
- `TaskTimer.jsx`: Timer UI with start/stop/pause/resume controls
- `TaskList.jsx`: Task listing and management
- Timer state managed in component with localStorage persistence

**API Layer:**
- `src/api/tasks.js`: Task CRUD operations + timer start/stop
- All operations currently route through FileMaker bridge

**Services:**
- `src/services/dualWriteService.js`: Synchronizes timer stop → customer_sales
- `src/services/financialSyncService.js`: Reconciles FileMaker dapiRecords ↔ Supabase customer_sales
- `src/services/billableHoursService.js`: Processes time/financial data

## User Workflows

### Task Management
1. User views project → sees task list
2. User creates new task with description, type, assigned staff
3. User marks task complete/incomplete
4. User edits task details or notes

### Timer Operations
1. User starts timer for a task
   - Creates record in FileMaker `dapiRecords` with `TimeStart`, `DateStart`
   - Captures task ID, project ID, customer ID, staff ID

2. User pauses timer (optional)
   - Tracks pause duration in local state
   - Does NOT write to FileMaker until stop

3. User resumes timer (optional)
   - Accumulates total pause time

4. User stops timer
   - Prompts for "Work Performed" description
   - Updates FileMaker record with `TimeEnd`, description, `TimeAdjust`
   - **Dual-write:** Creates matching `customer_sales` record in Supabase
   - Billable amount calculated based on elapsed time minus pauses/adjustments

### Financial Record Generation
When timer stops:
1. FileMaker calculates duration and billable amount
2. FileMaker record becomes source of truth
3. `dualWriteService.js` creates corresponding `customer_sales` record
4. `financialSyncService.js` can reconcile discrepancies later

## Dependencies

**FileMaker Layouts:**
- `devTasks`: Task CRUD
- `dapiRecords`: Timer/financial records

**Supabase Tables (Current):**
- `customer_sales`: Receives dual-written timer outcomes
- `tasks`: Exists but not used yet (FileMaker is primary)
- `time_entries`: May exist or need creation

**Related Features:**
- Customers (provides customer context)
- Projects (tasks belong to projects)
- Financial Records (timer stop creates billable records)
- Staff/Teams (tasks assigned to staff)

## Migration Goals

1. **Make Supabase Source of Truth:**
   - Tasks CRUD → Supabase `tasks` table
   - Timer operations → Supabase `time_entries` table
   - Financial records → Supabase `customer_sales` table

2. **Remove FileMaker Dependencies:**
   - Replace `fetchDataFromFileMaker()` calls in `tasks.js`
   - Remove `dualWriteService.js` (no longer needed)
   - Deprecate `financialSyncService.js` reconciliation

3. **Preserve Timer Semantics:**
   - Start/stop/pause/resume logic
   - Time adjustments (±6 min)
   - Work description capture
   - Billable amount calculation
   - Idempotency for timer start (prevent duplicates)
   - Concurrency protection (one active timer per task/user)

4. **Backend Requirements:**
   - RPC/endpoints for task CRUD
   - Timer start/stop/pause with business rules
   - Financial record creation on timer stop
   - Reconciliation queries for discrepancies

## Success Criteria

- Frontend calls Supabase instead of FileMaker for all task/timer operations
- Timer semantics preserved (start/stop/pause/adjust)
- Financial records created correctly on timer stop
- No dual-write service needed
- Historical FileMaker tasks/records migrated to Supabase
- RLS policies enforce organization-scoped access

## Documentation Structure

This requirements folder contains:
- **README.md** (this file): Overview and context
- **current-implementation.md**: Detailed code analysis and call flows
- **data-model-mapping.md**: FileMaker → Supabase schema mapping
- **api-contracts.md**: Backend endpoints/RPCs specification
- **authorization.md**: RLS policies and access control
- **migration-plan.md**: Data migration and cutover strategy
- **acceptance-criteria.md**: Test cases and validation

## Code References

**Frontend API:**
- `src/api/tasks.js`: Task CRUD, timer start/stop (317 lines)
- `src/components/tasks/TaskTimer.jsx`: Timer UI component (353 lines)
- `src/components/tasks/TaskList.jsx`: Task management UI

**Services:**
- `src/services/dualWriteService.js`: Dual-write wrapper (359 lines)
- `src/services/financialSyncService.js`: FileMaker ↔ Supabase reconciliation
- `src/services/billableHoursService.js`: Time/billing calculations

**FileMaker Layouts:**
- `devTasks`: Task records
- `dapiRecords`: Timer/financial records (also known as `Layouts.RECORDS`)

## Migration Phases

**Phase 1:** Requirements Documentation (this folder) ✅
**Phase 2:** Backend Implementation (Supabase schema + RPCs)
**Phase 3:** Frontend Refactor (remove FileMaker calls)
**Phase 4:** Data Migration (historical records)
**Phase 5:** Testing & Rollout
**Phase 6:** Cleanup (remove dual-write service)

---

**Status:** Phase 1 Complete - Ready for Backend Implementation
