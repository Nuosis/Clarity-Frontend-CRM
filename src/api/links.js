import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new link for a task
 * @param {Object} data - The link data
 * @returns {Promise<Object>} Created link record
 */
export async function createLink(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.LINKS,
            action: Actions.CREATE,
            fieldData: {
                // Only send the fields that are supported by the backend API
                link: data.url || data.link, // Support both 'url' and 'link' parameters
                _fkID: data.project_id || data.fkId // Support both 'project_id' and 'fkId' parameters
                // Note: title and description fields are not supported by the backend
            }
        };
        
        console.log('[Links API] Creating link with params:', {
            originalData: data,
            mappedParams: params
        });
        
        return await fetchDataFromFileMaker(params);
    });
}