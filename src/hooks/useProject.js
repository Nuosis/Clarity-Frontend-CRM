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
    deleteProject
} from '../api';
import { useProjectRecords } from '../context/ProjectContext';
import { useSnackBar } from '../context/SnackBarContext';
import {
    processProjectData,
    validateProjectData,
    formatProjectForFileMaker,
    calculateProjectCompletion,
    processProjectImages,
    processProjectLinks,
    processProjectObjectives
} from '../services/projectService';

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
     */
    const loadProjects = useCallback(async (custId) => {
        try {
            setLoading(true);
            setError(null);
            
            let projectResult;
            if (custId) {
                projectResult = await fetchProjectsForCustomer(custId);
            } else {
                projectResult = await fetchProjectsForCustomers([]);
            }
            const processedProjects = processProjectData(projectResult);
            setProjects(processedProjects);
        } catch (err) {
            setError(err.message);
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Loads detailed data for a specific project
     */
    const loadProjectDetails = useCallback(async (projectId) => {
        try {
            const [images, links, objectives, steps, notes] = await Promise.all([
                fetchProjectRelatedData([projectId], 'devProjectImages'),
                fetchProjectRelatedData([projectId], 'devProjectLinks'),
                fetchProjectRelatedData([projectId], 'devProjectObjectives'),
                fetchProjectRelatedData([projectId], 'devProjectObjSteps'),
                fetchProjectRelatedData([projectId], 'devNotes')
            ]);
            console.log("Links: ",links)
            // Process each type of data
            const processedImages = processProjectImages(images, projectId);
            const processedLinks = processProjectLinks(links, projectId);
            console.log("processedLinks: ",processedLinks)
            const processedObjectives = processProjectObjectives(
                objectives,
                projectId,
                { response: { data: steps.response?.data || [] } }
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
            if (!project.images || !project.links) {
                const details = await loadProjectDetails(projectId);
                const processedProject = processProjectData({
                    response: {
                        data: [{
                            fieldData: {
                                ...project,
                                __ID: project.id
                            }
                        }]
                    }
                }, details)[0];
                setSelectedProject(processedProject);
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
            
            // Generate a UUID for the new project
            const projectId = uuidv4();
            
            // Add the UUID to the project data
            const dataWithId = {
                ...projectData,
                id: projectId
            };
            
            const formattedData = formatProjectForFileMaker(dataWithId);
            console.log('Formatted data for FileMaker:', formattedData);
            
            const result = await createProject(formattedData);
            
            // Reload projects to get updated list
            await loadProjects(projectData.customerId);
            
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
    }, [loadProjects]);

    /**
     * Updates an existing project
     */
    const handleProjectUpdate = useCallback(async (projectId, projectData) => {
        try {
            setLoading(true);
            setError(null);
            
            // Find the project in the state to get its recordId
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }
            
            const validation = validateProjectData(projectData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatProjectForFileMaker(projectData);
            // Use recordId instead of UUID for FileMaker update
            const result = await updateProject(project.recordId, formattedData);
            
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
    }, [selectedProject]);

    /**
     * Updates project status
     */
    const handleProjectStatusChange = useCallback(async (projectId, status) => {
        try {
            setLoading(true);
            setError(null);
            
            // The projectId parameter is already the recordId from ProjectDetails.jsx
            const result = await updateProjectStatus(projectId, status);
            
            // Find the project in the state by recordId to update local state
            const project = projects.find(p => p.recordId === projectId);
            if (!project) {
                console.error('Project not found in state with recordId:', projectId);
                // Continue with the update even if we can't find the project in the state
            }
            
            // Update local state using recordId
            setProjects(prevProjects =>
                prevProjects.map(project =>
                    project.recordId === projectId
                        ? { ...project, status }
                        : project
                )
            );
            
            // Update selected project if it's the one being updated
            if (selectedProject?.recordId === projectId) {
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
    }, [selectedProject]);

    /**
     * Calculates completion percentage for a project
     */
    const getProjectCompletion = useCallback((projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? calculateProjectCompletion(project) : 0;
    }, [projects]);

    /**
     * Deletes a project
     */
    const handleProjectDelete = useCallback(async (projectId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Find the project in the state to get its recordId
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('Project not found');
            }
            
            // Use recordId for FileMaker delete operation
            const result = await deleteProject(project.recordId);
            
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
     */
    const handleProjectTeamChange = useCallback(async (projectId, teamId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Find the project in the state by recordId
            const project = projects.find(p => p.recordId === projectId);
            if (!project) {
                console.error('Project not found in state with recordId:', projectId);
                throw new Error('Project not found');
            }
            
            // Update the project in FileMaker
            const result = await updateProject(projectId, { _teamID: teamId });
            
            // Update local state using recordId
            setProjects(prevProjects =>
                prevProjects.map(project =>
                    project.recordId === projectId
                        ? { ...project, _teamID: teamId }
                        : project
                )
            );
            
            // Update selected project if it's the one being updated
            if (selectedProject?.recordId === projectId) {
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
    }, [selectedProject, projects]);

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
        
        // Utilities
        getProjectCompletion,
        clearError: () => setError(null),
        clearSelectedProject: () => setSelectedProject(null),
        isLoading: loading
    };
}