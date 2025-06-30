import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useMarketingContext } from '../../context/MarketingContext';

/**
 * Marketing Dashboard Component - Wireframe
 * Main content area showing domain-specific marketing elements
 */
const MarketingDashboard = ({ darkMode, selectedDomain, onFocusSelect, onContentSelect }) => {
    const { selectedMarketingFocus, setSelectedMarketingFocus, selectedMarketingContent, setSelectedMarketingContent } = useMarketingContext();
    const [selectedView, setSelectedView] = useState('overview'); // overview, pillars, categories, content

    // Mock data for wireframe - this would come from Redux store in real implementation
    const mockFocuses = {
        email: [
            {
                id: 'business-efficiency',
                name: 'Business Efficiency',
                description: 'Streamlining operations and maximizing productivity',
                pillars: [
                    { id: 'automation', name: 'Automation', description: 'Streamlining repetitive tasks' },
                    { id: 'integration', name: 'Integration', description: 'Connecting systems seamlessly' },
                    { id: 'insight', name: 'Insight', description: 'Data-driven decision making' }
                ],
                categories: {
                    entertainment: { name: 'Entertainment', description: 'Emotional + Awareness', contentCount: 5 },
                    inspire: { name: 'Inspire', description: 'Emotional + Purchase', contentCount: 3 },
                    educate: { name: 'Educate', description: 'Rational + Awareness', contentCount: 8 },
                    convince: { name: 'Convince', description: 'Rational + Purchase', contentCount: 4 }
                },
                perspectives: ['Personal', 'General Advice', 'Expert Advice'],
                contentCount: 20
            }
        ],
        youtube: [
            {
                id: 'digital-transformation',
                name: 'Digital Transformation',
                description: 'Helping businesses embrace digital solutions',
                pillars: [
                    { id: 'cloud-adoption', name: 'Cloud Adoption', description: 'Moving to cloud-based solutions' },
                    { id: 'process-optimization', name: 'Process Optimization', description: 'Improving business workflows' }
                ],
                categories: {
                    entertainment: { name: 'Entertainment', description: 'Emotional + Awareness', contentCount: 2 },
                    inspire: { name: 'Inspire', description: 'Emotional + Purchase', contentCount: 1 },
                    educate: { name: 'Educate', description: 'Rational + Awareness', contentCount: 4 },
                    convince: { name: 'Convince', description: 'Rational + Purchase', contentCount: 2 }
                },
                perspectives: ['Personal', 'General Advice', 'Expert Advice'],
                contentCount: 9
            }
        ]
    };

    const currentFocuses = selectedDomain ? mockFocuses[selectedDomain.id] || [] : [];

    const handleFocusSelect = useCallback((focus) => {
        setSelectedMarketingFocus(focus);
        onFocusSelect(focus);
    }, [onFocusSelect, setSelectedMarketingFocus]);

    const handleViewChange = useCallback((view) => {
        setSelectedView(view);
    }, []);

    const renderOverview = () => (
        <div className="space-y-6">
            <div className={`
                p-6 rounded-lg border
                ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
            `}>
                <div className="flex items-center space-x-4 mb-4">
                    <span className="text-4xl">{selectedDomain?.icon}</span>
                    <div>
                        <h1 className={`
                            text-2xl font-bold
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            {selectedDomain?.name}
                        </h1>
                        <p className={`
                            ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            {currentFocuses.length} focus area{currentFocuses.length !== 1 ? 's' : ''} defined
                        </p>
                    </div>
                </div>
            </div>

            {/* Focus Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentFocuses.map(focus => (
                    <div
                        key={focus.id}
                        onClick={() => handleFocusSelect(focus)}
                        className={`
                            p-6 rounded-lg border cursor-pointer transition-all hover:shadow-lg
                            ${darkMode 
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                                : 'bg-white border-gray-200 hover:border-gray-300'}
                        `}
                    >
                        <h3 className={`
                            text-lg font-semibold mb-2
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            {focus.name}
                        </h3>
                        <p className={`
                            text-sm mb-4
                            ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            {focus.description}
                        </p>
                        
                        <div className="space-y-2">
                            <div className={`
                                text-xs
                                ${darkMode ? 'text-gray-500' : 'text-gray-500'}
                            `}>
                                <span className="font-medium">{focus.pillars.length}</span> Content Pillars
                            </div>
                            <div className={`
                                text-xs
                                ${darkMode ? 'text-gray-500' : 'text-gray-500'}
                            `}>
                                <span className="font-medium">{focus.contentCount}</span> Content Pieces
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add New Focus Card */}
                <div className={`
                    p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                    ${darkMode 
                        ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50' 
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
                `}>
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <h3 className={`
                            text-lg font-semibold mb-2
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            Add New Focus
                        </h3>
                        <p className={`
                            text-sm
                            ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            Define a new expertise area for this domain
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderContentView = () => {
        if (!selectedMarketingContent || selectedMarketingContent === 'overview') {
            return renderFocusDetails();
        }

        // Render specific content based on selectedMarketingContent
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setSelectedMarketingContent('overview')}
                        className={`
                            px-3 py-1 text-sm rounded-md transition-colors
                            ${darkMode
                                ? 'text-blue-400 hover:bg-gray-800'
                                : 'text-blue-600 hover:bg-gray-100'
                            }
                        `}>
                        ← Back to Overview
                    </button>
                </div>
                
                <div className={`
                    p-6 rounded-lg border
                    ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                `}>
                    <h2 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMarketingContent === 'pillars' && 'Content Pillars'}
                        {selectedMarketingContent === 'categories' && 'Content Categories'}
                        {selectedMarketingContent === 'content' && 'Content Library'}
                    </h2>
                    
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {selectedMarketingContent === 'pillars' && 'Detailed view of content pillars and their strategies.'}
                        {selectedMarketingContent === 'categories' && 'Explore content categories and their performance metrics.'}
                        {selectedMarketingContent === 'content' && 'Browse and manage your content library.'}
                    </div>
                </div>
            </div>
        );
    };

    const renderFocusDetails = () => {
        if (!selectedMarketingFocus) return null;

        return (
            <div className="space-y-6">
                {/* Focus Header */}
                <div className={`
                    p-6 rounded-lg border
                    ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                `}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className={`
                                text-2xl font-bold
                                ${darkMode ? 'text-white' : 'text-gray-900'}
                            `}>
                                {selectedMarketingFocus.name}
                            </h1>
                            <p className={`
                                ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                            `}>
                                {selectedMarketingFocus.description}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedMarketingFocus(null)}
                            className={`
                                p-2 rounded-md
                                ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* View Tabs */}
                    <div className="flex space-x-4">
                        {['pillars', 'categories', 'content'].map(view => (
                            <button
                                key={view}
                                onClick={() => handleViewChange(view)}
                                className={`
                                    px-4 py-2 rounded-md text-sm font-medium capitalize
                                    ${selectedView === view
                                        ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                                        : (darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}
                                `}
                            >
                                {view}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content based on selected view */}
                {selectedView === 'pillars' && renderPillars()}
                {selectedView === 'categories' && renderCategories()}
                {selectedView === 'content' && renderContent()}
            </div>
        );
    };

    const renderPillars = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedMarketingFocus.pillars.map(pillar => (
                <div
                    key={pillar.id}
                    onClick={() => setSelectedMarketingContent('pillars')}
                    className={`
                        p-6 rounded-lg border cursor-pointer transition-colors
                        ${darkMode
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                    `}
                >
                    <h3 className={`
                        text-lg font-semibold mb-2
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        {pillar.name}
                    </h3>
                    <p className={`
                        text-sm
                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                    `}>
                        {pillar.description}
                    </p>
                </div>
            ))}
            
            {/* Create Pillar Card */}
            <div
                onClick={() => console.log('Create new pillar')}
                className={`
                    p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                    ${darkMode
                        ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                `}
            >
                <div className="flex flex-col items-center justify-center h-full min-h-[120px]">
                    <svg
                        className={`w-8 h-8 mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <h3 className={`
                        text-lg font-semibold mb-1
                        ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                    `}>
                        Create Pillar
                    </h3>
                    <p className={`
                        text-sm text-center
                        ${darkMode ? 'text-gray-500' : 'text-gray-500'}
                    `}>
                        Add a new content pillar
                    </p>
                </div>
            </div>
        </div>
    );

    const renderCategories = () => (
        <div className="grid grid-cols-2 gap-6">
            {Object.entries(selectedMarketingFocus.categories).map(([key, category]) => (
                <div
                    key={key}
                    onClick={() => setSelectedMarketingContent('categories')}
                    className={`
                        p-6 rounded-lg border cursor-pointer transition-colors
                        ${darkMode
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                    `}
                >
                    <h3 className={`
                        text-lg font-semibold mb-2
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        {category.name}
                    </h3>
                    <p className={`
                        text-sm mb-4
                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                    `}>
                        {category.description}
                    </p>
                    <div className={`
                        text-xs
                        ${darkMode ? 'text-gray-500' : 'text-gray-500'}
                    `}>
                        <span className="font-medium">{category.contentCount}</span> content pieces
                    </div>
                </div>
            ))}
        </div>
    );

    const renderContent = () => (
        <div className={`
            p-6 rounded-lg border
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
            <div className="flex items-center justify-between mb-6">
                <h3 className={`
                    text-lg font-semibold
                    ${darkMode ? 'text-white' : 'text-gray-900'}
                `}>
                    Content Management
                </h3>
                <button className={`
                    px-4 py-2 rounded-md text-sm font-medium
                    ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                `}>
                    Create Content
                </button>
            </div>

            {/* Content Status Filters */}
            <div className="flex space-x-4 mb-6">
                {['All', 'Published', 'Scheduled', 'In Development', 'Concept'].map(status => (
                    <button
                        key={status}
                        className={`
                            px-3 py-1 rounded-full text-xs font-medium
                            ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                        `}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Content List Placeholder */}
            <div className={`
                text-center py-12
                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
            `}>
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Content management interface will be implemented here</p>
                <p className="text-sm mt-2">Create, schedule, and manage your marketing content</p>
            </div>
        </div>
    );

    if (!selectedDomain) {
        return (
            <div className={`
                flex items-center justify-center h-full
                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
            `}>
                <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Select a Marketing Domain
                    </h3>
                    <p>Choose a domain from the sidebar to view its marketing structure</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            {selectedMarketingFocus ? renderContentView() : renderOverview()}
        </div>
    );
};

MarketingDashboard.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    selectedDomain: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        icon: PropTypes.string,
        color: PropTypes.string,
        focusCount: PropTypes.number
    }),
    onFocusSelect: PropTypes.func.isRequired,
    onContentSelect: PropTypes.func.isRequired
};

export default React.memo(MarketingDashboard);