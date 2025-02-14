import React, { useCallback } from 'react';
import Loading from './components/loading/Loading';
import AppLayout from './components/layout/AppLayout';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/MainContent';
import ErrorBoundary from './components/ErrorBoundary';
import { useTheme } from './components/layout/AppLayout';
import { useCustomer, useProject, useTask } from './hooks';

// Memoized sidebar
const MemoizedSidebar = React.memo(Sidebar);

function App() {
    const { darkMode } = useTheme();
    
    // Customer state and handlers
    const {
        loading: customerLoading,
        error: customerError,
        customers,
        selectedCustomer,
        stats: customerStats,
        handleCustomerSelect,
        handleCustomerStatusToggle
    } = useCustomer();

    // Project state and handlers
    const {
        loading: projectLoading,
        error: projectError,
        projects,
        selectedProject,
        stats: projectStats,
        handleProjectSelect,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectStatusChange,
        clearSelectedProject
    } = useProject(selectedCustomer?.id);

    // Task state and handlers
    const {
        loading: taskLoading,
        error: taskError,
        tasks,
        selectedTask,
        timer,
        stats: taskStats,
        handleTaskSelect,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        handleTimerStart,
        handleTimerStop,
        handleTimerPause,
        handleTimerAdjust,
        clearSelectedTask
    } = useTask(selectedProject?.id);

    // Memoized handlers
    const handlers = {
        onCustomerSelect: useCallback(async (customer) => {
            clearSelectedProject();
            clearSelectedTask();
            await handleCustomerSelect(customer.id);
        }, [clearSelectedProject, clearSelectedTask, handleCustomerSelect]),

        handleProjectSelect: useCallback(async (project) => {
            clearSelectedTask();
            await handleProjectSelect(project.id);
        }, [clearSelectedTask, handleProjectSelect]),

        clearSelectedTask,
        clearSelectedProject,
        handleTaskSelect,
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
    };

    // Loading state
    const isLoading = customerLoading || projectLoading || taskLoading;
    if (isLoading) {
        return <Loading message="Loading data, please wait" />;
    }

    // Error handling
    const error = customerError || projectError || taskError;
    if (error) {
        return (
            <div className="text-center text-red-600 p-4">
                Error: {error}
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <AppLayout>
                <MemoizedSidebar
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    onCustomerSelect={handlers.onCustomerSelect}
                    onCustomerStatusToggle={handleCustomerStatusToggle}
                    customerStats={customerStats}
                />
                <MainContent
                    darkMode={darkMode}
                    selectedTask={selectedTask}
                    selectedProject={selectedProject}
                    selectedCustomer={selectedCustomer}
                    tasks={tasks}
                    projects={projects}
                    taskStats={taskStats}
                    projectStats={projectStats}
                    timer={timer}
                    handlers={handlers}
                />
            </AppLayout>
        </ErrorBoundary>
    );
}

console.log("version 1.1.2");
export default App;
