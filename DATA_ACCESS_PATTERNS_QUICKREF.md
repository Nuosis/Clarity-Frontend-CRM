# Data Access Patterns - Quick Reference

**Last Updated:** 2026-01-24

---

## Pattern Status by Feature

| Feature | Pattern | File | Auth | Status |
|---------|---------|------|------|--------|
| Customers | Backend API | `src/api/customers.js` | HMAC+JWT | ✅ Correct |
| Projects | Backend API | `src/api/projects.js` | HMAC+JWT | ✅ Correct |
| Tasks | Backend API | `src/api/tasks.js` | HMAC+JWT | ✅ Correct |
| Notes | Backend API | `src/api/notes.js` | HMAC+JWT | ✅ Correct |
| Financial | Backend API | `src/api/financialRecords.js` | HMAC+JWT | ✅ Correct |
| Proposals | Backend API | `src/api/proposals.js` | HMAC+JWT | ✅ Correct |
| Marketing | Backend API | `src/api/marketing.js` | HMAC+JWT | ✅ Correct |
| **Prospects** | **Direct Supabase** | `src/api/prospects.js` | **JWT only** | ❌ **Migrate** |
| **Teams** | **Direct Supabase** | `src/api/teams.js` | **JWT only** | ❌ **Migrate** |
| **Products** | **Direct Supabase** | `src/services/productService.js` | **JWT only** | ❌ **Migrate** |
| **Init Service** | **Direct Supabase** | `src/services/initializationService.js` | **JWT only** | ❌ **Migrate** |

**Architecture Consistency: 64% (7/11 features)**

---

## Code Patterns

### ✅ CORRECT: Backend API Pattern

```javascript
// File: src/api/[feature].js
import { dataService, getAuthenticationContext } from '../services/dataService';

// Organization scope check
function checkOrganizationScope({ authentication: auth }, operation) {
    if (!auth?.user?.supabaseOrgID) {
        throw new Error(`Organization context required for ${operation}`);
    }
}

// API function
export async function fetchFeatureData(params) {
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchFeatureData');

    const response = await dataService.get('/api/feature', { params });
    return normalizeData(response.data);
}

// Data normalization
function normalizeData(data) {
    if (Array.isArray(data)) {
        return data.map(item => ({
            id: item.id,
            __ID: item.id,
            // snake_case → camelCase
            fieldName: item.field_name
        }));
    }
    return data;
}
```

**Benefits:**
- ✅ HMAC authentication
- ✅ Backend validation
- ✅ Atomic transactions
- ✅ Centralized error handling
- ✅ Audit logging
- ✅ Consistent patterns

---

### ❌ WRONG: Direct Supabase Pattern

```javascript
// File: src/api/[feature].js
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../config.js'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const fetchFeatureData = async () => {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed: ${error.message}`)
  return data
}
```

**Problems:**
- ❌ No HMAC authentication
- ❌ No backend validation
- ❌ Manual transaction management
- ❌ Bypasses business logic
- ❌ No audit trail
- ❌ Inconsistent with architecture

---

## Migration Priority

### 🔴 Priority 1: Prospects
**File:** `src/api/prospects.js`
**Effort:** 3 days
**Risk:** LOW
**Strategy:** Extend `/api/customers` endpoints with `type=PROSPECT` filter

### 🔴 Priority 2: Products
**File:** `src/services/productService.js`
**Effort:** 2 days
**Risk:** LOW
**Strategy:** Create new `/api/products` endpoints

### 🟡 Priority 3: Initialization
**File:** `src/services/initializationService.js`
**Effort:** 3 days
**Risk:** MEDIUM
**Strategy:** Create `/api/auth/user-context` endpoint

### 🟡 Priority 4: Teams
**File:** `src/api/teams.js`
**Effort:** 5 days
**Risk:** MEDIUM
**Strategy:** Wait for backend schema deployment, then migrate

---

## Quick Checks

### Is This Code Using the Correct Pattern?

**✅ YES if you see:**
```javascript
import { dataService } from '../services/dataService';
const response = await dataService.get('/api/...');
```

**❌ NO if you see:**
```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(...)
await supabase.from('table')...
```

**⚠️ WARNING if you see:**
```javascript
import { query } from './supabaseService';
await query('table_name', { ... });
```
This is an abstraction but still uses direct Supabase!

---

## For New Features

### DO ✅
1. Use Backend API pattern
2. Import `dataService` from `../services/dataService`
3. Check organization scope
4. Use HMAC authentication (automatic via dataService)
5. Normalize snake_case → camelCase
6. Follow existing examples: `src/api/customers.js`, `src/api/projects.js`

### DON'T ❌
1. Create new Supabase client instances
2. Import `@supabase/supabase-js` directly
3. Use `supabaseService.query()` abstraction
4. Bypass backend API
5. Manual transaction management
6. Skip organization scope checks

---

## Testing Checklist

For Backend API migrations:

- [ ] Create API client in `src/api/[feature].js`
- [ ] Update service layer in `src/services/[feature]Service.js`
- [ ] Update hook in `src/hooks/use[Feature].js`
- [ ] Add unit tests for API client
- [ ] Add integration tests for end-to-end flow
- [ ] Test organization scoping
- [ ] Test error scenarios
- [ ] Verify HMAC authentication works
- [ ] Check build passes: `npm run build`
- [ ] Manual testing in dev environment

---

## Reference Files

**Good Examples (Backend API):**
- `src/api/customers.js` - Customer CRUD with nested entities
- `src/api/projects.js` - Project operations with notes
- `src/api/tasks.js` - Tasks with timers
- `src/api/notes.js` - Multi-entity notes

**Bad Examples (Direct Supabase):**
- `src/api/prospects.js` - Needs migration
- `src/api/teams.js` - Needs migration
- `src/services/productService.js` - Needs migration

**Core Services:**
- `src/services/dataService.js` - Backend API client (use this!)
- `src/services/supabaseService.js` - Direct Supabase (avoid this!)

---

## Documentation

- **Full Review:** `DATA_ACCESS_PATTERN_REVIEW.md`
- **Summary:** `DATA_ACCESS_REVIEW_SUMMARY.md`
- **Completion:** `.devflow/tasks/customers-backend-integration/DATA_ACCESS_PATTERN_REVIEW_COMPLETE.md`
- **Architecture:** `CLAUDE.md`
- **Customer Integration:** `docs/CUSTOMER_API_INTEGRATION.md`
- **Notes Integration:** `docs/NOTES_BACKEND_INTEGRATION.md`

---

**Need Help?**
1. Check `src/api/customers.js` as reference implementation
2. Read `DATA_ACCESS_REVIEW_SUMMARY.md` for context
3. Follow Backend API pattern for all new features
