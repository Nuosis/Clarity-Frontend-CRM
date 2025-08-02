/**
 * Service for fetching monthly billable hours from Supabase customer_sales
 */
import { query } from './supabaseService';

/**
 * Fetches total billable hours for the current month from customer_sales
 * @param {string} organizationId - Organization ID to filter by
 * @returns {Promise<number>} - Total billable hours for current month
 */
export async function getMonthlyBillableHours(organizationId) {
  try {
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log('[MonthlyBillable] Fetching billable hours for:', {
      organizationId,
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString()
    });

    // Query customer_sales for current month using backend API
    // Use the same column selection as other services to ensure compatibility
    const response = await query('customer_sales', {
      select: 'id, date, customer_id, product_id, product_name, quantity, unit_price, total_price, organization_id, created_at',
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'gte', column: 'created_at', value: startOfMonth.toISOString() },
        { type: 'lte', column: 'created_at', value: endOfMonth.toISOString() }
      ]
    });

    if (!response.success) {
      console.error('[MonthlyBillable] Error fetching billable hours:', response.error);
      return 0;
    }

    const data = response.data || [];
    
    console.log('[MonthlyBillable] Found records:', data.length);
    if (data.length > 0) {
      console.log('[MonthlyBillable] Sample record structure:', data[0]);
    }

    // Calculate total hours from quantity (assuming quantity represents billable hours)
    const totalHours = data.reduce((sum, record) => {
      const hours = parseFloat(record.quantity) || 0;
      console.log(`[MonthlyBillable] Record ${record.id}: ${hours} hours`);
      return sum + hours;
    }, 0);

    console.log('[MonthlyBillable] Monthly billable hours:', {
      recordCount: data.length,
      totalHours: totalHours.toFixed(1)
    });

    return totalHours;

  } catch (error) {
    console.error('[MonthlyBillable] Error in getMonthlyBillableHours:', error);
    return 0;
  }
}

/**
 * Fetches monthly billable hours with organization ID from global state
 * @returns {Promise<number>} - Total billable hours for current month
 */
export async function getMonthlyBillableHoursFromState() {
  try {
    // Get organization ID from global state
    const organizationId = window.state?.user?.supabaseOrgID;
    
    console.log('[MonthlyBillable] Debug - Global state:', {
      hasWindowState: !!window.state,
      hasUser: !!window.state?.user,
      organizationId,
      fullUser: window.state?.user
    });
    
    if (!organizationId) {
      console.warn('[MonthlyBillable] No organization ID found in global state');
      return 0;
    }

    return await getMonthlyBillableHours(organizationId);
  } catch (error) {
    console.error('[MonthlyBillable] Error in getMonthlyBillableHoursFromState:', error);
    return 0;
  }
}