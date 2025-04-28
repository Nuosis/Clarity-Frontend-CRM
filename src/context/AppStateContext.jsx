import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AppStateContext = createContext();
const AppDispatchContext = createContext();

// Action types
export const APP_ACTIONS = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    SET_USER: 'SET_USER',
    SET_SELECTED_CUSTOMER: 'SET_SELECTED_CUSTOMER',
    SET_SELECTED_PROJECT: 'SET_SELECTED_PROJECT',
    SET_SELECTED_TASK: 'SET_SELECTED_TASK',
    SET_SELECTED_TEAM: 'SET_SELECTED_TEAM',
    SET_SHOW_FINANCIAL_ACTIVITY: 'SET_SHOW_FINANCIAL_ACTIVITY',
    SET_SHOW_FILEMAKER_EXAMPLE: 'SET_SHOW_FILEMAKER_EXAMPLE',
    CLEAR_ERROR: 'CLEAR_ERROR',
    RESET_STATE: 'RESET_STATE',
    SET_SHOW_CUSTOMER_FORM: 'SET_SHOW_CUSTOMER_FORM',
    SET_SHOW_TEAM_FORM: 'SET_SHOW_TEAM_FORM',
    SET_SIDEBAR_MODE: 'SET_SIDEBAR_MODE'
};
const initialState = {
    loading: true,
    error: null,
    user: null,
    selectedCustomer: null,
    selectedProject: null,
    selectedTask: null,
    selectedTeam: null,
    showFinancialActivity: false,
    showFileMakerExample: false,
    showCustomerForm: false,
    showTeamForm: false,
    sidebarMode: 'customer', // 'customer' or 'team'
    version: 1, // For state versioning
};

function appReducer(state, action) {
    switch (action.type) {
        case APP_ACTIONS.SET_LOADING:
            return {
                ...state,
                loading: action.payload,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: false,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_USER:
            return {
                ...state,
                user: action.payload,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SELECTED_CUSTOMER:
            return {
                ...state,
                selectedCustomer: action.payload,
                selectedProject: null, // Clear related selections
                selectedTask: null,
                showFinancialActivity: false, // Hide financial activity when selecting a customer
                sidebarMode: 'customer', // Switch to customer mode
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SELECTED_PROJECT:
            return {
                ...state,
                selectedProject: action.payload,
                selectedTask: null, // Clear related selection
                showFinancialActivity: false, // Hide financial activity when selecting a project
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SELECTED_TASK:
            return {
                ...state,
                selectedTask: action.payload,
                showFinancialActivity: false, // Hide financial activity when selecting a task
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SELECTED_TEAM:
            return {
                ...state,
                selectedTeam: action.payload,
                selectedCustomer: null, // Clear customer-related selections
                selectedProject: null,
                selectedTask: null,
                showFinancialActivity: false, // Hide financial activity when selecting a team
                sidebarMode: 'team', // Switch to team mode
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_FINANCIAL_ACTIVITY:
            return {
                ...state,
                showFinancialActivity: action.payload,
                selectedCustomer: null, // Clear selections when showing financial activity
                selectedProject: null,
                selectedTask: null,
                selectedTeam: null,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_FILEMAKER_EXAMPLE:
            return {
                ...state,
                showFileMakerExample: action.payload,
                selectedCustomer: null, // Clear selections when showing FileMaker example
                selectedProject: null,
                selectedTask: null,
                selectedTeam: null,
                showFinancialActivity: false, // Hide financial activity
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_CUSTOMER_FORM:
            return {
                ...state,
                showCustomerForm: action.payload,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_TEAM_FORM:
            return {
                ...state,
                showTeamForm: action.payload,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SIDEBAR_MODE:
            return {
                ...state,
                sidebarMode: action.payload,
                // Clear selections when switching modes
                ...(action.payload === 'customer' ? { selectedTeam: null } : { selectedCustomer: null, selectedProject: null, selectedTask: null }),
                version: state.version + 1
            };
        case APP_ACTIONS.CLEAR_ERROR:
            return {
                ...state,
                error: null,
                version: state.version + 1
            };
        case APP_ACTIONS.RESET_STATE:
            return {
                ...initialState,
                version: state.version + 1
            };
        default:
            return state;
    }
}

export function AppStateProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    return (
        <AppStateContext.Provider value={state}>
            <AppDispatchContext.Provider value={dispatch}>
                {children}
            </AppDispatchContext.Provider>
        </AppStateContext.Provider>
    );
}

export function useAppState() {
    const context = useContext(AppStateContext);
    if (context === undefined) {
        throw new Error('useAppState must be used within an AppStateProvider');
    }
    return context;
}

export function useAppDispatch() {
    const context = useContext(AppDispatchContext);
    if (context === undefined) {
        throw new Error('useAppDispatch must be used within an AppStateProvider');
    }
    return context;
}

// Custom hook for common state operations
export function useAppStateOperations() {
    const dispatch = useAppDispatch();

    const setLoading = useCallback((isLoading) => {
        dispatch({ type: APP_ACTIONS.SET_LOADING, payload: isLoading });
    }, [dispatch]);

    const setError = useCallback((error) => {
        dispatch({ type: APP_ACTIONS.SET_ERROR, payload: error });
    }, [dispatch]);

    const clearError = useCallback(() => {
        dispatch({ type: APP_ACTIONS.CLEAR_ERROR });
    }, [dispatch]);

    const setUser = useCallback((user) => {
        dispatch({ type: APP_ACTIONS.SET_USER, payload: user });
    }, [dispatch]);

    const setSelectedCustomer = useCallback((customer) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_CUSTOMER, payload: customer });
    }, [dispatch]);

    const setSelectedProject = useCallback((project) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_PROJECT, payload: project });
    }, [dispatch]);

    const setSelectedTask = useCallback((task) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_TASK, payload: task });
    }, [dispatch]);

    const setSelectedTeam = useCallback((team) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_TEAM, payload: team });
    }, [dispatch]);

    const resetState = useCallback(() => {
        dispatch({ type: APP_ACTIONS.RESET_STATE });
    }, [dispatch]);

    const setShowFinancialActivity = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_FINANCIAL_ACTIVITY, payload: show });
    }, [dispatch]);

    const setShowFileMakerExample = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_FILEMAKER_EXAMPLE, payload: show });
    }, [dispatch]);

    const setShowCustomerForm = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_CUSTOMER_FORM, payload: show });
    }, [dispatch]);

    const setShowTeamForm = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_TEAM_FORM, payload: show });
    }, [dispatch]);

    const setSidebarMode = useCallback((mode) => {
        dispatch({ type: APP_ACTIONS.SET_SIDEBAR_MODE, payload: mode });
    }, [dispatch]);

    return {
        setLoading,
        setError,
        clearError,
        setUser,
        setSelectedCustomer,
        setSelectedProject,
        setSelectedTask,
        setSelectedTeam,
        setShowFinancialActivity,
        setShowFileMakerExample,
        setShowCustomerForm,
        setShowTeamForm,
        setSidebarMode,
        resetState
    };
}