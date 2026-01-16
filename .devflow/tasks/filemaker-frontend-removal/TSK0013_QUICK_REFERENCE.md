# TSK0013: Quick Reference - initializationService FileMaker Removal

## What Changed

### initializationService.js

**Removed Methods:**
```javascript
❌ waitForFileMaker(checkReadyFn, maxRetries)
❌ loadUserContext()
❌ delay(ms)
```

**Still Available:**
```javascript
✅ fetchSupabaseUserId(user, setUser)
✅ preloadData(loadCustomers)
✅ loadProducts(setProducts, setLoading, setError)
✅ getCurrentPhase()
✅ reset()
```

### index.jsx

**Removed:**
```javascript
❌ useFileMakerBridge hook import
❌ FileMaker bridge hook usage
❌ fmReady, fmError, fmStatus variables
❌ FileMaker initialization block
❌ FileMaker readiness UI
```

**Added:**
```javascript
✅ FileMaker deprecation handler
✅ Error message for FileMaker environments
```

## Migration Examples

### Before (FileMaker-aware)
```javascript
// Wait for FileMaker
await initializationService.waitForFileMaker(() => fmReady);

// Load FileMaker user context
const userContext = await initializationService.loadUserContext();
setUser(userContext);

// Fetch Supabase IDs from FileMaker context
const supabaseIds = await initializationService.fetchSupabaseUserId(userContext, setUser);
```

### After (Supabase-only)
```javascript
// User context from Supabase auth (handled by SignIn component)
const webAppUser = {
    userEmail: authUser.email,
    userName: authUser.user_metadata?.full_name || authUser.email,
    userID: authUser.id
};
setUser(webAppUser);

// Fetch Supabase organization ID
const supabaseIds = await initializationService.fetchSupabaseUserId(webAppUser, setUser);
```

## Error Handling

### FileMaker Environment Detection

If FileMaker environment is detected:
```javascript
console.warn('[App] FileMaker environment detected but no longer supported.');
setError('FileMaker environment is no longer supported. Please access the application through the web interface.');
```

**User sees:**
```
Error: FileMaker environment is no longer supported.
Please access the application through the web interface.
```

## Initialization Flow

### Web App (Supported)
1. SignIn component → Supabase authentication
2. `handleSupabaseAuth()` → Set environment as WEBAPP
3. `initialize()` → Load user context
4. `fetchSupabaseUserId()` → Get organization ID
5. `loadProducts()` → Load products
6. `loadUnbilledSalesForOrganization()` → Load sales
7. `preloadData()` → Load customers and teams
8. ✅ Application ready

### FileMaker (Deprecated)
1. SignIn component → FileMaker detected
2. `handleFileMakerDetected()` → Set environment as FILEMAKER
3. `initialize()` → Check environment type
4. ❌ FileMaker deprecation handler triggers
5. Error displayed to user
6. 🛑 Initialization halted

## API Surface

### initializationService Singleton

```javascript
import { initializationService } from './services/initializationService';

// Fetch Supabase user ID and organization ID
const result = await initializationService.fetchSupabaseUserId(user, setUser);
// Returns: { supabaseUserId, supabaseOrgId }

// Preload customers and teams
await initializationService.preloadData(async () => {
    await loadCustomers();
    await loadTeams();
});

// Load products (single-tenancy)
await initializationService.loadProducts(setProducts, setLoading, setError);

// Get current initialization phase
const phase = initializationService.getCurrentPhase();
// Values: 'idle', 'preloading_data', 'loading_products', 'fetching_supabase_user_id'

// Reset service state
initializationService.reset();
```

## Dependencies

**Dependencies Removed:**
```javascript
❌ import { fetchDataFromFileMaker } from '../api/fileMaker';
```

**Dependencies Kept:**
```javascript
✅ import { query } from './supabaseService';
✅ import { loadAllProductsToState } from './productService';
```

## Testing

### Verify Web App Works
```javascript
// 1. Authenticate via Supabase
// 2. Check user context loaded
// 3. Verify organization ID retrieved
// 4. Confirm products and sales loaded
// 5. Verify customers and teams preloaded
```

### Verify FileMaker Shows Error
```javascript
// 1. Simulate FileMaker environment (window.FileMaker = {})
// 2. Attempt authentication
// 3. Check error message displayed
// 4. Verify initialization halted
```

## Build Verification

```bash
npm run build
# ✓ 1436 modules transformed.
# ✓ built in 2.49s
```

## Related Tasks

- ✅ TSK0004-TSK0009: Backend API integrations (complete)
- ✅ TSK0013: Remove FileMaker from initializationService (complete)
- ⏳ TSK0014: Remove FileMaker from SignIn component (next)
- ⏳ TSK0015: Simplify dataService (next)
- ⏳ TSK0016: Remove useFileMakerBridge hook (next)

## Support

**For FileMaker Users:**
- Error: "FileMaker environment is no longer supported"
- Action: Use web app at `https://app.claritybusinesssolutions.ca`
- Authentication: Use Supabase credentials

**For Developers:**
- All FileMaker initialization methods removed
- Use Supabase authentication flow only
- Environment detection still exists (SignIn component)
- Deprecation handler provides clear error messages
