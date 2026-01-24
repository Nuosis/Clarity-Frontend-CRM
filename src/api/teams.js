/**
 * Teams API - Supabase Integration
 * Uses Supabase client directly with proper authentication and RLS policies
 *
 * Database Schema:
 * - teams table: id, organization_id, name, created_at, updated_at
 * - staff table: id, organization_id, name, title, email, phone, profile_image_url, is_active, created_at, updated_at
 * - team_members table: id, organization_id, team_id, staff_id, role, created_at, updated_at
 * - projects table: id, ..., team_id (nullable foreign key to teams)
 *
 * All operations are scoped to the user's organization via RLS policies.
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../config.js'
import { validateUUID } from '../utils/validation'

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetches all teams from the database
 * RLS automatically scopes to user's organization
 * @returns {Promise<Array>} Array of team objects
 */
export async function fetchTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`)
  }

  return data
}

/**
 * Fetches a specific team by ID
 * @param {string} teamId - The ID of the team to fetch
 * @returns {Promise<Object>} Team object
 */
export async function fetchTeamById(teamId) {
  if (!teamId) {
    throw new Error('Team ID is required')
  }

  validateUUID(teamId, 'Team ID')

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch team: ${error.message}`)
  }

  return data
}

/**
 * Fetches staff members assigned to a team
 * Returns team members with full staff details
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Array>} Array of team member objects with staff details
 */
export async function fetchTeamStaff(teamId) {
  if (!teamId) {
    throw new Error('Team ID is required')
  }

  validateUUID(teamId, 'Team ID')

  const { data, error } = await supabase
    .from('team_members')
    .select(`
      id,
      team_id,
      staff_id,
      role,
      created_at,
      updated_at,
      staff:staff_id (
        id,
        name,
        title,
        email,
        phone,
        profile_image_url,
        is_active
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch team staff: ${error.message}`)
  }

  // Transform response to flatten staff details for easier consumption
  return data.map(member => ({
    id: member.id,
    teamId: member.team_id,
    staffId: member.staff_id,
    role: member.role || '',
    staffDetails: member.staff,
    created_at: member.created_at,
    updated_at: member.updated_at
  }))
}

/**
 * Fetches projects assigned to a team
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Array>} Array of project objects
 */
export async function fetchTeamProjects(teamId) {
  if (!teamId) {
    throw new Error('Team ID is required')
  }

  validateUUID(teamId, 'Team ID')

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch team projects: ${error.message}`)
  }

  return data
}

/**
 * Creates a new team
 * @param {Object} teamData - The team data
 * @param {string} teamData.name - Team name (required)
 * @param {string} teamData.organization_id - Organization ID (required)
 * @returns {Promise<Object>} Created team object
 */
export async function createTeam(teamData) {
  if (!teamData || !teamData.name) {
    throw new Error('Team name is required')
  }

  const { data, error } = await supabase
    .from('teams')
    .insert([{
      id: crypto.randomUUID(),
      name: teamData.name,
      organization_id: teamData.organization_id
    }])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`)
  }

  return data
}

/**
 * Updates an existing team
 * @param {string} teamId - The ID of the team to update
 * @param {Object} teamData - The updated team data
 * @param {string} teamData.name - Updated team name
 * @returns {Promise<Object>} Updated team object
 */
export async function updateTeam(teamId, teamData) {
  if (!teamId) {
    throw new Error('Team ID is required')
  }

  validateUUID(teamId, 'Team ID')

  if (!teamData || !teamData.name) {
    throw new Error('Team name is required')
  }

  const { data, error } = await supabase
    .from('teams')
    .update({
      name: teamData.name
    })
    .eq('id', teamId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update team: ${error.message}`)
  }

  return data
}

/**
 * Deletes a team
 * Note: This will cascade delete all team_members records
 * and set projects.team_id to NULL for assigned projects
 * @param {string} teamId - The ID of the team to delete
 * @returns {Promise<Object>} Success status
 */
export async function deleteTeam(teamId) {
  if (!teamId) {
    throw new Error('Team ID is required')
  }

  validateUUID(teamId, 'Team ID')

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`)
  }

  return { success: true }
}

/**
 * Assigns a staff member to a team
 * @param {string} teamId - The ID of the team
 * @param {string} staffId - The ID of the staff member
 * @param {string} role - The role of the staff member in the team (optional)
 * @param {string} organizationId - The organization ID (required for RLS)
 * @returns {Promise<Object>} Created team member object with staff details
 */
export async function assignStaffToTeam(teamId, staffId, role = '', organizationId) {
  if (!teamId || !staffId) {
    throw new Error('Team ID and Staff ID are required')
  }

  validateUUID(teamId, 'Team ID')
  validateUUID(staffId, 'Staff ID')
  validateUUID(organizationId, 'Organization ID')

  if (!organizationId) {
    throw new Error('Organization ID is required')
  }

  // First check if assignment already exists
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('staff_id', staffId)
    .single()

  if (existing) {
    throw new Error('Staff member is already assigned to this team')
  }

  // Create the assignment
  const { data, error } = await supabase
    .from('team_members')
    .insert([{
      id: crypto.randomUUID(),
      organization_id: organizationId,
      team_id: teamId,
      staff_id: staffId,
      role: role || null
    }])
    .select(`
      id,
      team_id,
      staff_id,
      role,
      created_at,
      updated_at,
      staff:staff_id (
        id,
        name,
        title,
        email,
        phone,
        profile_image_url,
        is_active
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to assign staff to team: ${error.message}`)
  }

  // Transform response
  return {
    id: data.id,
    teamId: data.team_id,
    staffId: data.staff_id,
    role: data.role || '',
    staffDetails: data.staff,
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

/**
 * Removes a staff member from a team
 * @param {string} teamMemberId - The ID of the team member record to remove
 * @returns {Promise<Object>} Success status
 */
export async function removeStaffFromTeam(teamMemberId) {
  if (!teamMemberId) {
    throw new Error('Team member ID is required')
  }

  validateUUID(teamMemberId, 'Team member ID')

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', teamMemberId)

  if (error) {
    throw new Error(`Failed to remove staff from team: ${error.message}`)
  }

  return { success: true }
}

/**
 * Assigns a project to a team
 * @param {string} projectId - The ID of the project
 * @param {string} teamId - The ID of the team
 * @returns {Promise<Object>} Updated project object
 */
export async function assignProjectToTeam(projectId, teamId) {
  if (!projectId || !teamId) {
    throw new Error('Project ID and Team ID are required')
  }

  validateUUID(projectId, 'Project ID')
  validateUUID(teamId, 'Team ID')

  const { data, error } = await supabase
    .from('projects')
    .update({
      team_id: teamId
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to assign project to team: ${error.message}`)
  }

  return data
}

/**
 * Removes a project from a team
 * @param {string} projectId - The ID of the project to remove from the team
 * @returns {Promise<Object>} Updated project object
 */
export async function removeProjectFromTeam(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  validateUUID(projectId, 'Project ID')

  const { data, error } = await supabase
    .from('projects')
    .update({
      team_id: null
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to remove project from team: ${error.message}`)
  }

  return data
}

/**
 * Fetches all staff members
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Filter to only active staff members
 * @returns {Promise<Array>} Array of staff member objects
 */
export async function fetchAllStaff(options = {}) {
  let query = supabase
    .from('staff')
    .select('*')
    .order('name', { ascending: true })

  // Filter by active status if requested
  if (options.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch staff: ${error.message}`)
  }

  return data
}

/**
 * Creates a new staff member
 * @param {Object} staffData - The staff data
 * @param {string} staffData.name - Staff member name (required)
 * @param {string} staffData.organization_id - Organization ID (required)
 * @param {string} staffData.title - Job title (optional)
 * @param {string} staffData.email - Email address (optional)
 * @param {string} staffData.phone - Phone number (optional)
 * @param {string} staffData.profile_image_url - Profile image URL (optional)
 * @returns {Promise<Object>} Created staff object
 */
export async function createStaff(staffData) {
  if (!staffData || !staffData.name) {
    throw new Error('Staff name is required')
  }

  if (!staffData.organization_id) {
    throw new Error('Organization ID is required')
  }

  const { data, error } = await supabase
    .from('staff')
    .insert([{
      id: crypto.randomUUID(),
      organization_id: staffData.organization_id,
      name: staffData.name,
      title: staffData.title || null,
      email: staffData.email || null,
      phone: staffData.phone || null,
      profile_image_url: staffData.profile_image_url || null,
      is_active: true
    }])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create staff: ${error.message}`)
  }

  return data
}

/**
 * Updates an existing staff member
 * @param {string} staffId - The ID of the staff member to update
 * @param {Object} staffData - The updated staff data
 * @returns {Promise<Object>} Updated staff object
 */
export async function updateStaff(staffId, staffData) {
  if (!staffId) {
    throw new Error('Staff ID is required')
  }

  validateUUID(staffId, 'Staff ID')

  if (!staffData || Object.keys(staffData).length === 0) {
    throw new Error('Staff data is required')
  }

  // Build update object with only provided fields
  const updateData = {}
  if (staffData.name !== undefined) updateData.name = staffData.name
  if (staffData.title !== undefined) updateData.title = staffData.title
  if (staffData.email !== undefined) updateData.email = staffData.email
  if (staffData.phone !== undefined) updateData.phone = staffData.phone
  if (staffData.profile_image_url !== undefined) updateData.profile_image_url = staffData.profile_image_url
  if (staffData.is_active !== undefined) updateData.is_active = staffData.is_active

  const { data, error } = await supabase
    .from('staff')
    .update(updateData)
    .eq('id', staffId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update staff: ${error.message}`)
  }

  return data
}

/**
 * Deletes a staff member
 * Note: This will cascade delete all team_members records
 * @param {string} staffId - The ID of the staff member to delete
 * @returns {Promise<Object>} Success status
 */
export async function deleteStaff(staffId) {
  if (!staffId) {
    throw new Error('Staff ID is required')
  }

  validateUUID(staffId, 'Staff ID')

  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', staffId)

  if (error) {
    throw new Error(`Failed to delete staff: ${error.message}`)
  }

  return { success: true }
}

/**
 * Updates a team member's role
 * @param {string} teamMemberId - The ID of the team member record
 * @param {string} role - The new role
 * @returns {Promise<Object>} Updated team member object
 */
export async function updateTeamMemberRole(teamMemberId, role) {
  if (!teamMemberId) {
    throw new Error('Team member ID is required')
  }

  validateUUID(teamMemberId, 'Team member ID')

  const { data, error } = await supabase
    .from('team_members')
    .update({
      role: role || null
    })
    .eq('id', teamMemberId)
    .select(`
      id,
      team_id,
      staff_id,
      role,
      created_at,
      updated_at,
      staff:staff_id (
        id,
        name,
        title,
        email,
        phone,
        profile_image_url,
        is_active
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to update team member role: ${error.message}`)
  }

  // Transform response
  return {
    id: data.id,
    teamId: data.team_id,
    staffId: data.staff_id,
    role: data.role || '',
    staffDetails: data.staff,
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}
