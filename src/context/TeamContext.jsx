import React, { createContext, useContext, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTeam } from '../hooks/useTeam';

// Create the context
const TeamContext = createContext(null);

/**
 * Custom hook to use the team context
 * @returns {Object} Team state and operations
 */
export function useTeamContext() {
    const context = useContext(TeamContext);
    if (!context) {
        throw new Error('useTeamContext must be used within a TeamProvider');
    }
    return context;
}

/**
 * Team context provider component
 */
export function TeamProvider({ children }) {
    // Use the useTeam hook to get all team-related state and functions
    const teamState = useTeam();
    
    // Create the context value
    const contextValue = {
        // State
        teams: teamState.teams,
        loading: teamState.loading,
        error: teamState.error,
        selectedTeam: teamState.selectedTeam,
        teamStaff: teamState.teamStaff,
        teamProjects: teamState.teamProjects,
        allStaff: teamState.allStaff,
        stats: teamState.stats,
        
        // Actions
        loadTeams: teamState.loadTeams,
        loadAllStaff: teamState.loadAllStaff,
        handleTeamSelect: teamState.handleTeamSelect,
        handleTeamCreate: teamState.handleTeamCreate,
        handleTeamUpdate: teamState.handleTeamUpdate,
        handleTeamDelete: teamState.handleTeamDelete,
        handleAssignStaffToTeam: teamState.handleAssignStaffToTeam,
        handleRemoveStaffFromTeam: teamState.handleRemoveStaffFromTeam,
        handleAssignProjectToTeam: teamState.handleAssignProjectToTeam,
        handleRemoveProjectFromTeam: teamState.handleRemoveProjectFromTeam,
        
        // Utility functions
        clearError: teamState.clearError,
        clearSelectedTeam: teamState.clearSelectedTeam
    };
    
    return (
        <TeamContext.Provider value={contextValue}>
            {children}
        </TeamContext.Provider>
    );
}

TeamProvider.propTypes = {
    children: PropTypes.node.isRequired
};