import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAppState } from '../../context/AppStateContext';
import {
  getQuickBooksStatus,
  getQBOAuthorizationUrl,
  getQBOCompanyInfo
} from '../../api/quickbooksApi';

/**
 * QuickBooksConnectionPanel component for managing QuickBooks Online connection
 *
 * Features:
 * - Show connection status (connected/disconnected)
 * - Connect button initiates OAuth flow via backend
 * - Shows QB company name when connected
 * - Shows token expiration status
 * - Loading states during OAuth flow
 * - Error messages for connection failures
 *
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} QuickBooks Connection Panel component
 */
function QuickBooksConnectionPanel({ darkMode = false }) {
  const { user } = useAppState();

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Company info state
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isLoadingCompanyInfo, setIsLoadingCompanyInfo] = useState(false);

  /**
   * Fetch QuickBooks connection status
   */
  const fetchConnectionStatus = useCallback(async () => {
    if (!user?.supabaseOrgID) {
      setError('Organization ID not available. Please ensure you are logged in.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getQuickBooksStatus(user.supabaseOrgID);

      if (response.success) {
        setConnectionStatus(response.data);

        // If connected, fetch company info
        if (response.data.connected) {
          fetchCompanyInfo();
        }
      } else {
        throw new Error(response.error || 'Failed to fetch connection status');
      }
    } catch (err) {
      console.error('Error fetching QuickBooks status:', err);
      setError(err.message || 'Failed to check QuickBooks connection status');
    } finally {
      setIsLoading(false);
    }
  }, [user?.supabaseOrgID]);

  /**
   * Fetch QuickBooks company information
   */
  const fetchCompanyInfo = useCallback(async () => {
    setIsLoadingCompanyInfo(true);

    try {
      const response = await getQBOCompanyInfo();

      if (response.CompanyInfo) {
        setCompanyInfo(response.CompanyInfo);
      }
    } catch (err) {
      console.error('Error fetching company info:', err);
      // Don't set error state here - company info is supplementary
    } finally {
      setIsLoadingCompanyInfo(false);
    }
  }, []);

  /**
   * Initiate OAuth connection flow
   */
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await getQBOAuthorizationUrl();

      if (response.authorization_url) {
        // Redirect to QuickBooks OAuth page
        window.location.href = response.authorization_url;
      } else {
        throw new Error('Authorization URL not received from server');
      }
    } catch (err) {
      console.error('Error initiating OAuth flow:', err);
      setError(err.message || 'Failed to initiate QuickBooks connection');
      setIsConnecting(false);
    }
  }, []);

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  /**
   * Check if token is expired or expiring soon (within 7 days)
   */
  const getExpirationStatus = () => {
    if (!connectionStatus?.expires_at) return null;

    const expiresAt = new Date(connectionStatus.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

    if (connectionStatus.is_expired) {
      return { type: 'expired', message: 'Token expired', color: 'red' };
    } else if (daysUntilExpiry <= 7) {
      return {
        type: 'expiring',
        message: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        color: 'yellow'
      };
    } else {
      return {
        type: 'valid',
        message: `Expires in ${daysUntilExpiry} days`,
        color: 'green'
      };
    }
  };

  // Load connection status on mount
  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  // Handle OAuth callback on page load (if redirected back from QuickBooks)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      // OAuth callback detected - refresh status
      // The backend has already handled the token exchange via the redirect_uri
      // We just need to check the new connection status

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Refresh connection status after a short delay
      setTimeout(() => {
        fetchConnectionStatus();
      }, 1000);
    }
  }, [fetchConnectionStatus]);

  const expirationStatus = connectionStatus?.connected ? getExpirationStatus() : null;

  return (
    <div className={`
      p-6 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          QuickBooks Connection
        </h3>

        {/* Refresh Button */}
        {!isLoading && (
          <button
            onClick={fetchConnectionStatus}
            className={`
              text-sm px-3 py-1.5 rounded-lg transition-colors
              ${darkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            Refresh Status
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Checking connection status...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className={`
          p-4 rounded-lg border mb-4
          ${darkMode ? 'bg-red-900 bg-opacity-30 border-red-800' : 'bg-red-50 border-red-200'}
        `}>
          <p className={`text-sm font-medium ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
            Error
          </p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
            {error}
          </p>
        </div>
      )}

      {/* Connection Status */}
      {!isLoading && connectionStatus && (
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center space-x-3">
            <div className={`
              px-3 py-1.5 rounded-full text-sm font-medium
              ${connectionStatus.connected
                ? (darkMode ? 'bg-green-900 bg-opacity-30 text-green-200 border border-green-800' : 'bg-green-100 text-green-800 border border-green-200')
                : (darkMode ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-700 border border-gray-200')
              }
            `}>
              {connectionStatus.connected ? '✓ Connected' : '○ Not Connected'}
            </div>

            {/* Expiration Status Badge */}
            {expirationStatus && (
              <div className={`
                px-3 py-1.5 rounded-full text-xs font-medium border
                ${expirationStatus.color === 'red'
                  ? (darkMode ? 'bg-red-900 bg-opacity-30 text-red-200 border-red-800' : 'bg-red-100 text-red-800 border-red-200')
                  : expirationStatus.color === 'yellow'
                    ? (darkMode ? 'bg-yellow-900 bg-opacity-30 text-yellow-200 border-yellow-800' : 'bg-yellow-100 text-yellow-800 border-yellow-200')
                    : (darkMode ? 'bg-green-900 bg-opacity-30 text-green-200 border-green-800' : 'bg-green-100 text-green-800 border-green-200')
                }
              `}>
                {expirationStatus.message}
              </div>
            )}
          </div>

          {/* Connected State */}
          {connectionStatus.connected && (
            <div className={`
              p-4 rounded-lg border
              ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
            `}>
              <div className="space-y-3">
                {/* Realm ID */}
                {connectionStatus.realm_id && (
                  <div>
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Company ID:
                    </span>
                    <div className={`text-sm mt-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                      {connectionStatus.realm_id}
                    </div>
                  </div>
                )}

                {/* Company Name */}
                {isLoadingCompanyInfo && (
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Loading company info...
                  </div>
                )}

                {companyInfo && (
                  <div>
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Company Name:
                    </span>
                    <div className={`text-sm mt-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                      {companyInfo.CompanyName || 'N/A'}
                    </div>
                  </div>
                )}

                {/* Token Expiration */}
                {connectionStatus.expires_at && (
                  <div>
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Token Expires:
                    </span>
                    <div className={`text-sm mt-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                      {formatDate(connectionStatus.expires_at)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Disconnected State */}
          {!connectionStatus.connected && (
            <div className={`
              p-4 rounded-lg border
              ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
            `}>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Connect to QuickBooks Online to enable invoice synchronization and financial data integration.
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            {connectionStatus.connected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${isConnecting
                    ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                    : (darkMode
                      ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700')
                  }
                `}
              >
                {isConnecting ? 'Reconnecting...' : 'Reconnect to QuickBooks'}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${isConnecting
                    ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                    : (darkMode
                      ? 'bg-green-800 text-green-100 hover:bg-green-700'
                      : 'bg-green-600 text-white hover:bg-green-700')
                  }
                `}
              >
                {isConnecting ? 'Connecting...' : 'Connect to QuickBooks'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

QuickBooksConnectionPanel.propTypes = {
  darkMode: PropTypes.bool
};

export default React.memo(QuickBooksConnectionPanel);
