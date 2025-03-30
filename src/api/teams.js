import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Add Teams layout to Layouts if it doesn't exist
const TeamLayouts = {
    TEAMS: 'devTeams',
    TEAM_MEMBERS: 'devTeamMembers',
    STAFF: 'devStaff',
    ...Layouts
};

/**
 * Fetches all teams from the database
 * @returns {Promise<Array>} Array of team objects
 */
export async function fetchTeams() {
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAMS,
            action: Actions.READ,
            query: [{ "__ID": "*" }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches a specific team by ID
 * @param {string} teamId - The ID of the team to fetch
 * @returns {Promise<Object>} Team object
 */
export async function fetchTeamById(teamId) {
    validateParams({ teamId }, ['teamId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAMS,
            action: Actions.READ,
            query: [{ "__ID": teamId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches staff members assigned to a team
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Array>} Array of staff member objects
 */
export async function fetchTeamStaff(teamId) {
    validateParams({ teamId }, ['teamId']);
    
    return handleFileMakerOperation(async () => {
        // First fetch team members
        const teamMembersParams = {
            layout: TeamLayouts.TEAM_MEMBERS,
            action: Actions.READ,
            query: [{ "_teamID": teamId }]
        };
        
        const teamMembersResult = await fetchDataFromFileMaker(teamMembersParams);
        
        // Extract team members from the response
        let teamMembers = [];
        if (teamMembersResult && teamMembersResult.response && Array.isArray(teamMembersResult.response.data)) {
            teamMembers = teamMembersResult.response.data;
        } else if (Array.isArray(teamMembersResult)) {
            teamMembers = teamMembersResult;
        }
        
        if (!teamMembers.length) return [];
        
        // Get the staff IDs from team members
        const staffIds = teamMembers.map(member => {
            const fieldData = member.fieldData || member;
            return fieldData._staffID;
        }).filter(id => id); // Filter out any undefined or null IDs
        
        if (!staffIds.length) return teamMembers;
        
        // Fetch the actual staff records
        const staffParams = {
            layout: TeamLayouts.STAFF,
            action: Actions.READ,
            query: staffIds.map(id => ({ "__ID": id })),
            operator: 'or'
        };
        
        const staffResult = await fetchDataFromFileMaker(staffParams);
        
        // Extract staff members from the response
        let staffMembers = [];
        if (staffResult && staffResult.response && Array.isArray(staffResult.response.data)) {
            staffMembers = staffResult.response.data;
        } else if (Array.isArray(staffResult)) {
            staffMembers = staffResult;
        }
        
        // Combine the team member data with staff data
        return teamMembers.map(teamMember => {
            const fieldData = teamMember.fieldData || teamMember;
            const staffId = fieldData._staffID;
            
            // Find the corresponding staff member
            const staffMember = staffMembers.find(staff => {
                const staffFieldData = staff.fieldData || staff;
                return staffFieldData.__ID === staffId;
            });
            
            // Create a processed team member with ID
            return {
                ...teamMember,
                id: fieldData.__ID || teamMember.__ID || teamMember.id || teamMember.recordId,
                teamId: fieldData._teamID || teamMember._teamID || teamMember.teamId,
                staffId: staffId,
                role: fieldData.role || teamMember.role || '',
                staffDetails: staffMember || null
            };
        });
    });
}

/**
 * Fetches projects assigned to a team
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Array>} Array of project objects
 */
export async function fetchTeamProjects(teamId) {
    validateParams({ teamId }, ['teamId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.READ,
            query: [{ "_teamID": teamId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Creates a new team
 * @param {Object} teamData - The team data
 * @returns {Promise<Object>} Created team object
 */
export async function createTeam(teamData) {
    validateParams({ teamData }, ['teamData']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAMS,
            action: Actions.CREATE,
            fieldData: teamData
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates an existing team
 * @param {string} teamId - The ID of the team to update
 * @param {Object} teamData - The updated team data
 * @returns {Promise<Object>} Updated team object
 */
export async function updateTeam(teamId, teamData) {
    validateParams({ teamId, teamData }, ['teamId', 'teamData']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAMS,
            action: Actions.UPDATE,
            recordId: teamId,
            fieldData: teamData
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Deletes a team
 * @param {string} teamId - The ID of the team to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTeam(teamId) {
    validateParams({ teamId }, ['teamId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAMS,
            action: Actions.DELETE,
            recordId: teamId
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Assigns a staff member to a team
 * @param {string} teamId - The ID of the team
 * @param {string} staffId - The ID of the staff member
 * @param {string} role - The role of the staff member in the team
 * @param {string} name - The name of the staff member (optional)
 * @returns {Promise<Object>} Created team member object
 */
export async function assignStaffToTeam(teamId, staffId, role = '', name = '') {
    validateParams({ teamId, staffId }, ['teamId', 'staffId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAM_MEMBERS,
            action: Actions.CREATE,
            fieldData: {
                _teamID: teamId,
                _staffID: staffId,
                role,
                name
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Removes a staff member from a team
 * @param {string} teamMemberId - The ID of the team member record to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeStaffFromTeam(teamMemberId) {
    validateParams({ teamMemberId }, ['teamMemberId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.TEAM_MEMBERS,
            action: Actions.DELETE,
            recordId: teamMemberId
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Assigns a project to a team
 * @param {string} projectId - The ID of the project
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Object>} Updated project object
 */
export async function assignProjectToTeam(projectId, teamId) {
    validateParams({ projectId, teamId }, ['projectId', 'teamId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.UPDATE,
            recordId: projectId,
            fieldData: {
                _teamID: teamId
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Removes a project from a team
 * @param {string} projectId - The ID of the project to remove from the team
 * @returns {Promise<Object>} Updated project object
 */
export async function removeProjectFromTeam(projectId) {
    validateParams({ projectId }, ['projectId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.UPDATE,
            recordId: projectId,
            fieldData: {
                _teamID: ''
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches all staff members
 * @returns {Promise<Array>} Array of staff member objects
 */
export async function fetchAllStaff() {
    return handleFileMakerOperation(async () => {
        const params = {
            layout: TeamLayouts.STAFF,
            action: Actions.READ,
            query: [{ "__ID": "*" }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}