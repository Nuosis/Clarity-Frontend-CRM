import { createTaskNote } from '../api/notes';

/**
 * Creates a new note for a task
 * @param {string} taskId - The task ID
 * @param {string} note - The note content
 * @param {string} type - The note type (optional)
 * @returns {Promise<Object>} Created note record
 */
export async function createNote(taskId, note, type = 'general') {
    if (!taskId || !note?.trim()) {
        throw new Error('Task ID and note content are required');
    }

    return await createTaskNote({
        taskId,
        note: note.trim(),
        type
    });
}

/**
 * Processes notes data from FileMaker
 * @param {Object} data - Raw notes data
 * @returns {Array} Processed notes
 */
export function processTaskNotes(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(note => ({
            id: note.fieldData.__ID,
            content: note.fieldData.note,
            createdAt: note.fieldData['~CreationTimestamp'],
            createdBy: note.fieldData['~CreatedBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}