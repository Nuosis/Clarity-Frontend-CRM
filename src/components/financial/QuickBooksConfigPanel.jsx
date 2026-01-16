import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAppState } from '../../context/AppStateContext';
// import { getQuickBooksConfig, updateQuickBooksConfig } from '../../api/quickbooksApi';

/**
 * QuickBooksConfigPanel component for managing organization-specific QuickBooks configuration
 *
 * ⚠️ BACKEND INTEGRATION STATUS: PENDING
 *
 * This component is ready for backend integration once the organization_quickbooks_config
 * table is deployed. Currently uses localStorage for demo/testing purposes.
 *
 * Required Backend Schema:
 * - Table: organization_quickbooks_config
 * - API Endpoint: GET/PUT /quickbooks/config
 * - See: BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md
 *
 * Features:
 * - Admin-only access (requires admin role)
 * - Configure tax codes (CAD vs non-CAD)
 * - Configure item IDs by currency (CAD, USD, EUR)
 * - Configure invoice number format
 * - Configure default payment terms
 * - Configure email delivery defaults
 * - Auto-sync settings
 *
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} QuickBooks Config Panel component
 */
function QuickBooksConfigPanel({ darkMode = false }) {
  const { user } = useAppState();

  // Access control - admin only
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // Configuration state
  const [config, setConfig] = useState({
    // Tax Configuration
    cad_tax_code: 4,
    non_cad_tax_code: 3,

    // Item/Service IDs by Currency
    cad_item_id: '3',
    cad_item_name: 'Development CAD',
    usd_item_id: '7',
    usd_item_name: 'Development USD',
    eur_item_id: '8',
    eur_item_name: 'Development EUR',

    // Invoice Settings
    default_currency: 'CAD',
    default_payment_terms: 'Net 30',
    default_email_delivery: true,
    invoice_number_format: '{qboCustomerId}{YY}{MM}{NNN}',

    // Sync Settings
    auto_sync_enabled: true,
    sync_frequency_hours: 24
  });

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track initial config for change detection
  const [initialConfig, setInitialConfig] = useState(null);

  /**
   * Load configuration from backend (or localStorage for now)
   */
  const loadConfiguration = useCallback(async () => {
    if (!user?.supabaseOrgID) {
      setError('Organization ID not available. Please ensure you are logged in.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual backend API call once schema is deployed
      // const response = await getQuickBooksConfig(user.supabaseOrgID);

      // TEMPORARY: Use localStorage for demo purposes
      const storageKey = `qb_config_${user.supabaseOrgID}`;
      const savedConfig = localStorage.getItem(storageKey);

      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
        setInitialConfig(parsedConfig);
      } else {
        // Use default config
        setInitialConfig(config);
      }
    } catch (err) {
      console.error('Error loading QuickBooks configuration:', err);
      setError(err.message || 'Failed to load QuickBooks configuration');
    } finally {
      setIsLoading(false);
    }
  }, [user?.supabaseOrgID, config]);

  /**
   * Save configuration to backend (or localStorage for now)
   */
  const handleSave = useCallback(async () => {
    if (!user?.supabaseOrgID) {
      setError('Organization ID not available. Cannot save configuration.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // TODO: Replace with actual backend API call once schema is deployed
      // const response = await updateQuickBooksConfig(user.supabaseOrgID, config);

      // TEMPORARY: Use localStorage for demo purposes
      const storageKey = `qb_config_${user.supabaseOrgID}`;
      localStorage.setItem(storageKey, JSON.stringify(config));

      setInitialConfig(config);
      setHasChanges(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving QuickBooks configuration:', err);
      setError(err.message || 'Failed to save QuickBooks configuration');
    } finally {
      setIsSaving(false);
    }
  }, [user?.supabaseOrgID, config]);

  /**
   * Reset configuration to initial state
   */
  const handleReset = useCallback(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setHasChanges(false);
      setSaveSuccess(false);
      setError(null);
    }
  }, [initialConfig]);

  /**
   * Handle field change
   */
  const handleFieldChange = useCallback((field, value) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };

      // Check if there are changes
      if (initialConfig) {
        const changed = JSON.stringify(newConfig) !== JSON.stringify(initialConfig);
        setHasChanges(changed);
      }

      return newConfig;
    });
    setSaveSuccess(false);
  }, [initialConfig]);

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div className={`
        p-6 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-yellow-900 bg-opacity-30 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}
        `}>
          <p className={`text-sm font-medium ${darkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
            Access Restricted
          </p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
            QuickBooks configuration is only accessible to administrators and organization owners.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      p-6 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            QuickBooks Configuration
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Configure organization-specific QuickBooks settings
          </p>
        </div>

        {/* Admin Badge */}
        <div className={`
          px-3 py-1.5 rounded-full text-xs font-medium border
          ${darkMode ? 'bg-blue-900 bg-opacity-30 text-blue-200 border-blue-800' : 'bg-blue-100 text-blue-800 border-blue-200'}
        `}>
          Admin Only
        </div>
      </div>

      {/* Backend Integration Notice */}
      <div className={`
        p-4 rounded-lg border mb-6
        ${darkMode ? 'bg-blue-900 bg-opacity-30 border-blue-800' : 'bg-blue-50 border-blue-200'}
      `}>
        <div className="flex items-start space-x-2">
          <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${darkMode ? 'text-blue-200' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className={`text-sm font-medium ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              Backend Integration Pending
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
              This feature uses localStorage for demo purposes. Backend schema deployment is required for production use.
              See BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md for details.
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading configuration...
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

      {/* Success State */}
      {saveSuccess && (
        <div className={`
          p-4 rounded-lg border mb-4
          ${darkMode ? 'bg-green-900 bg-opacity-30 border-green-800' : 'bg-green-50 border-green-200'}
        `}>
          <p className={`text-sm font-medium ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
            Configuration Saved Successfully
          </p>
        </div>
      )}

      {/* Configuration Form */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Tax Configuration Section */}
          <div>
            <h4 className={`text-md font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Tax Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  CAD Tax Code
                </label>
                <input
                  type="number"
                  value={config.cad_tax_code}
                  onChange={(e) => handleFieldChange('cad_tax_code', parseInt(e.target.value) || 0)}
                  disabled={isSaving}
                  className={`
                    w-full px-3 py-2 border rounded-lg text-sm
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Tax code for CAD currency invoices
                </p>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Non-CAD Tax Code
                </label>
                <input
                  type="number"
                  value={config.non_cad_tax_code}
                  onChange={(e) => handleFieldChange('non_cad_tax_code', parseInt(e.target.value) || 0)}
                  disabled={isSaving}
                  className={`
                    w-full px-3 py-2 border rounded-lg text-sm
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Tax code for USD/EUR currency invoices
                </p>
              </div>
            </div>
          </div>

          {/* Item/Service Configuration Section */}
          <div>
            <h4 className={`text-md font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Service Items by Currency
            </h4>
            <div className="space-y-4">
              {/* CAD Item */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    CAD Item ID
                  </label>
                  <input
                    type="text"
                    value={config.cad_item_id}
                    onChange={(e) => handleFieldChange('cad_item_id', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    CAD Item Name
                  </label>
                  <input
                    type="text"
                    value={config.cad_item_name}
                    onChange={(e) => handleFieldChange('cad_item_name', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
              </div>

              {/* USD Item */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    USD Item ID
                  </label>
                  <input
                    type="text"
                    value={config.usd_item_id}
                    onChange={(e) => handleFieldChange('usd_item_id', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    USD Item Name
                  </label>
                  <input
                    type="text"
                    value={config.usd_item_name}
                    onChange={(e) => handleFieldChange('usd_item_name', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
              </div>

              {/* EUR Item */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    EUR Item ID
                  </label>
                  <input
                    type="text"
                    value={config.eur_item_id}
                    onChange={(e) => handleFieldChange('eur_item_id', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    EUR Item Name
                  </label>
                  <input
                    type="text"
                    value={config.eur_item_name}
                    onChange={(e) => handleFieldChange('eur_item_name', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Settings Section */}
          <div>
            <h4 className={`text-md font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Invoice Settings
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Default Currency
                  </label>
                  <select
                    value={config.default_currency}
                    onChange={(e) => handleFieldChange('default_currency', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Default Payment Terms
                  </label>
                  <input
                    type="text"
                    value={config.default_payment_terms}
                    onChange={(e) => handleFieldChange('default_payment_terms', e.target.value)}
                    disabled={isSaving}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Invoice Number Format
                </label>
                <input
                  type="text"
                  value={config.invoice_number_format}
                  onChange={(e) => handleFieldChange('invoice_number_format', e.target.value)}
                  disabled={isSaving}
                  className={`
                    w-full px-3 py-2 border rounded-lg text-sm
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Format: {'{qboCustomerId}'}{'{YY}'}{'{MM}'}{'{NNN}'} - Placeholders: qboCustomerId, YY (year), MM (month), NNN (sequence)
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.default_email_delivery}
                    onChange={(e) => handleFieldChange('default_email_delivery', e.target.checked)}
                    disabled={isSaving}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Send invoice emails by default
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Sync Settings Section */}
          <div>
            <h4 className={`text-md font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Sync Settings
            </h4>
            <div className="space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.auto_sync_enabled}
                    onChange={(e) => handleFieldChange('auto_sync_enabled', e.target.checked)}
                    disabled={isSaving}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Enable automatic invoice synchronization
                  </span>
                </label>
              </div>

              {config.auto_sync_enabled && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sync Frequency (hours)
                  </label>
                  <input
                    type="number"
                    value={config.sync_frequency_hours}
                    onChange={(e) => handleFieldChange('sync_frequency_hours', parseInt(e.target.value) || 24)}
                    disabled={isSaving}
                    min="1"
                    max="168"
                    className={`
                      w-full md:w-1/2 px-3 py-2 border rounded-lg text-sm
                      ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  />
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    How often to sync invoices from QuickBooks (1-168 hours)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleReset}
              disabled={isSaving || !hasChanges}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isSaving || !hasChanges
                  ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  : (darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                }
              `}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`
                px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2
                ${isSaving || !hasChanges
                  ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  : (darkMode
                    ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700')
                }
              `}
            >
              {isSaving && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

QuickBooksConfigPanel.propTypes = {
  darkMode: PropTypes.bool
};

export default React.memo(QuickBooksConfigPanel);
