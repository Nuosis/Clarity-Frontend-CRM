# Hook State Management Patterns - Quick Reference

**Generated:** 2026-01-24
**Purpose:** Quick comparison table for developers working with custom hooks

---

## Pattern Comparison Matrix

| Hook | LOC | Error Handling | Loading Init | Pagination | Optimistic | Search | Return Style |
|------|-----|----------------|--------------|------------|------------|--------|--------------|
| **useCustomer** | 505 | Dual State ✅ | `true` | Single ✅ | ❌ | Debounced ✅ | Grouped |
| **useNote** | 302 | Basic | `false` | Per-Entity ✅ | ❌ | ❌ | Flat |
| **useProject** | 876 | Basic | `true` | ❌ | ❌ | ❌ | Grouped |
| **useTask** | 529 | Basic | `true` | ❌ | ❌ | ❌ | Grouped |
| **useTeam** | 595 | Basic | `true` | ❌ | ❌ | ❌ | Grouped |
| **useProspect** | 237 | Basic | `false` | ❌ | ✅ | ❌ | Flat |
| **useProducts** | 246 | Result Object | `false` | ❌ | ❌ | ❌ | Flat |

**Legend:**
- ✅ Implemented
- ❌ Not implemented
- LOC = Lines of Code

---

## Error Handling Patterns

### Pattern A: Basic String (5 hooks)
```javascript
const [error, setError] = useState(null);
setError(err.message);
```
**Used by:** useNote, useTask, useTeam, useProspect, useProject

### Pattern B: Dual State (1 hook) ⭐ **Recommended**
```javascript
const [error, setError] = useState(null);
const [formattedError, setFormattedError] = useState(null);

const setErrorWithFormatting = useCallback((err) => {
    const formatted = formatErrorForUI(err);
    setError(formatted.message);
    setFormattedError(formatted);
}, []);
```
**Used by:** useCustomer

### Pattern C: Result Object (1 hook)
```javascript
return { success: false, error: err.message };
```
**Used by:** useProducts

---

## Loading State Patterns

### Pattern A: Initial False (3 hooks)
```javascript
const [loading, setLoading] = useState(false);
```
**Used by:** useNote, useProspect, useProducts

### Pattern B: Initial True (4 hooks)
```javascript
const [loading, setLoading] = useState(true);
```
**Used by:** useCustomer, useTask, useTeam, useProject

**Note:** Initial `true` causes immediate loading UI on mount

---

## Pagination Patterns

### Pattern A: Single Object (1 hook)
```javascript
const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
});
```
**Used by:** useCustomer

### Pattern B: Per-Entity Map (1 hook)
```javascript
const [paginationByEntity, setPaginationByEntity] = useState({});
const key = `${entityType}-${entityId}`;
return paginationByEntity[key] || { limit: 50, offset: 0, hasMore: false };
```
**Used by:** useNote

### Pattern C: No Pagination (5 hooks) ⚠️ **Performance Risk**
**Used by:** useProject, useTask, useTeam, useProspect, useProducts

---

## Return Value Structures

### Pattern A: Grouped with Comments (4 hooks) ⭐ **Most Common**
```javascript
return {
    // State
    loading, error, items, selectedItem,
    // Actions
    loadItems, handleItemCreate,
    // Utilities
    clearError
};
```
**Used by:** useCustomer, useProject, useTask, useTeam

### Pattern B: Flat (3 hooks)
```javascript
return {
    loading, error,
    handleCreate, handleUpdate,
    clearError
};
```
**Used by:** useNote, useProspect, useProducts

---

## Feature Support Matrix

| Feature | useCustomer | useNote | useProject | useTask | useTeam | useProspect | useProducts |
|---------|-------------|---------|------------|---------|---------|-------------|-------------|
| **CRUD Operations** |
| Create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Features** |
| Pagination | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Search | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Debouncing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Optimistic Updates | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Stats Calculation | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| LocalStorage | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **State Management** |
| Selected Item | ✅ | ❌ | ✅ | ✅ | ✅ | Global | ✅ |
| Error Formatting | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Loading Indicator | Local | Local | Local | Local | Local | Local | Local+App |

---

## Recommended Patterns (Standardization)

### 1. Error Handling ⭐
```javascript
const [error, setError] = useState(null);
const [formattedError, setFormattedError] = useState(null);
const { showError } = useSnackBar();

const setErrorWithFormatting = useCallback((err) => {
    const formatted = formatErrorForUI(err);
    setError(formatted.message);
    setFormattedError(formatted);
    showError(formatted.message);
    console.error('[HookName]:', { raw: err, formatted });
}, [showError]);

const clearErrorState = useCallback(() => {
    setError(null);
    setFormattedError(null);
}, []);
```

### 2. Loading State ⭐
```javascript
// Initialize to false, load explicitly
const [loading, setLoading] = useState(false);

// Load data on mount or when dependencies change
useEffect(() => {
    if (shouldLoad) {
        loadData();
    }
}, [shouldLoad]);
```

### 3. Pagination ⭐
```javascript
const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false  // Use camelCase consistently
});

const loadNextPage = useCallback(async () => {
    if (!pagination.hasMore) return;
    await loadItems({
        limit: pagination.limit,
        offset: pagination.offset + pagination.limit
    });
}, [pagination]);
```

### 4. Return Value ⭐
```javascript
return {
    // State (alphabetical within group)
    error,
    formattedError,
    loading,
    items,
    pagination,
    selectedItem,
    stats,

    // Operations (grouped by CRUD)
    loadItems,
    handleItemSelect,
    handleItemCreate,
    handleItemUpdate,
    handleItemDelete,

    // Utilities (always last)
    clearError,
    clearSelectedItem,
    resetPagination
};
```

---

## Known Issues

### Critical
1. **useCustomer.js:52** - `clearSearchTimeout` calls itself recursively (infinite loop)

### High Priority
2. **useProject, useTask, useTeam** - No pagination (performance risk for large datasets)
3. **Multiple hooks** - Missing exhaustive-deps in useCallback

### Medium Priority
4. **All hooks except useCustomer** - No error formatting
5. **All hooks except useProspect** - No optimistic updates
6. **Most hooks** - Inconsistent naming conventions (snake_case vs camelCase)

---

## Migration Checklist

When creating a new custom hook, follow this checklist:

- [ ] Use dual error state pattern (error + formattedError)
- [ ] Initialize loading to `false`
- [ ] Implement pagination if hook manages lists
- [ ] Add optimistic updates for create/update operations
- [ ] Use grouped return value structure with comments
- [ ] Enable ESLint exhaustive-deps rule
- [ ] Add JSDoc comments for all operations
- [ ] Include error logging with hook name
- [ ] Implement clear/reset utility functions
- [ ] Add stats calculation if applicable

---

**For Full Details:** See `REVIEW_HOOK_STATE_MANAGEMENT_PATTERNS.md`
