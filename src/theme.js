/**
 * Theme configuration for styled-components
 * Integrates with Tailwind dark mode system
 */

export const lightTheme = {
  colors: {
    // Primary colors
    primary: '#007bff',
    primaryDark: '#0056b3',
    primaryLight: 'rgba(0, 123, 255, 0.1)',

    // Status colors
    success: '#28a745',
    successDark: '#218838',
    danger: '#dc3545',
    dangerDark: '#bd2130',
    warning: '#ffc107',
    info: '#17a2b8',

    // Background colors
    background: {
      primary: '#ffffff',
      secondary: '#f8f9fa',
      tertiary: '#e9ecef'
    },

    // Text colors
    text: {
      primary: '#212529',
      secondary: '#6c757d',
      tertiary: '#adb5bd',
      inverse: '#ffffff'
    },

    // Border colors
    border: '#dee2e6',
    borderDark: '#ced4da',

    // Deliverable type colors
    deliverable: {
      fixed: '#28a745',
      hourly: '#17a2b8',
      subscription: '#6610f2'
    },

    // Requirement category colors
    requirement: {
      content: '#17a2b8',
      access: '#28a745',
      assets: '#ffc107',
      documentation: '#6c757d',
      credentials: '#dc3545',
      other: '#6610f2'
    },

    // Priority colors
    priority: {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#6c757d'
    }
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 8px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.1)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.12)'
  },

  // Border radius
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px'
  },

  // Transitions
  transitions: {
    fast: '0.15s ease',
    base: '0.2s ease',
    slow: '0.3s ease'
  }
};

export const darkTheme = {
  colors: {
    // Primary colors - slightly adjusted for dark mode
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryLight: 'rgba(59, 130, 246, 0.2)',

    // Status colors - adjusted for dark mode visibility
    success: '#34d399',
    successDark: '#10b981',
    danger: '#f87171',
    dangerDark: '#ef4444',
    warning: '#fbbf24',
    info: '#22d3ee',

    // Background colors - dark mode
    background: {
      primary: '#1f2937',    // gray-800
      secondary: '#111827',  // gray-900
      tertiary: '#0f172a'    // slate-900
    },

    // Text colors - dark mode
    text: {
      primary: '#f9fafb',    // gray-50
      secondary: '#d1d5db',  // gray-300
      tertiary: '#9ca3af',   // gray-400
      inverse: '#111827'     // gray-900
    },

    // Border colors - dark mode
    border: '#374151',      // gray-700
    borderDark: '#4b5563',  // gray-600

    // Deliverable type colors (same as light)
    deliverable: {
      fixed: '#34d399',
      hourly: '#22d3ee',
      subscription: '#a78bfa'
    },

    // Requirement category colors (adjusted for dark mode)
    requirement: {
      content: '#22d3ee',
      access: '#34d399',
      assets: '#fbbf24',
      documentation: '#9ca3af',
      credentials: '#f87171',
      other: '#a78bfa'
    },

    // Priority colors (adjusted for dark mode)
    priority: {
      critical: '#f87171',
      high: '#fb923c',
      medium: '#fbbf24',
      low: '#9ca3af'
    }
  },

  // Shadows - adjusted for dark mode
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 2px 8px rgba(0, 0, 0, 0.4)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.5)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.6)'
  },

  // Border radius (same as light)
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px'
  },

  // Transitions (same as light)
  transitions: {
    fast: '0.15s ease',
    base: '0.2s ease',
    slow: '0.3s ease'
  }
};
