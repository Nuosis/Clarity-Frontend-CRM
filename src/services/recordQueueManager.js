import { fetchDataFromFileMaker } from '../api';

// Singleton queue manager for FileMaker record fetching
class RecordQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.callbacks = new Map();
        
        // Initialize global returnRecords function
        window.returnRecords = (data) => {
            if (data?.response?.data) {
                const currentRequest = this.queue[0];
                const callback = this.callbacks.get(currentRequest?.callbackId);
                if (callback) {
                    callback(data.response.data);
                    this.callbacks.delete(currentRequest.callbackId);
                }
            }
            
            // Remove processed request and continue queue
            this.queue.shift();
            this.isProcessing = false;
            this.processQueue();
        };
    }

    processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const request = this.queue[0];
        fetchDataFromFileMaker(request.params, 0, false);
    }

    enqueue(params, callback) {
        const callbackId = Date.now().toString();
        this.callbacks.set(callbackId, callback);
        
        this.queue.push({
            params: { ...params, callbackId },
            callbackId
        });
        
        this.processQueue();
    }
}

// Export singleton instance
export const recordQueueManager = new RecordQueueManager();