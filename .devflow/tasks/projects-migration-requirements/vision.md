# Projects Migration Requirements Documentation

## Overview

Document the complete Projects feature migration from FileMaker to Supabase, including all related entities (objectives, steps, images, links, notes, time records) and business logic (fixed price, subscriptions, sales generation).

## Goals

1. **Complete Feature Documentation**: Document all aspects of the Projects feature as currently implemented in FileMaker
2. **Related Entities Mapping**: Document objectives, objective steps, images, links, and their relationships
3. **Business Logic Capture**: Document fixed price and subscription project logic, sales generation, and billable status management
4. **API Contract Definition**: Define all required backend endpoints/RPCs for projects and related data
5. **Migration Strategy**: Plan for migrating existing FileMaker data to Supabase with relationship integrity
6. **Standardized Documentation**: Follow the 7-file template structure defined in INS0011

## Success Criteria

- Complete `requirements/projects/` folder with all 7 standardized documentation files
- Clear mapping of FileMaker layouts (devProjects, devProjectObjectives, devProjectObjSteps, devProjectImages, devProjectLinks, devNotes, devRecords) to Supabase schema
- Comprehensive API contracts for 20+ operations covering projects and related entities
- Documented business logic for fixed price/subscription projects, sales generation, and team assignments
- Migration plan addressing relationship integrity and ID reconciliation
- Acceptance criteria covering all user flows and edge cases

## Technical Approach

### Phase 1: Analyze Current Implementation
1. Review FileMaker API calls in `src/api/projects.js`
2. Analyze business logic in `src/services/projectService.js`
3. Document UI components and hooks in `src/components/projects/` and `src/hooks/useProject.js`
4. Identify all related entity fetches and data flows
5. Review existing Supabase `projects` table schema and gaps

### Phase 2: Document Related Entities
1. Project Objectives (devProjectObjectives) - CRUD operations
2. Objective Steps (devProjectObjSteps) - nested under objectives
3. Project Images (devProjectImages) - image URLs and metadata
4. Project Links (devProjectLinks) - external links with titles
5. Project Notes (devNotes) - notes with _fkID relationship
6. Time Records (devRecords) - billable hours tracking

### Phase 3: Document Business Logic
1. Fixed price projects (50% sellable on start, 50% sales on completion)
2. Subscription projects (monthly sales generation)
3. Billable status management for time records
4. Status transitions (Open ⟷ Closed)
5. Team assignment logic
6. Project value processing and sales entry creation

### Phase 4: Create Standardized Documentation Files
1. **README.md** - Overview, current behavior, user flows
2. **current-implementation.md** - Frontend call graph, file references
3. **data-model-mapping.md** - FileMaker → Supabase schema mapping
4. **api-contracts.md** - Endpoints/RPCs with request/response examples
5. **authorization.md** - RLS policies, org scoping, permissions
6. **migration-plan.md** - Backfill strategy, ID reconciliation, cutover
7. **acceptance-criteria.md** - Test cases, edge cases, validation rules

## Files to Create/Modify

### New Documentation Files
- `requirements/projects/README.md`
- `requirements/projects/current-implementation.md`
- `requirements/projects/data-model-mapping.md`
- `requirements/projects/api-contracts.md`
- `requirements/projects/authorization.md`
- `requirements/projects/migration-plan.md`
- `requirements/projects/acceptance-criteria.md`

## Dependencies

- Access to FileMaker layouts: devProjects, devProjectObjectives, devProjectObjSteps, devProjectImages, devProjectLinks, devNotes, devRecords
- Existing Supabase schema inspection for `projects`, `links` tables
- Understanding of fixed price/subscription business logic from `projectService.js`
- Knowledge of `dualWriteService.js` patterns for reference

## Key Code References

- **API Layer**: `src/api/projects.js` (all FileMaker operations)
- **Service Layer**: `src/services/projectService.js` (business logic, data processing)
- **Hook**: `src/hooks/useProject.js` (state management, operations)
- **Components**:
  - `src/components/projects/ProjectDetails.jsx`
  - `src/components/projects/ProjectObjectivesTab.jsx`
  - `src/components/projects/ProjectLinksTab.jsx`
  - `src/components/projects/ProjectNotesTab.jsx`
- **Context**: `src/context/ProjectContext.jsx`

## Related Insight Tasks

- INS0002: Original Projects migration task
- INS0011: Standardize Projects migration requirements docs (this feature implements INS0011)
- INS0001: Customers migration (for reference on template structure)

## Notes

- Projects table already exists in Supabase but lacks related entities (objectives, steps, images)
- Links table exists in Supabase with project_id foreign key
- Fixed price and subscription logic is critical business logic that must be preserved
- Time records (devRecords) have complex relationship to projects for billable hours tracking
- Current implementation uses dual IDs: UUID (`__ID`/`id`) and FileMaker recordId
