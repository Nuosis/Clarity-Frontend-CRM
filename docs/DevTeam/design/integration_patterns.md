# DevTeam Autonomous Execution Engine - Integration Patterns

## Executive Summary
This document defines integration patterns for seamlessly incorporating the DevTeam Autonomous Execution Engine into the existing Clarity CRM system. The patterns ensure consistent user experience, maintain existing Redux Toolkit architecture, and extend current TaskList components without disrupting established workflows.

## Integration Architecture Overview

### Core Integration Principles
- **Non-Disruptive Extension:** DevTeam functionality extends existing components rather than replacing them
- **Consistent State Management:** All DevTeam state follows existing Redux Toolkit patterns
- **Unified User Experience:** DevTeam interfaces match existing CRM design language and interactions
- **Backward Compatibility:** Existing task management functionality remains unchanged
- **Progressive Enhancement:** DevTeam features can be enabled/disabled without affecting core CRM

## Redux State Management Integration

### State Structure Extension
```javascript
// Existing CRM Redux State Structure
const existingState = {
  tasks: {
    items: [],
    loading: false,
    error: null,
    filters: {},
    selectedTask: null
  },
  customers: { /* existing customer state */ },
  users: { /* existing user state */ }
}

// Extended State with DevTeam Integration
const extendedState = {
  tasks: {
    // Existing task state (unchanged)
    items: [],
    loading: false,
    error: null,
    filters: {},
    selectedTask: null
  },
  // New DevTeam state slice
  devTeam: {
    // Multi-customer execution state
    executions: {
      active: [], // Array of active customer executions
      capacity: { current: 0, maximum: 5 },
      loading: false,
      error: null
    },
    // Individual customer execution details
    customerExecutions: {
      // Key: customerId, Value: execution state
      [customerId]: {
        customer: {}, // Customer information
        phases: [], // Execution phases
        currentPhase: null,
        tasks: [], // DevTeam-specific tasks
        metrics: {}, // Performance metrics
        timeline: {}, // Project timeline
        status: 'active', // active, paused, completed, error
        lastUpdate: timestamp,
        loading: false,
        error: null
      }
    },
    // System-wide DevTeam state
    system: {
      health: 'healthy', // healthy, degraded, critical
      performance: {},
      alerts: [],
      configuration: {},
      loading: false,
      error: null
    },
    // Task injection management
    taskInjection: {
      queue: [], // Pending task injections
      history: [], // Completed injections
      loading: false,
      error: null
    }
  },
  customers: { /* existing customer state */ },
  users: { /* existing user state */ }
}
```

### Redux Slice Implementation

#### DevTeam Executions Slice
```javascript
// src/store/slices/devTeamExecutionsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { devTeamApi } from '../../api/devTeam'

// Async thunks for DevTeam operations
export const fetchActiveExecutions = createAsyncThunk(
  'devTeam/fetchActiveExecutions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await devTeamApi.getActiveExecutions()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const startCustomerExecution = createAsyncThunk(
  'devTeam/startCustomerExecution',
  async ({ customerId, projectConfig }, { rejectWithValue }) => {
    try {
      const response = await devTeamApi.startExecution(customerId, projectConfig)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const pauseCustomerExecution = createAsyncThunk(
  'devTeam/pauseCustomerExecution',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await devTeamApi.pauseExecution(customerId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const devTeamExecutionsSlice = createSlice({
  name: 'devTeamExecutions',
  initialState: {
    active: [],
    capacity: { current: 0, maximum: 5 },
    loading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateExecutionStatus: (state, action) => {
      const { customerId, status } = action.payload
      const execution = state.active.find(exec => exec.customerId === customerId)
      if (execution) {
        execution.status = status
        execution.lastUpdate = Date.now()
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch active executions
      .addCase(fetchActiveExecutions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActiveExecutions.fulfilled, (state, action) => {
        state.loading = false
        state.active = action.payload.executions
        state.capacity = action.payload.capacity
      })
      .addCase(fetchActiveExecutions.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Start customer execution
      .addCase(startCustomerExecution.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(startCustomerExecution.fulfilled, (state, action) => {
        state.loading = false
        state.active.push(action.payload)
        state.capacity.current += 1
      })
      .addCase(startCustomerExecution.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Pause customer execution
      .addCase(pauseCustomerExecution.fulfilled, (state, action) => {
        const execution = state.active.find(exec => exec.customerId === action.payload.customerId)
        if (execution) {
          execution.status = 'paused'
          execution.lastUpdate = Date.now()
        }
      })
  }
})

export const { clearError, updateExecutionStatus } = devTeamExecutionsSlice.actions
export default devTeamExecutionsSlice.reducer
```

#### Customer Execution Details Slice
```javascript
// src/store/slices/customerExecutionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { devTeamApi } from '../../api/devTeam'

export const fetchCustomerExecution = createAsyncThunk(
  'customerExecution/fetchCustomerExecution',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await devTeamApi.getCustomerExecution(customerId)
      return { customerId, data: response.data }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const injectTask = createAsyncThunk(
  'customerExecution/injectTask',
  async ({ customerId, task, injectionType, position }, { rejectWithValue }) => {
    try {
      const response = await devTeamApi.injectTask(customerId, {
        task,
        injectionType,
        position
      })
      return { customerId, task: response.data }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const customerExecutionSlice = createSlice({
  name: 'customerExecution',
  initialState: {},
  reducers: {
    clearCustomerError: (state, action) => {
      const customerId = action.payload
      if (state[customerId]) {
        state[customerId].error = null
      }
    },
    updateTaskProgress: (state, action) => {
      const { customerId, taskId, progress } = action.payload
      const customerState = state[customerId]
      if (customerState) {
        const task = customerState.tasks.find(t => t.id === taskId)
        if (task) {
          task.progress = progress
          task.lastUpdate = Date.now()
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerExecution.pending, (state, action) => {
        const customerId = action.meta.arg
        if (!state[customerId]) {
          state[customerId] = {
            customer: {},
            phases: [],
            currentPhase: null,
            tasks: [],
            metrics: {},
            timeline: {},
            status: 'loading',
            loading: true,
            error: null
          }
        } else {
          state[customerId].loading = true
          state[customerId].error = null
        }
      })
      .addCase(fetchCustomerExecution.fulfilled, (state, action) => {
        const { customerId, data } = action.payload
        state[customerId] = {
          ...data,
          loading: false,
          error: null
        }
      })
      .addCase(fetchCustomerExecution.rejected, (state, action) => {
        const customerId = action.meta.arg
        if (state[customerId]) {
          state[customerId].loading = false
          state[customerId].error = action.payload
        }
      })
      .addCase(injectTask.fulfilled, (state, action) => {
        const { customerId, task } = action.payload
        if (state[customerId]) {
          state[customerId].tasks.push(task)
        }
      })
  }
})

export const { clearCustomerError, updateTaskProgress } = customerExecutionSlice.actions
export default customerExecutionSlice.reducer
```

## Component Integration Patterns

### TaskList Component Extension

#### Enhanced TaskList with DevTeam Integration
```javascript
// src/components/tasks/TaskList.jsx (Extended)
import React, { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import styled from 'styled-components'

// Existing imports
import { fetchTasks } from '../../store/slices/tasksSlice'

// New DevTeam imports
import { fetchActiveExecutions } from '../../store/slices/devTeamExecutionsSlice'
import DevTeamExecutionCard from './DevTeamExecutionCard'
import DevTeamDashboard from './DevTeamDashboard'

const TaskListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`

const TaskListHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing.md};
`

const TaskListTabs = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  margin-bottom: ${props => props.theme.spacing.md};
`

const TaskListTab = styled.button`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border: none;
  background: ${props => props.active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.active ? props.theme.colors.white : props.theme.colors.text};
  cursor: pointer;
  border-radius: ${props => props.theme.borderRadius.sm} ${props => props.theme.borderRadius.sm} 0 0;
  
  &:hover {
    background: ${props => props.active ? props.theme.colors.primary : props.theme.colors.background};
  }
`

/**
 * Enhanced TaskList component with DevTeam integration
 * Maintains backward compatibility while adding autonomous execution capabilities
 */
const TaskList = ({ customerId, showDevTeam = false }) => {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(showDevTeam ? 'devteam' : 'tasks')
  
  // Existing task state
  const { 
    items: tasks, 
    loading: tasksLoading, 
    error: tasksError 
  } = useSelector(state => state.tasks)
  
  // DevTeam state
  const { 
    active: activeExecutions, 
    loading: executionsLoading, 
    error: executionsError 
  } = useSelector(state => state.devTeamExecutions)
  
  const customerExecution = useSelector(state => 
    customerId ? state.customerExecution[customerId] : null
  )

  // Load data on component mount
  useEffect(() => {
    if (activeTab === 'tasks') {
      dispatch(fetchTasks({ customerId }))
    } else if (activeTab === 'devteam') {
      dispatch(fetchActiveExecutions())
    }
  }, [dispatch, activeTab, customerId])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
  }, [])

  const renderTasksTab = () => (
    <div>
      {/* Existing TaskList implementation */}
      {tasksLoading && <div>Loading tasks...</div>}
      {tasksError && <div>Error: {tasksError}</div>}
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )

  const renderDevTeamTab = () => {
    if (customerId && customerExecution) {
      // Single customer execution view
      return (
        <DevTeamExecutionCard 
          customerId={customerId}
          execution={customerExecution}
        />
      )
    } else {
      // Multi-customer dashboard view
      return (
        <DevTeamDashboard 
          executions={activeExecutions}
          loading={executionsLoading}
          error={executionsError}
        />
      )
    }
  }

  return (
    <TaskListContainer>
      <TaskListHeader>
        <h2>Task Management</h2>
      </TaskListHeader>
      
      <TaskListTabs>
        <TaskListTab 
          active={activeTab === 'tasks'}
          onClick={() => handleTabChange('tasks')}
        >
          Standard Tasks
        </TaskListTab>
        {showDevTeam && (
          <TaskListTab 
            active={activeTab === 'devteam'}
            onClick={() => handleTabChange('devteam')}
          >
            DevTeam Executions
          </TaskListTab>
        )}
      </TaskListTabs>

      {activeTab === 'tasks' && renderTasksTab()}
      {activeTab === 'devteam' && renderDevTeamTab()}
    </TaskListContainer>
  )
}

TaskList.propTypes = {
  customerId: PropTypes.string,
  showDevTeam: PropTypes.bool
}

export default TaskList
```

#### DevTeam Dashboard Component
```javascript
// src/components/tasks/DevTeamDashboard.jsx
import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { startCustomerExecution, pauseCustomerExecution } from '../../store/slices/devTeamExecutionsSlice'

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${props => props.theme.spacing.md};
`

const SystemOverview = styled.div`
  grid-column: 1 / -1;
  padding: ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.borderRadius.md};
  border: 1px solid ${props => props.theme.colors.border};
`

const ExecutionCard = styled.div`
  padding: ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.white};
  border-radius: ${props => props.theme.borderRadius.md};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.sm};
`

/**
 * DevTeam multi-customer execution dashboard
 * Provides overview and management of all active executions
 */
const DevTeamDashboard = ({ executions, loading, error }) => {
  const dispatch = useDispatch()

  const handleStartExecution = useCallback((customerId, config) => {
    dispatch(startCustomerExecution({ customerId, projectConfig: config }))
  }, [dispatch])

  const handlePauseExecution = useCallback((customerId) => {
    dispatch(pauseCustomerExecution(customerId))
  }, [dispatch])

  if (loading) return <div>Loading DevTeam executions...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <DashboardContainer>
      <SystemOverview>
        <h3>System Overview</h3>
        <p>Active Executions: {executions.length}/5</p>
        <p>System Status: Healthy</p>
      </SystemOverview>
      
      {executions.map(execution => (
        <ExecutionCard key={execution.customerId}>
          <h4>{execution.customer.name}</h4>
          <p>Status: {execution.status}</p>
          <p>Progress: {execution.progress}%</p>
          <button onClick={() => handlePauseExecution(execution.customerId)}>
            Pause
          </button>
        </ExecutionCard>
      ))}
    </DashboardContainer>
  )
}

DevTeamDashboard.propTypes = {
  executions: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string
}

export default DevTeamDashboard
```

## API Integration Patterns

### DevTeam API Service
```javascript
// src/api/devTeam.js
import { apiClient } from './index'

export const devTeamApi = {
  // Execution management
  getActiveExecutions: () => apiClient.get('/devteam/executions'),
  getCustomerExecution: (customerId) => apiClient.get(`/devteam/executions/${customerId}`),
  startExecution: (customerId, config) => apiClient.post(`/devteam/executions/${customerId}`, config),
  pauseExecution: (customerId) => apiClient.patch(`/devteam/executions/${customerId}/pause`),
  resumeExecution: (customerId) => apiClient.patch(`/devteam/executions/${customerId}/resume`),
  stopExecution: (customerId) => apiClient.delete(`/devteam/executions/${customerId}`),

  // Task injection
  injectTask: (customerId, taskData) => apiClient.post(`/devteam/executions/${customerId}/tasks`, taskData),
  getTaskInjectionQueue: (customerId) => apiClient.get(`/devteam/executions/${customerId}/tasks/queue`),
  approveTaskInjection: (customerId, taskId) => apiClient.patch(`/devteam/executions/${customerId}/tasks/${taskId}/approve`),

  // Monitoring and metrics
  getSystemHealth: () => apiClient.get('/devteam/system/health'),
  getExecutionMetrics: (customerId) => apiClient.get(`/devteam/executions/${customerId}/metrics`),
  getPerformanceAnalytics: () => apiClient.get('/devteam/analytics/performance'),

  // Error resolution
  getExecutionErrors: (customerId) => apiClient.get(`/devteam/executions/${customerId}/errors`),
  resolveError: (customerId, errorId, resolution) => apiClient.patch(`/devteam/executions/${customerId}/errors/${errorId}`, resolution),
  retryFailedTask: (customerId, taskId) => apiClient.post(`/devteam/executions/${customerId}/tasks/${taskId}/retry`)
}
```

## WebSocket Integration for Real-Time Updates

### WebSocket Service
```javascript
// src/services/devTeamWebSocket.js
import { store } from '../store'
import { updateExecutionStatus, updateTaskProgress } from '../store/slices/customerExecutionSlice'

class DevTeamWebSocketService {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectInterval = 5000
  }

  connect() {
    try {
      this.ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/devteam`)
      
      this.ws.onopen = () => {
        console.log('DevTeam WebSocket connected')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      }

      this.ws.onclose = () => {
        console.log('DevTeam WebSocket disconnected')
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('DevTeam WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect to DevTeam WebSocket:', error)
      this.attemptReconnect()
    }
  }

  handleMessage(data) {
    const { type, payload } = data

    switch (type) {
      case 'EXECUTION_STATUS_UPDATE':
        store.dispatch(updateExecutionStatus({
          customerId: payload.customerId,
          status: payload.status
        }))
        break

      case 'TASK_PROGRESS_UPDATE':
        store.dispatch(updateTaskProgress({
          customerId: payload.customerId,
          taskId: payload.taskId,
          progress: payload.progress
        }))
        break

      case 'SYSTEM_ALERT':
        // Handle system alerts
        break

      default:
        console.warn('Unknown DevTeam WebSocket message type:', type)
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect DevTeam WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.connect()
      }, this.reconnectInterval)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const devTeamWebSocket = new DevTeamWebSocketService()
```

## Navigation Integration

### Enhanced Navigation with DevTeam Routes
```javascript
// src/components/layout/Navigation.jsx (Extended)
import React from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

const NavigationContainer = styled.nav`
  /* Existing navigation styles */
`

const NavItem = styled(NavLink)`
  /* Existing nav item styles */
`

const DevTeamIndicator = styled.span`
  background: ${props => props.theme.colors.success};
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-left: ${props => props.theme.spacing.xs};
`

const Navigation = () => {
  const activeExecutions = useSelector(state => state.devTeamExecutions.active)
  const executionCount = activeExecutions.length

  return (
    <NavigationContainer>
      {/* Existing navigation items */}
      <NavItem to="/tasks">
        Tasks
      </NavItem>
      <NavItem to="/customers">
        Customers
      </NavItem>
      
      {/* New DevTeam navigation */}
      <NavItem to="/devteam">
        DevTeam
        {executionCount > 0 && (
          <DevTeamIndicator>{executionCount}</DevTeamIndicator>
        )}
      </NavItem>
    </NavigationContainer>
  )
}

export default Navigation
```

## Store Configuration Integration

### Enhanced Store Configuration
```javascript
// src/store/index.js (Extended)
import { configureStore } from '@reduxjs/toolkit'

// Existing reducers
import tasksReducer from './slices/tasksSlice'
import customersReducer from './slices/customersSlice'
import usersReducer from './slices/usersSlice'

// New DevTeam reducers
import devTeamExecutionsReducer from './slices/devTeamExecutionsSlice'
import customerExecutionReducer from './slices/customerExecutionSlice'
import devTeamSystemReducer from './slices/devTeamSystemSlice'

export const store = configureStore({
  reducer: {
    // Existing reducers (unchanged)
    tasks: tasksReducer,
    customers: customersReducer,
    users: usersReducer,
    
    // New DevTeam reducers
    devTeamExecutions: devTeamExecutionsReducer,
    customerExecution: customerExecutionReducer,
    devTeamSystem: devTeamSystemReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

## Feature Flag Integration

### DevTeam Feature Toggle
```javascript
// src/utils/featureFlags.js
export const FEATURE_FLAGS = {
  DEVTEAM_ENABLED: process.env.REACT_APP_DEVTEAM_ENABLED === 'true',
  DEVTEAM_MULTI_CUSTOMER: process.env.REACT_APP_DEVTEAM_MULTI_CUSTOMER === 'true',
  DEVTEAM_TASK_INJECTION: process.env.REACT_APP_DEVTEAM_TASK_INJECTION === 'true'
}

export const isFeatureEnabled = (flag) => {
  return FEATURE_FLAGS[flag] || false
}

// Usage in components
import { isFeatureEnabled } from '../../utils/featureFlags'

const TaskList = ({ customerId }) => {
  const showDevTeam = isFeatureEnabled('DEVTEAM_ENABLED')
  
  return (
    <TaskListContainer>
      {/* Component implementation */}
      {showDevTeam && <DevTeamTab />}
    </TaskListContainer>
  )
}
```

## Error Boundary Integration

### DevTeam Error Boundary
```javascript
// src/components/common/DevTeamErrorBoundary.jsx
import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const ErrorContainer = styled.div`
  padding: ${props => props.theme.spacing.lg};
  background: ${props => props.theme.colors.error};
  color: white;
  border-radius: ${props => props.theme.borderRadius.md};
  text-align: center;
`

class DevTeamErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('DevTeam Error Boundary caught an error:', error, errorInfo)
    // Log to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <h3>DevTeam Feature Unavailable</h3>
          <p>The DevTeam autonomous execution feature encountered an error.</p>
          <p>Standard task management remains available.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </ErrorContainer>
      )
    }

    return this.props.children
  }
}

DevTeamErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
}

export default DevTeamErrorBoundary
```

## Testing Integration Patterns

### DevTeam Component Testing
```javascript
// src/components/tasks/__tests__/TaskList.test.jsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import TaskList from '../TaskList'

// Mock store with DevTeam state
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      tasks: (state = { items: [], loading: false, error: null }) => state,
      devTeamExecutions: (state = { active: [], loading: false, error: null }) => state,
      customerExecution: (state = {}) => state
    },
    preloadedState: initialState
  })
}

describe('TaskList with DevTeam Integration', () => {
  test('renders standard tasks tab by default', () => {
    const store = createMockStore()
    render(
      <Provider store={store}>
        <TaskList />
      </Provider>
    )
    
    expect(screen.getByText('Standard Tasks')).toBeInTheDocument()
  })

  test('shows DevTeam tab when enabled', () => {
    const store = createMockStore()
    render(
      <Provider store={store}>
        <TaskList showDevTeam={true} />
      </Provider>
    )
    
    expect(screen.getByText('DevTeam Executions')).toBeInTheDocument()
  })

  test('switches between tabs correctly', () => {
    const store = createMockStore()
    render(
      <Provider store={store}>
        <TaskList showDevTeam={true} />
      </Provider>
    )
    
    const devTeamTab = screen.getByText('DevTeam Executions')
    fireEvent.click(devTeamTab)
    
    // Verify DevTeam content is shown
    expect(screen.getByText('System Overview')).toBeInTheDocument()
  })
})
```

This integration pattern document provides comprehensive guidance for seamlessly incorporating DevTeam functionality into the existing CRM system while maintaining backward compatibility and consistent user experience.