/**
 * Project data processing and business logic
 */

/**
 * Processes raw project data from FileMaker
 * @param {Object} projectData - Raw project data
 * @param {Object} relatedData - Related project data (images, links, etc.)
 * @returns {Array} Processed project records
 */
export function processProjectData(projectData, relatedData = {}) {
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
 * Processes project images
 * @param {Array} images - Raw image data
 * @param {string} projectId - Project ID
 * @returns {Array} Processed image records
 */
export function processProjectImages(images, projectId) {
    if (!images?.response?.data) {
        return [];
    }

    return images.response.data
        .filter(img => img.fieldData._projectID === projectId)
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
 * @param {Array} links - Raw link data
 * @param {string} projectId - Project ID
 * @returns {Array} Processed link records
 */
export function processProjectLinks(links, projectId) {
    if (!links?.response?.data) {
        return [];
    }

    return links.response.data
        .filter(link => link.fieldData._fkID === projectId)
        .map(link => ({
            id: link.fieldData.__ID,
            recordId: link.recordId,
            url: link.fieldData.link,
            title: link.fieldData.title || new URL(link.fieldData.link).hostname
        }));
}

/**
 * Processes project objectives and their steps
 * @param {Array} objectives - Raw objective data
 * @param {string} projectId - Project ID
 * @param {Array} steps - Raw step data
 * @returns {Array} Processed objective records with steps
 */
export function processProjectObjectives(objectives, projectId, steps) {
    if (!objectives?.response?.data) {
        return [];
    }

    return objectives.response.data
        .filter(obj => obj.fieldData._projectID === projectId)
        .map(obj => ({
            id: obj.fieldData.__ID,
            recordId: obj.recordId,
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
export function processObjectiveSteps(steps, objectiveId) {
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
        dateStart: data.dateStart || "",
        dateEnd: data.dateEnd || "",
        __ID: data.id // Include the UUID in the data sent to FileMaker
    };
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
 * @param {Object} project - The project to process
 * @param {boolean} isUpdate - Whether this is an update to an existing project
 * @returns {Object} - Object containing any sales entries to be created
 */
export function processProjectValue(project, isUpdate = false) {
    const result = {
        salesToCreate: [],
        billableStatus: null
    };

    // Skip processing if neither fixed price nor subscription is set
    if (!project.f_fixedPrice && !project.f_subscription) {
        return result;
    }

    // Process fixed price projects
    if (project.f_fixedPrice) {
        result.billableStatus = false; // All hours are non-billable for fixed price projects
        
        // Check if project has a start date
        if (project.dateStart) {
            const startDate = new Date(project.dateStart);
            const today = new Date();
            
            // Only process if the start date is today or in the past
            if (startDate <= today) {
                // Add half the value to "sellable" when the project is started
                result.salesToCreate.push({
                    customer_id: project._custID,
                    amount: project.value / 2,
                    date: project.dateStart,
                    description: `Fixed price project (${project.projectName}) - 50% on start`,
                    project_id: project.id || project.__ID,
                    type: 'sellable'
                });
            }
        }
        
        // Check if project has an end date
        if (project.dateEnd) {
            const endDate = new Date(project.dateEnd);
            const today = new Date();
            
            // Only process if the end date is today or in the past
            if (endDate <= today) {
                // Add remaining half of the value to "sales" when the project is concluded
                result.salesToCreate.push({
                    customer_id: project._custID,
                    amount: project.value / 2,
                    date: project.dateEnd,
                    description: `Fixed price project (${project.projectName}) - 50% on completion`,
                    project_id: project.id || project.__ID,
                    type: 'sales'
                });
            }
        }
    }
    
    // Process subscription projects
    if (project.f_subscription && project.dateStart) {
        const startDate = new Date(project.dateStart);
        const today = new Date();
        const endDate = project.dateEnd ? new Date(project.dateEnd) : null;
        
        // Only process if the project has started and hasn't ended
        if (startDate <= today && (!endDate || endDate >= today)) {
            // Calculate how many months have passed since the start date
            const monthsPassed = calculateMonthsBetweenDates(startDate, today);
            
            // For each month, add the value to "sales"
            for (let i = 0; i < monthsPassed; i++) {
                const monthDate = new Date(startDate);
                monthDate.setMonth(startDate.getMonth() + i);
                
                // Skip if this date is after the end date
                if (endDate && monthDate > endDate) {
                    break;
                }
                
                result.salesToCreate.push({
                    customer_id: project._custID,
                    amount: project.value,
                    date: monthDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                    description: `Subscription project (${project.projectName}) - Month ${i + 1}`,
                    project_id: project.id || project.__ID,
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
 * @param {string} projectId - The ID of the project
 * @param {boolean} isBillable - Whether time records should be billable
 * @returns {Promise<Object>} - Result of the operation
 */
export async function updateProjectRecordsBillableStatus(projectId, isBillable) {
    // This function would update the billable status of all time records for a project
    // Implementation would depend on how time records are stored and updated
    // For now, this is a placeholder for the actual implementation
    
    console.log(`Updating billable status for project ${projectId} to ${isBillable}`);
    
    // Return a mock result for now
    return {
        success: true,
        message: `Updated billable status for project ${projectId}`
    };
}