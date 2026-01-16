# TSK0006: Tasks API Backend Integration - Quick Reference

## Summary
Migrated `src/api/tasks.js` from hardcoded backend flag to environment-aware routing using dataService.

## Key Changes

### 1. Imports
```javascript
// OLD
import axios from 'axios';
import { backendConfig } from '../config';
const USE_BACKEND_API = true;

// NEW
import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
```

### 2. Task API Endpoints

| Function | Backend Endpoint | FileMaker Fallback |
|----------|-----------------|-------------------|
| `fetchTasksForProject(id)` | `GET /api/tasks?project_id={id}` | devTasks query |
| `createTask(data)` | `POST /api/tasks` | devTasks CREATE |
| `updateTask(id, data)` | `PATCH /api/tasks/{id}` | devTasks UPDATE |
| `updateTaskStatus(id, completed)` | `POST /api/tasks/{id}/toggle-completion` | devTasks UPDATE |
| `deleteTask(id)` | `DELETE /api/tasks/{id}` | devTasks DELETE |

### 3. Timer API Endpoints

| Function | Backend Endpoint | FileMaker Fallback |
|----------|-----------------|-------------------|
| `startTaskTimer(id, task)` | `POST /time-entries/start` | devRecords CREATE |
| `stopTaskTimer(id, desc, save, adj)` | `POST /time-entries/{id}/stop` | devRecords UPDATE |
| `pauseTimer(id)` | `POST /time-entries/{id}/pause` | ❌ Not supported |
| `resumeTimer(id)` | `POST /time-entries/{id}/resume` | ❌ Not supported |
| `getActiveTimer(staffId)` | `GET /time-entries/active` | devRecords query |
| `fetchTaskTimers(id, filters)` | `GET /time-entries?task_id={id}` | devRecords query |

## Environment Routing Pattern

```javascript
export async function exampleFunction(params) {
    validateParams({ params }, ['params']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            // FileMaker implementation
        });
    } else {
        try {
            const response = await dataService.method('/api/endpoint', data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Operation name');
        }
    }
}
```

## Feature Flag

- Flag: `use_backend_tasks` (default: `false`)
- Location: `src/context/FeatureFlagContext.jsx`
- Control: Service/hook layer (not API layer)

## Verification

✅ Build: `npm run build` - Successful
✅ All functions updated to environment-aware pattern
✅ FileMaker backward compatibility maintained
✅ Error handling consistent

## Status

- **Completed:** 2026-01-15
- **Build:** ✅ Passing
- **Ready For:** Backend API deployment & testing
