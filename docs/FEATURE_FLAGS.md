# Feature Flag System

## Overview

The Feature Flag system provides a centralized mechanism for controlling the gradual migration from FileMaker to Backend API. It allows safe, incremental rollout of new backend integrations while maintaining backward compatibility with existing FileMaker implementations.

## Architecture

### Components

1. **FeatureFlagContext** (`src/context/FeatureFlagContext.jsx`)
   - Central state management for feature flags
   - Persistence to localStorage
   - Context provider for the application

2. **useFeatureFlag Hook** (`src/hooks/useFeatureFlag.js`)
   - Core hook for accessing feature flags
   - Environment-aware helpers
   - Feature-specific routing logic

3. **Integration in main.jsx**
   - FeatureFlagProvider wraps the application
   - Positioned after AppStateProvider, before other contexts

## Usage

### Basic Usage

```jsx
import { useFeatureFlag } from './hooks';

function CustomerList() {
  const { isFeatureEnabled } = useFeatureFlag();

  if (isFeatureEnabled('use_backend_customers')) {
    return <BackendCustomerList />;
  }
  return <FileMakerCustomerList />;
}
```

### Environment-Aware Usage

The `useEnvironmentAwareFeatureFlag` hook automatically combines feature flags with environment detection:

```jsx
import { useEnvironmentAwareFeatureFlag } from './hooks';

function CustomerAPI() {
  const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();

  if (shouldUseBackend('customers')) {
    // Use backend API
    return backendCustomerAPI.fetchAll();
  }
  // Use FileMaker
  return fileMakerCustomerAPI.fetchAll();
}
```

### Declarative Routing

For complex routing logic, use the `useFeatureRoute` hook:

```jsx
import { useFeatureRoute } from './hooks';

function fetchCustomers() {
  const { route } = useFeatureRoute('customers');

  return route({
    backend: () => backendAPI.customers.fetchAll(),
    filemaker: () => fileMakerAPI.customers.fetchAll()
  });
}
```

## Available Feature Flags

### Authentication
- `use_backend_auth`: Use backend API for authentication (default: `false`)

### Customer Management
- `use_backend_customers`: Use backend API for customer CRUD (default: `false`)
- `use_backend_customer_search`: Use backend API for customer search (default: `false`)
- `use_backend_customer_pagination`: Use backend API for pagination (default: `false`)

### Project Management
- `use_backend_projects`: Use backend API for projects (default: `false`)
- `use_backend_project_notes`: Use backend API for project notes (default: `true` - already migrated)

### Task Management
- `use_backend_tasks`: Use backend API for tasks (default: `false`)
- `use_backend_task_notes`: Use backend API for task notes (default: `true` - already migrated)

### Team Management
- `use_backend_teams`: Use Supabase for team management (default: `true` - already migrated)

### Financial Records
- `use_backend_financial_records`: Use Supabase RPC for financial records (default: `true` - already migrated)

### Products and Sales
- `use_backend_products`: Use backend API for products (default: `false`)
- `use_backend_sales`: Use backend API for sales (default: `false`)

### Proposals
- `use_backend_proposals`: Use backend API for proposals (default: `true` - already migrated)

### Links
- `use_backend_links`: Use backend API for links (default: `true` - already migrated)

### QuickBooks
- `use_backend_quickbooks`: Use backend API for QuickBooks integration (default: `true` - already migrated)

### Marketing (Supabase-only)
- `use_supabase_prospects`: Use Supabase for prospects (default: `true` - no FileMaker equivalent)
- `use_supabase_marketing`: Use Supabase for marketing (default: `true` - no FileMaker equivalent)

## Flag Naming Convention

### Backend Flags
Format: `use_backend_[feature]`

These flags control whether to use the backend API instead of FileMaker for a specific feature.

**Environment behavior:**
- In FileMaker environment: Always `false` (regardless of flag value)
- In web app environment: Respects flag value

### Supabase Flags
Format: `use_supabase_[feature]`

These flags control Supabase-only features that have no FileMaker equivalent.

**Environment behavior:**
- In FileMaker environment: Always `false` (not available)
- In web app environment: Respects flag value

### Legacy Flags
Format: `use_filemaker_[feature]`

These flags explicitly control FileMaker usage (rare).

**Environment behavior:**
- In FileMaker environment: Always `true`
- In web app environment: Respects flag value (for backward compatibility)

## API Reference

### FeatureFlagProvider

Provider component that must wrap the application.

```jsx
<FeatureFlagProvider initialFlags={{ use_backend_customers: true }}>
  <App />
</FeatureFlagProvider>
```

**Props:**
- `initialFlags` (optional): Override default flag values

### useFeatureFlag()

Core hook for accessing feature flags.

**Returns:**
```typescript
{
  flags: Object,                    // All current flag values
  isFeatureEnabled: (flagName: string, options?: Object) => boolean,
  enableFeature: (flagName: string) => void,
  disableFeature: (flagName: string) => void,
  toggleFeature: (flagName: string) => void,
  setFeatureFlags: (newFlags: Object) => void,
  resetFlags: () => void,
  getAllFlags: () => Object,
  getFlagsByPrefix: (prefix: string) => Object
}
```

**Example:**
```jsx
const { isFeatureEnabled, enableFeature, disableFeature } = useFeatureFlag();

if (isFeatureEnabled('use_backend_customers')) {
  // Backend path
}

// Enable a flag
enableFeature('use_backend_customers');

// Disable a flag
disableFeature('use_backend_customers');
```

### useEnvironmentAwareFeatureFlag()

Hook that combines feature flags with environment detection.

**Returns:**
```typescript
{
  // All methods from useFeatureFlag
  ...useFeatureFlag(),

  // Environment-aware helpers
  shouldUseBackend: (featureName: string) => boolean,
  shouldUseSupabase: (featureName: string) => boolean,
  shouldUseFileMaker: (featureName: string) => boolean,
  getDataSource: (featureName: string) => 'backend' | 'filemaker' | 'supabase' | 'unknown',

  // Environment info
  isEnvironmentReady: () => boolean,
  getEnvironmentType: () => string | null,
  environmentType: string | null,
  isFileMakerEnvironment: boolean,
  isWebAppEnvironment: boolean
}
```

**Example:**
```jsx
const { shouldUseBackend, getDataSource } = useEnvironmentAwareFeatureFlag();

// Check if backend should be used
if (shouldUseBackend('customers')) {
  // Use backend
}

// Get current data source
const source = getDataSource('customers'); // 'backend', 'filemaker', 'supabase', or 'unknown'
```

### useFeatureRoute(featureName)

Declarative routing hook for feature-specific logic.

**Parameters:**
- `featureName` (string): Feature name (e.g., 'customers', 'projects')

**Returns:**
```typescript
{
  backend: boolean,        // True if backend should be used
  filemaker: boolean,      // True if FileMaker should be used
  supabase: boolean,       // True if Supabase should be used
  dataSource: string,      // Current data source
  route: (implementations: Object) => any,  // Route to implementation
  isReady: boolean         // Environment detection complete
}
```

**Example:**
```jsx
function CustomerAPI() {
  const { route, backend, filemaker } = useFeatureRoute('customers');

  // Declarative routing
  const fetchAll = () => route({
    backend: () => backendAPI.customers.fetchAll(),
    filemaker: () => fileMakerAPI.customers.fetchAll()
  });

  // Or use boolean checks
  if (backend) {
    return <BackendCustomerList />;
  }
  return <FileMakerCustomerList />;
}
```

## Migration Strategy

### Phase 1: Add Feature Flag
1. Add feature flag to `DEFAULT_FLAGS` in `FeatureFlagContext.jsx` (default: `false`)
2. Document the flag in this document

### Phase 2: Implement Dual Code Paths
1. Add feature flag check in API/service layer
2. Route to backend when flag is enabled
3. Fall back to FileMaker when flag is disabled
4. Test both code paths thoroughly

Example:
```jsx
async function fetchCustomers() {
  const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();

  if (shouldUseBackend('customers')) {
    return backendAPI.customers.fetchAll();
  }
  return fileMakerAPI.customers.fetchAll();
}
```

### Phase 3: Enable in Development
1. Enable flag in development environment
2. Test backend integration thoroughly
3. Verify all edge cases
4. Fix any issues discovered

### Phase 4: Gradual Production Rollout
1. Enable flag in production for specific users/organizations
2. Monitor for errors and performance issues
3. Gradually increase rollout percentage
4. Address any issues discovered

### Phase 5: Full Rollout
1. Enable flag for all users (default: `true`)
2. Monitor system stability
3. Keep FileMaker fallback for safety

### Phase 6: Cleanup
1. Verify backend is working for all users
2. Remove FileMaker code path
3. Remove feature flag check
4. Remove feature flag from `DEFAULT_FLAGS`
5. Update documentation

## Persistence

Feature flags are automatically persisted to `localStorage` under the key `clarity_feature_flags`.

**Storage format:**
```json
{
  "use_backend_customers": true,
  "use_backend_projects": false,
  ...
}
```

**Behavior:**
- Flags are loaded from localStorage on app initialization
- Changes are automatically saved to localStorage
- New flags are merged with stored flags (defaults used for new flags)
- Flags can be manually edited in browser DevTools

## Debugging

### View Current Flags
```javascript
// In browser console
const flags = JSON.parse(localStorage.getItem('clarity_feature_flags'));
console.log(flags);
```

### Enable a Flag Manually
```javascript
// In browser console
const flags = JSON.parse(localStorage.getItem('clarity_feature_flags'));
flags.use_backend_customers = true;
localStorage.setItem('clarity_feature_flags', JSON.stringify(flags));
// Refresh page
```

### Reset All Flags
```javascript
// In browser console
localStorage.removeItem('clarity_feature_flags');
// Refresh page
```

### Check Flag in Component
```javascript
// Add to component
console.log('Current flags:', getAllFlags());
console.log('Using backend for customers:', shouldUseBackend('customers'));
console.log('Data source:', getDataSource('customers'));
```

## Best Practices

### 1. Always Use Environment-Aware Hooks
Prefer `useEnvironmentAwareFeatureFlag()` over raw `useFeatureFlag()` to ensure environment compatibility.

**Good:**
```jsx
const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();
if (shouldUseBackend('customers')) { ... }
```

**Avoid:**
```jsx
const { isFeatureEnabled } = useFeatureFlag();
if (isFeatureEnabled('use_backend_customers')) { ... }
```

### 2. Use Declarative Routing When Possible
`useFeatureRoute` provides cleaner, more maintainable code.

**Good:**
```jsx
const { route } = useFeatureRoute('customers');
return route({
  backend: () => backendFetch(),
  filemaker: () => fileMakerFetch()
});
```

**Avoid:**
```jsx
if (shouldUseBackend('customers')) {
  return backendFetch();
} else {
  return fileMakerFetch();
}
```

### 3. Check Environment Ready State
Always verify environment detection is complete before routing.

**Good:**
```jsx
const { isEnvironmentReady, shouldUseBackend } = useEnvironmentAwareFeatureFlag();

if (!isEnvironmentReady()) {
  return <Loading />;
}

if (shouldUseBackend('customers')) { ... }
```

### 4. Document Flag Changes
Update this document whenever adding, modifying, or removing feature flags.

### 5. Clean Up After Migration
Remove feature flags and dual code paths after successful migration.

### 6. Monitor Flag Usage
Log flag checks during development to ensure correct routing:

```jsx
const source = getDataSource('customers');
console.log(`[CustomerAPI] Using data source: ${source}`);
```

## Examples

### Example 1: Simple Feature Toggle
```jsx
import { useEnvironmentAwareFeatureFlag } from './hooks';

function CustomerList() {
  const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();

  if (shouldUseBackend('customers')) {
    return <BackendCustomerList />;
  }
  return <FileMakerCustomerList />;
}
```

### Example 2: API Client Routing
```jsx
import { useFeatureRoute } from './hooks';

export async function fetchCustomers(options) {
  const { route } = useFeatureRoute('customers');

  return route({
    backend: async () => {
      const response = await backendAPI.get('/customers', { params: options });
      return response.data;
    },
    filemaker: async () => {
      const response = await fileMakerAPI.request({
        layout: 'devCustomers',
        action: 'READ'
      });
      return response.data;
    }
  });
}
```

### Example 3: Gradual Migration with Logging
```jsx
import { useEnvironmentAwareFeatureFlag } from './hooks';

function CustomerService() {
  const { shouldUseBackend, getDataSource } = useEnvironmentAwareFeatureFlag();

  const fetchCustomers = async () => {
    const source = getDataSource('customers');
    console.log(`[CustomerService] Fetching customers using: ${source}`);

    if (shouldUseBackend('customers')) {
      try {
        return await backendAPI.customers.fetchAll();
      } catch (error) {
        console.error('[CustomerService] Backend error, falling back to FileMaker:', error);
        return await fileMakerAPI.customers.fetchAll();
      }
    }

    return await fileMakerAPI.customers.fetchAll();
  };

  return { fetchCustomers };
}
```

### Example 4: Admin Control Panel
```jsx
import { useFeatureFlag } from './hooks';

function FeatureFlagAdmin() {
  const { getAllFlags, toggleFeature, resetFlags } = useFeatureFlag();
  const flags = getAllFlags();

  return (
    <div>
      <h2>Feature Flags</h2>
      <button onClick={resetFlags}>Reset All</button>
      {Object.entries(flags).map(([name, enabled]) => (
        <div key={name}>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => toggleFeature(name)}
            />
            {name}
          </label>
        </div>
      ))}
    </div>
  );
}
```

## Testing

### Unit Testing Feature Flags

```jsx
import { renderHook } from '@testing-library/react-hooks';
import { FeatureFlagProvider, useFeatureFlag } from '../context/FeatureFlagContext';

describe('Feature Flags', () => {
  it('should enable feature', () => {
    const { result } = renderHook(() => useFeatureFlag(), {
      wrapper: FeatureFlagProvider
    });

    expect(result.current.isFeatureEnabled('use_backend_customers')).toBe(false);

    result.current.enableFeature('use_backend_customers');

    expect(result.current.isFeatureEnabled('use_backend_customers')).toBe(true);
  });
});
```

### Integration Testing with Flags

```jsx
import { render } from '@testing-library/react';
import { FeatureFlagProvider } from '../context/FeatureFlagContext';
import CustomerList from './CustomerList';

describe('CustomerList with feature flags', () => {
  it('should render backend version when flag is enabled', () => {
    const { getByText } = render(
      <FeatureFlagProvider initialFlags={{ use_backend_customers: true }}>
        <CustomerList />
      </FeatureFlagProvider>
    );

    expect(getByText('Backend Customer List')).toBeInTheDocument();
  });

  it('should render FileMaker version when flag is disabled', () => {
    const { getByText } = render(
      <FeatureFlagProvider initialFlags={{ use_backend_customers: false }}>
        <CustomerList />
      </FeatureFlagProvider>
    );

    expect(getByText('FileMaker Customer List')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: Flag changes not taking effect
**Solution:** Clear localStorage and refresh:
```javascript
localStorage.removeItem('clarity_feature_flags');
location.reload();
```

### Issue: Backend flag enabled in FileMaker environment
**Solution:** Environment-aware hooks automatically disable backend flags in FileMaker. Verify you're using `shouldUseBackend()` instead of raw `isFeatureEnabled()`.

### Issue: Feature flag not found
**Solution:** Verify the flag is defined in `DEFAULT_FLAGS` in `FeatureFlagContext.jsx`.

### Issue: Flag changes not persisting
**Solution:** Check browser localStorage quota and permissions. Try clearing old data.

## Related Documentation

- [Customer API Integration](./CUSTOMER_API_INTEGRATION.md)
- [Notes Backend Integration](./NOTES_BACKEND_INTEGRATION.md)
- [Teams Migration Guide](./TEAMS_MIGRATION_GUIDE.md)
- [Backend Integration Guide](../BACKEND_INTEGRATION_GUIDE.md)
