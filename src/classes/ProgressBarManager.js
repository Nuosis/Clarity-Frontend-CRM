class ProgressBarManager {
    constructor() {
        this.config = {
            start: 0,
            stop: 100,
            currentValue: 0,
            color: '#0891b2',
            display: true
        };
        this.listeners = [];
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.notifyListeners();
    }

    getConfig() {
        // Return a deep clone to prevent mutations
        return JSON.parse(JSON.stringify(this.config));
    }

    setProgress(value) {
        const boundedValue = Math.min(Math.max(value, this.config.start), this.config.stop);
        this.updateConfig({ currentValue: boundedValue });
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => this.unsubscribe(listener);
    }

    unsubscribe(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    notifyListeners() {
        const config = this.getConfig(); // Use cloned config for notifications
        this.listeners.forEach(listener => listener(config));
    }
}

export const progressBarManager = new ProgressBarManager();
