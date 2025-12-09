/**
 * Extended Proposal Service
 * Business logic for proposal requirements, packages, and projects
 */

import * as extendedAPI from '../api/proposalExtended';

// ============================================================================
// DATA PROCESSORS
// ============================================================================

/**
 * Process requirement data from API
 * @param {Object} requirementData - Raw requirement data
 * @returns {Object} Processed requirement data
 */
export function processRequirementData(requirementData) {
  if (!requirementData) return null;

  return {
    ...requirementData,
    id: requirementData.id,
    proposalId: requirementData.proposal_id,
    isFulfilled: Boolean(requirementData.is_fulfilled),
    isRequired: Boolean(requirementData.is_required),
    fulfilledAt: requirementData.fulfilled_at,
    fulfilledBy: requirementData.fulfilled_by,
    orderIndex: parseInt(requirementData.order_index) || 0,
    createdAt: requirementData.created_at,
    updatedAt: requirementData.updated_at
  };
}

/**
 * Process package data from API
 * @param {Object} packageData - Raw package data
 * @returns {Object} Processed package data
 */
export function processPackageData(packageData) {
  if (!packageData) return null;

  return {
    ...packageData,
    id: packageData.id,
    proposalId: packageData.proposal_id,
    basePrice: parseFloat(packageData.base_price) || 0,
    discountPercentage: parseFloat(packageData.discount_percentage) || 0,
    finalPrice: parseFloat(packageData.final_price) || 0,
    isFeatured: Boolean(packageData.is_featured),
    isAvailable: Boolean(packageData.is_available),
    orderIndex: parseInt(packageData.order_index) || 0,
    badgeText: packageData.badge_text,
    badgeColor: packageData.badge_color,
    deliverables: packageData.deliverables?.map(processDeliverableData) || [],
    requirements: packageData.requirements?.map(processRequirementData) || [],
    createdAt: packageData.created_at,
    updatedAt: packageData.updated_at
  };
}

/**
 * Process deliverable data (includes subscription fields)
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
    billingInterval: deliverableData.billing_interval,
    subscriptionDurationMonths: parseInt(deliverableData.subscription_duration_months) || null,
    createdAt: deliverableData.created_at
  };
}

/**
 * Process project data from API
 * @param {Object} projectData - Raw project data
 * @returns {Object} Processed project data
 */
export function processProjectData(projectData) {
  if (!projectData) return null;

  return {
    ...projectData,
    id: projectData.id,
    customerId: projectData.customer_id,
    startDate: projectData.start_date,
    targetEndDate: projectData.target_end_date,
    actualEndDate: projectData.actual_end_date,
    budget: parseFloat(projectData.budget) || 0,
    githubRepoUrl: projectData.github_repo_url,
    projectLink: projectData.project_link,
    createdAt: projectData.created_at,
    updatedAt: projectData.updated_at,
    createdBy: projectData.created_by
  };
}

// ============================================================================
// REQUIREMENTS SERVICES
// ============================================================================

/**
 * Fetch and process requirements for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Processed requirements
 */
export async function getProposalRequirements(proposalId) {
  try {
    const result = await extendedAPI.fetchProposalRequirements(proposalId);

    if (!result.success) {
      throw new Error(result.error);
    }

    const processed = result.data.map(processRequirementData);

    return {
      success: true,
      data: processed
    };
  } catch (error) {
    console.error('[RequirementsService] Get requirements error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate requirement fulfillment statistics
 * @param {Array} requirements - Array of requirements
 * @returns {Object} Statistics object
 */
export function calculateRequirementStats(requirements) {
  if (!requirements || requirements.length === 0) {
    return {
      total: 0,
      fulfilled: 0,
      pending: 0,
      required: 0,
      optional: 0,
      fulfillmentRate: 0
    };
  }

  const stats = requirements.reduce((acc, req) => {
    acc.total++;
    if (req.isFulfilled) acc.fulfilled++;
    else acc.pending++;
    if (req.isRequired) acc.required++;
    else acc.optional++;
    return acc;
  }, {
    total: 0,
    fulfilled: 0,
    pending: 0,
    required: 0,
    optional: 0
  });

  stats.fulfillmentRate = stats.total > 0 ? (stats.fulfilled / stats.total) * 100 : 0;

  return stats;
}

/**
 * Validate requirement data
 * @param {Object} requirementData - Requirement data to validate
 * @returns {Object} Validation result
 */
export function validateRequirementData(requirementData) {
  const errors = [];

  if (!requirementData.title || requirementData.title.trim().length === 0) {
    errors.push('Requirement title is required');
  }

  if (!requirementData.proposalId && !requirementData.proposal_id) {
    errors.push('Proposal ID is required');
  }

  const validCategories = ['content', 'access', 'assets', 'documentation', 'credentials', 'other'];
  if (requirementData.category && !validCategories.includes(requirementData.category)) {
    errors.push('Invalid requirement category');
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (requirementData.priority && !validPriorities.includes(requirementData.priority)) {
    errors.push('Invalid priority level');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// PACKAGES SERVICES
// ============================================================================

/**
 * Fetch and process packages for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Processed packages with full deliverables and requirements
 */
export async function getProposalPackages(proposalId) {
  try {
    const result = await extendedAPI.fetchProposalPackages(proposalId);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Fetch complete data for each package (includes deliverables and requirements)
    const completePackages = await Promise.all(
      result.data.map(async (pkg) => {
        const completeResult = await extendedAPI.fetchCompletePackage(pkg.id);
        return completeResult.success ? completeResult.data : pkg;
      })
    );

    const processed = completePackages.map(processPackageData);

    console.log('[PackagesService] Fetched and processed packages:', {
      proposalId,
      packageCount: processed.length,
      packagesWithDeliverables: processed.filter(p => p.deliverables && p.deliverables.length > 0).length
    });

    return {
      success: true,
      data: processed
    };
  } catch (error) {
    console.error('[PackagesService] Get packages error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate package price based on deliverables and discount
 * @param {Array} deliverables - Array of deliverables
 * @param {number} discountPercentage - Discount percentage (0-100)
 * @returns {Object} Price breakdown
 */
export function calculatePackagePrice(deliverables, discountPercentage = 0) {
  const basePrice = deliverables.reduce((sum, d) => {
    const price = d.package_relationship?.price_override || d.price || 0;
    return sum + parseFloat(price);
  }, 0);

  const discountAmount = (basePrice * discountPercentage) / 100;
  const finalPrice = basePrice - discountAmount;

  return {
    basePrice,
    discountAmount,
    discountPercentage,
    finalPrice
  };
}

/**
 * Validate package data
 * @param {Object} packageData - Package data to validate
 * @returns {Object} Validation result
 */
export function validatePackageData(packageData) {
  const errors = [];

  if (!packageData.name || packageData.name.trim().length === 0) {
    errors.push('Package name is required');
  }

  if (!packageData.proposalId && !packageData.proposal_id) {
    errors.push('Proposal ID is required');
  }

  if (packageData.basePrice !== undefined && packageData.basePrice < 0) {
    errors.push('Base price cannot be negative');
  }

  if (packageData.discountPercentage !== undefined) {
    const discount = parseFloat(packageData.discountPercentage);
    if (discount < 0 || discount > 100) {
      errors.push('Discount percentage must be between 0 and 100');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a package with automatic price calculation
 * @param {string} proposalId - Proposal ID
 * @param {Object} packageData - Package data
 * @param {Array} deliverableIds - Deliverable IDs to include
 * @param {Array} requirementIds - Requirement IDs to include
 * @returns {Promise<Object>} Created package
 */
export async function createPackageWithPricing(proposalId, packageData, deliverableIds = [], requirementIds = []) {
  try {
    // The backend automatically calculates pricing based on deliverables
    const result = await extendedAPI.createCompletePackage(
      proposalId,
      packageData,
      deliverableIds,
      requirementIds
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      data: processPackageData(result.data)
    };
  } catch (error) {
    console.error('[PackagesService] Create package with pricing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// DELIVERABLES SERVICES (SUBSCRIPTION SUPPORT)
// ============================================================================

/**
 * Calculate monthly recurring revenue from subscription deliverables
 * @param {Array} deliverables - Array of deliverables
 * @returns {Object} MRR breakdown
 */
export function calculateSubscriptionMRR(deliverables) {
  const subscriptionDeliverables = deliverables.filter(d => d.type === 'subscription');

  const mrr = subscriptionDeliverables.reduce((sum, d) => {
    const price = parseFloat(d.price) || 0;
    const interval = d.billingInterval;

    let monthlyPrice = 0;
    switch (interval) {
      case 'monthly':
        monthlyPrice = price;
        break;
      case 'quarterly':
        monthlyPrice = price / 3;
        break;
      case 'yearly':
        monthlyPrice = price / 12;
        break;
      default:
        monthlyPrice = 0;
    }

    return sum + monthlyPrice;
  }, 0);

  return {
    totalMRR: mrr,
    subscriptionCount: subscriptionDeliverables.length,
    breakdown: subscriptionDeliverables.map(d => ({
      id: d.id,
      title: d.title,
      price: d.price,
      billingInterval: d.billingInterval,
      monthlyEquivalent: d.billingInterval === 'monthly' ? d.price :
                        d.billingInterval === 'quarterly' ? d.price / 3 :
                        d.billingInterval === 'yearly' ? d.price / 12 : 0
    }))
  };
}

/**
 * Validate deliverable data (with subscription support)
 * @param {Object} deliverableData - Deliverable data to validate
 * @returns {Object} Validation result
 */
export function validateDeliverableData(deliverableData) {
  const errors = [];

  if (!deliverableData.title || deliverableData.title.trim().length === 0) {
    errors.push('Deliverable title is required');
  }

  if (deliverableData.price === undefined || deliverableData.price < 0) {
    errors.push('Valid price is required');
  }

  const validTypes = ['fixed', 'hourly', 'subscription'];
  if (!deliverableData.type || !validTypes.includes(deliverableData.type)) {
    errors.push('Valid deliverable type is required (fixed, hourly, or subscription)');
  }

  if (deliverableData.type === 'hourly' && (!deliverableData.estimatedHours || deliverableData.estimatedHours <= 0)) {
    errors.push('Estimated hours required for hourly deliverables');
  }

  if (deliverableData.type === 'subscription') {
    const validIntervals = ['monthly', 'quarterly', 'yearly'];
    if (!deliverableData.billingInterval || !validIntervals.includes(deliverableData.billingInterval)) {
      errors.push('Valid billing interval required for subscription deliverables (monthly, quarterly, or yearly)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// PROJECTS SERVICES
// ============================================================================

/**
 * Fetch and process project data
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Processed project
 */
export async function getProject(projectId) {
  try {
    const result = await extendedAPI.fetchProject(projectId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      data: processProjectData(result.data)
    };
  } catch (error) {
    console.error('[ProjectsService] Get project error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch projects for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Processed projects
 */
export async function getCustomerProjects(customerId) {
  try {
    const result = await extendedAPI.fetchProjectsByCustomer(customerId);

    if (!result.success) {
      throw new Error(result.error);
    }

    const processed = result.data.map(processProjectData);

    return {
      success: true,
      data: processed
    };
  } catch (error) {
    console.error('[ProjectsService] Get customer projects error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate project data
 * @param {Object} projectData - Project data to validate
 * @returns {Object} Validation result
 */
export function validateProjectData(projectData) {
  const errors = [];

  if (!projectData.name || projectData.name.trim().length === 0) {
    errors.push('Project name is required');
  }

  if (!projectData.customerId && !projectData.customer_id) {
    errors.push('Customer ID is required');
  }

  const validStatuses = ['active', 'pending', 'on_hold', 'completed', 'cancelled'];
  if (projectData.status && !validStatuses.includes(projectData.status)) {
    errors.push('Invalid project status');
  }

  if (projectData.budget !== undefined && projectData.budget < 0) {
    errors.push('Budget cannot be negative');
  }

  // Date validations
  if (projectData.startDate && projectData.targetEndDate) {
    const start = new Date(projectData.startDate);
    const end = new Date(projectData.targetEndDate);
    if (start > end) {
      errors.push('Target end date must be after start date');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// COMPLETE PROPOSAL DATA
// ============================================================================

/**
 * Fetch all extended proposal data
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} Complete proposal data with requirements and packages
 */
export async function getCompleteExtendedProposalData(proposalId) {
  try {
    const result = await extendedAPI.fetchCompleteProposalData(proposalId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      data: {
        requirements: result.data.requirements.map(processRequirementData),
        packages: result.data.packages.map(processPackageData),
        requirementStats: calculateRequirementStats(result.data.requirements),
        subscriptionMRR: calculateSubscriptionMRR(
          result.data.packages.flatMap(pkg => pkg.deliverables || [])
        )
      }
    };
  } catch (error) {
    console.error('[ProposalService] Get complete extended data error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export all functions
export default {
  // Processors
  processRequirementData,
  processPackageData,
  processDeliverableData,
  processProjectData,

  // Requirements
  getProposalRequirements,
  calculateRequirementStats,
  validateRequirementData,

  // Packages
  getProposalPackages,
  calculatePackagePrice,
  validatePackageData,
  createPackageWithPricing,

  // Deliverables (Subscription)
  calculateSubscriptionMRR,
  validateDeliverableData,

  // Projects
  getProject,
  getCustomerProjects,
  validateProjectData,

  // Complete data
  getCompleteExtendedProposalData
};
