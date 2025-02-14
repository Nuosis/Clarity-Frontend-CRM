/**
 * Customer data processing and business logic
 */

/**
 * Processes raw customer data from FileMaker
 * @param {Object} data - Raw customer data from FileMaker
 * @returns {Array} Processed customer records
 */
export function processCustomerData(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data.map(customer => ({
        ...customer.fieldData,
        id: customer.fieldData.__ID,
        isActive: customer.fieldData.f_active === "1" || customer.fieldData.f_active === 1,
        createdAt: customer.fieldData['~creationTimestamp'],
        modifiedAt: customer.fieldData['~modificationTimestamp']
    }));
}

/**
 * Filters active customers from a list
 * @param {Array} customers - Array of customer records
 * @returns {Array} Active customer records
 */
export function filterActiveCustomers(customers) {
    return customers.filter(customer => customer.isActive);
}

/**
 * Sorts customers by active status and name
 * @param {Array} customers - Array of customer records
 * @returns {Array} Sorted customer records
 */
export function sortCustomers(customers) {
    return [...customers].sort((a, b) => {
        // Sort by active status first
        if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1;
        }
        // Then sort by name
        return a.Name.localeCompare(b.Name);
    });
}

/**
 * Validates customer data before creation/update
 * @param {Object} data - Customer data to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateCustomerData(data) {
    const errors = [];

    if (!data.Name?.trim()) {
        errors.push('Customer name is required');
    }

    if (data.Email && !isValidEmail(data.Email)) {
        errors.push('Invalid email format');
    }

    if (data.Phone && !isValidPhone(data.Phone)) {
        errors.push('Invalid phone format');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Formats customer data for display
 * @param {Object} customer - Customer record
 * @returns {Object} Formatted customer data
 */
export function formatCustomerForDisplay(customer) {
    return {
        id: customer.id,
        name: customer.Name,
        email: customer.Email || 'N/A',
        phone: customer.Phone || 'N/A',
        status: customer.isActive ? 'Active' : 'Inactive',
        created: new Date(customer.createdAt).toLocaleDateString(),
        modified: new Date(customer.modifiedAt).toLocaleDateString(),
        address: formatAddress(customer),
        contactPerson: customer.ContactPerson || 'N/A'
    };
}

/**
 * Formats customer data for FileMaker
 * @param {Object} data - Customer data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatCustomerForFileMaker(data) {
    return {
        Name: data.name,
        Email: data.email,
        Phone: data.phone,
        f_active: data.isActive ? "1" : "0",
        ContactPerson: data.contactPerson,
        // Add any additional fields needed by FileMaker
    };
}

// Helper functions

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone);
}

function formatAddress(customer) {
    const parts = [
        customer.Address,
        customer.City,
        customer.State,
        customer.PostalCode,
        customer.Country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'N/A';
}

/**
 * Groups customers by status
 * @param {Array} customers - Array of customer records
 * @returns {Object} Grouped customers { active, inactive }
 */
export function groupCustomersByStatus(customers) {
    return customers.reduce((groups, customer) => {
        const key = customer.isActive ? 'active' : 'inactive';
        groups[key].push(customer);
        return groups;
    }, { active: [], inactive: [] });
}

/**
 * Calculates customer statistics
 * @param {Array} customers - Array of customer records
 * @returns {Object} Customer statistics
 */
export function calculateCustomerStats(customers) {
    const grouped = groupCustomersByStatus(customers);
    return {
        total: customers.length,
        active: grouped.active.length,
        inactive: grouped.inactive.length,
        activePercentage: Math.round((grouped.active.length / customers.length) * 100) || 0
    };
}