import { configureStore } from '@reduxjs/toolkit'
import proposalReducer from './slices/proposalSlice'
import proposalViewerReducer from './slices/proposalViewerSlice'
import documentationReducer from './slices/documentationSlice'

/**
 * Redux store configuration using Redux Toolkit
 * Following DEVELOPMENT_GUIDELINES.md patterns for state management
 */
export const store = configureStore({
  reducer: {
    proposals: proposalReducer,
    proposalViewer: proposalViewerReducer,
    documentation: documentationReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    }),
  devTools: process.env.NODE_ENV !== 'production'
})

// Export store for use in components
// Types can be added later if migrating to TypeScript

export default store