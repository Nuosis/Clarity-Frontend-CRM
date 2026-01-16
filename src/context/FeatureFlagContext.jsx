import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Feature Flag Context
 *
 * Provides a centralized system for controlling feature rollouts during
 * the migration from FileMaker to Backend API. Feature flags allow safe,
 * incremental migration by controlling which data source is used for each feature.
 *
 * Usage:
 *   const { isFeatureEnabled, enableFeature, disableFeature } = useFeatureFlag();
 *
 *   if (isFeatureEnabled('use_backend_customers')) {
 *     // Use backend API
 *   } else {
 *     // Use FileMaker
 *   }
 */

const FeatureFlagContext = createContext();

/**
 * Default feature flags
 *
 * Format: { flag_name: default_value }
 *
 * Naming convention:
 * - use_backend_[feature]: Feature uses backend API instead of FileMaker
 * - use_filemaker_[feature]: Feature explicitly uses FileMaker (legacy)
 *
 * Migration strategy:
 * 1. Start with all flags false (FileMaker default)
 * 2. Test backend integration in dev
 * 3. Enable flag in production for gradual rollout
 * 4. Remove FileMaker code path after successful migration
 * 5. Remove feature flag when no longer needed
 */
const DEFAULT_FLAGS = {
    // Authentication
    use_backend_auth: false,

    // Customer management
    use_backend_customers: false,
    use_backend_customer_search: false,
    use_backend_customer_pagination: false,

    // Project management
    use_backend_projects: false,
    use_backend_project_notes: true, // Already migrated

    // Task management
    use_backend_tasks: false,
    use_backend_task_notes: true, // Already migrated

    // Team management
    use_backend_teams: true, // Already migrated to Supabase

    // Financial records
    use_backend_financial_records: true, // Already using Supabase RPC

    // Products and sales
    use_backend_products: false,
    use_backend_sales: false,

    // Proposals
    use_backend_proposals: true, // Already using backend API

    // Links
    use_backend_links: false,

    // Marketing (Supabase-only, no FileMaker equivalent)
    use_supabase_prospects: true,
    use_supabase_marketing: true
};

/**
 * Storage key for persisting feature flags
 */
const STORAGE_KEY = 'clarity_feature_flags';

/**
 * Load feature flags from localStorage
 * @returns {Object} Stored feature flags or defaults
 */
function loadFlagsFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to handle new flags
            return { ...DEFAULT_FLAGS, ...parsed };
        }
    } catch (error) {
        console.error('[FeatureFlags] Error loading from storage:', error);
    }
    return DEFAULT_FLAGS;
}

/**
 * Save feature flags to localStorage
 * @param {Object} flags - Feature flags to save
 */
function saveFlagsToStorage(flags) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (error) {
        console.error('[FeatureFlags] Error saving to storage:', error);
    }
}

/**
 * Feature Flag Provider Component
 *
 * Wraps the application to provide feature flag context.
 * Should be placed near the root of the component tree,
 * after AppStateProvider.
 */
export function FeatureFlagProvider({ children, initialFlags = {} }) {
    const [flags, setFlags] = useState(() => {
        const loadedFlags = loadFlagsFromStorage();
        return { ...loadedFlags, ...initialFlags };
    });

    // Persist flags to localStorage whenever they change
    useEffect(() => {
        saveFlagsToStorage(flags);
    }, [flags]);

    /**
     * Check if a feature flag is enabled
     * @param {string} flagName - The feature flag name
     * @param {Object} options - Additional options
     * @param {string} options.environment - Override environment type
     * @returns {boolean} True if feature is enabled
     */
    const isFeatureEnabled = useCallback((flagName, options = {}) => {
        // Check if flag exists
        if (!(flagName in flags)) {
            console.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
            return false;
        }

        // Get flag value
        const flagValue = flags[flagName];

        // If environment override is provided, apply environment-specific logic
        if (options.environment) {
            // In FileMaker environment, backend flags are always false
            if (options.environment === ENVIRONMENT_TYPES.FILEMAKER &&
                flagName.startsWith('use_backend_')) {
                return false;
            }

            // In web app environment, FileMaker flags are always false
            if (options.environment === ENVIRONMENT_TYPES.WEBAPP &&
                flagName.startsWith('use_filemaker_')) {
                return false;
            }
        }

        return Boolean(flagValue);
    }, [flags]);

    /**
     * Enable a feature flag
     * @param {string} flagName - The feature flag name
     */
    const enableFeature = useCallback((flagName) => {
        setFlags(prev => {
            if (!(flagName in prev)) {
                console.warn(`[FeatureFlags] Cannot enable unknown flag: ${flagName}`);
                return prev;
            }

            console.log(`[FeatureFlags] Enabling flag: ${flagName}`);
            return { ...prev, [flagName]: true };
        });
    }, []);

    /**
     * Disable a feature flag
     * @param {string} flagName - The feature flag name
     */
    const disableFeature = useCallback((flagName) => {
        setFlags(prev => {
            if (!(flagName in prev)) {
                console.warn(`[FeatureFlags] Cannot disable unknown flag: ${flagName}`);
                return prev;
            }

            console.log(`[FeatureFlags] Disabling flag: ${flagName}`);
            return { ...prev, [flagName]: false };
        });
    }, []);

    /**
     * Toggle a feature flag
     * @param {string} flagName - The feature flag name
     */
    const toggleFeature = useCallback((flagName) => {
        setFlags(prev => {
            if (!(flagName in prev)) {
                console.warn(`[FeatureFlags] Cannot toggle unknown flag: ${flagName}`);
                return prev;
            }

            const newValue = !prev[flagName];
            console.log(`[FeatureFlags] Toggling flag: ${flagName} -> ${newValue}`);
            return { ...prev, [flagName]: newValue };
        });
    }, []);

    /**
     * Set multiple feature flags at once
     * @param {Object} newFlags - Object with flag names as keys and boolean values
     */
    const setFeatureFlags = useCallback((newFlags) => {
        setFlags(prev => {
            const validFlags = {};
            Object.keys(newFlags).forEach(key => {
                if (key in prev) {
                    validFlags[key] = Boolean(newFlags[key]);
                } else {
                    console.warn(`[FeatureFlags] Cannot set unknown flag: ${key}`);
                }
            });

            if (Object.keys(validFlags).length > 0) {
                console.log('[FeatureFlags] Setting multiple flags:', validFlags);
                return { ...prev, ...validFlags };
            }

            return prev;
        });
    }, []);

    /**
     * Reset all flags to defaults
     */
    const resetFlags = useCallback(() => {
        console.log('[FeatureFlags] Resetting all flags to defaults');
        setFlags(DEFAULT_FLAGS);
    }, []);

    /**
     * Get all current flag values
     * @returns {Object} Current feature flags
     */
    const getAllFlags = useCallback(() => {
        return { ...flags };
    }, [flags]);

    /**
     * Get flags by prefix (e.g., 'use_backend_')
     * @param {string} prefix - Flag name prefix
     * @returns {Object} Filtered flags
     */
    const getFlagsByPrefix = useCallback((prefix) => {
        const filtered = {};
        Object.keys(flags).forEach(key => {
            if (key.startsWith(prefix)) {
                filtered[key] = flags[key];
            }
        });
        return filtered;
    }, [flags]);

    const value = {
        flags,
        isFeatureEnabled,
        enableFeature,
        disableFeature,
        toggleFeature,
        setFeatureFlags,
        resetFlags,
        getAllFlags,
        getFlagsByPrefix
    };

    return (
        <FeatureFlagContext.Provider value={value}>
            {children}
        </FeatureFlagContext.Provider>
    );
}

/**
 * Hook to access feature flags
 *
 * @returns {Object} Feature flag methods
 * @throws {Error} If used outside FeatureFlagProvider
 *
 * @example
 * function MyComponent() {
 *   const { isFeatureEnabled } = useFeatureFlag();
 *
 *   if (isFeatureEnabled('use_backend_customers')) {
 *     return <BackendCustomerList />;
 *   }
 *   return <FileMakerCustomerList />;
 * }
 */
export function useFeatureFlag() {
    const context = useContext(FeatureFlagContext);
    if (context === undefined) {
        throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
    }
    return context;
}

/**
 * Export default flags for testing and documentation
 */
export { DEFAULT_FLAGS };
