/**
 * Task Service Unit Tests
 *
 * Tests for src/services/taskService.js covering:
 * - Timer idempotency
 * - Concurrency control
 * - Financial record generation
 * - Pause/resume calculations
 * - Adjustment validations
 * - Timer operations with error handling
 * - Task data validation
 */

import * as taskService from '../taskService';
import * as tasksApi from '../../api/tasks';
import * as financialRecordsApi from '../../api/financialRecords';
import * as salesService from '../salesService';

// Mock the API modules
jest.mock('../../api/tasks');
jest.mock('../../api/financialRecords');
jest.mock('../salesService');

// Mock fileMaker module to avoid import.meta issues
jest.mock('../../api/fileMaker', () => ({
    fetchDataFromFileMaker: jest.fn(),
    handleFileMakerOperation: jest.fn((fn) => fn()),
    validateParams: jest.fn(),
    generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-signature.1234567890'),
    Layouts: {
        TASKS: 'devTasks',
        PROJECTS: 'devProjects',
        RECORDS: 'devRecords',
        NOTES: 'devNotes',
        LINKS: 'devLinks'
    },
    Actions: {
        READ: 'READ',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE'
    }
}));

// Mock config
jest.mock('../../config', () => ({
    backendConfig: {
        baseUrl: 'https://api.claritybusinesssolutions.ca'
    }
}));

// Mock supabaseService to avoid import.meta issues
jest.mock('../supabaseService', () => ({
    query: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getClient: jest.fn()
}));

describe('Task Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset console mocks
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Timer Idempotency', () => {
        describe('startTimer', () => {
            it('should check for active timer before starting new one', async () => {
                const task = {
                    id: 'task-1',
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };

                tasksApi.getActiveTimer.mockResolvedValue(null);
                tasksApi.startTaskTimer.mockResolvedValue({ id: 'timer-1', status: 'active' });

                await taskService.startTimer(task);

                expect(tasksApi.getActiveTimer).toHaveBeenCalledWith('staff-1');
                expect(tasksApi.startTaskTimer).toHaveBeenCalledWith('task-1', task);
            });

            it('should throw error if staff already has active timer', async () => {
                const task = {
                    id: 'task-1',
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };

                const existingTimer = {
                    id: 'existing-timer',
                    task_id: 'task-2',
                    status: 'active'
                };

                tasksApi.getActiveTimer.mockResolvedValue(existingTimer);

                await expect(taskService.startTimer(task)).rejects.toThrow(
                    'You already have an active timer running'
                );

                expect(tasksApi.startTaskTimer).not.toHaveBeenCalled();
            });

            it('should handle backend 409 conflict error', async () => {
                const task = {
                    id: 'task-1',
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };

                tasksApi.getActiveTimer.mockResolvedValue(null);
                const error = new Error('Staff already has an active timer');
                error.response = { status: 409 };
                tasksApi.startTaskTimer.mockRejectedValue(error);

                await expect(taskService.startTimer(task)).rejects.toThrow(
                    'You already have an active timer running'
                );
            });

            it('should validate required task fields', async () => {
                await expect(taskService.startTimer(null)).rejects.toThrow('Invalid task for timer');
                await expect(taskService.startTimer({})).rejects.toThrow('Invalid task for timer');
            });

            it('should validate staff ID is present', async () => {
                const task = {
                    id: 'task-1',
                    _projectID: 'proj-1'
                };

                await expect(taskService.startTimer(task)).rejects.toThrow(
                    'Staff ID is required to start timer'
                );
            });

            it('should use provided staffId parameter over task fields', async () => {
                const task = {
                    id: 'task-1',
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };

                tasksApi.getActiveTimer.mockResolvedValue(null);
                tasksApi.startTaskTimer.mockResolvedValue({ id: 'timer-1' });

                await taskService.startTimer(task, 'staff-2');

                expect(tasksApi.getActiveTimer).toHaveBeenCalledWith('staff-2');
            });
        });
    });

    describe('Concurrency Control', () => {
        describe('getActiveTimer', () => {
            it('should fetch active timer for staff member', async () => {
                const mockTimer = {
                    id: 'timer-1',
                    staff_id: 'staff-1',
                    status: 'active'
                };

                tasksApi.getActiveTimer.mockResolvedValue(mockTimer);

                const result = await taskService.getActiveTimer('staff-1');

                expect(result).toEqual(mockTimer);
                expect(tasksApi.getActiveTimer).toHaveBeenCalledWith('staff-1');
            });

            it('should return null if no active timer found', async () => {
                tasksApi.getActiveTimer.mockResolvedValue(null);

                const result = await taskService.getActiveTimer('staff-1');

                expect(result).toBeNull();
            });

            it('should return null on error', async () => {
                tasksApi.getActiveTimer.mockRejectedValue(new Error('Not found'));

                const result = await taskService.getActiveTimer('staff-1');

                expect(result).toBeNull();
            });

            it('should handle optional staffId parameter', async () => {
                tasksApi.getActiveTimer.mockResolvedValue(null);

                await taskService.getActiveTimer();

                expect(tasksApi.getActiveTimer).toHaveBeenCalledWith(null);
            });
        });

        describe('Multiple timer prevention', () => {
            it('should prevent starting timer when one is already active', async () => {
                const task = {
                    id: 'task-1',
                    _staffID: 'staff-1',
                    _projectID: 'proj-1'
                };

                const activeTimer = {
                    id: 'existing-timer',
                    status: 'active'
                };

                tasksApi.getActiveTimer.mockResolvedValue(activeTimer);

                await expect(taskService.startTimer(task)).rejects.toThrow(
                    'You already have an active timer running'
                );
            });
        });
    });

    describe('Financial Record Generation', () => {
        describe('stopTimer with financial record creation', () => {
            it('should return financial record when created by backend', async () => {
                const mockResponse = {
                    time_entry: {
                        id: 'timer-1',
                        status: 'completed',
                        duration_minutes: 150,
                        is_billable: true
                    },
                    financial_record: {
                        id: 'fin-1',
                        amount: 250.00,
                        hours: 2.5,
                        rate: 100.00,
                        is_billable: true
                    }
                };

                tasksApi.stopTaskTimer.mockResolvedValue(mockResponse);

                const result = await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Completed work',
                    saveImmediately: false,
                    totalPauseTime: 0,
                    adjustment: 0
                });

                expect(result).toEqual(mockResponse);
                expect(result.financial_record).toBeDefined();
                expect(result.financial_record.amount).toBe(250.00);
            });

            it('should not create financial record for fixed-price projects', async () => {
                const mockResponse = {
                    time_entry: {
                        id: 'timer-1',
                        status: 'completed',
                        duration_minutes: 150,
                        is_billable: false
                    },
                    financial_record: null
                };

                tasksApi.stopTaskTimer.mockResolvedValue(mockResponse);

                const result = await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Completed work',
                    saveImmediately: false,
                    totalPauseTime: 0,
                    adjustment: 0
                });

                expect(result.financial_record).toBeNull();
            });

            it('should handle FileMaker legacy response with sales sync', async () => {
                const mockFileMakerResponse = {
                    response: {
                        data: [{
                            recordId: 'timer-1',
                            fieldData: {
                                endTime: '12:30:00 PM'
                            }
                        }]
                    }
                };

                const mockFinancialRecord = {
                    response: {
                        data: [{
                            fieldData: {
                                __ID: 'fin-1',
                                'customers_Projects::f_fixedPrice': '0'
                            }
                        }]
                    }
                };

                // Set organization ID in global state
                global.window = { state: { user: { supabaseOrgID: 'org-123' } } };

                tasksApi.stopTaskTimer.mockResolvedValue(mockFileMakerResponse);
                financialRecordsApi.fetchFinancialRecordByRecordId.mockResolvedValue(mockFinancialRecord);
                salesService.createSaleFromFinancialRecord.mockResolvedValue({ id: 'sale-1' });

                const result = await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done'
                }, 'org-123');

                expect(salesService.createSaleFromFinancialRecord).toHaveBeenCalledWith('fin-1', 'org-123');
            });

            it('should skip sales sync for fixed-price in FileMaker mode', async () => {
                const mockFileMakerResponse = {
                    response: {
                        data: [{
                            recordId: 'timer-1',
                            fieldData: {}
                        }]
                    }
                };

                const mockFinancialRecord = {
                    response: {
                        data: [{
                            fieldData: {
                                __ID: 'fin-1',
                                'customers_Projects::f_fixedPrice': '1000' // Fixed price > 0
                            }
                        }]
                    }
                };

                global.window = { state: { user: { supabaseOrgID: 'org-123' } } };

                tasksApi.stopTaskTimer.mockResolvedValue(mockFileMakerResponse);
                financialRecordsApi.fetchFinancialRecordByRecordId.mockResolvedValue(mockFinancialRecord);

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done'
                }, 'org-123');

                expect(salesService.createSaleFromFinancialRecord).not.toHaveBeenCalled();
            });
        });

        describe('extractFinancialRecord', () => {
            it('should extract financial record from backend response', () => {
                const response = {
                    time_entry: { id: 'timer-1' },
                    financial_record: {
                        id: 'fin-1',
                        amount: 250.00,
                        hours: 2.5
                    }
                };

                const result = taskService.extractFinancialRecord(response);

                expect(result).toEqual(response.financial_record);
            });

            it('should return null when no financial record present', () => {
                const response = {
                    time_entry: { id: 'timer-1' },
                    financial_record: null
                };

                const result = taskService.extractFinancialRecord(response);

                expect(result).toBeNull();
            });

            it('should return null for invalid response', () => {
                expect(taskService.extractFinancialRecord(null)).toBeNull();
                expect(taskService.extractFinancialRecord({})).toBeNull();
            });
        });

        describe('formatFinancialRecordForDisplay', () => {
            it('should format financial record for display', () => {
                const financialRecord = {
                    id: 'fin-1',
                    amount: 250.5,
                    hours: 2.5,
                    rate: 100.2,
                    date: '2026-01-15',
                    description: 'Development work',
                    status: 'unbilled',
                    is_billable: true
                };

                const result = taskService.formatFinancialRecordForDisplay(financialRecord);

                expect(result).toEqual({
                    id: 'fin-1',
                    amount: '250.50',
                    hours: '2.50',
                    rate: '100.20',
                    date: '2026-01-15',
                    description: 'Development work',
                    status: 'unbilled',
                    isBillable: true
                });
            });

            it('should return null for invalid input', () => {
                expect(taskService.formatFinancialRecordForDisplay(null)).toBeNull();
            });

            it('should handle missing optional fields', () => {
                const financialRecord = {
                    id: 'fin-1'
                };

                const result = taskService.formatFinancialRecordForDisplay(financialRecord);

                expect(result.amount).toBe('0.00');
                expect(result.hours).toBe('0.00');
                expect(result.rate).toBe('0.00');
            });
        });
    });

    describe('Pause/Resume Calculations', () => {
        describe('pauseTimer', () => {
            it('should pause an active timer', async () => {
                const mockResponse = {
                    id: 'timer-1',
                    status: 'paused',
                    pause_time: '2026-01-15T10:30:00Z'
                };

                tasksApi.pauseTimer.mockResolvedValue(mockResponse);

                const result = await taskService.pauseTimer('timer-1');

                expect(result).toEqual(mockResponse);
                expect(tasksApi.pauseTimer).toHaveBeenCalledWith('timer-1');
            });

            it('should throw error for missing entryId', async () => {
                await expect(taskService.pauseTimer(null)).rejects.toThrow(
                    'Timer entry ID is required'
                );
                await expect(taskService.pauseTimer('')).rejects.toThrow(
                    'Timer entry ID is required'
                );
            });

            it('should provide user-friendly error for non-active timer', async () => {
                const error = new Error('Timer must be active to pause');
                tasksApi.pauseTimer.mockRejectedValue(error);

                await expect(taskService.pauseTimer('timer-1')).rejects.toThrow(
                    'Timer must be active to pause'
                );
            });

            it('should handle FileMaker unsupported error', async () => {
                const error = new Error('Pause/resume not supported in FileMaker mode');
                tasksApi.pauseTimer.mockRejectedValue(error);

                await expect(taskService.pauseTimer('timer-1')).rejects.toThrow(
                    'Pause/resume is only available in the web version'
                );
            });
        });

        describe('resumeTimer', () => {
            it('should resume a paused timer', async () => {
                const mockResponse = {
                    id: 'timer-1',
                    status: 'active',
                    resume_time: '2026-01-15T10:35:00Z',
                    pause_duration_seconds: 300
                };

                tasksApi.resumeTimer.mockResolvedValue(mockResponse);

                const result = await taskService.resumeTimer('timer-1');

                expect(result).toEqual(mockResponse);
                expect(tasksApi.resumeTimer).toHaveBeenCalledWith('timer-1');
            });

            it('should throw error for missing entryId', async () => {
                await expect(taskService.resumeTimer(null)).rejects.toThrow(
                    'Timer entry ID is required'
                );
            });

            it('should provide user-friendly error for non-paused timer', async () => {
                const error = new Error('Timer must be paused to resume');
                tasksApi.resumeTimer.mockRejectedValue(error);

                await expect(taskService.resumeTimer('timer-1')).rejects.toThrow(
                    'Timer must be paused to resume'
                );
            });
        });

        describe('calculateTimerStats', () => {
            it('should calculate timer statistics including pause time', () => {
                const timeEntry = {
                    start_time: '2026-01-15T10:00:00Z',
                    end_time: '2026-01-15T12:30:00Z',
                    pause_duration_seconds: 600, // 10 minutes
                    adjustment_seconds: 360, // 6 minutes
                    duration_minutes: 140
                };

                const result = taskService.calculateTimerStats(timeEntry);

                expect(result.totalSeconds).toBe(9000); // 2.5 hours
                expect(result.pauseSeconds).toBe(600);
                expect(result.adjustmentSeconds).toBe(360);
                expect(result.billableSeconds).toBe(8760); // 9000 - 600 + 360
                expect(result.billableMinutes).toBe(146);
                expect(result.billableHours).toBe('2.43');
            });

            it('should handle missing pause and adjustment', () => {
                const timeEntry = {
                    start_time: '2026-01-15T10:00:00Z',
                    end_time: '2026-01-15T12:00:00Z'
                };

                const result = taskService.calculateTimerStats(timeEntry);

                expect(result.pauseSeconds).toBe(0);
                expect(result.adjustmentSeconds).toBe(0);
                expect(result.totalSeconds).toBe(7200); // 2 hours
                expect(result.billableSeconds).toBe(7200);
            });

            it('should return zero stats for null timeEntry', () => {
                const result = taskService.calculateTimerStats(null);

                expect(result.totalSeconds).toBe(0);
                expect(result.pauseSeconds).toBe(0);
                expect(result.adjustmentSeconds).toBe(0);
                expect(result.billableSeconds).toBe(0);
                expect(result.billableMinutes).toBe(0);
                // When timeEntry is null, billableHours is 0 / 60 = 0 (number, not string)
                expect(result.billableHours).toBe(0);
            });

            it('should handle negative adjustment correctly', () => {
                const timeEntry = {
                    start_time: '2026-01-15T10:00:00Z',
                    end_time: '2026-01-15T12:00:00Z',
                    pause_duration_seconds: 0,
                    adjustment_seconds: -360 // -6 minutes
                };

                const result = taskService.calculateTimerStats(timeEntry);

                expect(result.billableSeconds).toBe(6840); // 7200 - 360
            });

            it('should not allow negative billable time', () => {
                const timeEntry = {
                    start_time: '2026-01-15T10:00:00Z',
                    end_time: '2026-01-15T10:05:00Z',
                    pause_duration_seconds: 600, // More pause than total time
                    adjustment_seconds: 0
                };

                const result = taskService.calculateTimerStats(timeEntry);

                expect(result.billableSeconds).toBe(0); // Max ensures >= 0
            });
        });

        describe('stopTimer with pause adjustment', () => {
            it('should include pause time in adjustment', async () => {
                const mockResponse = {
                    time_entry: {
                        id: 'timer-1',
                        status: 'completed',
                        duration_minutes: 120,
                        pause_duration_seconds: 600
                    }
                };

                tasksApi.stopTaskTimer.mockResolvedValue(mockResponse);

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    saveImmediately: false,
                    totalPauseTime: 600,
                    adjustment: 360
                });

                // Should combine pause time (600) + adjustment (360) = 960
                expect(tasksApi.stopTaskTimer).toHaveBeenCalledWith(
                    'timer-1',
                    'Work done',
                    false,
                    960
                );
            });

            it('should handle zero pause time', async () => {
                tasksApi.stopTaskTimer.mockResolvedValue({
                    time_entry: { id: 'timer-1' }
                });

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    saveImmediately: false,
                    totalPauseTime: 0,
                    adjustment: 0
                });

                expect(tasksApi.stopTaskTimer).toHaveBeenCalledWith(
                    'timer-1',
                    'Work done',
                    false,
                    0
                );
            });
        });
    });

    describe('Adjustment Validations', () => {
        describe('isValidTimerAdjustment (minutes)', () => {
            it('should validate 6-minute increments', () => {
                expect(taskService.isValidTimerAdjustment(0)).toBe(true);
                expect(taskService.isValidTimerAdjustment(6)).toBe(true);
                expect(taskService.isValidTimerAdjustment(12)).toBe(true);
                expect(taskService.isValidTimerAdjustment(18)).toBe(true);
                expect(taskService.isValidTimerAdjustment(60)).toBe(true);
            });

            it('should reject non-6-minute increments', () => {
                expect(taskService.isValidTimerAdjustment(1)).toBe(false);
                expect(taskService.isValidTimerAdjustment(5)).toBe(false);
                expect(taskService.isValidTimerAdjustment(7)).toBe(false);
                expect(taskService.isValidTimerAdjustment(10)).toBe(false);
                expect(taskService.isValidTimerAdjustment(15)).toBe(false);
            });

            it('should handle negative values', () => {
                expect(taskService.isValidTimerAdjustment(-6)).toBe(true);
                expect(taskService.isValidTimerAdjustment(-12)).toBe(true);
                expect(taskService.isValidTimerAdjustment(-5)).toBe(false);
            });
        });

        describe('isValidTimerAdjustmentSeconds', () => {
            it('should validate 360-second (6-minute) increments', () => {
                expect(taskService.isValidTimerAdjustmentSeconds(0)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(360)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(720)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(1080)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(3600)).toBe(true);
            });

            it('should reject non-360-second increments', () => {
                expect(taskService.isValidTimerAdjustmentSeconds(60)).toBe(false);
                expect(taskService.isValidTimerAdjustmentSeconds(300)).toBe(false);
                expect(taskService.isValidTimerAdjustmentSeconds(400)).toBe(false);
                expect(taskService.isValidTimerAdjustmentSeconds(900)).toBe(false);
            });

            it('should handle negative values', () => {
                expect(taskService.isValidTimerAdjustmentSeconds(-360)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(-720)).toBe(true);
                expect(taskService.isValidTimerAdjustmentSeconds(-300)).toBe(false);
            });
        });

        describe('roundToValidAdjustment (minutes)', () => {
            it('should round to nearest 6-minute increment', () => {
                expect(taskService.roundToValidAdjustment(0)).toBe(0);
                expect(taskService.roundToValidAdjustment(3)).toBe(6);
                expect(taskService.roundToValidAdjustment(5)).toBe(6);
                expect(taskService.roundToValidAdjustment(7)).toBe(6);
                expect(taskService.roundToValidAdjustment(9)).toBe(12);
                expect(taskService.roundToValidAdjustment(15)).toBe(18);
            });

            it('should handle negative values', () => {
                // Math.round(-3/6) * 6 = Math.round(-0.5) * 6 = 0 * 6 = -0 (but JS treats -0 === 0)
                expect(Math.abs(taskService.roundToValidAdjustment(-3))).toBe(0);
                // Math.round(-5/6) * 6 = Math.round(-0.833) * 6 = -1 * 6 = -6
                expect(taskService.roundToValidAdjustment(-5)).toBe(-6);
                // Math.round(-9/6) * 6 = Math.round(-1.5) * 6 = -1 * 6 = -6 (NOT -12)
                expect(taskService.roundToValidAdjustment(-9)).toBe(-6);
            });

            it('should not change already valid values', () => {
                expect(taskService.roundToValidAdjustment(6)).toBe(6);
                expect(taskService.roundToValidAdjustment(12)).toBe(12);
                expect(taskService.roundToValidAdjustment(60)).toBe(60);
            });
        });

        describe('roundToValidAdjustmentSeconds', () => {
            it('should round to nearest 360-second increment', () => {
                expect(taskService.roundToValidAdjustmentSeconds(0)).toBe(0);
                expect(taskService.roundToValidAdjustmentSeconds(180)).toBe(360);
                expect(taskService.roundToValidAdjustmentSeconds(300)).toBe(360);
                expect(taskService.roundToValidAdjustmentSeconds(420)).toBe(360);
                expect(taskService.roundToValidAdjustmentSeconds(540)).toBe(720);
                expect(taskService.roundToValidAdjustmentSeconds(900)).toBe(1080);
            });

            it('should handle negative values', () => {
                // Math.round(-180/360) * 360 = Math.round(-0.5) * 360 = 0 * 360 = -0 (but JS treats -0 === 0)
                expect(Math.abs(taskService.roundToValidAdjustmentSeconds(-180))).toBe(0);
                // Math.round(-300/360) * 360 = Math.round(-0.833) * 360 = -1 * 360 = -360
                expect(taskService.roundToValidAdjustmentSeconds(-300)).toBe(-360);
                // Math.round(-540/360) * 360 = Math.round(-1.5) * 360 = -1 * 360 = -360 (NOT -720)
                expect(taskService.roundToValidAdjustmentSeconds(-540)).toBe(-360);
            });

            it('should not change already valid values', () => {
                expect(taskService.roundToValidAdjustmentSeconds(360)).toBe(360);
                expect(taskService.roundToValidAdjustmentSeconds(720)).toBe(720);
                expect(taskService.roundToValidAdjustmentSeconds(3600)).toBe(3600);
            });
        });

        describe('stopTimer adjustment validation', () => {
            it('should reject invalid adjustment increments', async () => {
                await expect(taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    adjustment: 300 // 5 minutes - invalid
                })).rejects.toThrow('Time adjustment must be in 6-minute (0.1 hour) increments');

                expect(tasksApi.stopTaskTimer).not.toHaveBeenCalled();
            });

            it('should accept valid adjustment increments', async () => {
                tasksApi.stopTaskTimer.mockResolvedValue({
                    time_entry: { id: 'timer-1' }
                });

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    adjustment: 360 // 6 minutes - valid
                });

                expect(tasksApi.stopTaskTimer).toHaveBeenCalled();
            });

            it('should accept zero adjustment', async () => {
                tasksApi.stopTaskTimer.mockResolvedValue({
                    time_entry: { id: 'timer-1' }
                });

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    adjustment: 0
                });

                expect(tasksApi.stopTaskTimer).toHaveBeenCalled();
            });

            it('should validate negative adjustments', async () => {
                await expect(taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    adjustment: -300 // Invalid
                })).rejects.toThrow('Time adjustment must be in 6-minute (0.1 hour) increments');

                tasksApi.stopTaskTimer.mockResolvedValue({
                    time_entry: { id: 'timer-1' }
                });

                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done',
                    adjustment: -360 // Valid
                });

                expect(tasksApi.stopTaskTimer).toHaveBeenCalled();
            });
        });
    });

    describe('Timer Error Handling and Retry Logic', () => {
        describe('stopTimer retry mechanism', () => {
            it('should retry on failure up to 2 times', async () => {
                const error = new Error('Network error');
                tasksApi.stopTaskTimer
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error)
                    .mockResolvedValueOnce({ time_entry: { id: 'timer-1' } });

                const result = await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done'
                });

                expect(tasksApi.stopTaskTimer).toHaveBeenCalledTimes(3);
                expect(result.time_entry.id).toBe('timer-1');
            });

            it('should fail after max retries', async () => {
                const error = new Error('Network error');
                tasksApi.stopTaskTimer.mockRejectedValue(error);

                await expect(taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done'
                })).rejects.toThrow('Network error');

                expect(tasksApi.stopTaskTimer).toHaveBeenCalledTimes(3); // Initial + 2 retries
            });

            it('should use exponential backoff between retries', async () => {
                const error = new Error('Temporary error');
                tasksApi.stopTaskTimer
                    .mockRejectedValueOnce(error)
                    .mockResolvedValueOnce({ time_entry: { id: 'timer-1' } });

                const startTime = Date.now();
                await taskService.stopTimer({
                    recordId: 'timer-1',
                    description: 'Work done'
                });
                const duration = Date.now() - startTime;

                // Should have at least 1 second delay (first retry)
                expect(duration).toBeGreaterThanOrEqual(1000);
            });
        });

        describe('stopTimer validation', () => {
            it('should throw error for missing recordId', async () => {
                await expect(taskService.stopTimer({
                    description: 'Work done'
                })).rejects.toThrow('Invalid timer record');

                await expect(taskService.stopTimer({})).rejects.toThrow('Invalid timer record');
            });
        });
    });

    describe('Task Validation', () => {
        describe('validateTaskData', () => {
            it('should validate required fields for new task', () => {
                const invalidTask = {
                    project_id: 'proj-123'
                    // Missing title and customer_id
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('title is required');
                expect(result.errors).toContain('customer_id is required');
            });

            it('should validate field types', () => {
                const invalidTask = {
                    project_id: 'proj-123',
                    customer_id: 'cust-123',
                    title: 'Test Task',
                    priority: 'high' // Should be number
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.priority).toBeDefined();
            });

            it('should validate UUID format', () => {
                const invalidTask = {
                    project_id: 'invalid-uuid',
                    customer_id: 'cust-123',
                    title: 'Test Task'
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.project_id).toContain('valid UUID');
            });

            it('should validate priority range', () => {
                const invalidTask = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    priority: 10 // Out of range (1-5)
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.priority).toContain('between 1 and 5');
            });

            it('should validate status values', () => {
                const invalidTask = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    status: 'invalid_status'
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.status).toBeDefined();
            });

            it('should validate date format', () => {
                const invalidTask = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    due_date: '01/15/2026' // Wrong format
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.due_date).toContain('YYYY-MM-DD');
            });

            it('should validate estimated hours', () => {
                const invalidTask = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    estimated_hours: -5
                };

                const result = taskService.validateTaskData(invalidTask);

                expect(result.isValid).toBe(false);
                expect(result.fieldErrors.estimated_hours).toContain('positive');
            });

            it('should pass validation for valid task', () => {
                const validTask = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    staff_id: '123e4567-e89b-12d3-a456-426614174002',
                    task_type: 'Development',
                    notes: 'Some notes',
                    is_completed: false,
                    status: 'pending',
                    priority: 3,
                    estimated_hours: 5.5,
                    due_date: '2026-01-20'
                };

                const result = taskService.validateTaskData(validTask);

                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should allow partial validation for updates', () => {
                const partialTask = {
                    title: 'Updated Title'
                };

                const result = taskService.validateTaskData(partialTask, {
                    isUpdate: true,
                    partial: true
                });

                expect(result.isValid).toBe(true);
            });

            it('should skip immutable fields in update validation', () => {
                const updateTask = {
                    title: 'Updated Title',
                    project_id: 'new-project-id', // Should be skipped
                    customer_id: 'new-customer-id' // Should be skipped
                };

                const result = taskService.validateTaskData(updateTask, { isUpdate: true });

                // Should not validate project_id and customer_id for updates
                expect(result.isValid).toBe(true);
            });
        });

        describe('createNewTask', () => {
            it('should validate task data before creation', async () => {
                const invalidTask = {
                    // Missing required fields
                    taskName: 'Test Task'
                };

                await expect(taskService.createNewTask(invalidTask)).rejects.toThrow(
                    'Project ID, Customer ID, and Task Title are required'
                );

                expect(tasksApi.createTask).not.toHaveBeenCalled();
            });

            it('should support legacy field names', async () => {
                const taskWithLegacyNames = {
                    _projectID: '123e4567-e89b-12d3-a456-426614174000',
                    customerId: '123e4567-e89b-12d3-a456-426614174001',
                    taskName: 'Test Task',
                    type: 'Development',
                    _staffID: '123e4567-e89b-12d3-a456-426614174002'
                };

                tasksApi.createTask.mockResolvedValue({ id: 'task-1' });

                await taskService.createNewTask(taskWithLegacyNames);

                expect(tasksApi.createTask).toHaveBeenCalledWith(
                    expect.objectContaining({
                        project_id: '123e4567-e89b-12d3-a456-426614174000',
                        customer_id: '123e4567-e89b-12d3-a456-426614174001',
                        title: 'Test Task',
                        task_type: 'Development',
                        staff_id: '123e4567-e89b-12d3-a456-426614174002'
                    })
                );
            });

            it('should convert legacy priority strings to integers', async () => {
                const taskWithStringPriority = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task',
                    priority: 'high'
                };

                tasksApi.createTask.mockResolvedValue({ id: 'task-1' });

                await taskService.createNewTask(taskWithStringPriority);

                expect(tasksApi.createTask).toHaveBeenCalledWith(
                    expect.objectContaining({
                        priority: 1 // 'high' -> 1
                    })
                );
            });

            it('should default priority to 3 if not provided', async () => {
                const task = {
                    project_id: '123e4567-e89b-12d3-a456-426614174000',
                    customer_id: '123e4567-e89b-12d3-a456-426614174001',
                    title: 'Test Task'
                };

                tasksApi.createTask.mockResolvedValue({ id: 'task-1' });

                await taskService.createNewTask(task);

                expect(tasksApi.createTask).toHaveBeenCalledWith(
                    expect.objectContaining({
                        priority: 3
                    })
                );
            });
        });
    });

    describe('Data Processing Functions', () => {
        describe('processTimerRecords', () => {
            it('should process backend timer records', () => {
                const backendRecords = [
                    {
                        id: 'timer-1',
                        filemaker_record_id: 'fm-1',
                        start_time: '2026-01-15T10:00:00Z',
                        end_time: '2026-01-15T12:00:00Z',
                        description: 'Development work',
                        duration_minutes: 120,
                        status: 'completed',
                        pause_duration_seconds: 600,
                        adjustment_seconds: 360,
                        is_billable: true,
                        billable_amount: 200.00,
                        hourly_rate: 100.00
                    }
                ];

                const result = taskService.processTimerRecords(backendRecords);

                expect(result).toHaveLength(1);
                expect(result[0].id).toBe('timer-1');
                expect(result[0].duration).toBe(2); // 120 minutes = 2 hours
                expect(result[0].pauseDuration).toBe(600);
                expect(result[0].adjustmentSeconds).toBe(360);
            });

            it('should handle FileMaker timer records', () => {
                const fmRecords = {
                    response: {
                        data: [
                            {
                                recordId: 'rec-1',
                                fieldData: {
                                    __ID: 'timer-1',
                                    startTime: '10:00:00 AM',
                                    endTime: '12:00:00 PM',
                                    'Work Performed': 'Development',
                                    Billable_Time_Rounded: 2.0,
                                    TimeAdjust: 360
                                }
                            }
                        ]
                    }
                };

                const result = taskService.processTimerRecords(fmRecords);

                expect(result).toHaveLength(1);
                expect(result[0].id).toBe('timer-1');
                expect(result[0].description).toBe('Development');
                expect(result[0].duration).toBe(2.0);
            });

            it('should return empty array for invalid input', () => {
                expect(taskService.processTimerRecords(null)).toEqual([]);
                expect(taskService.processTimerRecords({})).toEqual([]);
                expect(taskService.processTimerRecords({ response: {} })).toEqual([]);
            });
        });
    });
});
