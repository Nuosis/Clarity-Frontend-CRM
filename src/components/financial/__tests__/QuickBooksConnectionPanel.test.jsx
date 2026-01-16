/**
 * QuickBooksConnectionPanel Component Tests
 *
 * Tests for the QuickBooks connection panel component
 * Tests connection status display, OAuth flow, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickBooksConnectionPanel from '../QuickBooksConnectionPanel';
import * as quickbooksApi from '../../../api/quickbooksApi';

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

// Mock the QuickBooks API
jest.mock('../../../api/quickbooksApi');

describe('QuickBooksConnectionPanel - Connection Status', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.location
    delete window.location;
    window.location = {
      href: '',
      search: '',
      pathname: '/'
    };
  });

  test('should display loading state initially', () => {
    quickbooksApi.getQuickBooksStatus.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksConnectionPanel darkMode={false} />);

    expect(screen.getByText('Checking connection status...')).toBeInTheDocument();
  });

  test('should display connected status', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: {
        CompanyName: 'Test Company Inc.',
        Id: '123456789'
      }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('✓ Connected')).toBeInTheDocument();
    });

    expect(screen.getByText('Company ID:')).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();
    expect(screen.getByText('Reconnect to QuickBooks')).toBeInTheDocument();
  });

  test('should display disconnected status', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('○ Not Connected')).toBeInTheDocument();
    });

    expect(screen.getByText(/Connect to QuickBooks Online/i)).toBeInTheDocument();
    expect(screen.getByText('Connect to QuickBooks')).toBeInTheDocument();
  });

  test('should display company information when connected', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: {
        CompanyName: 'Acme Corporation',
        Id: '123456789'
      }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Company Name:')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
  });

  test('should show error when organization ID is missing', async () => {
    const { useAppState } = require('../../../context/AppStateContext');
    useAppState.mockReturnValue({ user: { ...mockUser, supabaseOrgID: null } });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Organization ID not available/i)).toBeInTheDocument();
    });
  });

  test('should handle API errors gracefully', async () => {
    quickbooksApi.getQuickBooksStatus.mockRejectedValue(
      new Error('Failed to fetch connection status')
    );

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to check QuickBooks connection status/i)).toBeInTheDocument();
    });
  });
});

describe('QuickBooksConnectionPanel - Token Expiration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should show expired token status', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: pastDate.toISOString(),
        is_expired: true
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  test('should show expiring soon status (within 7 days)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: futureDate.toISOString(),
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Expires in 3 days/i)).toBeInTheDocument();
    });
  });

  test('should show valid token status (more than 7 days)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: futureDate.toISOString(),
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Expires in 30 days/i)).toBeInTheDocument();
    });
  });

  test('should format expiration date correctly', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T14:30:00Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Token Expires:')).toBeInTheDocument();
    });

    // Check that date is formatted (exact format depends on locale)
    const dateElements = screen.getAllByText(/Dec|2025/i);
    expect(dateElements.length).toBeGreaterThan(0);
  });
});

describe('QuickBooksConnectionPanel - OAuth Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.location;
    window.location = { href: '', search: '', pathname: '/' };
  });

  test('should initiate OAuth flow when connect button is clicked', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    quickbooksApi.getQBOAuthorizationUrl.mockResolvedValue({
      authorization_url: 'https://appcenter.intuit.com/connect/oauth2?client_id=test&state=xyz',
      state: 'xyz'
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Connect to QuickBooks')).toBeInTheDocument();
    });

    const connectButton = screen.getByText('Connect to QuickBooks');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(quickbooksApi.getQBOAuthorizationUrl).toHaveBeenCalled();
    });

    expect(window.location.href).toBe('https://appcenter.intuit.com/connect/oauth2?client_id=test&state=xyz');
  });

  test('should handle OAuth flow errors', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    quickbooksApi.getQBOAuthorizationUrl.mockRejectedValue(
      new Error('Failed to get authorization URL')
    );

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Connect to QuickBooks')).toBeInTheDocument();
    });

    const connectButton = screen.getByText('Connect to QuickBooks');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to initiate QuickBooks connection/i)).toBeInTheDocument();
    });
  });

  test('should show connecting state during OAuth', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    quickbooksApi.getQBOAuthorizationUrl.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Connect to QuickBooks')).toBeInTheDocument();
    });

    const connectButton = screen.getByText('Connect to QuickBooks');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  test('should allow reconnect when already connected', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    quickbooksApi.getQBOAuthorizationUrl.mockResolvedValue({
      authorization_url: 'https://appcenter.intuit.com/connect/oauth2?reconnect=true',
      state: 'xyz'
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Reconnect to QuickBooks')).toBeInTheDocument();
    });

    const reconnectButton = screen.getByText('Reconnect to QuickBooks');
    fireEvent.click(reconnectButton);

    await waitFor(() => {
      expect(quickbooksApi.getQBOAuthorizationUrl).toHaveBeenCalled();
    });
  });
});

describe('QuickBooksConnectionPanel - Refresh Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should refresh connection status when refresh button is clicked', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    });

    // Clear the initial call
    quickbooksApi.getQuickBooksStatus.mockClear();

    const refreshButton = screen.getByText('Refresh Status');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(quickbooksApi.getQuickBooksStatus).toHaveBeenCalledTimes(1);
    });
  });

  test('should not show refresh button during loading', () => {
    quickbooksApi.getQuickBooksStatus.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksConnectionPanel darkMode={false} />);

    expect(screen.queryByText('Refresh Status')).not.toBeInTheDocument();
  });
});

describe('QuickBooksConnectionPanel - OAuth Callback Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should handle OAuth callback with code and state params', async () => {
    delete window.location;
    window.location = {
      href: '',
      search: '?code=auth-code-123&state=state-xyz',
      pathname: '/financial'
    };

    window.history.replaceState = jest.fn();

    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockResolvedValue({
      CompanyInfo: { CompanyName: 'Test Company' }
    });

    render(<QuickBooksConnectionPanel darkMode={false} />);

    // Should call getQuickBooksStatus initially
    await waitFor(() => {
      expect(quickbooksApi.getQuickBooksStatus).toHaveBeenCalledTimes(1);
    });

    // Clean up URL should be called
    expect(window.history.replaceState).toHaveBeenCalledWith({}, expect.any(String), '/financial');

    // Clear the initial call
    quickbooksApi.getQuickBooksStatus.mockClear();

    // Fast-forward the setTimeout delay
    jest.advanceTimersByTime(1000);

    // Should refresh status after callback
    await waitFor(() => {
      expect(quickbooksApi.getQuickBooksStatus).toHaveBeenCalledTimes(1);
    });
  });
});

describe('QuickBooksConnectionPanel - Dark Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should apply dark mode styles', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    const { container } = render(<QuickBooksConnectionPanel darkMode={true} />);

    await waitFor(() => {
      expect(screen.queryByText('Checking connection status...')).not.toBeInTheDocument();
    });

    const mainContainer = container.querySelector('.bg-gray-800');
    expect(mainContainer).toBeInTheDocument();
  });

  test('should apply light mode styles', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: false,
        realm_id: null,
        expires_at: null,
        is_expired: false
      }
    });

    const { container } = render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Checking connection status...')).not.toBeInTheDocument();
    });

    const mainContainer = container.querySelector('.bg-white');
    expect(mainContainer).toBeInTheDocument();
  });
});

describe('QuickBooksConnectionPanel - Company Info Loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should show loading state while fetching company info', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockImplementation(() => new Promise(() => {}));

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Loading company info...')).toBeInTheDocument();
    });
  });

  test('should not show error if company info fetch fails', async () => {
    quickbooksApi.getQuickBooksStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        realm_id: '123456789',
        expires_at: '2025-12-31T23:59:59Z',
        is_expired: false
      }
    });

    quickbooksApi.getQBOCompanyInfo.mockRejectedValue(
      new Error('Failed to fetch company info')
    );

    render(<QuickBooksConnectionPanel darkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('✓ Connected')).toBeInTheDocument();
    });

    // Should not show error message (company info is supplementary)
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });
});
