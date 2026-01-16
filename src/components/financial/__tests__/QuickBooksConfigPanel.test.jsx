/**
 * QuickBooksConfigPanel Component Tests
 *
 * Tests for the QuickBooks configuration panel component
 * Tests admin access control, configuration management, and form interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickBooksConfigPanel from '../QuickBooksConfigPanel';

// Mock the AppStateContext
const mockUser = {
  id: 'user-123',
  role: 'admin',
  supabaseOrgID: '9816c057-b5d3-43a2-848f-99365ee6255e'
};

jest.mock('../../../context/AppStateContext', () => ({
  useAppState: jest.fn(() => ({
    user: mockUser
  }))
}));

describe('QuickBooksConfigPanel - Access Control', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('should render for admin users', () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, role: 'admin' } });

    render(<QuickBooksConfigPanel darkMode={false} />);

    expect(screen.getByText('QuickBooks Configuration')).toBeInTheDocument();
    expect(screen.getByText('Admin Only')).toBeInTheDocument();
  });

  test('should render for owner users', () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, role: 'owner' } });

    render(<QuickBooksConfigPanel darkMode={false} />);

    expect(screen.getByText('QuickBooks Configuration')).toBeInTheDocument();
  });

  test('should show access denied for non-admin users', () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, role: 'user' } });

    render(<QuickBooksConfigPanel darkMode={false} />);

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/only accessible to administrators/i)).toBeInTheDocument();
    expect(screen.queryByText('QuickBooks Configuration')).not.toBeInTheDocument();
  });

  test('should show access denied for billing users', () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, role: 'billing' } });

    render(<QuickBooksConfigPanel darkMode={false} />);

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });
});

describe('QuickBooksConfigPanel - Configuration Loading', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should load default configuration', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Check default values are displayed
    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    expect(cadTaxCodeInput).toHaveValue(4);

    const nonCadTaxCodeInput = screen.getByLabelText('Non-CAD Tax Code');
    expect(nonCadTaxCodeInput).toHaveValue(3);

    const defaultCurrencySelect = screen.getByLabelText('Default Currency');
    expect(defaultCurrencySelect).toHaveValue('CAD');
  });

  test('should load saved configuration from localStorage', async () => {
    const savedConfig = {
      cad_tax_code: 5,
      non_cad_tax_code: 2,
      cad_item_id: '10',
      cad_item_name: 'Custom Development CAD',
      default_currency: 'USD',
      default_payment_terms: 'Net 15',
      auto_sync_enabled: false,
      sync_frequency_hours: 12
    };

    localStorage.setItem(
      `qb_config_${mockUser.supabaseOrgID}`,
      JSON.stringify(savedConfig)
    );

    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('CAD Tax Code')).toHaveValue(5);
    expect(screen.getByLabelText('Non-CAD Tax Code')).toHaveValue(2);
    expect(screen.getByLabelText('CAD Item ID')).toHaveValue('10');
    expect(screen.getByLabelText('Default Currency')).toHaveValue('USD');
    expect(screen.getByLabelText('Default Payment Terms')).toHaveValue('Net 15');
  });

  test('should show error when organization ID is missing', async () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, supabaseOrgID: null } });

    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Organization ID not available/i)).toBeInTheDocument();
    });
  });
});

describe('QuickBooksConfigPanel - Form Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should enable save button when changes are made', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    expect(saveButton).toBeDisabled();

    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    fireEvent.change(cadTaxCodeInput, { target: { value: '5' } });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  test('should update tax code fields', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    fireEvent.change(cadTaxCodeInput, { target: { value: '7' } });

    expect(cadTaxCodeInput).toHaveValue(7);
  });

  test('should update item ID and name fields', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const cadItemIdInput = screen.getByLabelText('CAD Item ID');
    const cadItemNameInput = screen.getByLabelText('CAD Item Name');

    fireEvent.change(cadItemIdInput, { target: { value: '99' } });
    fireEvent.change(cadItemNameInput, { target: { value: 'Custom Service CAD' } });

    expect(cadItemIdInput).toHaveValue('99');
    expect(cadItemNameInput).toHaveValue('Custom Service CAD');
  });

  test('should update currency selection', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const currencySelect = screen.getByLabelText('Default Currency');
    fireEvent.change(currencySelect, { target: { value: 'EUR' } });

    expect(currencySelect).toHaveValue('EUR');
  });

  test('should toggle email delivery checkbox', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const emailCheckbox = screen.getByLabelText('Send invoice emails by default');
    expect(emailCheckbox).toBeChecked();

    fireEvent.click(emailCheckbox);
    expect(emailCheckbox).not.toBeChecked();
  });

  test('should toggle auto-sync and show/hide frequency field', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const autoSyncCheckbox = screen.getByLabelText('Enable automatic invoice synchronization');
    expect(autoSyncCheckbox).toBeChecked();

    // Frequency field should be visible
    expect(screen.getByLabelText('Sync Frequency (hours)')).toBeInTheDocument();

    // Disable auto-sync
    fireEvent.click(autoSyncCheckbox);
    expect(autoSyncCheckbox).not.toBeChecked();

    // Frequency field should be hidden
    expect(screen.queryByLabelText('Sync Frequency (hours)')).not.toBeInTheDocument();
  });

  test('should update sync frequency', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const frequencyInput = screen.getByLabelText('Sync Frequency (hours)');
    fireEvent.change(frequencyInput, { target: { value: '6' } });

    expect(frequencyInput).toHaveValue(6);
  });
});

describe('QuickBooksConfigPanel - Save & Reset', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should save configuration to localStorage', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Make changes
    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    fireEvent.change(cadTaxCodeInput, { target: { value: '8' } });

    // Save
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration Saved Successfully')).toBeInTheDocument();
    });

    // Verify localStorage
    const savedConfig = JSON.parse(
      localStorage.getItem(`qb_config_${mockUser.supabaseOrgID}`)
    );
    expect(savedConfig.cad_tax_code).toBe(8);
  });

  test('should disable save button after saving', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Make changes
    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    fireEvent.change(cadTaxCodeInput, { target: { value: '8' } });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });

  test('should reset configuration to initial state', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    const initialValue = cadTaxCodeInput.value;

    // Make changes
    fireEvent.change(cadTaxCodeInput, { target: { value: '9' } });
    expect(cadTaxCodeInput).toHaveValue(9);

    // Reset
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(cadTaxCodeInput).toHaveValue(parseInt(initialValue));
    });
  });

  test('should disable reset button when no changes', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeDisabled();
  });

  test('should show success message and auto-hide after 3 seconds', async () => {
    jest.useFakeTimers();

    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Make changes and save
    const cadTaxCodeInput = screen.getByLabelText('CAD Tax Code');
    fireEvent.change(cadTaxCodeInput, { target: { value: '10' } });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration Saved Successfully')).toBeInTheDocument();
    });

    // Fast-forward time
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.queryByText('Configuration Saved Successfully')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});

describe('QuickBooksConfigPanel - Dark Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should apply dark mode styles', async () => {
    const { container } = render(<QuickBooksConfigPanel darkMode={true} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Check that dark mode classes are applied
    const mainContainer = container.querySelector('.bg-gray-800');
    expect(mainContainer).toBeInTheDocument();
  });

  test('should apply light mode styles', async () => {
    const { container } = render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Check that light mode classes are applied
    const mainContainer = container.querySelector('.bg-white');
    expect(mainContainer).toBeInTheDocument();
  });
});

describe('QuickBooksConfigPanel - Backend Integration Notice', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should display backend integration pending notice', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Backend Integration Pending')).toBeInTheDocument();
    expect(screen.getByText(/uses localStorage for demo purposes/i)).toBeInTheDocument();
  });
});

describe('QuickBooksConfigPanel - All Currency Items', () => {
  beforeEach(() => {
    localStorage.clear();
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: mockUser });
  });

  test('should render all currency item fields', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // CAD fields
    expect(screen.getByLabelText('CAD Item ID')).toBeInTheDocument();
    expect(screen.getByLabelText('CAD Item Name')).toBeInTheDocument();

    // USD fields
    expect(screen.getByLabelText('USD Item ID')).toBeInTheDocument();
    expect(screen.getByLabelText('USD Item Name')).toBeInTheDocument();

    // EUR fields
    expect(screen.getByLabelText('EUR Item ID')).toBeInTheDocument();
    expect(screen.getByLabelText('EUR Item Name')).toBeInTheDocument();
  });

  test('should update all currency item fields', async () => {
    render(<QuickBooksConfigPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const usdItemId = screen.getByLabelText('USD Item ID');
    const usdItemName = screen.getByLabelText('USD Item Name');
    const eurItemId = screen.getByLabelText('EUR Item ID');
    const eurItemName = screen.getByLabelText('EUR Item Name');

    fireEvent.change(usdItemId, { target: { value: '20' } });
    fireEvent.change(usdItemName, { target: { value: 'Custom USD Service' } });
    fireEvent.change(eurItemId, { target: { value: '30' } });
    fireEvent.change(eurItemName, { target: { value: 'Custom EUR Service' } });

    expect(usdItemId).toHaveValue('20');
    expect(usdItemName).toHaveValue('Custom USD Service');
    expect(eurItemId).toHaveValue('30');
    expect(eurItemName).toHaveValue('Custom EUR Service');
  });
});
