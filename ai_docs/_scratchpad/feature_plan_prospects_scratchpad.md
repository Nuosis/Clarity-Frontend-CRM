# Feature Planning Scratchpad: Prospects Tab

## Discovery Notes

### Primary Function
Add a "Prospects" tab to the left of "Customers" in the header navigation. Prospects are customer records with a specific type designation in Supabase. The tab should provide full CRUD capabilities matching existing customer patterns.

### User Impact
- Sales team can manage prospects separately from active customers
- Clear distinction between prospects (potential customers) and customers (active clients)
- Industry tracking via customer_settings table
- Full contact management (email, phone, address)

### Success Metrics
- Prospects tab appears in header navigation
- Full CRUD operations work for prospects
- Industry field can be set and displayed
- Contact information (email, phone, address) can be managed
- UI/UX matches existing customer patterns

### Scope Boundaries (MVP)
**INCLUDED:**
- Prospects tab in header (left of Customers)
- Prospects list in sidebar
- Full CRUD for prospects
- Industry field via customer_settings
- Email, phone, address management
- Customers remains default tab

**EXCLUDED (YAGNI):**
- Prospect-to-customer conversion workflow (defer to future)
- Prospect-specific analytics/reporting
- Bulk import/export
- Advanced filtering beyond active/inactive

## Dependency Analysis

### Database Schema (Supabase)

**CRITICAL FINDING: customertype enum issue**
- Current enum values: FAMILY, FRIEND, COLLEAGUE, CUSTOMER, STAFF
- **NO 'PROSPECT' value exists**
- **DECISION REQUIRED**: Add 'PROSPECT' to enum OR use existing value?

**customers table:**
- `id` (uuid, PK)
- `type` (customertype enum) - **NEEDS 'PROSPECT' value**
- `name`, `first_name`, `last_name`, `business_name` (text)
- `created_at`, `updated_at` (timestamps)

**Related tables (all with customer_id FK):**
- `customer_email` (id, customer_id, email, is_primary, created_at, updated_at)
- `customer_phone` (id, customer_id, phone, type, is_primary, created_at, updated_at)
- `customer_address` (id, customer_id, [address fields], created_at, updated_at)
- `customer_settings` (id, customer_id, type, data, created_at, modified_at)
  - Flexible key-value pattern: `type` (text) + `data` (text)
  - **PERFECT for industry**: type='industry', data='Technology'

### Existing Code Patterns

**Navigation (TopNav.jsx lines 1-207):**
- Button-based tabs with `sidebarMode` state
- Handlers: handleCustomerClick, handleProductClick, handleTeamClick, handleMarketingClick
- Active tab styling with underline animation
- **NEED**: handleProspectClick handler + Prospects button

**Sidebar (Sidebar.jsx lines 1-845):**
- Renders lists based on `sidebarMode` ('customer', 'team', 'product', 'marketing')
- CustomerListItem component (lines 79-257) with status toggle + delete
- Header with "Add" button per mode
- **NEED**: Prospect list rendering when sidebarMode='prospect'

**State Management (AppStateContext.jsx lines 1-494):**
- `sidebarMode` state: 'customer' | 'team' | 'product' | 'marketing'
- **NEED**: Add 'prospect' as valid sidebarMode value
- Reducer clears selections when switching modes

**Data Layer:**
- **Hook**: src/hooks/useCustomer.js (lines 1-234) - Custom hook pattern
- **API**: src/api/customers.js (lines 1-134) - FileMaker API integration
- **Service**: src/services/customerService.js (lines 1-162) - Business logic
- **Component**: src/components/customers/CustomerDetails.jsx (lines 1-215)

### Integration Points
1. **TopNav.jsx**: Add Prospects button + handler
2. **Sidebar.jsx**: Add prospect list rendering
3. **AppStateContext.jsx**: Add 'prospect' to sidebarMode enum
4. **Database**: Add 'PROSPECT' to customertype enum OR use existing value
5. **API/Hooks/Services**: Filter by type field for prospects vs customers
6. **Components**: Reuse CustomerDetails.jsx with prospect-specific adaptations

## Compliance Checks
- [ ] Charter alignment verified
- [ ] PRD requirements mapped
- [ ] Architecture compliance confirmed
- [ ] Design blueprint reviewed

## Questions & Decisions

### Q1: customertype enum - Add PROSPECT or use existing value?
**Options:**
1. Add 'PROSPECT' to customertype enum (requires DB migration)
2. Use existing value like 'COLLEAGUE' for prospects
3. Use NULL type for prospects

**Recommendation**: Add 'PROSPECT' to enum for clarity and future-proofing

### Q2: Customers tab filtering - Show only type='CUSTOMER' or include NULL?
**Context**: Existing customers may have NULL type for backward compatibility
**Options:**
1. Customers tab shows ONLY type='CUSTOMER'
2. Customers tab shows type='CUSTOMER' OR type IS NULL
3. Customers tab shows all except type='PROSPECT'

**Recommendation**: Option 3 for backward compatibility

### Q3: FileMaker sync - Should prospects sync to FileMaker?
**Context**: Project is migrating FileMaker → Supabase, FileMaker is legacy
**Options:**
1. Prospects remain Supabase-only (NEW FEATURES pattern)
2. Prospects sync to FileMaker (backward compatibility)

**Recommendation**: Supabase-only (follows migration pattern)

### Q4: Prospect-to-customer conversion - Include in MVP?
**Context**: User mentioned full CRUD but didn't specify conversion
**Options:**
1. Include conversion workflow in MVP
2. Defer to future iteration (YAGNI)

**Recommendation**: Defer (YAGNI principle)

### Q5: Industry field implementation - customer_settings or new column?
**Context**: customer_settings uses flexible key-value pattern
**Options:**
1. Use customer_settings (type='industry', data='value')
2. Add industry column to customers table

**Recommendation**: Use customer_settings (existing pattern, no migration)

### Q6: Default tab - Keep Customers as default?
**Context**: User specified "Customers should still be the default tab"
**Confirmation**: Customers remains default, Prospects is additional option

## Risk Mitigation
- **Risk**: Database enum modification requires migration
  - **Mitigation**: Coordinate with backend team, test thoroughly
- **Risk**: Existing customer data may have NULL type
  - **Mitigation**: Handle NULL gracefully in filtering logic
- **Risk**: UI confusion between prospects and customers
  - **Mitigation**: Clear visual distinction, separate tabs