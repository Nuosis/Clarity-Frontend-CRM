/**
 * Project API Integration Tests
 *
 * Tests for src/api/projects.js covering:
 * - CRUD operations for projects, objectives, images, links, notes
 * - Authentication headers (HMAC for backend)
 * - Organization scoping for webapp environment
 * - Error handling (network, validation, authorization)
 * - Environment-aware routing (FileMaker vs Backend API)
 * - Data normalization between environments
 * - Status mapping and updates
 */

// Mock config first before any imports
jest.mock('../../config', () => ({
    supabaseUrl: 'https://supabase.claritybusinesssolutions.ca',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: 'test-service-role-key',
    supabaseKey: 'test-anon-key',
    backendConfig: {
        baseUrl: 'https://api.claritybusinesssolutions.ca',
        fileMakerApiUrl: 'https://api.claritybusinesssolutions.ca/filemaker',
        quickBooksApiUrl: 'https://api.claritybusinesssolutions.ca/quickbooks'
    },
    fileMakerConfig: {
        apiUrl: 'https://api.claritybusinesssolutions.ca/filemaker'
    }
}));

// Mock dependencies
jest.mock('../../services/dataService', () => ({
    dataService: {
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        put: jest.fn()
    },
    getEnvironmentContext: jest.fn(),
    setEnvironmentContext: jest.fn(),
    ENVIRONMENT_TYPES: {
        FILEMAKER: 'filemaker',
        WEBAPP: 'webapp'
    },
    AUTH_METHODS: {
        FILEMAKER: 'filemaker',
        SUPABASE: 'supabase'
    }
}));

jest.mock('../fileMaker', () => ({
    handleFileMakerOperation: jest.fn((fn) => fn()),
    validateParams: jest.fn(),
    Layouts: {
        PROJECTS: 'devProjects',
        OBJECTIVES: 'devObjectives',
        STEPS: 'devSteps'
    },
    Actions: {
        READ: 'READ',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE'
    }
}));

// Import after mocks are set up
import * as projectsApi from '../projects';
import * as dataService from '../../services/dataService';
// DEPRECATED (TSK0017): FileMaker integration removed
// import * as fileMakerApi from '../fileMaker';

describe('Project API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Environment Detection', () => {
        it('should route to FileMaker in FileMaker environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                authentication: { isAuthenticated: true, method: 'filemaker' }
            });

            dataService.dataService.request.mockResolvedValue({
                response: { data: [{ fieldData: { __ID: '1', projectName: 'Test Project' } }] }
            });

            await projectsApi.fetchProjectsForCustomer('cust-123');

            expect(dataService.dataService.request).toHaveBeenCalled();
            expect(dataService.dataService.get).not.toHaveBeenCalled();
        });

        it('should route to Backend API in webapp environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });

            dataService.dataService.get.mockResolvedValue({
                data: [{ id: '1', name: 'Test Project', customer_id: 'cust-123' }]
            });

            await projectsApi.fetchProjectsForCustomer('cust-123');

            expect(dataService.dataService.get).toHaveBeenCalled();
            expect(dataService.dataService.request).not.toHaveBeenCalled();
        });
    });

    describe('Organization Scoping', () => {
        it('should check organization scope for webapp environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });

            dataService.dataService.get.mockResolvedValue({
                data: []
            });

            await projectsApi.fetchProjectsForCustomer('cust-123');

            expect(dataService.getEnvironmentContext).toHaveBeenCalled();
        });

        it('should throw error if organization scope is missing in webapp', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: {} // Missing supabaseOrgID
                }
            });

            await expect(projectsApi.fetchProjectsForCustomer('cust-123'))
                .rejects.toThrow('Organization context required');
        });
    });

    describe('fetchProjectsForCustomer', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch projects for a customer', async () => {
                const mockProjects = [
                    {
                        id: 'proj-1',
                        name: 'Project 1',
                        customer_id: 'cust-123',
                        status: 'active',
                        budget: 5000,
                        is_fixed_price: true
                    },
                    {
                        id: 'proj-2',
                        name: 'Project 2',
                        customer_id: 'cust-123',
                        status: 'completed',
                        budget: 3000,
                        is_subscription: true
                    }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockProjects
                });

                const result = await projectsApi.fetchProjectsForCustomer('cust-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/projects/customer/cust-123'
                );

                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ id: 'proj-1', __ID: 'proj-1' }),
                        expect.objectContaining({ id: 'proj-2', __ID: 'proj-2' })
                    ])
                );
            });

            it('should validate required customerId parameter', async () => {
                dataService.dataService.get.mockResolvedValue({ data: [] });

                await projectsApi.fetchProjectsForCustomer('cust-123');

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { customerId: 'cust-123' },
                    ['customerId']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should fetch projects from FileMaker', async () => {
                const mockResponse = {
                    response: {
                        data: [
                            {
                                recordId: '1',
                                fieldData: {
                                    __ID: 'proj-1',
                                    projectName: 'Project 1',
                                    _custID: 'cust-123'
                                }
                            }
                        ]
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await projectsApi.fetchProjectsForCustomer('cust-123');

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devProjects',
                    action: 'READ',
                    query: [{ "_custID": 'cust-123' }]
                });
            });
        });
    });

    describe('fetchProjectById', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch project by ID', async () => {
                const mockProject = {
                    id: 'proj-123',
                    name: 'Test Project',
                    customer_id: 'cust-123',
                    status: 'active',
                    budget: 5000,
                    description: 'Test description'
                };

                dataService.dataService.get.mockResolvedValue({
                    data: mockProject
                });

                const result = await projectsApi.fetchProjectById('proj-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/projects/proj-123'
                );

                expect(result).toMatchObject({
                    id: 'proj-123',
                    __ID: 'proj-123'
                });
            });
        });
    });

    describe('fetchProjectWithDetails', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch project with nested related data', async () => {
                const mockDetailedProject = {
                    id: 'proj-123',
                    name: 'Test Project',
                    customer_id: 'cust-123',
                    objectives: [
                        { id: 'obj-1', title: 'Objective 1', project_id: 'proj-123' }
                    ],
                    images: [
                        { id: 'img-1', url: 'https://example.com/image.jpg', project_id: 'proj-123' }
                    ],
                    notes: [
                        { id: 'note-1', content: 'Test note', project_id: 'proj-123' }
                    ]
                };

                dataService.dataService.get.mockResolvedValue({
                    data: mockDetailedProject
                });

                const result = await projectsApi.fetchProjectWithDetails('proj-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/projects/proj-123/detail'
                );

                expect(result).toMatchObject({
                    id: 'proj-123',
                    __ID: 'proj-123'
                });
            });
        });
    });

    describe('createProject', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should create a new project', async () => {
                const newProject = {
                    name: 'New Project',
                    customer_id: 'cust-123',
                    budget: 5000,
                    is_fixed_price: true,
                    description: 'New project description'
                };

                const mockResponse = {
                    id: 'proj-new',
                    ...newProject,
                    created_at: '2024-01-15T10:00:00Z'
                };

                dataService.dataService.post.mockResolvedValue({
                    data: mockResponse
                });

                const result = await projectsApi.createProject(newProject);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/projects',
                    newProject
                );

                expect(result).toMatchObject({
                    id: 'proj-new',
                    __ID: 'proj-new'
                });
            });

            it('should validate required data parameter', async () => {
                dataService.dataService.post.mockResolvedValue({ data: {} });

                await projectsApi.createProject({ name: 'Test' });

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { data: { name: 'Test' } },
                    ['data']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should create project in FileMaker', async () => {
                const newProject = {
                    projectName: 'New Project',
                    _custID: 'cust-123',
                    value: 5000
                };

                const mockResponse = {
                    response: {
                        recordId: 'new-1',
                        data: { fieldData: newProject }
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await projectsApi.createProject(newProject);

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devProjects',
                    action: 'CREATE',
                    fieldData: newProject
                });
            });
        });
    });

    describe('updateProject', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should update an existing project', async () => {
                const updateData = {
                    name: 'Updated Project',
                    budget: 7500,
                    description: 'Updated description'
                };

                const mockResponse = {
                    id: 'proj-123',
                    ...updateData,
                    updated_at: '2024-01-15T10:00:00Z'
                };

                dataService.dataService.put.mockResolvedValue({
                    data: mockResponse
                });

                const result = await projectsApi.updateProject('proj-123', updateData);

                expect(dataService.dataService.put).toHaveBeenCalledWith(
                    '/projects/proj-123',
                    updateData
                );

                expect(result).toMatchObject({
                    id: 'proj-123',
                    __ID: 'proj-123'
                });
            });

            it('should validate required parameters', async () => {
                dataService.dataService.put.mockResolvedValue({ data: {} });

                await projectsApi.updateProject('proj-123', { name: 'Test' });

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { projectId: 'proj-123', data: { name: 'Test' } },
                    ['projectId', 'data']
                );
            });
        });
    });

    describe('updateProjectStatus', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should update project status', async () => {
                const mockResponse = {
                    id: 'proj-123',
                    status: 'completed'
                };

                dataService.dataService.patch.mockResolvedValue({
                    data: mockResponse
                });

                await projectsApi.updateProjectStatus('proj-123', 'completed');

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/projects/proj-123/status',
                    { status: 'completed' }
                );
            });

            it('should validate required parameters', async () => {
                dataService.dataService.patch.mockResolvedValue({ data: {} });

                await projectsApi.updateProjectStatus('proj-123', 'active');

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { projectId: 'proj-123', status: 'active' },
                    ['projectId', 'status']
                );
            });
        });
    });

    describe('deleteProject', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should delete a project', async () => {
                const mockResponse = { success: true };

                dataService.dataService.delete.mockResolvedValue({
                    data: mockResponse
                });

                const result = await projectsApi.deleteProject('proj-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/projects/proj-123'
                );

                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('Objectives API', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch objectives for a project', async () => {
                const mockObjectives = [
                    {
                        id: 'obj-1',
                        title: 'Objective 1',
                        project_id: 'proj-123',
                        is_completed: false
                    }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockObjectives
                });

                await projectsApi.fetchProjectObjectives('proj-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/objectives/project/proj-123'
                );
            });

            it('should create an objective', async () => {
                const newObjective = {
                    title: 'New Objective',
                    project_id: 'proj-123',
                    description: 'Test objective'
                };

                const mockResponse = {
                    id: 'obj-new',
                    ...newObjective
                };

                dataService.dataService.post.mockResolvedValue({
                    data: mockResponse
                });

                await projectsApi.createObjective(newObjective);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/objectives',
                    newObjective
                );
            });

            it('should update an objective', async () => {
                const updateData = { title: 'Updated Objective' };

                dataService.dataService.patch.mockResolvedValue({
                    data: { id: 'obj-123', ...updateData }
                });

                await projectsApi.updateObjective('obj-123', updateData);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/objectives/obj-123',
                    updateData
                );
            });

            it('should delete an objective', async () => {
                dataService.dataService.delete.mockResolvedValue({
                    data: { success: true }
                });

                await projectsApi.deleteObjective('obj-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/objectives/obj-123'
                );
            });

            it('should toggle objective completion', async () => {
                dataService.dataService.patch.mockResolvedValue({
                    data: { id: 'obj-123', is_completed: true }
                });

                await projectsApi.toggleObjectiveCompleted('obj-123');

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/objectives/obj-123/completed'
                );
            });

            it('should reorder objectives', async () => {
                const reorderData = [
                    { id: 'obj-1', order_index: 0 },
                    { id: 'obj-2', order_index: 1 }
                ];

                dataService.dataService.post.mockResolvedValue({
                    data: { success: true }
                });

                await projectsApi.reorderObjectives('proj-123', reorderData);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/objectives/projects/proj-123/reorder',
                    reorderData
                );
            });
        });
    });

    describe('Steps API', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should create a step', async () => {
                const newStep = {
                    title: 'New Step',
                    objective_id: 'obj-123'
                };

                dataService.dataService.post.mockResolvedValue({
                    data: { id: 'step-new', ...newStep }
                });

                await projectsApi.createStep(newStep);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/steps',
                    newStep
                );
            });

            it('should update a step', async () => {
                const updateData = { title: 'Updated Step' };

                dataService.dataService.patch.mockResolvedValue({
                    data: { id: 'step-123', ...updateData }
                });

                await projectsApi.updateStep('step-123', updateData);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/steps/step-123',
                    updateData
                );
            });

            it('should delete a step', async () => {
                dataService.dataService.delete.mockResolvedValue({
                    data: { success: true }
                });

                await projectsApi.deleteStep('step-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/steps/step-123'
                );
            });

            it('should toggle step completion', async () => {
                dataService.dataService.patch.mockResolvedValue({
                    data: { id: 'step-123', is_completed: true }
                });

                await projectsApi.toggleStepCompleted('step-123');

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/steps/step-123/completed'
                );
            });
        });
    });

    describe('Images API', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch project images', async () => {
                const mockImages = [
                    { id: 'img-1', url: 'https://example.com/image1.jpg' }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockImages
                });

                await projectsApi.fetchProjectImages('proj-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/projects/proj-123/images'
                );
            });

            it('should create a project image', async () => {
                const newImage = {
                    url: 'https://example.com/new-image.jpg',
                    description: 'Test image'
                };

                dataService.dataService.post.mockResolvedValue({
                    data: { id: 'img-new', ...newImage }
                });

                await projectsApi.createProjectImage('proj-123', newImage);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/projects/proj-123/images',
                    newImage
                );
            });

            it('should delete a project image', async () => {
                dataService.dataService.delete.mockResolvedValue({
                    data: { success: true }
                });

                await projectsApi.deleteProjectImage('img-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/projects/images/img-123'
                );
            });
        });
    });

    describe('Notes API', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch project notes', async () => {
                const mockNotes = [
                    { id: 'note-1', content: 'Test note' }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockNotes
                });

                await projectsApi.fetchProjectNotes('proj-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/projects/proj-123/notes'
                );
            });

            it('should create a project note', async () => {
                const newNote = {
                    content: 'New note content'
                };

                dataService.dataService.post.mockResolvedValue({
                    data: { id: 'note-new', ...newNote }
                });

                await projectsApi.createProjectNote('proj-123', newNote);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/projects/proj-123/notes',
                    newNote
                );
            });

            it('should update a project note', async () => {
                const updateData = { content: 'Updated note' };

                dataService.dataService.patch.mockResolvedValue({
                    data: { id: 'note-123', ...updateData }
                });

                await projectsApi.updateProjectNote('note-123', updateData);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/projects/notes/note-123',
                    updateData
                );
            });

            it('should delete a project note', async () => {
                dataService.dataService.delete.mockResolvedValue({
                    data: { success: true }
                });

                await projectsApi.deleteProjectNote('note-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/projects/notes/note-123'
                );
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });
        });

        it('should handle 404 not found error', async () => {
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { message: 'Project not found' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                projectsApi.fetchProjectById('nonexistent')
            ).rejects.toThrow();
        });

        it('should handle 401 authentication error', async () => {
            const error = new Error('Unauthorized');
            error.response = {
                status: 401,
                data: { message: 'Authentication token expired' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                projectsApi.fetchProjectsForCustomer('cust-123')
            ).rejects.toThrow();
        });

        it('should handle 403 permission denied error', async () => {
            const error = new Error('Forbidden');
            error.response = {
                status: 403,
                data: { message: 'Permission denied' }
            };

            dataService.dataService.put.mockRejectedValue(error);

            await expect(
                projectsApi.updateProject('proj-123', { name: 'Test' })
            ).rejects.toThrow();
        });

        it('should handle 400 validation error', async () => {
            const error = new Error('Bad request');
            error.response = {
                status: 400,
                data: {
                    message: 'Validation error',
                    errors: ['Project name is required']
                }
            };

            dataService.dataService.post.mockRejectedValue(error);

            await expect(
                projectsApi.createProject({})
            ).rejects.toThrow();
        });

        it('should handle network timeout error', async () => {
            const error = new Error('timeout of 10000ms exceeded');
            error.code = 'ECONNABORTED';

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                projectsApi.fetchProjectsForCustomer('cust-123')
            ).rejects.toThrow();
        });

        it('should handle 500 server error', async () => {
            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { message: 'Internal server error' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                projectsApi.fetchProjectsForCustomer('cust-123')
            ).rejects.toThrow();
        });
    });

    describe('Data Normalization', () => {
        beforeEach(() => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });
        });

        it('should normalize single project data', async () => {
            const mockProject = {
                id: 'proj-123',
                name: 'Test Project',
                customer_id: 'cust-123'
            };

            dataService.dataService.get.mockResolvedValue({
                data: mockProject
            });

            const result = await projectsApi.fetchProjectById('proj-123');

            expect(result).toMatchObject({
                id: 'proj-123',
                __ID: 'proj-123'
            });
        });

        it('should normalize array of projects', async () => {
            const mockProjects = [
                { id: '1', name: 'Project 1' },
                { id: '2', name: 'Project 2' }
            ];

            dataService.dataService.get.mockResolvedValue({
                data: mockProjects
            });

            const result = await projectsApi.fetchProjectsForCustomer('cust-123');

            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: '1', __ID: '1' }),
                    expect.objectContaining({ id: '2', __ID: '2' })
                ])
            );
        });
    });
});
