import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    fetchProjectsForCustomer,
    updateProjectStatus,
    createProject,
    updateProject,
    fetchProjectsForCustomers,
    fetchProjectNotes,
    deleteProject,
    fetchProjectWithDetails,
    createObjective,
    updateObjective,
    deleteObjective,
    createStep,
    updateStep,
    deleteStep,
    toggleStepCompleted
} from '../api';
import { useProjectRecords } from '../context/ProjectContext';
import { useSnackBar } from '../context/SnackBarContext';
import { useAppState } from '../context/AppStateContext';
import {
    processProjectData,
    validateProjectData,
    formatProjectForFileMaker,
    formatProjectForBackend,
    calculateProjectCompletion,
    processProjectImages,
    processProjectLinks,
    processProjectObjectives,
    processProjectValue,
    updateProjectRecordsBillableStatus
} from '../services/projectService';
import { createSalesFromProjectValue } from '../services/salesService';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { formatProjectErrorForUI } from '../errors';

/**
 * Hook for managing project state and operations
 */
export function useProject(customerId = null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formattedError, setFormattedError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [pagination, setPagination] = useState({
        total: 0,
        limit: 50,
        offset: 0,
        has_more: false
    });
    const projectSelectionRequestId = useRef(0);
    const paginationRef = useRef(pagination);
    const projectRecords = useProjectRecords();
    const { showError } = useSnackBar();
    const { user } = useAppState();

    /**
     * Helper function to set error state with formatting
     * @param {Error} err - Error object
     */
    const setErrorWithFormatting = useCallback((err) => {
        const formatted = formatProjectErrorForUI(err);
        setError(formatted.message);
        setFormattedError(formatted);
        console.error('[useProject] Error:', {
            raw: err,
            formatted,
            stack: err?.stack
        });
    }, []);

    const clearErrorState = useCallback(() => {
        setError(null);
        setFormattedError(null);
    }, []);

    // Keep paginationRef in sync with pagination state
    useEffect(() => {
        paginationRef.current = pagination;
    }, [pagination]);

    // Load projects when customerId changes
    useEffect(() => {
        if (customerId) {
            loadProjects(customerId);
        } else {
            // Load all projects when no customerId is provided
            loadProjects();
        }
    }, [customerId]);


    /**
     * Loads projects for a customer with pagination support
     * Uses backend API
     * @param {string} custId - Customer ID (optional)
     * @param {Object} options - Load options
     * @param {number} options.limit - Number of records per page (default: 50, max: 200)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @param {boolean} options.append - Append results to existing projects (for "load more")
     */
    const loadProjects = useCallback(async (custId, options = {}) => {
        try {
            setLoading(true);
            clearErrorState();

            const env = getEnvironmentContext();
            const source = env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'filemaker' : 'backend';
            const currentPagination = paginationRef.current;

            // Merge options with current pagination state
            const effectiveOptions = {
                limit: currentPagination.limit,
                offset: currentPagination.offset,
                ...options
            };

            let projectResult;
            let processedProjects;
            let paginationInfo;

            if (custId) {
                // Fetch projects for specific customer
                projectResult = await fetchProjectsForCustomer(custId, effectiveOptions);
            } else {
                // Load all projects when no customer ID provided
                projectResult = await fetchProjectsForCustomers([], effectiveOptions);
            }

            // Process data with environment-aware routing
            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                // FileMaker environment - no pagination support
                processedProjects = processProjectData(projectResult, {}, source);
                paginationInfo = {
                    total: processedProjects.length,
                    limit: processedProjects.length,
                    offset: 0,
                    has_more: false
                };
            } else {
                // Backend environment - extract pagination from response
                if (projectResult.pagination) {
                    // Backend returns pagination metadata
                    processedProjects = processProjectData(projectResult.data || projectResult.projects || [], {}, source);
                    paginationInfo = {
                        total: projectResult.pagination.total || processedProjects.length,
                        limit: effectiveOptions.limit,
                        offset: effectiveOptions.offset,
                        has_more: projectResult.pagination.has_more || false
                    };
                } else {
                    // No pagination metadata - treat as single page
                    processedProjects = processProjectData(projectResult, {}, source);
                    paginationInfo = {
                        total: processedProjects.length,
                        limit: effectiveOptions.limit,
                        offset: 0,
                        has_more: false
                    };
                }
            }

            // Update projects state - append if requested, otherwise replace
            if (options.append) {
                setProjects(prevProjects => [...prevProjects, ...processedProjects]);
            } else {
                setProjects(processedProjects);
            }

            // Update pagination state
            setPagination(paginationInfo);
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Loads detailed data for a specific project
     * Uses backend API /projects/{id}/detail endpoint
     */
    const loadProjectDetails = useCallback(async (projectId) => {
        try {
            const env = getEnvironmentContext();
            const source = env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'filemaker' : 'backend';

            // Use single endpoint that returns nested data
            const projectWithDetails = await fetchProjectWithDetails(projectId);

            // Process the response with environment-aware routing
            const processedImages = processProjectImages(projectWithDetails.images || [], projectId, source);
            const processedLinks = processProjectLinks(projectWithDetails.links || [], projectId, source);
            const processedObjectives = processProjectObjectives(
                projectWithDetails.objectives || [],
                projectId,
                projectWithDetails.steps || [],
                source
            );
            const processedNotes = projectWithDetails.notes || [];

            const projectDetails = {
                images: processedImages,
                links: processedLinks,
                objectives: processedObjectives,
                notes: processedNotes
            };

            // Update the project with the processed details
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    p.id === projectId
                        ? { ...p, ...projectDetails }
                        : p
                )
            );

            return projectDetails;
        } catch (err) {
            console.error('Error loading project details:', err);
            throw err;
        }
    }, []);

    /**
     * Selects a project and loads all its data
     */
    const handleProjectSelect = useCallback(async (projectOrId) => {
        const requestId = ++projectSelectionRequestId.current;
        try {
            setLoading(true);
            clearErrorState();

            // Handle both project object and project ID
            const projectId = typeof projectOrId === 'string' ? projectOrId : projectOrId.id;
            const project = typeof projectOrId === 'string' ?
                projects.find(p => p.id === projectId) :
                projectOrId;

            if (!project) {
                throw new Error('Project not found');
            }

            // Load details if not already loaded
            if (!project.images || !project.links || !project.objectives) {
                const projectDetails = await loadProjectDetails(projectId);
                if (projectSelectionRequestId.current !== requestId) {
                    return;
                }

                setSelectedProject({ ...project, ...projectDetails });
            } else {
                if (projectSelectionRequestId.current === requestId) {
                    setSelectedProject(project);
                }
            }
        } catch (err) {
            if (projectSelectionRequestId.current === requestId) {
                setErrorWithFormatting(err);
                console.error('Error selecting project:', err);
            }
        } finally {
            if (projectSelectionRequestId.current === requestId) {
                setLoading(false);
            }
        }
    }, [projects, loadProjectDetails]);

    /**
     * Creates a new project
     * Uses backend API
     */
    const handleProjectCreate = useCallback(async (projectData) => {
        try {
            setLoading(true);
            clearErrorState();

            console.log('Project creation data received:', projectData);

            const validation = validateProjectData(projectData);
            console.log('Validation result:', validation);

            if (!validation.isValid) {
                console.log('Validation failed with errors:', validation.errors);
                throw new Error(validation.errors.join(', '));
            }

            // Generate a UUID for the new project
            const projectId = uuidv4();

            // Add the UUID to the project data
            const dataWithId = {
                ...projectData,
                id: projectId
            };

            // Format data for backend
            const formattedData = formatProjectForBackend(dataWithId);

            console.log('Formatted data for backend:', formattedData);

            // Create project via backend API
            const result = await createProject(formattedData);

            // Process fixed price or subscription logic if applicable
            // BUSINESS LOGIC: Fixed-price and subscription projects trigger sales entries
            if ((projectData.f_fixedPrice === "1" || projectData.f_fixedPrice === 1 ||
                 projectData.isFixedPrice) ||
                (projectData.f_subscription === "1" || projectData.f_subscription === 1 ||
                 projectData.isSubscription)) {

                console.log('[Business Logic] Processing fixed-price or subscription project');

                // Process the project value according to business rules
                const projectWithId = {
                    ...projectData,
                    id: projectId,
                    __ID: projectId,
                    f_fixedPrice: projectData.f_fixedPrice === "1" || projectData.f_fixedPrice === 1 || projectData.isFixedPrice,
                    f_subscription: projectData.f_subscription === "1" || projectData.f_subscription === 1 || projectData.isSubscription,
                    value: parseFloat(projectData.value) || 0
                };

                // Process the project value and determine sales entries and billable status
                const { billableStatus, salesToCreate } = processProjectValue(projectWithId, false);
                console.log(`[Business Logic] Generated ${salesToCreate?.length || 0} sales entries, billable status: ${billableStatus}`);

                // Update billable status for all time records if needed
                // NOTE: For fixed-price projects, billableStatus will be false (all hours non-billable)
                if (billableStatus !== null) {
                    const billableResult = await updateProjectRecordsBillableStatus(projectId, billableStatus);
                    if (!billableResult.implemented) {
                        console.warn('[Business Logic] Billable status update not implemented - may require manual updates');
                    }
                }

                // Create sales entries if the user has an organization ID
                // NOTE: This writes directly to Supabase customer_sales table (frontend-only logic)
                if (user?.supabaseOrgID) {
                    try {
                        const salesResult = await createSalesFromProjectValue(projectWithId, user.supabaseOrgID);
                        if (salesResult.success) {
                            console.log(`[Business Logic] Created ${salesResult.data?.length || 0} sales entries`);
                        } else {
                            console.error('[Business Logic] Failed to create sales entries:', salesResult.error);
                        }
                    } catch (salesError) {
                        console.error('[Business Logic] Error creating sales entries:', salesError);
                        // Don't fail the entire project creation due to sales entry errors
                    }
                } else {
                    console.warn('[Business Logic] No organization ID available - skipping sales entry creation');
                }
            }

            // Reload projects to get updated list
            await loadProjects(projectData.customerId || projectData._custID);

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error creating project:', err);
            showError(err.message);
            console.log('Error displayed in snackbar:', err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [loadProjects, user, showError]);

    /**
     * Updates an existing project
     * Uses backend API
     */
    const handleProjectUpdate = useCallback(async (projectId, projectData) => {
        try {
            setLoading(true);
            clearErrorState();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            const validation = validateProjectData(projectData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Format data for backend
            const formattedData = formatProjectForBackend(projectData);

            // Update via backend API using project UUID
            const result = await updateProject(projectId, formattedData);

            // Process fixed price or subscription logic if applicable
            // BUSINESS LOGIC: Process sales and billable status for special project types
            const isFixedPrice = projectData.f_fixedPrice === "1" || projectData.f_fixedPrice === 1 ||
                                projectData.isFixedPrice || project.f_fixedPrice;
            const isSubscription = projectData.f_subscription === "1" || projectData.f_subscription === 1 ||
                                  projectData.isSubscription || project.f_subscription;

            if (isFixedPrice || isSubscription) {
                console.log('[Business Logic] Processing fixed-price or subscription project update');

                // Merge the existing project with the update data for processing
                const updatedProject = {
                    ...project,
                    ...projectData,
                    id: projectId,
                    __ID: projectId,
                    f_fixedPrice: isFixedPrice,
                    f_subscription: isSubscription,
                    value: parseFloat(projectData.value || project.value) || 0,
                    dateStart: projectData.dateStart || project.dateStart,
                    dateEnd: projectData.dateEnd || project.dateEnd
                };

                // Process the project value and determine sales entries and billable status
                const { billableStatus, salesToCreate } = processProjectValue(updatedProject, true);
                console.log(`[Business Logic] Update generated ${salesToCreate?.length || 0} sales entries, billable status: ${billableStatus}`);

                // Update billable status for all time records if needed
                if (billableStatus !== null) {
                    const billableResult = await updateProjectRecordsBillableStatus(projectId, billableStatus);
                    if (!billableResult.implemented) {
                        console.warn('[Business Logic] Billable status update not implemented - may require manual updates');
                    }
                }

                // Create sales entries if the user has an organization ID
                // NOTE: This handles incremental sales for subscription projects
                if (user?.supabaseOrgID) {
                    try {
                        const salesResult = await createSalesFromProjectValue(updatedProject, user.supabaseOrgID);
                        if (salesResult.success) {
                            console.log(`[Business Logic] Created/updated ${salesResult.data?.length || 0} sales entries`);
                        } else {
                            console.error('[Business Logic] Failed to create sales entries:', salesResult.error);
                        }
                    } catch (salesError) {
                        console.error('[Business Logic] Error creating sales entries:', salesError);
                        // Don't fail the entire project update due to sales entry errors
                    }
                } else {
                    console.warn('[Business Logic] No organization ID available - skipping sales entry creation');
                }
            }

            // Update local state
            setProjects(prevProjects =>
                prevProjects.map(project =>
                    project.id === projectId
                        ? { ...project, ...projectData }
                        : project
                )
            );

            // Update selected project if it's the one being updated
            if (selectedProject?.id === projectId) {
                setSelectedProject(prevProject => ({ ...prevProject, ...projectData }));
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error updating project:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject, user]);

    /**
     * Updates project status
     * Uses backend API
     * @param {string} projectId - The project ID (UUID)
     * @param {string} status - The new status value
     */
    const handleProjectStatusChange = useCallback(async (projectId, status) => {
        try {
            setLoading(true);
            clearErrorState();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                console.error('Project not found in state with ID:', projectId);
                throw new Error('Project not found');
            }

            // Update via backend API using project UUID
            const result = await updateProjectStatus(projectId, status);

            // Update local state
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    p.id === projectId
                        ? { ...p, status }
                        : p
                )
            );

            // Update selected project if it's the one being updated
            if (selectedProject?.id === projectId) {
                setSelectedProject(prevProject => ({ ...prevProject, status }));
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error updating project status:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject]);

    /**
     * Calculates completion percentage for a project
     */
    const getProjectCompletion = useCallback((projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? calculateProjectCompletion(project) : 0;
    }, [projects]);

    /**
     * Deletes a project
     * Uses backend API
     */
    const handleProjectDelete = useCallback(async (projectId) => {
        try {
            setLoading(true);
            clearErrorState();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            // Delete via backend API using project UUID
            const result = await deleteProject(projectId);

            // Update local state by removing the deleted project
            setProjects(prevProjects =>
                prevProjects.filter(p => p.id !== projectId)
            );

            // Clear selected project if it was the one being deleted
            if (selectedProject?.id === projectId) {
                setSelectedProject(null);
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error deleting project:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject]);

    /**
     * Updates a project's team assignment
     * Uses backend API
     * @param {string} projectId - The project ID (UUID)
     * @param {string} teamId - The team ID to assign
     */
    const handleProjectTeamChange = useCallback(async (projectId, teamId) => {
        try {
            setLoading(true);
            clearErrorState();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                console.error('Project not found in state with ID:', projectId);
                throw new Error('Project not found');
            }

            // Prepare update data for backend
            const updateData = { team_id: teamId };

            // Update via backend API using project UUID
            const result = await updateProject(projectId, updateData);

            // Update local state
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    p.id === projectId
                        ? { ...p, _teamID: teamId }
                        : p
                )
            );

            // Update selected project if it's the one being updated
            if (selectedProject?.id === projectId) {
                setSelectedProject(prevProject => ({ ...prevProject, _teamID: teamId }));
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error updating project team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject]);

    /**
     * Creates a new objective for a project
     * Uses backend API
     */
    const handleObjectiveCreate = useCallback(async (projectId, objectiveText) => {
        try {
            setLoading(true);
            clearErrorState();

            // Prepare objective data for backend
            const objectiveData = {
                project_id: projectId,
                objective: objectiveText,
                status: "Open",
                completed: false
            };

            // Create the objective via backend API
            const result = await createObjective(objectiveData);

            // Reload project details to get the updated objectives
            if (selectedProject && selectedProject.id === projectId) {
                await loadProjectDetails(projectId);
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error creating objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject, loadProjectDetails]);

    /**
     * Updates an existing objective
     * Uses backend API
     */
    const handleObjectiveUpdate = useCallback(async (objectiveId, updateData) => {
        try {
            setLoading(true);
            clearErrorState();

            // Format data for backend
            const formattedData = {
                objective: updateData.objective || updateData.projectObjective,
                status: updateData.status,
                completed: updateData.completed !== undefined
                    ? updateData.completed
                    : (updateData.f_completed === 1 || updateData.f_completed === "1")
            };

            // Update via backend API
            const result = await updateObjective(objectiveId, formattedData);

            // Update local state
            if (selectedProject) {
                const updatedObjectives = selectedProject.objectives.map(obj =>
                    obj.id === objectiveId
                        ? { ...obj, ...formattedData }
                        : obj
                );

                setSelectedProject(prev => ({
                    ...prev,
                    objectives: updatedObjectives
                }));

                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === selectedProject.id
                            ? { ...p, objectives: updatedObjectives }
                            : p
                    )
                );
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error updating objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Deletes a project objective
     * Uses backend API
     * Note: Backend cascades deletion to related steps automatically
     */
    const handleObjectiveDelete = useCallback(async (objectiveId) => {
        try {
            setLoading(true);
            clearErrorState();

            // Delete via backend API
            const result = await deleteObjective(objectiveId);

            // Update local state
            if (selectedProject) {
                const updatedObjectives = selectedProject.objectives.filter(
                    obj => obj.id !== objectiveId
                );

                setSelectedProject(prev => ({
                    ...prev,
                    objectives: updatedObjectives
                }));

                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === selectedProject.id
                            ? { ...p, objectives: updatedObjectives }
                            : p
                    )
                );
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error deleting objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Creates a new step for an objective
     * Uses backend API
     */
    const handleStepCreate = useCallback(async (objectiveId, stepText) => {
        try {
            setLoading(true);
            clearErrorState();

            // Prepare step data for backend
            const stepData = {
                objective_id: objectiveId,
                step: stepText,
                completed: false,
                order_num: 0
            };

            // Create the step via backend API
            const result = await createStep(stepData);

            // Reload project details to get the updated objectives with steps
            if (selectedProject) {
                await loadProjectDetails(selectedProject.id);
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error creating step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject, loadProjectDetails]);

    /**
     * Updates an existing step
     * Uses backend API
     */
    const handleStepUpdate = useCallback(async (stepId, updateData) => {
        try {
            setLoading(true);
            clearErrorState();

            // Format data for backend
            const formattedData = {
                step: updateData.step || updateData.projectObjectiveStep,
                completed: updateData.completed !== undefined
                    ? updateData.completed
                    : (updateData.f_completed === 1 || updateData.f_completed === "1"),
                order_num: updateData.order_num !== undefined
                    ? updateData.order_num
                    : updateData.sortOrder
            };

            // Update via backend API
            const result = await updateStep(stepId, formattedData);

            // Update local state
            if (selectedProject) {
                const updatedObjectives = selectedProject.objectives.map(obj => ({
                    ...obj,
                    steps: obj.steps.map(step =>
                        step.id === stepId
                            ? { ...step, ...formattedData }
                            : step
                    )
                }));

                setSelectedProject(prev => ({
                    ...prev,
                    objectives: updatedObjectives
                }));

                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === selectedProject.id
                            ? { ...p, objectives: updatedObjectives }
                            : p
                    )
                );
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error updating step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Deletes a step
     * Uses backend API
     */
    const handleStepDelete = useCallback(async (stepId) => {
        try {
            setLoading(true);
            clearErrorState();

            // Delete via backend API
            const result = await deleteStep(stepId);

            // Update local state
            if (selectedProject) {
                const updatedObjectives = selectedProject.objectives.map(obj => ({
                    ...obj,
                    steps: obj.steps.filter(step => step.id !== stepId)
                }));

                setSelectedProject(prev => ({
                    ...prev,
                    objectives: updatedObjectives
                }));

                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === selectedProject.id
                            ? { ...p, objectives: updatedObjectives }
                            : p
                    )
                );
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error deleting step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Toggles step completion status
     * Uses backend API
     */
    const handleStepToggle = useCallback(async (stepId) => {
        try {
            setLoading(true);
            clearErrorState();

            // Use dedicated toggle endpoint
            const result = await toggleStepCompleted(stepId);

            // Update local state with result
            if (selectedProject && result) {
                const updatedObjectives = selectedProject.objectives.map(obj => ({
                    ...obj,
                    steps: obj.steps.map(step =>
                        step.id === stepId
                            ? { ...step, completed: result.completed }
                            : step
                    )
                }));

                setSelectedProject(prev => ({
                    ...prev,
                    objectives: updatedObjectives
                }));

                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === selectedProject.id
                            ? { ...p, objectives: updatedObjectives }
                            : p
                    )
                );
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            console.error('Error toggling step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Loads more projects (pagination helper)
     * Appends next page of projects to current list
     */
    const loadMoreProjects = useCallback(async () => {
        if (!pagination.has_more) {
            console.warn('No more projects to load');
            return;
        }

        const nextOffset = pagination.offset + pagination.limit;
        await loadProjects(customerId, {
            offset: nextOffset,
            limit: pagination.limit,
            append: true
        });
    }, [customerId, pagination, loadProjects]);

    return {
        // State
        loading,
        error,
        formattedError,
        projects,
        selectedProject,
        projectRecords,
        pagination,

        // Getters
        activeProjects: projects.filter(project => project.status === 'Open'),

        // Actions
        loadProjects,
        loadMoreProjects,
        loadProjectDetails,
        handleProjectSelect,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectStatusChange,
        handleProjectDelete,
        handleProjectTeamChange,
        handleObjectiveCreate,
        handleObjectiveUpdate,
        handleObjectiveDelete,
        handleStepCreate,
        handleStepUpdate,
        handleStepDelete,
        handleStepToggle,

        // Utilities
        getProjectCompletion,
        clearError: clearErrorState,
        clearSelectedProject: () => setSelectedProject(null),
        setPagination,
        isLoading: loading
    };
}
