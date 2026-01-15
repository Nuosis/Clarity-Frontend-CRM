import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    fetchProjectsForCustomer,
    fetchProjectRelatedData,
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
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { createSalesFromProjectValue } from '../services/salesService';

/**
 * Hook for managing project state and operations
 */
export function useProject(customerId = null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const projectRecords = useProjectRecords();
    const { showError } = useSnackBar();
    const { user } = useAppState();
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
     * Loads projects for a customer
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const loadProjects = useCallback(async (custId) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            if (custId) {
                // Fetch projects for specific customer
                const projectResult = await fetchProjectsForCustomer(custId);

                // Process based on environment
                const source = env.type === ENVIRONMENT_TYPES.WEBAPP ? 'backend' : 'filemaker';
                const processedProjects = processProjectData(projectResult, {}, source);

                setProjects(processedProjects);
            } else {
                // Load all projects when no customer ID provided
                const projectResult = await fetchProjectsForCustomers([]);

                // Process based on environment
                const source = env.type === ENVIRONMENT_TYPES.WEBAPP ? 'backend' : 'filemaker';
                const processedProjects = processProjectData(projectResult, {}, source);

                setProjects(processedProjects);
            }
        } catch (err) {
            setError(err.message);
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Loads detailed data for a specific project
     * Environment-aware: Uses /projects/{id}/detail endpoint in webapp, parallel calls in FileMaker
     */
    const loadProjectDetails = useCallback(async (projectId) => {
        try {
            const env = getEnvironmentContext();

            if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
                // Backend API: Use single endpoint that returns nested data
                const projectWithDetails = await fetchProjectWithDetails(projectId);

                // Process the backend response
                const source = 'backend';
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
            } else {
                // FileMaker: Use parallel calls to legacy endpoints
                const [images, links, objectives, steps, notes] = await Promise.all([
                    fetchProjectRelatedData([projectId], 'devProjectImages'),
                    fetchProjectRelatedData([projectId], 'devProjectLinks'),
                    fetchProjectRelatedData([projectId], 'devProjectObjectives'),
                    fetchProjectRelatedData([projectId], 'devProjectObjSteps'),
                    fetchProjectRelatedData([projectId], 'devNotes')
                ]);

                const source = 'filemaker';
                // Process each type of data
                const processedImages = processProjectImages(images, projectId, source);
                const processedLinks = processProjectLinks(links, projectId, source);
                const processedObjectives = processProjectObjectives(
                    objectives,
                    projectId,
                    { response: { data: steps.response?.data || [] } },
                    source
                );
                const processedNotes = notes.response?.data || [];

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
            }
        } catch (err) {
            console.error('Error loading project details:', err);
            throw err;
        }
    }, []);

    /**
     * Selects a project and loads all its data
     */
    const handleProjectSelect = useCallback(async (projectOrId) => {
        try {
            setLoading(true);
            setError(null);

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
                await loadProjectDetails(projectId);

                // Get the updated project from state (loadProjectDetails updates it)
                const updatedProject = projects.find(p => p.id === projectId);
                setSelectedProject(updatedProject || project);
            } else {
                setSelectedProject(project);
            }
        } catch (err) {
            setError(err.message);
            console.error('Error selecting project:', err);
        } finally {
            setLoading(false);
        }
    }, [projects, loadProjectDetails]);

    /**
     * Creates a new project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleProjectCreate = useCallback(async (projectData) => {
        try {
            setLoading(true);
            setError(null);

            console.log('Project creation data received:', projectData);

            const validation = validateProjectData(projectData);
            console.log('Validation result:', validation);

            if (!validation.isValid) {
                console.log('Validation failed with errors:', validation.errors);
                throw new Error(validation.errors.join(', '));
            }

            const env = getEnvironmentContext();

            // Generate a UUID for the new project
            const projectId = uuidv4();

            // Add the UUID to the project data
            const dataWithId = {
                ...projectData,
                id: projectId
            };

            // Format data based on environment
            const formattedData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? formatProjectForBackend(dataWithId)
                : formatProjectForFileMaker(dataWithId);

            console.log(`Formatted data for ${env.type}:`, formattedData);

            // Create project via environment-aware API
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
            setError(err.message);
            console.error('Error creating project:', err);
            showError(err.message);
            console.log('Error displayed in snackbar:', err.message);
            // Don't throw the error, handle it here
            return { error: err.message };
        } finally {
            setLoading(false);
        }
    }, [loadProjects, user, showError]);

    /**
     * Updates an existing project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleProjectUpdate = useCallback(async (projectId, projectData) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            const validation = validateProjectData(projectData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Format data based on environment
            const formattedData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? formatProjectForBackend(projectData)
                : formatProjectForFileMaker(projectData);

            // Update via environment-aware API
            // In webapp: uses project.id (UUID)
            // In FileMaker: uses project.recordId (FileMaker record ID)
            const idToUse = env.type === ENVIRONMENT_TYPES.WEBAPP ? projectId : project.recordId;
            const result = await updateProject(idToUse, formattedData);

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
            setError(err.message);
            console.error('Error updating project:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject, user]);

    /**
     * Updates project status
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} projectId - The project ID (UUID in webapp, may be recordId in FileMaker)
     * @param {string} status - The new status value
     */
    const handleProjectStatusChange = useCallback(async (projectId, status) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Find the project in the state
            // Try both id and recordId for backward compatibility
            const project = projects.find(p => p.id === projectId || p.recordId === projectId);
            if (!project) {
                console.error('Project not found in state with ID:', projectId);
                throw new Error('Project not found');
            }

            // Determine which ID to use for the API call
            // In webapp: uses project.id (UUID)
            // In FileMaker: uses projectId as passed (may be recordId from ProjectDetails.jsx)
            const idToUse = env.type === ENVIRONMENT_TYPES.WEBAPP ? project.id : projectId;
            const result = await updateProjectStatus(idToUse, status);

            // Update local state using project.id for consistency
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    p.id === project.id
                        ? { ...p, status }
                        : p
                )
            );

            // Update selected project if it's the one being updated
            if (selectedProject?.id === project.id) {
                setSelectedProject(prevProject => ({ ...prevProject, status }));
            }

            return result;
        } catch (err) {
            setError(err.message);
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
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleProjectDelete = useCallback(async (projectId) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Find the project in the state
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            // Delete via environment-aware API
            // In webapp: uses project.id (UUID)
            // In FileMaker: uses project.recordId (FileMaker record ID)
            const idToUse = env.type === ENVIRONMENT_TYPES.WEBAPP ? projectId : project.recordId;
            const result = await deleteProject(idToUse);

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
            setError(err.message);
            console.error('Error deleting project:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject]);

    /**
     * Updates a project's team assignment
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} projectId - The project ID (UUID in webapp, may be recordId in FileMaker)
     * @param {string} teamId - The team ID to assign
     */
    const handleProjectTeamChange = useCallback(async (projectId, teamId) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Find the project in the state
            // Try both id and recordId for backward compatibility
            const project = projects.find(p => p.id === projectId || p.recordId === projectId);
            if (!project) {
                console.error('Project not found in state with ID:', projectId);
                throw new Error('Project not found');
            }

            // Prepare update data based on environment
            const updateData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? { team_id: teamId }
                : { _teamID: teamId };

            // Update via environment-aware API
            // In webapp: uses project.id (UUID)
            // In FileMaker: uses projectId as passed (may be recordId)
            const idToUse = env.type === ENVIRONMENT_TYPES.WEBAPP ? project.id : projectId;
            const result = await updateProject(idToUse, updateData);

            // Update local state using project.id for consistency
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    p.id === project.id
                        ? { ...p, _teamID: teamId }
                        : p
                )
            );

            // Update selected project if it's the one being updated
            if (selectedProject?.id === project.id) {
                setSelectedProject(prevProject => ({ ...prevProject, _teamID: teamId }));
            }

            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error updating project team:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProject]);

    /**
     * Creates a new objective for a project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleObjectiveCreate = useCallback(async (projectId, objectiveText) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Prepare objective data based on environment
            const objectiveData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? {
                    project_id: projectId,
                    objective: objectiveText,
                    status: "Open",
                    completed: false
                }
                : {
                    _projectID: projectId,
                    projectObjective: objectiveText,
                    status: "Open",
                    f_completed: 0
                };

            // Create the objective via environment-aware API
            const result = await createObjective(objectiveData);

            // Reload project details to get the updated objectives
            // No delay needed - backend is atomic
            if (selectedProject && selectedProject.id === projectId) {
                await loadProjectDetails(projectId);
            }

            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error creating objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject, loadProjectDetails]);

    /**
     * Updates an existing objective
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleObjectiveUpdate = useCallback(async (objectiveId, updateData) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Format data based on environment
            const formattedData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? {
                    objective: updateData.objective || updateData.projectObjective,
                    status: updateData.status,
                    completed: updateData.completed !== undefined
                        ? updateData.completed
                        : (updateData.f_completed === 1 || updateData.f_completed === "1")
                }
                : {
                    projectObjective: updateData.projectObjective || updateData.objective,
                    status: updateData.status,
                    f_completed: updateData.f_completed !== undefined
                        ? updateData.f_completed
                        : (updateData.completed ? 1 : 0)
                };

            // Update via environment-aware API
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
            setError(err.message);
            console.error('Error updating objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Deletes a project objective
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * Note: Backend cascades deletion to related steps automatically
     */
    const handleObjectiveDelete = useCallback(async (objectiveId) => {
        try {
            setLoading(true);
            setError(null);

            // Delete via environment-aware API
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
            setError(err.message);
            console.error('Error deleting objective:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Creates a new step for an objective
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleStepCreate = useCallback(async (objectiveId, stepText) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Prepare step data based on environment
            const stepData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? {
                    objective_id: objectiveId,
                    step: stepText,
                    completed: false,
                    order_num: 0
                }
                : {
                    _objectiveID: objectiveId,
                    projectObjectiveStep: stepText,
                    f_completed: 0,
                    sortOrder: 0
                };

            // Create the step via environment-aware API
            const result = await createStep(stepData);

            // Reload project details to get the updated objectives with steps
            if (selectedProject) {
                await loadProjectDetails(selectedProject.id);
            }

            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error creating step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject, loadProjectDetails]);

    /**
     * Updates an existing step
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleStepUpdate = useCallback(async (stepId, updateData) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Format data based on environment
            const formattedData = env.type === ENVIRONMENT_TYPES.WEBAPP
                ? {
                    step: updateData.step || updateData.projectObjectiveStep,
                    completed: updateData.completed !== undefined
                        ? updateData.completed
                        : (updateData.f_completed === 1 || updateData.f_completed === "1"),
                    order_num: updateData.order_num !== undefined
                        ? updateData.order_num
                        : updateData.sortOrder
                }
                : {
                    projectObjectiveStep: updateData.projectObjectiveStep || updateData.step,
                    f_completed: updateData.f_completed !== undefined
                        ? updateData.f_completed
                        : (updateData.completed ? 1 : 0),
                    sortOrder: updateData.sortOrder !== undefined
                        ? updateData.sortOrder
                        : updateData.order_num
                };

            // Update via environment-aware API
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
            setError(err.message);
            console.error('Error updating step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Deletes a step
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleStepDelete = useCallback(async (stepId) => {
        try {
            setLoading(true);
            setError(null);

            // Delete via environment-aware API
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
            setError(err.message);
            console.error('Error deleting step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    /**
     * Toggles step completion status
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     */
    const handleStepToggle = useCallback(async (stepId) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
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
            } else {
                // FileMaker: Find step, toggle, and update
                const objective = selectedProject?.objectives.find(obj =>
                    obj.steps.some(s => s.id === stepId)
                );
                const step = objective?.steps.find(s => s.id === stepId);

                if (!step) {
                    throw new Error('Step not found');
                }

                const newCompleted = step.f_completed === 1 ? 0 : 1;
                return await handleStepUpdate(stepId, { f_completed: newCompleted });
            }
        } catch (err) {
            setError(err.message);
            console.error('Error toggling step:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedProject, handleStepUpdate]);

    return {
        // State
        loading,
        error,
        projects,
        selectedProject,
        projectRecords,

        // Getters
        activeProjects: projects.filter(project => project.status === 'Open'),

        // Actions
        loadProjects,
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
        clearError: () => setError(null),
        clearSelectedProject: () => setSelectedProject(null),
        isLoading: loading
    };
}