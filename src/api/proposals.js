/**
 * Proposal API module
 * Handles all proposal-related API operations using the backend service
 * Following DEVELOPMENT_GUIDELINES.md API Client Pattern
 */

import axios from 'axios'
import { backendConfig } from '../config'

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
async function generateBackendAuthHeader(payload = '') {
  const secretKey = import.meta.env.VITE_SECRET_KEY
  
  if (!secretKey) {
    console.warn('[Proposals] SECRET_KEY not available. Using development mode.')
    const timestamp = Math.floor(Date.now() / 1000)
    return `Bearer dev-token.${timestamp}`
  }
  
  // Check if Web Crypto API is available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[Proposals] Web Crypto API not available. Using fallback auth.')
    const timestamp = Math.floor(Date.now() / 1000)
    return `Bearer fallback-token.${timestamp}`
  }
  
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `${timestamp}.${payload}`
  
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secretKey)
    const messageData = encoder.encode(message)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return `Bearer ${signatureHex}.${timestamp}`
  } catch (error) {
    console.warn('[Proposals] Crypto operation failed, using fallback:', error)
    const timestamp = Math.floor(Date.now() / 1000)
    return `Bearer fallback-token.${timestamp}`
  }
}

/**
 * Generate secure access token for proposals
 * @returns {string} Secure token
 */
function generateSecureToken() {
  return crypto.randomUUID() + '-' + Date.now().toString(36)
}

/**
 * Create a new proposal
 * @param {Object} proposalData - Proposal data
 * @returns {Promise<Object>} Created proposal
 */
export async function createProposal(proposalData) {
  try {
    // Prepare proposal data with secure token
    const proposalWithToken = {
      ...proposalData,
      access_token: generateSecureToken(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft'
    }

    const payload = JSON.stringify(proposalWithToken)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'POST',
      url: `${backendConfig.baseUrl}/proposals/`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: proposalWithToken
    })

    console.log('[Proposals] Created proposal:', response.data.title)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Create proposal error:', error)
    
    let errorMessage = 'Failed to create proposal'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Fetch proposals for a specific project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Result with proposals data
 */
export async function fetchProposalsForProject(projectId) {
  try {
    const authHeader = await generateBackendAuthHeader()

    const response = await axios({
      method: 'GET',
      url: `${backendConfig.baseUrl}/proposals/`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      params: {
        project_id: projectId
      }
    })

    console.log('[Proposals] Fetched proposals for project:', projectId)
    return {
      success: true,
      data: response.data.proposals || []
    }
  } catch (error) {
    console.error('[Proposals] Fetch proposals for project error:', error)
    
    let errorMessage = 'Failed to fetch proposals'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Fetch proposal by access token
 * @param {string} token - Access token
 * @returns {Promise<Object>} Proposal with related data
 */
export async function fetchProposalByToken(token) {
  try {
    const response = await axios({
      method: 'GET',
      url: `${backendConfig.baseUrl}/proposals/token/${token}`,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('[Proposals] Fetched proposal by token:', token)
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('[Proposals] Fetch proposal by token error:', error)
    
    let errorMessage = 'Failed to fetch proposal'
    if (error.response?.status === 404) {
      errorMessage = 'Proposal not found or access token has expired'
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Fetch proposals for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Proposals list
 */
export async function fetchProposalsByProject(projectId) {
  try {
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[WIREFRAME] Mock fetching proposals for project:', projectId)
    
    const mockProposals = [
      {
        id: 'prop-1',
        title: 'Initial Website Proposal',
        status: 'sent',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        total_price: 12000,
        selected_price: 9500
      },
      {
        id: 'prop-2',
        title: 'Revised Proposal v2',
        status: 'draft',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        total_price: 15000,
        selected_price: 15000
      }
    ]
    
    return { success: true, data: mockProposals }
  } catch (error) {
    console.error('[Proposals] Fetch proposals by project error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Update proposal status
 * @param {string} proposalId - Proposal ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Update result
 */
export async function updateProposalStatus(proposalId, status) {
  try {
    const updateData = { status }
    const payload = JSON.stringify(updateData)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'PUT',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: updateData
    })

    console.log('[Proposals] Updated proposal status:', proposalId, status)
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('[Proposals] Update proposal status error:', error)
    
    let errorMessage = 'Failed to update proposal status'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Add concept to proposal
 * @param {string} proposalId - Proposal ID
 * @param {Object} conceptData - Concept data
 * @returns {Promise<Object>} Created concept
 */
export async function addProposalConcept(proposalId, conceptData) {
  try {
    const conceptWithProposal = {
      ...conceptData,
      proposal_id: proposalId
    }

    const payload = JSON.stringify(conceptWithProposal)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'POST',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}/concepts`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: conceptWithProposal
    })

    console.log('[Proposals] Added concept:', response.data.title)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Add concept error:', error)
    
    let errorMessage = 'Failed to add concept'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Add deliverable to proposal
 * @param {string} proposalId - Proposal ID
 * @param {Object} deliverableData - Deliverable data
 * @returns {Promise<Object>} Created deliverable
 */
export async function addProposalDeliverable(proposalId, deliverableData) {
  try {
    const deliverableWithProposal = {
      ...deliverableData,
      proposal_id: proposalId
    }

    const payload = JSON.stringify(deliverableWithProposal)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'POST',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}/deliverables`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: deliverableWithProposal
    })

    console.log('[Proposals] Added deliverable:', response.data.title)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Add deliverable error:', error)
    
    let errorMessage = 'Failed to add deliverable'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Update deliverable selections
 * @param {string} proposalId - Proposal ID
 * @param {Array} selectedDeliverableIds - Array of selected deliverable IDs
 * @returns {Promise<Object>} Update result
 */
export async function updateDeliverableSelections(proposalId, selectedDeliverableIds) {
  try {
    const updateData = { selected_deliverable_ids: selectedDeliverableIds }
    const payload = JSON.stringify(updateData)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'PUT',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}/deliverables/selections`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: updateData
    })

    console.log('[Proposals] Updated deliverable selections:', proposalId, selectedDeliverableIds)
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('[Proposals] Update deliverable selections error:', error)
    
    let errorMessage = 'Failed to update deliverable selections'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Approve proposal
 * @param {string} proposalId - Proposal ID
 * @param {Array} selectedDeliverableIds - Selected deliverable IDs
 * @param {number} totalPrice - Total price
 * @returns {Promise<Object>} Approval result
 */
export async function approveProposal(proposalId, selectedDeliverableIds, totalPrice) {
  try {
    const approvalData = {
      status: 'approved',
      selected_deliverable_ids: selectedDeliverableIds,
      selected_price: totalPrice,
      approved_at: new Date().toISOString()
    }
    
    const payload = JSON.stringify(approvalData)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: 'PUT',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}/approve`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: approvalData
    })

    console.log('[Proposals] Approved proposal:', proposalId, selectedDeliverableIds, totalPrice)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Approve proposal error:', error)
    
    let errorMessage = 'Failed to approve proposal'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Delete proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProposal(proposalId) {
  try {
    const authHeader = await generateBackendAuthHeader('')

    const response = await axios({
      method: 'DELETE',
      url: `${backendConfig.baseUrl}/proposals/${proposalId}`,
      headers: {
        'Authorization': authHeader
      }
    })

    console.log('[Proposals] Deleted proposal:', proposalId)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Delete proposal error:', error)
    
    let errorMessage = 'Failed to delete proposal'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}