/**
 * Service for handling local FileMaker calls using FMGOfer and FileMaker.PerformScript
 */

/**
 * Executes a FileMaker script with the provided parameters
 * @param {Object} param - The parameters for the FileMaker script
 * @param {string} param.query - Query in the format "[{}] ([n]<fieldName>:<fieldValue>)"
 * @param {string} param.action - Action type (read, metaData, create, update, delete, duplicate)
 * @param {string} [param.recordId] - Record ID (required for update, delete and duplicate)
 * @param {string} [param.layout] - Layout name to use for the operation
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
      FileMaker.PerformScript('staff * JS * Fetch Data', JSON.stringify(param));
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

/**
 * Creates a new note in FileMaker using the devNotes layout
 * @param {Object} noteData - The note data to create
 * @param {string} noteData.note - The note text
 * @param {string} noteData._fkID - The foreign key ID (task ID)
 * @returns {Promise}
 */
const createNote = (noteData) => {
  return executeFileMakerScript({
    action: 'create',
    layout: 'devNotes',
    fieldData: {
      note: noteData.note,
      _fkID: noteData._fkID
    }
  });
};

/**
 * Creates a new link in FileMaker using the devLinks layout
 * @param {Object} linkData - The link data to create
 * @param {string} linkData.link - The link URL
 * @param {string} linkData._fkID - The foreign key ID (task ID)
 * @returns {Promise}
 */
const createLink = (linkData) => {
  return executeFileMakerScript({
    action: 'create',
    layout: 'devLinks',
    fieldData: {
      link: linkData.link,
      _fkID: linkData._fkID
    }
  });
};

/**
 * Creates a new image in FileMaker using the devImage layout
 * @param {Object} imageData - The image data to create
 * @param {string} imageData.image_base64 - The base64 encoded image data
 * @param {string} imageData.fileName - The name of the file
 * @param {string} imageData._fkID - The foreign key ID (task ID)
 * @returns {Promise}
 */
const createImage = (imageData) => {
  return executeFileMakerScript({
    action: 'create',
    layout: 'devImage',
    fieldData: {
      image_base64: imageData.image_base64,
      fileName: imageData.fileName,
      _fkID: imageData._fkID
    }
  });
};

export const fileMakerLocal = {
  executeFileMakerScript,
  readData,
  getMetaData,
  createNote,
  createLink,
  createImage
};
