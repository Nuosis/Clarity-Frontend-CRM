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

    /**
     * Loads all teams
     */
    const loadTeams = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchTeams();
            const processedTeams = result.map(processTeamData);
            
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
            const processedStaff = result.map(processStaffData);
            
            setAllStaff(processedStaff);
        } catch (err) {
            setError(err.message);
            console.error('Error loading all staff:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Selects a team and loads its staff and projects
     */
    const handleTeamSelect = useCallback(async (teamId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Fetch team details
            const teamResult = await fetchTeamById(teamId);
            const processedTeam = processTeamData(teamResult);
            setSelectedTeam(processedTeam);
            
            // Fetch team staff
            const staffResult = await fetchTeamStaff(teamId);
            const processedStaff = staffResult.map(processTeamMemberData);
            setTeamStaff(processedStaff);
            
            // Fetch team projects
            const projectsResult = await fetchTeamProjects(teamId);
            setTeamProjects(projectsResult);
            
        } catch (err) {
            setError(err.message);
            console.error('Error selecting team:', err);
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
     * Assigns a staff member to the selected team
     */
    const handleAssignStaffToTeam = useCallback(async (staffId, role = '') => {
        if (!selectedTeam) {
            throw new Error('No team selected');
        }
        
        try {
            setLoading(true);
            setError(null);
            
            const result = await assignStaffToTeam(selectedTeam.id, staffId, role);
            const processedTeamMember = processTeamMemberData(result);
            
            // Find the staff details from allStaff
            const staffDetails = allStaff.find(staff => staff.id === staffId);
            processedTeamMember.staffDetails = staffDetails;
            
            // Update local state
            setTeamStaff(prevStaff => [...prevStaff, processedTeamMember]);
            
            return processedTeamMember;
        } catch (err) {
            setError(err.message);
            console.error('Error assigning staff to team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedTeam, allStaff]);

    /**
     * Removes a staff member from the selected team
     */
    const handleRemoveStaffFromTeam = useCallback(async (teamMemberId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await removeStaffFromTeam(teamMemberId);
            
            // Update local state
            setTeamStaff(prevStaff => prevStaff.filter(member => member.id !== teamMemberId));
            
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

    return {
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
}