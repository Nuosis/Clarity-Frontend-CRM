# Clarity Admin Frontend Development Guidelines

This document outlines the development standards, patterns, and best practices for the Clarity Admin React frontend project. These guidelines ensure code quality, maintainability, and consistency across the codebase.

## Overview
This document outlines development standards, practices, and workflows for the Clarity Business Solution's admin frontend. All developers should follow these guidelines to maintain consistency, quality, and alignment with the existing Clarity ecosystem.

## Project Architecture

### Three-Layer Architecture
1. **UI (Frontend-Admin [This project])** - React-based admin interface for management/developer low-level backend access

### Core Principles
- **DRY (Don't Repeat Yourself)**: Eliminate code duplication through reusable components, hooks, and utilities
- **Component-Based Architecture**: Build modular, reusable React components with single responsibilities
- **State Management**: Centralized state management using Redux Toolkit for predictable data flow
- **Performance-First**: Optimize for fast loading and responsive user interactions
- **Type Safety**: Use PropTypes or TypeScript for component prop validation
- **Accessibility**: Ensure components are accessible and follow WCAG guidelines
- **Responsive Design**: Mobile-first approach with responsive layouts

### Frontend Design Requirements
- **Component Reusability**: Create reusable components that can be composed together
- **Performance Priority**: Optimize bundle size, lazy loading, and rendering performance
- **User Experience**: Prioritize intuitive interfaces and smooth interactions
- **Error Boundaries**: Implement proper error handling and user feedback
- **Progressive Enhancement**: Ensure core functionality works without JavaScript

## Code Organization

### Directory Structure
```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (Button, Input, Modal)
│   ├── forms/           # Form-specific components
│   └── layout/          # Layout components (Header, Footer, Sidebar)
├── pages/               # Page-level components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and API clients
├── store/               # Redux store and slices
├── styles/              # Theme, global styles, and styled-components
├── assets/              # Images, icons, and static files
├── types/               # TypeScript type definitions (if using TS)
└── utils/               # Helper functions and constants
```

### File Naming Conventions
- **Components**: `PascalCase.jsx` (e.g., `UserProfile.jsx`)
- **Hooks**: `camelCase.js` starting with `use` (e.g., `useAuth.js`)
- **Utilities**: `camelCase.js` (e.g., `apiClient.js`)
- **Constants**: `UPPERCASE_WITH_UNDERSCORES.js`
- **Styled Components**: `PascalCase` with descriptive names

## Development Standards

### React Code Style
- **React Version**: 19.1.0+ with modern patterns
- **Linting**: Follow ESLint configuration (see [`eslint.config.js`](eslint.config.js))
- **Component Structure**: Functional components with hooks
- **Props**: Use destructuring and default values
- **Event Handlers**: Use arrow functions and descriptive names
- **Conditional Rendering**: Use logical operators and ternary expressions appropriately

### Modern React Standards
- **Hooks**: Use built-in hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Error Boundaries**: Implement error boundaries for component error handling
- **Suspense**: Use React Suspense for code splitting and loading states
- **Strict Mode**: Always wrap app in React.StrictMode during development

### Code Quality Rules
```jsx
// ✅ Correct modern patterns
const UserProfile = ({ userId, onUpdate }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const handleUpdate = useCallback(async (userData) => {
    try {
      setLoading(true)
      await updateUser(userId, userData)
      onUpdate?.(userData)
    } catch (error) {
      console.error('Update failed:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, onUpdate])
  
  return (
    <UserContainer>
      {loading ? <Spinner /> : <UserForm onSubmit={handleUpdate} />}
    </UserContainer>
  )
}

// ✅ Proper prop validation
UserProfile.propTypes = {
  userId: PropTypes.string.isRequired,
  onUpdate: PropTypes.func
}
```

### Component Pattern
All components should follow this structure:

```jsx
import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const StyledComponent = styled.div`
  /* Styled component styles */
`

/**
 * Component description
 * @param {Object} props - Component props
 * @param {string} props.title - Component title
 * @param {Function} props.onAction - Action handler
 */
const ComponentName = ({ title, onAction }) => {
  const [state, setState] = useState(initialState)
  
  const handleAction = useCallback(() => {
    // Handle action logic
    onAction?.()
  }, [onAction])
  
  useEffect(() => {
    // Side effects
  }, [])
  
  return (
    <StyledComponent>
      {/* Component JSX */}
    </StyledComponent>
  )
}

ComponentName.propTypes = {
  title: PropTypes.string.isRequired,
  onAction: PropTypes.func
}

ComponentName.defaultProps = {
  onAction: null
}

export default ComponentName
```

### Custom Hook Pattern
Extract reusable logic into custom hooks:

```jsx
import { useState, useEffect } from 'react'

/**
 * Custom hook for API data fetching
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Object} { data, loading, error, refetch }
 */
const useApiData = (url, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(url, options)
      if (!response.ok) throw new Error('Fetch failed')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [url, options])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  return { data, loading, error, refetch: fetchData }
}

export default useApiData
```

## State Management Guidelines

### Redux Toolkit Setup
- **Store Configuration**: Use `configureStore` from Redux Toolkit
- **Slices**: Create feature-based slices with `createSlice`
- **Async Actions**: Use `createAsyncThunk` for API calls
- **Selectors**: Create reusable selectors for state access

### State Structure
```javascript
// store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await signInWithEmail(email, password)
      return response.user
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
      state.isAuthenticated = !!action.payload
    },
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { setUser, clearError } = authSlice.actions
export default authSlice.reducer
```

## Styling Guidelines

### Styled Components
- **Theme Provider**: Use ThemeProvider for consistent design tokens
- **Component-Scoped Styles**: Keep styles close to components
- **Responsive Design**: Use theme breakpoints for responsive styles
- **Design Tokens**: Define colors, spacing, typography in theme

### Theme Structure
```javascript
// styles/theme.js
export const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    error: '#dc3545',
    background: {
      primary: '#ffffff',
      secondary: '#f8f9fa'
    },
    text: {
      primary: '#212529',
      secondary: '#6c757d'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '3rem'
  },
  typography: {
    fontSize: {
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem'
    },
    fontWeight: {
      normal: 400,
      semibold: 600,
      bold: 700
    }
  },
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1200px'
  }
}
```

## API Integration

### API Client Pattern
Centralize API calls in dedicated service modules:

```javascript
// lib/apiClient.js
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers
      },
      ...options
    }
    
    try {
      const response = await fetch(url, config)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }
  
  getAuthHeaders() {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  
  // HTTP method helpers
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })
  }
  
  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
  
  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }
  
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(process.env.REACT_APP_API_URL)
```

### Error Handling Pattern
Implement consistent error handling across the application:

```jsx
// components/ErrorBoundary.jsx
import { Component } from 'react'
import PropTypes from 'prop-types'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    // Log to error reporting service
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <p>Please refresh the page or contact support</p>
        </div>
      )
    }
    
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node
}

export default ErrorBoundary
```

## Performance Guidelines

### React Performance Patterns
- **Memoization**: Use `React.memo`, `useMemo`, and `useCallback` appropriately
- **Code Splitting**: Implement lazy loading for routes and components
- **Bundle Optimization**: Analyze and optimize bundle size
- **Image Optimization**: Use appropriate image formats and lazy loading
- **Virtual Scrolling**: For large lists, implement virtualization

### Optimization Practices
```jsx
// ✅ Memoized component
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => ({ ...item, processed: true }))
  }, [data])
  
  const handleUpdate = useCallback((id) => {
    onUpdate(id)
  }, [onUpdate])
  
  return (
    <div>
      {processedData.map(item => (
        <Item key={item.id} data={item} onUpdate={handleUpdate} />
      ))}
    </div>
  )
})

// ✅ Lazy loaded component
const LazyDashboard = lazy(() => import('./pages/Dashboard'))

// ✅ Usage with Suspense
<Suspense fallback={<Spinner />}>
  <LazyDashboard />
</Suspense>
```

## Testing Requirements

### Test Organization
- **Location**: Place tests adjacent to components (`Component.test.jsx`)
- **Structure**: Mirror component structure
- **Naming**: `{ComponentName}.test.jsx`

### Test Coverage
- **Unit Tests**: All utility functions and custom hooks
- **Component Tests**: Render tests and user interaction tests
- **Integration Tests**: API integration and state management
- **E2E Tests**: Critical user flows

### Testing Patterns
```jsx
// components/Button.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import Button from './Button'
import { theme } from '../styles/theme'

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('Button', () => {
  it('renders with correct text', () => {
    renderWithTheme(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
  
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    renderWithTheme(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
  
  it('is disabled when loading', () => {
    renderWithTheme(<Button loading>Click me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

## Security Guidelines

### Frontend Security
- **Input Validation**: Validate all user inputs on the frontend and backend
- **XSS Prevention**: Sanitize user-generated content
- **CSRF Protection**: Implement CSRF tokens for state-changing operations
- **Authentication**: Secure token storage and management
- **Environment Variables**: Never expose sensitive data in client-side code

### Authentication Pattern
```jsx
// hooks/useAuth.js
import { useSelector, useDispatch } from 'react-redux'
import { useCallback } from 'react'
import { setUser, clearUser } from '../store/authSlice'

const useAuth = () => {
  const dispatch = useDispatch()
  const { user, isAuthenticated, loading } = useSelector(state => state.auth)
  
  const login = useCallback(async (credentials) => {
    try {
      const response = await apiClient.post('/auth/login', credentials)
      dispatch(setUser(response.user))
      localStorage.setItem('auth_token', response.token)
      return response
    } catch (error) {
      throw error
    }
  }, [dispatch])
  
  const logout = useCallback(() => {
    dispatch(clearUser())
    localStorage.removeItem('auth_token')
  }, [dispatch])
  
  return { user, isAuthenticated, loading, login, logout }
}

export default useAuth
```

## Documentation Standards

### Component Documentation
- **JSDoc Comments**: Document all props and component purpose
- **PropTypes**: Define prop types for all components
- **README**: Component usage examples and API documentation
- **Storybook**: Interactive component documentation (if implemented)

### Code Documentation
```jsx
/**
 * UserCard component displays user information in a card format
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.user - User object containing user data
 * @param {string} props.user.name - User's full name
 * @param {string} props.user.email - User's email address
 * @param {string} [props.user.avatar] - User's avatar URL (optional)
 * @param {Function} [props.onEdit] - Callback function when edit button is clicked
 * @param {Function} [props.onDelete] - Callback function when delete button is clicked
 * @param {boolean} [props.loading=false] - Loading state indicator
 * 
 * @example
 * <UserCard 
 *   user={{ name: 'John Doe', email: 'john@example.com' }}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 */
const UserCard = ({ user, onEdit, onDelete, loading = false }) => {
  // Component implementation
}
```

## Build and Deployment

### Build Configuration
- **Vite**: Modern build tool with fast HMR and optimized production builds
- **Environment Variables**: Use `.env` files for configuration
- **Asset Optimization**: Automatic code splitting and tree shaking
- **Source Maps**: Generate source maps for debugging

### Development Workflow
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Environment Management
- **Never commit**: `.env` files or secrets to version control
- **Documentation**: Document all required environment variables in `env.example`
- **Validation**: Validate required environment variables on app startup

## Git Workflow

### Branching Strategy
- **Main Branch**: `main` - Production-ready code
- **Feature Branches**: `feature/feature-name` - New features
- **Bug Fixes**: `fix/bug-description` - Bug fixes
- **Hotfixes**: `hotfix/critical-fix` - Critical production fixes

### Commit Standards
- **Conventional Commits**: Use conventional commit format
- **Descriptive Messages**: Clear, concise commit messages
- **Atomic Commits**: One logical change per commit

### Code Reviews
- **Pull Requests**: All changes must go through PR review
- **Review Checklist**: Code quality, performance, accessibility, tests
- **Approval Required**: At least one approval before merging

## Best Practices Checklist

### Before implementing any new component:
1. Check if a similar component already exists
2. Design for reusability and composition
3. Consider accessibility requirements
4. Plan for responsive design
5. Define clear prop interfaces
6. Consider performance implications
7. Plan error handling and loading states

### Development Checklist:
1. Component follows established patterns
2. Props are properly typed and documented
3. Styles use theme tokens consistently
4. Error boundaries are implemented where needed
5. Loading states provide good UX
6. Component is accessible (ARIA labels, keyboard navigation)
7. Tests cover main functionality
8. Performance is optimized (memoization where appropriate)

### Environment Setup Checklist:
1. All required environment variables are documented
2. `.env.example` is up to date
3. Development server starts without errors
4. Linting passes without warnings
5. Build process completes successfully

## Anti-Patterns to Avoid

### Component Anti-Patterns
```jsx
// ❌ Avoid: Inline styles instead of styled-components
<div style={{ color: 'red', fontSize: '16px' }}>Text</div>

// ✅ Use: Styled components with theme
const StyledText = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: ${props => props.theme.typography.fontSize.md};
`

// ❌ Avoid: Direct DOM manipulation
useEffect(() => {
  document.getElementById('myElement').style.display = 'none'
}, [])

// ✅ Use: React state and conditional rendering
const [isVisible, setIsVisible] = useState(true)
return isVisible && <MyElement />

// ❌ Avoid: Mutating props
const Component = ({ items }) => {
  items.push(newItem) // Don't mutate props
  return <List items={items} />
}

// ✅ Use: Immutable updates
const Component = ({ items }) => {
  const updatedItems = [...items, newItem]
  return <List items={updatedItems} />
}
```

### State Management Anti-Patterns
```jsx
// ❌ Avoid: Too many useState hooks
const [name, setName] = useState('')
const [email, setEmail] = useState('')
const [phone, setPhone] = useState('')
const [address, setAddress] = useState('')

// ✅ Use: useReducer for complex state
const [formState, dispatch] = useReducer(formReducer, initialState)

// ❌ Avoid: Prop drilling
<Parent>
  <Child user={user} onUpdate={onUpdate} />
    <GrandChild user={user} onUpdate={onUpdate} />
      <GreatGrandChild user={user} onUpdate={onUpdate} />
</Parent>

// ✅ Use: Context or Redux for shared state
const UserContext = createContext()
// Or use Redux for global state
```

This document serves as the foundation for all frontend development in the Clarity Admin project. Regular reviews and updates ensure these guidelines remain current with evolving best practices and project needs.