import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useSnackBar } from '../../context/SnackBarContext';
import { useTeamContext } from '../../context/TeamContext';
import ProjectList from '../projects/ProjectList';

// Log when the module is loaded
console.log('[TeamDetails] Module loaded');

// Memoized staff card component
const StaffCard = React.memo(function StaffCard({
    staffMember,
    darkMode,
    onRemove
}) {
    console.log('[StaffCard] Rendering for staff member:', staffMember?.id);
    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        onRemove(staffMember.recordId || staffMember.id, staffMember);
    }, [staffMember, staffMember.recordId, staffMember.id, onRemove]);

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
        recordId: PropTypes.string,
        role: PropTypes.string,
        staffDetails: PropTypes.shape({
            name: PropTypes.string,
            role: PropTypes.string
        })
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onRemove: PropTypes.func.isRequired
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
    console.log('[TeamDetails] Rendering with team:', team?.id, 'staff count:', staff?.length);
    
    const { darkMode } = useTheme();
    const { setLoading } = useAppStateOperations();
    const { showError } = useSnackBar();
    
    // Use TeamContext instead of props
    console.log('[TeamDetails] Using team data and functions from TeamContext');
    const { allStaff, loadAllStaff } = useTeamContext();
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState([]);
    const [existingStaffIds, setExistingStaffIds] = useState([]);
    
    // Local state to track team members for optimistic updates
    const [localStaff, setLocalStaff] = useState(staff);
    
    // Track if we're in the middle of an optimistic update
    const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);
    
    // Update local staff when prop changes, but only if not in the middle of an optimistic update
    useEffect(() => {
        if (!isOptimisticUpdate) {
            setLocalStaff(staff);
        }
    }, [staff, isOptimisticUpdate]);
    
    // Handle staff removal with optimistic update
    const handleStaffRemove = useCallback((teamMemberId, staffMember) => {
        // Set the optimistic update flag
        setIsOptimisticUpdate(true);
        
        // Optimistically update the UI by removing the staff member from local state
        setLocalStaff(prevStaff => prevStaff.filter(member => {
            if (member.recordId) {
                return member.recordId !== teamMemberId;
            }
            return member.id !== teamMemberId;
        }));
        
        // Call the actual remove function
        onStaffRemove(teamMemberId)
            .then(() => {
                // Reset the optimistic update flag after a short delay
                setTimeout(() => {
                    setIsOptimisticUpdate(false);
                }, 500);
            })
            .catch(() => {
                // If there's an error, reset the optimistic update flag
                setIsOptimisticUpdate(false);
            });
    }, [onStaffRemove, setIsOptimisticUpdate]);

    // Calculate stats for display
    const stats = useMemo(() => {
        return {
            totalStaff: localStaff.length,
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'Open').length
        };
    }, [localStaff, projects]);

    // Handlers for adding staff and projects
    const handleAddStaff = useCallback(() => {
        console.log('[TeamDetails] handleAddStaff called, using loadAllStaff from props');
        // Load all staff members when opening the modal
        loadAllStaff()
            .then(() => {
                // Pre-select staff members who are already part of the team
                if (staff && staff.length > 0 && allStaff && allStaff.length > 0) {
                    // Extract staff IDs from current team staff
                    const currentStaffIds = staff.map(teamMember => {
                        // Staff ID could be in different places depending on the data structure
                        const staffId = teamMember.staffId ||
                            (teamMember.staffDetails && teamMember.staffDetails.id) ||
                            (teamMember.staffDetails && teamMember.staffDetails.__ID) ||
                            teamMember.id;
                        
                        return staffId;
                    }).filter(id => id); // Filter out any undefined IDs
                    
                    // Set both selected and existing staff IDs
                    setSelectedStaffIds(currentStaffIds);
                    setExistingStaffIds(currentStaffIds);
                } else {
                    setSelectedStaffIds([]); // Reset if no staff
                    setExistingStaffIds([]);
                }
                
                setShowAddStaffModal(true);
            })
            .catch(err => {
                showError('Failed to load staff members');
                console.error('Error loading staff:', err);
                setShowAddStaffModal(true);
            });
    }, [loadAllStaff, showError, staff, allStaff]);

    
    // Handle staff selection
    const handleStaffSelection = useCallback((staffId) => {
        setSelectedStaffIds(prev => {
            // If already selected, remove it; otherwise, add it
            if (prev.includes(staffId)) {
                return prev.filter(id => id !== staffId);
            } else {
                return [...prev, staffId];
            }
        });
    }, []);
    
    // Handle adding selected staff to team
    const handleAddSelectedStaff = useCallback(async () => {
        if (selectedStaffIds.length === 0) {
            showError('Please select at least one staff member');
            return;
        }
        
        try {
            // Extract staff IDs from current team staff
            const currentStaffIds = localStaff.map(teamMember => {
                if (teamMember.staffId) return teamMember.staffId;
                if (teamMember.staffDetails && teamMember.staffDetails.id) return teamMember.staffDetails.id;
                if (teamMember.staffDetails && teamMember.staffDetails.__ID) return teamMember.staffDetails.__ID;
                return teamMember.id;
            }).filter(id => id);
            
            // Filter out staff members who are already part of the team
            const newStaffIds = selectedStaffIds.filter(id => !currentStaffIds.includes(id));
            
            if (newStaffIds.length === 0) {
                showError('All selected staff members are already part of the team');
                return;
            }
            
            // Get the team ID
            const teamId = team.id || team.recordId || (team.fieldData && team.fieldData.__ID);
            if (!teamId) {
                throw new Error('Invalid team ID in team prop');
            }
            
            // Create an array of staff objects with their details
            const staffToAdd = newStaffIds.map(staffId => {
                // Find the staff member in allStaff
                const staffMember = allStaff.find(s => {
                    const fieldData = s.fieldData || s;
                    return (
                        s.id === staffId ||
                        fieldData.__ID === staffId ||
                        fieldData.id === staffId
                    );
                });
                
                if (!staffMember) {
                    return { id: staffId, role: '' };
                }
                
                const fieldData = staffMember.fieldData || staffMember;
                return {
                    id: staffId,
                    name: fieldData.name || staffMember.name || 'Unknown Staff',
                    role: fieldData.role || staffMember.role || ''
                };
            });
            
            // Create optimistic team member objects to update UI immediately
            const optimisticTeamMembers = staffToAdd.map(staffItem => {
                // Create a team member object that matches the structure expected by the UI
                return {
                    id: `temp-${staffItem.id}-${Date.now()}`, // Temporary ID that will be replaced when the server responds
                    staffId: staffItem.id,
                    role: staffItem.role || '',
                    staffDetails: {
                        id: staffItem.id,
                        name: staffItem.name || 'Unknown Staff',
                        role: staffItem.role || ''
                    }
                };
            });
            
            // Set the optimistic update flag
            setIsOptimisticUpdate(true);
            
            // Update local state optimistically
            setLocalStaff(prevStaff => [...prevStaff, ...optimisticTeamMembers]);
            
            // Call the onStaffAdd function with the staff details
            setLoading(true);
            
            // Close the modal immediately for better UX
            setShowAddStaffModal(false);
            
            try {
                const result = await onStaffAdd(staffToAdd, teamId);
                
                // Reset the optimistic update flag after a short delay
                setTimeout(() => {
                    setIsOptimisticUpdate(false);
                }, 500);
                
                return result;
            } catch (error) {
                // If there's an error, reset the optimistic update flag
                setIsOptimisticUpdate(false);
                throw error;
            }
        } catch (error) {
            console.error('Error adding staff to team:', error);
            // Reset the optimistic update flag
            setIsOptimisticUpdate(false);
            
            // Provide more specific error message based on the error
            if (error.message === 'No team selected') {
                showError('Failed to add staff: No team selected. Please try selecting the team again.');
            } else if (error.message === 'Team selection failed') {
                showError('Failed to add staff: Team selection process failed. Please refresh and try again.');
            } else if (error.message === 'No team available') {
                showError('Failed to add staff: No team available. Please try selecting the team again.');
            } else if (error.message === 'Invalid team ID') {
                showError('Failed to add staff: Invalid team ID. Please refresh and try again.');
            } else {
                showError(`Failed to add staff to team: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [selectedStaffIds, onStaffAdd, showError, setLoading, staff, team, allStaff, setIsOptimisticUpdate]);

    // Check if team is defined before rendering
    if (!team) {
        console.log('[TeamDetails] Early return - no team provided');
        return (
            <div className="p-4 text-center">
                <p className="text-gray-500">Select a team to view details</p>
            </div>
        );
    }
    
    console.log('[TeamDetails] Rendering main component with team:', team.id);
    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
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
                <h3 className="text-lg font-semibold mb-4">Team Members ({localStaff.length})</h3>
                {localStaff.length > 0 ? (
                    <div className="max-h-[300px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            {localStaff.map(staffMember => {
                                return (
                                    <StaffCard
                                        key={staffMember.id}
                                        staffMember={staffMember}
                                        darkMode={darkMode}
                                        onRemove={handleStaffRemove}
                                    />
                                );
                            })}
                        </div>
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
                <h3 className="text-lg font-semibold mb-4">Team Projects ({projects.length})</h3>
                <ProjectList
                    projects={projects}
                    onProjectSelect={onProjectSelect}
                    onProjectRemove={onProjectRemove}
                    maxHeight="400px"
                />
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
                                Select staff members to add to this team.
                            </p>
                            
                            {/* Staff selection UI */}
                            <div className={`
                                border rounded-md p-3 mb-4 max-h-[200px] overflow-y-auto
                                ${darkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-300 bg-gray-50'}
                            `}>
                                {allStaff.length > 0 ? (
                                    allStaff.map(staffMember => {
                                        // Extract data from fieldData if present
                                        const fieldData = staffMember.fieldData || staffMember;
                                        const staffId = fieldData.__ID || staffMember.id || staffMember.recordId;
                                        const staffName = fieldData.name || staffMember.name || 'Unnamed Staff';
                                        const staffRole = fieldData.role || staffMember.role || '';
                                        
                                        return (
                                            <div key={staffId} className={`
                                                flex items-center mb-2 last:mb-0 p-1 rounded
                                                ${selectedStaffIds.includes(staffId) ?
                                                    (darkMode ? 'bg-gray-600' : 'bg-blue-50') : ''}
                                            `}>
                                                <input
                                                    type="checkbox"
                                                    id={`staff-${staffId}`}
                                                    checked={selectedStaffIds.includes(staffId)}
                                                    onChange={() => handleStaffSelection(staffId)}
                                                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                                                />
                                                <label
                                                    htmlFor={`staff-${staffId}`}
                                                    className="text-sm flex-1"
                                                >
                                                    {staffName}
                                                    {staffRole && ` (${staffRole})`}
                                                    
                                                    {existingStaffIds.includes(staffId) && (
                                                        <span className={`ml-2 text-xs ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                                                            Already in team
                                                        </span>
                                                    )}
                                                </label>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 text-sm text-gray-500">
                                        Loading staff members...
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowAddStaffModal(false)}
                                className={`
                                    px-4 py-2 rounded-md
                                    ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                                `}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSelectedStaff}
                                disabled={selectedStaffIds.length === 0}
                                className={`
                                    px-4 py-2 text-white rounded-md
                                    ${selectedStaffIds.length === 0
                                        ? 'bg-blue-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'}
                                `}
                            >
                                Add Selected Staff
                                {selectedStaffIds.length > 0 && ` (${selectedStaffIds.length})`}
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