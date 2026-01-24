# Code Review: Inconsistent Hook State Management Patterns

**Date:** 2026-01-24
**Reviewer:** Claude Code
**Severity:** Medium
**Category:** Code Quality & Maintainability

## Executive Summary

The custom hooks in the Clarity CRM Frontend codebase exhibit significant inconsistencies in state management patterns, error handling, loading states, and data fetching approaches. While individual hooks are functional, the lack of standardization increases maintenance burden, cognitive load for developers, and potential for bugs.

## Scope of Review

Analyzed hooks:
- `useCustomer.js` - 505 lines
- `useNote.js` - 302 lines
- `useProject.js` - 876 lines
- `useTask.js` - 529 lines
- `useTeam.js` - 595 lines
- `useProspect.js` - 237 lines
- `useProducts.js` - 246 lines

## Key Findings

### 1. Inconsistent Error Handling Patterns

**Issue:** Four different error handling approaches across hooks.

#### Pattern A: Basic String Error (useNote, useTeam, useProspect)
```javascript
// useNote.js:10
const [error, setError] = useState(null);

// Error handling
setError(errorMessage);
showError(errorMessage);
```

#### Pattern B: Dual Error State (useCustomer)
```javascript
// useCustomer.js:32-33
const [error, setError] = useState(null);
const [formattedError, setFormattedError] = useState(null);

// Error handling with formatting
const setErrorWithFormatting = useCallback((err) => {
    const formatted = formatErrorForUI(err);
    setError(formatted.message);
    setFormattedError(formatted);
}, []);
```

#### Pattern C: Service Error Only (useTask)
```javascript
// useTask.js:24
const [error, setError] = useState(null);

// Simple error state, relies on showError for display
showError(err.message);
```

#### Pattern D: Result Object Pattern (useProducts)
```javascript
// useProducts.js - Returns success/error objects
return {
    success: false,
    error: err.message
};
```

**Impact:**
- Developers must remember different error handling conventions per hook
- Inconsistent UI error feedback
- Difficult to implement global error handling strategies

**Recommendation:**
- Standardize on a single error handling pattern across all hooks
- Prefer Pattern B (dual error state) for consistency with backend integration
- Use `formatErrorForUI` utility consistently

---

### 2. Inconsistent Loading State Management

**Issue:** Three different loading state approaches.

#### Pattern A: Single Loading State (useNote, useProspect, useTeam)
```javascript
// useNote.js:9
const [loading, setLoading] = useState(false);
```

#### Pattern B: App-Level + Local Loading (useProducts)
```javascript
// useProducts.js:21-22
const [loading, setLoading] = useState(false);
const { setLoading: setAppLoading } = useAppStateOperations();

// Both states updated
setLoading(true);
setAppLoading(true);
```

#### Pattern C: Initial Loading True (useCustomer, useTask, useProject)
```javascript
// useCustomer.js:31
const [loading, setLoading] = useState(true);
```

**Impact:**
- Inconsistent initial loading UI states
- Race conditions between app-level and hook-level loading states
- Confusing developer experience

**Recommendation:**
- Standardize initial loading state (prefer `false` with explicit data loading)
- Use app-level loading only for critical initialization operations
- Document loading state conventions in CLAUDE.md

---

### 3. Inconsistent Pagination State Management

**Issue:** Three different pagination implementations.

#### Pattern A: Single Pagination Object (useCustomer)
```javascript
// useCustomer.js:37-42
const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
});
```

#### Pattern B: Per-Entity Pagination Map (useNote)
```javascript
// useNote.js:13
const [paginationByEntity, setPaginationByEntity] = useState({});

// Keyed by entity type and ID
const key = `${entityType}-${entityId}`;
return paginationByEntity[key] || { limit: 50, offset: 0, hasMore: false, total: 0 };
```

#### Pattern C: No Pagination (useProject, useTask, useProspect, useTeam)
```javascript
// No pagination state - loads all records
```

**Impact:**
- Inconsistent data fetching behavior
- Performance issues for large datasets without pagination
- Different UI implementations for similar data lists

**Recommendation:**
- Implement pagination for all list-based hooks (useProject, useTask, useTeam)
- Standardize pagination object structure:
  ```javascript
  {
      total: number,
      limit: number,
      offset: number,
      hasMore: boolean  // Use camelCase consistently
  }
  ```
- Use per-entity pagination pattern for hooks managing multiple entity types

---

### 4. Inconsistent State Initialization Patterns

**Issue:** State initialization varies wildly across hooks.

#### Pattern A: Direct State Only (useNote)
```javascript
// useNote.js:9-10
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

#### Pattern B: LocalStorage Restoration (useTask)
```javascript
// useTask.js:31-53
const [timer, setTimer] = useState(() => {
    const savedTimer = localStorage.getItem('activeTimer');
    if (savedTimer) {
        try {
            return JSON.parse(savedTimer);
        } catch (error) {
            localStorage.removeItem('activeTimer');
        }
    }
    return { /* default state */ };
});
```

#### Pattern C: Ref-Based Caching (useCustomer)
```javascript
// useCustomer.js:47-58
const searchTimeoutRef = useRef(null);
const searchRequestIdRef = useRef(0);
const isMountedRef = useRef(true);
const paginationRef = useRef(pagination);

useEffect(() => {
    paginationRef.current = pagination;
}, [pagination]);
```

#### Pattern D: Auto-Initialization (useProducts)
```javascript
// useProducts.js:40-45
useEffect(() => {
    if (!initialized) {
        loadProducts();
    }
}, [initialized]);
```

**Impact:**
- Unpredictable initialization behavior
- Memory leaks from uncleared refs
- Race conditions from auto-initialization

**Recommendation:**
- Document when to use each initialization pattern
- Prefer explicit initialization over auto-initialization
- Standardize ref usage patterns (cleanup in useEffect)

---

### 5. Inconsistent Data Fetching Patterns

**Issue:** Multiple approaches to fetching and processing data.

#### Pattern A: Environment-Aware Routing (useCustomer, useProject)
```javascript
// useCustomer.js:101-127
const env = getEnvironmentContext();
if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
    processedCustomers = processCustomerData(result);
} else {
    const processed = processBackendCustomerList(result);
    processedCustomers = processed.customers;
}
```

#### Pattern B: Direct Backend API (useNote)
```javascript
// useNote.js:164-175
if (entityType === 'project') {
    const result = await fetchNotesByProject(entityId, { limit, offset });
    notes = result?.notes || [];
    pagination = result?.pagination || null;
}
```

#### Pattern C: Service Layer Processing (useProspect)
```javascript
// useProspect.js:23-25
const data = await prospectApi.fetchProspects();
const processed = prospectService.processProspectData(data);
setProspects(prospectService.sortProspects(processed));
```

#### Pattern D: Response Format Detection (useTeam)
```javascript
// useTeam.js:64-92
if (result && result.response && Array.isArray(result.response.data)) {
    // FileMaker format
} else if (Array.isArray(result)) {
    // Array format
} else if (result && typeof result === 'object') {
    // Object format
}
```

**Impact:**
- Difficult to migrate from FileMaker to backend API
- Fragile code that breaks with API response changes
- Inconsistent data transformation logic

**Recommendation:**
- Standardize on service layer pattern (Pattern C)
- Remove environment detection from hooks (move to service layer)
- Implement consistent response normalization in API layer

---

### 6. Inconsistent Optimistic Updates

**Issue:** Only `useProspect` implements optimistic updates.

```javascript
// useProspect.js:43-67
const handleProspectCreate = useCallback(async (data) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticProspect = { id: tempId, /* ... */, _optimistic: true };

    // Optimistically add to list
    setProspects(prev => prospectService.sortProspects([optimisticProspect, ...prev]));

    try {
        const newProspect = await prospectApi.createProspect(validated);
        // Replace optimistic with real
        setProspects(prev => /* replace logic */);
    } catch (err) {
        // Rollback
        setProspects(prev => prev.filter(p => p.id !== tempId));
    }
}, []);
```

**Impact:**
- Inconsistent UX - some operations feel instant, others don't
- Missing opportunities for better perceived performance
- No pattern for other hooks to follow

**Recommendation:**
- Document when optimistic updates should be used
- Implement optimistic updates for create/update operations in:
  - `useCustomer.handleCustomerCreate`
  - `useProject.handleProjectCreate`
  - `useTask.handleTaskCreate`
- Create reusable optimistic update utility function

---

### 7. Inconsistent Callback Dependencies

**Issue:** useCallback dependency arrays are inconsistent and sometimes incorrect.

#### Problem A: Missing Dependencies (useCustomer)
```javascript
// useCustomer.js:52-54
const clearSearchTimeout = useCallback(() => {
    clearSearchTimeout();  // ⚠️ Calls itself recursively!
}, []);
```

#### Problem B: Stale Closures (useProject)
```javascript
// useProject.js:282
}, [loadProjects, user, showError]);  // Missing projectRecords dependency
```

#### Problem C: Overly Broad Dependencies (useTeam)
```javascript
// useTeam.js:343
}, [selectedTeam]);  // Could be more specific
```

**Impact:**
- Infinite loops (clearSearchTimeout bug)
- Stale closure bugs
- Unnecessary re-renders

**Recommendation:**
- Enable ESLint `exhaustive-deps` rule
- Fix clearSearchTimeout recursive call
- Review all useCallback dependencies for correctness

---

### 8. Inconsistent Return Value Structures

**Issue:** Hooks return different shapes and naming conventions.

#### Pattern A: Object with Actions/State Groups (useCustomer)
```javascript
return {
    // State
    loading, error, formattedError, customers, selectedCustomer, stats, pagination,
    // Search state
    searchResults, isSearching, searchQuery,
    // Active customers getter
    activeCustomers: customers.filter(customer => customer.isActive),
    // Actions
    loadCustomers, handleCustomerSelect, /* ... */,
    // Utility functions
    clearError, clearSelectedCustomer, setPagination
};
```

#### Pattern B: Flat Object (useNote)
```javascript
return {
    loading, error,
    handleNoteCreate, handleFetchNotes, handleNoteUpdate, handleNoteDelete,
    getPagination, updatePagination,
    clearError: () => setError(null)
};
```

#### Pattern C: Named Groups (useTask)
```javascript
return {
    // State
    loading, error, tasks, selectedTask, timer, /* ... */,
    // Task operations
    loadTasks, handleTaskSelect, /* ... */,
    // Timer operations
    handleTimerStart, handleTimerStop, /* ... */,
    // Utilities
    clearError, clearSelectedTask
};
```

**Impact:**
- Destructuring becomes inconsistent across components
- Difficult to find specific operations
- Auto-complete is less helpful

**Recommendation:**
- Standardize return value structure:
  ```javascript
  return {
      // State (always first)
      loading, error, data, selectedItem, stats,
      // Operations (grouped by feature)
      load*, handle*, get*,
      // Utilities (always last)
      clear*, reset*, format*
  };
  ```

---

## Priority Recommendations

### High Priority (Should Fix Soon)
1. **Fix `clearSearchTimeout` recursive bug in useCustomer.js:52**
2. **Standardize error handling pattern** - Use dual error state (Pattern B)
3. **Add pagination to hooks loading large datasets** (useProject, useTask, useTeam)
4. **Review and fix useCallback dependencies** - Enable exhaustive-deps rule

### Medium Priority (Technical Debt)
5. **Standardize loading state initialization** - Prefer `false` with explicit loading
6. **Document state management patterns in CLAUDE.md**
7. **Implement optimistic updates** for create/update operations
8. **Standardize return value structure** across all hooks

### Low Priority (Future Enhancement)
9. **Create reusable hook utilities** for common patterns (pagination, search, optimistic updates)
10. **Remove environment detection from hooks** - Move to service layer
11. **Implement consistent data transformation** pipeline

---

## Code Examples

### Recommended Error Handling Pattern
```javascript
// Standardized error handling across all hooks
const [error, setError] = useState(null);
const [formattedError, setFormattedError] = useState(null);
const { showError } = useSnackBar();

const setErrorWithFormatting = useCallback((err) => {
    const formatted = formatErrorForUI(err);
    setError(formatted.message);
    setFormattedError(formatted);
    showError(formatted.message);
    console.error('[HookName] Error:', { raw: err, formatted });
}, [showError]);

const clearErrorState = useCallback(() => {
    setError(null);
    setFormattedError(null);
}, []);
```

### Recommended Pagination Pattern
```javascript
// Standardized pagination state
const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
});

// Standardized pagination helper
const loadNextPage = useCallback(async () => {
    if (!pagination.hasMore) return;

    await loadItems({
        limit: pagination.limit,
        offset: pagination.offset + pagination.limit
    });
}, [pagination, loadItems]);
```

### Recommended Return Value Structure
```javascript
return {
    // State (alphabetical within each group)
    error,
    formattedError,
    loading,
    items,
    pagination,
    selectedItem,
    stats,

    // Operations (grouped by feature)
    loadItems,
    handleItemSelect,
    handleItemCreate,
    handleItemUpdate,
    handleItemDelete,

    // Utilities
    clearError,
    clearSelectedItem,
    resetPagination
};
```

---

## Testing Recommendations

1. **Add unit tests for hooks** using React Testing Library
2. **Test edge cases:**
   - Loading state transitions
   - Error state handling
   - Pagination boundary conditions
   - Optimistic update rollbacks
3. **Test concurrent operations:**
   - Multiple rapid create calls
   - Search debouncing
   - Timer state persistence

---

## Migration Strategy

If standardization is approved:

1. **Phase 1: Fix Critical Bugs (1 day)**
   - Fix clearSearchTimeout recursive call
   - Fix missing useCallback dependencies
   - Add pagination to high-volume hooks

2. **Phase 2: Standardize Core Patterns (2-3 days)**
   - Implement standard error handling
   - Standardize loading states
   - Standardize return value structures

3. **Phase 3: Enhance UX (2-3 days)**
   - Implement optimistic updates
   - Add search debouncing to all search operations
   - Standardize pagination UI

4. **Phase 4: Documentation (1 day)**
   - Update CLAUDE.md with patterns
   - Add inline JSDoc comments
   - Create hook usage examples

---

## Conclusion

The hooks in this codebase are functional but suffer from inconsistent patterns that increase maintenance burden and cognitive load. Standardizing these patterns would:

- Reduce bugs from copy-paste errors
- Improve developer onboarding
- Enable easier implementation of global features (error tracking, loading indicators)
- Provide better user experience through optimistic updates and consistent loading states

The recommended fixes are achievable within a 1-2 week sprint and would provide significant long-term value.

---

## Appendix: Pattern Comparison Matrix

| Hook | Error Pattern | Loading Init | Pagination | Optimistic Updates | Return Structure |
|------|---------------|--------------|------------|-------------------|------------------|
| useCustomer | Dual (A+B) | true | Single Object | ❌ | Grouped with comments |
| useNote | Basic String | false | Per-Entity Map | ❌ | Flat |
| useProject | Basic String | true | ❌ | ❌ | Grouped with comments |
| useTask | Basic String | true | ❌ | ❌ | Grouped with comments |
| useTeam | Basic String | true | ❌ | ❌ | Grouped (explicit object) |
| useProspect | Basic String | false | ❌ | ✅ | Flat |
| useProducts | Result Object | false | ❌ | ❌ | Flat |

---

**End of Review**
