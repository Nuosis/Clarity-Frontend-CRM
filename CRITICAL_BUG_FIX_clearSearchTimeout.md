# Critical Bug Fix: Recursive clearSearchTimeout

**File:** `src/hooks/useCustomer.js`
**Line:** 52-54
**Severity:** HIGH (Infinite Loop / Stack Overflow)
**Status:** ❌ Not Fixed

---

## The Bug

```javascript
// CURRENT CODE (BUGGY) - Line 52-54
const clearSearchTimeout = useCallback(() => {
    clearSearchTimeout();  // ⚠️ Calls itself recursively!
}, []);
```

**Problem:** The function calls itself instead of clearing the timeout reference.

**Impact:**
- If called, causes infinite recursion
- Results in stack overflow error
- Crashes the app when search timeout needs to be cleared

---

## The Fix

### Option 1: Clear the Ref Directly (Recommended)
```javascript
const clearSearchTimeout = useCallback(() => {
    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
    }
}, []);
```

### Option 2: Remove the Function Entirely
```javascript
// Just use clearTimeout directly where needed
if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = null;
}
```

---

## Where It's Used

The function is called in multiple places in `useCustomer.js`:

### 1. Line 386 - In handleCustomerSearch
```javascript
clearSearchTimeout();  // ⚠️ Would cause infinite loop
```

### 2. Line 457 - In clearSearch
```javascript
clearSearchTimeout();  // ⚠️ Would cause infinite loop
```

### 3. Line 468 - In cleanup useEffect
```javascript
clearSearchTimeout();  // ⚠️ Would cause infinite loop
```

---

## Full Corrected Code

```javascript
import { useState, useCallback, useEffect, useRef } from 'react';
// ... other imports

export function useCustomer() {
    // ... other state
    const searchTimeoutRef = useRef(null);

    // FIXED: Clear timeout correctly
    const clearSearchTimeout = useCallback(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
        }
    }, []);

    // ... rest of hook
}
```

---

## Testing the Fix

### Before Fix (Reproducing the Bug)
```javascript
// This would crash with stack overflow
const { clearSearch } = useCustomer();
clearSearch(); // Calls clearSearchTimeout() → infinite loop
```

### After Fix (Verification)
```javascript
// This should work correctly
const { clearSearch } = useCustomer();
clearSearch(); // Clears timeout successfully
```

---

## Why This Bug Exists

This is likely a **copy-paste error** or **naming confusion**:

1. Intended to call the native `clearTimeout()` function
2. Instead calls the wrapper function `clearSearchTimeout()`
3. No parameters passed, so function just calls itself
4. No base case, so infinite recursion occurs

---

## Related Issues to Check

While fixing this, also check for similar patterns:

```bash
# Search for other potential recursive calls
grep -rn "const clear.*= useCallback.*clear.*\(\)" src/hooks/
```

---

## Apply the Fix

### Manual Fix
1. Open `src/hooks/useCustomer.js`
2. Go to line 52-54
3. Replace with Option 1 code above
4. Save and test

### Automated Fix (if using sed)
```bash
# Backup first
cp src/hooks/useCustomer.js src/hooks/useCustomer.js.backup

# Apply fix (may need manual verification)
# This is complex enough to require manual editing
```

---

## Impact Assessment

### Current State
- ⚠️ Bug exists but **may not be triggered** if users don't use search
- Search functionality works until timeout needs clearing
- If triggered, app crashes immediately

### After Fix
- ✅ Search debouncing works correctly
- ✅ No stack overflow risk
- ✅ Proper cleanup on unmount

---

## Recommendation

**PRIORITY: HIGH** - Fix this bug as soon as possible

While the bug may not be triggered frequently (depends on search usage patterns), it's a critical defect that:
1. Will crash the app if triggered
2. Affects customer search functionality
3. Is trivial to fix (2-minute change)
4. Has zero risk of introducing new bugs

---

**Would you like me to apply this fix now?**
