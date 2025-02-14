import React from 'react';
import { useTheme } from './layout/AppLayout';

class ErrorBoundaryClass extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error,
            errorInfo
        });
        
        // Log error to your error reporting service
        console.error('Error Boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorDisplay 
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onReset={() => {
                        this.setState({ 
                            hasError: false,
                            error: null,
                            errorInfo: null
                        });
                        if (this.props.onReset) {
                            this.props.onReset();
                        }
                    }}
                />
            );
        }

        return this.props.children;
    }
}

function ErrorDisplay({ error, errorInfo, onReset }) {
    const { darkMode } = useTheme();

    return (
        <div className={`
            p-6 rounded-lg border
            ${darkMode 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-200 text-gray-900'}
        `}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-red-600">
                        Something went wrong
                    </h2>
                    <button
                        onClick={onReset}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>

                <div className={`
                    p-4 rounded-md
                    ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}
                `}>
                    <p className="font-mono text-sm mb-2">
                        {error?.toString()}
                    </p>
                    {errorInfo && (
                        <pre className={`
                            text-xs overflow-auto
                            ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            {errorInfo.componentStack}
                        </pre>
                    )}
                </div>

                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    If this error persists, please contact support with the error details above.
                </p>
            </div>
        </div>
    );
}

/**
 * Error boundary component with hooks support
 */
export default function ErrorBoundary({ children, onReset }) {
    return (
        <ErrorBoundaryClass onReset={onReset}>
            {children}
        </ErrorBoundaryClass>
    );
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary(Component, onReset) {
    return function WrappedComponent(props) {
        return (
            <ErrorBoundary onReset={onReset}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}