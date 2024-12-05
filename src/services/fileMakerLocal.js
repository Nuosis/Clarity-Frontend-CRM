/**
 * Service for handling local FileMaker calls using FMGOfer and FileMaker.PerformScript
 */

/**
 * Executes a FileMaker script with the provided parameters
 * @param {Object} param - The parameters for the FileMaker script
 * @param {string} param.query - Query in the format "[{}] ([n]<fieldName>:<fieldValue>)"
 * @param {string} param.action - Action type (read, metaData, create, update, delete, duplicate)
 * @param {string} [param.recordId] - Record ID (required for update, delete and duplicate)
 * @returns {Promise} Resolves with the script result
 */
const executeFileMakerScript = (param) => {
  return new Promise((resolve, reject) => {
    if (typeof FileMaker === 'undefined') {
      reject(new Error('FileMaker object is not available'));
      return;
    }

    // Validate required parameters
    if (!param.action) {
      reject(new Error('Action is required'));
      return;
    }

    // Validate recordId for actions that require it
    if (['update', 'delete', 'duplicate'].includes(param.action) && !param.recordId) {
      reject(new Error('Record ID is required for update, delete, and duplicate actions'));
      return;
    }

    try {
      FileMaker.PerformScript('JS * fetchData', JSON.stringify(param));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Reads data from FileMaker
 * @param {string} query - Query string
 * @returns {Promise}
 */
const readData = (query) => {
  return executeFileMakerScript({
    action: 'read',
    query
  });
};

/**
 * Gets metadata from FileMaker
 * @param {string} query - Query string
 * @returns {Promise}
 */
const getMetaData = (query) => {
  return executeFileMakerScript({
    action: 'metaData',
    query
  });
};

export const fileMakerLocal = {
  executeFileMakerScript,
  readData,
  getMetaData
};
