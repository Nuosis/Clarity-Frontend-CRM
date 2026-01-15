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
        recordId: customer.recordId,
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
        recordId: customer.recordId,
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

/**
 * DATA TRANSFORMATION UTILITIES
 * Transform between FileMaker flat data model and backend relational data model
 */

/**
 * Transforms FileMaker flat customer data to backend relational format
 * @param {Object} fileMakerCustomer - Customer data from FileMaker
 * @returns {Object} Customer data in backend format with nested relationships
 */
export function transformFileMakerToBackend(fileMakerCustomer) {
    if (!fileMakerCustomer) {
        throw new Error('Customer data is required');
    }

    const customer = {
        id: fileMakerCustomer.__ID || fileMakerCustomer.id,
        business_name: fileMakerCustomer.Name || '',
        primary_contact_name: fileMakerCustomer.ContactPerson || null,
        is_active: fileMakerCustomer.f_active === "1" || fileMakerCustomer.f_active === 1 || fileMakerCustomer.isActive === true,
        type: 'CUSTOMER',
        emails: [],
        phones: [],
        addresses: []
    };

    // Add primary email if present
    if (fileMakerCustomer.Email && fileMakerCustomer.Email.trim()) {
        customer.emails.push({
            email: fileMakerCustomer.Email.trim(),
            is_primary: true,
            email_type: 'work'
        });
    }

    // Add primary phone if present
    if (fileMakerCustomer.Phone && fileMakerCustomer.Phone.trim()) {
        customer.phones.push({
            phone: fileMakerCustomer.Phone.trim(),
            is_primary: true,
            phone_type: 'office'
        });
    }

    // Add address if at least city and state are present
    if (fileMakerCustomer.City && fileMakerCustomer.State) {
        customer.addresses.push({
            address_line1: fileMakerCustomer.Address || '',
            address_line2: null,
            city: fileMakerCustomer.City || '',
            state: fileMakerCustomer.State || '',
            postal_code: fileMakerCustomer.PostalCode || '',
            country: fileMakerCustomer.Country || '',
            is_primary: true
        });
    }

    // Include timestamps if available
    if (fileMakerCustomer['~creationTimestamp']) {
        customer.created_at = fileMakerCustomer['~creationTimestamp'];
    }
    if (fileMakerCustomer['~modificationTimestamp']) {
        customer.updated_at = fileMakerCustomer['~modificationTimestamp'];
    }

    return customer;
}

/**
 * Transforms backend relational customer data to FileMaker flat format
 * @param {Object} backendCustomer - Customer data from backend API
 * @returns {Object} Customer data in FileMaker flat format
 */
export function transformBackendToFileMaker(backendCustomer) {
    if (!backendCustomer) {
        throw new Error('Customer data is required');
    }

    // Extract primary email
    const primaryEmail = extractPrimaryContact(backendCustomer.emails, 'email');

    // Extract primary phone
    const primaryPhone = extractPrimaryContact(backendCustomer.phones, 'phone');

    // Extract primary address
    const primaryAddress = extractPrimaryAddress(backendCustomer.addresses);

    const customer = {
        __ID: backendCustomer.id,
        id: backendCustomer.id,
        Name: backendCustomer.business_name || '',
        Email: primaryEmail || '',
        Phone: primaryPhone || '',
        ContactPerson: backendCustomer.primary_contact_name || '',
        f_active: backendCustomer.is_active ? "1" : "0",
        isActive: backendCustomer.is_active || false,
        Address: primaryAddress.address_line1 || '',
        City: primaryAddress.city || '',
        State: primaryAddress.state || '',
        PostalCode: primaryAddress.postal_code || '',
        Country: primaryAddress.country || '',
        '~creationTimestamp': backendCustomer.created_at || null,
        '~modificationTimestamp': backendCustomer.updated_at || null,
        createdAt: backendCustomer.created_at || null,
        modifiedAt: backendCustomer.updated_at || null
    };

    return customer;
}

/**
 * Extracts primary contact information from nested array
 * @param {Array} contacts - Array of email or phone objects
 * @param {string} field - Field name to extract ('email' or 'phone')
 * @returns {string|null} Primary contact value or null
 */
export function extractPrimaryContact(contacts, field) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return null;
    }

    // Find primary contact
    const primary = contacts.find(contact => contact.is_primary);
    if (primary && primary[field]) {
        return primary[field];
    }

    // Fallback to first contact if no primary
    if (contacts[0] && contacts[0][field]) {
        return contacts[0][field];
    }

    return null;
}

/**
 * Extracts primary address from nested array
 * @param {Array} addresses - Array of address objects
 * @returns {Object} Primary address object or empty object
 */
export function extractPrimaryAddress(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return {
            address_line1: '',
            city: '',
            state: '',
            postal_code: '',
            country: ''
        };
    }

    // Find primary address
    const primary = addresses.find(addr => addr.is_primary);
    if (primary) {
        return primary;
    }

    // Fallback to first address
    return addresses[0] || {
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country: ''
    };
}

/**
 * Validates transformed customer data structure
 * @param {Object} customerData - Customer data to validate
 * @param {string} format - Expected format ('filemaker' or 'backend')
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateTransformedData(customerData, format = 'backend') {
    const errors = [];

    if (!customerData) {
        errors.push('Customer data is required');
        return { isValid: false, errors };
    }

    if (format === 'backend') {
        // Validate backend format
        if (!customerData.business_name || !customerData.business_name.trim()) {
            errors.push('business_name is required');
        }

        if (!customerData.id) {
            errors.push('id is required');
        }

        if (typeof customerData.is_active !== 'boolean') {
            errors.push('is_active must be a boolean');
        }

        if (!Array.isArray(customerData.emails)) {
            errors.push('emails must be an array');
        } else {
            customerData.emails.forEach((email, index) => {
                if (email.email && !isValidEmail(email.email)) {
                    errors.push(`emails[${index}].email has invalid format`);
                }
                if (typeof email.is_primary !== 'boolean') {
                    errors.push(`emails[${index}].is_primary must be a boolean`);
                }
            });
        }

        if (!Array.isArray(customerData.phones)) {
            errors.push('phones must be an array');
        } else {
            customerData.phones.forEach((phone, index) => {
                if (phone.phone && !isValidPhone(phone.phone)) {
                    errors.push(`phones[${index}].phone has invalid format`);
                }
                if (typeof phone.is_primary !== 'boolean') {
                    errors.push(`phones[${index}].is_primary must be a boolean`);
                }
            });
        }

        if (!Array.isArray(customerData.addresses)) {
            errors.push('addresses must be an array');
        }
    } else if (format === 'filemaker') {
        // Validate FileMaker format
        if (!customerData.Name || !customerData.Name.trim()) {
            errors.push('Name is required');
        }

        if (!customerData.__ID && !customerData.id) {
            errors.push('__ID or id is required');
        }

        if (customerData.f_active !== "0" && customerData.f_active !== "1") {
            errors.push('f_active must be "0" or "1"');
        }

        if (customerData.Email && !isValidEmail(customerData.Email)) {
            errors.push('Email has invalid format');
        }

        if (customerData.Phone && !isValidPhone(customerData.Phone)) {
            errors.push('Phone has invalid format');
        }
    } else {
        errors.push(`Unknown format: ${format}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Transforms array of FileMaker customers to backend format
 * @param {Array} fileMakerCustomers - Array of FileMaker customer records
 * @returns {Array} Array of backend-formatted customer records
 */
export function transformFileMakerArrayToBackend(fileMakerCustomers) {
    if (!Array.isArray(fileMakerCustomers)) {
        throw new Error('Expected array of customers');
    }

    return fileMakerCustomers
        .map(customer => {
            try {
                return transformFileMakerToBackend(customer);
            } catch (error) {
                console.error('[Transform] Error transforming customer:', error, customer);
                return null;
            }
        })
        .filter(Boolean);
}

/**
 * Transforms array of backend customers to FileMaker format
 * @param {Array} backendCustomers - Array of backend customer records
 * @returns {Array} Array of FileMaker-formatted customer records
 */
export function transformBackendArrayToFileMaker(backendCustomers) {
    if (!Array.isArray(backendCustomers)) {
        throw new Error('Expected array of customers');
    }

    return backendCustomers
        .map(customer => {
            try {
                return transformBackendToFileMaker(customer);
            } catch (error) {
                console.error('[Transform] Error transforming customer:', error, customer);
                return null;
            }
        })
        .filter(Boolean);
}

/**
 * Merges multiple emails/phones/addresses into arrays with primary flag
 * @param {Object} options - Options object with emails, phones, addresses arrays
 * @returns {Object} Merged data with proper primary flags
 */
export function mergeNestedContacts(options = {}) {
    const { emails = [], phones = [], addresses = [] } = options;

    // Ensure exactly one primary per type
    const processedEmails = ensureSinglePrimary(emails, 'email');
    const processedPhones = ensureSinglePrimary(phones, 'phone');
    const processedAddresses = ensureSinglePrimary(addresses, 'address');

    return {
        emails: processedEmails,
        phones: processedPhones,
        addresses: processedAddresses
    };
}

/**
 * Ensures exactly one item is marked as primary in an array
 * @param {Array} items - Array of items with is_primary flag
 * @param {string} type - Type of items for logging
 * @returns {Array} Processed array with single primary
 */
function ensureSinglePrimary(items, type) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const processed = [...items];
    const primaryCount = processed.filter(item => item.is_primary).length;

    if (primaryCount === 0) {
        // Mark first as primary
        processed[0].is_primary = true;
    } else if (primaryCount > 1) {
        // Keep only first primary
        let foundPrimary = false;
        processed.forEach(item => {
            if (item.is_primary && foundPrimary) {
                item.is_primary = false;
            } else if (item.is_primary) {
                foundPrimary = true;
            }
        });
    }

    return processed;
}