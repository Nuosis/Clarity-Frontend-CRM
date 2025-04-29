import { useState, useCallback, useRef } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { adminQuery, adminInsert } from '../services/supabaseService';

/**
 * Custom hook for managing customer data in Supabase
 * @returns {Object} Supabase customer operations
 */
export function useSupabaseCustomer() {
  const { showError } = useSnackBar();
  const [customerData, setCustomerData] = useState(null);
  const customerCreationAttemptedRef = useRef(false);

  /**
   * Parse JSON data from Supabase
   * @param {Array} data - Data from Supabase
   * @returns {Array} Parsed data
   */
  const parseSupabaseData = useCallback((data) => {
    if (!data) return data;
    
    return data.map(item => {
      const parsedItem = { ...item };
      Object.keys(parsedItem).forEach(key => {
        if (typeof parsedItem[key] === 'string' &&
            (parsedItem[key].startsWith('{') || parsedItem[key].startsWith('['))) {
          try {
            parsedItem[key] = JSON.parse(parsedItem[key]);
          } catch (e) {
            // If parsing fails, keep the original value
          }
        }
      });
      return parsedItem;
    });
  }, []);

  /**
   * Create a new customer in Supabase
   * @param {Object} customer - Customer data
   * @param {Object} user - User data
   * @returns {Promise<Object>} Result of the operation
   */
  const createCustomerInSupabase = useCallback(async (customer, user) => {
    try {
      // 1. Create customer record
      const customerResult = await adminInsert('customers', {
        business_name: customer.Name // Store the full customer name in the business_name field
      });
      
      if (!customerResult.success) {
        throw new Error(`Failed to create customer: ${customerResult.error}`);
      }
      
      // Parse the customer result data if needed
      let parsedCustomerData = customerResult.data[0];
      let supabaseCustomerId = parsedCustomerData.id;
      
      // Check if the ID is a stringified JSON and parse it
      if (typeof supabaseCustomerId === 'string' && supabaseCustomerId.startsWith('{')) {
        try {
          supabaseCustomerId = JSON.parse(supabaseCustomerId);
        } catch (e) {
          // If parsing fails, keep the original value
        }
      }
      
      // 2. Link customer to organization
      await linkCustomerToOrganization(supabaseCustomerId, user.supabaseOrgID);
      
      // 3. Add customer email if available
      if (customer.Email) {
        const emailResult = await adminInsert('customer_email', {
          customer_id: supabaseCustomerId,
          email: customer.Email,
          is_primary: true
        });
        
        if (!emailResult.success) {
          console.error("[ERROR] Failed to create customer email:", emailResult.error);
        }
      }
      
      // 4. Add customer phone if available
      if (customer.Phone) {
        const phoneResult = await adminInsert('customer_phone', {
          customer_id: supabaseCustomerId,
          phone: customer.Phone,
          is_primary: true
        });
        
        if (!phoneResult.success) {
          console.error("[ERROR] Failed to create customer phone:", phoneResult.error);
        }
      }
      
      // 5. Add customer address if available
      if (customer.City && customer.State) {
        const addressResult = await adminInsert('customer_address', {
          customer_id: supabaseCustomerId,
          address_line1: customer.Address || '',
          city: customer.City || '',
          state: customer.State || '',
          postal_code: customer.PostalCode || '',
          country: customer.Country || ''
        });
        
        if (!addressResult.success) {
          console.error("[ERROR] Failed to create customer address:", addressResult.error);
        }
      }
      
      return {
        success: true,
        data: parsedCustomerData
      };
    } catch (error) {
      console.error("[ERROR] Error creating customer in Supabase:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Link a customer to an organization
   * @param {string} customerId - Supabase customer ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Result of the operation
   */
  const linkCustomerToOrganization = useCallback(async (customerId, organizationId) => {
    try {
      const linkResult = await adminInsert('customer_organization', {
        customer_id: customerId,
        organization_id: organizationId
      });
      
      if (!linkResult.success) {
        throw new Error(`Failed to link customer to organization: ${linkResult.error}`);
      }
      
      // Parse the link result data if needed
      let parsedLinkData = linkResult.data[0];
      
      return {
        success: true,
        data: parsedLinkData
      };
    } catch (error) {
      console.error("[ERROR] Error linking customer to organization:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Fetch or create customer in Supabase
   * @param {Object} customer - Customer data
   * @param {Object} user - User data
   * @returns {Promise<Object>} Customer data from Supabase
   */
  const fetchOrCreateCustomerInSupabase = useCallback(async (customer, user) => {
    if (!customer || !customer.Name || !user || !user.supabaseOrgID) {
      return null;
    }

    try {
      // Query the customers table to find the customer with matching business_name
      const result = await adminQuery('customers', {
        select: '*',
        filter: {
          column: 'business_name',
          operator: 'eq',
          value: customer.Name
        }
      });

      // Parse the result data if it's stringified JSON
      let parsedResultData = result.data;
      if (result.success && result.data) {
        parsedResultData = parseSupabaseData(result.data);
      }

      let customerData;

      // If customer doesn't exist in Supabase, create it
      if (!result.success || !parsedResultData || parsedResultData.length === 0) {
        // Only attempt to create the customer if we haven't tried before
        if (!customerCreationAttemptedRef.current) {
          customerCreationAttemptedRef.current = true; // Mark that we've attempted creation
          
          // Create the customer in Supabase
          const newCustomer = await createCustomerInSupabase(customer, user);
          
          if (newCustomer.success) {
            customerData = newCustomer.data;
          } else {
            console.error("[ERROR] Failed to create customer in Supabase:", newCustomer.error);
            showError(`Error creating customer in Supabase: ${newCustomer.error}`);
            return null;
          }
        } else {
          return null;
        }
      } else {
        // Check if the customer is already linked to the organization
        const orgResult = await adminQuery('customer_organization', {
          select: '*',
          filter: {
            column: 'customer_id',
            operator: 'eq',
            value: parsedResultData[0].id
          }
        });

        // Parse the orgResult data if it's stringified JSON
        let parsedOrgData = orgResult.data;
        if (orgResult.success && orgResult.data) {
          parsedOrgData = parseSupabaseData(orgResult.data);
        }

        const isLinkedToOrg = orgResult.success &&
                              parsedOrgData &&
                              parsedOrgData.some(link => {
                                // Parse organization_id if it's a string
                                let orgId = link.organization_id;
                                if (typeof orgId === 'string' && orgId.startsWith('{')) {
                                  try {
                                    orgId = JSON.parse(orgId);
                                  } catch (e) {
                                    // If parsing fails, keep the original value
                                  }
                                }
                                return orgId === user.supabaseOrgID;
                              });

        if (!isLinkedToOrg) {
          // Link the customer to the organization
          await linkCustomerToOrganization(parsedResultData[0].id, user.supabaseOrgID);
        }

        customerData = parsedResultData[0];
      }
      
      // Save the customer data
      setCustomerData(customerData);
      return customerData;
    } catch (error) {
      console.error("[ERROR] Failed to fetch/create customer details in Supabase:", error);
      showError(`Error with customer details in Supabase: ${error.message}`);
      return null;
    }
  }, [createCustomerInSupabase, linkCustomerToOrganization, parseSupabaseData, showError]);

  return {
    customerData,
    fetchOrCreateCustomerInSupabase,
    createCustomerInSupabase,
    linkCustomerToOrganization,
    parseSupabaseData
  };
}