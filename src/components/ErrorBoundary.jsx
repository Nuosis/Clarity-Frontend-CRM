import React, { useCallback } from 'react';
import { loadingStateManager } from '../services/loadingStateManager';
import { useAppStateOperations } from '../context/AppStateContext';
import { useSnackBar } from '../context/SnackBarContext';

class ErrorBoundaryFallback extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error, errorInfo) {
        // Check if we should show the error boundary
        const shouldShowErrorBoundary = this.props.onError ? this.props.onError(error) : true;
        
        if (shouldShowErrorBoundary) {
            this.setState({
                errorInfo
            });
            
            // Log error to console for debugging
            console.error('Error caught by boundary:', error);
            console.error('Error stack:', errorInfo.componentStack);
        } else {
            // Reset error state if we're not showing the error boundary
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null
            });
        }
    }

    handleRetry = () => {
        // Clear loading states
        loadingStateManager.clearAll();
        
        // Reset error state
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });

        // Call parent's retry handler if provided
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-red-600 mb-4">
                                Something went wrong
                            </h2>
                            <div className="text-gray-600 dark:text-gray-300 mb-6">
                                {this.state.error?.message || 'An unexpected error occurred'}
                            </div>
                            {import.meta.env?.MODE === 'development' && (
                                <pre className="text-left bg-gray-100 dark:bg-gray-700 p-4 rounded mb-6 overflow-auto text-sm">
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            )}
                            <button
                                onClick={this.handleRetry}
                                className="bg-blue-500 hover:bg-bg-[#004967] text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Wrapper component to provide hooks to class component
export default function ErrorBoundary({ children }) {
    const { resetState } = useAppStateOperations();
    const { showError } = useSnackBar();

    const handleRetry = useCallback(() => {
        // Reset application state
        resetState();
    }, [resetState]);

    // Create error handler for non-critical errors
    const handleError = useCallback((error) => {
        // Show non-critical errors in SnackBar
        if (error && !error.critical) {
            showError(error.message || 'An unexpected error occurred');
            return false; // Don't show error boundary for non-critical errors
        }
        return true; // Show error boundary for critical errors
    }, [showError]);

    return (
        <ErrorBoundaryFallback onRetry={handleRetry} onError={handleError}>
            {children}
        </ErrorBoundaryFallback>
    );
}