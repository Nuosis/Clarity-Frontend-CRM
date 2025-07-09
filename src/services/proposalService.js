/**
 * Proposal Service
 * Business logic and data processing for proposals
 */

import * as proposalAPI from '../api/proposals';

/**
 * Processes raw proposal data from API
 * @param {Object} proposalData - Raw proposal data
 * @returns {Object} Processed proposal data
 */
export function processProposalData(proposalData) {
  if (!proposalData) return null;

  return {
    ...proposalData,
    id: proposalData.id,
    createdAt: proposalData.created_at,
    updatedAt: proposalData.updated_at,
    expiresAt: proposalData.expires_at,
    accessToken: proposalData.access_token,
    projectId: proposalData.project_id,
    customerId: proposalData.customer_id,
    totalPrice: parseFloat(proposalData.total_price) || 0,
    selectedPrice: parseFloat(proposalData.selected_price) || 0,
    approvedAt: proposalData.approved_at,
    approvedDeliverables: proposalData.approved_deliverables || [],
    requestSummary: proposalData.request_summary || {},
    deliverables: proposalData.deliverables?.map(processDeliverableData) || [],
    concepts: proposalData.concepts?.map(processConceptData) || []
  };
}

/**
 * Processes deliverable data
 * @param {Object} deliverableData - Raw deliverable data
 * @returns {Object} Processed deliverable data
 */
export function processDeliverableData(deliverableData) {
  if (!deliverableData) return null;

  return {
    ...deliverableData,
    id: deliverableData.id,
    proposalId: deliverableData.proposal_id,
    price: parseFloat(deliverableData.price) || 0,
    estimatedHours: parseInt(deliverableData.estimated_hours) || 0,
    isSelected: Boolean(deliverableData.is_selected),
    isRequired: Boolean(deliverableData.is_required),
    orderIndex: parseInt(deliverableData.order_index) || 0,
    createdAt: deliverableData.created_at
  };
}

/**
 * Processes concept data
 * @param {Object} conceptData - Raw concept data
 * @returns {Object} Processed concept data
 */
export function processConceptData(conceptData) {
  if (!conceptData) return null;

  return {
    ...conceptData,
    id: conceptData.id,
    proposalId: conceptData.proposal_id,
    thumbnailUrl: conceptData.thumbnail_url,
    orderIndex: parseInt(conceptData.order_index) || 0,
    createdAt: conceptData.created_at
  };
}

/**
 * Creates a new proposal with deliverables and concepts
 * @param {Object} proposalData - Proposal data
 * @param {Array} deliverables - Array of deliverables
 * @param {Array} concepts - Array of concepts
 * @returns {Promise<Object>} Creation result
 */
export async function createCompleteProposal(proposalData, deliverables = [], concepts = []) {
  try {
    // Calculate total price from deliverables
    const totalPrice = deliverables.reduce((sum, d) => sum + (d.price || 0), 0);
    
    // Create the main proposal
    const proposalResult = await proposalAPI.createProposal({
      ...proposalData,
      total_price: totalPrice
    });
    
    if (!proposalResult.success) {
      throw new Error(proposalResult.error);
    }
    
    const proposal = proposalResult.data;
    const proposalId = proposal.id;
    
    // Create deliverables and concepts in parallel if they exist
    const promises = [];
    
    if (deliverables.length > 0) {
      promises.push(proposalAPI.createProposalDeliverables(proposalId, deliverables));
    }
    
    if (concepts.length > 0) {
      promises.push(proposalAPI.createProposalConcepts(proposalId, concepts));
    }
    
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      
      // Check if any failed
      const failed = results.find(r => !r.success);
      if (failed) {
        console.warn('[Proposals] Some related data creation failed:', failed.error);
      }
    }
    
    return {
      success: true,
      data: processProposalData({
        ...proposal,
        deliverables,
        concepts
      })
    };
  } catch (error) {
    console.error('[Proposals] Create complete proposal error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetches complete proposal data for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Proposals result
 */
export async function fetchCompleteProposalsForProject(projectId) {
  try {
    const result = await proposalAPI.fetchProposalsForProject(projectId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    const processedProposals = result.data.map(processProposalData);
    
    return {
      success: true,
      data: processedProposals
    };
  } catch (error) {
    console.error('[Proposals] Fetch complete proposals error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetches complete proposal data by token (for client viewing)
 * @param {string} token - Access token
 * @returns {Promise<Object>} Proposal result
 */
export async function fetchCompleteProposalByToken(token) {
  try {
    const result = await proposalAPI.fetchProposalByToken(token);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    const processedProposal = processProposalData(result.data);
    
    // WIREFRAME: Mock access logging - no real backend calls
    console.log('[WIREFRAME] Mock logging proposal access:', processedProposal.id, token);
    
    return {
      success: true,
      data: processedProposal
    };
  } catch (error) {
    console.error('[Proposals] Fetch complete proposal by token error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculates proposal statistics
 * @param {Array} proposals - Array of proposals
 * @returns {Object} Statistics object
 */
export function calculateProposalStats(proposals) {
  if (!proposals || proposals.length === 0) {
    return {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      approved: 0,
      rejected: 0,
      totalValue: 0,
      approvedValue: 0
    };
  }
  
  const stats = proposals.reduce((acc, proposal) => {
    acc.total++;
    acc[proposal.status] = (acc[proposal.status] || 0) + 1;
    acc.totalValue += proposal.totalPrice || 0;
    
    if (proposal.status === 'approved') {
      acc.approvedValue += proposal.selectedPrice || proposal.totalPrice || 0;
    }
    
    return acc;
  }, {
    total: 0,
    draft: 0,
    sent: 0,
    viewed: 0,
    approved: 0,
    rejected: 0,
    totalValue: 0,
    approvedValue: 0
  });
  
  return stats;
}

/**
 * Validates proposal data before creation/update
 * @param {Object} proposalData - Proposal data to validate
 * @returns {Object} Validation result
 */
export function validateProposalData(proposalData) {
  const errors = [];
  
  if (!proposalData.title || proposalData.title.trim().length === 0) {
    errors.push('Title is required');
  }
  
  if (!proposalData.projectId) {
    errors.push('Project ID is required');
  }
  
  if (!proposalData.customerId) {
    errors.push('Customer ID is required');
  }
  
  if (proposalData.deliverables && proposalData.deliverables.length > 0) {
    proposalData.deliverables.forEach((deliverable, index) => {
      if (!deliverable.title || deliverable.title.trim().length === 0) {
        errors.push(`Deliverable ${index + 1}: Title is required`);
      }
      
      if (deliverable.price === undefined || deliverable.price < 0) {
        errors.push(`Deliverable ${index + 1}: Valid price is required`);
      }
      
      if (deliverable.type === 'hourly' && (!deliverable.estimatedHours || deliverable.estimatedHours <= 0)) {
        errors.push(`Deliverable ${index + 1}: Estimated hours required for hourly items`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates proposal URL for client access
 * @param {string} accessToken - Proposal access token
 * @returns {string} Complete proposal URL
 */
export function generateProposalURL(accessToken) {
  return `${window.location.origin}/proposal/${accessToken}`;
}

/**
 * Checks if a proposal has expired
 * @param {Object} proposal - Proposal object
 * @returns {boolean} True if expired
 */
export function isProposalExpired(proposal) {
  if (!proposal.expiresAt) return false;
  return new Date(proposal.expiresAt) < new Date();
}

/**
 * Gets the remaining time until proposal expires
 * @param {Object} proposal - Proposal object
 * @returns {Object} Time remaining object
 */
export function getProposalTimeRemaining(proposal) {
  if (!proposal.expiresAt) {
    return { expired: false, days: Infinity };
  }
  
  const now = new Date();
  const expiresAt = new Date(proposal.expiresAt);
  const diffMs = expiresAt - now;
  
  if (diffMs <= 0) {
    return { expired: true, days: 0 };
  }
  
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return { expired: false, days };
}