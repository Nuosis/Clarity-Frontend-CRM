# Customers Backend API Integration

## Overview

Integrate the frontend customer management system with the new backend API endpoints at `/api/customers/*`. The backend has migrated from FileMaker-only storage to a modern relational database with proper organization scoping, nested relationships, and JWT/HMAC authentication.

## Current State

The frontend currently uses:
- **API Layer**: `src/api/customers.js` - FileMaker-only operations via fm-gofer bridge
- **Service Layer**: `src/services/customerService.js` - FileMaker data processing
- **Hook Layer**: `src/hooks/useCustomer.js` - State management with FileMaker + Supabase dual-write
- **Components**: `src/components/customers/*` - UI components expecting FileMaker data model

## Goals

1. **Migrate to new backend API** while maintaining FileMaker backward compatibility
2. **Support new data model** with nested emails, phones, and addresses
3. **Implement proper authentication** using JWT tokens with organization scoping
4. **Update all CRUD operations** to use new endpoints with proper error handling
5. **Maintain existing UI** with minimal changes while supporting richer data model
6. **Ensure data consistency** between environments

## Success Criteria

- ✅ Customer list loads from `/api/customers` with pagination
- ✅ Customer detail view loads from `/api/customers/{id}` with nested data
- ✅ Create customer works with `/api/customers` POST endpoint
- ✅ Update customer works with `/api/customers/{id}` PATCH endpoint
- ✅ Delete customer works with `/api/customers/{id}` DELETE endpoint
- ✅ Status toggle works with `/api/customers/{id}/status` PATCH endpoint
- ✅ Search works with `/api/customers/search` endpoint
- ✅ Organization scoping is properly enforced
- ✅ FileMaker environment continues to work (backward compatibility)
- ✅ UI displays new fields (emails, phones, addresses) correctly
- ✅ Error handling is comprehensive and user-friendly
- ✅ All tests pass

## Technical Approach

### 1. API Layer Refactoring

Update `src/api/customers.js` to:
- Detect environment (FileMaker vs Web App)
- Route to appropriate backend (FileMaker bridge vs Backend API)
- Handle new request/response schemas for backend API
- Implement HMAC or JWT authentication for backend calls
- Support pagination parameters (limit, offset)
- Handle nested relationships (emails, phones, addresses)

### 2. Service Layer Updates

Update `src/services/customerService.js` to:
- Process new backend response format
- Transform nested emails/phones/addresses
- Handle organization scoping
- Support both FileMaker and backend data formats
- Validate new schema fields (business_name, type, primary_contact_name)

### 3. Hook Layer Modifications

Update `src/hooks/useCustomer.js` to:
- Use new API endpoints
- Handle new response formats
- Manage nested relationship state
- Support pagination
- Handle organization context from JWT

### 4. Component Updates

Update customer components to:
- Display nested emails (primary + additional)
- Display nested phones (primary + additional)
- Display nested addresses (primary + additional)
- Show customer type field
- Show business_name and primary_contact_name
- Handle new validation rules

### 5. Environment Detection

Enhance environment detection in `src/services/dataService.js`:
- Prioritize backend API for web app environment
- Fall back to FileMaker for FileMaker environment
- Handle authentication properly for each environment

## New Data Model

### Backend Customer Schema

```javascript
{
  id: "uuid",                      // Customer ID
  name: "string",                  // Customer name (required)
  first_name: "string?",           // First name (optional)
  last_name: "string?",            // Last name (optional)
  business_name: "string",         // Business name (required)
  type: "string",                  // customer, prospect, staff, etc.
  is_active: boolean,              // Active status
  primary_contact_name: "string?", // Primary contact
  organization_id: "uuid",         // Organization (auto-assigned)
  created_at: "timestamp",         // Created timestamp
  updated_at: "timestamp",         // Updated timestamp
  emails: [                        // Nested emails
    {
      id: "uuid",
      email_address: "string",
      email_type: "work|home|other",
      is_primary: boolean
    }
  ],
  phones: [                        // Nested phones
    {
      id: "uuid",
      phone_number: "string",
      phone_type: "mobile|work|home|other",
      is_primary: boolean
    }
  ],
  addresses: [                     // Nested addresses
    {
      id: "uuid",
      street_address: "string",
      city: "string",
      state: "string",
      postal_code: "string",
      country: "string",
      address_type: "billing|shipping|home|other",
      is_primary: boolean
    }
  ]
}
```

### FileMaker Legacy Schema

```javascript
{
  id: "string",           // __ID field
  recordId: "string",     // FileMaker record ID
  Name: "string",         // Customer name
  Email: "string",        // Single email field
  Phone: "string",        // Single phone field
  Address: "string",      // Address line
  City: "string",         // City
  State: "string",        // State
  PostalCode: "string",   // Postal code
  Country: "string",      // Country
  f_active: "1"|"0",      // Active flag
  ContactPerson: "string",// Contact person
  createdAt: "timestamp", // ~creationTimestamp
  modifiedAt: "timestamp" // ~modificationTimestamp
}
```

## Files to Modify

### API Layer
- `src/api/customers.js` - Complete rewrite with environment routing

### Service Layer
- `src/services/customerService.js` - Add backend data processing
- `src/services/dataService.js` - Enhance environment detection

### Hook Layer
- `src/hooks/useCustomer.js` - Update to use new endpoints
- `src/hooks/useSupabaseCustomer.js` - May need updates for consistency

### Components
- `src/components/customers/CustomerDetails.jsx` - Display nested data
- `src/components/customers/CustomerForm.jsx` - Handle new fields
- `src/components/customers/CustomerHeader.jsx` - Display new stats
- `src/components/customers/CustomerTabs.jsx` - Support new data

### Configuration
- Update any environment detection logic
- Document new environment variables if needed

## Dependencies

- Backend API must be deployed and accessible at `https://api.claritybusinesssolutions.ca`
- JWT authentication must be working in Supabase auth flow
- Organization ID must be available in user context
- HMAC secret key must be configured in environment variables

## Migration Strategy

1. **Phase 1**: Add new backend API client alongside existing FileMaker client
2. **Phase 2**: Update service layer to handle both data formats
3. **Phase 3**: Update hooks to use new API in web app environment
4. **Phase 4**: Update components to display new fields
5. **Phase 5**: Test thoroughly in both environments
6. **Phase 6**: Deploy with feature flag if needed

## Backward Compatibility

- FileMaker environment continues to use existing fm-gofer bridge
- Web app environment uses new backend API
- Data transformations ensure consistent interface for components
- Graceful degradation if backend API unavailable

## Testing Strategy

1. Unit tests for data transformation functions
2. Integration tests for API client
3. Hook tests for state management
4. Component tests for UI rendering
5. End-to-end tests for full workflows
6. Manual testing in both FileMaker and web app environments

## Risk Mitigation

- Feature flag for gradual rollout
- Comprehensive error handling
- Fallback to FileMaker if backend fails
- Detailed logging for debugging
- Rollback plan if issues arise
