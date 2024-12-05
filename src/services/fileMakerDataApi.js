/**
 * Service for handling FileMaker Data API calls via custom endpoint
 */

const API_URL = process.env.FM_API_URL;

/**
 * Makes a request to the FileMaker Data API
 * @param {Object} requestData - The request data
 * @param {string} requestData.method - The method to call (e.g., createRecord)
 * @param {string} requestData.server - The server URL
 * @param {string} requestData.database - The database name
 * @param {string} requestData.layout - The layout name
 * @param {Object} requestData.params - The parameters for the request
 * @returns {Promise}
 */
const makeRequest = async (requestData) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    throw new Error('Authentication token not found');
  }

  try {
    const response = await fetch(`${API_URL}/clarityData`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('FileMaker Data API Error:', error);
    throw error;
  }
};

/**
 * Creates a new record
 * @param {Object} fieldData - The data for the new record
 * @param {string} layout - The layout name
 * @returns {Promise}
 */
const createRecord = (fieldData, layout = 'dapiParty') => {
  return makeRequest({
    method: 'createRecord',
    server: 'server.selectjanitorial.com',
    database: 'clarityData',
    layout,
    params: {
      fieldData
    }
  });
};

/**
 * Updates an existing record
 * @param {string} recordId - The ID of the record to update
 * @param {Object} fieldData - The updated field data
 * @param {string} layout - The layout name
 * @returns {Promise}
 */
const updateRecord = (recordId, fieldData, layout = 'dapiParty') => {
  return makeRequest({
    method: 'updateRecord',
    server: 'server.selectjanitorial.com',
    database: 'clarityData',
    layout,
    params: {
      recordId,
      fieldData
    }
  });
};

/**
 * Deletes a record
 * @param {string} recordId - The ID of the record to delete
 * @param {string} layout - The layout name
 * @returns {Promise}
 */
const deleteRecord = (recordId, layout = 'dapiParty') => {
  return makeRequest({
    method: 'deleteRecord',
    server: 'server.selectjanitorial.com',
    database: 'clarityData',
    layout,
    params: {
      recordId
    }
  });
};

export const fileMakerDataApi = {
  createRecord,
  updateRecord,
  deleteRecord,
  makeRequest
};
