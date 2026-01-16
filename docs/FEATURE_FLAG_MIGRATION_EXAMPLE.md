# Feature Flag Migration Example

This document provides a step-by-step example of migrating a feature from FileMaker to Backend API using feature flags.

## Example: Migrating Customer Search

This example demonstrates migrating the customer search functionality from FileMaker to the Backend API.

### Current State (FileMaker Only)

**src/api/customers.js:**
```jsx
export async function searchCustomers(query) {
  // FileMaker implementation
  const params = {
    layout: Layouts.CUSTOMERS,
    action: Actions.READ,
    query: [{ "Name": `*${query}*` }]
  };

  return await dataService.request(params);
}
```

**src/components/CustomerSearch.jsx:**
```jsx
import { searchCustomers } from '../api/customers';

function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const customers = await searchCustomers(query);
    setResults(customers);
  };

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch}>Search</button>
      <CustomerList customers={results} />
    </div>
  );
}
```

---

## Step 1: Add Feature Flag

**src/context/FeatureFlagContext.jsx:**
```jsx
const DEFAULT_FLAGS = {
  // ... existing flags

  // Add new flag
  use_backend_customer_search: false, // Default: false (FileMaker)

  // ... other flags
};
```

**Update docs/FEATURE_FLAGS.md:**
```markdown
### Customer Management
- `use_backend_customer_search`: Use backend API for customer search (default: `false`)
```

---

## Step 2: Implement Backend Integration

**src/api/customers.js:**
```jsx
import { useFeatureRoute } from '../hooks';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';

export async function searchCustomers(query) {
  const env = getEnvironmentContext();

  // Check feature flag (synchronous for API layer)
  const flags = JSON.parse(localStorage.getItem('clarity_feature_flags') || '{}');
  const useBackend = flags.use_backend_customer_search &&
                     env.type === ENVIRONMENT_TYPES.WEBAPP;

  if (useBackend) {
    // Backend implementation
    console.log('[CustomerAPI] Using backend for search:', query);

    try {
      const response = await dataService.get('/customers/search', {
        params: { q: query }
      });

      return response.data;
    } catch (error) {
      console.error('[CustomerAPI] Backend search error, falling back:', error);
      // Fall back to FileMaker on error
    }
  }

  // FileMaker implementation
  console.log('[CustomerAPI] Using FileMaker for search:', query);
  const params = {
    layout: Layouts.CUSTOMERS,
    action: Actions.READ,
    query: [{ "Name": `*${query}*` }]
  };

  return await dataService.request(params);
}
```

**Alternative: Hook-based approach in component:**

**src/hooks/useCustomerSearch.js:**
```jsx
import { useEnvironmentAwareFeatureFlag } from './useFeatureFlag';
import { dataService } from '../services/dataService';
import { Layouts, Actions } from '../api/fileMaker';

export function useCustomerSearch() {
  const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchCustomers = async (query) => {
    setLoading(true);
    setError(null);

    try {
      if (shouldUseBackend('customer_search')) {
        // Backend implementation
        console.log('[CustomerSearch] Using backend API');
        const response = await dataService.get('/customers/search', {
          params: { q: query }
        });
        return response.data;
      } else {
        // FileMaker implementation
        console.log('[CustomerSearch] Using FileMaker');
        const params = {
          layout: Layouts.CUSTOMERS,
          action: Actions.READ,
          query: [{ "Name": `*${query}*` }]
        };
        return await dataService.request(params);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { searchCustomers, loading, error };
}
```

**src/components/CustomerSearch.jsx:**
```jsx
import { useCustomerSearch } from '../hooks/useCustomerSearch';

function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const { searchCustomers, loading, error } = useCustomerSearch();

  const handleSearch = async () => {
    try {
      const customers = await searchCustomers(query);
      setResults(customers);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        disabled={loading}
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      {error && <div className="error">{error}</div>}
      <CustomerList customers={results} />
    </div>
  );
}
```

---

## Step 3: Test in Development

### 3.1 Test FileMaker Path (Default)

**In browser console:**
```javascript
// Verify flag is disabled
const flags = JSON.parse(localStorage.getItem('clarity_feature_flags'));
console.log(flags.use_backend_customer_search); // false

// Test search
// Should see: "[CustomerSearch] Using FileMaker"
```

### 3.2 Enable Backend Path

**In browser console:**
```javascript
// Enable flag
const flags = JSON.parse(localStorage.getItem('clarity_feature_flags'));
flags.use_backend_customer_search = true;
localStorage.setItem('clarity_feature_flags', JSON.stringify(flags));

// Refresh page and test search
// Should see: "[CustomerSearch] Using backend API"
```

### 3.3 Test Both Environments

**FileMaker WebViewer:**
- Flag should be automatically disabled (environment check)
- Should use FileMaker path regardless of flag value

**Web App:**
- Flag controls which path is used
- Test with flag enabled and disabled

### 3.4 Test Error Handling

**Simulate backend error:**
```javascript
// In CustomerSearch component, add error simulation
if (shouldUseBackend('customer_search')) {
  // Temporarily break backend call to test fallback
  throw new Error('Simulated backend error');
}
```

Verify:
- Error is logged
- Falls back to FileMaker
- User sees appropriate error message

---

## Step 4: Gradual Rollout

### 4.1 Internal Testing (Week 1)
- Enable flag for development team only
- Test all edge cases
- Monitor error logs
- Verify performance

**Enable for specific user:**
```javascript
// Admin panel or browser console for specific users
if (user.email === 'dev@claritybusinesssolutions.ca') {
  enableFeature('use_backend_customer_search');
}
```

### 4.2 Beta Testing (Week 2)
- Enable for beta users (10-20% of users)
- Collect feedback
- Monitor error rates
- Compare performance with FileMaker

**Enable for beta users:**
```javascript
// In initialization service
if (user.betaTester) {
  setFeatureFlags({ use_backend_customer_search: true });
}
```

### 4.3 Gradual Rollout (Week 3-4)
- Increase to 50% of users
- Monitor for issues
- Be ready to disable quickly if problems arise

**Percentage-based rollout:**
```javascript
// In initialization service
const rolloutPercentage = 50; // 50% of users
const userHash = hashString(user.email);
if (userHash % 100 < rolloutPercentage) {
  setFeatureFlags({ use_backend_customer_search: true });
}
```

### 4.4 Full Rollout (Week 5)
- Enable for 100% of users
- Keep FileMaker fallback for safety
- Monitor for 1-2 weeks before cleanup

**Update default:**
```javascript
// src/context/FeatureFlagContext.jsx
const DEFAULT_FLAGS = {
  use_backend_customer_search: true, // Changed to true
};
```

---

## Step 5: Monitor and Optimize

### 5.1 Add Monitoring

**Add performance tracking:**
```jsx
import { useEnvironmentAwareFeatureFlag } from './useFeatureFlag';

export function useCustomerSearch() {
  const { shouldUseBackend, getDataSource } = useEnvironmentAwareFeatureFlag();

  const searchCustomers = async (query) => {
    const startTime = performance.now();
    const source = getDataSource('customer_search');

    try {
      let results;
      if (shouldUseBackend('customer_search')) {
        results = await backendSearch(query);
      } else {
        results = await fileMakerSearch(query);
      }

      const duration = performance.now() - startTime;

      // Log performance metrics
      console.log('[CustomerSearch] Performance:', {
        source,
        query,
        duration: `${duration.toFixed(2)}ms`,
        resultCount: results.length
      });

      // Send to analytics (optional)
      analytics.track('customer_search', {
        source,
        duration,
        resultCount: results.length,
        success: true
      });

      return results;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error('[CustomerSearch] Error:', {
        source,
        query,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      });

      // Send error to analytics
      analytics.track('customer_search_error', {
        source,
        error: error.message,
        duration
      });

      throw error;
    }
  };

  return { searchCustomers };
}
```

### 5.2 Compare Performance

**Analyze metrics:**
```javascript
// After 1 week of 50/50 split
analytics.compare('customer_search', {
  dimension: 'source',
  metric: 'duration',
  period: '7d'
});

// Expected output:
// Backend: avg 150ms, p95 300ms
// FileMaker: avg 250ms, p95 500ms
```

### 5.3 Optimize Based on Data

If backend is slower:
- Check database indexes
- Optimize query
- Add caching
- Review N+1 queries

If backend has more errors:
- Review error logs
- Fix edge cases
- Improve validation
- Add better error messages

---

## Step 6: Cleanup

After 2+ weeks of stable operation at 100% rollout:

### 6.1 Remove Feature Flag

**src/context/FeatureFlagContext.jsx:**
```jsx
const DEFAULT_FLAGS = {
  // Remove: use_backend_customer_search
};
```

### 6.2 Remove FileMaker Code Path

**src/api/customers.js:**
```jsx
export async function searchCustomers(query) {
  // Remove FileMaker implementation
  // Remove feature flag check

  // Only backend implementation remains
  console.log('[CustomerAPI] Searching customers:', query);

  const response = await dataService.get('/customers/search', {
    params: { q: query }
  });

  return response.data;
}
```

### 6.3 Update Documentation

**Remove from docs/FEATURE_FLAGS.md:**
```markdown
- ~~`use_backend_customer_search`~~ (Removed: 2026-01-15 - Migration complete)
```

**Add to migration log:**
```markdown
## Completed Migrations

### Customer Search (2026-01-15)
- Feature: Customer search functionality
- Flag: `use_backend_customer_search`
- Duration: 5 weeks (2025-12-10 to 2026-01-15)
- Issues: None
- Performance: Backend 40% faster (150ms vs 250ms avg)
```

### 6.4 Update Tests

Remove feature flag from tests:
```jsx
// Before
describe('CustomerSearch', () => {
  it('should use backend when flag enabled', () => {
    const { result } = renderHook(() => useCustomerSearch(), {
      wrapper: props => (
        <FeatureFlagProvider initialFlags={{ use_backend_customer_search: true }}>
          {props.children}
        </FeatureFlagProvider>
      )
    });
    // ...
  });
});

// After
describe('CustomerSearch', () => {
  it('should search customers', () => {
    const { result } = renderHook(() => useCustomerSearch());
    // ... test only backend path
  });
});
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Forgetting Environment Check
**Problem:** Backend flag enabled in FileMaker environment causes errors

**Solution:** Always use environment-aware hooks
```jsx
// Bad
if (isFeatureEnabled('use_backend_customer_search')) { ... }

// Good
if (shouldUseBackend('customer_search')) { ... }
```

### Pitfall 2: Not Handling Errors
**Problem:** Backend errors break entire feature

**Solution:** Add fallback to FileMaker
```jsx
try {
  if (shouldUseBackend('customer_search')) {
    return await backendSearch(query);
  }
} catch (error) {
  console.error('Backend search failed, falling back:', error);
  // Fall through to FileMaker
}

return await fileMakerSearch(query);
```

### Pitfall 3: Inconsistent Data Format
**Problem:** Backend returns different format than FileMaker

**Solution:** Normalize data at API layer
```jsx
function normalizeSearchResults(results, source) {
  if (source === 'backend') {
    return results.map(r => ({
      id: r.id,
      name: r.business_name,
      email: r.primary_email
    }));
  }

  // FileMaker format
  return results.map(r => ({
    id: r.__ID,
    name: r.fieldData.Name,
    email: r.fieldData.Email
  }));
}
```

### Pitfall 4: No Logging
**Problem:** Hard to debug which path is being used

**Solution:** Add comprehensive logging
```jsx
const source = getDataSource('customer_search');
console.log(`[CustomerSearch] Using ${source} for query:`, query);

// Result
console.log(`[CustomerSearch] ${source} returned ${results.length} results in ${duration}ms`);
```

### Pitfall 5: Removing Code Too Soon
**Problem:** Issues discovered after FileMaker code removed

**Solution:** Keep FileMaker fallback for 2+ weeks after 100% rollout
- Monitor error rates
- Check user feedback
- Verify all edge cases work
- Only remove after confidence is high

---

## Rollback Procedure

If issues are discovered during rollout:

### Immediate Rollback (Emergency)

**Disable flag globally:**
```javascript
// In browser console or admin panel
const flags = JSON.parse(localStorage.getItem('clarity_feature_flags'));
flags.use_backend_customer_search = false;
localStorage.setItem('clarity_feature_flags', JSON.stringify(flags));

// Or update default in code
const DEFAULT_FLAGS = {
  use_backend_customer_search: false, // Rollback
};
```

### Investigate and Fix

1. Check error logs
2. Review recent backend changes
3. Test backend path locally
4. Fix issues
5. Re-test thoroughly

### Re-enable Gradually

1. Fix verified in development
2. Re-enable for beta users
3. Monitor closely
4. Increase rollout percentage slowly
5. Full rollout when stable

---

## Checklist

Use this checklist for each feature migration:

- [ ] Add feature flag to DEFAULT_FLAGS (default: false)
- [ ] Document flag in FEATURE_FLAGS.md
- [ ] Implement backend integration
- [ ] Add environment-aware routing
- [ ] Add error handling and fallback
- [ ] Add logging and monitoring
- [ ] Test FileMaker path (flag disabled)
- [ ] Test backend path (flag enabled)
- [ ] Test in both environments (FileMaker WebViewer and Web App)
- [ ] Test error scenarios
- [ ] Enable for dev team (Week 1)
- [ ] Enable for beta users (Week 2)
- [ ] Gradual rollout 50% (Week 3)
- [ ] Full rollout 100% (Week 4)
- [ ] Monitor for 2+ weeks
- [ ] Remove FileMaker code path
- [ ] Remove feature flag
- [ ] Update documentation
- [ ] Update tests

---

## Resources

- [Feature Flags Documentation](./FEATURE_FLAGS.md)
- [Customer API Integration](./CUSTOMER_API_INTEGRATION.md)
- [Backend Integration Guide](../BACKEND_INTEGRATION_GUIDE.md)
