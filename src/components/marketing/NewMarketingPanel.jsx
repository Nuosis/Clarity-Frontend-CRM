import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import MarketingDashboard from './MarketingDashboard';
import { useMarketingContext } from '../../context/MarketingContext';

/**
 * New Marketing Panel Component - Wireframe
 * Main marketing interface with domain-based structure
 * Includes domain selection in the main content area
 */
const NewMarketingPanel = ({ darkMode, selectedDomain }) => {
    const { selectedMarketingFocus, setSelectedMarketingFocus } = useMarketingContext();

    const handleDomainSelect = useCallback((domain) => {
        // Domain selection is now handled by the sidebar
        setSelectedMarketingFocus(null); // Reset focus when domain changes
    }, [setSelectedMarketingFocus]);

    const handleAddDomain = useCallback(() => {
        // TODO: Implement domain creation modal
        console.log('Add new domain');
    }, []);

    const handleFocusSelect = useCallback((focus) => {
        setSelectedMarketingFocus(focus);
    }, [setSelectedMarketingFocus]);

    const handleContentSelect = useCallback((content) => {
        // TODO: Implement content selection/editing
        console.log('Content selected:', content);
    }, []);

    const handleBackToDomains = useCallback(() => {
        // Domain selection is handled by parent component
        setSelectedMarketingFocus(null);
    }, [setSelectedMarketingFocus]);

    return (
        <div className={`
            h-full
            ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
        `}>
            {selectedDomain ? (
                <MarketingDashboard
                    darkMode={darkMode}
                    selectedDomain={selectedDomain}
                    onFocusSelect={handleFocusSelect}
                    onContentSelect={handleContentSelect}
                />
            ) : (
                /* Welcome screen when no domain is selected */
                <div className={`
                    flex items-center justify-center h-full
                    ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                `}>
                    <div className="text-center max-w-md">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            Select a Marketing Domain
                        </h3>
                        <p className="text-sm mb-4">
                            Choose a marketing domain from the sidebar to start managing your marketing strategy, content pillars, and campaigns.
                        </p>
                        <div className="space-y-2 text-xs">
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                <strong>📧 Email Marketing:</strong> Manage email campaigns and automation
                            </div>
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                <strong>📺 YouTube:</strong> Video content strategy and publishing
                            </div>
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                <strong>💼 LinkedIn:</strong> Professional networking and B2B content
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

NewMarketingPanel.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    selectedDomain: PropTypes.object
};

export default React.memo(NewMarketingPanel);