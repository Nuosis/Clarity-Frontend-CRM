import { createTaskLink } from '../api/links';

/**
 * Creates a new link for a task
 * @param {string} taskId - The task ID
 * @param {string} link - The link URL
 * @returns {Promise<Object>} Created link record
 */
export async function createLink(taskId, link) {
    if (!taskId || !link?.trim()) {
        throw new Error('Task ID and link URL are required');
    }

    // Basic URL validation
    try {
        new URL(link.trim());
    } catch (error) {
        throw new Error('Invalid URL format');
    }

    return await createTaskLink({
        taskId,
        link: link.trim()
    });
}

/**
 * Processes links data from FileMaker
 * @param {Object} data - Raw links data
 * @returns {Array} Processed links
 */
export function processLinks(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(link => ({
            id: link.fieldData.__ID,
            recordId: link.recordID,
            url: link.fieldData.link,
            createdAt: link.fieldData['~creationTimestamp'],
            createdBy: link.fieldData['~createdBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}