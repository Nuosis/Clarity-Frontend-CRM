import React, { useState, useEffect } from 'react';
import { createRoot } from "react-dom/client";
import Table from './components/Table';
import Loading from './components/Loading';

// Function to fetch data from FileMaker
function fetchDataFromFileMaker(callback, attempt = 0) {
    console.log("Attempting to fetch data from FileMaker, attempt:", attempt);
    
    if (typeof FileMaker !== "undefined" && FileMaker.PerformScript) {
        console.log("FileMaker object found. Requesting data...");
        // Call FileMaker script to request data
        FileMaker.PerformScript("po * displayJson * setCache");
    } else if (attempt < 10) {
        setTimeout(() => fetchDataFromFileMaker(callback, attempt + 1), 100);
    } else {
        console.error("Error: FileMaker object is unavailable.");
        callback({ error: true, message: "FileMaker object is unavailable." });
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
    }, [data]);

    // Global function to load data into the app, callable by FileMaker
    window.loadData = (fileMakerData) => {
        try {
            const parsedData = JSON.parse(fileMakerData);
            setData(parsedData);
        } catch (error) {
            console.error("Error parsing data from FileMaker:", error);
            setData({ error: true, message: "Failed to parse data from FileMaker." });
        }
    };
    
    // Force hard reload to bypass cache
    window.onload = () => {
      window.location.reload(true); // `true` forces the reload from the server, not the cache
    };

    // Render Loading or Table based on data availability
    return (
        <div className="p-4">
            {data === null ? (
                <Loading message="Loading data, please wait" />
            ) : data.error ? (
                <div className="text-red-500 text-center py-4">{data.message}</div>
            ) : (
                <Table data={data} />
            )}
        </div>
    );
}

// Render the App to the root element
console.log("version 1.0.4")
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />)