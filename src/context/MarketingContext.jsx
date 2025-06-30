import React, { createContext, useContext, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAppState, useAppDispatch, APP_ACTIONS } from './AppStateContext';

// Create the context
const MarketingContext = createContext(null);

/**
 * Custom hook to use the marketing context
 * @returns {Object} Marketing state and operations
 */
export function useMarketingContext() {
    const context = useContext(MarketingContext);
    if (!context) {
        throw new Error('useMarketingContext must be used within a MarketingProvider');
    }
    return context;
}

/**
 * Marketing context provider component
 */
export function MarketingProvider({ children }) {
    const state = useAppState();
    const dispatch = useAppDispatch();
    
    // Marketing domains data - this would eventually come from an API
    const marketingDomains = [
        {
            id: 'email',
            name: 'Email Marketing',
            icon: '📧',
            focusCount: 2,
            isActive: true
        },
        {
            id: 'youtube',
            name: 'YouTube',
            icon: '📺',
            focusCount: 1,
            isActive: true
        },
        {
            id: 'linkedin',
            name: 'LinkedIn',
            icon: '💼',
            focusCount: 3,
            isActive: false
        },
        {
            id: 'twitter',
            name: 'Twitter/X',
            icon: '🐦',
            focusCount: 0,
            isActive: true
        }
    ];

    // Actions
    const setSelectedMarketingDomain = useCallback((domain) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_MARKETING_DOMAIN, payload: domain });
    }, [dispatch]);

    const toggleMarketingDomainStatus = useCallback((domainId, isActive) => {
        dispatch({ 
            type: APP_ACTIONS.TOGGLE_MARKETING_DOMAIN_STATUS, 
            payload: { domainId, isActive } 
        });
        console.log('Toggle marketing domain status:', domainId, isActive);
    }, [dispatch]);

    const setShowMarketing = useCallback((show) => {
        dispatch({ type: APP_ACTIONS.SET_SHOW_MARKETING, payload: show });
    }, [dispatch]);

    const setSelectedMarketingFocus = useCallback((focus) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_MARKETING_FOCUS, payload: focus });
    }, [dispatch]);

    const setSelectedMarketingContent = useCallback((content) => {
        dispatch({ type: APP_ACTIONS.SET_SELECTED_MARKETING_CONTENT, payload: content });
    }, [dispatch]);

    // Create the context value
    const contextValue = {
        // State
        marketingDomains,
        selectedMarketingDomain: state.selectedMarketingDomain,
        selectedMarketingFocus: state.selectedMarketingFocus,
        selectedMarketingContent: state.selectedMarketingContent,
        showMarketing: state.showMarketing,
        loading: state.loading,
        error: state.error,
        
        // Actions
        setSelectedMarketingDomain,
        setSelectedMarketingFocus,
        setSelectedMarketingContent,
        toggleMarketingDomainStatus,
        setShowMarketing
    };
    
    return (
        <MarketingContext.Provider value={contextValue}>
            {children}
        </MarketingContext.Provider>
    );
}

MarketingProvider.propTypes = {
    children: PropTypes.node.isRequired
};