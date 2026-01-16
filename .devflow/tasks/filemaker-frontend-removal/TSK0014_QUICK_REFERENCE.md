# TSK0014: Remove FileMaker Auth from SignIn - QUICK REFERENCE

## What Changed

### SignIn Component API

**Before:**
```jsx
<SignIn
  onFileMakerDetected={handleFileMakerDetected}
  onSupabaseAuth={handleSupabaseAuth}
  onDetectionComplete={handleDetectionComplete}
/>
```

**After:**
```jsx
<SignIn
  onSupabaseAuth={handleSupabaseAuth}
/>
```

### Authentication Flow

**Before (Dual Auth):**
```
1. Component mounts
2. detectFileMaker() runs
3. Polls for window.FileMaker (3 seconds)
4a. IF FileMaker found → onFileMakerDetected()
4b. IF not found → onDetectionComplete()
5. Show Supabase form if not FileMaker
```

**After (Supabase Only):**
```
1. Component mounts
2. Show Supabase form immediately
3. User signs in
4. onSupabaseAuth() called
```

## Code Examples

### Using the Updated SignIn Component

```jsx
import SignIn from './components/auth/SignIn';

function App() {
  const handleSupabaseAuth = useCallback((authState) => {
    console.log('Supabase authentication successful', authState);

    // Set environment context - always web app now
    setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
    setEnvironmentContext({
      type: ENVIRONMENT_TYPES.WEBAPP,
      authentication: authState
    });

    setAuthentication(authState);
  }, []);

  if (!isAuthenticated) {
    return <SignIn onSupabaseAuth={handleSupabaseAuth} />;
  }

  return <AppContent />;
}
```

### Authentication State Structure

```javascript
// authState passed to onSupabaseAuth
{
  isAuthenticated: true,
  method: 'supabase',
  user: {
    id: 'uuid',
    email: 'user@example.com',
    // ... other Supabase user fields
  }
}
```

## Removed Functions

### From SignIn.jsx
- ❌ `detectFileMaker()` - FileMaker environment detection
- ❌ FileMaker detection useEffect
- ❌ `onFileMakerDetected` prop
- ❌ `onDetectionComplete` prop

### From index.jsx
- ❌ `handleFileMakerDetected()` callback
- ❌ `handleDetectionComplete()` callback
- ❌ FileMaker environment context setup
- ❌ FileMaker authentication state init

## Migration Checklist

If you have custom code using SignIn:

- [ ] Remove `onFileMakerDetected` prop
- [ ] Remove `onDetectionComplete` prop
- [ ] Keep `onSupabaseAuth` prop (required)
- [ ] Update handler to always set WEBAPP environment
- [ ] Remove FileMaker detection logic from parent
- [ ] Test authentication flow

## Common Issues & Solutions

### Issue: "Missing required prop 'onFileMakerDetected'"
**Solution:** Remove this prop - it no longer exists

### Issue: "Component not detecting FileMaker"
**Solution:** FileMaker detection removed - use Supabase auth only

### Issue: "Environment stuck in FileMaker mode"
**Solution:** TSK0013 added deprecation handler in initializationService

## Testing

### Unit Test Example
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import SignIn from './SignIn';

test('renders Supabase login form', () => {
  const mockOnSupabaseAuth = jest.fn();

  render(<SignIn onSupabaseAuth={mockOnSupabaseAuth} />);

  expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
});
```

### Integration Test
```bash
# 1. Start dev server
npm run dev

# 2. Navigate to app
# 3. Verify login form appears immediately
# 4. Enter credentials and sign in
# 5. Verify authentication succeeds
# 6. Check console for "Supabase authentication successful"
```

## Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Detection Time | 0-3000ms | 0ms | 100% faster |
| Component LOC | 193 | 138 | -28% |
| Props Required | 3 | 1 | -67% |
| Code Paths | 2 (FM + Supabase) | 1 (Supabase) | 50% simpler |

## Related Documentation

- `TSK0014_COMPLETION_SUMMARY.md` - Full task details
- `TSK0013_COMPLETION_SUMMARY.md` - initializationService changes
- `docs/FEATURE_FLAGS.md` - Feature flag system (not used for auth yet)

## Next Steps

After TSK0014 completion:
1. **TSK0015:** Simplify dataService to single routing path
2. **TSK0016:** Remove useFileMakerBridge hook
3. **TSK0021:** Update CLAUDE.md to remove FileMaker references

---

**Last Updated:** 2026-01-16
**Status:** ✅ Complete
