import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create theme context
const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {}
});

// Theme provider component
export function ThemeProvider({ children }) {
  // Initialize with system preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Update dark mode class on html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook for using theme
export function useTheme() {
  return useContext(ThemeContext);
}

// Main layout component
export default function AppLayout({ children }) {
  const { darkMode } = useTheme();

  // Expect exactly two children: Sidebar and MainContent
  const [sidebar, mainContent] = React.Children.toArray(children);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex min-h-screen">
        {/* Sidebar container - fixed width */}
        <aside className="w-64 fixed inset-y-0 left-0">
          {sidebar}
        </aside>

        {/* Main content area - with margin for sidebar */}
        <main className="flex-1 ml-64 p-6">
          {mainContent}
        </main>
      </div>
    </div>
  );
}

AppLayout.propTypes = {
  children: PropTypes.arrayOf(PropTypes.element).isRequired
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
};