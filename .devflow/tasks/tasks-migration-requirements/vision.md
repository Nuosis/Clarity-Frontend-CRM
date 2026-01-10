# Tasks + Timer Migration Requirements

## Overview

This feature documents the existing FileMaker-based task management and timer system to enable migration to a Supabase-only architecture. The current system uses FileMaker as the primary data source with dual-write synchronization to Supabase `customer_sales` table for financial records.

## Goals

1. **Complete Documentation**: Document all current task CRUD operations, timer lifecycle, and financial record generation
2. **Data Model Mapping**: Map FileMaker `devTasks` and `devRecords` layouts to Supabase equivalents
3. **Backend Requirements**: Define API endpoints, RPCs, and business logic requirements for Supabase-only implementation
4. **Migration Strategy**: Plan for migrating existing tasks, timer history, and financial records
5. **Test Coverage**: Define acceptance criteria and test cases for edge cases

## Success Criteria

- Comprehensive documentation of current behavior under `requirements/tasks/`
- Clear data model mapping from FileMaker to Supabase
- Complete backend API requirements specification
- Migration strategy with data reconciliation approach
- Test cases covering race conditions, offline scenarios, and partial failures

## Technical Approach

### Current Architecture

**FileMaker Components:**
- **devTasks Layout**: Stores task records with fields: `__ID`, `task`, `type`, `f_completed`, `_projectID`, `_staffID`, `f_priority`
- **devRecords Layout**: Stores timer/financial records with fields: `_taskID`, `_staffID`, `_projectID`, `_custID`, `TimeStart`, `TimeEnd`, `TimeAdjust`, `Work Performed`
- **FileMaker Bridge**: fm-gofer library handles all FileMaker communication

**Current Flow:**
1. Task CRUD operations via `src/api/tasks.js` → FileMaker `devTasks` layout
2. Timer start creates record in `devRecords` with `TimeStart`
3. Timer stop updates `devRecords` with `TimeEnd`, description, and adjustments
4. On timer stop, `taskService.stopTimer()` fetches financial record and creates Supabase `customer_sales` entry
5. `dualWriteService.js` orchestrates FileMaker + Supabase writes
6. `financialSyncService.js` reconciles `devRecords` ↔ `customer_sales`

### Target Architecture

**Supabase Components:**
- **tasks table**: Task records (need to verify schema exists or define new schema)
- **time_entries table**: Timer/time tracking records (need to verify schema exists or define new schema)
- **customer_sales table**: Financial/billable records (already exists)
- **Backend API**: HMAC-authenticated endpoints for task operations

**Target Flow:**
1. Task CRUD via Backend API endpoints
2. Timer operations via Backend API with business logic enforcement
3. Financial record creation handled by backend on timer stop
4. No dual-write - Supabase is single source of truth

## Key Files

### API Layer
- `src/api/tasks.js` - FileMaker task operations (189 lines)
- `src/api/fileMaker.js` - FileMaker bridge utilities

### Service Layer
- `src/services/taskService.js` - Task business logic (658 lines)
- `src/services/dualWriteService.js` - Dual-write orchestration (359 lines)
- `src/services/financialSyncService.js` - Financial record sync (695 lines)
- `src/services/salesService.js` - Supabase customer_sales operations

### UI Components
- `src/components/tasks/TaskTimer.jsx` - Timer UI component (353 lines)
- `src/components/tasks/TaskList.jsx` - Task list display
- `src/hooks/useTask.js` - Task operations hook

### Documentation Target
- `requirements/tasks/README.md` - Main documentation (to be created)
- `requirements/tasks/data-model-mapping.md` - Schema mapping (to be created)
- `requirements/tasks/backend-requirements.md` - API specification (to be created)
- `requirements/tasks/migration-strategy.md` - Migration plan (to be created)
- `requirements/tasks/test-cases.md` - Test scenarios (to be created)

## Dependencies

- Understanding of FileMaker Data API and fm-gofer bridge
- Supabase schema verification (tasks/time_entries tables may not exist)
- Backend API architecture (HMAC auth, endpoint patterns)
- QuickBooks integration for billable time
- Customer/Project relationship model

## Risks and Considerations

1. **No Supabase Schema**: `tasks` and `time_entries` tables don't currently exist in Supabase
2. **Historical Data**: Large volume of historical timer records in FileMaker needs migration
3. **Financial Integrity**: Must maintain billable record accuracy during migration
4. **Timer State**: Active timers during migration need special handling
5. **Race Conditions**: Timer start/stop operations need idempotency and concurrency controls
6. **Fixed-Price Projects**: Current logic skips customer_sales creation for fixed-price projects

## Migration Phases

### Phase 1: Requirements Documentation (This Feature)
- Document existing behavior
- Define data models
- Specify backend requirements
- Plan migration approach

### Phase 2: Backend Implementation (Future)
- Create Supabase schema
- Implement backend API endpoints
- Add business logic and validations
- Deploy and test

### Phase 3: Frontend Migration (Future)
- Update API layer to use backend endpoints
- Remove FileMaker dependencies
- Update UI components
- Add error handling

### Phase 4: Data Migration (Future)
- Export historical data from FileMaker
- Transform and validate
- Import to Supabase
- Reconcile and verify

### Phase 5: Dual-Write Removal (Future)
- Remove dualWriteService
- Remove financialSyncService FileMaker logic
- Clean up deprecated code
