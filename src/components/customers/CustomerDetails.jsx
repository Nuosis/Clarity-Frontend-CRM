import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useProject } from '../../hooks/useProject';
import { calculateRecordsUnbilledHours } from '../../services/projectService';

// Memoized project card component
const ProjectCard = React.memo(function ProjectCard({
    project,
    darkMode,
    onSelect,
    setLoading
}) {
    const completion = useMemo(() => {
        const totalSteps = project.objectives.reduce(
            (total, obj) => total + obj.steps.length,
            0
        );
        
        if (totalSteps === 0) return 0;

        const completedSteps = project.objectives.reduce(
            (total, obj) => total + obj.steps.filter(step => step.completed).length,
            0
        );

        return Math.round((completedSteps / totalSteps) * 100);
    }, [project.objectives]);

    return (
        <div
            onClick={(e) => {
                setLoading(true);
                onSelect(project);
            }}
            className={`
                p-4 rounded-lg border cursor-pointer
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                transition-colors duration-150
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{project.projectName}</h3>
                <span className={`
                    px-2 py-1 text-sm rounded-full
                    ${project.status === 'Open'
                        ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                        : (darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800')}
                `}>
                    {project.status}
                </span>
            </div>
            
            <div className="space-y-2">
                {project.estOfTime && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Estimated Time: {project.estOfTime}
                    </p>
                )}
                
                <div className="flex items-center space-x-4">
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Completion: {completion}%
                    </div>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-bg-[#004967] rounded-full"
                            style={{ width: `${completion}%` }}
                        />
                    </div>
                </div>

                <div className="flex space-x-4 text-sm">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {project.objectives.length} Objectives
                    </span>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {project.tasks?.length || 0} Tasks
                    </span>
                </div>
            </div>
        </div>
    );
});

ProjectCard.propTypes = {
    project: PropTypes.shape({
        projectName: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        estOfTime: PropTypes.string,
        objectives: PropTypes.arrayOf(PropTypes.shape({
            steps: PropTypes.arrayOf(PropTypes.shape({
                completed: PropTypes.bool.isRequired
            })).isRequired
        })).isRequired,
        tasks: PropTypes.array
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    setLoading: PropTypes.func.isRequired
};

function CustomerDetails({
    customer,
    projects = [],
    onProjectSelect = () => {},
    onProjectCreate = () => {}
}) {
    const { darkMode } = useTheme();
    const { setLoading } = useAppStateOperations();
    const { projectRecords } = useProject();

    // Calculate stats for display
    const stats = useMemo(() => {
        if (!projects || !projectRecords) return null;
        
        const activeProjects = projects.filter(p => p.status === 'Open');
        return {
            total: projects.length,
            open: activeProjects.length,
            unbilledHours: calculateRecordsUnbilledHours(projectRecords)
        };
    }, [projects, projectRecords]);

    // Memoized project grouping with error handling
    const { activeProjects, closedProjects, groupingError } = useMemo(() => {
        try {
            const result = projects.reduce((acc, project) => {
                if (!project || !project.status) {
                    throw new Error('Invalid project data');
                }
                
                if (project.status === 'Open') {
                    acc.activeProjects.push(project);
                } else {
                    acc.closedProjects.push(project);
                }
                return acc;
            }, { activeProjects: [], closedProjects: [] });
            
            return { ...result, groupingError: null };
        } catch (error) {
            console.error('Error grouping projects:', error);
            return {
                activeProjects: [],
                closedProjects: [],
                groupingError: error.message
            };
        }
    }, [projects]);

    // Memoized handlers
    const handleProjectCreate = useCallback(() => {
        onProjectCreate({
            customerId: customer.id,
            customerName: customer.Name
        });
    }, [customer, onProjectCreate]);

    return (
        <div className="space-y-6">
            {/* Customer Header */}
            <div className={`
                border-b pb-4
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">{customer.Name}</h2>
                        <div className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {customer.Email && (
                                <span className="mr-4">
                                    {customer.Email}
                                </span>
                            )}
                            {customer.Phone && (
                                <span>{customer.Phone}</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleProjectCreate}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                    >
                        New Project
                    </button>
                </div>

                {stats && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total Projects
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.total}
                            </div>
                        </div>
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Active Projects
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.open}
                            </div>
                        </div>
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Unbilled Hours
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.unbilledHours} hrs
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Display */}
            {groupingError && (
                <div className={`
                    p-4 mb-6 rounded-lg border
                    ${darkMode
                        ? 'bg-red-900/20 border-red-800 text-red-200'
                        : 'bg-red-50 border-red-200 text-red-800'}
                `}>
                    <div className="font-medium">Error loading projects:</div>
                    <div className="text-sm mt-1">{groupingError}</div>
                </div>
            )}

            {/* Active Projects */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Active Projects</h3>
                {!groupingError && activeProjects.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {activeProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                darkMode={darkMode}
                                onSelect={onProjectSelect}
                                setLoading={setLoading}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={`
                        text-center py-8 rounded-lg border
                        ${darkMode 
                            ? 'bg-gray-800 border-gray-700 text-gray-400' 
                            : 'bg-gray-50 border-gray-200 text-gray-500'}
                    `}>
                        No active projects
                    </div>
                )}
            </div>

            {/* Closed Projects */}
            {closedProjects.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Closed Projects</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {closedProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                darkMode={darkMode}
                                onSelect={onProjectSelect}
                                setLoading={setLoading}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

CustomerDetails.propTypes = {
    customer: PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        Phone: PropTypes.string
    }).isRequired,
    projects: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            projectName: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            estOfTime: PropTypes.string,
            objectives: PropTypes.array.isRequired,
            tasks: PropTypes.array
        })
    ),
    onProjectSelect: PropTypes.func,
    onProjectCreate: PropTypes.func
};

export default React.memo(CustomerDetails);