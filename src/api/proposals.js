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
 * Create a new proposal or update an existing one
 * @param {Object} proposalData - Proposal data
 * @returns {Promise<Object>} Created/updated proposal
 */
export async function createProposal(proposalData) {
  try {
    // Determine if this is an update (has existing ID) or create (new)
    const isUpdate = !!proposalData.id

    // Map frontend data structure to backend schema
    // Backend expects: id, project_id, customer_id, title, description (optional)
    // IMPORTANT: Only include fields the backend schema expects
    const backendProposalData = {
      id: proposalData.id || crypto.randomUUID(), // Auto-generate UUID if not provided
      project_id: proposalData.projectId || proposalData.project_id,
      customer_id: proposalData.customerId || proposalData.customer_id,
      title: proposalData.title,
      description: proposalData.description || '',
      // Ensure prices are numbers, not strings
      total_price: parseFloat(proposalData.totalPrice || proposalData.total_price || 0),
      selected_price: parseFloat(proposalData.selectedPrice || proposalData.selected_price || 0)
    }

    // Only set these fields on creation, not on update
    if (!isUpdate) {
      backendProposalData.access_token = generateSecureToken()
      backendProposalData.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      backendProposalData.status = 'draft'
    }

    // Remove any undefined values
    Object.keys(backendProposalData).forEach(key => {
      if (backendProposalData[key] === undefined) {
        delete backendProposalData[key]
      }
    })

    console.log(`[Proposals] ${isUpdate ? 'Updating' : 'Creating'} proposal:`, backendProposalData)

    const payload = JSON.stringify(backendProposalData)
    const authHeader = await generateBackendAuthHeader(payload)

    const response = await axios({
      method: isUpdate ? 'PUT' : 'POST',
      url: isUpdate
        ? `${backendConfig.baseUrl}/proposals/${backendProposalData.id}`
        : `${backendConfig.baseUrl}/proposals/`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      data: backendProposalData
    })

    console.log(`[Proposals] ${isUpdate ? 'Updated' : 'Created'} proposal:`, response.data.title)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Create proposal error:', error)
    console.error('[Proposals] Error response data:', error.response?.data)

    let errorMessage = 'Failed to create proposal'

    // Handle FastAPI validation errors
    if (error.response?.data?.detail) {
      if (Array.isArray(error.response.data.detail)) {
        // Pydantic validation errors
        const validationErrors = error.response.data.detail.map(err =>
          `${err.loc.join('.')}: ${err.msg}`
        ).join(', ')
        errorMessage = `Validation error: ${validationErrors}`
      } else if (typeof error.response.data.detail === 'string') {
        errorMessage = error.response.data.detail
      } else {
        errorMessage = JSON.stringify(error.response.data.detail)
      }
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
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Page size (default: 50)
 * @returns {Promise<Object>} Result with proposals data
 */
export async function fetchProposalsForProject(projectId, page = 1, pageSize = 50) {
  try {
    const authHeader = await generateBackendAuthHeader()

    const response = await axios({
      method: 'GET',
      url: `${backendConfig.baseUrl}/proposals/project/${projectId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      params: {
        page,
        page_size: pageSize
      }
    })

    console.log('[Proposals] Fetched proposals for project:', projectId, `(${response.data.proposals?.length || 0} proposals)`)
    return {
      success: true,
      data: response.data.proposals || [],
      totalCount: response.data.total_count || 0,
      page: response.data.page || 1,
      pageSize: response.data.page_size || pageSize
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