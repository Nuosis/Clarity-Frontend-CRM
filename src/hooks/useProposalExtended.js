/**
 * Extended Proposal Hooks
 * React hooks for managing proposal requirements, packages, and projects
 */

import { useState, useCallback, useEffect } from 'react';
import * as extendedAPI from '../api/proposalExtended';
import * as extendedService from '../services/proposalExtendedService';

// ============================================================================
// REQUIREMENTS HOOK
// ============================================================================

/**
 * Hook for managing proposal requirements
 * @param {string} proposalId - Proposal ID
 * @returns {Object} Requirements state and operations
 */
export function useProposalRequirements(proposalId) {
  console.log('[useProposalRequirements] Hook called with proposalId:', proposalId);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Fetch requirements
  const fetchRequirements = useCallback(async () => {
    console.log('[useProposalRequirements] fetchRequirements called with proposalId:', proposalId, 'type:', typeof proposalId);
    if (!proposalId) {
      console.log('[useProposalRequirements] proposalId is falsy, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await extendedService.getProposalRequirements(proposalId);

      if (!result.success) {
        throw new Error(result.error);
      }

      setRequirements(result.data);
      setStats(extendedService.calculateRequirementStats(result.data));
    } catch (err) {
      setError(err.message);
      console.error('[useProposalRequirements] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // Create requirement
  const createRequirement = useCallback(async (requirementData) => {
    setLoading(true);
    setError(null);

    try {
      // Validate data
      const validation = extendedService.validateRequirementData({
        ...requirementData,
        proposalId
      });

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const result = await extendedAPI.createProposalRequirement({
        ...requirementData,
        proposal_id: proposalId
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh requirements
      await fetchRequirements();

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalRequirements] Create error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [proposalId, fetchRequirements]);

  // Update requirement
  const updateRequirement = useCallback(async (requirementId, updateData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.updateProposalRequirement(requirementId, updateData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh requirements
      await fetchRequirements();

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalRequirements] Update error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchRequirements]);

  // Delete requirement
  const deleteRequirement = useCallback(async (requirementId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.deleteProposalRequirement(requirementId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh requirements
      await fetchRequirements();

      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalRequirements] Delete error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchRequirements]);

  // Mark requirement as fulfilled
  const fulfillRequirement = useCallback(async (requirementId, fulfilledBy) => {
    return await updateRequirement(requirementId, {
      is_fulfilled: true,
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: fulfilledBy
    });
  }, [updateRequirement]);

  // Load requirements on mount
  useEffect(() => {
    console.log('[useProposalRequirements] useEffect running, about to call fetchRequirements');
    fetchRequirements();
  }, [fetchRequirements]);

  return {
    requirements,
    stats,
    loading,
    error,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    fulfillRequirement,
    refresh: fetchRequirements
  };
}

// ============================================================================
// PACKAGES HOOK
// ============================================================================

/**
 * Hook for managing proposal packages
 * @param {string} proposalId - Proposal ID
 * @returns {Object} Packages state and operations
 */
export function useProposalPackages(proposalId) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch packages
  const fetchPackages = useCallback(async () => {
    if (!proposalId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await extendedService.getProposalPackages(proposalId);

      if (!result.success) {
        throw new Error(result.error);
      }

      setPackages(result.data);
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // Create package
  const createPackage = useCallback(async (packageData, deliverableIds = [], requirementIds = []) => {
    setLoading(true);
    setError(null);

    try {
      // Validate data
      const validation = extendedService.validatePackageData({
        ...packageData,
        proposalId
      });

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const result = await extendedService.createPackageWithPricing(
        proposalId,
        packageData,
        deliverableIds,
        requirementIds
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh packages
      await fetchPackages();

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Create error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [proposalId, fetchPackages]);

  // Update package
  const updatePackage = useCallback(async (packageId, updateData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.updateProposalPackage(packageId, updateData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh packages
      await fetchPackages();

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Update error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchPackages]);

  // Delete package
  const deletePackage = useCallback(async (packageId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.deleteProposalPackage(packageId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh packages
      await fetchPackages();

      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Delete error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchPackages]);

  // Add deliverable to package
  const addDeliverableToPackage = useCallback(async (packageId, deliverableId, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.addDeliverableToPackage(packageId, deliverableId, options);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh packages
      await fetchPackages();

      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Add deliverable error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchPackages]);

  // Remove deliverable from package
  const removeDeliverableFromPackage = useCallback(async (packageId, deliverableId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.removeDeliverableFromPackage(packageId, deliverableId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh packages
      await fetchPackages();

      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('[useProposalPackages] Remove deliverable error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchPackages]);

  // Load packages on mount
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  return {
    packages,
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage,
    addDeliverableToPackage,
    removeDeliverableFromPackage,
    refresh: fetchPackages
  };
}

// ============================================================================
// PROJECTS HOOK
// ============================================================================

/**
 * Hook for managing projects
 * @param {string} customerId - Customer ID (optional)
 * @returns {Object} Projects state and operations
 */
export function useProjects(customerId = null) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch projects for customer
  const fetchProjects = useCallback(async () => {
    if (!customerId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await extendedService.getCustomerProjects(customerId);

      if (!result.success) {
        throw new Error(result.error);
      }

      setProjects(result.data);
    } catch (err) {
      setError(err.message);
      console.error('[useProjects] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Create project
  const createProject = useCallback(async (projectData) => {
    setLoading(true);
    setError(null);

    try {
      // Validate data
      const validation = extendedService.validateProjectData({
        ...projectData,
        customerId: customerId || projectData.customerId
      });

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const result = await extendedAPI.createProject({
        ...projectData,
        customer_id: customerId || projectData.customer_id
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh projects
      if (customerId) {
        await fetchProjects();
      }

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProjects] Create error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [customerId, fetchProjects]);

  // Update project
  const updateProject = useCallback(async (projectId, updateData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.updateProject(projectId, updateData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh projects
      if (customerId) {
        await fetchProjects();
      }

      return { success: true, data: result.data };
    } catch (err) {
      setError(err.message);
      console.error('[useProjects] Update error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [customerId, fetchProjects]);

  // Delete project
  const deleteProject = useCallback(async (projectId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await extendedAPI.deleteProject(projectId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh projects
      if (customerId) {
        await fetchProjects();
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('[useProjects] Delete error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [customerId, fetchProjects]);

  // Load projects on mount if customerId is provided
  useEffect(() => {
    if (customerId) {
      fetchProjects();
    }
  }, [customerId, fetchProjects]);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: fetchProjects
  };
}

// ============================================================================
// COMPLETE PROPOSAL HOOK
// ============================================================================

/**
 * Hook for managing complete proposal data (including extended features)
 * @param {string} proposalId - Proposal ID
 * @returns {Object} Complete proposal state and operations
 */
export function useCompleteProposal(proposalId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch complete proposal data
  const fetchCompleteData = useCallback(async () => {
    if (!proposalId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await extendedService.getCompleteExtendedProposalData(proposalId);

      if (!result.success) {
        throw new Error(result.error);
      }

      setData(result.data);
    } catch (err) {
      setError(err.message);
      console.error('[useCompleteProposal] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // Load data on mount
  useEffect(() => {
    fetchCompleteData();
  }, [fetchCompleteData]);

  return {
    requirements: data?.requirements || [],
    packages: data?.packages || [],
    requirementStats: data?.requirementStats || null,
    subscriptionMRR: data?.subscriptionMRR || null,
    loading,
    error,
    refresh: fetchCompleteData
  };
}

// Export all hooks
export default {
  useProposalRequirements,
  useProposalPackages,
  useProjects,
  useCompleteProposal
};
