// Customer service exports
export {
    processCustomerData,
    filterActiveCustomers,
    sortCustomers,
    validateCustomerData,
    formatCustomerForDisplay,
    formatCustomerForFileMaker,
    groupCustomersByStatus,
    calculateCustomerStats
} from './customerService';

// Team service exports
export {
    processTeamData,
    processStaffData,
    processTeamMemberData,
    getTeams,
    getTeamById,
    getTeamStaff,
    getTeamProjects,
    createNewTeam,
    updateExistingTeam,
    deleteExistingTeam,
    assignStaffMemberToTeam,
    removeStaffMemberFromTeam,
    assignProjectToExistingTeam,
    removeProjectFromExistingTeam,
    getAllStaff,
    calculateTeamStats
} from './teamService';

// Project service exports
export {
    processProjectData,
    validateProjectData,
    formatProjectForDisplay,
    formatProjectForFileMaker,
    calculateProjectCompletion,
    groupProjectsByStatus,
    calculateProjectStats
} from './projectService';

// Task service exports
export {
    processTaskData,
    processTimerRecords,
    processTaskNotes,
    processTaskLinks,
    calculateTotalTaskTime,
    formatDuration,
    validateTaskData,
    formatTaskForDisplay,
    formatTaskForFileMaker,
    groupTasksByStatus,
    calculateTaskStats,
    isValidTimerAdjustment,
    sortTasks
} from './taskService';

// Financial service exports
export {
    processFinancialData,
    formatFinancialRecordForDisplay,
    groupRecordsByCustomer,
    groupRecordsByProject,
    calculateTotals,
    calculateMonthlyTotals,
    prepareChartData,
    validateFinancialRecordData,
    formatFinancialRecordForFileMaker,
    sortRecordsByDate,
    sortRecordsByAmount,
    filterRecordsByDateRange,
    filterRecordsByBilledStatus
} from './billableHoursService';

// Supabase service exports
export {
    getSupabaseClient,
    getSupabaseUrl,
    getSupabaseKey,
    createSupabaseClient,
    isSupabaseConfigured,
    getProjectId,
    signInWithEmail,
    signOut,
    getSession,
    query,
    insert,
    update,
    remove
} from './supabaseService';

// Product service exports
export {
    fetchAllProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    validateProductData,
    formatProductForDisplay,
    groupProductsByPriceRange,
    calculateProductStats,
    loadAllProductsToState
} from './productService';

// Product relationships service exports
export {
    fetchProductRelationships,
    fetchParentProducts,
    createProductRelationship,
    updateProductRelationship,
    deleteProductRelationship,
    validateRelationshipData,
    getRelationshipTypeLabel,
    getRelationshipTypeDescription,
    RELATIONSHIP_TYPES
} from './productRelationshipsService';

// Sales service exports
export {
    fetchSalesByOrganization,
    fetchSalesByCustomer,
    createSale,
    updateSale,
    deleteSale,
    validateSaleData,
    formatSaleForDisplay,
    calculateSalesStats,
    loadOrganizationSales
} from './salesService';

// Financial sync service exports
export {
    synchronizeFinancialRecords,
    getFinancialSyncStatus
} from './financialSyncService';

// Service version
export const SERVICES_VERSION = '1.0.0';

// Utility functions
export function isValidId(id) {
    return typeof id === 'string' && id.length > 0;
}

export function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
}

export function formatTimestamp(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return isValidDate(date) ? date.toISOString() : null;
}

// Error handling
export class ServiceError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ServiceError';
        this.code = code;
        this.details = details;
    }
}

// Error codes
export const ErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    INVALID_DATA: 'INVALID_DATA',
    CALCULATION_ERROR: 'CALCULATION_ERROR'
};

// Validation utilities
export function validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
        throw new ServiceError(
            `Missing required fields: ${missing.join(', ')}`,
            ErrorCodes.VALIDATION_ERROR,
            { missing }
        );
    }
}

export function validateDataType(value, type, fieldName) {
    if (typeof value !== type) {
        throw new ServiceError(
            `Invalid type for ${fieldName}. Expected ${type}, got ${typeof value}`,
            ErrorCodes.VALIDATION_ERROR,
            { fieldName, expectedType: type, actualType: typeof value }
        );
    }
}

// Common formatting utilities
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

export function formatPercentage(value) {
    return `${Math.round(value)}%`;
}

export function formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}