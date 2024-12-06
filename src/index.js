import React, { useState, useEffect } from 'react';
import { createRoot } from "react-dom/client";
import Loading from './components/loading/Loading';
import FMGofer from 'fm-gofer';

// Function to fetch data from FileMaker
async function fetchDataFromFileMaker(callback, attempt = 0) {
    console.log("Attempting to fetch data from FileMaker, attempt:", attempt);
    
    // Check if we've exceeded max attempts (1 second / 100ms = 10 attempts)
    if (attempt >= 10) {
        console.error("Error: FileMaker object is unavailable after 1 second.");
        callback({ 
            error: true, 
            message: "Failed to fetch data from FileMaker.",
            details: "FileMaker object is unavailable after 1 second." 
        });
        return;
    }

    // Check if FileMaker object exists
    if (typeof FileMaker !== "undefined" && FileMaker.PerformScript) {
        console.log("FileMaker object found. Requesting data via FMgofer...");
        
        try {
            const result = await FMGofer.PerformScript("js * getData");
            
            if (result.errorCode === 0) {
                try {
                    const parsedData = JSON.parse(result.response);
                    callback(parsedData);
                } catch (parseError) {
                    console.error("Error parsing FileMaker response:", parseError);
                    callback({ 
                        error: true, 
                        message: "Failed to parse FileMaker response.",
                        details: parseError.message 
                    });
                }
            } else {
                throw new Error(`FileMaker script error: ${result.errorMessage}`);
            }
        } catch (error) {
            console.error("Error with FMgofer:", error);
            callback({ 
                error: true, 
                message: "Failed to fetch data from FileMaker.",
                details: error.message 
            });
        }
    } else {
        // Wait 100ms before trying again
        setTimeout(() => fetchDataFromFileMaker(callback, attempt + 1), 100);
    }
}

// Main App Component
function App() {
    const [data, setData] = useState(null);

    // Load data from FileMaker on mount
    useEffect(() => {
        fetchDataFromFileMaker((result) => {
            setData(result);
        });
    }, []);

    // Render Loading or data display based on data availability
    return (
        <div className="p-4">
            {data === null ? (
                <Loading message="Loading data, please wait" />
            ) : data.error ? (
                <div className="text-red-500 text-center py-4">
                    {data.message}
                    {data.details && <div className="text-sm mt-2">{data.details}</div>}
                </div>
            ) : (
                <pre className="whitespace-pre-wrap">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

// Render the App to the root element
console.log("version 1.0.5")
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />)
