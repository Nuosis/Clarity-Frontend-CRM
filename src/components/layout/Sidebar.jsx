import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from './AppLayout';
import { calculateRecordsUnbilledHours } from '../../services/projectService';
import { getMonthlyBillableHoursFromState } from '../../services/monthlyBillableService';
import { useProject } from '../../hooks/useProject';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';
import { useMarketingContext } from '../../context/MarketingContext';
import CustomerForm from '../customers/CustomerForm';
import TeamForm from '../teams/TeamForm';

// Feature flags
const SHOW_FM_API = import.meta.env.VITE_SHOW_FM_API === 'true';
const SHOW_SPB_API = import.meta.env.VITE_SHOW_SPB_API === 'true';
const SHOW_QBO_TEST = import.meta.env.VITE_TEST_QB === 'true';

// Log feature flag values for debugging
console.log('Feature Flags:', {
  VITE_SHOW_FM_API: import.meta.env.VITE_SHOW_FM_API,
  VITE_SHOW_SPB_API: import.meta.env.VITE_SHOW_SPB_API,
  SHOW_FM_API,
  SHOW_SPB_API
});

// Memoized product list item
const ProductListItem = React.memo(function ProductListItem({
    product,
    isSelected,
    darkMode,
    onSelect
}) {
    return (
        <div
            onClick={() => onSelect(product)}
            className={`
                py-1 px-4 cursor-pointer border-b last:border-b-0 relative
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                ${isSelected
                    ? (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                    : (darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
            `}
        >
            <div className="flex items-center justify-between w-full relative">
                <h3 className={`
                    font-medium
                    ${isSelected
                        ? (darkMode ? 'text-white' : 'text-gray-900')
                        : (darkMode ? 'text-gray-300' : 'text-gray-700')}
                `}>
                    {product.name}
                </h3>
                
                <div className="flex items-center">
                    <span className={`
                        text-xs px-2 py-1 rounded-full
                        ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}
                    `}>
                        ${product.price.toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
});

ProductListItem.propTypes = {
    product: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        price: PropTypes.number.isRequired,
        description: PropTypes.string
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired
};

// Memoized customer list item
const CustomerListItem = React.memo(function CustomerListItem({
    customer,
    isSelected,
    darkMode,
    onSelect,
    onStatusToggle,
    onDelete
}) {
    // State for delete confirmation dialog
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // // Log customer data for debugging
    // console.log('CustomerListItem - customer data:', {
    //     id: customer.id,
    //     recordId: customer.recordId,
    //     name: customer.Name,
    //     isActive: customer.isActive
    // });

    const handleStatusToggle = (e) => {
        e.stopPropagation();
        console.log('Toggling status for customer with recordId:', customer.recordId);
        onStatusToggle(customer.recordId, !customer.isActive);
    };
    
    const handleDeleteClick = (e) => {
        e.stopPropagation();
        // Show confirmation dialog instead of deleting immediately
        setShowDeleteConfirm(true);
    };
    
    const confirmDelete = () => {
        console.log('Deleting customer with recordId:', customer.recordId);
        onDelete(customer.recordId);
        setShowDeleteConfirm(false);
    };
    
    const cancelDelete = (e) => {
        if (e) e.stopPropagation();
        setShowDeleteConfirm(false);
    };
    return (
        <div
            onClick={() => onSelect(customer)}
            className={`
                py-1 px-4 cursor-pointer border-b last:border-b-0 relative
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                ${isSelected
                    ? (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                    : (darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                ${customer.isActive
                    ? ''
                    : (darkMode ? 'opacity-50' : 'opacity-60')}
            `}
        >
            <div className="flex items-center justify-between w-full relative">
                <h3 className={`
                    font-medium
                    ${isSelected
                        ? (darkMode ? 'text-white' : 'text-gray-900')
                        : (darkMode ? 'text-gray-300' : 'text-gray-700')}
                `}>
                    {customer.Name}
                </h3>
                
                {/* Action buttons - stacked vertically */}
                <div className="flex flex-col">
                    <button
                        onClick={handleStatusToggle}
                        className={`
                            p-1 rounded-md flex items-center justify-center w-6 h-6
                            ${darkMode
                                ? 'text-gray-500 hover:bg-blue-800 hover:text-white'
                                : 'text-gray-400 hover:bg-blue-100 hover:text-blue-800'}
                            transition-colors duration-200 z-10
                        `}
                        onMouseOver={(e) => {
                            e.currentTarget.classList.add(darkMode ? 'bg-blue-800' : 'bg-blue-100');
                            e.currentTarget.classList.add(darkMode ? 'text-white' : 'text-blue-800');
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.classList.remove(darkMode ? 'bg-blue-800' : 'bg-blue-100');
                            e.currentTarget.classList.remove(darkMode ? 'text-white' : 'text-blue-800');
                        }}
                        title={customer.isActive ? "Deactivate" : "Activate"}
                    >
                        {customer.isActive ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        className={`
                            p-1 rounded-md flex items-center justify-center w-6 h-6
                            ${darkMode
                                ? 'text-gray-500 hover:bg-red-800 hover:text-white'
                                : 'text-gray-400 hover:bg-red-100 hover:text-red-800'}
                            transition-colors duration-200 z-10
                        `}
                        onMouseOver={(e) => {
                            e.currentTarget.classList.add(darkMode ? 'bg-red-800' : 'bg-red-100');
                            e.currentTarget.classList.add(darkMode ? 'text-white' : 'text-red-800');
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.classList.remove(darkMode ? 'bg-red-800' : 'bg-red-100');
                            e.currentTarget.classList.remove(darkMode ? 'text-white' : 'text-red-800');
                        }}
                        title="Delete"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Delete confirmation dialog */}
            {showDeleteConfirm && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`
                            p-4 rounded-md shadow-lg
                            ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
                        `}
                    >
                        <p className="mb-4">Are you sure you want to delete {customer.Name}?</p>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={cancelDelete}
                                className={`
                                    px-3 py-1 rounded-md
                                    ${darkMode
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                                `}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className={`
                                    px-3 py-1 rounded-md
                                    ${darkMode
                                        ? 'bg-red-700 hover:bg-red-600 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'}
                                `}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

CustomerListItem.propTypes = {
    customer: PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        isActive: PropTypes.bool.isRequired
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onStatusToggle: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
};

// Memoized team list item
const TeamListItem = React.memo(function TeamListItem({
    team,
    isSelected,
    darkMode,
    onSelect,
    onDelete
}) {
    // State for delete confirmation dialog
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const handleDeleteClick = (e) => {
        e.stopPropagation();
        // Show confirmation dialog instead of deleting immediately
        setShowDeleteConfirm(true);
    };
    
    const confirmDelete = () => {
        console.log('Deleting team with recordId:', team.recordId);
        onDelete(team.recordId);
        setShowDeleteConfirm(false);
    };
    
    const cancelDelete = (e) => {
        if (e) e.stopPropagation();
        setShowDeleteConfirm(false);
    };
    
    return (
        <div
            onClick={() => onSelect(team)}
            className={`
                py-1 px-4 cursor-pointer border-b last:border-b-0 relative
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                ${isSelected
                    ? (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                    : (darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
            `}
        >
            <div className="flex items-center justify-between w-full relative">
                <h3 className={`
                    font-medium
                    ${isSelected
                        ? (darkMode ? 'text-white' : 'text-gray-900')
                        : (darkMode ? 'text-gray-300' : 'text-gray-700')}
                `}>
                    {team.name}
                </h3>
                
                {/* Delete button */}
                <button
                    onClick={handleDeleteClick}
                    className={`
                        p-1 rounded-md flex items-center justify-center w-6 h-6
                        ${darkMode
                            ? 'text-gray-500 hover:bg-red-800 hover:text-white'
                            : 'text-gray-400 hover:bg-red-100 hover:text-red-800'}
                        transition-colors duration-200 z-10
                    `}
                    onMouseOver={(e) => {
                        e.currentTarget.classList.add(darkMode ? 'bg-red-800' : 'bg-red-100');
                        e.currentTarget.classList.add(darkMode ? 'text-white' : 'text-red-800');
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.classList.remove(darkMode ? 'bg-red-800' : 'bg-red-100');
                        e.currentTarget.classList.remove(darkMode ? 'text-white' : 'text-red-800');
                    }}
                    title="Delete"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            
            {/* Delete confirmation dialog */}
            {showDeleteConfirm && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`
                            p-4 rounded-md shadow-lg
                            ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
                        `}
                    >
                        <p className="mb-4">Are you sure you want to delete {team.name}?</p>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={cancelDelete}
                                className={`
                                    px-3 py-1 rounded-md
                                    ${darkMode
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                                `}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className={`
                                    px-3 py-1 rounded-md
                                    ${darkMode
                                        ? 'bg-red-700 hover:bg-red-600 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'}
                                `}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

TeamListItem.propTypes = {
    team: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
};

function Sidebar({
    customers,
    teams = [],
    selectedCustomer = null,
    selectedTeam = null,
    customerStats = null,
    products = [],
    selectedProduct = null,
    onCustomerSelect,
    onCustomerStatusToggle,
    onCustomerDelete,
    onTeamSelect = () => {},
    onTeamDelete = () => {},
    setShowProductForm,
    selectedMarketingDomain,
    onMarketingDomainSelect
}) {
    const { darkMode } = useTheme();
    const { projects, projectRecords } = useProject();
    const { showFinancialActivity, showFileMakerExample, showSupabaseExample, showQboTestPanel, showCustomerForm, showTeamForm, sidebarMode, showProductForm, showMarketing } = useAppState();
    const { setShowFinancialActivity, setShowFileMakerExample, setShowSupabaseExample, setShowQboTestPanel, setShowCustomerForm, setShowTeamForm, setSidebarMode, setSelectedProduct, setShowProductForm: contextSetShowProductForm, setShowMarketing } = useAppStateOperations();
    const marketingContext = useMarketingContext();
    
    
    // Handle product selection
    const handleProductSelect = (product) => {
        setSelectedProduct(product);
    };

    // State for monthly billable hours
    const [monthlyBillableHours, setMonthlyBillableHours] = useState(0);

    // Fetch monthly billable hours on component mount and when customers change
    useEffect(() => {
        const fetchMonthlyBillable = async () => {
            try {
                const hours = await getMonthlyBillableHoursFromState();
                setMonthlyBillableHours(hours);
            } catch (error) {
                console.error('[Sidebar] Error fetching monthly billable hours:', error);
                setMonthlyBillableHours(0);
            }
        };

        fetchMonthlyBillable();
    }, [customers]); // Refetch when customers change

    // Memoize customer grouping and stats
    const { activeCustomers, inactiveCustomers, stats } = useMemo(() => {
        // Group customers
        const groups = customers.reduce((acc, customer) => {
            if (customer.isActive) {
                acc.activeCustomers.push(customer);
            } else {
                acc.inactiveCustomers.push(customer);
            }
            return acc;
        }, { activeCustomers: [], inactiveCustomers: [] });
        
        // Destructure from groups
        const { activeCustomers } = groups;

        return {
            ...groups,
            stats: {
                active: activeCustomers.length,
                monthlyBillableHours: monthlyBillableHours.toFixed(1)
            }
        };
    }, [customers, monthlyBillableHours]);

    return (
        <div className={`
            w-64 h-[calc(100vh-3.5rem)] flex-shrink-0 border-r flex flex-col overflow-hidden
            ${darkMode ? 'bg-gray-950 border-gray-700' : 'bg-gray-50 border-gray-200'}
        `}>
            {/* Header */}
            <div className={`
                p-4 border-b
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex justify-between items-center">
                    <h2 className={`
                        text-lg font-semibold
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        {sidebarMode === 'customer' ? 'Customers' : sidebarMode === 'team' ? 'Teams' : sidebarMode === 'product' ? 'Products' : 'Marketing'}
                    </h2>
                    {sidebarMode === 'customer' ? (
                        <button
                            onClick={() => setShowCustomerForm(true)}
                            className={`
                                p-1 rounded-md flex items-center justify-center
                                ${darkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                            `}
                            title="Add new customer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    ) : sidebarMode === 'team' ? (
                        <button
                            onClick={() => setShowTeamForm(true)}
                            className={`
                                p-1 rounded-md flex items-center justify-center
                                ${darkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                            `}
                            title="Add new team"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    ) : sidebarMode === 'product' ? (
                        <button
                            onClick={() => {
                                setSelectedProduct(null);
                                contextSetShowProductForm(true);
                            }}
                            className={`
                                p-1 rounded-md flex items-center justify-center
                                ${darkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                            `}
                            title="Add new product"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    ) : sidebarMode === 'marketing' ? (
                        <button
                            onClick={() => {
                                // TODO: Add functionality to create new marketing domain
                                console.log('Add new marketing domain');
                            }}
                            className={`
                                p-1 rounded-md flex items-center justify-center
                                ${darkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                            `}
                            title="Add new marketing domain"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    ) : null}
                </div>
                {sidebarMode === 'customer' && stats && (
                    <div className={`
                        mt-2 text-sm
                        ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                        <span className="font-medium">{stats.monthlyBillableHours}</span> billables
                    </div>
                )}
                
                {/* Financial Activity Button - Hide when marketing mode is active */}
                {sidebarMode !== 'marketing' && (
                    <button
                        onClick={() => setShowFinancialActivity(true)}
                        className={`
                            mt-4 w-full flex items-center justify-center px-4 py-2 rounded-md
                            ${showFinancialActivity
                                ? (darkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800')
                                : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                        `}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Financial Activity
                    </button>
                )}
                
                {/* FileMaker API Example Button - Only shown when VITE_SHOW_FM_API is true */}
                {SHOW_FM_API && (
                    <button
                        onClick={() => setShowFileMakerExample(true)}
                        className={`
                            mt-2 w-full flex items-center justify-center px-4 py-2 rounded-md
                            ${showFileMakerExample
                                ? (darkMode ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800')
                                : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                        `}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        FileMaker API
                    </button>
                )}
                
                {/* Supabase Example Button - Only shown when VITE_SHOW_SPB_API is true */}
                {SHOW_SPB_API && (
                    <button
                        onClick={() => setShowSupabaseExample(true)}
                        className={`
                            mt-2 w-full flex items-center justify-center px-4 py-2 rounded-md
                            ${showSupabaseExample
                                ? (darkMode ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800')
                                : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                        `}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        Supabase API
                    </button>
                )}
                
                {/* QBO Test Panel Button - Only shown when VITE_TEST_QB is true */}
                {SHOW_QBO_TEST && (
                    <button
                        onClick={() => setShowQboTestPanel(true)}
                        className={`
                            mt-2 w-full flex items-center justify-center px-4 py-2 rounded-md
                            ${showQboTestPanel
                                ? (darkMode ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800')
                                : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                        `}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        QBO Test Panel
                    </button>
                )}
                
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto">
                {sidebarMode === 'marketing' ? (
                    /* Marketing Domains List */
                    <>
                            {marketingContext.marketingDomains.map(domain => (
                                <div
                                    key={domain.id}
                                    onClick={() => marketingContext.setSelectedMarketingDomain(domain)}
                                    className={`
                                        py-2 px-4 cursor-pointer border-b last:border-b-0 relative
                                        ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                                        ${marketingContext.selectedMarketingDomain?.id === domain.id
                                            ? (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                                            : (darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                                        ${domain.isActive
                                            ? ''
                                            : (darkMode ? 'opacity-50' : 'opacity-60')}
                                    `}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-lg">{domain.icon}</span>
                                            <div>
                                                <h3 className={`
                                                    font-medium text-sm
                                                    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                                `}>
                                                    {domain.name}
                                                </h3>
                                                {domain.focusCount > 0 && (
                                                    <p className={`
                                                        text-xs
                                                        ${darkMode ? 'text-gray-500' : 'text-gray-500'}
                                                    `}>
                                                        {domain.focusCount} focus area{domain.focusCount !== 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Action button for active/inactive status */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                marketingContext.toggleMarketingDomainStatus(domain.id, !domain.isActive);
                                            }}
                                            className={`
                                                p-1 rounded-md flex items-center justify-center w-6 h-6
                                                ${darkMode
                                                    ? 'text-gray-500 hover:bg-blue-800 hover:text-white'
                                                    : 'text-gray-400 hover:bg-blue-100 hover:text-blue-800'}
                                                transition-colors duration-200 z-10
                                            `}
                                            title={domain.isActive ? "Deactivate" : "Activate"}
                                        >
                                            {domain.isActive ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                ) : sidebarMode === 'customer' ? (
                    /* Customer List */
                    <>
                        {activeCustomers.length > 0 && activeCustomers.map(customer => (
                            <CustomerListItem
                                key={customer.id}
                                customer={customer}
                                isSelected={selectedCustomer?.id === customer.id}
                                darkMode={darkMode}
                                onSelect={() => onCustomerSelect(customer)}
                                onStatusToggle={onCustomerStatusToggle}
                                onDelete={onCustomerDelete}
                            />
                        ))}

                        {inactiveCustomers.length > 0 && inactiveCustomers.map(customer => (
                            <CustomerListItem
                                key={customer.id}
                                customer={customer}
                                isSelected={selectedCustomer?.id === customer.id}
                                darkMode={darkMode}
                                onSelect={() => onCustomerSelect(customer)}
                                onStatusToggle={onCustomerStatusToggle}
                                onDelete={onCustomerDelete}
                            />
                        ))}

                        {/* Empty State */}
                        {customers.length === 0 && (
                            <div className={`
                                p-4 text-center
                                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                            `}>
                                No customers found
                            </div>
                        )}
                    </>
                ) : sidebarMode === 'team' ? (
                    /* Team List */
                    <>
                        {teams.length > 0 && teams.map(team => (
                            <TeamListItem
                                key={team.id}
                                team={team}
                                isSelected={selectedTeam?.id === team.id}
                                darkMode={darkMode}
                                onSelect={() => onTeamSelect(team)}
                                onDelete={onTeamDelete}
                            />
                        ))}

                        {/* Empty State */}
                        {teams.length === 0 && (
                            <div className={`
                                p-4 text-center
                                ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                            `}>
                                No teams found
                            </div>
                        )}
                    </>
                ) : (
                    /* Product List */
                    <>
                        {products.map(product => (
                            <ProductListItem
                                key={product.id}
                                product={product}
                                isSelected={selectedProduct?.id === product.id}
                                darkMode={darkMode}
                                onSelect={handleProductSelect}
                            />
                        ))}
                    </>
                )}
            </div>
            
            {/* Form Modals */}
            {showCustomerForm && (
                <CustomerForm
                    onClose={() => setShowCustomerForm(false)}
                    darkMode={darkMode}
                />
            )}
            
            {showTeamForm && (
                <TeamForm
                    onClose={() => setShowTeamForm(false)}
                    darkMode={darkMode}
                />
            )}
        </div>
    );
}

Sidebar.propTypes = {
    customers: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string,
        isActive: PropTypes.bool.isRequired
    })).isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })),
    products: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        price: PropTypes.number.isRequired,
        description: PropTypes.string
    })),
    selectedCustomer: PropTypes.shape({
        id: PropTypes.string.isRequired
    }),
    selectedTeam: PropTypes.shape({
        id: PropTypes.string.isRequired
    }),
    selectedProduct: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        price: PropTypes.number.isRequired,
        description: PropTypes.string
    }),
    customerStats: PropTypes.shape({
        total: PropTypes.number.isRequired,
        active: PropTypes.number.isRequired,
        inactive: PropTypes.number.isRequired,
        activePercentage: PropTypes.number.isRequired
    }),
    onCustomerSelect: PropTypes.func.isRequired,
    onCustomerStatusToggle: PropTypes.func.isRequired,
    onCustomerDelete: PropTypes.func.isRequired,
    onTeamSelect: PropTypes.func,
    onTeamDelete: PropTypes.func,
    setShowProductForm: PropTypes.func,
    selectedMarketingDomain: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        icon: PropTypes.string,
        focusCount: PropTypes.number,
        isActive: PropTypes.bool
    }),
    onMarketingDomainSelect: PropTypes.func
};

export default React.memo(Sidebar);