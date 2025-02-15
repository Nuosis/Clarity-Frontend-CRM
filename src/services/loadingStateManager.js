import React from 'react';

class LoadingStateManager {
    constructor() {
        this.loadingStates = new Map();
        this.listeners = new Set();
    }

    setLoading(key, isLoading, message = '') {
        const previousState = this.loadingStates.get(key);
        this.loadingStates.set(key, { isLoading, message, timestamp: Date.now() });
        
        if (previousState?.isLoading !== isLoading) {
            this.notifyListeners();
        }
    }

    isLoading(key) {
        return this.loadingStates.get(key)?.isLoading || false;
    }

    getMessage(key) {
        return this.loadingStates.get(key)?.message || '';
    }

    getGlobalLoadingState() {
        for (const [key, state] of this.loadingStates) {
            if (state.isLoading) {
                return {
                    isLoading: true,
                    message: state.message,
                    key
                };
            }
        }
        return { isLoading: false, message: '', key: null };
    }

    clearLoadingState(key) {
        if (this.loadingStates.has(key)) {
            this.loadingStates.delete(key);
            this.notifyListeners();
        }
    }

    clearAll() {
        this.loadingStates.clear();
        this.notifyListeners();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Internal method for notifying listeners
    notifyListeners() {
        const globalState = this.getGlobalLoadingState();
        this.listeners.forEach(listener => listener(globalState));
    }

    // Get all current loading states for debugging
    getDebugState() {
        const states = {};
        this.loadingStates.forEach((value, key) => {
            states[key] = value;
        });
        return states;
    }
}

export const loadingStateManager = new LoadingStateManager();

// React hook for using the loading state manager
export function useLoadingState(key) {
    const [state, setState] = React.useState({
        isLoading: loadingStateManager.isLoading(key),
        message: loadingStateManager.getMessage(key)
    });

    React.useEffect(() => {
        const unsubscribe = loadingStateManager.subscribe((globalState) => {
            setState({
                isLoading: loadingStateManager.isLoading(key),
                message: loadingStateManager.getMessage(key)
            });
        });

        return unsubscribe;
    }, [key]);

    return state;
}

// React hook for global loading state
export function useGlobalLoadingState() {
    const [state, setState] = React.useState(loadingStateManager.getGlobalLoadingState());

    React.useEffect(() => {
        const unsubscribe = loadingStateManager.subscribe(setState);
        return unsubscribe;
    }, []);

    return state;
}