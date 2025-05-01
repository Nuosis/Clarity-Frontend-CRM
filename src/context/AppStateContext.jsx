import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

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
    SET_SELECTED_PRODUCT: 'SET_SELECTED_PRODUCT',
    SET_SELECTED_SALE: 'SET_SELECTED_SALE',
    SET_CUSTOMER_DETAILS: 'SET_CUSTOMER_DETAILS',
    SET_SHOW_FINANCIAL_ACTIVITY: 'SET_SHOW_FINANCIAL_ACTIVITY',
    SET_SHOW_FILEMAKER_EXAMPLE: 'SET_SHOW_FILEMAKER_EXAMPLE',
    SET_SHOW_SUPABASE_EXAMPLE: 'SET_SHOW_SUPABASE_EXAMPLE',
    SET_SHOW_QBO_TEST_PANEL: 'SET_SHOW_QBO_TEST_PANEL',
    CLEAR_ERROR: 'CLEAR_ERROR',
    RESET_STATE: 'RESET_STATE',
    SET_SHOW_CUSTOMER_FORM: 'SET_SHOW_CUSTOMER_FORM',
    SET_SHOW_TEAM_FORM: 'SET_SHOW_TEAM_FORM',
    SET_SHOW_PRODUCT_FORM: 'SET_SHOW_PRODUCT_FORM',
    SET_SIDEBAR_MODE: 'SET_SIDEBAR_MODE',
    SET_PRODUCTS: 'SET_PRODUCTS',
    SET_SALES: 'SET_SALES'
};
const initialState = {
    loading: true,
    error: null,
    user: null, // Will include userID, userEmail, userName, teamID, supabaseUserID, and supabaseOrgID
    selectedCustomer: null,
    selectedProject: null,
    selectedTask: null,
    selectedTeam: null,
    selectedProduct: null,
    selectedSale: null,
    customerDetails: null, // Will store Supabase customer details
    showFinancialActivity: false,
    showFileMakerExample: false,
    showSupabaseExample: false,
    showQboTestPanel: false,
    showCustomerForm: false,
    showTeamForm: false,
    showProductForm: false,
    sidebarMode: 'customer', // 'customer', 'team', or 'product'
    // Initial data
    products: [],
    sales: [],
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
                customerDetails: null, // Clear customer details when selecting a new customer
                showFinancialActivity: false, // Hide financial activity when selecting a customer
                sidebarMode: 'customer', // Switch to customer mode
                version: state.version + 1
            };
        case APP_ACTIONS.SET_CUSTOMER_DETAILS:
            return {
                ...state,
                customerDetails: action.payload,
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
        case APP_ACTIONS.SET_SELECTED_PRODUCT:
            return {
                ...state,
                selectedProduct: action.payload,
                showFinancialActivity: false,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SELECTED_SALE:
            return {
                ...state,
                selectedSale: action.payload,
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
                showSupabaseExample: false, // Hide Supabase example
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_SUPABASE_EXAMPLE:
            return {
                ...state,
                showSupabaseExample: action.payload,
                selectedCustomer: null, // Clear selections when showing Supabase example
                selectedProject: null,
                selectedTask: null,
                selectedTeam: null,
                showFinancialActivity: false, // Hide financial activity
                showFileMakerExample: false, // Hide FileMaker example
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SHOW_QBO_TEST_PANEL:
            return {
                ...state,
                showQboTestPanel: action.payload,
                selectedCustomer: null, // Clear selections when showing QBO test panel
                selectedProject: null,
                selectedTask: null,
                selectedTeam: null,
                showFinancialActivity: false, // Hide financial activity
                showFileMakerExample: false, // Hide FileMaker example
                showSupabaseExample: false, // Hide Supabase example
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
        case APP_ACTIONS.SET_SHOW_PRODUCT_FORM:
            return {
                ...state,
                showProductForm: action.payload,
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
        case APP_ACTIONS.SET_PRODUCTS:
            return {
                ...state,
                products: action.payload,
                version: state.version + 1
            };
        case APP_ACTIONS.SET_SALES:
            return {
                ...state,
                sales: action.payload,
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

    // Expose state to window object for debugging
    useEffect(() => {
        window.state = state;
    }, [state]);

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
    
    const setCustomerDetails = useCallback((details) => {
        dispatch({ type: APP_ACTIONS.SET_CUSTOMER_DETAILS, payload: details });
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

    const setSelectedProduct = useCallback((product) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_PRODUCT, payload: product });
    }, [dispatch]);

    const setSelectedSale = useCallback((sale) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_SALE, payload: sale });
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
    
    const setShowSupabaseExample = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_SUPABASE_EXAMPLE, payload: show });
    }, [dispatch]);
    
    const setShowQboTestPanel = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_QBO_TEST_PANEL, payload: show });
    }, [dispatch]);

    const setShowCustomerForm = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_CUSTOMER_FORM, payload: show });
    }, [dispatch]);

    const setShowTeamForm = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_TEAM_FORM, payload: show });
    }, [dispatch]);

    const setShowProductForm = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_PRODUCT_FORM, payload: show });
    }, [dispatch]);

    const setProducts = useCallback((products) => {
        dispatch({ type: APP_ACTIONS.SET_PRODUCTS, payload: products });
    }, [dispatch]);

    const setSales = useCallback((sales) => {
        dispatch({ type: APP_ACTIONS.SET_SALES, payload: sales });
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
        setSelectedProduct,
        setSelectedSale,
        setCustomerDetails,
        setShowFinancialActivity,
        setShowFileMakerExample,
        setShowSupabaseExample,
        setShowQboTestPanel,
        setShowCustomerForm,
        setShowTeamForm,
        setShowProductForm,
        setSidebarMode,
        setProducts,
        setSales,
        resetState
    };
}