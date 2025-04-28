import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from './AppLayout';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';

function TopNav() {
  const { darkMode } = useTheme();
  const { sidebarMode, user } = useAppState();
  const { setSidebarMode } = useAppStateOperations();
  const [isUserHovered, setIsUserHovered] = useState(false);
  
  // Memoize handlers to prevent unnecessary re-renders
  const handleCustomerClick = useCallback(() => {
    setSidebarMode('customer');
  }, [setSidebarMode]);
  
  const handleProductClick = useCallback(() => {
    setSidebarMode('product');
  }, [setSidebarMode]);
  
  const handleTeamClick = useCallback(() => {
    setSidebarMode('team');
  }, [setSidebarMode]);
  
  const handleMouseEnter = useCallback(() => {
    setIsUserHovered(true);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsUserHovered(false);
  }, []);

  // CSS reset for buttons to prevent any browser default styles
  const buttonResetStyle = {
    WebkitTapHighlightColor: 'transparent',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    outline: 'none',
    border: 'none',
    boxShadow: 'none',
    background: 'transparent'
  };

  return (
    <div className={`
      w-full h-14 flex items-center justify-between px-4 border-b
      ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-blue-50 border-blue-100 text-gray-800'}
    `} style={{ WebkitTapHighlightColor: 'transparent' }}>
      {/* Logo/Title */}
      <div className="font-bold text-lg">
        <span className={darkMode ? 'text-blue-400' : 'text-blue-600'}>Clarity</span>
        <span> CRM</span>
      </div>
      
      <div className="flex items-center">
        {/* Navigation */}
        <div className="flex h-full transition-all duration-300 ease-in-out" 
             style={{ marginRight: isUserHovered ? '0.5rem' : '0' }}>
          <button
            onClick={handleCustomerClick}
            className={`
              px-6 h-full font-medium flex items-center relative outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus:shadow-none border-none hover:border-none active:border-none
              ${sidebarMode === 'customer'
                ? (darkMode ? 'text-white' : 'text-blue-800')
                : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800')}
            `}
            style={buttonResetStyle}
          >
            <span className="relative">
              Customers
              <span className={`
                absolute -bottom-3 left-0 w-full h-0.5 mb-2 transform transition-all duration-300 ease-in-out shadow-md
                ${sidebarMode === 'customer'
                  ? 'bg-gray-400 scale-x-100 shadow-gray-500/50'
                  : 'scale-x-0 bg-transparent'}
              `}></span>
            </span>
          </button>
          <button
            onClick={handleProductClick}
            className={`
              px-6 h-full font-medium flex items-center relative outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus:shadow-none border-none hover:border-none active:border-none
              ${sidebarMode === 'product'
                ? (darkMode ? 'text-white' : 'text-blue-800')
                : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800')}
            `}
            style={buttonResetStyle}
          >
            <span className="relative">
              Products
              <span className={`
                absolute -bottom-3 left-0 w-full h-0.5 mb-2 transform transition-all duration-300 ease-in-out shadow-md
                ${sidebarMode === 'product'
                  ? 'bg-gray-400 scale-x-100 shadow-gray-500/50'
                  : 'scale-x-0 bg-transparent'}
              `}></span>
            </span>
          </button>
          <button
            onClick={handleTeamClick}
            className={`
              px-6 h-full font-medium flex items-center relative outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus:shadow-none border-none hover:border-none active:border-none
              ${sidebarMode === 'team'
                ? (darkMode ? 'text-white' : 'text-blue-800')
                : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800')}
            `}
            style={buttonResetStyle}
          >
            <span className="relative">
              Teams
              <span className={`
                absolute -bottom-3 left-0 w-full h-0.5 mb-2 transform transition-all duration-300 ease-in-out shadow-md
                ${sidebarMode === 'team'
                  ? 'bg-gray-400 scale-x-100 shadow-gray-500/50'
                  : 'scale-x-0 bg-transparent'}
              `}></span>
            </span>
          </button>
        </div>
        
        {/* User Icon/Name with hover effect */}
        {user && (
          <div
            className={`
              flex items-center rounded-full overflow-hidden transition-all duration-300 ease-in-out
              ${darkMode
                ? 'bg-gray-700 text-gray-200 border border-gray-600'
                : 'bg-white text-gray-700 border border-blue-100 shadow-sm'}
              ${isUserHovered ? 'px-3 py-1' : 'p-1'}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <svg xmlns="http://www.w3.org/2000/svg" 
                 className={`h-5 w-5 ${darkMode ? 'text-blue-400' : 'text-blue-500'} flex-shrink-0`} 
                 viewBox="0 0 20 20" 
                 fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span 
              className={`
                text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out
                ${isUserHovered ? 'max-w-24 ml-2 opacity-100' : 'max-w-0 ml-0 opacity-0'}
              `}
            >
              {user.userName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TopNav);