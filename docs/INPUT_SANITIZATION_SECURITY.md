# Input Sanitization and Length Validation Security Implementation

## Overview

This document describes the comprehensive input sanitization and length validation implementation added to the Clarity CRM Frontend to address security vulnerabilities related to unvalidated user-generated text content.

## Security Issues Addressed

1. **No input sanitization** - User text could contain malicious scripts (XSS attacks)
2. **No length limits** - Users could input arbitrary amounts of text, potentially causing DoS or database issues
3. **Inconsistent validation** - Different forms had different validation approaches
4. **Missing character encoding handling** - Control characters and null bytes not filtered

## Implementation

### Core Utility: `src/utils/inputSanitization.js`

A centralized utility module providing:

#### 1. Field Length Constraints

Database-backed length limits matching backend schema:

```javascript
export const FIELD_LIMITS = {
  // Customers
  CUSTOMER_BUSINESS_NAME: 255,
  CUSTOMER_EMAIL: 320,
  CUSTOMER_PHONE: 50,
  CUSTOMER_ADDRESS_LINE: 500,

  // Projects
  PROJECT_NAME: 255,
  PROJECT_DESCRIPTION: 10000,

  // Tasks
  TASK_TITLE: 500,
  TASK_NOTES: 10000,

  // Notes
  NOTE_CONTENT: 50000,

  // Generic limits
  GENERIC_SHORT_TEXT: 255,
  GENERIC_MEDIUM_TEXT: 1000,
  GENERIC_LONG_TEXT: 10000
};
```

#### 2. Text Sanitization Functions

**`sanitizeText(input, options)`**
- Removes null bytes (`\0`)
- Filters control characters (except newlines/tabs)
- Escapes HTML to prevent XSS (configurable)
- Normalizes whitespace (configurable)
- Trims leading/trailing whitespace (configurable)

**`escapeHTML(text)`**
- Escapes: `&`, `<`, `>`, `"`, `'`, `/`
- Prevents script injection and HTML tag injection

**`removeXSSPatterns(text)`**
- Removes `<script>` tags
- Removes JavaScript event handlers (`onclick=`, etc.)
- Removes `javascript:` protocol
- Removes dangerous tags (`<iframe>`, `<object>`, etc.)

#### 3. Validation Functions

**`validateLength(text, maxLength, fieldName)`**
- Returns `{ isValid, error }` with descriptive error messages

**`validateEmail(email)`**
- RFC 5322 simplified format validation
- Length check (max 320 characters per RFC 5321)

**`validatePhone(phone)`**
- International format support
- Allows: digits, spaces, `+`, `-`, `()`, `.`

**`validateURL(url)`**
- Uses browser's URL constructor for validation
- Max 2048 characters

**`sanitizeAndValidate(input, options)`**
- Combined sanitization + validation
- Returns `{ value, isValid, error }`
- Options: `maxLength`, `minLength`, `required`, `allowHTML`, `fieldName`

#### 4. Specialized Sanitizers

Pre-configured sanitizers for common fields:
- `sanitizeBusinessName(name, required)`
- `sanitizeProjectName(name, required)`
- `sanitizeTaskTitle(title, required)`
- `sanitizeNoteContent(content, required)`

#### 5. Batch Operations

**`batchSanitize(data, fieldConfig)`**
- Sanitizes multiple fields at once
- Returns `{ sanitizedData, errors, isValid }`
- Supports custom validators per field

### Updated Components

#### 1. `TextInput.jsx` (Global)

**Changes:**
- Added `maxLength` prop with default `FIELD_LIMITS.GENERIC_LONG_TEXT`
- Added character counter with visual warning at 90% capacity
- Added input sanitization before submission
- Added error state display
- Added `showCharCount` prop for toggling character counter

**Features:**
- Real-time character count
- Visual feedback when near limit
- HTML input `maxLength` enforcement
- Sanitization on submit

#### 2. `CustomerForm.jsx`

**Changes:**
- Imported `sanitizeText`, `validateEmail`, `validatePhone`, `FIELD_LIMITS`
- Added `maxLength` attributes to all text inputs
- Enhanced validation with length checks for all fields:
  - Business name (255 chars)
  - Contact name (255 chars)
  - Emails (320 chars each)
  - Phones (50 chars each)
  - Address lines (500 chars)
  - City (100 chars)
  - State (100 chars)
  - Postal code (20 chars)
  - Country (100 chars)
- Used utility validators for email and phone
- Added error display for all address subfields

**Validation Flow:**
```javascript
// Example: Business name validation
const sanitizedBusinessName = sanitizeText(formData.business_name);
if (!sanitizedBusinessName.trim()) {
  newErrors.business_name = 'Business name is required';
} else if (sanitizedBusinessName.length > FIELD_LIMITS.CUSTOMER_BUSINESS_NAME) {
  newErrors.business_name = `Business name must be ${FIELD_LIMITS.CUSTOMER_BUSINESS_NAME} characters or less`;
}
```

#### 3. `TaskForm.jsx`

**Changes:**
- Imported `sanitizeText`, `FIELD_LIMITS`
- Added `maxLength` to task title (500 chars)
- Added `maxLength` to task type (100 chars)
- Added `maxLength` to notes (10,000 chars)
- Added character counter for notes field

**UI Enhancement:**
```jsx
<textarea maxLength={FIELD_LIMITS.TASK_NOTES} />
<div className="text-xs mt-1">
  {formData.notes.length} / {FIELD_LIMITS.TASK_NOTES} characters
</div>
```

#### 4. `taskService.js`

**Changes:**
- Imported sanitization utilities
- Ready for integration with `validateTaskData()` function

### Validation Strategy

**Multi-layer validation:**

1. **Browser-level** (HTML5)
   - `maxLength` attribute on inputs
   - `type="email"` for email validation
   - `type="tel"` for phone inputs

2. **Client-side** (JavaScript)
   - Real-time character counting
   - Pre-submit sanitization
   - Format validation (email, phone, URL)
   - XSS pattern detection

3. **Backend-level** (API)
   - Database constraints enforce length limits
   - Backend validation rejects malformed data
   - RLS policies enforce authorization

### XSS Prevention

**Multiple layers of protection:**

1. **HTML Escaping** (default for all text)
   ```javascript
   sanitizeText(input, { allowHTML: false }) // Default
   ```

2. **Pattern Removal**
   - Script tags removed
   - Event handlers stripped
   - Dangerous protocols blocked

3. **Content Security Policy** (CSP)
   - Recommended: Add CSP headers in production
   - Prevents inline script execution

### Character Encoding Safety

**Control character handling:**
- Null bytes (`\0`) removed - prevents string termination attacks
- Control characters filtered (except `\n`, `\t`)
- Excessive newlines normalized (max 2 consecutive)
- Multiple spaces collapsed to single space

### Length Limits Rationale

**Database alignment:**
- All limits match backend PostgreSQL schema
- `varchar(N)` fields have exact character limits
- `text` fields have reasonable limits (10K-50K chars) to prevent abuse

**User experience:**
- Character counters provide feedback
- Visual warnings at 90% capacity
- Clear error messages on validation failure

## Testing Recommendations

### Unit Tests

Test each sanitization function:
```javascript
// Example test cases
expect(sanitizeText("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;");
expect(validateEmail("invalid")).toEqual({ isValid: false, error: "Invalid email format" });
expect(validateLength("x".repeat(300), 255, "Name")).toHaveProperty("isValid", false);
```

### Integration Tests

Test form validation:
```javascript
// CustomerForm tests
- Test business name required
- Test business name max 255 chars
- Test email format validation
- Test phone format validation
- Test address field length limits
```

### Security Tests

Test XSS prevention:
```javascript
const xssPayloads = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "<iframe src='evil.com'></iframe>"
];

xssPayloads.forEach(payload => {
  expect(containsXSSPatterns(payload)).toBe(true);
  expect(removeXSSPatterns(payload)).not.toContain("<script");
});
```

## Migration Guide

### For New Forms

1. Import utilities:
   ```javascript
   import { sanitizeText, FIELD_LIMITS, validateEmail } from '../../utils/inputSanitization';
   ```

2. Add `maxLength` to inputs:
   ```jsx
   <input maxLength={FIELD_LIMITS.CUSTOMER_BUSINESS_NAME} />
   ```

3. Add validation in form submit:
   ```javascript
   const result = sanitizeAndValidate(formData.name, {
     maxLength: FIELD_LIMITS.CUSTOMER_BUSINESS_NAME,
     required: true,
     fieldName: 'Business name'
   });

   if (!result.isValid) {
     setErrors({ name: result.error });
     return;
   }
   ```

### For Existing Forms

1. Audit current validation
2. Add `maxLength` attributes
3. Replace custom validators with utilities
4. Add character counters for long text fields
5. Test thoroughly

## Performance Considerations

**Efficient validation:**
- Sanitization runs only on form submission (not on every keystroke)
- Character counting is simple string length check
- Regex patterns are pre-compiled and optimized

**Bundle size:**
- Utility module is ~8KB (unminified)
- Tree-shakeable exports
- No external dependencies

## Best Practices

### Do's
✅ Use `FIELD_LIMITS` constants for all length validation
✅ Sanitize all user input before API calls
✅ Display character counters for long text fields
✅ Provide clear validation error messages
✅ Use `sanitizeAndValidate()` for combined operations

### Don'ts
❌ Don't trust client-side validation alone (backend must validate)
❌ Don't allow HTML unless absolutely necessary (`allowHTML: true`)
❌ Don't hard-code length limits (use constants)
❌ Don't skip sanitization for "trusted" users
❌ Don't concatenate unsanitized user input into HTML

## Future Enhancements

1. **Rate limiting** - Prevent spam/abuse via API rate limits
2. **Content moderation** - Detect profanity or inappropriate content
3. **Rich text support** - Safe HTML sanitization for WYSIWYG editors
4. **Internationalization** - Unicode normalization for non-Latin characters
5. **Audit logging** - Track validation failures for security monitoring

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [RFC 5321 - SMTP](https://tools.ietf.org/html/rfc5321) (Email length limits)
- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322) (Email format)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Files Changed

### New Files
- `src/utils/inputSanitization.js` - Core sanitization utilities
- `docs/INPUT_SANITIZATION_SECURITY.md` - This documentation

### Modified Files
- `src/components/global/TextInput.jsx` - Added maxLength, char counter, sanitization
- `src/components/customers/CustomerForm.jsx` - Added length limits and validation
- `src/components/customers/ProspectForm.jsx` - Added length limits and validation
- `src/components/tasks/TaskForm.jsx` - Added length limits and char counter
- `src/components/products/ProductForm.jsx` - Added length limits and validation
- `src/components/teams/TeamForm.jsx` - Added length limits and validation
- `src/components/customers/ProjectCreationForm.jsx` - Added length limits and validation
- `src/components/proposals/ProposalCreationForm.jsx` - Added length limits and validation
- `src/components/proposals/ProposalCreationFormEnhanced.jsx` - Added length limits and validation
- `src/services/taskService.js` - Imported sanitization utilities

## Status

✅ **Completed:**
- Core sanitization utility implemented
- Database field limits defined
- TextInput component updated
- CustomerForm fully validated
- ProspectForm fully validated
- TaskForm length limits added
- ProductForm fully validated
- TeamForm fully validated
- ProjectCreationForm fully validated
- ProposalCreationForm fully validated
- ProposalCreationFormEnhanced fully validated
- Documentation complete

⏳ **Pending:**
- Add unit tests for sanitization functions
- Add integration tests for form validation
- Add E2E tests for XSS prevention
- Performance benchmarking

## Contact

For questions or security concerns, contact the development team.
