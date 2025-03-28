import React, { useMemo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useSnackBar } from '../../context/SnackBarContext';
import TextInput from '../global/TextInput';

// Memoized staff card component
const StaffCard = React.memo(function StaffCard({
    staffMember,
    darkMode,
    onRemove
}) {
    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        onRemove(staffMember.id);
    }, [staffMember.id, onRemove]);

    return (
        <div
            className={`
                p-4 rounded-lg border
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'}
                transition-colors duration-150
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{staffMember.staffDetails?.name || 'Unknown Staff'}</h3>
                <button
                    onClick={handleRemove}
                    className={`
                        p-1 rounded-md
                        ${darkMode
                            ? 'text-gray-400 hover:bg-red-900 hover:text-white'
                            : 'text-gray-500 hover:bg-red-100 hover:text-red-700'}
                    `}
                    title="Remove from team"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div className="space-y-2">
                {staffMember.role && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Role: {staffMember.role}
                    </p>
                )}
            </div>
        </div>
    );
});

StaffCard.propTypes = {
    staffMember: PropTypes.shape({
        id: PropTypes.string.isRequired,
        role: PropTypes.string,
        staffDetails: PropTypes.shape({
            name: PropTypes.string,
            role: PropTypes.string
        })
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onRemove: PropTypes.func.isRequired
};

// Memoized project card component
const ProjectCard = React.memo(function ProjectCard({
    project,
    darkMode,
    onSelect,
    onRemove,
    setLoading
}) {
    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        onRemove(project.id);
    }, [project.id, onRemove]);

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
                <div className="flex items-center space-x-2">
                    <span className={`
                        px-2 py-1 text-sm rounded-full
                        ${project.status === 'Open'
                            ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                            : (darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800')}
                    `}>
                        {project.status}
                    </span>
                    <button
                        onClick={handleRemove}
                        className={`
                            p-1 rounded-md
                            ${darkMode
                                ? 'text-gray-400 hover:bg-red-900 hover:text-white'
                                : 'text-gray-500 hover:bg-red-100 hover:text-red-700'}
                        `}
                        title="Remove from team"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="space-y-2">
                {project.estOfTime && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Estimated Time: {project.estOfTime}
                    </p>
                )}
                
                <div className="flex space-x-4 text-sm">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {project.objectives?.length || 0} Objectives
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
        id: PropTypes.string.isRequired,
        projectName: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        estOfTime: PropTypes.string,
        objectives: PropTypes.array,
        tasks: PropTypes.array
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    setLoading: PropTypes.func.isRequired
};

function TeamDetails({
    team,
    staff = [],
    projects = [],
    onProjectSelect = () => {},
    onStaffRemove = () => {},
    onProjectRemove = () => {},
    onStaffAdd = () => {},
    onProjectAdd = () => {}
}) {
    const { darkMode } = useTheme();
    const { setLoading } = useAppStateOperations();
    const { showError } = useSnackBar();
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);

    // Calculate stats for display
    const stats = useMemo(() => {
        return {
            totalStaff: staff.length,
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'Open').length
        };
    }, [staff, projects]);

    // Handlers for adding staff and projects
    const handleAddStaff = useCallback(() => {
        setShowAddStaffModal(true);
    }, []);

    const handleAddProject = useCallback(() => {
        setShowAddProjectModal(true);
    }, []);

    return (
        <div className="space-y-6">
            {/* Team Header */}
            <div className={`
                border-b pb-4
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">{team.name}</h2>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={handleAddStaff}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            Add Staff
                        </button>
                        <button
                            onClick={handleAddProject}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            Add Project
                        </button>
                    </div>
                </div>

                {stats && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total Staff
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.totalStaff}
                            </div>
                        </div>
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total Projects
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.totalProjects}
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
                                {stats.activeProjects}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Staff Section */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Team Members</h3>
                {staff.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {staff.map(staffMember => (
                            <StaffCard
                                key={staffMember.id}
                                staffMember={staffMember}
                                darkMode={darkMode}
                                onRemove={onStaffRemove}
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
                        No staff members assigned to this team
                    </div>
                )}
            </div>

            {/* Projects Section */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Team Projects</h3>
                {projects.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                darkMode={darkMode}
                                onSelect={onProjectSelect}
                                onRemove={onProjectRemove}
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
                        No projects assigned to this team
                    </div>
                )}
            </div>

            {/* Add Staff Modal */}
            {showAddStaffModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`
                        p-6 rounded-lg max-w-md w-full mx-4
                        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                    `}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Add Staff to Team</h2>
                            <button
                                onClick={() => setShowAddStaffModal(false)}
                                className={`
                                    p-1 rounded-full
                                    ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
                                `}
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm mb-4">
                                Select staff members to add to this team. Staff selection functionality would be implemented here.
                            </p>
                            
                            {/* This would be replaced with actual staff selection UI */}
                            <div className="text-center py-8">
                                <button
                                    onClick={() => {
                                        // Mock implementation - in real app, would pass selected staff
                                        onStaffAdd();
                                        setShowAddStaffModal(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                                >
                                    Add Selected Staff
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowAddStaffModal(false)}
                                className={`
                                    px-4 py-2 rounded-md
                                    ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                                `}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Project Modal */}
            {showAddProjectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`
                        p-6 rounded-lg max-w-md w-full mx-4
                        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                    `}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Add Project to Team</h2>
                            <button
                                onClick={() => setShowAddProjectModal(false)}
                                className={`
                                    p-1 rounded-full
                                    ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
                                `}
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm mb-4">
                                Select a project to add to this team. Project selection functionality would be implemented here.
                            </p>
                            
                            {/* This would be replaced with actual project selection UI */}
                            <div className="text-center py-8">
                                <button
                                    onClick={() => {
                                        // Mock implementation - in real app, would pass selected project
                                        onProjectAdd();
                                        setShowAddProjectModal(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                                >
                                    Add Selected Project
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowAddProjectModal(false)}
                                className={`
                                    px-4 py-2 rounded-md
                                    ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                                `}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

TeamDetails.propTypes = {
    team: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    }).isRequired,
    staff: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            role: PropTypes.string,
            staffDetails: PropTypes.shape({
                name: PropTypes.string,
                role: PropTypes.string
            })
        })
    ),
    projects: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            projectName: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            estOfTime: PropTypes.string,
            objectives: PropTypes.array,
            tasks: PropTypes.array
        })
    ),
    onProjectSelect: PropTypes.func,
    onStaffRemove: PropTypes.func,
    onProjectRemove: PropTypes.func,
    onStaffAdd: PropTypes.func,
    onProjectAdd: PropTypes.func
};

export default React.memo(TeamDetails);