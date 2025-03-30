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

/**
 * Processes team data from the API.
 *
 * @param {Object} team Raw team data from API.
 * @returns {Object} Processed team data.
 */
export function processTeamData(team) {
    if (!team) return null;
    
    // Check if data is in fieldData structure (common in FileMaker responses)
    const fieldData = team.fieldData || team;
    
    return {
        ...team,
        id: fieldData.__ID || team.__ID || team.id,
        name: fieldData.name || team.name || 'Unnamed Team',
        createdAt: fieldData['~CreationTimestamp'] || team['~CreationTimestamp'] || team.createdAt || new Date().toISOString(),
        modifiedAt: fieldData['~ModificationTimestamp'] || team['~ModificationTimestamp'] || team.modifiedAt || new Date().toISOString(),
        recordId: team.recordId || fieldData.recordId
    };
}


/**
 * Processes staff data from the API.
 *
 * @param {Object} staff Raw staff data from API.
 * @returns {Object} Processed staff data.
 */
export function processStaffData(staff) {
    if (!staff) return null;
    // Check if data is in fieldData structure (common in FileMaker responses)
    const fieldData = staff.fieldData || staff;
    
    return {
        ...staff,
        id: fieldData.__ID || staff.__ID || staff.id,
        name: fieldData.name || staff.name || 'Unnamed Staff',
        role: fieldData.role || staff.role || '',
        image: fieldData.image_base64 || staff.image_base64 || null,
        createdAt: fieldData['~CreationTimestamp'] || staff['~CreationTimestamp'] || staff.createdAt || new Date().toISOString(),
        modifiedAt: fieldData['~ModificationTimestamp'] || staff['~ModificationTimestamp'] || staff.modifiedAt || new Date().toISOString(),
        recordId: staff.recordId || fieldData.recordId
    };
}


/**
 * Processes team member data from the API.
 *
 * @param {Object} teamMember Raw team member data from API.
 * @returns {Object} Processed team member data.
 */
export function processTeamMemberData(teamMember) {
    if (!teamMember) return null;
    // Check if data is in fieldData structure (common in FileMaker responses)
    const fieldData = teamMember.fieldData || teamMember;
    
    const staffDetails = teamMember.staffDetails ? processStaffData(teamMember.staffDetails) : null;
    
    return {
        ...teamMember,
        id: fieldData.__ID || teamMember.__ID || teamMember.id,
        teamId: fieldData._teamID || teamMember._teamID || teamMember.teamId,
        staffId: fieldData._staffID || teamMember._staffID || teamMember.staffId,
        role: fieldData.role || teamMember.role || '',
        staffDetails,
        createdAt: fieldData['~CreationTimestamp'] || teamMember['~CreationTimestamp'] || teamMember.createdAt || new Date().toISOString(),
        modifiedAt: fieldData['~ModificationTimestamp'] || teamMember['~ModificationTimestamp'] || teamMember.modifiedAt || new Date().toISOString(),
        recordId: teamMember.recordId || fieldData.recordId
    };
}

/**
 * Fetches and processes all teams.
 *
 * @returns {Promise<Array>} Array of processed team objects.
 */
export async function getTeams() {
    try {
        const teams = await fetchTeams();
        return teams.map(processTeamData);
    } catch (error) {
        console.error('Error fetching teams:', error);
        throw error;
    }
}

/**
 * Fetches and processes a specific team by ID.
 *
 * @param {string} teamId The ID of the team to fetch.
 * @returns {Promise<Object>} Processed team object.
 */
export async function getTeamById(teamId) {
    try {
        const team = await fetchTeamById(teamId);
        return processTeamData(team);
    } catch (error) {
        console.error(`Error fetching team with ID ${teamId}:`, error);
        throw error;
    }
}

/**
 * Fetches and processes staff members assigned to a team.
 *
 * @param {string} teamId The ID of the team.
 * @returns {Promise<Array>} Array of processed staff member objects.
 */
export async function getTeamStaff(teamId) {
    try {
        const teamStaff = await fetchTeamStaff(teamId);
        return teamStaff.map(processTeamMemberData);
    } catch (error) {
        console.error(`Error fetching staff for team with ID ${teamId}:`, error);
        throw error;
    }
}

/**
 * Fetches and processes projects assigned to a team.
 *
 * @param {string} teamId The ID of the team.
 * @returns {Promise<Array>} Array of processed project objects.
 */
export async function getTeamProjects(teamId) {
    try {
        const projects = await fetchTeamProjects(teamId);
        // Assuming there's a processProjectData function in projectService.js
        // We'll import and use that in the actual implementation
        return projects;
    } catch (error) {
        console.error(`Error fetching projects for team with ID ${teamId}:`, error);
        throw error;
    }
}

/**
 * Creates a new team.
 *
 * @param {Object} teamData The team data.
 * @returns {Promise<Object>} Processed created team object.
 */
export async function createNewTeam(teamData) {
    try {
        const team = await createTeam(teamData);
        return processTeamData(team);
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
}

/**
 * Updates an existing team.
 *
 * @param {string} teamId The ID of the team to update.
 * @param {Object} teamData The updated team data.
 * @returns {Promise<Object>} Processed updated team object.
 */
export async function updateExistingTeam(teamId, teamData) {
    try {
        const team = await updateTeam(teamId, teamData);
        return processTeamData(team);
    } catch (error) {
        console.error(`Error updating team with ID ${teamId}:`, error);
        throw error;
    }
}

/**
 * Deletes a team.
 *
 * @param {string} teamId The ID of the team to delete.
 * @returns {Promise<boolean>} Success status.
 */
export async function deleteExistingTeam(teamId) {
    try {
        return await deleteTeam(teamId);
    } catch (error) {
        console.error(`Error deleting team with ID ${teamId}:`, error);
        throw error;
    }
}

/**
 * Assigns a staff member to a team.
 *
 * @param {string} teamId The ID of the team.
 * @param {string} staffId The ID of the staff member.
 * @param {string} role The role of the staff member in the team.
 * @returns {Promise<Object>} Processed created team member object.
 */
export async function assignStaffMemberToTeam(teamId, staffId, role = '') {
    try {
        const teamMember = await assignStaffToTeam(teamId, staffId, role);
        return processTeamMemberData(teamMember);
    } catch (error) {
        console.error(`Error assigning staff ${staffId} to team ${teamId}:`, error);
        throw error;
    }
}

/**
 * Removes a staff member from a team.
 *
 * @param {string} teamMemberId The ID of the team member record to remove.
 * @returns {Promise<boolean>} Success status.
 */
export async function removeStaffMemberFromTeam(teamMemberId) {
    try {
        return await removeStaffFromTeam(teamMemberId);
    } catch (error) {
        console.error(`Error removing team member with ID ${teamMemberId}:`, error);
        throw error;
    }
}

/**
 * Assigns a project to a team.
 *
 * @param {string} projectId The ID of the project.
 * @param {string} teamId The ID of the team.
 * @returns {Promise<Object>} Updated project object.
 */
export async function assignProjectToExistingTeam(projectId, teamId) {
    try {
        return await assignProjectToTeam(projectId, teamId);
    } catch (error) {
        console.error(`Error assigning project ${projectId} to team ${teamId}:`, error);
        throw error;
    }
}

/**
 * Removes a project from a team.
 *
 * @param {string} projectId The ID of the project to remove from the team.
 * @returns {Promise<Object>} Updated project object.
 */
export async function removeProjectFromExistingTeam(projectId) {
    try {
        return await removeProjectFromTeam(projectId);
    } catch (error) {
        console.error(`Error removing project with ID ${projectId} from team:`, error);
        throw error;
    }
}

/**
 * Fetches and processes all staff members.
 *
 * @returns {Promise<Array>} Array of processed staff member objects.
 */
export async function getAllStaff() {
    try {
        const staff = await fetchAllStaff();
        return staff.map(processStaffData);
    } catch (error) {
        console.error('Error fetching all staff:', error);
        throw error;
    }
}

/**
 * Calculates statistics for a team.
 *
 * @param {Array} staff Array of staff members.
 * @param {Array} projects Array of projects.
 * @returns {Object} Team statistics.
 */
export function calculateTeamStats(staff = [], projects = []) {
    // Ensure projects is an array
    const projectsArray = Array.isArray(projects) ? projects : [];
    
    return {
        totalStaff: staff.length,
        totalProjects: projectsArray.length,
        activeProjects: projectsArray.filter(project => project && project.status === 'Open').length
    };
}