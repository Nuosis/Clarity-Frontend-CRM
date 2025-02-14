import React, { createContext, useContext, useState } from 'react';

// Create theme context
const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {}
});

// Theme provider component
export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);

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

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="flex min-h-screen">
        {/* Sidebar container - fixed width */}
        <aside className="w-[200px] fixed inset-y-0 left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Sidebar content will go here */}
        </aside>

        {/* Main content area - with margin for sidebar */}
        <main className="flex-1 ml-[200px] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}