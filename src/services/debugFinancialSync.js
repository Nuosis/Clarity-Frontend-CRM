/**
 * Debug utility for tracing financial sync processing
 */

import { fetchFinancialRecords } from '../api/financialRecords';
import { processFinancialData } from './billableHoursService';
import { adminQuery } from './supabaseService';

/**
 * Debug function to trace processing of a specific record
 * @param {string} financialId - The financial ID to debug
 * @param {string} startDate - Start date for fetching records
 * @param {string} endDate - End date for fetching records
 * @param {string} organizationId - Organization ID
 */
export async function debugRecordProcessing(financialId, startDate, endDate, organizationId) {
  console.log(`🔍 DEBUG: Tracing record ${financialId}`);
  
  try {
    // Step 1: Fetch raw FileMaker data
    console.log('📥 Step 1: Fetching raw FileMaker data...');
    const rawResult = await fetchFinancialRecords('unpaid');
    
    if (!rawResult || !rawResult.response || !rawResult.response.data) {
      throw new Error('Failed to fetch raw financial records');
    }
    
    // Find the raw record
    const rawRecord = rawResult.response.data.find(record => 
      record.fieldData.__ID === financialId
    );
    
    if (!rawRecord) {
      console.log('❌ Record not found in raw FileMaker data');
      return;
    }
    
    // Calculate the effective hourly rate (same logic as processFinancialData)
    const effectiveHourlyRate = rawRecord.fieldData.Hourly_Rate || rawRecord.fieldData['Customers::chargeRate'] || 0;
    
    console.log('📋 Raw FileMaker fieldData:', {
      __ID: rawRecord.fieldData.__ID,
      Billable_Time_Rounded: rawRecord.fieldData.Billable_Time_Rounded,
      Hourly_Rate: rawRecord.fieldData.Hourly_Rate,
      'Customers::chargeRate': rawRecord.fieldData['Customers::chargeRate'],
      effectiveHourlyRate: effectiveHourlyRate,
      DateStart: rawRecord.fieldData.DateStart,
      'Customers::Name': rawRecord.fieldData['Customers::Name'],
      'customers_Projects::projectName': rawRecord.fieldData['customers_Projects::projectName']
    });
    
    // Step 2: Process the data
    console.log('⚙️ Step 2: Processing financial data...');
    const processedRecords = processFinancialData(rawResult);
    
    const processedRecord = processedRecords.find(record => record.id === financialId);
    
    if (!processedRecord) {
      console.log('❌ Record not found in processed data');
      return;
    }
    
    console.log('📊 Processed devRecord:', {
      id: processedRecord.id,
      hours: processedRecord.hours,
      rate: processedRecord.rate,
      amount: processedRecord.amount,
      date: processedRecord.date,
      customerName: processedRecord.customerName,
      projectName: processedRecord.projectName
    });
    
    // Step 3: Check existing customer_sales record
    console.log('🔍 Step 3: Checking existing customer_sales record...');
    const customerSalesResult = await adminQuery('customer_sales', {
      select: '*',
      eq: {
        column: 'financial_id',
        value: financialId.toLowerCase() // Use lowercase for comparison
      }
    });
    
    // Initialize changes object outside the if block
    const changes = {};
    
    if (customerSalesResult.success && customerSalesResult.data && customerSalesResult.data.length > 0) {
      const existingRecord = customerSalesResult.data[0];
      console.log('📋 Existing customer_sales record:', {
        id: existingRecord.id,
        financial_id: existingRecord.financial_id,
        quantity: existingRecord.quantity,
        unit_price: existingRecord.unit_price,
        total_price: existingRecord.total_price,
        date: existingRecord.date,
        product_name: existingRecord.product_name
      });
      
      // Step 4: Compare values (using same precision logic as sync service)
      console.log('🔄 Step 4: Comparing values...');
      
      // Check quantity (hours) - round to 2 decimal places for comparison
      const devHours = Math.round(Number(processedRecord.hours) * 100) / 100;
      const saleQuantity = Math.round(Number(existingRecord.quantity) * 100) / 100;
      if (devHours !== saleQuantity) {
        changes.quantity = {
          current: existingRecord.quantity,
          new: processedRecord.hours,
          devRounded: devHours,
          saleRounded: saleQuantity,
          different: true
        };
      }
      
      // Check unit_price (rate) - round to 2 decimal places for comparison
      const devRate = Math.round(Number(processedRecord.rate) * 100) / 100;
      const saleUnitPrice = Math.round(Number(existingRecord.unit_price) * 100) / 100;
      if (devRate !== saleUnitPrice) {
        changes.unit_price = {
          current: existingRecord.unit_price,
          new: processedRecord.rate,
          devRounded: devRate,
          saleRounded: saleUnitPrice,
          different: true
        };
      }
      
      // Check total_price (amount) - round to 2 decimal places for comparison
      const devAmount = Math.round(Number(processedRecord.amount) * 100) / 100;
      const saleTotalPrice = Math.round(Number(existingRecord.total_price) * 100) / 100;
      if (devAmount !== saleTotalPrice) {
        changes.total_price = {
          current: existingRecord.total_price,
          new: processedRecord.amount,
          devRounded: devAmount,
          saleRounded: saleTotalPrice,
          different: true
        };
      }
      
      console.log('📈 Field comparison results:', changes);
      
      if (Object.keys(changes).length > 0) {
        console.log('✅ Changes detected - record would be updated');
      } else {
        console.log('✅ No changes - record is in sync');
      }
      
    } else {
      console.log('📝 No existing customer_sales record - would be created');
    }
    
    return {
      rawRecord: rawRecord.fieldData,
      processedRecord,
      existingRecord: customerSalesResult.data?.[0] || null,
      changes: changes || {}
    };
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    throw error;
  }
}

/**
 * Quick debug function that can be called from console
 */
export async function debugRecord79DE() {
  return await debugRecordProcessing(
    '79DE4747-2C6B-4D09-B82A-5BC767832E9A',
    '2024-01-01',
    '2024-12-31',
    'your-org-id' // Replace with actual org ID
  );
}