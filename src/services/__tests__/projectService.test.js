/**
 * Project Service Tests
 *
 * Tests for core project service functions that are used throughout the application
 */

import {
    processProjectData,
    mapBackendStatusToFrontend,
    mapFrontendStatusToBackend,
    formatProjectForBackend,
    validateProjectData,
    calculateProjectCompletion,
    groupProjectsByStatus
} from '../projectService';

describe('Project Service', () => {
    describe('Status Mapping', () => {
        describe('mapBackendStatusToFrontend', () => {
            it('should map backend status to frontend status', () => {
                expect(mapBackendStatusToFrontend('active')).toBe('Open');
                expect(mapBackendStatusToFrontend('pending')).toBe('Open');
                expect(mapBackendStatusToFrontend('on_hold')).toBe('On Hold');
                expect(mapBackendStatusToFrontend('completed')).toBe('Closed');
                expect(mapBackendStatusToFrontend('cancelled')).toBe('Cancelled');
            });

            it('should handle unknown status gracefully', () => {
                expect(mapBackendStatusToFrontend('unknown')).toBe('Open');
                expect(mapBackendStatusToFrontend(null)).toBe('Open');
                expect(mapBackendStatusToFrontend(undefined)).toBe('Open');
            });
        });

        describe('mapFrontendStatusToBackend', () => {
            it('should map frontend status to backend status', () => {
                expect(mapFrontendStatusToBackend('Open')).toBe('active');
                expect(mapFrontendStatusToBackend('On Hold')).toBe('on_hold');
                expect(mapFrontendStatusToBackend('Closed')).toBe('completed');
                expect(mapFrontendStatusToBackend('Cancelled')).toBe('cancelled');
            });

            it('should handle unknown status gracefully', () => {
                expect(mapFrontendStatusToBackend('unknown')).toBe('active');
                expect(mapFrontendStatusToBackend(null)).toBe('active');
                expect(mapFrontendStatusToBackend(undefined)).toBe('active');
            });
        });
    });

    describe('formatProjectForBackend', () => {
        it('should format frontend project data for backend', () => {
            const frontendData = {
                projectName: 'Test Project',
                _custID: 'cust-123',
                _teamID: 'team-456',
                value: 5000,
                status: 'Open',
                isFixedPrice: true,
                isSubscription: false,
                dateStart: '2024-01-01',
                dateEnd: '2024-12-31',
                description: 'Test description',
                estOfTime: '40 hours'
            };

            const result = formatProjectForBackend(frontendData);

            expect(result).toMatchObject({
                name: 'Test Project',
                customer_id: 'cust-123',
                team_id: 'team-456',
                budget: 5000,
                status: 'active',
                is_fixed_price: true,
                is_subscription: false,
                start_date: '2024-01-01',
                target_end_date: '2024-12-31',
                description: 'Test description',
                time_estimate: '40 hours'
            });
        });

        it('should handle minimal project data', () => {
            const frontendData = {
                projectName: 'Minimal Project',
                _custID: 'cust-123'
            };

            const result = formatProjectForBackend(frontendData);

            expect(result).toMatchObject({
                name: 'Minimal Project',
                customer_id: 'cust-123',
                status: 'active'
            });
            expect(result.description).toBe('');
            expect(result.budget).toBe(null);
        });

        it('should handle null values correctly', () => {
            const frontendData = {
                projectName: 'Test Project',
                _custID: 'cust-123',
                _teamID: null,
                value: null
            };

            const result = formatProjectForBackend(frontendData);

            expect(result.name).toBe('Test Project');
            expect(result.customer_id).toBe('cust-123');
            expect(result).not.toHaveProperty('team_id');
            expect(result.budget).toBe(null);
        });

        it('should map boolean flags correctly', () => {
            const frontendData = {
                projectName: 'Test',
                _custID: 'cust-123',
                isFixedPrice: '1', // String '1'
                isSubscription: false
            };

            const result = formatProjectForBackend(frontendData);

            expect(result.is_fixed_price).toBe(true);
            expect(result.is_subscription).toBe(false);
        });
    });

    describe('processProjectData', () => {
        it('should handle backend project data', () => {
            const backendData = [
                {
                    id: 'proj-1',
                    name: 'Test Project',
                    customer_id: 'cust-123',
                    budget: 5000,
                    status: 'active',
                    is_fixed_price: true,
                    is_subscription: false,
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];

            const result = processProjectData(backendData, {}, 'backend');

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'proj-1',
                __ID: 'proj-1',
                projectName: 'Test Project',
                _custID: 'cust-123',
                value: 5000,
                status: 'Open', // Mapped from 'active'
                f_fixedPrice: true,
                f_subscription: false,
                isActive: true
            });
        });

        it('should handle FileMaker project data', () => {
            const fileMakerData = {
                response: {
                    data: [
                        {
                            recordId: '123',
                            fieldData: {
                                __ID: 'proj-1',
                                projectName: 'Test Project',
                                _custID: 'cust-123',
                                value: '5000',
                                status: 'Open',
                                f_fixedPrice: '1',
                                f_subscription: '0'
                            }
                        }
                    ]
                }
            };

            const result = processProjectData(fileMakerData, {}, 'filemaker');

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'proj-1',
                recordId: '123',
                projectName: 'Test Project',
                _custID: 'cust-123',
                value: 5000,
                status: 'Open',
                f_fixedPrice: true,
                f_subscription: false,
                isActive: true
            });
        });

        it('should handle empty backend data', () => {
            const result = processProjectData([], {}, 'backend');
            expect(result).toEqual([]);
        });

        it('should handle empty FileMaker data', () => {
            const result = processProjectData({ response: { data: [] } }, {}, 'filemaker');
            expect(result).toEqual([]);
        });

        it('should handle backend data wrapped in data property', () => {
            const backendData = {
                data: [
                    {
                        id: 'proj-1',
                        name: 'Test Project',
                        customer_id: 'cust-123',
                        status: 'active'
                    }
                ]
            };

            const result = processProjectData(backendData, {}, 'backend');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('proj-1');
        });
    });

    describe('validateProjectData', () => {
        it('should return errors for missing required fields', () => {
            const invalidData = {};
            const result = validateProjectData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors).toContain('Project name is required');
            expect(result.errors).toContain('Customer ID is required');
        });

        it('should return no errors for valid basic data', () => {
            const validData = {
                projectName: 'Valid Project',
                _custID: 'cust-123'
            };

            const result = validateProjectData(validData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate fixed price projects require positive value', () => {
            const invalidData = {
                projectName: 'Test',
                _custID: 'cust-123',
                f_fixedPrice: '1',
                value: 0
            };

            const result = validateProjectData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Value is required for fixed price projects and must be a positive number');
        });

        it('should validate subscription projects require start date', () => {
            const invalidData = {
                projectName: 'Test',
                _custID: 'cust-123',
                f_subscription: '1',
                value: 500
                // Missing dateStart
            };

            const result = validateProjectData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Start date is required for subscription projects');
        });
    });

    describe('calculateProjectCompletion', () => {
        it('should calculate completion percentage from steps', () => {
            const project = {
                objectives: [
                    {
                        id: '1',
                        steps: [
                            { id: 's1', completed: true },
                            { id: 's2', completed: false }
                        ]
                    },
                    {
                        id: '2',
                        steps: [
                            { id: 's3', completed: true },
                            { id: 's4', completed: true }
                        ]
                    }
                ]
            };

            const completion = calculateProjectCompletion(project);

            expect(completion).toBe(75); // 3 out of 4 steps completed
        });

        it('should return 0 for project with no objectives', () => {
            const project = { objectives: [] };
            const completion = calculateProjectCompletion(project);

            expect(completion).toBe(0);
        });

        it('should return 0 for project with objectives but no steps', () => {
            const project = {
                objectives: [
                    { id: '1', steps: [] },
                    { id: '2', steps: [] }
                ]
            };

            const completion = calculateProjectCompletion(project);

            expect(completion).toBe(0);
        });

        it('should return 100 for fully completed project', () => {
            const project = {
                objectives: [
                    {
                        id: '1',
                        steps: [
                            { id: 's1', completed: true },
                            { id: 's2', completed: true }
                        ]
                    }
                ]
            };

            const completion = calculateProjectCompletion(project);

            expect(completion).toBe(100);
        });
    });

    describe('groupProjectsByStatus', () => {
        it('should group projects into open and closed', () => {
            const projects = [
                { id: '1', status: 'Open', projectName: 'Project 1' },
                { id: '2', status: 'Open', projectName: 'Project 2' },
                { id: '3', status: 'Closed', projectName: 'Project 3' },
                { id: '4', status: 'On Hold', projectName: 'Project 4' } // Treated as closed
            ];

            const grouped = groupProjectsByStatus(projects);

            expect(grouped).toHaveProperty('open');
            expect(grouped).toHaveProperty('closed');
            expect(grouped.open).toHaveLength(2);
            expect(grouped.closed).toHaveLength(2); // Closed and On Hold both go to closed
        });

        it('should handle empty project array', () => {
            const grouped = groupProjectsByStatus([]);

            expect(grouped).toEqual({ open: [], closed: [] });
        });
    });
});
