import { useState, useCallback, useEffect } from 'react';
import {
    fetchTeams,
    fetchTeamById,
    fetchTeamStaff,
    fetchTeamProjects,
    createTeam,
    updateTeam,
    deleteTeam,
    assignStaffToTeam,
    removeStaffFromTeam,
    assignProjectToTeam,
    removeProjectFromTeam,
    fetchAllStaff
} from '../api';
import {
    processTeamData,
    processStaffData,
    processTeamMemberData,
    calculateTeamStats
} from '../services';

/**
 * Hook for managing team state and operations
 */
export function useTeam() {
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamStaff, setTeamStaff] = useState([]);
    const [teamProjects, setTeamProjects] = useState([]);
    const [allStaff, setAllStaff] = useState([]);
    const [stats, setStats] = useState(null);

    // Update stats when team staff or projects change
    useEffect(() => {
        if (selectedTeam) {
            setStats(calculateTeamStats(teamStaff, teamProjects));
        }
    }, [selectedTeam, teamStaff, teamProjects]);
    
    // Log when teamStaff changes
    useEffect(() => {
        console.log('[useTeam] teamStaff changed:', teamStaff);
    }, [teamStaff]);

    /**
     * Loads all teams
     */
    const loadTeams = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchTeams();
            
            
            // Handle both array and object responses
            let processedTeams = [];
            if (result && result.response && Array.isArray(result.response.data)) {
                // Handle FileMaker API response format
                processedTeams = result.response.data.map(team => {
                    // Make sure each team has an id property
                    const fieldData = team.fieldData || {};
                    const processed = processTeamData({
                        ...team,
                        __ID: fieldData.__ID || team.__ID,
                        name: fieldData.name || team.name,
                        recordId: team.recordId
                    });
                    return processed;
                });
            } else if (Array.isArray(result)) {
                processedTeams = result.map(team => {
                    const processed = processTeamData(team);
                    return processed;
                });
            } else if (result && typeof result === 'object') {
                // If it's a single object, wrap it in an array
                const processed = processTeamData(result);
                processedTeams = [processed];
            } else {
                console.warn('Unexpected result format from fetchTeams:', result);
                // Return empty array as fallback
                processedTeams = [];
            }
            
            setTeams(processedTeams);
        } catch (err) {
            setError(err.message);
            console.error('Error loading teams:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Loads all staff members
     */
    const loadAllStaff = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchAllStaff();
            
            // Handle FileMaker API response structure
            let processedStaff = [];
            if (result && result.response && Array.isArray(result.response.data)) {
                // Extract staff data from FileMaker response structure
                processedStaff = result.response.data.map(staff => {
                    const processed = processStaffData(staff);
                    return processed;
                });
            } else if (Array.isArray(result)) {
                processedStaff = result.map(processStaffData);
            } else if (result && typeof result === 'object') {
                // If it's a single object, wrap it in an array
                processedStaff = [processStaffData(result)];
            } else {
                console.warn('Unexpected result format from fetchAllStaff:', result);
                // Return empty array as fallback
                processedStaff = [];
            }
            
            // Make sure we have at least some staff data
            if (processedStaff.length === 0) {
                console.warn('No staff data found, trying a different approach...');
                // Try a different approach if the first one didn't work
                try {
                    const backupResult = await fetchAllStaff();
                    
                    if (backupResult && Array.isArray(backupResult)) {
                        processedStaff = backupResult.map(processStaffData);
                    }
                } catch (backupErr) {
                    console.error('Error in backup staff fetch:', backupErr);
                }
            }
            
            setAllStaff(processedStaff);
            
            // Return the processed staff so it can be used immediately
            return processedStaff;
        } catch (err) {
            setError(err.message);
            console.error('Error loading all staff:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Selects a team and loads its staff and projects
     * Returns the processed team data
     */
    const handleTeamSelect = useCallback(async (teamId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Fetch team details
            const teamResult = await fetchTeamById(teamId);
            if (teamResult.response) {
                if (teamResult.response.data) {
                    if (teamResult.response.data.length > 0) {
                    }
                }
            }
            
            // Handle both array and object responses
            let processedTeam;
            if (teamResult && teamResult.response && Array.isArray(teamResult.response.data) && teamResult.response.data.length > 0) {
                processedTeam = processTeamData(teamResult.response.data[0]);
            } else if (Array.isArray(teamResult) && teamResult.length > 0) {
                processedTeam = processTeamData(teamResult[0]);
            } else if (teamResult && typeof teamResult === 'object') {
                processedTeam = processTeamData(teamResult);
            } else {
                console.warn('Unexpected result format from fetchTeamById:', teamResult);
                throw new Error('Team not found');
            }
            
            setSelectedTeam(processedTeam);
            
            // Fetch team staff
            const staffResult = await fetchTeamStaff(teamId);
            if (staffResult.response) {
            }
            
            let processedStaff = [];
            if (staffResult && staffResult.response && Array.isArray(staffResult.response.data)) {
                processedStaff = staffResult.response.data.map(staff => {
                    // Ensure recordId is preserved
                    const staffWithRecordId = {
                        ...staff,
                        recordId: staff.recordId
                    };
                    const processed = processTeamMemberData(staffWithRecordId);
                    return processed;
                });
            } else if (Array.isArray(staffResult)) {
                processedStaff = staffResult.map(staff => {
                    // Ensure recordId is preserved
                    const staffWithRecordId = {
                        ...staff,
                        recordId: staff.recordId
                    };
                    const processed = processTeamMemberData(staffWithRecordId);
                    return processed;
                });
            }
            
            // Clear previous team staff before setting new ones
            setTeamStaff(processedStaff);
            
            // Fetch team projects
            const projectsResult = await fetchTeamProjects(teamId);
            if (projectsResult.response) {
            }
            
            let processedProjects = [];
            if (projectsResult && projectsResult.response && Array.isArray(projectsResult.response.data)) {
                // Process each project to ensure it has an id property
                processedProjects = projectsResult.response.data.map(project => {
                    // Make sure each project has an id property
                    const fieldData = project.fieldData || {};
                    return {
                        ...project,
                        id: fieldData.__ID || project.__ID || project.id || project.recordId,
                        projectName: fieldData.projectName || project.projectName || 'Unnamed Project',
                        status: fieldData.status || project.status || 'Unknown'
                    };
                });
            } else if (Array.isArray(projectsResult)) {
                // Process each project to ensure it has an id property
                processedProjects = projectsResult.map(project => {
                    // Make sure each project has an id property
                    const fieldData = project.fieldData || {};
                    return {
                        ...project,
                        id: fieldData.__ID || project.__ID || project.id || project.recordId,
                        projectName: fieldData.projectName || project.projectName || 'Unnamed Project',
                        status: fieldData.status || project.status || 'Unknown'
                    };
                });
            }
            
            setTeamProjects(processedProjects);
            
            // Return the processed team data and staff so they can be used immediately
            return {
                team: processedTeam,
                staff: processedStaff,
                projects: processedProjects
            };
            
        } catch (err) {
            setError(err.message);
            console.error('Error selecting team:', err);
            throw err; // Re-throw to allow error handling in the caller
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Creates a new team
     */
    const handleTeamCreate = useCallback(async (teamData) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await createTeam(teamData);
            const processedTeam = processTeamData(result);
            
            // Update local state
            setTeams(prevTeams => [...prevTeams, processedTeam]);
            
            return processedTeam;
        } catch (err) {
            setError(err.message);
            console.error('Error creating team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Updates an existing team
     */
    const handleTeamUpdate = useCallback(async (teamId, teamData) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await updateTeam(teamId, teamData);
            const processedTeam = processTeamData(result);
            
            // Update local state
            setTeams(prevTeams => 
                prevTeams.map(team => 
                    team.id === teamId
                        ? processedTeam
                        : team
                )
            );
            
            // Update selected team if it's the one being updated
            if (selectedTeam?.id === teamId) {
                setSelectedTeam(processedTeam);
            }
            
            return processedTeam;
        } catch (err) {
            setError(err.message);
            console.error('Error updating team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTeam]);

    /**
     * Deletes a team
     */
    const handleTeamDelete = useCallback(async (teamId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await deleteTeam(teamId);
            
            // Update local state
            setTeams(prevTeams => prevTeams.filter(team => team.id !== teamId));
            
            // Clear selected team if it's the one being deleted
            if (selectedTeam?.id === teamId) {
                setSelectedTeam(null);
                setTeamStaff([]);
                setTeamProjects([]);
                setStats(null);
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error deleting team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTeam]);

    /**
     * Assigns staff members to the selected team
     * Handles both single staff ID and arrays of staff IDs
     * @param {string|string[]} staffIds - Single staff ID or array of staff IDs
     * @param {string} role - Role for the staff member(s)
     * @param {Object} teamOverride - Optional team object to use instead of selectedTeam
     */
    const handleAssignStaffToTeam = useCallback(async (staffIds, role = '', teamOverride = null) => {
        // Use teamOverride if provided, otherwise use selectedTeam
        const effectiveTeam = teamOverride || selectedTeam;
        
        if (!effectiveTeam) {
            console.error('No team selected when trying to assign staff member');
            throw new Error('No team selected');
        }
        
        try {
            setLoading(true);
            setError(null);
            
            // Handle both single ID and array of IDs
            const staffIdArray = Array.isArray(staffIds) ? staffIds : [staffIds];
            
            // Get the team ID from the team object
            const teamId = effectiveTeam.id ||
                          (effectiveTeam.fieldData && effectiveTeam.fieldData.__ID) ||
                          effectiveTeam.recordId ||
                          (typeof effectiveTeam === 'string' ? effectiveTeam : null);
            
            if (!teamId) {
                console.error('Could not extract team ID from:', effectiveTeam);
                throw new Error('Invalid team ID in team object');
            }
            
            const results = [];
            
            // Process each staff ID or staff object
            for (const staffItem of staffIdArray) {
                // Handle both string IDs and staff objects
                let staffId;
                let staffName = '';
                
                if (typeof staffItem === 'object' && staffItem !== null) {
                    // If it's a staff object with id and name
                    staffId = staffItem.id;
                    staffName = staffItem.name || '';
                } else {
                    // If it's just a string ID
                    staffId = staffItem;
                }
                
                // Create the team member record
                const result = await assignStaffToTeam(teamId, staffId, role, staffName);
                
                // Create a complete team member object with all necessary fields
                const teamMemberData = {
                    ...result,
                    id: result.recordId || result.id || (result.fieldData && result.fieldData.__ID),
                    recordId: result.recordId, // Explicitly preserve recordId
                    _teamID: teamId,
                    _staffID: staffId,
                    teamId: teamId,
                    staffId: staffId,
                    role: role,
                    name: staffName,
                    // Add staff details directly from the form data
                    staffDetails: {
                        id: staffId,
                        name: staffName || 'Unknown Staff',
                        role: role
                    }
                };
                
                // Process the result
                const processedTeamMember = processTeamMemberData(teamMemberData);
                
                // Update local state - add to existing staff list
                setTeamStaff(prevStaff => {
                    // Check if this staff member already exists in the state
                    const exists = prevStaff.some(s =>
                        s.id === processedTeamMember.id ||
                        s.staffId === staffId
                    );
                    
                    // Only add if it doesn't exist
                    if (!exists) {
                        return [...prevStaff, processedTeamMember];
                    }
                    return prevStaff;
                });
                
                results.push(processedTeamMember);
            }
            
            return results.length === 1 ? results[0] : results;
        } catch (err) {
            setError(err.message);
            console.error('Error assigning staff to team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTeam, setLoading, setError]);

    /**
     * Removes a staff member from the selected team
     * @param {string} teamMemberId - The recordId of the team member to remove
     */
    const handleRemoveStaffFromTeam = useCallback(async (teamMemberId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await removeStaffFromTeam(teamMemberId);
            
            // Update local state - keep members where neither recordId nor id matches the teamMemberId
            setTeamStaff(prevStaff => prevStaff.filter(member => {
                // If member has a recordId, check if it matches
                if (member.recordId) {
                    return member.recordId !== teamMemberId;
                }
                // If no recordId, fall back to id
                return member.id !== teamMemberId;
            }));
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error removing staff from team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Assigns a project to the selected team
     */
    const handleAssignProjectToTeam = useCallback(async (projectId) => {
        if (!selectedTeam) {
            throw new Error('No team selected');
        }
        
        try {
            setLoading(true);
            setError(null);
            
            const result = await assignProjectToTeam(projectId, selectedTeam.id);
            
            // Reload team projects to get updated list
            const projectsResult = await fetchTeamProjects(selectedTeam.id);
            setTeamProjects(projectsResult);
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error assigning project to team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTeam]);

    /**
     * Removes a project from the selected team
     */
    const handleRemoveProjectFromTeam = useCallback(async (projectId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await removeProjectFromTeam(projectId);
            
            // Update local state
            setTeamProjects(prevProjects => prevProjects.filter(project => project.id !== projectId));
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error removing project from team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const returnValue = {
        // State
        loading,
        error,
        teams,
        selectedTeam,
        teamStaff,
        teamProjects,
        allStaff,
        stats,
        
        // Actions
        loadTeams,
        loadAllStaff,
        handleTeamSelect,
        handleTeamCreate,
        handleTeamUpdate,
        handleTeamDelete,
        handleAssignStaffToTeam,
        handleRemoveStaffFromTeam,
        handleAssignProjectToTeam,
        handleRemoveProjectFromTeam,
        
        // Utility functions
        clearError: () => setError(null),
        clearSelectedTeam: () => {
            setSelectedTeam(null);
            setTeamStaff([]);
            setTeamProjects([]);
            setStats(null);
        }
    };
    
    return returnValue;
}