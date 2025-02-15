import { fetchDataFromFileMaker } from '../api/fileMaker';

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff delays in ms

class InitializationService {
    constructor() {
        this.currentPhase = 'idle';
        this.retryCount = 0;
    }

    async waitForFileMaker(checkReadyFn, maxRetries = 5) {
        this.currentPhase = 'connecting';
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (checkReadyFn()) {
                    return true;
                }
                await this.delay(RETRY_DELAYS[i]);
            } catch (error) {
                console.error('FileMaker connection attempt failed:', error);
                if (i === maxRetries - 1) {
                    throw new Error('Failed to connect to FileMaker after multiple attempts');
                }
            }
        }
        return false;
    }

    async loadUserContext() {
        this.currentPhase = 'loading_user';
        try {
            const userContext = await fetchDataFromFileMaker({
                action: 'returnContext'
            });
            return userContext;
        } catch (error) {
            throw new Error(`Failed to load user context: ${error.message}`);
        }
    }

    async preloadData(loadCustomers) {
        this.currentPhase = 'preloading_data';
        try {
            await loadCustomers();
        } catch (error) {
            throw new Error(`Failed to preload data: ${error.message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getCurrentPhase() {
        return this.currentPhase;
    }

    reset() {
        this.currentPhase = 'idle';
        this.retryCount = 0;
    }
}

export const initializationService = new InitializationService();