/**
 * Test Fixtures for Project Tests
 *
 * Mock data structures for both FileMaker and Backend API formats
 */

// Backend API Project Fixtures (Supabase schema)
export const backendProjectFixtures = {
    // Single project - minimal
    minimalProject: {
        id: 'proj-minimal-001',
        name: 'Minimal Test Project',
        customer_id: 'cust-123',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
    },

    // Single project - full details
    fullProject: {
        id: 'proj-full-001',
        name: 'Complete Test Project',
        customer_id: 'cust-123',
        team_id: 'team-456',
        description: 'A comprehensive test project with all fields populated',
        status: 'active',
        budget: 10000,
        is_fixed_price: true,
        is_subscription: false,
        start_date: '2024-01-01',
        target_end_date: '2024-12-31',
        actual_end_date: null,
        time_estimate: '100 hours',
        github_repo_url: 'https://github.com/test/repo',
        project_link: 'https://project.example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
    },

    // Subscription project
    subscriptionProject: {
        id: 'proj-sub-001',
        name: 'Subscription Project',
        customer_id: 'cust-456',
        status: 'active',
        budget: 500,
        is_fixed_price: false,
        is_subscription: true,
        start_date: '2024-01-01',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
    },

    // Completed project
    completedProject: {
        id: 'proj-completed-001',
        name: 'Completed Project',
        customer_id: 'cust-789',
        status: 'completed',
        budget: 15000,
        is_fixed_price: true,
        start_date: '2023-01-01',
        target_end_date: '2023-12-31',
        actual_end_date: '2023-11-30',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-12-01T00:00:00Z'
    },

    // Project with nested related data
    projectWithDetails: {
        id: 'proj-detailed-001',
        name: 'Project With Details',
        customer_id: 'cust-123',
        status: 'active',
        budget: 8000,
        is_fixed_price: true,
        objectives: [
            {
                id: 'obj-001',
                project_id: 'proj-detailed-001',
                title: 'Complete Phase 1',
                description: 'Initial setup and configuration',
                is_completed: false,
                order_index: 0,
                created_at: '2024-01-01T00:00:00Z',
                steps: [
                    {
                        id: 'step-001',
                        objective_id: 'obj-001',
                        title: 'Setup environment',
                        is_completed: true,
                        order_index: 0,
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'step-002',
                        objective_id: 'obj-001',
                        title: 'Configure database',
                        is_completed: false,
                        order_index: 1,
                        created_at: '2024-01-02T00:00:00Z'
                    }
                ]
            },
            {
                id: 'obj-002',
                project_id: 'proj-detailed-001',
                title: 'Complete Phase 2',
                description: 'Development and testing',
                is_completed: false,
                order_index: 1,
                created_at: '2024-01-05T00:00:00Z',
                steps: []
            }
        ],
        images: [
            {
                id: 'img-001',
                project_id: 'proj-detailed-001',
                url: 'https://example.com/project-screenshot-1.jpg',
                description: 'Main dashboard screenshot',
                created_at: '2024-01-10T00:00:00Z'
            },
            {
                id: 'img-002',
                project_id: 'proj-detailed-001',
                url: 'https://example.com/project-screenshot-2.jpg',
                description: 'Settings page',
                created_at: '2024-01-11T00:00:00Z'
            }
        ],
        notes: [
            {
                id: 'note-001',
                project_id: 'proj-detailed-001',
                content: 'Client requested additional feature',
                created_at: '2024-01-12T00:00:00Z',
                updated_at: '2024-01-12T00:00:00Z'
            }
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
    },

    // Array of projects
    projectList: [
        {
            id: 'proj-001',
            name: 'Project Alpha',
            customer_id: 'cust-123',
            status: 'active',
            budget: 5000,
            is_fixed_price: true,
            created_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 'proj-002',
            name: 'Project Beta',
            customer_id: 'cust-123',
            status: 'pending',
            budget: 3000,
            is_subscription: true,
            created_at: '2024-01-05T00:00:00Z'
        },
        {
            id: 'proj-003',
            name: 'Project Gamma',
            customer_id: 'cust-456',
            status: 'on_hold',
            budget: 7500,
            is_fixed_price: true,
            created_at: '2024-01-10T00:00:00Z'
        }
    ]
};

// FileMaker Project Fixtures
export const fileMakerProjectFixtures = {
    // Single project response
    singleProject: {
        response: {
            data: [
                {
                    recordId: '123',
                    fieldData: {
                        __ID: 'proj-fm-001',
                        projectName: 'FileMaker Test Project',
                        _custID: 'cust-123',
                        _teamID: 'team-456',
                        description: 'Test project from FileMaker',
                        status: 'Open',
                        value: '10000',
                        f_fixedPrice: '1',
                        f_subscription: '0',
                        dateStart: '01/01/2024',
                        dateEnd: '12/31/2024',
                        estOfTime: '100 hours',
                        '~creationTimestamp': '01/01/2024 00:00:00',
                        '~modificationTimestamp': '01/15/2024 00:00:00'
                    }
                }
            ]
        }
    },

    // Multiple projects response
    projectList: {
        response: {
            data: [
                {
                    recordId: '101',
                    fieldData: {
                        __ID: 'proj-fm-001',
                        projectName: 'FM Project 1',
                        _custID: 'cust-123',
                        status: 'Open',
                        value: '5000',
                        f_fixedPrice: '1',
                        f_subscription: '0'
                    }
                },
                {
                    recordId: '102',
                    fieldData: {
                        __ID: 'proj-fm-002',
                        projectName: 'FM Project 2',
                        _custID: 'cust-123',
                        status: 'Closed',
                        value: '3000',
                        f_fixedPrice: '0',
                        f_subscription: '1'
                    }
                }
            ]
        }
    },

    // Empty response
    emptyResponse: {
        response: {
            data: []
        }
    }
};

// Objectives Fixtures
export const objectiveFixtures = {
    backend: [
        {
            id: 'obj-001',
            project_id: 'proj-001',
            title: 'Setup Infrastructure',
            description: 'Configure servers and databases',
            is_completed: false,
            order_index: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 'obj-002',
            project_id: 'proj-001',
            title: 'Develop Features',
            description: 'Build core functionality',
            is_completed: false,
            order_index: 1,
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
        }
    ],

    fileMaker: {
        response: {
            data: [
                {
                    recordId: '201',
                    fieldData: {
                        __ID: 'obj-fm-001',
                        _projectID: 'proj-fm-001',
                        objective: 'Setup Infrastructure',
                        f_complete: '0'
                    }
                },
                {
                    recordId: '202',
                    fieldData: {
                        __ID: 'obj-fm-002',
                        _projectID: 'proj-fm-001',
                        objective: 'Develop Features',
                        f_complete: '0'
                    }
                }
            ]
        }
    }
};

// Steps Fixtures
export const stepFixtures = {
    backend: [
        {
            id: 'step-001',
            objective_id: 'obj-001',
            title: 'Provision servers',
            description: 'Setup cloud infrastructure',
            is_completed: true,
            order_index: 0,
            created_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 'step-002',
            objective_id: 'obj-001',
            title: 'Configure database',
            description: 'Setup PostgreSQL',
            is_completed: false,
            order_index: 1,
            created_at: '2024-01-02T00:00:00Z'
        },
        {
            id: 'step-003',
            objective_id: 'obj-002',
            title: 'Create API endpoints',
            is_completed: false,
            order_index: 0,
            created_at: '2024-01-03T00:00:00Z'
        }
    ],

    fileMaker: {
        response: {
            data: [
                {
                    recordId: '301',
                    fieldData: {
                        __ID: 'step-fm-001',
                        _objectiveID: 'obj-fm-001',
                        step: 'Provision servers',
                        f_complete: '1'
                    }
                },
                {
                    recordId: '302',
                    fieldData: {
                        __ID: 'step-fm-002',
                        _objectiveID: 'obj-fm-001',
                        step: 'Configure database',
                        f_complete: '0'
                    }
                }
            ]
        }
    }
};

// Images Fixtures
export const imageFixtures = {
    backend: [
        {
            id: 'img-001',
            project_id: 'proj-001',
            url: 'https://example.com/screenshot1.jpg',
            description: 'Main dashboard',
            created_at: '2024-01-10T00:00:00Z'
        },
        {
            id: 'img-002',
            project_id: 'proj-001',
            url: 'https://example.com/screenshot2.jpg',
            description: 'Settings page',
            created_at: '2024-01-11T00:00:00Z'
        }
    ],

    fileMaker: {
        response: {
            data: [
                {
                    recordId: '401',
                    fieldData: {
                        __ID: 'img-fm-001',
                        _fkID: 'proj-fm-001',
                        image: 'https://example.com/screenshot1.jpg'
                    }
                },
                {
                    recordId: '402',
                    fieldData: {
                        __ID: 'img-fm-002',
                        _fkID: 'proj-fm-001',
                        image: 'https://example.com/screenshot2.jpg'
                    }
                }
            ]
        }
    }
};

// Links Fixtures
export const linkFixtures = {
    backend: [
        {
            id: 'link-001',
            project_id: 'proj-001',
            url: 'https://github.com/test/repo',
            description: 'GitHub Repository',
            created_at: '2024-01-05T00:00:00Z'
        },
        {
            id: 'link-002',
            project_id: 'proj-001',
            url: 'https://docs.example.com',
            description: 'Documentation',
            created_at: '2024-01-06T00:00:00Z'
        }
    ],

    fileMaker: {
        response: {
            data: [
                {
                    recordId: '501',
                    fieldData: {
                        __ID: 'link-fm-001',
                        _fkID: 'proj-fm-001',
                        link: 'https://github.com/test/repo'
                    }
                },
                {
                    recordId: '502',
                    fieldData: {
                        __ID: 'link-fm-002',
                        _fkID: 'proj-fm-001',
                        link: 'https://docs.example.com'
                    }
                }
            ]
        }
    }
};

// Notes Fixtures
export const noteFixtures = {
    backend: [
        {
            id: 'note-001',
            project_id: 'proj-001',
            content: 'Client requested additional features',
            created_at: '2024-01-12T00:00:00Z',
            updated_at: '2024-01-12T00:00:00Z'
        },
        {
            id: 'note-002',
            project_id: 'proj-001',
            content: 'Meeting scheduled for next week',
            created_at: '2024-01-13T00:00:00Z',
            updated_at: '2024-01-14T00:00:00Z'
        }
    ],

    fileMaker: {
        response: {
            data: [
                {
                    recordId: '601',
                    fieldData: {
                        __ID: 'note-fm-001',
                        _fkID: 'proj-fm-001',
                        note: 'Client requested additional features'
                    }
                }
            ]
        }
    }
};

// Error Response Fixtures
export const errorFixtures = {
    notFound: {
        response: {
            status: 404,
            data: {
                message: 'Project not found',
                code: 'PROJECT_NOT_FOUND'
            }
        }
    },

    unauthorized: {
        response: {
            status: 401,
            data: {
                message: 'Authentication token expired',
                code: 'AUTH_TOKEN_EXPIRED'
            }
        }
    },

    forbidden: {
        response: {
            status: 403,
            data: {
                message: 'You do not have permission to access this project',
                code: 'PERMISSION_DENIED'
            }
        }
    },

    validationError: {
        response: {
            status: 400,
            data: {
                message: 'Validation error',
                code: 'VALIDATION_ERROR',
                errors: {
                    name: 'Project name is required',
                    customer_id: 'Customer ID is required'
                }
            }
        }
    },

    serverError: {
        response: {
            status: 500,
            data: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        }
    },

    networkError: {
        code: 'ERR_NETWORK',
        message: 'Network Error'
    },

    timeoutError: {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
    }
};

// Helper function to create project with custom overrides
export function createProjectFixture(overrides = {}, format = 'backend') {
    if (format === 'backend') {
        return {
            ...backendProjectFixtures.fullProject,
            ...overrides
        };
    } else {
        return {
            response: {
                data: [
                    {
                        recordId: overrides.recordId || '999',
                        fieldData: {
                            ...fileMakerProjectFixtures.singleProject.response.data[0].fieldData,
                            ...overrides
                        }
                    }
                ]
            }
        };
    }
}

// Helper function to create objective fixture with custom data
export function createObjectiveFixture(overrides = {}, format = 'backend') {
    if (format === 'backend') {
        return {
            ...objectiveFixtures.backend[0],
            ...overrides
        };
    } else {
        return {
            recordId: overrides.recordId || '999',
            fieldData: {
                ...objectiveFixtures.fileMaker.response.data[0].fieldData,
                ...overrides
            }
        };
    }
}
