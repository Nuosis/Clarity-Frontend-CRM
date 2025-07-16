/**
 * Financial Synchronization Service
 * Ensures devRecords match customer_sales for given date ranges
 */
import { query, update, insert, remove } from './supabaseService';
import { fetchRecordsForDateRange } from '../api/financialRecords';
import { processFinancialData } from './billableHoursService';
import {
  storeSyncTracking,
  getSyncTracking,
  clearSyncTracking,
  hasPendingSync
} from './syncTrackingService';

/**
 * Synchronizes devRecords with customer_sales for a given date range
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Additional options
 * @param {boolean} options.dryRun - If true, only reports what would be changed without making changes
 * @param {boolean} options.deleteOrphaned - If true, deletes customer_sales records that don't exist in devRecords
 * @returns {Promise<Object>} - Synchronization result
 */
export async function synchronizeFinancialRecords(organizationId, startDate, endDate, options = {}) {
  const { dryRun = false, deleteOrphaned = false, usePendingOnly = false } = options;
  const syncStartTime = Date.now();
  
  try {
    console.log(`Starting financial synchronization for organization ${organizationId} from ${startDate} to ${endDate}`);
    
    let comparison;
    
    if (usePendingOnly) {
      // Use only the records stored in localStorage that need syncing
      const pendingSync = getSyncTracking(organizationId, startDate, endDate);
      
      if (!pendingSync) {
        console.log('No pending sync operations found');
        return {
          success: true,
          summary: {
            devRecordsCount: 0,
            customerSalesCount: 0,
            toCreate: 0,
            toUpdate: 0,
            toDelete: 0,
            unchanged: 0,
            syncType: 'pending_only'
          },
          changes: {
            created: [],
            updated: [],
            deleted: [],
            errors: []
          },
          duration: Date.now() - syncStartTime,
          dryRun
        };
      }
      
      comparison = {
        toCreate: pendingSync.toCreate || [],
        toUpdate: pendingSync.toUpdate || [],
        toDelete: pendingSync.toDelete || [],
        unchanged: []
      };
      
      console.log(`Using pending sync: ${comparison.toCreate.length} creates, ${comparison.toUpdate.length} updates, ${comparison.toDelete.length} deletes`);
    } else {
      // Perform full review and store what needs to be synced
      console.log('Performing full review to identify sync needs');
      
      // Step 1: Fetch devRecords for the date range
      const devRecordsResult = await fetchDevRecordsForDateRange(startDate, endDate);
      if (!devRecordsResult.success) {
        throw new Error(`Failed to fetch devRecords: ${devRecordsResult.error}`);
      }
      
      const devRecords = devRecordsResult.data;
      console.log(`Found ${devRecords.length} devRecords for date range`);
      
      // Step 2: Fetch customer_sales for the date range and organization
      const customerSalesResult = await fetchCustomerSalesForDateRange(organizationId, startDate, endDate);
      if (!customerSalesResult.success) {
        throw new Error(`Failed to fetch customer_sales: ${customerSalesResult.error}`);
      }
      
      const customerSales = customerSalesResult.data;
      console.log(`Found ${customerSales.length} customer_sales records for date range`);
      
      // Step 3: Compare and identify differences
      comparison = await compareRecords(devRecords, customerSales, organizationId);
      
      // Step 4: Store what needs to be synced in localStorage
      storeSyncTracking(organizationId, startDate, endDate, comparison);
    }
    
    // Step 5: Apply synchronization changes
    const syncResult = {
      success: true,
      summary: {
        devRecordsCount: comparison.toCreate.length + comparison.toUpdate.length + comparison.unchanged.length,
        customerSalesCount: comparison.toUpdate.length + comparison.toDelete.length + comparison.unchanged.length,
        toCreate: comparison.toCreate.length,
        toUpdate: comparison.toUpdate.length,
        toDelete: deleteOrphaned ? comparison.toDelete.length : 0,
        unchanged: comparison.unchanged.length,
        syncType: usePendingOnly ? 'pending_only' : 'full_review'
      },
      changes: {
        created: [],
        updated: [],
        deleted: [],
        errors: []
      },
      processedRecordIds: [],
      duration: 0,
      dryRun
    };
    
    if (!dryRun) {
      // Create new records
      for (const devRecord of comparison.toCreate) {
        try {
          const createResult = await createCustomerSaleFromDevRecord(devRecord, organizationId);
          if (createResult.success) {
            syncResult.changes.created.push(createResult.data);
          } else {
            syncResult.changes.errors.push({
              type: 'create',
              devRecordId: devRecord.id,
              error: createResult.error
            });
          }
        } catch (error) {
          syncResult.changes.errors.push({
            type: 'create',
            devRecordId: devRecord.id,
            error: error.message
          });
        }
      }
      
      // Update existing records
      for (const updateItem of comparison.toUpdate) {
        try {
          const updateResult = await updateCustomerSaleFromDevRecord(
            updateItem.customerSale.id,
            updateItem.devRecord,
            organizationId
          );
          if (updateResult.success) {
            syncResult.changes.updated.push(updateResult.data);
          } else {
            syncResult.changes.errors.push({
              type: 'update',
              customerSaleId: updateItem.customerSale.id,
              devRecordId: updateItem.devRecord.id,
              error: updateResult.error
            });
          }
        } catch (error) {
          syncResult.changes.errors.push({
            type: 'update',
            customerSaleId: updateItem.customerSale.id,
            devRecordId: updateItem.devRecord.id,
            error: error.message
          });
        }
      }
      
      // Delete orphaned records if requested
      if (deleteOrphaned) {
        for (const customerSale of comparison.toDelete) {
          try {
            const deleteResult = await remove('customer_sales', { id: customerSale.id });
            if (deleteResult.success) {
              syncResult.changes.deleted.push(customerSale);
            } else {
              syncResult.changes.errors.push({
                type: 'delete',
                customerSaleId: customerSale.id,
                error: deleteResult.error
              });
            }
          } catch (error) {
            syncResult.changes.errors.push({
              type: 'delete',
              customerSaleId: customerSale.id,
              error: error.message
            });
          }
        }
      }
      
      // Track unchanged records as processed
      for (const unchangedItem of comparison.unchanged) {
        syncResult.processedRecordIds.push(unchangedItem.devRecord.id);
        
        // Note: Record processing tracking removed - function not implemented
        console.log(`Skipped record ${unchangedItem.devRecord.id} - already in sync with customer_sales ${unchangedItem.customerSale.id}`);
      }
    } else {
      // Dry run - just populate what would be changed
      syncResult.changes.created = comparison.toCreate.map(record => ({
        devRecordId: record.id,
        customerName: record.customerName,
        projectName: record.projectName,
        amount: record.amount,
        date: record.date
      }));
      
      syncResult.changes.updated = comparison.toUpdate.map(item => ({
        customerSaleId: item.customerSale.id,
        devRecordId: item.devRecord.id,
        changes: item.changes
      }));
      
      if (deleteOrphaned) {
        syncResult.changes.deleted = comparison.toDelete.map(record => ({
          customerSaleId: record.id,
          financialId: record.financial_id
        }));
      }
      
      // For dry run, include all record IDs as processed
      syncResult.processedRecordIds = [
        ...comparison.toCreate.map(r => r.id),
        ...comparison.toUpdate.map(r => r.devRecord.id),
        ...comparison.unchanged.map(r => r.devRecord.id)
      ];
    }
    
    // Calculate sync duration
    syncResult.duration = Date.now() - syncStartTime;
    
    // Note: Sync result tracking removed - function not implemented
    if (!dryRun) {
      console.log(`Sync completed for organization ${organizationId} from ${startDate} to ${endDate}:`, {
        created: syncResult.changes.created.length,
        updated: syncResult.changes.updated.length,
        deleted: syncResult.changes.deleted.length,
        errors: syncResult.changes.errors.length,
        duration: syncResult.duration
      });
    }
    
    console.log(`Synchronization completed. Created: ${syncResult.changes.created.length}, Updated: ${syncResult.changes.updated.length}, Deleted: ${syncResult.changes.deleted.length}, Errors: ${syncResult.changes.errors.length}, Duration: ${syncResult.duration}ms`);
    
    return syncResult;
    
  } catch (error) {
    console.error('Error during financial synchronization:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetches devRecords for a specific date range (simplified for sync)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Result with devRecords data
 */
async function fetchDevRecordsForDateRange(startDate, endDate) {
  try {
    console.log(`Fetching devRecords for date range: ${startDate} to ${endDate}`);
    
    // Use the simplified date range fetch - no filtering by payment status
    const result = await fetchRecordsForDateRange(startDate, endDate);
    
    if (!result || !result.response || !result.response.data) {
      throw new Error('Failed to fetch financial records for date range');
    }
    
    // Process the financial data
    const records = processFinancialData(result);
    
    console.log(`Found ${records.length} records for date range ${startDate} to ${endDate}`);
    
    return {
      success: true,
      data: records
    };
  } catch (error) {
    console.error('Error fetching devRecords for date range:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetches customer_sales records for a specific date range and organization
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Result with customer_sales data
 */
async function fetchCustomerSalesForDateRange(organizationId, startDate, endDate) {
  try {
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'gte', column: 'date', value: startDate },
        { type: 'lte', column: 'date', value: endDate }
      ],
      order: {
        column: 'date',
        ascending: true
      }
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch customer_sales');
    }
    
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('Error fetching customer_sales for date range:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Compares devRecords with customer_sales and identifies differences
 * @param {Array} devRecords - Array of devRecords
 * @param {Array} customerSales - Array of customer_sales records
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - Comparison result
 */
async function compareRecords(devRecords, customerSales, organizationId) {
  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];
  const unchanged = [];
  
  // Create a map of customer_sales by financial_id for quick lookup (case-insensitive)
  const customerSalesMap = new Map();
  customerSales.forEach(sale => {
    if (sale.financial_id) {
      // Store with lowercase key for case-insensitive matching
      customerSalesMap.set(sale.financial_id.toLowerCase(), sale);
    }
  });
  
  // Check each devRecord
  for (const devRecord of devRecords) {
    // Use lowercase for case-insensitive comparison
    const existingSale = customerSalesMap.get(devRecord.id.toLowerCase());
    
    if (!existingSale) {
      // Record doesn't exist in customer_sales, needs to be created
      toCreate.push(devRecord);
    } else {
      // Record exists, check if it needs updating
      const changes = await identifyChanges(devRecord, existingSale, organizationId);
      if (Object.keys(changes).length > 0) {
        toUpdate.push({
          devRecord,
          customerSale: existingSale,
          changes
        });
      } else {
        unchanged.push({
          devRecord,
          customerSale: existingSale
        });
      }
      
      // Remove from map so we can identify orphaned records (use lowercase key)
      customerSalesMap.delete(devRecord.id.toLowerCase());
    }
  }
  
  // Remaining records in customerSalesMap are orphaned (exist in customer_sales but not in devRecords)
  customerSalesMap.forEach(sale => {
    toDelete.push(sale);
  });
  
  return {
    toCreate,
    toUpdate,
    toDelete,
    unchanged
  };
}

/**
 * Identifies what changes need to be made to a customer_sales record based on devRecord
 * @param {Object} devRecord - The devRecord data
 * @param {Object} customerSale - The existing customer_sales record
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - Object containing the changes needed
 */
async function identifyChanges(devRecord, customerSale, organizationId) {
  const changes = {};
  
  // Check quantity (hours) - round to 2 decimal places for comparison
  const devHours = Math.round(Number(devRecord.hours) * 100) / 100;
  const saleQuantity = Math.round(Number(customerSale.quantity) * 100) / 100;
  if (devHours !== saleQuantity) {
    changes.quantity = Number(devRecord.hours);
  }
  
  // Check unit_price (rate) - round to 2 decimal places for comparison
  const devRate = Math.round(Number(devRecord.rate) * 100) / 100;
  const saleUnitPrice = Math.round(Number(customerSale.unit_price) * 100) / 100;
  if (devRate !== saleUnitPrice) {
    changes.unit_price = Number(devRecord.rate);
  }
  
  // Check total_price (amount) - round to 2 decimal places for comparison
  const devAmount = Math.round(Number(devRecord.amount) * 100) / 100;
  const saleTotalPrice = Math.round(Number(customerSale.total_price) * 100) / 100;
  if (devAmount !== saleTotalPrice) {
    changes.total_price = Number(devRecord.amount);
  }
  
  // Check date
  const devRecordDate = new Date(devRecord.date).toISOString().split('T')[0];
  const customerSaleDate = new Date(customerSale.date).toISOString().split('T')[0];
  if (devRecordDate !== customerSaleDate) {
    changes.date = devRecordDate;
  }
  
  // Check product_name (formatted according to rules)
  const expectedProductName = formatProductName(devRecord.customerName, devRecord.projectName);
  if (expectedProductName !== customerSale.product_name) {
    changes.product_name = expectedProductName;
  }
  
  // Check customer_id (ensure it matches the customer name)
  const expectedCustomerId = await getOrCreateCustomerId(devRecord.customerName, organizationId);
  if (expectedCustomerId !== customerSale.customer_id) {
    changes.customer_id = expectedCustomerId;
  }
  
  return changes;
}

/**
 * Creates a new customer_sales record from a devRecord
 * @param {Object} devRecord - The devRecord data
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - Creation result
 */
async function createCustomerSaleFromDevRecord(devRecord, organizationId) {
  try {
    // Get or create customer
    const customerId = await getOrCreateCustomerId(devRecord.customerName, organizationId);
    
    // Format product name
    const productName = formatProductName(devRecord.customerName, devRecord.projectName);
    
    // Create sale data
    const saleData = {
      financial_id: devRecord.id,
      customer_id: customerId,
      organization_id: organizationId,
      product_name: productName,
      quantity: Number(devRecord.hours),
      unit_price: Number(devRecord.rate),
      total_price: Number(devRecord.amount),
      date: new Date(devRecord.date).toISOString().split('T')[0]
    };
    
    // Insert the record
    const result = await insert('customer_sales', saleData);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create customer_sales record');
    }
    
    return {
      success: true,
      data: result.data[0]
    };
  } catch (error) {
    console.error('Error creating customer_sales from devRecord:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates an existing customer_sales record from a devRecord
 * @param {string} customerSaleId - The customer_sales record ID
 * @param {Object} devRecord - The devRecord data
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - Update result
 */
async function updateCustomerSaleFromDevRecord(customerSaleId, devRecord, organizationId) {
  try {
    // Get or create customer
    const customerId = await getOrCreateCustomerId(devRecord.customerName, organizationId);
    
    // Format product name
    const productName = formatProductName(devRecord.customerName, devRecord.projectName);
    
    // Create update data
    const updateData = {
      customer_id: customerId,
      product_name: productName,
      quantity: Number(devRecord.hours),
      unit_price: Number(devRecord.rate),
      total_price: Number(devRecord.amount),
      date: new Date(devRecord.date).toISOString().split('T')[0]
    };
    
    // Update the record
    const result = await update('customer_sales', updateData, { id: customerSaleId });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update customer_sales record');
    }
    
    return {
      success: true,
      data: result.data[0]
    };
  } catch (error) {
    console.error('Error updating customer_sales from devRecord:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gets or creates a customer ID for a given customer name
 * @param {string} customerName - The customer name
 * @param {string} organizationId - The organization ID
 * @returns {Promise<string>} - The customer ID
 */
async function getOrCreateCustomerId(customerName, organizationId) {
  try {
    // Look up existing customer
    const customerResult = await query('customers', {
      select: '*',
      eq: {
        column: 'business_name',
        value: customerName
      }
    });
    
    let customerId;
    
    if (customerResult.success && customerResult.data && customerResult.data.length > 0) {
      // Customer exists
      customerId = customerResult.data[0].id;
    } else {
      // Customer doesn't exist, create it
      const newCustomerResult = await insert('customers', {
        business_name: customerName,
        type: 'CUSTOMER'
      });
      
      if (!newCustomerResult.success) {
        throw new Error(`Failed to create customer: ${newCustomerResult.error}`);
      }
      
      customerId = newCustomerResult.data[0].id;
    }
    
    // Ensure customer is linked to organization
    await ensureCustomerOrganizationLink(customerId, organizationId);
    
    return customerId;
  } catch (error) {
    console.error('Error getting or creating customer:', error);
    throw error;
  }
}

/**
 * Ensures a customer is linked to an organization
 * @param {string} customerId - The customer ID
 * @param {string} organizationId - The organization ID
 * @returns {Promise<void>}
 */
async function ensureCustomerOrganizationLink(customerId, organizationId) {
  try {
    // Check if link already exists
    const linkResult = await query('customer_organization', {
      select: '*',
      filters: [
        { type: 'eq', column: 'customer_id', value: customerId },
        { type: 'eq', column: 'organization_id', value: organizationId }
      ]
    });
    
    if (!linkResult.success || !linkResult.data || linkResult.data.length === 0) {
      // Link doesn't exist, create it
      await insert('customer_organization', {
        customer_id: customerId,
        organization_id: organizationId
      });
    }
  } catch (error) {
    console.error('Error ensuring customer organization link:', error);
    throw error;
  }
}

/**
 * Formats product name according to the specified rules
 * @param {string} customerName - The customer name
 * @param {string} projectName - The project name
 * @returns {string} - Formatted product name
 */
function formatProductName(customerName, projectName) {
  // Extract capital letters and numbers from customer name
  const customerNameFormatted = (customerName || '')
    .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
    .trim();
  
  // Get the first word of the project name
  const projectNameFirstWord = projectName ?
    projectName.split(' ')[0] : '';
  
  // Concatenate with a colon
  return `${customerNameFormatted}:${projectNameFirstWord}`;
}

/**
 * Converts a date from YYYY-MM-DD format to MM/DD/YYYY format for FileMaker
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Date in MM/DD/YYYY format
 */
function convertToFileMakerDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Gets a summary of financial synchronization status for a date range
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Synchronization status summary
 */
export async function getFinancialSyncStatus(organizationId, startDate, endDate) {
  try {
    // Run a dry run synchronization to get the status
    const syncResult = await synchronizeFinancialRecords(organizationId, startDate, endDate, { dryRun: true });
    
    if (!syncResult.success) {
      throw new Error(syncResult.error);
    }
    
    return {
      success: true,
      status: {
        inSync: syncResult.summary.toCreate === 0 && syncResult.summary.toUpdate === 0,
        devRecordsCount: syncResult.summary.devRecordsCount,
        customerSalesCount: syncResult.summary.customerSalesCount,
        recordsToCreate: syncResult.summary.toCreate,
        recordsToUpdate: syncResult.summary.toUpdate,
        recordsToDelete: syncResult.summary.toDelete,
        unchangedRecords: syncResult.summary.unchanged
      },
      details: {
        toCreate: syncResult.changes.created,
        toUpdate: syncResult.changes.updated,
        toDelete: syncResult.changes.deleted
      }
    };
  } catch (error) {
    console.error('Error getting financial sync status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}