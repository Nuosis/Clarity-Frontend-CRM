import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new link for a task
 * @param {Object} data - The link data
 * @returns {Promise<Object>} Created link record
 */
export async function createTaskLink(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.LINKS,
            action: Actions.CREATE,
            fieldData: {
                link: data.link,
                _fkID: data.taskId
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}