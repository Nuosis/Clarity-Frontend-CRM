import { useState, useEffect, useCallback } from 'react';
import {
    fetchProjectsForCustomer,
    fetchProjectRelatedData,
    updateProjectStatus,
    createProject,
    updateProject,
    fetchProjectsForCustomers,
    fetchProjectNotes
} from '../api';
import { useProjectRecords } from '../context/ProjectContext';
import {
    processProjectData,
    validateProjectData,
    formatProjectForFileMaker,
    calculateProjectCompletion,
    calculateProjectStats
} from '../services';

/**
 * Hook for managing project state and operations
 */
export function useProject(customerId = null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const projectRecords = useProjectRecords();
    const [relatedData, setRelatedData] = useState({
        images: null,
        links: null,
        objectives: null,
        steps: null
    });

    // Load projects when customerId changes
    useEffect(() => {
        if (customerId) {
            loadProjects(customerId);
        }
    }, [customerId]);


    /**
     * Loads projects for a customer
     */
    const loadProjects = useCallback(async (custId) => {
        try {
            setLoading(true);
            setError(null);
            
            const projectResult = await fetchProjectsForCustomer(custId);
            const projectIds = projectResult.response?.data?.map(p => p.fieldData.__ID) || [];
            
            if (projectIds.length > 0) {
                // Fetch all related data in parallel
                const [images, links, objectives, steps] = await Promise.all([
                    fetchProjectRelatedData(projectIds, 'devProjectImages'),
                    fetchProjectRelatedData(projectIds, 'devProjectLinks'),
                    fetchProjectRelatedData(projectIds, 'devProjectObjectives'),
                    fetchProjectRelatedData(projectIds, 'devProjectObjSteps')
                ]);

                // Store related data in state for reuse
                const newRelatedData = {
                    images,
                    links,
                    objectives,
                    steps
                };
                setRelatedData(newRelatedData);

                const processedProjects = processProjectData(projectResult, newRelatedData);
                setProjects(processedProjects);
            } else {
                setProjects([]);
            }
        } catch (err) {
            setError(err.message);
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    }, [setRelatedData]);

    /**
     * Selects a project and loads all its data
     */
    const handleProjectSelect = useCallback((projectId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Find the project in our existing projects array
            const project = projects.find(p => p.id === projectId);
            
            if (!project) {
                throw new Error('Project not found in cached data');
            }
            
            setSelectedProject(project);
        } catch (err) {
            setError(err.message);
            console.error('Error selecting project:', err);
        } finally {
            setLoading(false);
        }
    }, [projects]);

    /**
     * Creates a new project
     */
    const handleProjectCreate = useCallback(async (projectData) => {
        try {
            setLoading(true);
            setError(null);
            
            const validation = validateProjectData(projectData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatProjectForFileMaker(projectData);
            const result = await createProject(formattedData);
            
            // Reload projects to get updated list
            await loadProjects(projectData.customerId);
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error creating project:', err);
            throw err;
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
            
            const validation = validateProjectData(projectData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatProjectForFileMaker(projectData);
            const result = await updateProject(projectId, formattedData);
            
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
            
            const result = await updateProjectStatus(projectId, status);
            
            // Update local state
            setProjects(prevProjects => 
                prevProjects.map(project => 
                    project.id === projectId
                        ? { ...project, status }
                        : project
                )
            );
            
            // Update selected project if it's the one being updated
            if (selectedProject?.id === projectId) {
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

    return {
        // State
        loading,
        error,
        projects,
        selectedProject,
        projectRecords,
        relatedData,
        
        // Getters
        activeProjects: projects.filter(project => project.status === 'Open'),
        
        // Actions
        loadProjects,
        handleProjectSelect,
        handleProjectCreate,
        handleProjectUpdate,
        handleProjectStatusChange,
        
        // Utilities
        getProjectCompletion,
        clearError: () => setError(null),
        clearSelectedProject: () => setSelectedProject(null)
    };
}