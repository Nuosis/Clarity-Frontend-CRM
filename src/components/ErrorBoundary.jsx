import React, { useCallback } from 'react';
import { loadingStateManager } from '../services/loadingStateManager';
import { useAppStateOperations } from '../context/AppStateContext';

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
        this.setState({
            errorInfo
        });
        
        // Log error to console for debugging
        console.error('Error caught by boundary:', error);
        console.error('Error stack:', errorInfo.componentStack);
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
                            {process.env.NODE_ENV === 'development' && (
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

    const handleRetry = useCallback(() => {
        // Reset application state
        resetState();
    }, [resetState]);

    return (
        <ErrorBoundaryFallback onRetry={handleRetry}>
            {children}
        </ErrorBoundaryFallback>
    );
}