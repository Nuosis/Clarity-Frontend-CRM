/**
 * Customer Data Transformation Tests
 *
 * Comprehensive unit tests for all data transformation functions between
 * FileMaker flat data model and backend relational data model.
 *
 * Tests cover:
 * - FileMaker to Backend transformations
 * - Backend to FileMaker transformations
 * - Nested data handling (emails, phones, addresses)
 * - Edge cases and null handling
 * - Array transformations
 * - Validation functions
 */

import {
    transformFileMakerToBackend,
    transformBackendToFileMaker,
    transformFileMakerArrayToBackend,
    transformBackendArrayToFileMaker,
    extractPrimaryContact,
    extractPrimaryAddress,
    validateTransformedData,
    mergeNestedContacts,
    processCustomerData,
    processBackendCustomerList,
    processBackendCustomerDetail
} from '../customerService';

describe('FileMaker to Backend Transformations', () => {
    describe('transformFileMakerToBackend', () => {
        it('should transform complete FileMaker customer to backend format', () => {
            const fmCustomer = {
                __ID: 'cust-123',
                Name: 'Clarity Business Solutions',
                ContactPerson: 'John Smith',
                Email: 'john@clarity.com',
                Phone: '+1-555-0100',
                Address: '123 Main Street',
                City: 'San Francisco',
                State: 'CA',
                PostalCode: '94102',
                Country: 'USA',
                f_active: '1',
                '~creationTimestamp': '2025-01-01T10:00:00Z',
                '~modificationTimestamp': '2025-01-15T14:30:00Z'
            };

            const result = transformFileMakerToBackend(fmCustomer);

            expect(result).toEqual({
                id: 'cust-123',
                business_name: 'Clarity Business Solutions',
                primary_contact_name: 'John Smith',
                is_active: true,
                type: 'CUSTOMER',
                emails: [{
                    email: 'john@clarity.com',
                    is_primary: true,
                    email_type: 'work'
                }],
                phones: [{
                    phone: '+1-555-0100',
                    is_primary: true,
                    phone_type: 'office'
                }],
                addresses: [{
                    address_line1: '123 Main Street',
                    address_line2: null,
                    city: 'San Francisco',
                    state: 'CA',
                    postal_code: '94102',
                    country: 'USA',
                    is_primary: true
                }],
                created_at: '2025-01-01T10:00:00Z',
                updated_at: '2025-01-15T14:30:00Z'
            });
        });

        it('should handle minimal FileMaker customer data', () => {
            const fmCustomer = {
                __ID: 'cust-456',
                Name: 'ABC Corporation',
                f_active: '0'
            };

            const result = transformFileMakerToBackend(fmCustomer);

            expect(result.id).toBe('cust-456');
            expect(result.business_name).toBe('ABC Corporation');
            expect(result.is_active).toBe(false);
            expect(result.emails).toEqual([]);
            expect(result.phones).toEqual([]);
            expect(result.addresses).toEqual([]);
            expect(result.primary_contact_name).toBeNull();
        });

        it('should handle active status as numeric 1', () => {
            const fmCustomer = {
                __ID: 'cust-789',
                Name: 'Test Company',
                f_active: 1
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.is_active).toBe(true);
        });

        it('should handle active status as boolean', () => {
            const fmCustomer = {
                __ID: 'cust-999',
                Name: 'Test Company',
                isActive: true
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.is_active).toBe(true);
        });

        it('should trim whitespace from email and phone', () => {
            const fmCustomer = {
                __ID: 'cust-111',
                Name: 'Test Company',
                Email: '  test@example.com  ',
                Phone: '  555-0100  ',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.emails[0].email).toBe('test@example.com');
            expect(result.phones[0].phone).toBe('555-0100');
        });

        it('should not create email entry for empty string', () => {
            const fmCustomer = {
                __ID: 'cust-222',
                Name: 'Test Company',
                Email: '',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.emails).toEqual([]);
        });

        it('should not create phone entry for whitespace-only string', () => {
            const fmCustomer = {
                __ID: 'cust-333',
                Name: 'Test Company',
                Phone: '   ',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.phones).toEqual([]);
        });

        it('should only create address if city and state are present', () => {
            const fmCustomer = {
                __ID: 'cust-444',
                Name: 'Test Company',
                Address: '123 Main St',
                PostalCode: '12345',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.addresses).toEqual([]);
        });

        it('should create address with city and state', () => {
            const fmCustomer = {
                __ID: 'cust-555',
                Name: 'Test Company',
                City: 'New York',
                State: 'NY',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.addresses).toHaveLength(1);
            expect(result.addresses[0].city).toBe('New York');
            expect(result.addresses[0].state).toBe('NY');
            expect(result.addresses[0].address_line1).toBe('');
        });

        it('should throw error for null customer', () => {
            expect(() => transformFileMakerToBackend(null)).toThrow('Customer data is required');
        });

        it('should throw error for undefined customer', () => {
            expect(() => transformFileMakerToBackend(undefined)).toThrow('Customer data is required');
        });

        it('should handle customer with id instead of __ID', () => {
            const fmCustomer = {
                id: 'cust-666',
                Name: 'Test Company',
                f_active: '1'
            };

            const result = transformFileMakerToBackend(fmCustomer);
            expect(result.id).toBe('cust-666');
        });
    });
});

describe('Backend to FileMaker Transformations', () => {
    describe('transformBackendToFileMaker', () => {
        it('should transform complete backend customer to FileMaker format', () => {
            const backendCustomer = {
                id: 'cust-123',
                business_name: 'Clarity Business Solutions',
                primary_contact_name: 'John Smith',
                is_active: true,
                emails: [
                    { email: 'john@clarity.com', is_primary: true, email_type: 'work' },
                    { email: 'info@clarity.com', is_primary: false, email_type: 'work' }
                ],
                phones: [
                    { phone: '+1-555-0100', is_primary: true, phone_type: 'office' },
                    { phone: '+1-555-0200', is_primary: false, phone_type: 'mobile' }
                ],
                addresses: [{
                    address_line1: '123 Main Street',
                    address_line2: 'Suite 100',
                    city: 'San Francisco',
                    state: 'CA',
                    postal_code: '94102',
                    country: 'USA',
                    is_primary: true
                }],
                created_at: '2025-01-01T10:00:00Z',
                updated_at: '2025-01-15T14:30:00Z'
            };

            const result = transformBackendToFileMaker(backendCustomer);

            expect(result).toEqual({
                __ID: 'cust-123',
                id: 'cust-123',
                Name: 'Clarity Business Solutions',
                Email: 'john@clarity.com',
                Phone: '+1-555-0100',
                ContactPerson: 'John Smith',
                f_active: '1',
                isActive: true,
                Address: '123 Main Street',
                City: 'San Francisco',
                State: 'CA',
                PostalCode: '94102',
                Country: 'USA',
                '~creationTimestamp': '2025-01-01T10:00:00Z',
                '~modificationTimestamp': '2025-01-15T14:30:00Z',
                createdAt: '2025-01-01T10:00:00Z',
                modifiedAt: '2025-01-15T14:30:00Z'
            });
        });

        it('should extract primary email from array', () => {
            const backendCustomer = {
                id: 'cust-456',
                business_name: 'Test Company',
                is_active: true,
                emails: [
                    { email: 'secondary@test.com', is_primary: false, email_type: 'work' },
                    { email: 'primary@test.com', is_primary: true, email_type: 'work' }
                ],
                phones: [],
                addresses: []
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result.Email).toBe('primary@test.com');
        });

        it('should extract primary phone from array', () => {
            const backendCustomer = {
                id: 'cust-789',
                business_name: 'Test Company',
                is_active: false,
                emails: [],
                phones: [
                    { phone: '555-0200', is_primary: false, phone_type: 'mobile' },
                    { phone: '555-0100', is_primary: true, phone_type: 'office' }
                ],
                addresses: []
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result.Phone).toBe('555-0100');
        });

        it('should handle inactive customer', () => {
            const backendCustomer = {
                id: 'cust-999',
                business_name: 'Inactive Company',
                is_active: false,
                emails: [],
                phones: [],
                addresses: []
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result.f_active).toBe('0');
            expect(result.isActive).toBe(false);
        });

        it('should handle empty nested arrays', () => {
            const backendCustomer = {
                id: 'cust-111',
                business_name: 'Minimal Company',
                is_active: true,
                emails: [],
                phones: [],
                addresses: []
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result.Email).toBe('');
            expect(result.Phone).toBe('');
            expect(result.Address).toBe('');
            expect(result.City).toBe('');
            expect(result.State).toBe('');
            expect(result.PostalCode).toBe('');
            expect(result.Country).toBe('');
        });

        it('should handle null nested arrays', () => {
            const backendCustomer = {
                id: 'cust-222',
                business_name: 'Null Arrays Company',
                is_active: true
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result.Email).toBe('');
            expect(result.Phone).toBe('');
        });

        it('should handle missing timestamps', () => {
            const backendCustomer = {
                id: 'cust-333',
                business_name: 'No Timestamps',
                is_active: true,
                emails: [],
                phones: [],
                addresses: []
            };

            const result = transformBackendToFileMaker(backendCustomer);
            expect(result['~creationTimestamp']).toBeNull();
            expect(result['~modificationTimestamp']).toBeNull();
            expect(result.createdAt).toBeNull();
            expect(result.modifiedAt).toBeNull();
        });

        it('should throw error for null customer', () => {
            expect(() => transformBackendToFileMaker(null)).toThrow('Customer data is required');
        });

        it('should throw error for undefined customer', () => {
            expect(() => transformBackendToFileMaker(undefined)).toThrow('Customer data is required');
        });
    });
});

describe('Nested Data Extraction', () => {
    describe('extractPrimaryContact', () => {
        it('should extract primary contact from array', () => {
            const contacts = [
                { email: 'secondary@test.com', is_primary: false },
                { email: 'primary@test.com', is_primary: true },
                { email: 'other@test.com', is_primary: false }
            ];

            const result = extractPrimaryContact(contacts, 'email');
            expect(result).toBe('primary@test.com');
        });

        it('should fallback to first contact if no primary', () => {
            const contacts = [
                { email: 'first@test.com', is_primary: false },
                { email: 'second@test.com', is_primary: false }
            ];

            const result = extractPrimaryContact(contacts, 'email');
            expect(result).toBe('first@test.com');
        });

        it('should return null for empty array', () => {
            const result = extractPrimaryContact([], 'email');
            expect(result).toBeNull();
        });

        it('should return null for null input', () => {
            const result = extractPrimaryContact(null, 'email');
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = extractPrimaryContact(undefined, 'email');
            expect(result).toBeNull();
        });

        it('should handle contact with missing field', () => {
            const contacts = [
                { is_primary: true }
            ];

            const result = extractPrimaryContact(contacts, 'email');
            expect(result).toBeNull();
        });

        it('should extract phone numbers correctly', () => {
            const phones = [
                { phone: '555-0100', is_primary: true },
                { phone: '555-0200', is_primary: false }
            ];

            const result = extractPrimaryContact(phones, 'phone');
            expect(result).toBe('555-0100');
        });
    });

    describe('extractPrimaryAddress', () => {
        it('should extract primary address from array', () => {
            const addresses = [
                {
                    address_line1: 'Secondary St',
                    city: 'Boston',
                    state: 'MA',
                    postal_code: '02101',
                    country: 'USA',
                    is_primary: false
                },
                {
                    address_line1: '123 Main St',
                    city: 'San Francisco',
                    state: 'CA',
                    postal_code: '94102',
                    country: 'USA',
                    is_primary: true
                }
            ];

            const result = extractPrimaryAddress(addresses);
            expect(result.address_line1).toBe('123 Main St');
            expect(result.city).toBe('San Francisco');
        });

        it('should fallback to first address if no primary', () => {
            const addresses = [
                {
                    address_line1: 'First St',
                    city: 'Boston',
                    state: 'MA',
                    postal_code: '02101',
                    country: 'USA',
                    is_primary: false
                },
                {
                    address_line1: 'Second St',
                    city: 'New York',
                    state: 'NY',
                    postal_code: '10001',
                    country: 'USA',
                    is_primary: false
                }
            ];

            const result = extractPrimaryAddress(addresses);
            expect(result.address_line1).toBe('First St');
        });

        it('should return empty object for empty array', () => {
            const result = extractPrimaryAddress([]);
            expect(result).toEqual({
                address_line1: '',
                city: '',
                state: '',
                postal_code: '',
                country: ''
            });
        });

        it('should return empty object for null input', () => {
            const result = extractPrimaryAddress(null);
            expect(result).toEqual({
                address_line1: '',
                city: '',
                state: '',
                postal_code: '',
                country: ''
            });
        });

        it('should return empty object for undefined input', () => {
            const result = extractPrimaryAddress(undefined);
            expect(result).toEqual({
                address_line1: '',
                city: '',
                state: '',
                postal_code: '',
                country: ''
            });
        });
    });
});

describe('Array Transformations', () => {
    describe('transformFileMakerArrayToBackend', () => {
        it('should transform array of FileMaker customers', () => {
            const fmCustomers = [
                {
                    __ID: 'cust-1',
                    Name: 'Company A',
                    Email: 'a@test.com',
                    f_active: '1'
                },
                {
                    __ID: 'cust-2',
                    Name: 'Company B',
                    Email: 'b@test.com',
                    f_active: '0'
                }
            ];

            const result = transformFileMakerArrayToBackend(fmCustomers);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('cust-1');
            expect(result[0].business_name).toBe('Company A');
            expect(result[0].is_active).toBe(true);
            expect(result[1].id).toBe('cust-2');
            expect(result[1].business_name).toBe('Company B');
            expect(result[1].is_active).toBe(false);
        });

        it('should handle empty array', () => {
            const result = transformFileMakerArrayToBackend([]);
            expect(result).toEqual([]);
        });

        it('should filter out failed transformations', () => {
            const fmCustomers = [
                { __ID: 'cust-1', Name: 'Valid Company', f_active: '1' },
                null,
                { __ID: 'cust-2', Name: 'Another Valid', f_active: '1' }
            ];

            const result = transformFileMakerArrayToBackend(fmCustomers);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('cust-1');
            expect(result[1].id).toBe('cust-2');
        });

        it('should throw error for non-array input', () => {
            expect(() => transformFileMakerArrayToBackend(null)).toThrow('Expected array of customers');
            expect(() => transformFileMakerArrayToBackend({})).toThrow('Expected array of customers');
            expect(() => transformFileMakerArrayToBackend('string')).toThrow('Expected array of customers');
        });
    });

    describe('transformBackendArrayToFileMaker', () => {
        it('should transform array of backend customers', () => {
            const backendCustomers = [
                {
                    id: 'cust-1',
                    business_name: 'Company A',
                    is_active: true,
                    emails: [{ email: 'a@test.com', is_primary: true }],
                    phones: [],
                    addresses: []
                },
                {
                    id: 'cust-2',
                    business_name: 'Company B',
                    is_active: false,
                    emails: [],
                    phones: [{ phone: '555-0100', is_primary: true }],
                    addresses: []
                }
            ];

            const result = transformBackendArrayToFileMaker(backendCustomers);

            expect(result).toHaveLength(2);
            expect(result[0].__ID).toBe('cust-1');
            expect(result[0].Name).toBe('Company A');
            expect(result[0].f_active).toBe('1');
            expect(result[0].Email).toBe('a@test.com');
            expect(result[1].__ID).toBe('cust-2');
            expect(result[1].Name).toBe('Company B');
            expect(result[1].f_active).toBe('0');
            expect(result[1].Phone).toBe('555-0100');
        });

        it('should handle empty array', () => {
            const result = transformBackendArrayToFileMaker([]);
            expect(result).toEqual([]);
        });

        it('should filter out failed transformations', () => {
            const backendCustomers = [
                { id: 'cust-1', business_name: 'Valid', is_active: true, emails: [], phones: [], addresses: [] },
                null,
                { id: 'cust-2', business_name: 'Another', is_active: false, emails: [], phones: [], addresses: [] }
            ];

            const result = transformBackendArrayToFileMaker(backendCustomers);
            expect(result).toHaveLength(2);
        });

        it('should throw error for non-array input', () => {
            expect(() => transformBackendArrayToFileMaker(null)).toThrow('Expected array of customers');
            expect(() => transformBackendArrayToFileMaker({})).toThrow('Expected array of customers');
        });
    });
});

describe('Validation Functions', () => {
    describe('validateTransformedData', () => {
        describe('Backend format validation', () => {
            it('should validate complete backend customer data', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [{ email: 'test@example.com', is_primary: true }],
                    phones: [{ phone: '555-0100', is_primary: true }],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should fail validation for missing business_name', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: '',
                    is_active: true,
                    emails: [],
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('business_name is required');
            });

            it('should fail validation for missing id', () => {
                const customer = {
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [],
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('id is required');
            });

            it('should fail validation for non-boolean is_active', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: '1',
                    emails: [],
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('is_active must be a boolean');
            });

            it('should fail validation for invalid email format', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [{ email: 'invalid-email', is_primary: true }],
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.includes('invalid format'))).toBe(true);
            });

            it('should fail validation for non-boolean email is_primary', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [{ email: 'test@example.com', is_primary: 'true' }],
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.includes('is_primary must be a boolean'))).toBe(true);
            });

            it('should fail validation for non-array emails', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: 'not-an-array',
                    phones: [],
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('emails must be an array');
            });

            it('should fail validation for non-array phones', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [],
                    phones: null,
                    addresses: []
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('phones must be an array');
            });

            it('should fail validation for non-array addresses', () => {
                const customer = {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [],
                    phones: [],
                    addresses: {}
                };

                const result = validateTransformedData(customer, 'backend');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('addresses must be an array');
            });
        });

        describe('FileMaker format validation', () => {
            it('should validate complete FileMaker customer data', () => {
                const customer = {
                    __ID: 'cust-123',
                    Name: 'Test Company',
                    f_active: '1',
                    Email: 'test@example.com',
                    Phone: '555-0100'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should fail validation for missing Name', () => {
                const customer = {
                    __ID: 'cust-123',
                    Name: '',
                    f_active: '1'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Name is required');
            });

            it('should fail validation for missing __ID and id', () => {
                const customer = {
                    Name: 'Test Company',
                    f_active: '1'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('__ID or id is required');
            });

            it('should fail validation for invalid f_active', () => {
                const customer = {
                    __ID: 'cust-123',
                    Name: 'Test Company',
                    f_active: 'yes'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('f_active must be "0" or "1"');
            });

            it('should fail validation for invalid email format', () => {
                const customer = {
                    __ID: 'cust-123',
                    Name: 'Test Company',
                    f_active: '1',
                    Email: 'not-an-email'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Email has invalid format');
            });

            it('should accept id if __ID is missing', () => {
                const customer = {
                    id: 'cust-123',
                    Name: 'Test Company',
                    f_active: '0'
                };

                const result = validateTransformedData(customer, 'filemaker');
                expect(result.isValid).toBe(true);
            });
        });

        it('should fail validation for null customer', () => {
            const result = validateTransformedData(null, 'backend');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Customer data is required');
        });

        it('should fail validation for unknown format', () => {
            const customer = { id: 'test', Name: 'Test' };
            const result = validateTransformedData(customer, 'invalid');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unknown format: invalid');
        });
    });
});

describe('Nested Contact Management', () => {
    describe('mergeNestedContacts', () => {
        it('should merge nested contacts with single primary', () => {
            const options = {
                emails: [
                    { email: 'first@test.com', is_primary: true },
                    { email: 'second@test.com', is_primary: false }
                ],
                phones: [
                    { phone: '555-0100', is_primary: false },
                    { phone: '555-0200', is_primary: true }
                ],
                addresses: [
                    { address_line1: '123 Main', is_primary: true }
                ]
            };

            const result = mergeNestedContacts(options);

            expect(result.emails).toHaveLength(2);
            expect(result.emails.filter(e => e.is_primary)).toHaveLength(1);
            expect(result.phones).toHaveLength(2);
            expect(result.phones.filter(p => p.is_primary)).toHaveLength(1);
            expect(result.addresses).toHaveLength(1);
            expect(result.addresses[0].is_primary).toBe(true);
        });

        it('should set first as primary if none marked', () => {
            const options = {
                emails: [
                    { email: 'first@test.com', is_primary: false },
                    { email: 'second@test.com', is_primary: false }
                ],
                phones: [],
                addresses: []
            };

            const result = mergeNestedContacts(options);
            expect(result.emails[0].is_primary).toBe(true);
            expect(result.emails[1].is_primary).toBe(false);
        });

        it('should keep only first primary if multiple marked', () => {
            const options = {
                emails: [
                    { email: 'first@test.com', is_primary: true },
                    { email: 'second@test.com', is_primary: true },
                    { email: 'third@test.com', is_primary: true }
                ],
                phones: [],
                addresses: []
            };

            const result = mergeNestedContacts(options);
            const primaryCount = result.emails.filter(e => e.is_primary).length;
            expect(primaryCount).toBe(1);
            expect(result.emails[0].is_primary).toBe(true);
            expect(result.emails[1].is_primary).toBe(false);
            expect(result.emails[2].is_primary).toBe(false);
        });

        it('should handle empty arrays', () => {
            const result = mergeNestedContacts({});
            expect(result.emails).toEqual([]);
            expect(result.phones).toEqual([]);
            expect(result.addresses).toEqual([]);
        });
    });
});

describe('Response Processing Functions', () => {
    describe('processCustomerData', () => {
        it('should process FileMaker response data', () => {
            const data = {
                response: {
                    data: [
                        {
                            recordId: 'rec-1',
                            fieldData: {
                                __ID: 'cust-1',
                                Name: 'Company A',
                                f_active: '1',
                                '~creationTimestamp': '2025-01-01T10:00:00Z',
                                '~modificationTimestamp': '2025-01-15T14:00:00Z'
                            }
                        },
                        {
                            recordId: 'rec-2',
                            fieldData: {
                                __ID: 'cust-2',
                                Name: 'Company B',
                                f_active: 0,
                                '~creationTimestamp': '2025-01-02T10:00:00Z',
                                '~modificationTimestamp': '2025-01-16T14:00:00Z'
                            }
                        }
                    ]
                }
            };

            const result = processCustomerData(data);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('cust-1');
            expect(result[0].Name).toBe('Company A');
            expect(result[0].isActive).toBe(true);
            expect(result[0].recordId).toBe('rec-1');
            expect(result[1].id).toBe('cust-2');
            expect(result[1].isActive).toBe(false);
        });

        it('should return empty array for null data', () => {
            const result = processCustomerData(null);
            expect(result).toEqual([]);
        });

        it('should return empty array for missing response', () => {
            const result = processCustomerData({});
            expect(result).toEqual([]);
        });

        it('should return empty array for missing data', () => {
            const result = processCustomerData({ response: {} });
            expect(result).toEqual([]);
        });
    });

    describe('processBackendCustomerList', () => {
        it('should process paginated backend response', () => {
            const response = {
                customers: [
                    { id: 'cust-1', business_name: 'Company A', is_active: true, emails: [], phones: [], addresses: [] },
                    { id: 'cust-2', business_name: 'Company B', is_active: false, emails: [], phones: [], addresses: [] }
                ],
                pagination: {
                    total: 100,
                    limit: 50,
                    offset: 0,
                    has_more: true
                }
            };

            const result = processBackendCustomerList(response);

            expect(result.customers).toHaveLength(2);
            expect(result.customers[0].__ID).toBe('cust-1');
            expect(result.customers[0].Name).toBe('Company A');
            expect(result.pagination).toEqual({
                total: 100,
                limit: 50,
                offset: 0,
                has_more: true
            });
        });

        it('should process direct array response', () => {
            const response = [
                { id: 'cust-1', business_name: 'Company A', is_active: true, emails: [], phones: [], addresses: [] }
            ];

            const result = processBackendCustomerList(response);

            expect(result.customers).toHaveLength(1);
            expect(result.customers[0].__ID).toBe('cust-1');
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.has_more).toBe(false);
        });

        it('should process envelope format with data wrapper', () => {
            const response = {
                data: {
                    customers: [
                        { id: 'cust-1', business_name: 'Company A', is_active: true, emails: [], phones: [], addresses: [] }
                    ],
                    pagination: {
                        total: 1,
                        limit: 50,
                        offset: 0,
                        has_more: false
                    }
                }
            };

            const result = processBackendCustomerList(response);

            expect(result.customers).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('should handle empty response', () => {
            const result = processBackendCustomerList({});

            expect(result.customers).toEqual([]);
            expect(result.pagination).toEqual({
                total: 0,
                limit: 0,
                offset: 0,
                has_more: false
            });
        });
    });

    describe('processBackendCustomerDetail', () => {
        it('should process single customer response', () => {
            const response = {
                id: 'cust-123',
                business_name: 'Test Company',
                is_active: true,
                emails: [{ email: 'test@example.com', is_primary: true }],
                phones: [],
                addresses: []
            };

            const result = processBackendCustomerDetail(response);

            expect(result.__ID).toBe('cust-123');
            expect(result.Name).toBe('Test Company');
            expect(result.Email).toBe('test@example.com');
        });

        it('should process envelope format', () => {
            const response = {
                data: {
                    id: 'cust-123',
                    business_name: 'Test Company',
                    is_active: true,
                    emails: [],
                    phones: [],
                    addresses: []
                }
            };

            const result = processBackendCustomerDetail(response);

            expect(result.__ID).toBe('cust-123');
            expect(result.Name).toBe('Test Company');
        });

        it('should throw error for invalid data', () => {
            expect(() => processBackendCustomerDetail(null)).toThrow();
            expect(() => processBackendCustomerDetail(undefined)).toThrow();
        });
    });
});
