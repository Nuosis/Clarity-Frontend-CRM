/**
 * Proposal API module
 * Handles all proposal-related API operations using the backend service
 * Following DEVELOPMENT_GUIDELINES.md API Client Pattern
 */

import supabaseService from '../services/supabaseService'

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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const proposalWithToken = {
      ...proposalData,
      id: `prop-${Date.now()}`,
      access_token: generateSecureToken(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('[WIREFRAME] Mock creating proposal:', proposalWithToken.title)
    return { success: true, data: proposalWithToken }
  } catch (error) {
    console.error('[Proposals] Create proposal error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Fetch proposals for a specific project - WIREFRAME IMPLEMENTATION
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Result with proposals data
 */
export async function fetchProposalsForProject(projectId) {
  try {
    // WIREFRAME: Mock data for now
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const mockProposals = [
      {
        id: 'prop-1',
        title: 'Website Development Proposal',
        description: 'Complete website development with modern design and functionality',
        status: 'sent',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        total_price: 12000,
        selected_price: 9500,
        access_token: 'token-mock-proposal-1',
        concepts: [
          {
            id: 'concept-1',
            title: 'Homepage Wireframe',
            description: 'Initial wireframe showing the layout and structure of the homepage with navigation, hero section, and key content areas.',
            type: 'wireframe',
            url: 'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Homepage+Wireframe',
            thumbnailUrl: 'https://via.placeholder.com/200x150/4F46E5/FFFFFF?text=Homepage',
            order: 0
          },
          {
            id: 'concept-2',
            title: 'Brand Color Palette',
            description: 'Proposed color scheme and visual identity elements that will be used throughout the website design.',
            type: 'mockup',
            url: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Color+Palette',
            thumbnailUrl: 'https://via.placeholder.com/200x150/10B981/FFFFFF?text=Colors',
            order: 1
          }
        ],
        deliverables: [
          {
            id: 'deliv-1',
            title: 'Website Design & Development',
            description: 'Complete responsive website with modern design, including all pages and functionality.',
            price: 8500,
            type: 'fixed',
            estimatedHours: 120,
            isRequired: true,
            order: 0
          },
          {
            id: 'deliv-2',
            title: 'Content Management System',
            description: 'Custom CMS for easy content updates and management.',
            price: 2500,
            type: 'fixed',
            estimatedHours: 35,
            isRequired: false,
            order: 1
          },
          {
            id: 'deliv-3',
            title: 'SEO Optimization',
            description: 'Search engine optimization setup and configuration.',
            price: 1000,
            type: 'fixed',
            estimatedHours: 15,
            isRequired: false,
            order: 2
          }
        ]
      }
    ]
    
    return {
      success: true,
      data: mockProposals
    }
  } catch (error) {
    console.error('[Proposals] Fetch proposals for project error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('[WIREFRAME] Mock fetching proposal by token:', token)
    
    // Mock proposal data
    const mockProposal = {
      id: 'prop-123',
      title: 'Website Redesign Proposal',
      description: 'Complete redesign of your company website with modern UI/UX',
      status: 'sent',
      access_token: token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      request_summary: {
        overview: 'This project involves a complete redesign of your existing website to improve user experience, modernize the visual design, and enhance mobile responsiveness.',
        objectives: [
          'Improve user engagement and conversion rates',
          'Modernize visual design and branding',
          'Enhance mobile responsiveness',
          'Optimize for search engines'
        ],
        timeline: '6-8 weeks',
        budget: 15000
      },
      concepts: [
        {
          id: 'concept-1',
          title: 'Homepage Wireframe',
          description: 'Initial wireframe showing the new homepage layout and structure',
          type: 'wireframe',
          url: 'https://via.placeholder.com/800x600/007bff/ffffff?text=Homepage+Wireframe',
          thumbnail_url: 'https://via.placeholder.com/400x300/007bff/ffffff?text=Homepage+Wireframe',
          order: 0
        },
        {
          id: 'concept-2',
          title: 'Design Mockups',
          description: 'High-fidelity mockups showing the final visual design',
          type: 'mockup',
          url: 'https://via.placeholder.com/800x600/28a745/ffffff?text=Design+Mockups',
          thumbnail_url: 'https://via.placeholder.com/400x300/28a745/ffffff?text=Design+Mockups',
          order: 1
        }
      ],
      deliverables: [
        {
          id: 'deliv-1',
          title: 'Homepage Design & Development',
          description: 'Complete design and development of the new homepage',
          price: 5000,
          type: 'fixed',
          estimated_hours: null,
          is_selected: true,
          is_required: true,
          order: 0
        },
        {
          id: 'deliv-2',
          title: 'About & Services Pages',
          description: 'Design and development of about and services pages',
          price: 3000,
          type: 'fixed',
          estimated_hours: null,
          is_selected: true,
          is_required: false,
          order: 1
        },
        {
          id: 'deliv-3',
          title: 'Contact & Blog Pages',
          description: 'Design and development of contact and blog pages',
          price: 2500,
          type: 'fixed',
          estimated_hours: null,
          is_selected: false,
          is_required: false,
          order: 2
        },
        {
          id: 'deliv-4',
          title: 'SEO Optimization',
          description: 'Search engine optimization for all pages',
          price: 1500,
          type: 'fixed',
          estimated_hours: null,
          is_selected: true,
          is_required: false,
          order: 3
        }
      ],
      total_price: 12000,
      selected_price: 9500
    }
    
    return {
      success: true,
      data: mockProposal
    }
  } catch (error) {
    console.error('[Proposals] Fetch proposal error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 300))
    
    console.log('[WIREFRAME] Mock updating proposal status:', proposalId, status)
    
    return {
      success: true,
      data: {
        id: proposalId,
        status,
        updated_at: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('[Proposals] Update proposal status error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const conceptWithProposal = {
      ...conceptData,
      id: `concept-${Date.now()}`,
      proposal_id: proposalId,
      created_at: new Date().toISOString()
    }
    
    console.log('[WIREFRAME] Mock adding concept:', conceptWithProposal.title)
    
    return { success: true, data: conceptWithProposal }
  } catch (error) {
    console.error('[Proposals] Add concept error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const deliverableWithProposal = {
      ...deliverableData,
      id: `deliv-${Date.now()}`,
      proposal_id: proposalId,
      created_at: new Date().toISOString()
    }
    
    console.log('[WIREFRAME] Mock adding deliverable:', deliverableWithProposal.title)
    
    return { success: true, data: deliverableWithProposal }
  } catch (error) {
    console.error('[Proposals] Add deliverable error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 800))
    
    console.log('[WIREFRAME] Mock updating deliverable selections:', proposalId, selectedDeliverableIds)
    
    // Mock calculation of selected price
    const mockSelectedPrice = selectedDeliverableIds.length * 2500 // Mock price calculation
    
    return {
      success: true,
      data: {
        selectedPrice: mockSelectedPrice,
        selectedDeliverableIds
      }
    }
  } catch (error) {
    console.error('[Proposals] Update deliverable selections error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('[WIREFRAME] Mock approving proposal:', proposalId, selectedDeliverableIds, totalPrice)
    
    // Update proposal status and selections (mock)
    await updateDeliverableSelections(proposalId, selectedDeliverableIds)
    
    const mockResult = {
      id: proposalId,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_deliverables: selectedDeliverableIds,
      selected_price: totalPrice,
      updated_at: new Date().toISOString()
    }
    
    return { success: true, data: mockResult }
  } catch (error) {
    console.error('[Proposals] Approve proposal error:', error)
    return {
      success: false,
      error: error.message
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
    // WIREFRAME: Mock implementation - no real backend calls
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('[WIREFRAME] Mock deleting proposal:', proposalId)
    
    return { success: true }
  } catch (error) {
    console.error('[Proposals] Delete proposal error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}