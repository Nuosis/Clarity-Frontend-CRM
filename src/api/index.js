// FileMaker base functionality
export {
    fetchDataFromFileMaker,
    handleFileMakerOperation,
    validateParams,
    Layouts,
    Actions,
    initializeQuickBooks
} from './fileMaker';

// Customer operations
export {
    fetchCustomers,
    fetchCustomerById,
    updateCustomer,
    createCustomer,
    toggleCustomerStatus,
    fetchActiveCustomers,
    deleteCustomer
} from './customers';

// Team operations
export {
    fetchTeams,
    fetchTeamById,
    fetchTeamStaff,
    fetchTeamProjects,
    createTeam,
    updateTeam,
    deleteTeam,
    assignStaffToTeam,
    removeStaffFromTeam,
    assignProjectToTeam,
    removeProjectFromTeam,
    fetchAllStaff
} from './teams';

// Project operations
export {
    fetchProjectsForCustomer,
    fetchProjectRelatedData,
    updateProjectStatus,
    createProject,
    updateProject,
    fetchAllProjectData,
    fetchProjectsForCustomers,
    fetchProjectNotes,
    deleteProject,
    createObjective
} from './projects';

// Task operations
export {
    fetchTasksForProject,
    createTask,
    updateTask,
    updateTaskStatus,
    startTaskTimer,
    stopTaskTimer,
    fetchTaskTimers,
    updateTaskNotes,
    fetchActiveProjectTasks,
    fetchTaskNotes,
    fetchTaskLinks
} from './tasks';

// Financial record operations
export {
    fetchFinancialRecords,
    fetchUnpaidRecords,
    fetchMonthlyRecords,
    fetchQuarterlyRecords,
    fetchYearlyRecords
} from './financialRecords';

// API version
export const API_VERSION = '1.1.1';

// QuickBooks API (New Backend Integration)
export {
    // Authorization
    getQBOAuthorizationUrl,
    handleQBOOAuthCallback,
    refreshQBOToken,
    validateQBOCredentials,
    
    // Company
    getQBOCompanyInfo,
    
    // Customers
    listQBOCustomers,
    getQBOCustomer,
    createQBOCustomer,
    updateQBOCustomer,
    deleteQBOCustomer,
    
    // Invoices
    listQBOInvoices,
    getQBOInvoice,
    createQBOInvoice,
    updateQBOInvoice,
    deleteQBOInvoice,
    
    // Bills
    listQBOBills,
    getQBOBill,
    createQBOBill,
    updateQBOBill,
    deleteQBOBill,
    
    // Items & Vendors
    listQBOItems,
    listQBOVendors,
    
    // Query
    executeQBOQuery,
    
    // Webhooks
    getQBOWebhookStats,
    listQBOWebhookEvents,
    testQBOWebhook,
    clearQBOWebhookEvents,
    
    // Legacy compatibility (deprecated)
    listQBOCustomerByName,
    getQBOInvoiceByQuery,
    getQBOItem,
    listQBOAccounts,
    getQBOAccount,
    sendQBOInvoiceEmail
} from './quickbooksApi';

// Marketing operations
export {
    sendInformationSessionEmails,
    sendCustomListInformationSessionEmails,
    sendTestInformationSessionEmail,
    validateEmailTemplate,
    sendCustomBulkEmail,
    getCampaignStatus
} from './marketing';

// Error codes
export const ErrorCodes = {
    TIMEOUT: 'TIMEOUT',
    NULL_RESULT: 'NULL_RESULT',
    FM_ERROR: 'FM_ERROR',
    SCRIPT_ERROR: 'SCRIPT_ERROR',
    PREPARATION_ERROR: 'PREPARATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
};

// Utility function to check if an error is a FileMaker error
export function isFileMakerError(error) {
    return error && error.code && Object.values(ErrorCodes).includes(error.code);
}

// Utility function to format error messages
export function formatErrorMessage(error) {
    if (isFileMakerError(error)) {
        return `FileMaker Error (${error.code}): ${error.message}${error.details ? `\nDetails: ${error.details}` : ''}`;
    }
    return error.message || 'An unknown error occurred';
}