/**
 * Simple Sync Tracking Service using sessionStorage
 * Tracks records that need to be created or updated
 * Data is cleared when the browser session ends
 */

/**
 * Gets the sessionStorage key for sync tracking
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string} - sessionStorage key
 */
function getSyncTrackingKey(organizationId, startDate, endDate) {
  return `sync_tracking_${organizationId}_${startDate}_${endDate}`;
}

/**
 * Stores records that need to be synced in sessionStorage
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} syncData - Data about what needs to be synced
 * @param {Array} syncData.toCreate - Records that need to be created
 * @param {Array} syncData.toUpdate - Records that need to be updated
 * @param {Array} syncData.toDelete - Records that need to be deleted
 */
export function storeSyncTracking(organizationId, startDate, endDate, syncData) {
  try {
    const key = getSyncTrackingKey(organizationId, startDate, endDate);
    const trackingData = {
      ...syncData,
      lastReview: new Date().toISOString(),
      dateRange: { startDate, endDate },
      organizationId
    };
    
    sessionStorage.setItem(key, JSON.stringify(trackingData));
    console.log(`Stored sync tracking for ${syncData.toCreate.length} creates, ${syncData.toUpdate.length} updates, ${syncData.toDelete.length} deletes`);
  } catch (error) {
    console.error('Error storing sync tracking:', error);
  }
}

/**
 * Gets records that need to be synced from sessionStorage
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object|null} - Sync tracking data or null if not found
 */
export function getSyncTracking(organizationId, startDate, endDate) {
  try {
    const key = getSyncTrackingKey(organizationId, startDate, endDate);
    const data = sessionStorage.getItem(key);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting sync tracking:', error);
    return null;
  }
}

/**
 * Clears sync tracking data after successful sync
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export function clearSyncTracking(organizationId, startDate, endDate) {
  try {
    const key = getSyncTrackingKey(organizationId, startDate, endDate);
    sessionStorage.removeItem(key);
    console.log(`Cleared sync tracking for ${organizationId} ${startDate} to ${endDate}`);
  } catch (error) {
    console.error('Error clearing sync tracking:', error);
  }
}

/**
 * Checks if there are pending sync operations
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {boolean} - True if there are pending operations
 */
export function hasPendingSync(organizationId, startDate, endDate) {
  const tracking = getSyncTracking(organizationId, startDate, endDate);
  
  if (!tracking) {
    return false;
  }
  
  return tracking.toCreate.length > 0 || tracking.toUpdate.length > 0 || tracking.toDelete.length > 0;
}

/**
 * Gets summary of pending sync operations
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} - Summary of pending operations
 */
export function getPendingSyncSummary(organizationId, startDate, endDate) {
  const tracking = getSyncTracking(organizationId, startDate, endDate);
  
  if (!tracking) {
    return {
      hasPending: false,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
      lastReview: null
    };
  }
  
  return {
    hasPending: tracking.toCreate.length > 0 || tracking.toUpdate.length > 0 || tracking.toDelete.length > 0,
    toCreate: tracking.toCreate.length,
    toUpdate: tracking.toUpdate.length,
    toDelete: tracking.toDelete.length,
    lastReview: tracking.lastReview
  };
}