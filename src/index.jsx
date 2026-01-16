import React, { useEffect, useMemo, useCallback, useState } from 'react';
import Loading from './components/loading/Loading';
import AppLayout, { ThemeProvider } from './components/layout/AppLayout';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/MainContent';
import ErrorBoundary from './components/ErrorBoundary';
import SignIn from './components/auth/SignIn';
import { useTheme } from './components/layout/AppLayout';
import { useCustomer, useProject, useTask, useProducts, useSales } from './hooks';
import { TeamProvider, useTeamContext } from './context/TeamContext';
import { initializationService } from './services/initializationService';
import { loadingStateManager, useGlobalLoadingState } from './services/loadingStateManager';
import { AppStateProvider, useAppState, useAppStateOperations } from './context/AppStateContext';
import { ProjectProvider } from './context/ProjectContext';
import { calculateProjectDetailStats } from './services/projectService';
import { setAuthenticationContext } from './services/dataService';

// Memoized sidebar for performance
const MemoizedSidebar = React.memo(Sidebar);

function AppContent() {
    const { darkMode } = useTheme();
    const appState = useAppState();

    const {
        setLoading,
        setError,
        setUser,
        setSelectedCustomer,
        setSelectedProject,
        setSelectedTask,
        setSelectedTeam,
        setShowProductForm,
        setAuthentication,
        setEnvironment,
        setEnvironmentDetectionComplete,
        resetState
    } = useAppStateOperations();
    const globalLoadingState = useGlobalLoadingState();

    const {
        customers,
        pagination,
        error: customerError,
        handleCustomerSelect,
        handleCustomerStatusToggle,
        handleCustomerDelete,
        loadCustomers,
        setPagination
    } = useCustomer();

    // Use the TeamContext instead of calling useTeam directly
    const {
        teams,
        error: teamError,
        selectedTeam: hookSelectedTeam,
        teamStaff,
        teamProjects,
        stats: teamStats,
        handleTeamSelect,
        handleTeamDelete,
        loadTeams
    } = useTeamContext();

    // Project state and handlers
    // Use Supabase customer ID for prospects, FileMaker customer ID for regular customers
    const projectCustomerId = appState.selectedProspect?.id || appState.selectedCustomer?.id;
    const {
        projects,
        error: projectError,
        stats: projectStats,
        handleProjectSelect,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectStatusChange,
        handleProjectDelete,
        clearSelectedProject,
        loadProjectDetails,
        projectRecords
    } = useProject(projectCustomerId);

    // Task state and handlers
    const {
        tasks,
        selectedTask,
        timer,
        stats: taskStats,
        error: taskError,
        handleTaskSelect,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        clearSelectedTask
    } = useTask(appState.selectedProject?.id);
    const { loadProducts } = useProducts();
    const { loadUnbilledSalesForOrganization } = useSales();

    // Marketing domain state
    const [selectedMarketingDomain, setSelectedMarketingDomain] = useState(null);

    // Marketing domain handler
    const handleMarketingDomainSelect = useCallback((domain) => {
        setSelectedMarketingDomain(domain);
    }, []);

    // Authentication handler - Supabase only
    const handleSupabaseAuth = useCallback((authState) => {
        console.log('[App] Supabase authentication successful', authState);

        // Set authentication context in dataService
        setAuthenticationContext(authState);

        // Set authentication state in app
        setAuthentication(authState);

        console.log('[App] Supabase authentication set, starting initialization');
    }, [setAuthentication]);

    // Initialization effect - only runs after authentication
    useEffect(() => {
        let isInitialized = false;
        
        const initialize = async () => {
            // Skip if already initialized or not authenticated
            if (isInitialized || !appState.authentication.isAuthenticated) {
                return;
            }
            
            try {
                console.log('[App] Starting initialization');
                loadingStateManager.setLoading('initialization', true, 'Initializing application...');

                // Web app initialization
                loadingStateManager.setLoading('initialization', true, 'Setting up web application...');
                    
                    // Set user from Supabase auth
                    if (appState.authentication.user) {
                        const webAppUser = {
                            userEmail: appState.authentication.user.email,
                            userName: appState.authentication.user.user_metadata?.full_name || appState.authentication.user.email,
                            userID: appState.authentication.user.id
                        };
                        setUser(webAppUser);
                        
                        // Fetch Supabase organization ID for web app users
                        loadingStateManager.setLoading('initialization', true, 'Retrieving organization information...');
                        console.log('[App] Web app user before fetchSupabaseUserId:', webAppUser);
                        
                        const supabaseIds = await initializationService.fetchSupabaseUserId(webAppUser, setUser);
                        console.log('[App] fetchSupabaseUserId result:', supabaseIds);

                        // Update authentication context with organization ID after it's fetched
                        if (supabaseIds && supabaseIds.supabaseOrgId) {
                            const updatedUser = {
                                ...webAppUser,
                                supabaseUserID: supabaseIds.supabaseUserId,
                                supabaseOrgID: supabaseIds.supabaseOrgId
                            };

                            setAuthenticationContext({
                                isAuthenticated: true,
                                user: updatedUser
                            });
                            console.log('[App] Authentication context updated with organization ID:', supabaseIds.supabaseOrgId);
                        }

                        // Load products (single-tenancy)
                        loadingStateManager.setLoading('initialization', true, 'Loading products...');
                        await loadProducts();

                        // Load sales if organization ID is available
                        if (supabaseIds && supabaseIds.supabaseOrgId) {
                            console.log('[App] Loading sales for org ID:', supabaseIds.supabaseOrgId);
                            loadingStateManager.setLoading('initialization', true, 'Loading sales...');
                            await loadUnbilledSalesForOrganization(supabaseIds.supabaseOrgId);
                        } else {
                            console.log('[App] No organization ID found - skipping products/sales loading:', {
                                hasSupabaseIds: !!supabaseIds,
                                supabaseOrgId: supabaseIds?.supabaseOrgId
                            });
                        }
                    }

                loadingStateManager.setLoading('initialization', true, 'Loading initial data...');
                await initializationService.preloadData(async () => {
                    await loadCustomers();
                    await loadTeams();
                });
                
                loadingStateManager.clearLoadingState('initialization');
                setLoading(false);
                isInitialized = true;
                console.log('[App] Initialization complete');
            } catch (error) {
                console.error('[App] Initialization error:', error);
                setError(error.message);
                loadingStateManager.clearLoadingState('initialization');
            }
        };

        // Only initialize if authenticated
        if (appState.authentication.isAuthenticated) {
            initialize();
        }
    }, [
        appState.authentication.isAuthenticated,
        loadCustomers,
        loadTeams,
        setError,
        setLoading,
        setUser,
        setAuthentication,
        loadProducts,
        loadUnbilledSalesForOrganization
    ]);

    // Memoized handlers using useCallback
    const onCustomerSelect = useCallback(async (customer) => {
        // If it's a different customer, clear selected project and task
        if (!appState.selectedCustomer || appState.selectedCustomer.id !== customer.id) {
            clearSelectedProject();
            clearSelectedTask();
        }
        // Always reload customer data, even if it's the same customer
        await handleCustomerSelect(customer.id);
        setSelectedCustomer(customer);
    }, [appState.selectedCustomer, clearSelectedProject, clearSelectedTask, handleCustomerSelect, setSelectedCustomer]);

    // Handler for team selection
    const onTeamSelect = useCallback(async (team) => {
        console.log('onTeamSelect called with team:', team);
        
        try {
            // Always reload team data, even if it's the same team
            console.log('Calling handleTeamSelect with team ID:', team.id);
            const result = await handleTeamSelect(team.id);
            console.log('handleTeamSelect returned result:', result);
            
            if (result) {
                // Use the team data from the result
                const teamData = result.team || team;
                
                // Set the selected team in app state
                console.log('Setting selected team in app state:', teamData);
                setSelectedTeam(teamData);
                
                console.log('Current teamStaff after handleTeamSelect:', teamStaff);
            } else {
                console.error('handleTeamSelect returned null or undefined result');
                setSelectedTeam(team);
            }
        } catch (error) {
            console.error('Error in onTeamSelect:', error);
            // Still set the selected team even if there was an error
            setSelectedTeam(team);
        }
    }, [handleTeamSelect, setSelectedTeam, teamStaff]);

    // Handler for project deletion
    const onProjectDelete = useCallback(async (projectId) => {
        try {
            // Delete the project
            await handleProjectDelete(projectId);
            
            // Clear the selected project in the app state
            setSelectedProject(null);
            
            // No need to explicitly navigate back to customer details
            // since clearing the selected project will cause MainContent to show customer details
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    }, [handleProjectDelete, setSelectedProject]);

    const onProjectSelect = useCallback(async (project) => {
        clearSelectedTask();
        try {
            // Set loading state to true
            setLoading(true);
            
            // Load project details including images, links, objectives, steps, and notes
            console.log("Loading project details for project:", project);
            
            // Get the project ID, handling different possible formats
            const projectId = project.__ID || project.id || project.recordId;
            if (!projectId) {
                throw new Error("Project ID not found in project object");
            }
            
            console.log("Using project ID:", projectId, "from project:", project);
            const details = await loadProjectDetails(projectId);
            console.log("Project details loaded:", details);

            // Calculate stats using project records if they exist
            const stats = projectRecords ? calculateProjectDetailStats(project, projectRecords) : { totalHours: 0, unbilledHours: 0, completion: 0 };
            console.log("Project stats calculated:", stats);
            
            // Create complete project object with all data
            const completeProject = {
                ...project,
                images: details.images || [],
                links: details.links || [],
                objectives: details.objectives || [],
                notes: details.notes || [],
                records: projectRecords ? projectRecords.filter(r => r.fieldData._projectID === projectId) : [],
                stats: {
                    totalHours: stats.totalHours,
                    unbilledHours: stats.unbilledHours,
                    completion: stats.completion
                }
            };
            console.log("Complete project object:", completeProject);
            
            // Use a setTimeout to ensure the state update happens in a separate tick
            // This helps prevent React rendering issues with complex state updates
            setTimeout(() => {
                setSelectedProject(completeProject);
                setLoading(false);
            }, 0);
        } catch (error) {
            console.error('Error selecting project:', error);
            setLoading(false);
        }
    }, [clearSelectedTask, loadProjectDetails, projectRecords, setSelectedProject, calculateProjectDetailStats, setLoading]);

    const onTaskSelect = useCallback((task) => {
        handleTaskSelect(task.id);
        setSelectedTask(task);
    }, [handleTaskSelect, setSelectedTask]);

    const clearSelectedTaskHandler = useCallback(() => {
        clearSelectedTask();
        setSelectedTask(null);
    }, [clearSelectedTask, setSelectedTask]);

    const clearSelectedProjectHandler = useCallback(() => {
        clearSelectedProject();
        setSelectedProject(null);
    }, [clearSelectedProject, setSelectedProject]);

    // Pagination handlers for customer list
    const handleCustomerPageChange = useCallback(async (newOffset) => {
        await loadCustomers({
            limit: pagination.limit,
            offset: newOffset
        });
    }, [loadCustomers, pagination.limit]);

    const handleCustomerLimitChange = useCallback(async (newLimit) => {
        // When limit changes, reset to first page
        await loadCustomers({
            limit: newLimit,
            offset: 0
        });
    }, [loadCustomers]);

    // Combine all handlers
    const handlers = useMemo(() => ({
        onCustomerSelect,
        onProjectSelect,
        onTaskSelect,
        onTeamSelect,
        clearSelectedTask: clearSelectedTaskHandler,
        clearSelectedProject: clearSelectedProjectHandler,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleProjectStatusChange,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectDelete: onProjectDelete, // Use the new onProjectDelete handler
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        customers, // Add customers for marketing functionality
        selectedMarketingDomain,
        onMarketingDomainSelect: handleMarketingDomainSelect,
        pagination, // Add pagination metadata
        onCustomerPageChange: handleCustomerPageChange,
        onCustomerLimitChange: handleCustomerLimitChange
    }), [
        onCustomerSelect,
        onProjectSelect,
        onTaskSelect,
        onTeamSelect,
        clearSelectedTaskHandler,
        clearSelectedProjectHandler,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleProjectStatusChange,
        handleProjectCreate,
        handleProjectUpdate,
        onProjectDelete, // Use the new onProjectDelete handler
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        customers, // Add customers dependency
        selectedMarketingDomain,
        handleMarketingDomainSelect,
        pagination,
        handleCustomerPageChange,
        handleCustomerLimitChange
    ]);

    // Show SignIn component if not authenticated
    if (!appState.authentication.isAuthenticated) {
        return (
            <SignIn
                onSupabaseAuth={handleSupabaseAuth}
            />
        );
    }

    // Handle initialization states after authentication
    if (appState.error) {
        return (
            <div className="text-center text-red-600 p-4">
                Error: {appState.error}
            </div>
        );
    }

    if (globalLoadingState.isLoading) {
        return <Loading message={globalLoadingState.message} />;
    }

    // Combined error handling
    const error = customerError || projectError || taskError || teamError;
    if (error) {
        return (
            <div className="text-center text-red-600 p-4">
                Error: {error}
            </div>
        );
    }

    // Process customers data before passing to Sidebar
    const processedCustomers = customers.map(customer => ({
        id: customer.id || customer.fieldData?.__ID,
        recordId: customer.recordId, // Include recordId for FileMaker operations
        Name: customer.Name || customer.fieldData?.Name,
        Email: customer.Email || customer.fieldData?.Email,
        isActive: customer.isActive ?? (customer.fieldData?.f_active === "1" || customer.fieldData?.f_active === 1)
    }));

    // Process selected customer if exists
    const processedSelectedCustomer = appState.selectedCustomer ? {
        id: appState.selectedCustomer.id || appState.selectedCustomer.fieldData?.__ID,
        recordId: appState.selectedCustomer.recordId, // Include recordId for FileMaker operations
        Name: appState.selectedCustomer.Name || appState.selectedCustomer.fieldData?.Name,
        Email: appState.selectedCustomer.Email || appState.selectedCustomer.fieldData?.Email,
        isActive: appState.selectedCustomer.isActive ?? (appState.selectedCustomer.fieldData?.f_active === "1" || appState.selectedCustomer.fieldData?.f_active === 1)
    } : null;

    return (
        <ErrorBoundary>
            <AppLayout>
                <MemoizedSidebar
                    customers={processedCustomers}
                    teams={teams}
                    selectedCustomer={processedSelectedCustomer}
                    selectedTeam={appState.selectedTeam}
                    onCustomerSelect={handlers.onCustomerSelect}
                    onCustomerStatusToggle={handleCustomerStatusToggle}
                    onCustomerDelete={handleCustomerDelete}
                    onTeamSelect={onTeamSelect}
                    onTeamDelete={handleTeamDelete}
                    products={appState.products}
                    selectedProduct={appState.selectedProduct}
                    setShowProductForm={setShowProductForm}
                    customerStats={customers.length > 0 ? {
                        total: customers.length,
                        active: processedCustomers.filter(c => c.isActive).length,
                        inactive: processedCustomers.filter(c => !c.isActive).length,
                        activePercentage: Math.round((processedCustomers.filter(c => c.isActive).length / customers.length) * 100)
                    } : null}
                    selectedMarketingDomain={selectedMarketingDomain}
                    onMarketingDomainSelect={handleMarketingDomainSelect}
                    pagination={pagination}
                    onCustomerPageChange={handlers.onCustomerPageChange}
                    onCustomerLimitChange={handlers.onCustomerLimitChange}
                    customersLoading={appState.loading}
                />
                <MainContent
                    darkMode={darkMode}
                    selectedTask={selectedTask}
                    selectedProject={appState.selectedProject}
                    selectedCustomer={processedSelectedCustomer}
                    selectedTeam={appState.selectedTeam}
                    teamStaff={teamStaff}
                    teamProjects={teamProjects}
                    tasks={tasks}
                    taskStats={taskStats}
                    projectStats={projectStats}
                    teamStats={teamStats}
                    timer={timer}
                    handlers={handlers}
                    projects={projects}
                />
            </AppLayout>
        </ErrorBoundary>
    );
}

function App() {
    return <AppContent />;
}

export default App;
