/**
 * Project data processing and business logic
 */

/**
 * Converts a date from YYYY-MM-DD format to MM/DD/YYYY format for FileMaker
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Date in MM/DD/YYYY format
 */
function convertToFileMakerDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

/**
 * Processes raw project data from either FileMaker or Backend API
 * @param {Object} projectData - Raw project data
 * @param {Object} relatedData - Related project data (images, links, etc.)
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed project records
 */
export function processProjectData(projectData, relatedData = {}, source = 'filemaker') {
    // Handle backend API response format
    if (source === 'backend') {
        // Backend returns array directly or wrapped in data property
        const projects = Array.isArray(projectData) ? projectData : (projectData?.data || []);
        return projects.map(project => processBackendProject(project, relatedData));
    }

    // FileMaker response format
    if (!projectData?.response?.data) {
        return [];
    }

    return projectData.response.data.map(project => {
        const projectId = project.fieldData.__ID;
        const projectRecordId = project.recordId; // recordId is at the same level as fieldData
        return {
            ...project.fieldData,
            id: projectId,
            recordId: projectRecordId,
            status: project.fieldData.status || 'Open', // Provide default status
            f_fixedPrice: project.fieldData.f_fixedPrice === "1" || project.fieldData.f_fixedPrice === 1,
            f_subscription: project.fieldData.f_subscription === "1" || project.fieldData.f_subscription === 1,
            value: parseFloat(project.fieldData.value) || 0,
            images: processProjectImages(relatedData.images, projectId) || [],
            links: processProjectLinks(relatedData.links, projectId) || [],
            objectives: processProjectObjectives(relatedData.objectives, projectId, relatedData.steps) || [],
            records: processProjectRecords(relatedData.records, projectId)?.records || [],
            stats: processProjectRecords(relatedData.records, projectId)?.stats || {
                totalHours: 0,
                unbilledHours: 0
            },
            isActive: (project.fieldData.status || 'Open') === 'Open',
            createdAt: project.fieldData['~creationTimestamp'],
            modifiedAt: project.fieldData['~modificationTimestamp'],
            dateStart: project.fieldData.dateStart || null,
            dateEnd: project.fieldData.dateEnd || null
        };
    });
}

/**
 * Processes a single project from backend API response
 * Transforms backend schema to frontend format
 * @param {Object} project - Backend project data
 * @param {Object} relatedData - Related data (objectives, images, etc.)
 * @returns {Object} Processed project
 */
function processBackendProject(project, relatedData = {}) {
    const projectId = project.id;

    return {
        // Core fields - backend schema → frontend format
        id: project.id,
        __ID: project.id, // Maintain compatibility with existing code
        projectName: project.name,
        _custID: project.customer_id,
        _teamID: project.team_id || null,
        description: project.description || '',

        // Status mapping: backend uses lowercase with underscores
        status: mapBackendStatusToFrontend(project.status),

        // Date fields: backend uses YYYY-MM-DD format
        dateStart: project.start_date || null,
        dateEnd: project.target_end_date || project.actual_end_date || null,

        // Pricing fields
        value: parseFloat(project.budget) || 0,
        f_fixedPrice: project.is_fixed_price === true,
        f_subscription: project.is_subscription === true,

        // Time estimate (if field exists in backend)
        estOfTime: project.time_estimate || '',

        // Additional backend fields
        github_repo_url: project.github_repo_url || '',
        project_link: project.project_link || '',

        // Timestamps
        createdAt: project.created_at,
        modifiedAt: project.updated_at,
        '~creationTimestamp': project.created_at,
        '~modificationTimestamp': project.updated_at,

        // Related data (from nested response or separate queries)
        // Process nested or separate related data using backend format handlers
        images: project.images ?
            processProjectImages(project.images, projectId, 'backend') :
            (relatedData.images ? processProjectImages(relatedData.images, projectId, 'backend') : []),

        links: project.links ?
            processProjectLinks(project.links, projectId, 'backend') :
            (relatedData.links ? processProjectLinks(relatedData.links, projectId, 'backend') : []),

        objectives: project.objectives ?
            processProjectObjectives(project.objectives, projectId, project.steps || relatedData.steps, 'backend') :
            (relatedData.objectives ? processProjectObjectives(relatedData.objectives, projectId, relatedData.steps, 'backend') : []),

        records: project.records || relatedData.records || [],

        // Computed fields
        isActive: project.status === 'active' || project.status === 'pending',

        // Stats (from backend or computed)
        stats: project.stats || {
            totalHours: 0,
            unbilledHours: 0,
            completion_percentage: 0
        }
    };
}

/**
 * Maps backend status values to frontend format
 * @param {string} backendStatus - Backend status value
 * @returns {string} Frontend status value
 */
export function mapBackendStatusToFrontend(backendStatus) {
    const statusMap = {
        'active': 'Open',
        'pending': 'Open',
        'on_hold': 'On Hold',
        'completed': 'Closed',
        'cancelled': 'Cancelled'
    };
    return statusMap[backendStatus] || 'Open';
}

/**
 * Maps frontend status values to backend format
 * @param {string} frontendStatus - Frontend status value
 * @returns {string} Backend status value
 */
export function mapFrontendStatusToBackend(frontendStatus) {
    const statusMap = {
        'Open': 'active',
        'Active': 'active',
        'Pending': 'pending',
        'On Hold': 'on_hold',
        'Completed': 'completed',
        'Complete': 'completed',
        'Closed': 'completed',
        'Cancelled': 'cancelled'
    };
    return statusMap[frontendStatus] || 'active';
}

/**
 * Processes project images
 * Handles both FileMaker (response.data) and backend API formats
 * @param {Array} images - Raw image data
 * @param {string} projectId - Project ID
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed image records
 */
export function processProjectImages(images, projectId, source = 'filemaker') {
    // Backend API format: array directly or wrapped in data property
    if (source === 'backend') {
        const imageArray = Array.isArray(images) ? images : (images?.data || []);
        return imageArray.map(img => ({
            id: img.id,
            url: img.url,
            title: img.title || '',
            description: img.description || '',
            fileName: img.file_name || '',
            storageProvider: img.storage_provider || null,
            createdAt: img.created_at,
            updatedAt: img.updated_at,
            createdBy: img.created_by || ''
        }));
    }

    // FileMaker format: response.data with fieldData
    if (!images?.response?.data) {
        return [];
    }

    return images.response.data
        .filter(img => img.fieldData._fkID === projectId)
        .map(img => ({
            id: img.fieldData.__ID,
            recordId: img.recordId,
            url: img.fieldData.url,
            title: img.fieldData.title || '',
            description: img.fieldData.description || ''
        }));
}

/**
 * Processes project links
 * Handles both FileMaker (response.data) and backend API formats
 * Backend uses explicit foreign keys (project_id), FileMaker uses polymorphic _fkID
 * @param {Array} links - Raw link data
 * @param {string} projectId - Project ID
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed link records
 */
export function processProjectLinks(links, projectId, source = 'filemaker') {
    // Backend API format: array directly or wrapped in data property
    if (source === 'backend') {
        const linksArray = Array.isArray(links) ? links : (links?.data || []);

        // Filter links by project_id and transform to frontend format
        return linksArray
            .filter(link => link.project_id === projectId)
            .map(link => {
                // Generate title from URL hostname if not provided
                let title = link.title;
                if (!title && link.link) {
                    try {
                        title = new URL(link.link).hostname;
                    } catch {
                        title = link.link;
                    }
                }

                return {
                    id: link.id,
                    url: link.link,
                    title: title,
                    customerId: link.customer_id,
                    organizationId: link.organization_id,
                    projectId: link.project_id,
                    taskId: link.task_id,
                    createdAt: link.created_at,
                    updatedAt: link.updated_at
                };
            })
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // FileMaker format: response.data with fieldData
    if (!links?.response?.data) {
        return [];
    }

    return links.response.data
        .filter(link => link.fieldData._fkID === projectId)
        .map(link => {
            // Generate title from URL if not provided
            let title = link.fieldData.title;
            if (!title && link.fieldData.link) {
                try {
                    title = new URL(link.fieldData.link).hostname;
                } catch {
                    title = link.fieldData.link;
                }
            }

            return {
                id: link.fieldData.__ID,
                recordId: link.recordId,
                url: link.fieldData.link,
                title: title,
                createdAt: link.fieldData['~creationTimestamp'],
                modifiedAt: link.fieldData['~modificationTimestamp']
            };
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Processes project objectives and their steps
 * Handles both FileMaker (response.data) and backend API formats
 * Backend uses proper foreign keys (project_id), FileMaker uses _projectID
 * @param {Array} objectives - Raw objective data
 * @param {string} projectId - Project ID
 * @param {Array} steps - Raw step data
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed objective records with steps
 */
export function processProjectObjectives(objectives, projectId, steps, source = 'filemaker') {
    // Backend API format: objectives with nested steps
    if (source === 'backend') {
        const objArray = Array.isArray(objectives) ? objectives : (objectives?.data || []);
        return objArray.map(obj => ({
            id: obj.id,
            objective: obj.objective,
            status: obj.status || 'Open',
            order: obj.order_num || 0,
            completed: obj.completed === true,
            createdAt: obj.created_at,
            updatedAt: obj.updated_at,
            // Steps can be nested or provided separately
            steps: obj.steps ? processObjectiveSteps(obj.steps, obj.id, source) :
                   (steps ? processObjectiveSteps(steps, obj.id, source) : [])
        }))
        .sort((a, b) => a.order - b.order);
    }

    // FileMaker format: response.data with fieldData
    if (!objectives?.response?.data) {
        return [];
    }

    return objectives.response.data
        .filter(obj => obj.fieldData._projectID === projectId)
        .map(obj => ({
            id: obj.fieldData.__ID,
            recordId: obj.recordId,
            objective: obj.fieldData.projectObjective,
            status: obj.fieldData.status || 'Open',
            order: obj.fieldData.order || 0,
            completed: obj.fieldData.f_completed === 1 || obj.fieldData.f_completed === "1",
            steps: processObjectiveSteps(steps, obj.fieldData.__ID, source)
        }))
        .sort((a, b) => a.order - b.order);
}

/**
 * Processes objective steps
 * Handles both FileMaker (response.data) and backend API formats
 * Backend uses proper foreign keys (objective_id), FileMaker uses _objectiveID
 * @param {Array} steps - Raw step data
 * @param {string} objectiveId - Objective ID
 * @param {string} source - Data source: 'filemaker' or 'backend'
 * @returns {Array} Processed step records
 */
export function processObjectiveSteps(steps, objectiveId, source = 'filemaker') {
    // Backend API format: array directly or wrapped in data property
    if (source === 'backend') {
        const stepsArray = Array.isArray(steps) ? steps : (steps?.data || []);
        // If steps already filtered (nested), don't filter again
        const needsFilter = stepsArray.some(step => step.objective_id !== objectiveId);
        const filteredSteps = needsFilter ?
            stepsArray.filter(step => step.objective_id === objectiveId) :
            stepsArray;

        return filteredSteps.map(step => ({
            id: step.id,
            step: step.step,
            order: step.order_num || 0,
            completed: step.completed === true,
            createdAt: step.created_at,
            updatedAt: step.updated_at
        }))
        .sort((a, b) => a.order - b.order);
    }

    // FileMaker format: response.data with fieldData
    if (!steps?.response?.data) {
        return [];
    }

    return steps.response.data
        .filter(step => step.fieldData._objectiveID === objectiveId)
        .map(step => ({
            id: step.fieldData.__ID,
            recordId: step.recordId,
            step: step.fieldData.projectObjectiveStep,
            order: step.fieldData.order || 0,
            completed: step.fieldData.f_completed === "1"
        }))
        .sort((a, b) => a.order - b.order);
}

/**
 * Processes project time records
 * @param {Array} records - Raw time record data
 * @param {string} projectId - Project ID
 * @returns {Array} Processed time records
 */
function processProjectRecords(records, projectId) {
    if (!records?.response?.data) {
        return {
            records: [],
            stats: {
                totalHours: 0,
                unbilledHours: 0
            }
        };
    }

    const projectRecords = records.response.data
        .filter(record => record.fieldData._projectID === projectId)
        .map(record => ({
            id: record.fieldData.__ID,
            recordId: record.recordId,
            startTime: record.fieldData.startTime,
            endTime: record.fieldData.endTime,
            description: record.fieldData.description || '',
            duration: calculateDuration(record.fieldData.startTime, record.fieldData.endTime),
            isBilled: record.fieldData.f_billed === "1" || record.fieldData.f_billed === 1
        }))
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    // Calculate total and unbilled hours
    const totalMinutes = projectRecords.reduce((total, record) => total + record.duration, 0);
    const unbilledMinutes = projectRecords
        .filter(record => !record.isBilled)
        .reduce((total, record) => total + record.duration, 0);

    return {
        records: projectRecords,
        stats: {
            totalHours: Math.round(totalMinutes / 60 * 10) / 10, // Round to 1 decimal place
            unbilledHours: Math.round(unbilledMinutes / 60 * 10) / 10
        }
    };
}

/**
 * Calculates duration between two timestamps in minutes
 * @param {string} startTime - Start timestamp
 * @param {string} endTime - End timestamp
 * @returns {number} Duration in minutes
 */
function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    return Math.round(diffMs / (1000 * 60)); // Convert to minutes
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

    // Validate fixed price and subscription fields
    if (data.f_fixedPrice === "1" || data.f_fixedPrice === 1) {
        if (!data.value || isNaN(parseFloat(data.value)) || parseFloat(data.value) <= 0) {
            errors.push('Value is required for fixed price projects and must be a positive number');
        }
    }

    if (data.f_subscription === "1" || data.f_subscription === 1) {
        if (!data.value || isNaN(parseFloat(data.value)) || parseFloat(data.value) <= 0) {
            errors.push('Value is required for subscription projects and must be a positive number');
        }
        
        if (!data.dateStart) {
            errors.push('Start date is required for subscription projects');
        }
    }

    // Ensure both fixed price and subscription aren't set at the same time
    if ((data.f_fixedPrice === "1" || data.f_fixedPrice === 1) &&
        (data.f_subscription === "1" || data.f_subscription === 1)) {
        errors.push('A project cannot be both fixed price and subscription');
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
        recordId: project.recordId,
        name: project.projectName,
        status: project.status,
        timeEstimate: project.estOfTime || 'Not specified',
        created: new Date(project.createdAt).toLocaleDateString(),
        modified: new Date(project.modifiedAt).toLocaleDateString(),
        objectivesCount: project.objectives.length,
        completedObjectives: project.objectives.filter(obj => obj.completed).length,
        imageCount: project.images.length,
        linkCount: project.links.length,
        isFixedPrice: project.f_fixedPrice || false,
        isSubscription: project.f_subscription || false,
        value: project.value || 0,
        dateStart: project.dateStart ? new Date(project.dateStart).toLocaleDateString() : 'Not set',
        dateEnd: project.dateEnd ? new Date(project.dateEnd).toLocaleDateString() : 'Not set'
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
        status: data.status || 'Open',
        f_fixedPrice: data.isFixedPrice ? "1" : "0",
        f_subscription: data.isSubscription ? "1" : "0",
        value: data.value || "0",
        dateStart: convertToFileMakerDate(data.dateStart),
        dateEnd: convertToFileMakerDate(data.dateEnd),
        __ID: data.id // Include the UUID in the data sent to FileMaker
    };
}

/**
 * Formats project data for Backend API
 * Transforms frontend format to backend schema
 * @param {Object} data - Project data to format
 * @returns {Object} Formatted data for backend API
 */
export function formatProjectForBackend(data) {
    const backendData = {
        name: data.name || data.projectName,
        customer_id: data.customerId || data._custID,
        description: data.description || '',
        status: mapFrontendStatusToBackend(data.status || 'Open'),
        budget: parseFloat(data.value) || null,
        start_date: data.dateStart || null,
        target_end_date: data.dateEnd || null,
    };

    // Optional fields - only include if they exist
    if (data.teamId || data._teamID) {
        backendData.team_id = data.teamId || data._teamID;
    }

    if (data.timeEstimate || data.estOfTime) {
        backendData.time_estimate = data.timeEstimate || data.estOfTime;
    }

    if (data.github_repo_url) {
        backendData.github_repo_url = data.github_repo_url;
    }

    if (data.project_link) {
        backendData.project_link = data.project_link;
    }

    // Pricing flags (if backend schema supports them)
    if (data.isFixedPrice !== undefined) {
        backendData.is_fixed_price = data.isFixedPrice === true || data.isFixedPrice === "1";
    }

    if (data.isSubscription !== undefined) {
        backendData.is_subscription = data.isSubscription === true || data.isSubscription === "1";
    }

    // Include ID for updates
    if (data.id) {
        backendData.id = data.id;
    }

    return backendData;
}

/**
 * Calculates project completion percentage
 * @param {Object} project - Project record
 * @returns {number} Completion percentage
 */
export function calculateProjectCompletion(project) {
    // Check if project has objectives
    if (!project || !project.objectives || !Array.isArray(project.objectives)) {
        return 0;
    }
    
    const totalSteps = project.objectives.reduce(
        (total, obj) => total + (obj.steps && Array.isArray(obj.steps) ? obj.steps.length : 0),
        0
    );
    
    if (totalSteps === 0) {
        return 0;
    }

    const completedSteps = project.objectives.reduce(
        (total, obj) => total + (obj.steps && Array.isArray(obj.steps)
            ? obj.steps.filter(step => step && step.completed).length
            : 0),
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

/**
 * Calculates customer-specific project statistics
 * @param {Array} projects - Array of customer's projects
 * @param {Array} records - Array of time records
 * @returns {Object} Customer project statistics
 */
export function calculateCustomerStats(projects, records) {
    if (!projects || !records) {
        return {
            total: 0,
            open: 0,
            closed: 0,
            unbilledHours: 0
        };
    }

    // Calculate project stats
    const projectStats = calculateProjectStats(projects);

    // Calculate total unbilled hours across all customer projects
    const unbilledHours = records
        .filter(record => 
            record.fieldData.f_billed === "0" &&
            projects.some(project => project.id === record.fieldData._projectID)
        )
        .reduce((total, record) => 
            total + (parseFloat(record.fieldData.Billable_Time_Rounded) || 0), 0
        );

    return {
        ...projectStats,
        unbilledHours: Math.round(unbilledHours * 10) / 10 // Round to 1 decimal place
    };
}

/**
 * Calculates detailed statistics for a single project
 * @param {Object} project - Project data
 * @param {Array} records - Project time records
 * @returns {Object} Project statistics
 */
// Calculate total hours from records
function calculateRecordsTotalHours(records) {
    if (!records) return "0.0";
    return records.reduce((total, record) =>
        total + (parseFloat(record.fieldData.Billable_Time_Rounded) || 0), 0
    ).toFixed(1);
}

// Calculate unbilled hours from records, optionally filtered by current month and customer
export function calculateRecordsUnbilledHours(records, currentMonthOnly = false, customerId = null) {
    //console.log({records})
    if (!records) return "0.0";
    
    // Apply both customer and month filters in a single operation
    const filteredRecords = records.filter(record => {
        // Check customer ID if provided
        const matchesCustomer = !customerId ||
            record.fieldData["_custID"] === customerId;

        // Check current month if required
        const matchesMonth = !currentMonthOnly || (() => {
            const now = new Date();
            const recordDate = new Date(record.fieldData.DateStart);
            return recordDate.getMonth() === now.getMonth() &&
                   recordDate.getFullYear() === now.getFullYear();
        })();

        return matchesCustomer && matchesMonth;
    });

    // Calculate unbilled hours from filtered records
    const unbilledHours = filteredRecords
        .filter(record => record.fieldData.f_billed === "0")
        .reduce((total, record) =>
            total + (parseFloat(record.fieldData.Billable_Time_Rounded) || 0), 0
        );
    
    // Return as a formatted string with 1 decimal place
    return unbilledHours.toFixed(1) + " hrs";
}

// Calculate detailed stats for a single project
export function calculateProjectDetailStats(project, records) {
    if (!project || !records) {
        return {
            totalHours: "0.0",
            unbilledHours: "0.0",
            completion: 0
        };
    }

    // Handle different ID formats
    const projectId = project.__ID || project.id || project.recordId;
    
    const projectRecords = records.filter(r =>
        r.fieldData && r.fieldData._projectID &&
        (r.fieldData._projectID === projectId)
    );
    
    return {
        totalHours: calculateRecordsTotalHours(projectRecords),
        unbilledHours: calculateRecordsUnbilledHours(projectRecords),
        completion: calculateProjectCompletion(project)
    };
}

/**
 * Gets a fully processed project with all related data
 * @param {Object} project - Base project data
 * @param {Object} relatedData - Related project data (images, links, records, etc.)
 * @returns {Object} Processed project with all data
 */
export function getProcessedProject(project, relatedData) {
    return processProjectData({
        response: {
            data: [{
                fieldData: {
                    ...project,
                    __ID: project.id
                }
            }]
        }
    }, relatedData)[0];
}

/**
 * Processes a project's fixed price or subscription value according to business rules
 * Works with both FileMaker and Backend API data formats
 * @param {Object} project - The project to process
 * @param {boolean} isUpdate - Whether this is an update to an existing project
 * @returns {Object} - Object containing any sales entries to be created
 */
export function processProjectValue(project, isUpdate = false) {
    const result = {
        salesToCreate: [],
        billableStatus: null
    };

    // Normalize field names (handle both FileMaker and backend formats)
    const isFixedPrice = project.f_fixedPrice || project.is_fixed_price;
    const isSubscription = project.f_subscription || project.is_subscription;
    const projectValue = project.value || project.budget || 0;
    const customerId = project._custID || project.customer_id;
    const projectName = project.projectName || project.name;
    const projectId = project.id || project.__ID;
    const startDate = project.dateStart || project.start_date;
    const endDate = project.dateEnd || project.target_end_date || project.actual_end_date;

    // Skip processing if neither fixed price nor subscription is set
    if (!isFixedPrice && !isSubscription) {
        return result;
    }

    // Process fixed price projects
    if (isFixedPrice) {
        result.billableStatus = false; // All hours are non-billable for fixed price projects

        // Check if project has a start date
        if (startDate) {
            const startDateObj = new Date(startDate);
            const today = new Date();

            // Only process if the start date is today or in the past
            if (startDateObj <= today) {
                // Add half the value to "sellable" when the project is started
                result.salesToCreate.push({
                    customer_id: customerId,
                    amount: projectValue / 2,
                    date: startDate,
                    description: `Fixed price project (${projectName}) - 50% on start`,
                    project_id: projectId,
                    type: 'sellable'
                });
            }
        }

        // Check if project has an end date
        if (endDate) {
            const endDateObj = new Date(endDate);
            const today = new Date();

            // Only process if the end date is today or in the past
            if (endDateObj <= today) {
                // Add remaining half of the value to "sales" when the project is concluded
                result.salesToCreate.push({
                    customer_id: customerId,
                    amount: projectValue / 2,
                    date: endDate,
                    description: `Fixed price project (${projectName}) - 50% on completion`,
                    project_id: projectId,
                    type: 'sales'
                });
            }
        }
    }

    // Process subscription projects
    if (isSubscription && startDate) {
        const startDateObj = new Date(startDate);
        const today = new Date();
        const endDateObj = endDate ? new Date(endDate) : null;

        // Only process if the project has started and hasn't ended
        if (startDateObj <= today && (!endDateObj || endDateObj >= today)) {
            // Calculate how many months have passed since the start date
            const monthsPassed = calculateMonthsBetweenDates(startDateObj, today);

            // For each month, add the value to "sales"
            for (let i = 0; i < monthsPassed; i++) {
                const monthDate = new Date(startDateObj);
                monthDate.setMonth(startDateObj.getMonth() + i);

                // Skip if this date is after the end date
                if (endDateObj && monthDate > endDateObj) {
                    break;
                }

                result.salesToCreate.push({
                    customer_id: customerId,
                    amount: projectValue,
                    date: monthDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                    description: `Subscription project (${projectName}) - Month ${i + 1}`,
                    project_id: projectId,
                    type: 'sales'
                });
            }
        }
    }

    return result;
}

/**
 * Calculates the number of months between two dates
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {number} - The number of months between the dates
 */
function calculateMonthsBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate the difference in months
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    
    // Calculate total months difference
    let months = yearDiff * 12 + monthDiff;
    
    // If the end date is before the same day of the month as the start date,
    // we haven't completed that month yet, so subtract 1
    if (end.getDate() < start.getDate()) {
        months--;
    }
    
    // Ensure we return at least 1 if we're in the same month and the day has passed
    return Math.max(0, months);
}

/**
 * Updates the billable status of time records based on project settings
 *
 * BUSINESS LOGIC NOTE:
 * - Fixed-price projects: All time records should be non-billable (billable = false)
 * - Regular projects: Time records remain billable (default behavior)
 *
 * IMPLEMENTATION STATUS:
 * - Currently not implemented - placeholder only
 * - Requires backend API endpoint to bulk update time records
 * - Backend should handle: /api/time-entries/project/{project_id}/billable-status
 * - Alternative: Update via financial-records endpoints
 *
 * @param {string} projectId - The ID of the project
 * @param {boolean} isBillable - Whether time records should be billable
 * @returns {Promise<Object>} - Result of the operation
 */
export async function updateProjectRecordsBillableStatus(projectId, isBillable) {
    try {
        console.log(`[Business Logic] Updating billable status for project ${projectId} to ${isBillable}`);

        // TODO: Implement backend API call when endpoint is available
        // Expected endpoint: PATCH /api/time-entries/project/{project_id}/billable-status
        // Payload: { is_billable: boolean }
        //
        // Alternative: Use /api/financial-records/query to get records, then update individually
        // This would be less efficient but works with existing endpoints

        console.warn(`[Business Logic] Billable status update not yet implemented for project ${projectId}`);
        console.warn(`[Business Logic] Time records will need manual billable status updates`);

        return {
            success: true,
            implemented: false,
            message: `Billable status update queued for project ${projectId} (not yet implemented)`,
            projectId,
            isBillable
        };
    } catch (error) {
        console.error(`[Business Logic] Error updating billable status for project ${projectId}:`, error);
        return {
            success: false,
            implemented: false,
            error: error.message,
            projectId,
            isBillable
        };
    }
}