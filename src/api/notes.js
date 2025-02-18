import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new note for a task
 * @param {Object} data - The note data
 * @returns {Promise<Object>} Created note record
 */
export async function createNote(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.NOTES,
            action: Actions.CREATE,
            fieldData: {
                note: data.note,
                _fkID: data.fkId,
                type: data.type || 'general'
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}