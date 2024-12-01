import { configureStore } from '@reduxjs/toolkit';
import projectReducer from './projectSlice';
import billablesReducer from './billablesSlice';
import taskReducer from './taskSlice';
import staffReducer from './staffSlice';
import teamsReducer from './teamsSlice';

export const store = configureStore({
  reducer: {
    project: projectReducer,
    billables: billablesReducer,
    task: taskReducer,
    staff: staffReducer,
    teams: teamsReducer
  }
});

// Optional: Export type for TypeScript support if needed later
// export type RootState = ReturnType<typeof store.getState>
// export type AppDispatch = typeof store.dispatch
