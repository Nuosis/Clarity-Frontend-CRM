/**
 * Feature Flag Hook
 *
 * Re-exports the useFeatureFlag hook from FeatureFlagContext
 * and provides additional utilities for common patterns.
 */

export { useFeatureFlag, FeatureFlagProvider, DEFAULT_FLAGS } from '../context/FeatureFlagContext';

import { useFeatureFlag as useFeatureFlagContext } from '../context/FeatureFlagContext';
import { useAppState } from '../context/AppStateContext';
import { ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Hook that combines feature flags with environment detection
 *
 * Provides a convenient way to check if a backend feature should be used
 * based on both the feature flag AND the current environment.
 *
 * @returns {Object} Feature flag utilities with environment awareness
 *
 * @example
 * function CustomerList() {
 *   const { shouldUseBackend } = useEnvironmentAwareFeatureFlag();
 *
 *   if (shouldUseBackend('customers')) {
 *     return <BackendCustomerList />;
 *   }
 *   return <FileMakerCustomerList />;
 * }
 */
export function useEnvironmentAwareFeatureFlag() {
    const { isFeatureEnabled, ...featureFlagMethods } = useFeatureFlagContext();
    const appState = useAppState();

    /**
     * Check if a backend feature should be used
     *
     * Returns true only if:
     * 1. We're in web app environment (not FileMaker)
     * 2. The corresponding feature flag is enabled
     *
     * @param {string} featureName - Feature name (e.g., 'customers', 'projects')
     * @returns {boolean} True if backend should be used
     */
    const shouldUseBackend = (featureName) => {
        // In FileMaker environment, never use backend
        if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER) {
            return false;
        }

        // In web app environment, check feature flag
        const flagName = `use_backend_${featureName}`;
        return isFeatureEnabled(flagName);
    };

    /**
     * Check if a Supabase-only feature should be used
     *
     * Supabase features have no FileMaker equivalent and are only
     * available in web app environment.
     *
     * @param {string} featureName - Feature name (e.g., 'prospects', 'marketing')
     * @returns {boolean} True if Supabase feature should be used
     */
    const shouldUseSupabase = (featureName) => {
        // Supabase features only work in web app
        if (appState.environment.type !== ENVIRONMENT_TYPES.WEBAPP) {
            return false;
        }

        const flagName = `use_supabase_${featureName}`;
        return isFeatureEnabled(flagName);
    };

    /**
     * Check if FileMaker should be used for a feature
     *
     * Returns true if:
     * 1. We're in FileMaker environment, OR
     * 2. We're in web app but backend flag is disabled
     *
     * @param {string} featureName - Feature name (e.g., 'customers', 'projects')
     * @returns {boolean} True if FileMaker should be used
     */
    const shouldUseFileMaker = (featureName) => {
        // In FileMaker environment, always use FileMaker
        if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER) {
            return true;
        }

        // In web app environment, use FileMaker only if backend flag is disabled
        const flagName = `use_backend_${featureName}`;
        return !isFeatureEnabled(flagName);
    };

    /**
     * Get the data source that should be used for a feature
     *
     * @param {string} featureName - Feature name
     * @returns {string} Data source: 'backend', 'filemaker', 'supabase', or 'unknown'
     */
    const getDataSource = (featureName) => {
        if (shouldUseBackend(featureName)) {
            return 'backend';
        }

        if (shouldUseSupabase(featureName)) {
            return 'supabase';
        }

        if (shouldUseFileMaker(featureName)) {
            return 'filemaker';
        }

        return 'unknown';
    };

    /**
     * Check if environment detection is complete
     *
     * @returns {boolean} True if environment is detected
     */
    const isEnvironmentReady = () => {
        return appState.environment.detectionComplete;
    };

    /**
     * Get current environment type
     *
     * @returns {string|null} Environment type or null if not detected
     */
    const getEnvironmentType = () => {
        return appState.environment.type;
    };

    return {
        // Core feature flag methods
        isFeatureEnabled,
        ...featureFlagMethods,

        // Environment-aware helpers
        shouldUseBackend,
        shouldUseSupabase,
        shouldUseFileMaker,
        getDataSource,

        // Environment info
        isEnvironmentReady,
        getEnvironmentType,
        environmentType: appState.environment.type,
        isFileMakerEnvironment: appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER,
        isWebAppEnvironment: appState.environment.type === ENVIRONMENT_TYPES.WEBAPP
    };
}

/**
 * Hook for feature-specific routing logic
 *
 * Provides a declarative way to handle feature flag routing
 * with automatic environment detection.
 *
 * @param {string} featureName - Feature name
 * @returns {Object} Routing helpers for the feature
 *
 * @example
 * function CustomerAPI() {
 *   const { backend, filemaker, route } = useFeatureRoute('customers');
 *
 *   return route({
 *     backend: () => backendCustomerAPI.fetchAll(),
 *     filemaker: () => fileMakerCustomerAPI.fetchAll()
 *   });
 * }
 */
export function useFeatureRoute(featureName) {
    const {
        shouldUseBackend,
        shouldUseFileMaker,
        shouldUseSupabase,
        getDataSource,
        isEnvironmentReady
    } = useEnvironmentAwareFeatureFlag();

    /**
     * Route to the appropriate implementation based on feature flags
     *
     * @param {Object} implementations - Implementation map
     * @param {Function} implementations.backend - Backend implementation
     * @param {Function} implementations.filemaker - FileMaker implementation
     * @param {Function} implementations.supabase - Supabase implementation
     * @returns {*} Result from the selected implementation
     */
    const route = (implementations) => {
        if (!isEnvironmentReady()) {
            throw new Error(
                `[useFeatureRoute] Environment detection not complete for feature: ${featureName}`
            );
        }

        const source = getDataSource(featureName);

        if (source === 'backend' && implementations.backend) {
            return implementations.backend();
        }

        if (source === 'filemaker' && implementations.filemaker) {
            return implementations.filemaker();
        }

        if (source === 'supabase' && implementations.supabase) {
            return implementations.supabase();
        }

        throw new Error(
            `[useFeatureRoute] No implementation found for ${featureName} using source: ${source}`
        );
    };

    return {
        // Data source checks
        backend: shouldUseBackend(featureName),
        filemaker: shouldUseFileMaker(featureName),
        supabase: shouldUseSupabase(featureName),
        dataSource: getDataSource(featureName),

        // Routing helper
        route,

        // Environment info
        isReady: isEnvironmentReady()
    };
}
