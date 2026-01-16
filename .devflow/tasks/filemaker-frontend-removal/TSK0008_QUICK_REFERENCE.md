# Links API Quick Reference - Backend Integration

**Status:** ✅ Backend-Only (FileMaker removed)
**Feature Flag:** `use_backend_links: true` (enabled by default)
**Last Updated:** 2026-01-15

---

## API Client (`src/api/links.js`)

### Create Link
```javascript
import { createLink } from '../api/links';

const newLink = await createLink({
    link: 'https://github.com/owner/repo',
    project_id: 'uuid',  // OR customer_id, task_id, organization_id
});
```

### Fetch Links
```javascript
import { fetchLinks } from '../api/links';

// All links for a project
const links = await fetchLinks({ project_id: 'uuid' });

// All links for a task
const links = await fetchLinks({ task_id: 'uuid' });

// With pagination
const links = await fetchLinks({
    project_id: 'uuid',
    limit: 50,
    offset: 0
});
```

### Update Link
```javascript
import { updateLink } from '../api/links';

const updated = await updateLink('link-id', {
    link: 'https://new-url.com'
});
```

### Delete Link
```javascript
import { deleteLink } from '../api/links';

await deleteLink('link-id');
```

---

## Service Layer (`src/services/linkService.js`)

### Create New Link
```javascript
import { createNewLink } from '../services/linkService';

// New signature (params object)
const link = await createNewLink({
    link: 'https://github.com/owner/repo',
    project_id: 'uuid'
});

// Legacy signature (backward compatible)
const link = await createNewLink('project-id', 'https://url.com', 'project');
```

### Fetch Links by Project
```javascript
import { fetchLinksByProject } from '../services/linkService';

const links = await fetchLinksByProject('project-id');
```

### Fetch Links by Entity
```javascript
import { fetchLinksByEntity } from '../services/linkService';

// Project links
const links = await fetchLinksByEntity('project', 'project-id');

// Task links
const links = await fetchLinksByEntity('task', 'task-id');

// Customer links
const links = await fetchLinksByEntity('customer', 'customer-id');

// With pagination
const links = await fetchLinksByEntity('project', 'project-id', {
    limit: 50,
    offset: 0
});
```

### Update Link
```javascript
import { updateExistingLink } from '../services/linkService';

const updated = await updateExistingLink('link-id', {
    link: 'https://new-url.com'
});
```

### Delete Link
```javascript
import { deleteLinkById } from '../services/linkService';

await deleteLinkById('link-id');
```

---

## Hook Layer (`src/hooks/useLink.js`)

### Usage
```javascript
import { useLink } from '../hooks';

function MyComponent() {
    const {
        loading,
        error,
        handleLinkCreate,
        handleFetchLinks,
        handleLinkUpdate,
        handleLinkDelete,
        clearError
    } = useLink();

    // Create link
    const newLink = await handleLinkCreate('project-id', 'https://url.com');
    // Or for task: await handleLinkCreate('task-id', 'https://url.com', 'task');

    // Fetch links
    const links = await handleFetchLinks('project-id');

    // Update link
    const updated = await handleLinkUpdate('link-id', {
        url: 'https://new-url.com'
    });

    // Delete link
    const success = await handleLinkDelete('link-id');
}
```

### GitHub URL Detection
```javascript
// GitHub URLs are automatically detected and augmented with metadata
const link = await handleLinkCreate('project-id', 'https://github.com/owner/repo');

// Result includes:
{
    id: 'uuid',
    url: 'https://github.com/owner/repo',
    title: 'github.com',
    createdAt: '2026-01-15T...',
    metadata: {
        github: {
            owner: 'owner',
            repo: 'repo',
            normalizedUrl: 'https://github.com/owner/repo'
        }
    }
}
```

---

## Data Model

### Backend Format (snake_case)
```json
{
    "id": "uuid",
    "link": "https://example.com",
    "project_id": "uuid",
    "customer_id": null,
    "task_id": null,
    "organization_id": "uuid",
    "created_at": "2026-01-15T12:00:00Z",
    "updated_at": "2026-01-15T12:00:00Z"
}
```

### Frontend Format (camelCase)
```json
{
    "id": "uuid",
    "url": "https://example.com",
    "title": "example.com",
    "projectId": "uuid",
    "customerId": null,
    "taskId": null,
    "organizationId": "uuid",
    "createdAt": "2026-01-15T12:00:00Z",
    "updatedAt": "2026-01-15T12:00:00Z"
}
```

---

## Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/links` | List links (filterable) |
| POST | `/links` | Create link |
| GET | `/links/{link_id}` | Get link details |
| PATCH | `/links/{link_id}` | Update link |
| DELETE | `/links/{link_id}` | Delete link |

---

## Query Parameters

### GET /links
- `project_id` - Filter by project
- `customer_id` - Filter by customer
- `task_id` - Filter by task
- `organization_id` - Filter by organization
- `limit` - Max records (pagination)
- `offset` - Pagination offset

---

## Constraints

### Parent Foreign Keys
Exactly **ONE** of the following must be provided:
- `project_id`
- `customer_id`
- `task_id`
- `organization_id`

Enforced by database check constraint.

### URL Field
- Backend uses `link` field
- Frontend uses `url` field
- Transformation handled automatically by `transformBackendLink()`

---

## Authentication

All requests require HMAC authentication:
- Handled automatically by `dataService`
- Organization context from JWT
- No manual auth headers needed

---

## Error Handling

### Common Errors
- `"Data is required"` - Missing data parameter
- `"Link URL is required"` - Missing link/url field
- `"Link ID is required"` - Missing linkId parameter
- `"Organization context required"` - Missing org in JWT
- `"Failed to create link: No ID returned"` - Backend API error

### Error Handling Pattern
```javascript
try {
    const link = await handleLinkCreate('project-id', 'https://url.com');
    if (!link) {
        // Error already shown via SnackBar
        return;
    }
    // Success
} catch (err) {
    console.error('Unexpected error:', err);
}
```

---

## Migration Notes

### What Changed
- ✅ FileMaker code removed
- ✅ Backend-only routing
- ✅ Feature flag enabled
- ✅ Environment checks removed

### What Stayed the Same
- ✅ Public API unchanged
- ✅ Hook signatures unchanged
- ✅ Component integration unchanged
- ✅ GitHub metadata detection unchanged

### Removed Functions
- ❌ `processLinks()` - FileMaker response processor

### Removed Imports
- ❌ `getEnvironmentContext()`
- ❌ `ENVIRONMENT_TYPES`

---

## Components Using Links

1. `ProjectLinksTab.jsx` - Full-featured link management UI
2. `TaskList.jsx` / `TaskItem.jsx` - Compact link display
3. `ProjectDetails.jsx` - Link tab integration
4. `ProjectDocumentsTab.jsx` - Document link handling

All components continue to work without modification.

---

## Testing

### Unit Tests
- `src/services/__tests__/linkService.test.js`
- `src/api/__tests__/links.test.js`
- `src/hooks/__tests__/useLink.test.js`

### Manual Testing Checklist
- [ ] Create link for project
- [ ] Create link for task
- [ ] Create link for customer
- [ ] Fetch links for project
- [ ] Update link URL
- [ ] Delete link
- [ ] GitHub URL detection works
- [ ] Error messages display correctly

---

## Related Documentation

- Backend API: `BACKEND_INTEGRATION_VERIFICATION.md`
- Feature Flags: `docs/FEATURE_FLAGS.md`
- Task Completion: `TSK0008_COMPLETION_SUMMARY.md`

---

**Last Updated:** 2026-01-15
**Migration Status:** ✅ Complete
