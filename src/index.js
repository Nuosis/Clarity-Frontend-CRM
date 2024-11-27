import React, { useEffect } from 'react';
import { createRoot } from "react-dom/client";
import ProgressBar from './components/ProgressBar';
import { progressBarManager } from './classes/ProgressBarManager';

// Function to fetch data from FileMaker
function wakeUpFileMaker(callback, attempt = 0) {
  console.log("Attempting to wake up FileMaker, attempt:", attempt);
  if (typeof FileMaker !== "undefined" && FileMaker.PerformScript) {
      console.log("FileMaker object found. waking up...");
      FileMaker.PerformScriptWithOption("app*js*callback", null, 3);
  } else if (attempt < 10) {
      setTimeout(() => wakeUpFileMaker(callback, attempt + 1), 100);
  } else {
      console.error("Error: FileMaker object is unavailable.");
      callback({ error: true, message: "FileMaker object is unavailable." });
  }
}

// Main App Component
function App() {
    useEffect(() => {
        // Subscribe to config changes to keep window.progressConfig updated
        const unsubscribe = progressBarManager.subscribe(newConfig => {
            window.progressConfig = newConfig;
        });

        // wakeUpFileMaker();

        return () => unsubscribe();
    }, []);

    // Global function to update progress configuration, callable by FileMaker
    window.updateProgress = (configJson) => {
        try {
            const config = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
            progressBarManager.updateConfig(config);
            console.log('Progress updated:', progressBarManager.getConfig());
        } catch (error) {
            console.error("Error updating progress configuration:", error);
        }
    };

    // Initialize window.progressConfig
    window.progressConfig = progressBarManager.getConfig();

    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl">
                    <ProgressBar />
                </div>
            </div>
        </div>
    );
}

// Render the App to the root element
console.log("progressBar v1.1")
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />)
