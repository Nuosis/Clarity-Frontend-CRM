import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import TaskTimer from './tasks/TaskTimer';
import ProjectDetails from './projects/ProjectDetails';
import CustomerDetails from './customers/CustomerDetails';
import FinancialActivity from './financial/FinancialActivity';
import ErrorBoundary from './ErrorBoundary';
import Loading from './loading/Loading';
import { useProject } from '../hooks/useProject';
import { useAppState } from '../context/AppStateContext';
import { useTheme } from './layout/AppLayout';
const MainContent = React.memo(function MainContent({
    selectedTask = null,
    selectedProject = null,
    selectedCustomer = null,
    tasks = [],
    projects = [],
    taskStats = null,
    projectStats = null,
    timer = null,
    loading = false,
    handlers
}) {
    const { handleProjectSelect } = useProject();
    const { showFinancialActivity } = useAppState();
    const { darkMode } = useTheme();

    // Memoized project selection handler
    const handleProjectSelection = useCallback((project) => {
        console.log('Project selection handler called in MainContent');
        handleProjectSelect(project);
        handlers.onProjectSelect(project);
    }, [handleProjectSelect, handlers.onProjectSelect]);
    // Show Financial Activity if selected
    if (showFinancialActivity) {
        return (
            <ErrorBoundary>
                <FinancialActivity darkMode={darkMode} />
            </ErrorBoundary>
        );
    }

    // Show Task details if selected
    if (selectedTask) {
        return (
            <ErrorBoundary onReset={handlers.clearSelectedTask}>
                <div className="space-y-6">
                    <button
                        onClick={handlers.clearSelectedTask}
                        className="text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                        ← Back to Project
                    </button>
                    {timer?.recordId && (
                        <TaskTimer
                            task={selectedTask}
                            timer={timer}
                            onStart={handlers.handleTimerStart}
                            onPause={handlers.handleTimerPause}
                            onStop={handlers.handleTimerStop}
                            onAdjust={handlers.handleTimerAdjust}
                        />
                    )}
                </div>
            </ErrorBoundary>
        );
    }

    if (selectedProject) {
        if (loading) {
            return <Loading message="Loading project details..." />;
        }
        return (
            <ErrorBoundary onReset={handlers.clearSelectedProject}>
                <ProjectDetails
                    projectId={selectedProject.id}
                    tasks={tasks}
                    stats={taskStats}
                    onTaskSelect={handlers.handleTaskSelect}
                    onStatusChange={handlers.handleProjectStatusChange}
                    onTaskCreate={handlers.handleTaskCreate}
                    onTaskUpdate={handlers.handleTaskUpdate}
                    onTaskStatusChange={handlers.handleTaskStatusChange}
                    onProjectUpdate={handlers.handleProjectUpdate}
                    onDelete={handlers.handleProjectDelete}
                    project={selectedProject}
                />
            </ErrorBoundary>
        );
    }

    if (selectedCustomer) {
        return (
            <ErrorBoundary>
                <CustomerDetails
                    customer={selectedCustomer}
                    projects={projects}
                    stats={projectStats}
                    onProjectSelect={handleProjectSelection}
                    onProjectCreate={handlers.handleProjectCreate}
                />
            </ErrorBoundary>
        );
    }

    return (
        <div className="text-center text-gray-500 dark:text-gray-400">
            Select a customer to view details
        </div>
    );
});

MainContent.propTypes = {
    // Selected items
    selectedTask: PropTypes.shape({
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        type: PropTypes.string,
        description: PropTypes.string,
        isCompleted: PropTypes.bool.isRequired,
        createdAt: PropTypes.string,
        modifiedAt: PropTypes.string.isRequired
    }),
    selectedProject: PropTypes.shape({
        id: PropTypes.string.isRequired,
        projectName: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        estOfTime: PropTypes.string,
        createdAt: PropTypes.string.isRequired,
        modifiedAt: PropTypes.string.isRequired,
        images: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            title: PropTypes.string
        })),
        links: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            title: PropTypes.string
        })),
        objectives: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            objective: PropTypes.string.isRequired,
            completed: PropTypes.bool.isRequired,
            steps: PropTypes.arrayOf(PropTypes.shape({
                id: PropTypes.string.isRequired,
                step: PropTypes.string.isRequired,
                completed: PropTypes.bool.isRequired
            }))
        }))
    }),
    selectedCustomer: PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        Phone: PropTypes.string,
        isActive: PropTypes.bool,
        createdAt: PropTypes.string,
        modifiedAt: PropTypes.string
    }),
    
    // Lists
    tasks: PropTypes.arrayOf(PropTypes.object),
    projects: PropTypes.arrayOf(PropTypes.object),
    
    // Statistics
    taskStats: PropTypes.shape({
        total: PropTypes.number.isRequired,
        active: PropTypes.number.isRequired,
        completed: PropTypes.number.isRequired,
        completionRate: PropTypes.number.isRequired,
        totalTimeSpent: PropTypes.string.isRequired,
        averageTimePerTask: PropTypes.string.isRequired
    }),
    projectStats: PropTypes.shape({
        total: PropTypes.number.isRequired,
        open: PropTypes.number.isRequired,
        closed: PropTypes.number.isRequired,
        averageCompletion: PropTypes.number.isRequired
    }),
    
    // Timer
    timer: PropTypes.shape({
        recordId: PropTypes.string,
        TimeStart: PropTypes.string,
        isPaused: PropTypes.bool,
        adjustment: PropTypes.number,
        pauseStartTime: PropTypes.instanceOf(Date),
        totalPauseTime: PropTypes.number
    }),
    
    // Loading state
    loading: PropTypes.bool,
    
    // Handlers
    handlers: PropTypes.shape({
        clearSelectedTask: PropTypes.func.isRequired,
        clearSelectedProject: PropTypes.func.isRequired,
        handleTaskSelect: PropTypes.func,
        handleTaskCreate: PropTypes.func.isRequired,
        handleTaskUpdate: PropTypes.func.isRequired,
        handleTaskStatusChange: PropTypes.func.isRequired,
        handleProjectStatusChange: PropTypes.func.isRequired,
        handleProjectCreate: PropTypes.func.isRequired,
        handleProjectUpdate: PropTypes.func.isRequired,
        handleProjectDelete: PropTypes.func.isRequired,
        handleTimerStart: PropTypes.func.isRequired,
        handleTimerStop: PropTypes.func.isRequired,
        handleTimerPause: PropTypes.func.isRequired,
        handleTimerAdjust: PropTypes.func.isRequired
    }).isRequired
};

export default MainContent;