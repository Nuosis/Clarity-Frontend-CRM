/**
 * Extended Proposal API Module
 * Handles API operations for proposal requirements, packages, and related entities
 * Integrates with backend API at api.claritybusinesssolutions.ca
 */

import axios from 'axios';
import { backendConfig } from '../config';

// ============================================================================
// HMAC AUTHENTICATION
// ============================================================================

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
async function generateAuthHeader(payload = '') {
  const secretKey = import.meta.env.VITE_SECRET_KEY;

  if (!secretKey) {
    console.warn('[ProposalExtended] SECRET_KEY not available. Using development mode.');
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer dev-token.${timestamp}`;
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[ProposalExtended] Web Crypto API not available. Using fallback auth.');
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer fallback-token.${timestamp}`;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `Bearer ${signatureHex}.${timestamp}`;
  } catch (error) {
    console.warn('[ProposalExtended] Crypto operation failed, using fallback:', error);
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer fallback-token.${timestamp}`;
  }
}

/**
 * Make authenticated API request to backend
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} data - Request data
 * @returns {Promise<Object>} API response
 */
async function apiRequest(method, path, data = null) {
  try {
    const config = {
      method,
      url: `${backendConfig.baseUrl}${path}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
      const payload = JSON.stringify(data);
      config.headers.Authorization = await generateAuthHeader(payload);
    } else {
      config.headers.Authorization = await generateAuthHeader();
    }

    console.log('[ProposalExtended] Making API request:', method, path, 'data:', data);
    const response = await axios(config);
    console.log('[ProposalExtended] API response:', response.status, 'Full data:', JSON.stringify(response.data, null, 2));

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[ProposalExtended] API error:', error);

    const errorMessage = error.response?.data?.detail ||
                        error.response?.data?.message ||
                        error.message ||
                        'Unknown API error';

    return {
      success: false,
      error: errorMessage
    };
  }
}

// ============================================================================
// PROPOSAL REQUIREMENTS API
// ============================================================================

/**
 * Fetch all requirements for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Result with requirements data
 */
export async function fetchProposalRequirements(proposalId) {
  try {
    const result = await apiRequest('GET', `/proposals/${proposalId}/requirements`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequirements] Fetched requirements for proposal:', proposalId);
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('[ProposalRequirements] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new proposal requirement
 * @param {Object} requirementData - Requirement data
 * @returns {Promise<Object>} Created requirement
 */
export async function createProposalRequirement(requirementData) {
  try {
    const proposalId = requirementData.proposal_id;
    if (!proposalId) {
      throw new Error('proposal_id is required');
    }

    const result = await apiRequest('POST', `/proposals/${proposalId}/requirements`, requirementData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequirements] Created requirement:', result.data);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequirements] Create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a proposal requirement
 * @param {string} requirementId - Requirement ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated requirement
 */
export async function updateProposalRequirement(requirementId, updateData) {
  try {
    const result = await apiRequest('PUT', `/proposals/requirements/${requirementId}`, updateData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequirements] Updated requirement:', requirementId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequirements] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a proposal requirement
 * @param {string} requirementId - Requirement ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProposalRequirement(requirementId) {
  try {
    const result = await apiRequest('DELETE', `/proposals/requirements/${requirementId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequirements] Deleted requirement:', requirementId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequirements] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Mark a requirement as fulfilled
 * @param {string} requirementId - Requirement ID
 * @param {string} fulfilledBy - Who fulfilled the requirement
 * @returns {Promise<Object>} Updated requirement
 */
export async function fulfillProposalRequirement(requirementId, fulfilledBy) {
  try {
    const updateData = {
      is_fulfilled: true,
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: fulfilledBy
    };

    return await updateProposalRequirement(requirementId, updateData);
  } catch (error) {
    console.error('[ProposalRequirements] Fulfill error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PROPOSAL PACKAGES API
// ============================================================================

/**
 * Fetch all packages for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Result with packages data
 */
export async function fetchProposalPackages(proposalId) {
  try {
    const result = await apiRequest('GET', `/proposals/${proposalId}/packages`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalPackages] Fetched packages for proposal:', proposalId);
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('[ProposalPackages] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch complete package data with deliverables and requirements
 * @param {string} packageId - Package ID
 * @returns {Promise<Object>} Complete package data
 */
export async function fetchCompletePackage(packageId) {
  try {
    const result = await apiRequest('GET', `/proposals/packages/${packageId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalPackages] Fetched complete package:', packageId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalPackages] Fetch complete package error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new proposal package
 * @param {Object} packageData - Package data
 * @returns {Promise<Object>} Created package
 */
export async function createProposalPackage(packageData) {
  try {
    const proposalId = packageData.proposal_id;
    if (!proposalId) {
      throw new Error('proposal_id is required');
    }

    const result = await apiRequest('POST', `/proposals/${proposalId}/packages`, packageData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalPackages] Created package:', result.data);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalPackages] Create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a proposal package
 * @param {string} packageId - Package ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated package
 */
export async function updateProposalPackage(packageId, updateData) {
  try {
    console.log('[ProposalPackages] Update called with data:', JSON.stringify(updateData, null, 2));
    const result = await apiRequest('PUT', `/proposals/packages/${packageId}`, updateData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalPackages] Updated package:', packageId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalPackages] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a proposal package
 * @param {string} packageId - Package ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProposalPackage(packageId) {
  try {
    const result = await apiRequest('DELETE', `/proposals/packages/${packageId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalPackages] Deleted package:', packageId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalPackages] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PACKAGE-DELIVERABLE RELATIONSHIP API
// ============================================================================

/**
 * Add a deliverable to a package
 * Note: This is handled by the backend when creating/updating packages
 * @param {string} packageId - Package ID
 * @param {string} deliverableId - Deliverable ID
 * @param {Object} options - Optional settings (price_override, is_required_in_package, order_index)
 * @returns {Promise<Object>} Created relationship
 */
export async function addDeliverableToPackage(packageId, deliverableId, options = {}) {
  try {
    // The backend handles package-deliverable relationships
    // This is a placeholder for compatibility
    console.log('[PackageDeliverables] Added deliverable to package:', deliverableId);
    return {
      success: true,
      data: { package_id: packageId, deliverable_id: deliverableId, ...options }
    };
  } catch (error) {
    console.error('[PackageDeliverables] Add error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove a deliverable from a package
 * Note: This is handled by the backend when updating packages
 * @param {string} packageId - Package ID
 * @param {string} deliverableId - Deliverable ID
 * @returns {Promise<Object>} Delete result
 */
export async function removeDeliverableFromPackage(packageId, deliverableId) {
  try {
    // The backend handles package-deliverable relationships
    // This is a placeholder for compatibility
    console.log('[PackageDeliverables] Removed deliverable from package:', { packageId, deliverableId });
    return {
      success: true,
      data: {}
    };
  } catch (error) {
    console.error('[PackageDeliverables] Remove error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch all deliverables for a package
 * @param {string} packageId - Package ID
 * @returns {Promise<Object>} Package deliverables with full deliverable data
 */
export async function fetchPackageDeliverables(packageId) {
  try {
    // Fetch complete package which includes deliverables
    const result = await fetchCompletePackage(packageId);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[PackageDeliverables] Fetched deliverables for package:', packageId);
    return {
      success: true,
      data: result.data?.deliverables || []
    };
  } catch (error) {
    console.error('[PackageDeliverables] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PACKAGE-REQUIREMENT RELATIONSHIP API
// ============================================================================

/**
 * Add a requirement to a package
 * Note: This is handled by the backend when creating/updating packages
 * @param {string} packageId - Package ID
 * @param {string} requirementId - Requirement ID
 * @param {Object} options - Optional settings (is_required_in_package, order_index)
 * @returns {Promise<Object>} Created relationship
 */
export async function addRequirementToPackage(packageId, requirementId, options = {}) {
  try {
    // The backend handles package-requirement relationships
    // This is a placeholder for compatibility
    console.log('[PackageRequirements] Added requirement to package:', requirementId);
    return {
      success: true,
      data: { package_id: packageId, requirement_id: requirementId, ...options }
    };
  } catch (error) {
    console.error('[PackageRequirements] Add error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove a requirement from a package
 * Note: This is handled by the backend when updating packages
 * @param {string} packageId - Package ID
 * @param {string} requirementId - Requirement ID
 * @returns {Promise<Object>} Delete result
 */
export async function removeRequirementFromPackage(packageId, requirementId) {
  try {
    // The backend handles package-requirement relationships
    // This is a placeholder for compatibility
    console.log('[PackageRequirements] Removed requirement from package:', { packageId, requirementId });
    return {
      success: true,
      data: {}
    };
  } catch (error) {
    console.error('[PackageRequirements] Remove error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch all requirements for a package
 * @param {string} packageId - Package ID
 * @returns {Promise<Object>} Package requirements with full requirement data
 */
export async function fetchPackageRequirements(packageId) {
  try {
    // Fetch complete package which includes requirements
    const result = await fetchCompletePackage(packageId);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[PackageRequirements] Fetched requirements for package:', packageId);
    return {
      success: true,
      data: result.data?.requirements || []
    };
  } catch (error) {
    console.error('[PackageRequirements] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PROJECTS API
// ============================================================================

/**
 * Fetch project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project data
 */
export async function fetchProject(projectId) {
  try {
    const result = await apiRequest('GET', `/proposals/projects/${projectId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Projects] Fetched project:', projectId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[Projects] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch all projects for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Projects data
 */
export async function fetchProjectsByCustomer(customerId) {
  try {
    const result = await apiRequest('GET', `/proposals/projects?customer_id=${customerId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Projects] Fetched projects for customer:', customerId);
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('[Projects] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new project
 * @param {Object} projectData - Project data
 * @returns {Promise<Object>} Created project
 */
export async function createProject(projectData) {
  try {
    const result = await apiRequest('POST', '/proposals/projects', projectData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Projects] Created project:', result.data);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[Projects] Create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a project
 * @param {string} projectId - Project ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated project
 */
export async function updateProject(projectId, updateData) {
  try {
    const result = await apiRequest('PUT', `/proposals/projects/${projectId}`, updateData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Projects] Updated project:', projectId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[Projects] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProject(projectId) {
  try {
    const result = await apiRequest('DELETE', `/proposals/projects/${projectId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Projects] Deleted project:', projectId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[Projects] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PROPOSAL DELIVERABLES API
// ============================================================================

/**
 * Fetch all deliverables for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Result with deliverables data
 */
export async function fetchProposalDeliverables(proposalId) {
  try {
    const result = await apiRequest('GET', `/proposals/${proposalId}/deliverables`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalDeliverables] Fetched deliverables for proposal:', proposalId);
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('[ProposalDeliverables] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new proposal deliverable
 * @param {Object} deliverableData - Deliverable data
 * @returns {Promise<Object>} Created deliverable
 */
export async function createProposalDeliverable(deliverableData) {
  try {
    const proposalId = deliverableData.proposal_id;
    if (!proposalId) {
      throw new Error('proposal_id is required');
    }

    const result = await apiRequest('POST', `/proposals/${proposalId}/deliverables`, deliverableData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalDeliverables] Created deliverable:', result.data);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalDeliverables] Create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a proposal deliverable
 * @param {string} deliverableId - Deliverable ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated deliverable
 */
export async function updateProposalDeliverable(deliverableId, updateData) {
  try {
    console.log('[ProposalDeliverables] Updating deliverable:', deliverableId, 'with data:', updateData);
    const result = await apiRequest('PUT', `/proposals/deliverables/${deliverableId}`, updateData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalDeliverables] Updated deliverable:', deliverableId, 'result:', result);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalDeliverables] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a proposal deliverable
 * @param {string} deliverableId - Deliverable ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProposalDeliverable(deliverableId) {
  try {
    const result = await apiRequest('DELETE', `/proposals/deliverables/${deliverableId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalDeliverables] Deleted deliverable:', deliverableId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalDeliverables] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PROPOSAL REQUESTS API
// ============================================================================

/**
 * Fetch all requests for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Result with requests data
 */
export async function fetchProposalRequests(proposalId) {
  try {
    const result = await apiRequest('GET', `/proposals/${proposalId}/requests`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequests] Fetched requests for proposal:', proposalId);
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('[ProposalRequests] Fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new proposal request
 * @param {Object} requestData - Request data
 * @returns {Promise<Object>} Created request
 */
export async function createProposalRequest(requestData) {
  try {
    const proposalId = requestData.proposal_id;
    if (!proposalId) {
      throw new Error('proposal_id is required');
    }

    const result = await apiRequest('POST', `/proposals/${proposalId}/requests`, requestData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequests] Created request:', result.data);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequests] Create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a proposal request
 * @param {string} requestId - Request ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated request
 */
export async function updateProposalRequest(requestId, updateData) {
  try {
    const result = await apiRequest('PUT', `/proposals/requests/${requestId}`, updateData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequests] Updated request:', requestId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequests] Update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a proposal request
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteProposalRequest(requestId) {
  try {
    const result = await apiRequest('DELETE', `/proposals/requests/${requestId}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ProposalRequests] Deleted request:', requestId);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[ProposalRequests] Delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Create a complete package with deliverables and requirements
 * @param {string} proposalId - Proposal ID
 * @param {Object} packageData - Package data
 * @param {Array} deliverableIds - Array of deliverable IDs to include
 * @param {Array} requirementIds - Array of requirement IDs to include
 * @returns {Promise<Object>} Created package with relationships
 */
export async function createCompletePackage(proposalId, packageData, deliverableIds = [], requirementIds = []) {
  try {
    // The backend handles package creation with relationships
    const completePackageData = {
      ...packageData,
      proposal_id: proposalId,
      deliverable_ids: deliverableIds,
      requirement_ids: requirementIds
    };

    const result = await createProposalPackage(completePackageData);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[Packages] Created complete package:', result.data.id);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[Packages] Create complete package error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch complete proposal data including all related entities
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Complete proposal data
 */
export async function fetchCompleteProposalData(proposalId) {
  try {
    // Fetch all data in parallel
    const [requirementsResult, packagesResult, requestsResult] = await Promise.all([
      fetchProposalRequirements(proposalId),
      fetchProposalPackages(proposalId),
      fetchProposalRequests(proposalId)
    ]);

    // For each package, fetch its complete details
    const packageDetails = await Promise.all(
      (packagesResult.data || []).map(pkg => fetchCompletePackage(pkg.id))
    );

    console.log('[Proposals] Fetched complete proposal data:', proposalId);
    return {
      success: true,
      data: {
        requirements: requirementsResult.data || [],
        packages: packageDetails.map(p => p.data).filter(Boolean),
        requests: requestsResult.data || []
      }
    };
  } catch (error) {
    console.error('[Proposals] Fetch complete data error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
