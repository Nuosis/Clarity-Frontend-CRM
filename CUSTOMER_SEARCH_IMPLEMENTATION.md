# Customer Search Implementation

## Overview
This document describes the customer search functionality implemented in the useCustomer hook using the new backend `/api/customers/search` endpoint.

## Backend API Endpoint

### Endpoint
`GET /api/customers/search`

### Authentication
- JWT Bearer token (Supabase) for web app
- HMAC Bearer token for service-to-service

### Query Parameters
- `q` (required): Search query string, minimum 1 character
- `limit` (optional): Maximum number of results, default 20, max 100

### Search Behavior
- **Case-insensitive** partial matching (ILIKE)
- **Search fields**: name, business_name, first_name, last_name, primary_contact_name, email addresses, phone numbers
- **Results**: Deduplicated and sorted by relevance
- **Exact matches** prioritized over partial matches
- **Organization scoping**: Automatic filtering by organization from JWT/HMAC auth

### Response Format
Returns array of customer objects in `CustomerListResponse` format (without nested relationships for performance)

## Frontend Implementation

### API Layer (`src/api/customers.js`)

Added `searchCustomers()` function:

```javascript
/**
 * Searches customers by query string (environment-aware)
 * @param {string} query - Search query string (min 1 character)
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 20, max: 100)
 * @returns {Promise<Array>} Array of matching customer records
 */
export async function searchCustomers(query, options = {})
```

**Features:**
- Environment-aware routing (FileMaker vs web app)
- Query validation (min 1 character)
- FileMaker fallback: fetches all customers and filters client-side
- Web app: uses backend search endpoint
- Result limit enforcement (max 100)

### Hook Layer (`src/hooks/useCustomer.js`)

Added search functionality to `useCustomer` hook:

**New State:**
```javascript
const [searchResults, setSearchResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

**New Functions:**
```javascript
handleCustomerSearch(query, options)
clearSearch()
```

**Search Handler:**
```javascript
/**
 * Searches customers by query string with debouncing
 * @param {string} query - Search query string (min 1 character)
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 20, max: 100)
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Promise<void>}
 */
const handleCustomerSearch = useCallback((query, options = {}) => { ... })
```

**Features:**
- **Debouncing**: 300ms default delay (configurable)
- **Real-time feedback**: Updates `searchQuery` state immediately
- **Auto-clear**: Clears results on empty query
- **Query validation**: Enforces minimum 1 character
- **Loading state**: Sets `isSearching` during API call
- **Error handling**: Catches and logs errors, clears results
- **Cleanup**: Clears timeout on unmount

## Usage Examples

### Basic Search
```javascript
const {
  searchResults,
  isSearching,
  searchQuery,
  handleCustomerSearch,
  clearSearch
} = useCustomer();

// Trigger search
handleCustomerSearch('Acme Corp');

// Access results
console.log(searchResults); // Array of matching customers
console.log(isSearching);   // false when complete
console.log(searchQuery);   // 'Acme Corp'
```

### Search with Options
```javascript
// Custom limit and debounce
handleCustomerSearch('John', {
  limit: 50,        // Max 50 results
  debounceMs: 500   // 500ms debounce
});
```

### Clear Search
```javascript
// Clear search state
clearSearch();
// searchQuery = ''
// searchResults = []
// isSearching = false
```

### Real-time Search Input
```javascript
function CustomerSearchInput() {
  const { handleCustomerSearch, searchResults, isSearching } = useCustomer();

  return (
    <div>
      <input
        type="text"
        placeholder="Search customers..."
        onChange={(e) => handleCustomerSearch(e.target.value)}
      />
      {isSearching && <div>Searching...</div>}
      <ul>
        {searchResults.map(customer => (
          <li key={customer.id}>{customer.Name || customer.business_name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Environment Behavior

### Web App Environment
1. User types in search input
2. `handleCustomerSearch()` called with query
3. Debounce timer started (300ms default)
4. After delay, API request to `/api/customers/search?q={query}&limit={limit}`
5. Backend processes search with organization scoping
6. Results transformed via `processBackendCustomerList()`
7. State updated with results

### FileMaker Environment
1. User types in search input
2. `handleCustomerSearch()` called with query
3. Debounce timer started (300ms default)
4. After delay, `fetchCustomers()` called to get all customers
5. Client-side filtering on Name, Email, Phone, ContactPerson
6. Results transformed via `processCustomerData()`
7. State updated with filtered results

## Data Transformation

### Web App (Backend Response)
```javascript
// Backend returns:
{
  id: "uuid",
  business_name: "Acme Corp",
  primary_contact_name: "John Doe",
  is_active: true,
  emails: [...],
  phones: [...],
  addresses: [...]
}

// Transformed to FileMaker-compatible format:
{
  __ID: "uuid",
  id: "uuid",
  Name: "Acme Corp",
  Email: "primary@example.com",
  Phone: "555-1234",
  ContactPerson: "John Doe",
  f_active: "1",
  isActive: true,
  Address: "123 Main St",
  City: "New York",
  State: "NY",
  ...
}
```

### FileMaker (Direct Response)
```javascript
// FileMaker returns:
{
  fieldData: {
    __ID: "123",
    Name: "Acme Corp",
    Email: "contact@acme.com",
    Phone: "555-1234",
    f_active: "1",
    ...
  },
  recordId: "456"
}

// Processed to:
{
  __ID: "123",
  id: "123",
  recordId: "456",
  Name: "Acme Corp",
  Email: "contact@acme.com",
  Phone: "555-1234",
  isActive: true,
  ...
}
```

## Error Handling

### Query Validation
- Empty or whitespace-only queries: Clear results, no API call
- Query < 1 character: Clear results, no API call

### Network Errors
- Caught and logged to console
- Error message stored in `error` state
- Search results cleared
- `isSearching` set to false

### Timeout Cleanup
- Debounce timeout cleared on unmount
- Prevents memory leaks
- Prevents stale API calls

## Performance Considerations

### Debouncing
- Default 300ms delay prevents excessive API calls
- Configurable via `debounceMs` option
- User can type freely without triggering multiple requests

### Result Limits
- Default 20 results for fast response times
- Maximum 100 results enforced
- Backend handles pagination and sorting

### FileMaker Fallback
- Client-side filtering only used in FileMaker environment
- Web app always uses optimized backend search
- No performance impact on web app users

## Testing Checklist

- [ ] Search with empty query clears results
- [ ] Search with 1+ characters triggers API call
- [ ] Debouncing prevents rapid-fire requests
- [ ] Loading state updates correctly
- [ ] Results populate `searchResults` array
- [ ] Error handling displays errors
- [ ] Clear search resets all state
- [ ] FileMaker environment filters client-side
- [ ] Web app environment uses backend endpoint
- [ ] Organization scoping works correctly
- [ ] Result limit enforced (max 100)
- [ ] Timeout cleanup on unmount

## Migration Notes

### Backward Compatibility
- ✅ No breaking changes to existing useCustomer interface
- ✅ FileMaker environment continues to work
- ✅ Existing customer load/select/update functions unchanged
- ✅ New search features are additive only

### New Dependencies
- None - uses existing React hooks and API infrastructure

### Required Backend Changes
- ✅ Backend endpoint `/api/customers/search` must be deployed
- ✅ Organization scoping must be configured
- ✅ HMAC authentication must be working

## Future Enhancements

### Potential Improvements
1. **Search suggestions**: Auto-complete dropdown
2. **Search history**: Store recent searches
3. **Advanced filters**: Add date range, status, location filters
4. **Fuzzy matching**: Handle typos and variations
5. **Result highlighting**: Highlight matching text
6. **Result caching**: Cache search results for common queries
7. **Export results**: Export search results to CSV
8. **Saved searches**: Save frequently used search queries

### Performance Optimizations
1. **Virtual scrolling**: For large result sets
2. **Infinite scroll**: Load more results on scroll
3. **Memoization**: Cache processed results
4. **Request cancellation**: Cancel pending requests on new search

## Related Files

- `src/api/customers.js` - API layer with `searchCustomers()` function
- `src/hooks/useCustomer.js` - Hook with search state and handlers
- `src/services/customerService.js` - Data transformation utilities
- `src/api/index.js` - Export configuration

## References

- Backend API: `https://api.claritybusinesssolutions.ca/docs#/customers/search_customers_api_customers_search_get`
- OpenAPI Spec: `https://api.claritybusinesssolutions.ca/openapi.json`
- CLAUDE.md: Project-wide integration guidelines
