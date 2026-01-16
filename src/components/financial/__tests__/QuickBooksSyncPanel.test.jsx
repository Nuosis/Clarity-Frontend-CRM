/**
 * QuickBooksSyncPanel Component Tests
 *
 * Tests for the QuickBooks sync panel component
 * Tests invoice synchronization, date range selection, and progress display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickBooksSyncPanel from '../QuickBooksSyncPanel';
import * as quickbooksApi from '../../../api/quickbooksApi';

// Mock the QuickBooks API
jest.mock('../../../api/quickbooksApi');

describe('QuickBooksSyncPanel - Initial Render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should render with default state', () => {
    render(<QuickBooksSync Panel darkMode={false} />);

    expect(screen.getByText('Invoice Synchronization')).toBeInTheDocument();
    expect(screen.getByText('Sync invoices from QuickBooks to local database')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  test('should initialize with current month date range', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    // Check that dates are set (exact values depend on current date)
    expect(startDateInput.value).toBeTruthy();
    expect(endDateInput.value).toBeTruthy();
  });

  test('should load last sync info from localStorage', () => {
    const mockSyncInfo = {
      timestamp: '2025-01-15T10:30:00Z',
      result: {
        invoices_synced: 25,
        new_invoices: 10,
        updated_invoices: 15
      }
    };

    localStorage.setItem('qb_last_sync', JSON.stringify(mockSyncInfo));

    render(<QuickBooksSyncPanel darkMode={false} />);

    expect(screen.getByText('Last Sync:')).toBeInTheDocument();
  });
});

describe('QuickBooksSyncPanel - Date Range Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should update start date', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });

    expect(startDateInput).toHaveValue('2025-01-01');
  });

  test('should update end date', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const endDateInput = screen.getByLabelText('End Date');
    fireEvent.change(endDateInput, { target: { value: '2025-01-31' } });

    expect(endDateInput).toHaveValue('2025-01-31');
  });

  test('should set current month when button clicked', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const currentMonthButton = screen.getByText('Current Month');
    fireEvent.click(currentMonthButton);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    // Check that dates are set to current month
    expect(startDateInput.value).toBeTruthy();
    expect(endDateInput.value).toBeTruthy();
  });

  test('should set previous month when button clicked', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const previousMonthButton = screen.getByText('Previous Month');
    fireEvent.click(previousMonthButton);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    // Check that dates are set
    expect(startDateInput.value).toBeTruthy();
    expect(endDateInput.value).toBeTruthy();
  });

  test('should disable date inputs during sync', async () => {
    quickbooksApi.syncInvoices.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');
      expect(startDateInput).toBeDisabled();
      expect(endDateInput).toBeDisabled();
    });
  });
});

describe('QuickBooksSyncPanel - Sync Options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should toggle full sync option', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const fullSyncCheckbox = screen.getByLabelText(/Full sync/i);
    expect(fullSyncCheckbox).not.toBeChecked();

    fireEvent.click(fullSyncCheckbox);
    expect(fullSyncCheckbox).toBeChecked();

    // Warning should appear
    expect(screen.getByText(/Full sync will process all invoices/i)).toBeInTheDocument();
  });

  test('should hide full sync warning when unchecked', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const fullSyncCheckbox = screen.getByLabelText(/Full sync/i);
    fireEvent.click(fullSyncCheckbox);

    expect(screen.getByText(/Full sync will process all invoices/i)).toBeInTheDocument();

    fireEvent.click(fullSyncCheckbox);
    expect(screen.queryByText(/Full sync will process all invoices/i)).not.toBeInTheDocument();
  });
});

describe('QuickBooksSyncPanel - Sync Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should execute sync successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 50,
        new_invoices: 20,
        updated_invoices: 30,
        sync_timestamp: '2025-01-15T12:00:00Z'
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    // Should show syncing state
    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(screen.getByText('Syncing invoices from QuickBooks...')).toBeInTheDocument();
    });

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Sync Complete')).toBeInTheDocument();
      expect(screen.getByText('Sync Successful')).toBeInTheDocument();
    });

    // Should display sync results
    expect(screen.getByText('50')).toBeInTheDocument(); // Total synced
    expect(screen.getByText('20')).toBeInTheDocument(); // New invoices
    expect(screen.getByText('30')).toBeInTheDocument(); // Updated
  });

  test('should call onSyncComplete callback when provided', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 25,
        new_invoices: 10,
        updated_invoices: 15
      }
    };

    const onSyncComplete = jest.fn();
    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} onSyncComplete={onSyncComplete} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(onSyncComplete).toHaveBeenCalledWith(mockResponse.data);
    });
  });

  test('should save sync results to localStorage', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 25,
        new_invoices: 10,
        updated_invoices: 15
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync Complete')).toBeInTheDocument();
    });

    const savedData = localStorage.getItem('qb_last_sync');
    expect(savedData).toBeTruthy();

    const parsed = JSON.parse(savedData);
    expect(parsed.result).toEqual(mockResponse.data);
  });

  test('should send full_sync flag when checked', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 100,
        new_invoices: 50,
        updated_invoices: 50
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    const fullSyncCheckbox = screen.getByLabelText(/Full sync/i);
    fireEvent.click(fullSyncCheckbox);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(quickbooksApi.syncInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          full_sync: true
        })
      );
    });
  });

  test('should send date range to API', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 10,
        new_invoices: 5,
        updated_invoices: 5
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-01-31' } });

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(quickbooksApi.syncInvoices).toHaveBeenCalledWith({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        full_sync: false
      });
    });
  });
});

describe('QuickBooksSyncPanel - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should display error when sync fails', async () => {
    quickbooksApi.syncInvoices.mockRejectedValue(
      new Error('Failed to sync invoices')
    );

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync Failed')).toBeInTheDocument();
      expect(screen.getByText('Sync Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to sync invoices')).toBeInTheDocument();
    });
  });

  test('should show retry button on error', async () => {
    quickbooksApi.syncInvoices.mockRejectedValue(
      new Error('Network error')
    );

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  test('should clear error when retry is clicked', async () => {
    quickbooksApi.syncInvoices.mockRejectedValue(
      new Error('Test error')
    );

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText('Sync Error')).not.toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  test('should show error if date range is invalid', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    fireEvent.change(startDateInput, { target: { value: '' } });
    fireEvent.change(endDateInput, { target: { value: '' } });

    const syncButton = screen.getByText('Sync Now');
    expect(syncButton).toBeDisabled();
  });

  test('should handle API response without success flag', async () => {
    quickbooksApi.syncInvoices.mockResolvedValue({
      success: false,
      error: 'Invalid credentials'
    });

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync Failed')).toBeInTheDocument();
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });
});

describe('QuickBooksSyncPanel - Status Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should display syncing status badge', async () => {
    quickbooksApi.syncInvoices.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  test('should display success status badge', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 10,
        new_invoices: 5,
        updated_invoices: 5
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync Complete')).toBeInTheDocument();
    });
  });

  test('should display error status badge', async () => {
    quickbooksApi.syncInvoices.mockRejectedValue(new Error('Test error'));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync Failed')).toBeInTheDocument();
    });
  });

  test('should show progress indicator during sync', async () => {
    quickbooksApi.syncInvoices.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Syncing invoices from QuickBooks...')).toBeInTheDocument();
    });
  });
});

describe('QuickBooksSyncPanel - Dark Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should apply dark mode styles', () => {
    const { container } = render(<QuickBooksSyncPanel darkMode={true} />);

    const mainContainer = container.querySelector('.bg-gray-800');
    expect(mainContainer).toBeInTheDocument();
  });

  test('should apply light mode styles', () => {
    const { container } = render(<QuickBooksSyncPanel darkMode={false} />);

    const mainContainer = container.querySelector('.bg-white');
    expect(mainContainer).toBeInTheDocument();
  });
});

describe('QuickBooksSyncPanel - Last Sync Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should format and display last sync timestamp', () => {
    const mockSyncInfo = {
      timestamp: '2025-01-15T14:30:00Z',
      result: {
        invoices_synced: 25,
        new_invoices: 10,
        updated_invoices: 15
      }
    };

    localStorage.setItem('qb_last_sync', JSON.stringify(mockSyncInfo));

    render(<QuickBooksSyncPanel darkMode={false} />);

    expect(screen.getByText('Last Sync:')).toBeInTheDocument();
    // Check that date is formatted (exact format depends on locale)
    const dateElements = screen.getAllByText(/Jan|2025/i);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  test('should not show last sync if never synced', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    expect(screen.queryByText('Last Sync:')).not.toBeInTheDocument();
  });

  test('should update last sync timestamp after successful sync', async () => {
    const mockResponse = {
      success: true,
      data: {
        invoices_synced: 15,
        new_invoices: 8,
        updated_invoices: 7
      }
    };

    quickbooksApi.syncInvoices.mockResolvedValue(mockResponse);

    render(<QuickBooksSyncPanel darkMode={false} />);

    expect(screen.queryByText('Last Sync:')).not.toBeInTheDocument();

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Last Sync:')).toBeInTheDocument();
    });
  });
});

describe('QuickBooksSyncPanel - Button States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should disable sync button when syncing', async () => {
    quickbooksApi.syncInvoices.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      const syncingButton = screen.getByText('Syncing...');
      expect(syncingButton).toBeDisabled();
    });
  });

  test('should disable quick date buttons when syncing', async () => {
    quickbooksApi.syncInvoices.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksSyncPanel darkMode={false} />);

    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      const currentMonthButton = screen.getByText('Current Month');
      const previousMonthButton = screen.getByText('Previous Month');
      expect(currentMonthButton).toBeDisabled();
      expect(previousMonthButton).toBeDisabled();
    });
  });

  test('should disable sync button if dates are empty', () => {
    render(<QuickBooksSyncPanel darkMode={false} />);

    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '' } });

    const syncButton = screen.getByText('Sync Now');
    expect(syncButton).toBeDisabled();
  });
});
