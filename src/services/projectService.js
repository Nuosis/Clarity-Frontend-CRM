/**
 * Project data processing and business logic
 */

/**
 * Processes raw project data from FileMaker
 * @param {Object} projectData - Raw project data
 * @param {Object} relatedData - Related project data (images, links, etc.)
 * @returns {Array} Processed project records
 */
export function processProjectData(projectData, relatedData) {
    if (!projectData?.response?.data) {
        return [];
    }

    return projectData.response.data.map(project => {
        const projectId = project.fieldData.__ID;
        return {
            ...project.fieldData,
            id: projectId,
            images: processProjectImages(relatedData.images, projectId),
            links: processProjectLinks(relatedData.links, projectId),
            objectives: processProjectObjectives(relatedData.objectives, projectId, relatedData.steps),
            isActive: project.fieldData.status === 'Open',
            createdAt: project.fieldData['~creationTimestamp'],
            modifiedAt: project.fieldData['~modificationTimestamp']
        };
    });
}

/**
 * Processes project images
 * @param {Array} images - Raw image data
 * @param {string} projectId - Project ID
 * @returns {Array} Processed image records
 */
function processProjectImages(images, projectId) {
    if (!images?.response?.data) {
        return [];
    }

    return images.response.data
        .filter(img => img.fieldData._projectID === projectId)
        .map(img => ({
            id: img.fieldData.__ID,
            url: img.fieldData.url,
            title: img.fieldData.title || '',
            description: img.fieldData.description || ''
        }));
}

/**
 * Processes project links
 * @param {Array} links - Raw link data
 * @param {string} projectId - Project ID
 * @returns {Array} Processed link records
 */
function processProjectLinks(links, projectId) {
    if (!links?.response?.data) {
        return [];
    }

    return links.response.data
        .filter(link => link.fieldData._projectID === projectId)
        .map(link => ({
            id: link.fieldData.__ID,
            url: link.fieldData.url,
            title: link.fieldData.title || new URL(link.fieldData.url).hostname
        }));
}

/**
 * Processes project objectives and their steps
 * @param {Array} objectives - Raw objective data
 * @param {string} projectId - Project ID
 * @param {Array} steps - Raw step data
 * @returns {Array} Processed objective records with steps
 */
function processProjectObjectives(objectives, projectId, steps) {
    if (!objectives?.response?.data) {
        return [];
    }

    return objectives.response.data
        .filter(obj => obj.fieldData._projectID === projectId)
        .map(obj => ({
            id: obj.fieldData.__ID,
            objective: obj.fieldData.projectObjective,
            order: obj.fieldData.order || 0,
            completed: obj.fieldData.f_completed === "1",
            steps: processObjectiveSteps(steps, obj.fieldData.__ID)
        }))
        .sort((a, b) => a.order - b.order);
}

/**
 * Processes objective steps
 * @param {Array} steps - Raw step data
 * @param {string} objectiveId - Objective ID
 * @returns {Array} Processed step records
 */
function processObjectiveSteps(steps, objectiveId) {
    if (!steps?.response?.data) {
        return [];
    }

    return steps.response.data
        .filter(step => step.fieldData._objectiveID === objectiveId)
        .map(step => ({
            id: step.fieldData.__ID,
            step: step.fieldData.projectObjectiveStep,
            order: step.fieldData.order || 0,
            completed: step.fieldData.f_completed === "1"
        }))
        .sort((a, b) => a.order - b.order);
}

/**
 * Validates project data before creation/update
 * @param {Object} data - Project data to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateProjectData(data) {
    const errors = [];

    if (!data.projectName?.trim()) {
        errors.push('Project name is required');
    }

    if (!data._custID) {
        errors.push('Customer ID is required');
    }

    if (data.estOfTime && !isValidTimeEstimate(data.estOfTime)) {
        errors.push('Invalid time estimate format');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Formats project data for display
 * @param {Object} project - Project record
 * @returns {Object} Formatted project data
 */
export function formatProjectForDisplay(project) {
    return {
        id: project.id,
        name: project.projectName,
        status: project.status,
        timeEstimate: project.estOfTime || 'Not specified',
        created: new Date(project.createdAt).toLocaleDateString(),
        modified: new Date(project.modifiedAt).toLocaleDateString(),
        objectivesCount: project.objectives.length,
        completedObjectives: project.objectives.filter(obj => obj.completed).length,
        imageCount: project.images.length,
        linkCount: project.links.length
    };
}

/**
 * Formats project data for FileMaker
 * @param {Object} data - Project data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatProjectForFileMaker(data) {
    return {
        projectName: data.name,
        _custID: data.customerId,
        estOfTime: data.timeEstimate,
        status: data.status || 'Open'
    };
}

/**
 * Calculates project completion percentage
 * @param {Object} project - Project record
 * @returns {number} Completion percentage
 */
export function calculateProjectCompletion(project) {
    const totalSteps = project.objectives.reduce(
        (total, obj) => total + obj.steps.length,
        0
    );
    
    if (totalSteps === 0) {
        return 0;
    }

    const completedSteps = project.objectives.reduce(
        (total, obj) => total + obj.steps.filter(step => step.completed).length,
        0
    );

    return Math.round((completedSteps / totalSteps) * 100);
}

// Helper functions

function isValidTimeEstimate(estimate) {
    // Accepts formats like "2h", "30m", "2h 30m"
    const timeRegex = /^(\d+h\s*)?(\d+m\s*)?$/;
    return timeRegex.test(estimate);
}

/**
 * Groups projects by status
 * @param {Array} projects - Array of project records
 * @returns {Object} Grouped projects { open, closed }
 */
export function groupProjectsByStatus(projects) {
    return projects.reduce((groups, project) => {
        const key = project.status === 'Open' ? 'open' : 'closed';
        groups[key].push(project);
        return groups;
    }, { open: [], closed: [] });
}

/**
 * Calculates project statistics
 * @param {Array} projects - Array of project records
 * @returns {Object} Project statistics
 */
export function calculateProjectStats(projects) {
    const grouped = groupProjectsByStatus(projects);
    return {
        total: projects.length,
        open: grouped.open.length,
        closed: grouped.closed.length,
        averageCompletion: Math.round(
            projects.reduce((sum, project) => sum + calculateProjectCompletion(project), 0) / 
            projects.length
        ) || 0
    };
}