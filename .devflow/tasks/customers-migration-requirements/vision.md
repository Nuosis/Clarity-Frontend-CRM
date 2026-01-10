# Customers Migration Requirements Documentation

## Overview

Create comprehensive documentation for migrating the Customers feature from FileMaker to Supabase. This documentation will serve as the specification for backend implementation and frontend refactoring.

## Goals

1. **Document Current Implementation**: Fully catalog how Customers currently works with FileMaker
2. **Define Data Model Mapping**: Map FileMaker devCustomers fields to Supabase schema
3. **Specify API Contracts**: Define backend endpoints needed to replace FileMaker operations
4. **Plan Migration Strategy**: Document how to migrate existing data and reconcile IDs
5. **Define Acceptance Criteria**: Establish testing requirements and success metrics

## Success Criteria

- Complete requirements documentation in `requirements/customers/` folder
- 7 documentation files covering all aspects of the migration
- Clear mapping of FileMaker fields to Supabase tables/columns
- Detailed API endpoint specifications with request/response examples
- Comprehensive migration plan with rollback strategy
- Test cases covering edge cases and failure scenarios

## Technical Approach

### Phase 1: Investigation
- Analyze current FileMaker integration (`src/api/customers.js`)
- Review Supabase schema and related tables
- Identify all UI components depending on customer data
- Document dual-write patterns and synchronization logic

### Phase 2: Documentation
- Create standardized documentation templates
- Document current implementation and call flows
- Map data models between FileMaker and Supabase
- Define API contracts with examples
- Plan migration strategy and data backfill

### Phase 3: Validation
- Review documentation for completeness
- Verify all edge cases are covered
- Ensure backend team has actionable requirements

## Files to Create

1. `requirements/customers/README.md` - Overview and summary
2. `requirements/customers/current-implementation.md` - Frontend call flows
3. `requirements/customers/data-model-mapping.md` - Field mappings
4. `requirements/customers/api-contracts.md` - Endpoint specifications
5. `requirements/customers/authorization.md` - RLS and security
6. `requirements/customers/migration-plan.md` - Data migration strategy
7. `requirements/customers/acceptance-criteria.md` - Test cases

## Key Files to Reference

### API Layer
- `src/api/customers.js` - FileMaker API calls
- `src/api/fileMaker.js` - FileMaker bridge infrastructure

### Service Layer
- `src/services/customerService.js` - Business logic
- `src/services/dualWriteService.js` - FileMaker→Supabase sync
- `src/services/dataService.js` - Environment routing

### Hooks
- `src/hooks/useCustomer.js` - Customer operations hook
- `src/hooks/useSupabaseCustomer.js` - Supabase integration

### Components
- `src/components/customers/CustomerDetails.jsx`
- `src/components/customers/CustomerForm.jsx`
- `src/components/customers/CustomerHeader.jsx`
- `src/components/customers/CustomerTabs.jsx`

## Dependencies

- Backend team approval for schema changes
- Understanding of existing FileMaker→Supabase sync behavior
- Access to FileMaker `devCustomers` layout field definitions
- Knowledge of related entities (projects, tasks, notes, links)

## Related Tasks

This documentation feeds into:
- Backend API implementation
- Frontend refactoring to remove FileMaker dependency
- Data migration execution
- Testing and validation

## Notes

- Customers currently use FileMaker as primary source with Supabase sync
- Multiple Supabase tables involved: customers, customer_contacts, customer_address, customer_email, customer_phone, customer_sales
- ID reconciliation is critical: FileMaker uses `__ID` and `recordId`, Supabase uses UUIDs
- Must maintain backward compatibility during migration period
