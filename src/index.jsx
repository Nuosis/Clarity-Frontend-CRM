import React, { useEffect, useMemo, useCallback } from 'react';
import Loading from './components/loading/Loading';
import AppLayout, { ThemeProvider } from './components/layout/AppLayout';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/MainContent';
import ErrorBoundary from './components/ErrorBoundary';
import { useTheme } from './components/layout/AppLayout';
import { useCustomer, useProject, useTask, useFileMakerBridge } from './hooks';
import { initializationService } from './services/initializationService';
import { loadingStateManager, useGlobalLoadingState } from './services/loadingStateManager';
import { AppStateProvider, useAppState, useAppStateOperations } from './context/AppStateContext';
import { ProjectProvider } from './context/ProjectContext';
import { calculateProjectDetailStats } from './services/projectService';

// Memoized sidebar for performance
const MemoizedSidebar = React.memo(Sidebar);

function AppContent() {
    const { darkMode } = useTheme();
    const { isReady: fmReady, error: fmError, status: fmStatus } = useFileMakerBridge();
    const appState = useAppState();
    const { 
        setLoading, 
        setError, 
        setUser, 
        setSelectedCustomer,
        setSelectedProject,
        setSelectedTask,
        resetState
    } = useAppStateOperations();
    const globalLoadingState = useGlobalLoadingState();

    const {
        customers,
        error: customerError,
        handleCustomerSelect,
        handleCustomerStatusToggle,
        handleCustomerDelete,
        loadCustomers
    } = useCustomer();

    // Project state and handlers
    const {
        projects,
        error: projectError,
        stats: projectStats,
        handleProjectSelect,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectStatusChange,
        clearSelectedProject,
        loadProjectDetails,
        projectRecords
    } = useProject(appState.selectedCustomer?.id);

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

    // Initialization effect
    useEffect(() => {
        let isInitialized = false;
        
        const initialize = async () => {
            // Skip if already initialized
            if (isInitialized) {
                console.log('[App] Skipping initialization - already initialized');
                return;
            }
            
            try {
                console.log('[App] Starting initialization');
                loadingStateManager.setLoading('initialization', true, 'Connecting to FileMaker...');
                
                // Wait for FileMaker connection
                await initializationService.waitForFileMaker(() => fmReady);
                
                loadingStateManager.setLoading('initialization', true, 'Loading user context...');
                const userContext = await initializationService.loadUserContext();
                setUser(userContext);
                
                loadingStateManager.setLoading('initialization', true, 'Loading initial data...');
                await initializationService.preloadData(loadCustomers);
                
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

        if (fmReady) {
            initialize();
        }
    }, [fmReady, loadCustomers, setError, setLoading, setUser]);

    // Memoized handlers using useCallback
    const onCustomerSelect = useCallback(async (customer) => {
        clearSelectedProject();
        clearSelectedTask();
        await handleCustomerSelect(customer.id);
        setSelectedCustomer(customer);
    }, [clearSelectedProject, clearSelectedTask, handleCustomerSelect, setSelectedCustomer]);

    const onProjectSelect = useCallback(async (project) => {
        clearSelectedTask();
        try {
            // Load project details including images, links, objectives, steps, and notes
            console.log("Loading project details for project:", project);
            const details = await loadProjectDetails(project.__ID);
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
                records: projectRecords ? projectRecords.filter(r => r.fieldData._projectID === project.__ID) : [],
                stats: {
                    totalHours: stats.totalHours,
                    unbilledHours: stats.unbilledHours,
                    completion: stats.completion
                }
            };
            console.log("Complete project object:", completeProject);
            setSelectedProject(completeProject);
        } catch (error) {
            console.error('Error selecting project:', error);
        }
    }, [clearSelectedTask, loadProjectDetails, projectRecords, setSelectedProject, calculateProjectDetailStats]);

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

    // Combine all handlers
    const handlers = useMemo(() => ({
        onCustomerSelect,
        onProjectSelect,
        onTaskSelect,
        clearSelectedTask: clearSelectedTaskHandler,
        clearSelectedProject: clearSelectedProjectHandler,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleProjectStatusChange,
        handleProjectCreate,
        handleProjectUpdate,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust
    }), [
        onCustomerSelect,
        onProjectSelect,
        onTaskSelect,
        clearSelectedTaskHandler,
        clearSelectedProjectHandler,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleProjectStatusChange,
        handleProjectCreate,
        handleProjectUpdate,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust
    ]);

    // Handle initialization states
    if (!fmReady) {
        return (
            <div className="text-center p-4">
                <div className="text-bg-[#004967] mb-2">{fmStatus}</div>
                {fmError && (
                    <div className="text-red-600">
                        Connection Error: {fmError}
                    </div>
                )}
            </div>
        );
    }

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
    const error = customerError || projectError || taskError;
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
                    selectedCustomer={processedSelectedCustomer}
                    onCustomerSelect={handlers.onCustomerSelect}
                    onCustomerStatusToggle={handleCustomerStatusToggle}
                    onCustomerDelete={handleCustomerDelete}
                    customerStats={customers.length > 0 ? {
                        total: customers.length,
                        active: processedCustomers.filter(c => c.isActive).length,
                        inactive: processedCustomers.filter(c => !c.isActive).length,
                        activePercentage: Math.round((processedCustomers.filter(c => c.isActive).length / customers.length) * 100)
                    } : null}
                />
                <MainContent
                    darkMode={darkMode}
                    selectedTask={selectedTask}
                    selectedProject={appState.selectedProject}
                    selectedCustomer={processedSelectedCustomer}
                    tasks={tasks}
                    taskStats={taskStats}
                    projectStats={projectStats}
                    timer={timer}
                    handlers={handlers}
                    projects={projects}
                />
            </AppLayout>
        </ErrorBoundary>
    );
}

function App() {
    return (
        <ThemeProvider>
            <AppStateProvider>
                <ProjectProvider>
                    <AppContent />
                </ProjectProvider>
            </AppStateProvider>
        </ThemeProvider>
    );
}

export default App;
